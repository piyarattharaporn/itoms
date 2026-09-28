import { doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { db } from '../../lib/firebase'

function firestore() {
  if (!db) throw new Error('Firebase ยังไม่ได้ตั้งค่า')
  return db
}

export function subscribeToPropertyCctvSetting(propertyId: string, onValue: (enabled: boolean) => void, onError: () => void) {
  return onSnapshot(doc(firestore(), 'properties', propertyId), (snapshot) => {
    onValue(snapshot.exists() ? snapshot.data().cctvEnabled !== false : false)
  }, onError)
}

export async function setPropertyCctvEnabled(propertyId: string, enabled: boolean) {
  await updateDoc(doc(firestore(), 'properties', propertyId), {
    cctvEnabled: enabled,
    updatedAt: serverTimestamp(),
  })
}
