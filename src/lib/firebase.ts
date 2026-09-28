import { initializeApp, type FirebaseApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from 'firebase/app-check'
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth'
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const hasClientConfig = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId)
const useEmulators = import.meta.env.DEV
  && import.meta.env.VITE_USE_FIREBASE_EMULATORS === 'true'
  && firebaseConfig.projectId?.startsWith('demo-') === true
// During local development, never fall back to a live Firebase project.
const looksLikePlaceholder = (value: string | undefined) => !value || value.startsWith('replace-with-')
const hasProductionConfig = !looksLikePlaceholder(firebaseConfig.apiKey)
  && !looksLikePlaceholder(firebaseConfig.authDomain)
  && !looksLikePlaceholder(firebaseConfig.projectId)
  && !looksLikePlaceholder(firebaseConfig.appId)
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY
const useAppCheck = import.meta.env.PROD
  && !useEmulators
  && import.meta.env.VITE_ENABLE_APP_CHECK === 'true'
const appCheckConfigValid = !useAppCheck || !looksLikePlaceholder(appCheckSiteKey)
const isLiveProductionConfig = import.meta.env.PROD
  && import.meta.env.VITE_USE_FIREBASE_EMULATORS !== 'true'
  && !firebaseConfig.projectId?.startsWith('demo-')
  && hasProductionConfig
const isConfigured = hasClientConfig && appCheckConfigValid && (useEmulators || isLiveProductionConfig)

let app: FirebaseApp | undefined
let auth: Auth | undefined
let db: Firestore | undefined
let appCheck: AppCheck | undefined

if (isConfigured) {
  app = initializeApp(firebaseConfig)
  auth = getAuth(app)
  db = getFirestore(app)

  if (useEmulators) {
    const authPort = Number(import.meta.env.VITE_AUTH_EMULATOR_PORT) || 9099
    const firestorePort = Number(import.meta.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080
    connectAuthEmulator(auth, `http://127.0.0.1:${authPort}`, { disableWarnings: true })
    connectFirestoreEmulator(db, '127.0.0.1', firestorePort)
  }

  // App Check is deliberately opt-in and never enabled for the local Emulator.
  // Enforcement is configured in Firebase Console; this only initializes the client token provider.
  if (useAppCheck && appCheckSiteKey) {
    appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    })
  }
}

export { app, appCheck, auth, db, isConfigured, useAppCheck, useEmulators }
