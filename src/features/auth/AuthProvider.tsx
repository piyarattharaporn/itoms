import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  type User,
} from 'firebase/auth'
import {
  collection,
  doc,
  onSnapshot,
  query,
  where,
  type DocumentData,
} from 'firebase/firestore'
import { auth, db, isConfigured } from '../../lib/firebase'
import type { GlobalRole, PropertyMembership, PropertyOption, PropertyRole, UserProfile } from './types'

type AccessState = 'loading' | 'signedOut' | 'unprovisioned' | 'inactive' | 'ready' | 'noProperties'

interface AuthContextValue {
  firebaseUser: User | null
  profile: UserProfile | null
  memberships: PropertyMembership[]
  properties: PropertyOption[]
  accessState: AccessState
  error: string | null
  firebaseReady: boolean
  signIn: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function isGlobalRole(value: unknown): value is GlobalRole {
  return value === 'superAdmin' || value === 'member'
}

function isPropertyRole(value: unknown): value is PropertyRole {
  return value === 'supportEngineer' || value === 'clientExecutive' || value === 'requester'
}

function readProfile(uid: string, data: DocumentData): UserProfile | null {
  if (!isGlobalRole(data.globalRole) || typeof data.active !== 'boolean') return null

  return {
    uid,
    displayName: typeof data.displayName === 'string' ? data.displayName : '',
    email: typeof data.email === 'string' ? data.email : '',
    globalRole: data.globalRole,
    active: data.active,
  }
}

function readMembership(id: string, data: DocumentData): PropertyMembership | null {
  if (
    typeof data.userId !== 'string' ||
    typeof data.propertyId !== 'string' ||
    typeof data.propertyCode !== 'string' ||
    typeof data.propertyName !== 'string' ||
    !isPropertyRole(data.role) ||
    typeof data.active !== 'boolean'
  ) return null

  return {
    id,
    userId: data.userId,
    propertyId: data.propertyId,
    propertyCode: data.propertyCode,
    propertyName: data.propertyName,
    role: data.role,
    active: data.active,
  }
}

function authErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : ''

  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
  }
  if (code === 'auth/too-many-requests') return 'มีการลองเข้าสู่ระบบหลายครั้ง กรุณารอสักครู่แล้วลองใหม่'
  if (code === 'auth/network-request-failed') return 'เชื่อมต่อระบบไม่ได้ ตรวจสอบว่า Firebase Emulator กำลังทำงานอยู่'
  if (code === 'auth/popup-closed-by-user') return 'ปิดหน้าต่าง Google ก่อนเข้าสู่ระบบเสร็จสิ้น'
  if (code === 'auth/unauthorized-domain') return 'โดเมนนี้ยังไม่ได้รับอนุญาตสำหรับ Google Sign-In'
  if (code === 'auth/operation-not-allowed') return 'ยังไม่ได้เปิดใช้งาน Google Sign-In ใน Firebase Authentication'
  if (code === 'auth/cancelled-popup-request') return 'มีหน้าต่างเข้าสู่ระบบ Google เปิดอยู่แล้ว'
  return 'เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [memberships, setMemberships] = useState<PropertyMembership[]>([])
  const [properties, setProperties] = useState<PropertyOption[]>([])
  const [accessState, setAccessState] = useState<AccessState>('loading')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const authClient = auth
    const firestore = db
    if (!authClient || !firestore || !isConfigured) {
      setAccessState('signedOut')
      return
    }

    let unsubscribeProfile: (() => void) | undefined
    let unsubscribeAccess: (() => void) | undefined
    let active = true

    const unsubscribeAuth = onAuthStateChanged(authClient, (user) => {
      unsubscribeProfile?.()
      unsubscribeAccess?.()
      unsubscribeProfile = undefined
      unsubscribeAccess = undefined
      setError(null)
      setFirebaseUser(user)
      setProfile(null)
      setMemberships([])
      setProperties([])

      if (!user) {
        setAccessState('signedOut')
        return
      }

      setAccessState('loading')
      unsubscribeProfile = onSnapshot(
        doc(firestore, 'users', user.uid),
        (snapshot) => {
          if (!active) return
          if (!snapshot.exists()) {
            setProfile(null)
            setAccessState('unprovisioned')
            return
          }

          const nextProfile = readProfile(user.uid, snapshot.data())
          if (!nextProfile) {
            setProfile(null)
            setError('ข้อมูลโปรไฟล์ไม่ครบหรือไม่ถูกต้อง กรุณาติดต่อผู้ดูแลระบบ')
            setAccessState('unprovisioned')
            return
          }

          setProfile(nextProfile)
          if (!nextProfile.active) {
            setAccessState('inactive')
            return
          }

          unsubscribeAccess?.()
          setError(null)
          if (nextProfile.globalRole === 'superAdmin') {
            unsubscribeAccess = onSnapshot(
              collection(firestore, 'properties'),
              (propertySnapshot) => {
                if (!active) return
                const nextProperties = propertySnapshot.docs
                  .filter((property) => property.data().active !== false)
                  .map((property) => ({
                    id: property.id,
                    code: typeof property.data().code === 'string' ? property.data().code : property.id,
                    name: typeof property.data().name === 'string' ? property.data().name : property.id,
                    cctvEnabled: property.data().cctvEnabled !== false,
                  }))
                  .sort((a, b) => a.name.localeCompare(b.name, 'th'))
                setProperties(nextProperties)
                setAccessState('ready')
              },
              () => {
                if (!active) return
                setError('โหลดรายการ Property ไม่สำเร็จ')
                setAccessState('ready')
              },
            )
            return
          }

          const membershipQuery = query(collection(firestore, 'memberships'), where('userId', '==', user.uid))
          unsubscribeAccess = onSnapshot(
            membershipQuery,
            (membershipSnapshot) => {
              if (!active) return
              const nextMemberships = membershipSnapshot.docs
                .map((membership) => readMembership(membership.id, membership.data()))
                .filter((membership): membership is PropertyMembership => membership !== null && membership.active)
              setMemberships(nextMemberships)
              setProperties(nextMemberships
                .map((membership) => ({ id: membership.propertyId, code: membership.propertyCode, name: membership.propertyName }))
                .sort((a, b) => a.name.localeCompare(b.name, 'th')))
              setAccessState(nextMemberships.length > 0 ? 'ready' : 'noProperties')
            },
            () => {
              if (!active) return
              setError('โหลดสิทธิ์ Property ไม่สำเร็จ')
              setAccessState('noProperties')
            },
          )
        },
        () => {
          if (!active) return
          setError('อ่านโปรไฟล์ไม่ได้ ตรวจสอบ Firestore Rules และ Emulator')
          setAccessState('unprovisioned')
        },
      )
    })

    return () => {
      active = false
      unsubscribeAuth()
      unsubscribeProfile?.()
      unsubscribeAccess?.()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    firebaseUser,
    profile,
    memberships,
    properties,
    accessState,
    error,
    firebaseReady: Boolean(auth && db && isConfigured),
    signIn: async (email, password) => {
      if (!auth) throw new Error('Firebase Auth ยังไม่ได้ตั้งค่า')
      setError(null)
      try {
        await signInWithEmailAndPassword(auth, email.trim(), password)
      } catch (cause) {
        const message = authErrorMessage(cause)
        setError(message)
        throw new Error(message)
      }
    },
    signInWithGoogle: async () => {
      if (!auth) throw new Error('Firebase Auth ยังไม่ได้ตั้งค่า')
      setError(null)
      try {
        const provider = new GoogleAuthProvider()
        provider.setCustomParameters({ prompt: 'select_account' })
        await signInWithPopup(auth, provider)
      } catch (cause) {
        const message = authErrorMessage(cause)
        setError(message)
        throw new Error(message)
      }
    },
    signOut: async () => {
      if (!auth) return
      await firebaseSignOut(auth)
    },
  }), [firebaseUser, profile, memberships, properties, accessState, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth ต้องอยู่ภายใน AuthProvider')
  return value
}
