import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-lotus-it-portal-local'
const authPort = Number(process.env.VITE_AUTH_EMULATOR_PORT) || 9099
const firestorePort = Number(process.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080

process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${authPort}`
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firestorePort}`

initializeApp({ projectId })

const email = 'local.admin@example.test'
const password = 'LocalAdmin123!'
const displayName = 'Local Super Admin'
const auth = getAuth()
const db = getFirestore()

let user
try {
  user = await auth.getUserByEmail(email)
} catch (error) {
  if (error?.code !== 'auth/user-not-found') throw error
  user = await auth.createUser({ email, password, displayName, emailVerified: true })
}

await db.doc(`users/${user.uid}`).set({
  displayName,
  email,
  globalRole: 'superAdmin',
  active: true,
}, { merge: true })

await db.doc('properties/LOCAL').set({
  code: 'LOCAL',
  name: 'Local Test Property',
  active: true,
  cctvEnabled: true,
  updatedAt: new Date().toISOString(),
}, { merge: true })

await db.doc(`memberships/${user.uid}__LOCAL`).set({
  userId: user.uid,
  propertyId: 'LOCAL',
  propertyCode: 'LOCAL',
  propertyName: 'Local Test Property',
  role: 'supportEngineer',
  active: true,
}, { merge: true })

console.log(`Local seed ready for ${email}`)
console.log(`Auth emulator: http://127.0.0.1:${authPort}`)
console.log(`Firestore emulator: http://127.0.0.1:${firestorePort}`)
