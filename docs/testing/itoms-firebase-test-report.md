# ITOMS Firebase Test Report

วันที่: 29 กันยายน 2026
Target: `https://itoms-v2.web.app`
Mode: **read-only smoke test + scoped authenticated CRUD test**

## ผลที่ยืนยันได้

- Firebase Hosting ตอบ HTTP 200
- หน้า public Login โหลดสำเร็จ
- ช่อง Email, Password และปุ่ม Login แสดงผลครบ
- เมื่อไม่มี session ระบบไม่แสดงปุ่ม Sign out/portal authenticated shell
- Firebase Hosting E2E: **2/2 passed**

## Authenticated Firebase CRUD test

ทดสอบบน Production Firebase ด้วย session ของผู้ใช้ที่ Login แล้ว โดยใช้ข้อมูลชั่วคราวที่มี prefix `CRUD-TEST-20260929-1201` และเลือก Property `SFS · Silver Fern Siam`

| Resource                      | Create | Read | Update | Delete | ผลลัพธ์              |
| ----------------------------- | -----: | ---: | -----: | -----: | -------------------- |
| Asset                         |   PASS | PASS |   PASS |  PASS* | ผ่านและ cleanup แล้ว |
| Ticket Catalog / Problem Type |   PASS | PASS |   PASS |   PASS | ผ่านและ cleanup แล้ว |

รายละเอียดที่ตรวจสอบ:

- Asset document ID: `nkUSbGCtmSX4eMHVg0fS`
- Asset tag: `CRUD-TEST-20260929-1201-A`
- Asset ถูก Update สถานที่เป็น `CRUD Test Lab Updated` และสถานะเป็น `Damaged`
- Problem Type ถูกสร้างในกลุ่ม `Hardware`, Update เป็น `CRUD-TEST-20260929-1201 Problem UPDATED` และถูกลบสำเร็จ
- ตรวจซ้ำใน ITOMS และ Firebase Console แล้วไม่พบ Asset test document และไม่พบ Catalog test item
- ไม่พบข้อมูล prefix `CRUD-TEST-20260929-1201` ค้างจากการทดสอบ

`*` Asset Delete ไม่เปิดผ่าน application UI และ Firestore Rules กำหนด `allow delete: if false` เพื่อรักษาประวัติทรัพย์สิน จึง cleanup Asset ผ่าน Firebase Console หลังได้รับการยืนยันจากผู้ใช้ การลบนี้เป็น cleanup operation ไม่ใช่การยืนยันว่า client สามารถลบ Asset ผ่าน Rules ได้

สถานะ authenticated CRUD test: **ผ่านตามขอบเขตที่ทดสอบ**

คำสั่งที่ใช้:

```bash
ITOMS_ALLOW_PRODUCTION_E2E=true npm run test:e2e:firebase
```

The explicit environment flag is intentional. It prevents an ordinary local
test command from connecting to the Production Firebase Hosting target.

## ขอบเขตและข้อจำกัด

- การทดสอบนี้ครอบคลุม Asset และ Ticket Catalog / Problem Type เท่านั้น ไม่ใช่ CRUD ครบทุก collection
- ยังไม่มี Production sampling data ถูกเขียนโดย test run นี้
- ยังไม่ได้ทำ authenticated menu-by-menu test ครบทุกหน้าบน Production ในรอบนี้
- Asset Delete ผ่าน client ถูกปฏิเสธโดยออกแบบ (`allow delete: if false`); การลบที่ทำสำเร็จเป็น cleanup ผ่าน Firebase Console
- ยังไม่ได้ทดสอบ Production restore drill หรือการกู้คืนข้อมูลจริง

## ขั้นตอนต่อไป

1. เพิ่ม authenticated test cases สำหรับ Ticket, Incident, CCTV และ User/Request User ตาม role ที่อนุมัติ
2. แยก test project หรือ test Property หากต้องการรัน mutation test เป็นประจำ
3. ตรวจ Firebase Console usage, Rules evaluation และ error monitoring หลังแต่ละรอบ
4. ทำ Production restore drill แยกต่างหาก โดยไม่ใช้ข้อมูลทดสอบปะปนกับข้อมูลจริง
