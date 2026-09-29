import { initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'demo-lotus-it-portal-local'
const authPort = Number(process.env.VITE_AUTH_EMULATOR_PORT) || 9099
const firestorePort = Number(process.env.VITE_FIRESTORE_EMULATOR_PORT) || 8080

process.env.FIREBASE_AUTH_EMULATOR_HOST = `127.0.0.1:${authPort}`
process.env.FIRESTORE_EMULATOR_HOST = `127.0.0.1:${firestorePort}`

initializeApp({ projectId })

const auth = getAuth()
const db = getFirestore()
const today = new Date()

function daysAgo(days) {
  return new Date(today.getTime() - days * 86_400_000)
}

function daysFromNow(days) {
  return new Date(today.getTime() + days * 86_400_000)
}

function dateOnly(date) {
  return date.toISOString().slice(0, 10)
}

async function ensureUser({ email, password, displayName, globalRole = 'member' }) {
  let user
  try {
    user = await auth.getUserByEmail(email)
  } catch (error) {
    if (error?.code !== 'auth/user-not-found') throw error
    user = await auth.createUser({ email, password, displayName, emailVerified: true })
  }
  await db.doc(`users/${user.uid}`).set({ displayName, email, globalRole, active: true }, { merge: true })
  return user
}

const admin = await ensureUser({
  email: 'local.admin@example.test',
  password: 'LocalAdmin123!',
  displayName: 'Local Super Admin',
  globalRole: 'superAdmin',
})
const engineer = await ensureUser({
  email: 'local.engineer@example.test',
  password: 'LocalEngineer123!',
  displayName: 'Narin Support Engineer',
})
const executive = await ensureUser({
  email: 'local.executive@example.test',
  password: 'LocalExecutive123!',
  displayName: 'Mali Client Executive',
})
const requester = await ensureUser({
  email: 'local.requester@example.test',
  password: 'LocalRequester123!',
  displayName: 'Somchai Requester',
})

const property = {
  id: 'LOCAL',
  code: 'LOCAL',
  name: 'Local Test Property',
}

await db.doc('properties/LOCAL').set(
  {
    code: property.code,
    name: property.name,
    active: true,
    cctvEnabled: true,
    slaPolicy: {
      id: 'local-sample-policy',
      version: 1,
      calendar: '24x7',
      targets: {
        Critical: { responseMinutes: 30, resolutionMinutes: 240 },
        High: { responseMinutes: 60, resolutionMinutes: 480 },
        Medium: { responseMinutes: 240, resolutionMinutes: 1440 },
        Low: { responseMinutes: 480, resolutionMinutes: 2880 },
      },
    },
    updatedAt: today,
  },
  { merge: true },
)

for (const [user, role] of [
  [admin, 'supportEngineer'],
  [engineer, 'supportEngineer'],
  [executive, 'clientExecutive'],
  [requester, 'requester'],
]) {
  await db.doc(`memberships/${user.uid}__LOCAL`).set(
    {
      userId: user.uid,
      displayName: user.displayName,
      propertyId: property.id,
      propertyCode: property.code,
      propertyName: property.name,
      role,
      active: true,
    },
    { merge: true },
  )
}

const assets = [
  {
    id: 'sample-asset-laptop',
    assetTag: 'LOCAL-LAP-001',
    name: 'IT Support Laptop',
    category: 'Computer PC',
    department: 'IT',
    location: 'IT Office',
    vendor: 'Dell',
    model: 'Latitude 5440',
    spec: 'Core i5 / 16GB / 512GB SSD',
    detail: 'Sampling asset for local E2E tests',
    usedBy: engineer.uid,
    serialNumber: 'LOCAL-LAP-001',
    warrantyExpiresOn: dateOnly(daysFromNow(180)),
    ownershipType: 'Owned',
    lessorName: '',
    leaseContractNumber: '',
    leaseStartDate: '',
    leaseEndDate: '',
    monthlyRentalCost: null,
    status: 'In Service',
    serviceType: '',
    serviceVendor: '',
    serviceSentOn: '',
    expectedReturnOn: '',
    serviceNotes: '',
  },
  {
    id: 'sample-asset-camera',
    assetTag: 'LOCAL-CCTV-001',
    name: 'CCTV South Wing Floor 3',
    category: 'CCTV Camera',
    department: 'IT',
    location: 'South Wing',
    vendor: 'Lotus Technology',
    model: 'DS-2CE56COT-IRMF',
    spec: '2MP IR camera',
    detail: 'Sampling damaged asset',
    usedBy: '',
    serialNumber: 'C16131066',
    warrantyExpiresOn: dateOnly(daysFromNow(20)),
    ownershipType: 'Owned',
    lessorName: '',
    leaseContractNumber: '',
    leaseStartDate: '',
    leaseEndDate: '',
    monthlyRentalCost: null,
    status: 'Damaged',
    serviceType: 'Warranty Claim',
    serviceVendor: 'Lotus Technology',
    serviceSentOn: dateOnly(daysAgo(2)),
    expectedReturnOn: dateOnly(daysFromNow(5)),
    serviceNotes: 'ภาพกระตุกและมีสัญญาณขาดหาย',
  },
  {
    id: 'sample-asset-printer',
    assetTag: 'LOCAL-PRN-001',
    name: 'Office Printer Legacy',
    category: 'Office Printer',
    department: 'Finance & Accounting',
    location: 'Back Office',
    vendor: 'HP',
    model: 'LaserJet Pro',
    spec: 'Network printer',
    detail: 'Sampling retired asset',
    usedBy: '',
    serialNumber: 'LOCAL-PRN-001',
    warrantyExpiresOn: dateOnly(daysAgo(90)),
    ownershipType: 'Owned',
    lessorName: '',
    leaseContractNumber: '',
    leaseStartDate: '',
    leaseEndDate: '',
    monthlyRentalCost: null,
    status: 'Retired',
    serviceType: '',
    serviceVendor: '',
    serviceSentOn: '',
    expectedReturnOn: '',
    serviceNotes: 'เปลี่ยนอุปกรณ์รุ่นใหม่แล้ว',
  },
  {
    id: 'sample-asset-switch',
    assetTag: 'LOCAL-NET-001',
    name: 'Core Network Switch',
    category: 'Network Device',
    department: 'IT',
    location: 'Server Room',
    vendor: 'Cisco',
    model: 'CBS350',
    spec: '24-port managed switch',
    detail: 'Sampling repair asset',
    usedBy: '',
    serialNumber: 'LOCAL-NET-001',
    warrantyExpiresOn: dateOnly(daysFromNow(60)),
    ownershipType: 'Leased',
    lessorName: 'Network Vendor',
    leaseContractNumber: 'LOCAL-LEASE-001',
    leaseStartDate: dateOnly(daysAgo(120)),
    leaseEndDate: dateOnly(daysFromNow(245)),
    monthlyRentalCost: 1500,
    status: 'Under Repair',
    serviceType: 'Vendor Repair',
    serviceVendor: 'Network Vendor',
    serviceSentOn: dateOnly(daysAgo(1)),
    expectedReturnOn: dateOnly(daysFromNow(10)),
    serviceNotes: 'ตรวจสอบ Power Supply',
  },
]

for (const asset of assets) {
  const stored = {
    ...asset,
    propertyId: property.id,
    propertyCode: property.code,
    createdBy: admin.uid,
    createdAt: daysAgo(10),
    updatedAt: daysAgo(asset.status === 'In Service' ? 1 : 0),
  }
  await db.doc(`assets/${asset.id}`).set(stored, { merge: true })
  await db.doc(`ticketAssetOptions/${asset.id}`).set(
    {
      propertyId: property.id,
      propertyCode: property.code,
      assetTag: asset.assetTag,
      name: asset.name,
      category: asset.category,
      department: asset.department,
      location: asset.location,
      status: asset.status,
      createdAt: daysAgo(10),
      updatedAt: stored.updatedAt,
    },
    { merge: true },
  )
}

const tickets = [
  {
    id: 'sample-ticket-open',
    status: 'Pending',
    priority: 'High',
    problemCategory: 'Network',
    problemType: 'WiFi',
    issueArea: 'Office / Corporate',
    location: 'Front Office',
    assetId: 'sample-asset-switch',
    department: 'IT',
    description: 'ระบบ WiFi บริเวณ Front Office ช้าผิดปกติ ต้องตรวจสอบ Access Point และ uplink',
    createdAt: daysAgo(1),
    updatedAt: daysAgo(1),
    assignedEngineerUid: '',
    assignedAt: null,
    assignedByUid: '',
    lastEventId: 'created',
  },
  {
    id: 'sample-ticket-progress',
    status: 'In Progress',
    priority: 'Critical',
    problemCategory: 'Hardware',
    problemType: 'CCTV',
    issueArea: 'BOH (Back of House)',
    location: 'South Wing',
    assetId: 'sample-asset-camera',
    department: 'IT',
    description: 'กล้อง CCTV South Wing ไม่แสดงภาพ ต้องเข้าตรวจสอบหน้างาน',
    createdAt: daysAgo(2),
    updatedAt: daysAgo(0),
    assignedEngineerUid: engineer.uid,
    assignedAt: daysAgo(0),
    assignedByUid: admin.uid,
    lastEventId: 'assigned',
  },
  {
    id: 'sample-ticket-completed',
    status: 'Completed',
    priority: 'Medium',
    problemCategory: 'Helpdesk',
    problemType: 'Printer',
    issueArea: 'Office / Corporate',
    location: 'Finance Office',
    assetId: 'sample-asset-printer',
    department: 'Finance & Accounting',
    description: 'เครื่องพิมพ์สำนักงานพิมพ์งานช้าและมีเส้นบนกระดาษ',
    resolutionNotes: 'ทำความสะอาดชุดพิมพ์และเปลี่ยนอะไหล่เรียบร้อย',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(3),
    assignedEngineerUid: engineer.uid,
    assignedAt: daysAgo(5),
    assignedByUid: admin.uid,
    lastEventId: 'completed',
    slaResponseMetAt: daysAgo(5),
    slaResolutionMetAt: daysAgo(3),
    slaResponseStatus: 'met',
    slaResolutionStatus: 'met',
    slaState: 'met',
  },
]

for (const ticket of tickets) {
  const base = {
    schemaVersion: 3,
    propertyId: property.id,
    propertyCode: property.code,
    requesterUid: requester.uid,
    requesterName: requester.displayName,
    requesterEmail: requester.email,
    department: ticket.department,
    issueArea: ticket.issueArea,
    location: ticket.location,
    assetId: ticket.assetId,
    problemCategory: ticket.problemCategory,
    problemType: ticket.problemType,
    channel: 'Line',
    priority: ticket.priority,
    status: ticket.status,
    description: ticket.description,
    resolutionNotes: ticket.resolutionNotes ?? '',
    assignedEngineerUid: ticket.assignedEngineerUid,
    assignedAt: ticket.assignedAt,
    assignedByUid: ticket.assignedByUid,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    lastEventId: ticket.lastEventId,
    slaPolicyId: 'local-sample-policy',
    slaPolicyVersion: '1',
    slaResponseTargetMinutes: ticket.priority === 'Critical' ? 30 : ticket.priority === 'High' ? 60 : 240,
    slaResolutionTargetMinutes: ticket.priority === 'Critical' ? 240 : ticket.priority === 'High' ? 480 : 1440,
    slaStartedAt: ticket.createdAt,
    slaResponseDueAt:
      ticket.priority === 'Critical'
        ? new Date(ticket.createdAt.getTime() + 30 * 60_000)
        : new Date(ticket.createdAt.getTime() + 240 * 60_000),
    slaResolutionDueAt: new Date(ticket.createdAt.getTime() + (ticket.priority === 'Critical' ? 240 : 1440) * 60_000),
    slaResponseStatus: ticket.slaResponseStatus ?? 'pending',
    slaResolutionStatus: ticket.slaResolutionStatus ?? (ticket.status === 'Pending' ? 'running' : 'running'),
    slaState: ticket.slaState ?? 'running',
    slaPausedAt: null,
    slaPauseReason: '',
    slaPausedMinutes: 0,
    slaResponseBreached: false,
    slaResolutionBreached: false,
    slaLastEvaluatedAt: today,
  }
  await db.doc(`tickets/${ticket.id}`).set(base, { merge: true })

  const eventStatus =
    ticket.status === 'Completed' ? 'Completed' : ticket.status === 'In Progress' ? 'In Progress' : 'Pending'
  const eventType =
    ticket.status === 'Completed' ? 'statusChanged' : ticket.assignedEngineerUid ? 'assigned' : 'created'
  await db.doc(`tickets/${ticket.id}/events/${ticket.lastEventId}`).set(
    {
      actorUid: ticket.assignedEngineerUid || requester.uid,
      fromStatus: ticket.status === 'Completed' ? 'In Progress' : null,
      toStatus: eventStatus,
      note:
        ticket.status === 'Completed'
          ? 'แก้ไขและทดสอบเรียบร้อย'
          : ticket.assignedEngineerUid
            ? 'มอบหมายให้ Support Engineer'
            : 'สร้าง Task ตัวอย่างสำหรับทดสอบ',
      type: eventType,
      createdAt: ticket.updatedAt,
      ...(ticket.assignedEngineerUid ? { toAssignedEngineerUid: ticket.assignedEngineerUid } : {}),
    },
    { merge: true },
  )
}

const auditRows = [
  ['sample-audit-open', 'sample-ticket-open', 'created', 'สร้าง Task ตัวอย่าง Network / WiFi'],
  ['sample-audit-assigned', 'sample-ticket-progress', 'assigned', 'มอบหมาย Task ให้ Support Engineer'],
  ['sample-audit-completed', 'sample-ticket-completed', 'statusChanged', 'เปลี่ยนสถานะ Task เป็น Completed'],
]
for (const [id, entityId, action, summary] of auditRows) {
  await db.doc(`auditEvents/${id}`).set(
    {
      propertyId: property.id,
      propertyCode: property.code,
      entityType: 'ticket',
      entityId,
      action,
      sourceEventId: action === 'created' ? 'created' : action === 'assigned' ? 'assigned' : 'completed',
      actorUid: admin.uid,
      summary,
      correlationId: `local-sample-${entityId}`,
      createdAt: today,
    },
    { merge: true },
  )
}

await db.doc('rcaRecords/sample-rca-001').set(
  {
    schemaVersion: 1,
    propertyId: property.id,
    propertyCode: property.code,
    taskId: 'sample-ticket-completed',
    taskTitle: 'Helpdesk / Printer · Finance Office',
    taskCategory: 'Helpdesk',
    taskPriority: 'Medium',
    taskCompletedAt: daysAgo(3),
    incidentSummary: 'เครื่องพิมพ์สำนักงานพิมพ์งานช้าและมีเส้นบนกระดาษ',
    rootCause: 'ชุดพิมพ์มีฝุ่นและลูกยางเริ่มเสื่อม',
    contributingFactors: 'ใช้งานต่อเนื่องและไม่มีรอบทำความสะอาดตามแผน',
    fiveWhys: 'อุปกรณ์เสื่อมจากการใช้งานต่อเนื่องโดยไม่มี preventive cleaning',
    impact: 'กระทบการพิมพ์เอกสารของ Finance',
    downtimeMinutes: 45,
    correctiveAction: 'ทำความสะอาดและเปลี่ยนอะไหล่',
    preventiveAction: 'เพิ่ม checklist ทำความสะอาดรายเดือน',
    ownerUid: engineer.uid,
    dueDate: dateOnly(daysFromNow(7)),
    status: 'Draft',
    createdBy: admin.uid,
    createdAt: daysAgo(2),
    updatedAt: daysAgo(1),
  },
  { merge: true },
)

for (const [id, email, name, department, assetId] of [
  [
    'LOCAL__front-office@example.test',
    'front-office@example.test',
    'Front Office Desk',
    'Front Office',
    'sample-asset-laptop',
  ],
  [
    'LOCAL__finance@example.test',
    'finance@example.test',
    'Finance Desk',
    'Finance & Accounting',
    'sample-asset-printer',
  ],
  ['LOCAL__engineering@example.test', 'engineering@example.test', 'Engineering Desk', 'Engineering', null],
]) {
  await db.doc(`requestUsers/${id}`).set(
    {
      propertyId: property.id,
      propertyCode: property.code,
      email,
      name,
      department,
      assetId,
      active: true,
      createdBy: admin.uid,
      createdAt: daysAgo(4),
      updatedAt: daysAgo(1),
    },
    { merge: true },
  )
}

for (const [id, productName, vendor, licenseType, expiresOn, status] of [
  ['sample-license-m365', 'Microsoft 365 Business', 'Microsoft', 'Subscription', dateOnly(daysFromNow(14)), 'Active'],
  [
    'sample-license-antivirus',
    'Endpoint Protection',
    'Security Vendor',
    'Maintenance',
    dateOnly(daysFromNow(120)),
    'Renewal In Progress',
  ],
  ['sample-license-legacy', 'Legacy PDF Editor', 'Old Vendor', 'Perpetual', dateOnly(daysAgo(10)), 'Not Renewing'],
]) {
  await db.doc(`softwareLicenses/${id}`).set(
    {
      propertyId: property.id,
      propertyCode: property.code,
      productName,
      vendor,
      licenseType,
      expiresOn,
      quantity: 25,
      renewalOwner: engineer.displayName,
      status,
      notes: 'Local sampling license',
      createdBy: admin.uid,
      createdAt: daysAgo(30),
      updatedAt: daysAgo(1),
    },
    { merge: true },
  )
}

await db.doc('pmSchedules/sample-pm-dvr').set(
  {
    propertyId: property.id,
    propertyCode: property.code,
    title: 'ตรวจสุขภาพ DVR และห้อง Server',
    location: 'Server Room',
    frequency: 'Monthly',
    checklistItems: ['ตรวจสอบเวลา DVR', 'ตรวจอุณหภูมิห้อง Server', 'ทดสอบ UPS'],
    nextDueOn: dateOnly(daysFromNow(2)),
    active: true,
    createdBy: admin.uid,
    lastRunOn: '',
    lastRunId: '',
    createdAt: daysAgo(20),
    updatedAt: daysAgo(1),
  },
  { merge: true },
)

const nvrItems = [
  ['sample-nvr-1', 'DVR-1', 'South Wing', 16, 30],
  ['sample-nvr-2', 'DVR-2', 'North Wing', 24, 30],
]
for (const [id, name, location, cameraTotal, targetRetentionDays] of nvrItems) {
  await db.doc(`cctvNvrInventory/${id}`).set(
    {
      propertyId: property.id,
      propertyCode: property.code,
      name,
      location,
      cameraTotal,
      targetRetentionDays,
      active: true,
      createdBy: admin.uid,
      createdAt: daysAgo(15),
      updatedAt: daysAgo(1),
    },
    { merge: true },
  )
}
await db.doc(`cctvDailyChecks/LOCAL_${dateOnly(today)}`).set(
  {
    propertyId: property.id,
    propertyCode: property.code,
    checkedOn: dateOnly(today),
    nvrTotal: 2,
    nvrOnline: 1,
    cameraTotal: 40,
    cameraOnline: 16,
    notes: 'DVR-2 ต้องตรวจสอบสัญญาณกล้องเพิ่มเติม',
    checkedByUid: engineer.uid,
    checkedAt: today,
    createdAt: today,
    updatedAt: today,
    nvrDetails: [
      {
        nvrId: 'sample-nvr-1',
        nvrName: 'DVR-1',
        location: 'South Wing',
        online: true,
        cameraTotal: 16,
        cameraOnline: 16,
        retentionDays: 30,
        oldestFootageOn: dateOnly(daysAgo(30)),
        targetRetentionDays: 30,
        notes: '',
      },
      {
        nvrId: 'sample-nvr-2',
        nvrName: 'DVR-2',
        location: 'North Wing',
        online: false,
        cameraTotal: 24,
        cameraOnline: 0,
        retentionDays: 0,
        oldestFootageOn: '',
        targetRetentionDays: 30,
        notes: 'ไม่พบสัญญาณ NVR',
      },
    ],
  },
  { merge: true },
)

for (const [id, type, title, location, impact, status, startedAt, restoredAt, resolutionNotes] of [
  [
    'sample-incident-open',
    'Network',
    'WiFi Front Office ไม่เสถียร',
    'Front Office',
    'High',
    'Open',
    daysAgo(0),
    null,
    '',
  ],
  [
    'sample-incident-restored',
    'CCTV',
    'กล้อง South Wing ขาดหายชั่วคราว',
    'South Wing',
    'Critical',
    'Restored',
    daysAgo(4),
    daysAgo(3),
    'เปลี่ยนสายสัญญาณและทดสอบภาพเรียบร้อย',
  ],
]) {
  const eventId = status === 'Restored' ? 'restored' : 'reported'
  await db.doc(`infrastructureIncidents/${id}`).set(
    {
      propertyId: property.id,
      propertyCode: property.code,
      type,
      title,
      location,
      impact,
      description: 'เหตุการณ์ตัวอย่างสำหรับทดสอบ Incident Log และการกรองตามสถานะ',
      status,
      reportedByUid: engineer.uid,
      startedAt,
      restoredAt,
      resolutionNotes,
      updatedAt: restoredAt ?? startedAt,
      lastEventId: eventId,
    },
    { merge: true },
  )
  await db.doc(`infrastructureIncidents/${id}/events/reported`).set(
    {
      actorUid: engineer.uid,
      fromStatus: null,
      toStatus: 'Open',
      note: 'บันทึกเหตุขัดข้องตัวอย่าง',
      type: 'reported',
      createdAt: startedAt,
    },
    { merge: true },
  )
  if (status === 'Restored') {
    await db.doc(`infrastructureIncidents/${id}/events/restored`).set(
      {
        actorUid: engineer.uid,
        fromStatus: 'Monitoring',
        toStatus: 'Restored',
        note: resolutionNotes,
        type: 'statusChanged',
        createdAt: restoredAt,
      },
      { merge: true },
    )
  }
}

for (const [id, title, kind, startDate, dueTime, room, assignee, repeat, checklistText] of [
  [
    'sample-todo-room',
    'ตรวจห้องประชุมก่อนเริ่มงาน',
    'Meeting Room',
    dateOnly(today),
    '09:00',
    'Board Room',
    engineer.displayName,
    'None',
    'ตรวจจอแสดงผล\nตรวจสาย HDMI',
  ],
  [
    'sample-todo-asset',
    'ตรวจอุปกรณ์ IT ประจำสัปดาห์',
    'Asset Check',
    dateOnly(daysFromNow(1)),
    '10:00',
    '',
    engineer.displayName,
    'Weekly',
    'ตรวจ Asset ที่อยู่ระหว่างซ่อม',
  ],
]) {
  await db.doc(`operationalTodos/${id}`).set(
    {
      propertyId: property.id,
      propertyCode: property.code,
      title,
      kind,
      startDate,
      dueTime,
      room,
      assignee,
      repeat,
      checklistText,
      active: true,
      createdBy: admin.uid,
      createdAt: daysAgo(7),
      updatedAt: daysAgo(1),
    },
    { merge: true },
  )
}
await db.doc(`operationalTodoCompletions/sample-todo-room__${dateOnly(today)}`).set(
  {
    taskId: 'sample-todo-room',
    propertyId: property.id,
    propertyCode: property.code,
    occurrenceDate: dateOnly(today),
    completed: false,
    completedByUid: '',
    completedAt: null,
    createdAt: today,
    updatedAt: today,
  },
  { merge: true },
)
await db.doc('operationalTodoSettings/LOCAL').set(
  {
    propertyId: property.id,
    propertyCode: property.code,
    meetingRoomCareEnabled: true,
    updatedBy: admin.uid,
    updatedAt: today,
  },
  { merge: true },
)

console.log('Local sampling data ready for all ITOMS menu areas')
console.log(`Admin: ${admin.email}`)
