import fs from 'node:fs'

const indexes = JSON.parse(fs.readFileSync('firestore.indexes.json', 'utf8')).indexes ?? []

const required = [
  ['tickets', 'status:ASCENDING,createdAt:DESCENDING'],
  ['tickets', 'propertyId:ASCENDING,createdAt:DESCENDING'],
  ['tickets', 'propertyId:ASCENDING,status:ASCENDING,createdAt:DESCENDING'],
  ['tickets', 'status:ASCENDING,updatedAt:DESCENDING'],
  ['tickets', 'propertyId:ASCENDING,status:ASCENDING,updatedAt:DESCENDING'],
  ['tickets', 'propertyId:ASCENDING,updatedAt:DESCENDING'],
  ['tickets', 'propertyId:ASCENDING,requesterUid:ASCENDING,createdAt:DESCENDING'],
  ['rcaRecords', 'propertyId:ASCENDING,updatedAt:DESCENDING'],
  ['auditEvents', 'propertyId:ASCENDING,createdAt:DESCENDING,__name__:DESCENDING'],
  ['assets', 'status:ASCENDING,updatedAt:DESCENDING'],
  ['assets', 'propertyId:ASCENDING,updatedAt:DESCENDING'],
  ['assets', 'propertyId:ASCENDING,status:ASCENDING,updatedAt:DESCENDING'],
  ['ticketAssetOptions', 'propertyId:ASCENDING,updatedAt:DESCENDING'],
  ['requestUsers', 'propertyId:ASCENDING,createdAt:DESCENDING'],
  ['softwareLicenses', 'propertyId:ASCENDING,expiresOn:ASCENDING'],
  ['pmSchedules', 'propertyId:ASCENDING,nextDueOn:ASCENDING'],
  ['infrastructureIncidents', 'propertyId:ASCENDING,startedAt:DESCENDING'],
  ['cctvDailyChecks', 'propertyId:ASCENDING,checkedOn:DESCENDING'],
  ['cctvNvrInventory', 'propertyId:ASCENDING,name:ASCENDING'],
  ['operationalTodos', 'propertyId:ASCENDING,startDate:DESCENDING'],
  ['operationalTodoCompletions', 'propertyId:ASCENDING,occurrenceDate:ASCENDING'],
]

function signature(index) {
  const fields = (index.fields ?? []).map((field) => `${field.fieldPath}:${field.order}`).join(',')
  return [index.collectionGroup, fields]
}

const available = new Set(indexes.map(signature).map(([collection, fields]) => `${collection}|${fields}`))
const missing = required.filter(([collection, fields]) => !available.has(`${collection}|${fields}`))

if (missing.length > 0) {
  console.error('Missing Firestore composite index contract entries:')
  for (const [collection, fields] of missing) console.error(`- ${collection}: ${fields}`)
  process.exit(1)
}

console.log(`Firestore query/index contract passed (${required.length} required composite indexes).`)
