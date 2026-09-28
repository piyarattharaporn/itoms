import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'
import type { SlaPolicyConfig } from '../../../shared/sla-contracts'

function firestore() {
  if (!db) throw new Error('Firebase ยังไม่ได้ตั้งค่า')
  return db
}

export function subscribeToPropertyCctvSetting(
  propertyId: string,
  onValue: (enabled: boolean) => void,
  onError: () => void,
) {
  return onSnapshot(
    doc(firestore(), 'properties', propertyId),
    (snapshot) => {
      onValue(snapshot.exists() ? snapshot.data().cctvEnabled !== false : false)
    },
    onError,
  )
}

export async function setPropertyCctvEnabled(propertyId: string, enabled: boolean) {
  await updateDoc(doc(firestore(), 'properties', propertyId), {
    cctvEnabled: enabled,
    updatedAt: serverTimestamp(),
  })
}

export async function setPropertySlaPolicy(propertyId: string, policy: SlaPolicyConfig) {
  await updateDoc(doc(firestore(), 'properties', propertyId), {
    slaPolicy: policy,
    updatedAt: serverTimestamp(),
  })
}
