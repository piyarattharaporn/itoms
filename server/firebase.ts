import { getApps, initializeApp, type App } from 'firebase-admin/app'
import { getAuth, type Auth } from 'firebase-admin/auth'
import { getFirestore, type Firestore } from 'firebase-admin/firestore'
import type { ServerConfig } from './config.js'

export interface AdminServices {
  app: App
  auth: Auth
  db: Firestore
}

export function createAdminServices(config: ServerConfig): AdminServices {
  const name = `itoms-phase3-${config.projectId}`
  const app = getApps().find((candidate) => candidate.name === name) ?? initializeApp({ projectId: config.projectId }, name)
  return { app, auth: getAuth(app), db: getFirestore(app) }
}
