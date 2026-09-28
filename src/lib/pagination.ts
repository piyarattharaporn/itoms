import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore'

export type FirestoreCursor = QueryDocumentSnapshot<DocumentData> | null

export interface CursorPage<T> {
  items: T[]
  nextCursor: FirestoreCursor
  hasMore: boolean
}
