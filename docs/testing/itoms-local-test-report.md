# ITOMS Local Test Report

วันที่: 29 กันยายน 2026
Environment: Firebase Auth/Firestore Emulator, project `demo-lotus-it-portal-local`
Firebase Production: ไม่ได้เชื่อมต่อ

## สรุปผล

ผ่านครบตามขอบเขต Local:

- Baseline authenticated E2E: **16/16 passed**
- Sampling-data E2E: **2/2 passed** ครอบคลุมทุก menu, data rendering, filters และ Table View
- Unit: **15/15 passed**
- Firestore Rules: **26/26 passed**
- Trusted server: **10/10 passed**
- OpenAPI contract: ผ่าน 6 documented paths
- Load test: 100 requests / concurrency 10 / average 3.9 ms / p95 7.8 ms
- Build, lint, format check และ i18n completeness: ผ่าน

## Sampling data

เพิ่ม seed เฉพาะ Local Emulator ใน `scripts/seed-local-sampling.mjs` ครอบคลุม:

- ผู้ใช้: Super Admin, Support Engineer, Client Executive และ Requester
- Ticket: Pending, In Progress และ Completed พร้อม SLA, assignment, event และ audit
- Asset: In Service, Damaged, Under Repair และ Retired
- License, PM schedule, CCTV NVR/daily check, Incident, To-do, Request User และ RCA

คำสั่ง:

```bash
npm run emulators
npm run emulators:seed
npm run test:e2e:emulator
npm run test:e2e:sampling
```

## Errors found and resolved

1. ปฏิทินงานมี `<ul>` ซ้อน `<ul>` โดยตรงเมื่อมี sampling data ทำให้ accessibility rule `list` fail — แก้ให้ component เจ้าของ list เป็นผู้สร้าง `<ul>` เพียงชั้นเดียว
2. ข้อความ property code และข้อความ “เลยเวลาแก้ไขแล้ว” มี contrast ต่ำกว่า WCAG AA เล็กน้อย — ปรับเป็น `text-slate-600`
3. Dashboard E2E เดิมบังคับ empty SLA state — ปรับ assertion ให้รองรับทั้ง evaluated และ not-enough-data state ตามข้อมูลจริง
4. Visual snapshot เคยปนกับ sampling data ใน emulator process เดิม — แยก sampling config/port และรัน baseline จาก emulator instance ใหม่ จึงยืนยัน baseline 16/16 ได้โดยไม่แก้ snapshot เพื่อตบผลทดสอบ

## Known limitations

- Sampling data เป็นข้อมูลทดสอบใน Local Emulator เท่านั้น ไม่ได้เขียน Production Firebase
- ไม่ได้ทดสอบ email/password ของผู้ใช้จริงหรือ notification จริง
- Client-side audit และ SLA indicator ยังไม่ใช่ trusted backend enforcement ตามข้อจำกัดสถาปัตยกรรมปัจจุบัน
- Rules negative cases ยังมี expression-budget warnings ในบาง malformed payload แม้ผลลัพธ์สุดท้ายจะ deny ถูกต้อง ต้อง refactor เพิ่มก่อนขยาย Rules
