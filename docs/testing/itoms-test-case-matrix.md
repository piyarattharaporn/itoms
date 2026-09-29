# ITOMS Test Case Matrix

วันที่ทดสอบ: 29 กันยายน 2026
ขอบเขต: Local Firebase Emulator + Firebase Hosting แบบ read-only

## Menu and page coverage

| Area                | Menu                  | Local sampling result                               | Firebase result       |
| ------------------- | --------------------- | --------------------------------------------------- | --------------------- |
| ภาพรวม              | ภาพรวม                | Pass — incident, KPI และ task sample                | Not run authenticated |
| งานบริการ           | กระดานงาน             | Pass — ticket sample, search, Table View            | Not run authenticated |
| งานบริการ           | Create Task           | Pass — form loads                                   | Not run authenticated |
| งานบริการ           | ปฏิทินงาน             | Pass — To-do sample                                 | Not run authenticated |
| งานบริการ           | RCA & Service Review  | Pass — completed task/RCA sample                    | Not run authenticated |
| การปฏิบัติการ IT    | บันทึกเหตุขัดข้อง     | Pass — open/restored incident sample                | Not run authenticated |
| การปฏิบัติการ IT    | กล้องวงจรปิด          | Pass — DVR-1/DVR-2 sample                           | Not run authenticated |
| การปฏิบัติการ IT    | บำรุงรักษาเชิงป้องกัน | Pass — PM schedule sample                           | Not run authenticated |
| การปฏิบัติการ IT    | อุปกรณ์และลิขสิทธิ์   | Pass — asset and license sample                     | Not run authenticated |
| การปฏิบัติการ IT    | อุปกรณ์เสียหาย        | Pass — Damaged/Retired sample and Table View        | Not run authenticated |
| รายงานและการตรวจสอบ | บันทึกกิจกรรม         | Pass — activity sample and Table View               | Not run authenticated |
| รายงานและการตรวจสอบ | บันทึก Audit Log      | Pass — append-only audit sample and Table View      | Not run authenticated |
| การจัดการระบบ       | ตั้งค่า Property      | Pass — Local property sample                        | Not run authenticated |
| การจัดการระบบ       | ตั้งค่ารายการ         | Pass — catalog/SLA page loads                       | Not run authenticated |
| การจัดการระบบ       | รายชื่อผู้แจ้งงาน     | Pass — requester and asset link samples             | Not run authenticated |
| การจัดการระบบ       | รายชื่อผู้ใช้         | Pass — seeded engineer/executive/requester profiles | Not run authenticated |

## Supporting test groups

| Test group                     | Result                                                            |
| ------------------------------ | ----------------------------------------------------------------- |
| Unit tests                     | 15/15 passed                                                      |
| Firestore Rules                | 26/26 passed                                                      |
| Trusted server tests           | 10/10 passed                                                      |
| OpenAPI contract               | Passed — 6 documented paths                                       |
| Baseline authenticated E2E     | 16/16 passed                                                      |
| Sampling authenticated E2E     | 2/2 passed                                                        |
| Firebase Hosting read-only E2E | 2/2 passed                                                        |
| Load test                      | Passed — 100 requests, concurrency 10, average 3.9 ms, p95 7.8 ms |
| Build                          | Passed                                                            |
| Lint                           | Passed                                                            |
| Format check                   | Passed                                                            |
| i18n completeness              | Passed — 1,204 keys indexed                                       |
