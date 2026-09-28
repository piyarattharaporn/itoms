# Dashboard Design Spec — ITOMS Service Pulse

สถานะ: **Draft / Proposed**  
วันที่: 28 กันยายน 2026  
ขอบเขต: Dashboard สำหรับ ITOMS  
ผู้ใช้งานเป้าหมาย: 4 Properties, พนักงาน 6 คน

Visual reference: [Dashboard Concept: ITOMS Service Pulse](/Users/piyarattharaporn/.codex/generated_images/01a0e6ae-05ef-7b62-951b-c9e33cac701b/exec-d35e3f52-170b-4e05-868e-f019f491ed34.png)

> ภาพ concept ใช้เพื่อกำหนดลำดับความสำคัญ, layout และ mood เท่านั้น ตัวเลข, ชื่อรายการ และสถานะในภาพเป็น placeholder ไม่ใช่ข้อมูลจริง และไม่ควรนำไป hard-code ในระบบ

## 1. Executive summary

Dashboard ปัจจุบันมีข้อมูลครอบคลุม แต่มีลักษณะเป็นรายงานแบบยาวที่ทุก section มีน้ำหนักใกล้กัน ทำให้ผู้ปฏิบัติงานต้อง scan มากเกินไปก่อนจะรู้ว่า “ตอนนี้ต้องทำอะไร”

ทิศทางใหม่คือ **Daily Operations Control Room** ไม่ใช่ BI dashboard เต็มรูปแบบ โดยให้ผู้ใช้เห็นงานที่ต้องจัดการวันนี้ก่อน แล้วจึงค่อยเจาะ SLA และ service health ตามลำดับ:

1. ระบุ urgency ภายใน 5 วินาที
2. เปิด task ที่ถูกต้องได้ภายใน 1–2 interactions
3. เห็น property และช่วงเวลาที่กำลังดูอยู่ตลอดเวลา
4. แยกข้อมูลที่ต้องลงมือทำออกจากข้อมูลเพื่อการวิเคราะห์
5. ทำงานได้ต่อแม้ข้อมูลบาง section กำลังโหลด, ว่าง, หรือผิดพลาด

## 2. Goals / non-goals

### Goals

- จัดลำดับ `Overdue`, `SLA risk`, `Critical`, และ `Open tasks` ให้เป็น primary signal
- รวมงานที่ต้องตัดสินใจไว้ใน `Today's attention`
- ทำให้ SLA เป็น operational signal ที่อ่านได้ ไม่ใช่เพียงตัวเลขเปอร์เซ็นต์
- ยุบข้อมูลเชิงวิเคราะห์ที่ไม่จำเป็นต่อการตัดสินใจทันที
- รักษา property/date scope ให้เห็นชัดทั้ง desktop และ mobile
- รองรับบทบาท Support Engineer, Client Executive และ Super Admin โดยไม่แสดง action เกินสิทธิ์
- รักษา visual language ที่สงบและน่าเชื่อถือ เหมาะกับงาน operation ของโรงแรม

### Non-goals

- ไม่เพิ่ม backend, collection หรือ privileged worker ใน phase ของ dashboard redesign
- ไม่ทำ real-time alerting, notification, escalation หรือ file upload
- ไม่เปลี่ยน policy ของ Firestore Security Rules
- ไม่ทำ dashboard แบบ executive BI ที่มี chart จำนวนมาก
- ไม่ตีความข้อมูลที่ client โหลดได้ว่าเป็น full historical reporting โดยอัตโนมัติ

## 3. Users and jobs-to-be-done

### Support Engineer

> “เมื่อเริ่มงาน ฉันต้องเห็นงานที่ overdue หรือใกล้เกิน SLA ก่อน เพื่อเลือกทำงานที่มีผลกระทบสูงสุดได้ทันที”

Primary needs:

- เปิด task ที่ต้องทำและเห็น property/location/priority
- แยกงานตาม overdue, SLA risk, critical
- เห็น PM และ CCTV checks ที่ต้องจัดการ
- เข้าหน้า detail ได้โดยไม่ต้องผ่าน chart หรือ section ที่ไม่เกี่ยวข้อง

### Client Executive

> “ฉันต้องเห็นสถานะบริการของ property ที่รับผิดชอบ และรู้ว่ามีเรื่องสำคัญค้างอยู่หรือไม่ โดยไม่เห็น action ที่ฉันไม่มีสิทธิ์ทำ”

Primary needs:

- อ่านสถานะ ticket/SLA/service health แบบ property-scoped
- เห็น owner หรือ next step เมื่อมีข้อมูลรองรับ
- ไม่มีปุ่มจัดการ Asset/PM/CCTV/Ticket หาก role ไม่อนุญาต

### Super Admin

> “ฉันต้องเห็นภาพรวมข้าม property และระบุจุดที่ต้องเข้าไปแก้ process หรือ configuration”

Primary needs:

- เปลี่ยน scope เป็นทุก property หรือ property เดียว
- เห็น concentration ของ overdue/SLA risk
- เข้าสู่ settings/catalog/SLA configuration ได้จาก context ที่เกี่ยวข้อง

## 4. Data and product assumptions

- ระบบรองรับ 4 Properties และผู้ปฏิบัติงาน 6 คนในขอบเขตปัจจุบัน
- task ที่ dashboard ใช้เป็น operational preview จำกัดที่ข้อมูลล่าสุดสูงสุด 50 รายการ
- asset ที่ dashboard ใช้สูงสุด 100 รายการ และ license สูงสุด 200 รายการตาม current data access
- SLA dashboard เป็นการคำนวณจาก deadline และข้อมูลที่ client โหลดได้ จึงต้องแสดง scope/freshness ให้ผู้ใช้เห็น
- ตัวเลข `0%` ต้องไม่ถูกสื่อว่า “ไม่มีปัญหา” หากไม่มีข้อมูลสำหรับคำนวณ ต้องใช้ `ไม่มีข้อมูล` หรือ `ยังประเมินไม่ได้`
- ไม่มี trusted worker หรือ server-side escalation ใน phase นี้
- การ filter ต้องไม่ bypass property/role scope ที่กำหนดโดย Firestore Rules

### Data freshness pattern

ทุก dashboard view ต้องมี metadata ขนาดเล็กใต้ heading หรือใน toolbar:

```text
ข้อมูล ณ 10:42 · 12 tasks ใน scope · 4 properties
```

ถ้าข้อมูลบาง section ยังไม่พร้อม ให้แสดงเฉพาะ section นั้นว่า `กำลังโหลด` หรือ `โหลดไม่สำเร็จ` โดยไม่ทำให้ทั้งหน้าใช้ไม่ได้

## 5. Information architecture

ลำดับความสำคัญของหน้าใหม่:

1. Global context: property, date/period, last updated, primary action
2. Urgency KPI rail: overdue, SLA risk, critical, open tasks
3. Today's attention: task queue ที่ต้องตัดสินใจ
4. SLA Operations: summary, buckets และ trend สั้น ๆ
5. Service health: CCTV, PM, Asset, License แบบ compact strip
6. Additional insights: issue area, category, channel, property, location และ problem details แบบ collapsible

### สิ่งที่ควรลดจากหน้าเดิม

- ไม่วาง Task Insights ก่อน operational queue
- ไม่ใช้ card ขนาดใหญ่ซ้ำกันสำหรับ empty state ทุก section
- ไม่แสดง chart และ breakdown ทุกตัวใน first viewport
- ไม่ใช้ eyebrow แบบ all-caps เช่น `ITOMS · OPERATIONS PULSE` หรือ `TASK FLOW` เป็น visual noise; ถ้าจำเป็นให้ใช้ sentence case หรือ aria/metadata แทน

## 6. ITOMS cross-page design system

Dashboard จะเป็น reference implementation ของ visual language กลาง แต่ไม่ใช่ให้ทุกหน้ามี layout เหมือนกันทั้งหมด แต่ละ domain ต้องคง interaction pattern และ hierarchy เดียวกัน แล้วเลือก template ให้เหมาะกับงานของหน้านั้น

### Brand rule

- ชื่อที่ผู้ใช้เห็นใน header, page title, sign-in, empty state, document title และ metadata ที่เป็น product copy คือ **ITOMS**
- ห้ามเพิ่มคำว่า `Lotus` ใน user-facing copy ใหม่
- technical identifiers เดิม เช่น `lotus-*` ใน Tailwind class, telemetry event หรือ storage key ให้ถือเป็น implementation detail และยังไม่ rename ใน Dashboard phase เพื่อไม่ให้เกิด breaking change; หากต้องการเปลี่ยนต้องทำเป็น technical migration แยกต่างหาก
- concept image เป็น reference asset เท่านั้น ไม่ใช่ source of truth ของชื่อผลิตภัณฑ์

### Shared shell contract

ทุกหน้าหลังจาก Dashboard ปรับปรุงแล้วต้องใช้ contract เดียวกัน:

1. **Global header** — โลโก้/ชื่อ ITOMS, language, active property, account action
2. **Primary navigation** — active state, keyboard order, mobile menu และ permission visibility เหมือนกัน
3. **Page context** — property และ scope ที่กำลังดูต้องแสดงก่อนเนื้อหาหลัก
4. **Page heading** — ชื่อหน้าที่เข้าใจได้, คำอธิบายสั้น ๆ และ primary action ที่ตรงกับหน้านั้น
5. **Content frame** — canvas, surface, border, typography, focus และ spacing ใช้ token ชุดเดียวกัน
6. **Feedback model** — loading, empty, error, permission, retry และ success ใช้ภาษากับรูปแบบเดียวกัน

### Page template mapping

| Domain / หน้า | Template ที่ใช้ | Primary user job |
|---|---|---|
| ภาพรวม / Dashboard | Operational control room | เลือกงานที่ต้องทำก่อน |
| Create / Update / View Task | Work queue + detail | สร้าง, ค้นหา และอัปเดต task |
| ปฏิทินงาน | Timeline / calendar workspace | วางแผนและติดตามงานตามวัน |
| Asset & Licence | Data management workspace | ตรวจ inventory, damage และ renewal |
| CCTV | Daily operations checklist | ตรวจสถานะรายวันและแก้รายการผิดปกติ |
| Incident Log | Incident response workspace | ติดตาม impact, status และ recovery history |
| Preventive Maintenance | Schedule + checklist | จัดรอบ PM และบันทึกผล |
| อุปกรณ์เสียหาย | Action queue | คัดกรองและส่งต่อ asset issue |
| ตั้งค่ารายการ / SLA | Configuration form | ตั้งค่า catalog และ policy อย่างปลอดภัย |
| Request Users / User Directory | Admin data table | จัดการ account, role และ membership |
| Activities / Audit Log | Audit timeline/table | ตรวจ trace และ accountability |
| Property Setup | Admin configuration | จัดการ property และ capability |

### Rules สำหรับทุกหน้า

- หน้าทำงานต้องนำ primary action และรายการที่ต้องลงมือทำขึ้นก่อนข้อมูลรอง
- หน้าจัดการข้อมูลต้องใช้ table/list ที่มี search, filter, sort และ empty state ที่บอก next action; ไม่แปลงทุกอย่างเป็น card
- หน้าตั้งค่าต้องแยก section ตาม domain, มี save boundary ชัด และไม่ทำให้การเปลี่ยน policy ดูเหมือนการเปลี่ยน display preference
- ใช้ semantic status vocabulary เดียวกัน: `On track`, `At risk`, `Overdue`, `Critical`, `Completed`, `Disabled`
- ปุ่ม, link, toast และ error message ใช้ชื่อ action เดียวกันตลอด flow เช่น `บันทึก` → `บันทึกแล้ว`
- ทุก deep link จาก Dashboard ต้องพาไปยัง page template ที่มี scope เดิมและมี heading/context สอดคล้องกัน
- ทุกหน้าใช้ responsive, focus, contrast, reduced-motion และ Thai text rules เดียวกับ Dashboard

### Cross-page visual tokens

หน้าอื่นต้องใช้ token จาก section 8 เป็นฐานเดียวกัน ไม่สร้างสีเขียว, เทา, red, amber หรือ purple ชุดใหม่เฉพาะหน้าโดยไม่มีเหตุผลด้าน semantic status

- Dashboard เป็นเจ้าของ hierarchy ของ `canvas`, `surface`, `ink`, `muted`, `border`, `brand`, `danger`, `warning`, `info` และ `SLA`
- domain อื่นเพิ่มได้เฉพาะ token ที่มีความหมายชัด เช่น `success` หรือ `disabled` และต้องไม่แย่ง visual weight จาก brand
- card radius, button height, focus ring, table row density และ section heading ต้อง reuse primitive เดียวกัน

## 7. Wireframe

### Desktop — 1280px ขึ้นไป

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ITOMS             [Property ▾] [ช่วงเวลา ▾]                  [สร้าง Task]  │
├─────────────────────────────────────────────────────────────────────────────┤
│ ภาพรวมงานบริการ IT                                                        │
│ ข้อมูล ณ 10:42 · 12 tasks ใน scope                                        │
│                                                                             │
│ [เกินกำหนด  3] [เสี่ยงเกิน SLA  5] [Critical  2] [งานเปิดอยู่  18]        │
│                                                                             │
│ ┌──────────────────────────────────────┐ ┌──────────────────────────────┐ │
│ │ สิ่งที่ต้องจัดการวันนี้              │ │ SLA Operations               │ │
│ │ [เกินกำหนด]                          │ │ On track / At risk / Breach │ │
│ │  • task row: title, property, age     │ │ compact summary + trend      │ │
│ │ [เสี่ยงเกิน SLA]                      │ │ link: ดูงานที่เกี่ยวข้อง     │ │
│ │  • task row + next action             │ │                              │ │
│ │ [Critical]                            │ │                              │ │
│ │  • task row + owner/status             │ │                              │ │
│ └──────────────────────────────────────┘ └──────────────────────────────┘ │
│                                                                             │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│ │ CCTV          │ │ PM            │ │ Asset         │ │ License       │       │
│ │ status + next │ │ due + next    │ │ damaged      │ │ expiring      │       │
│ └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘       │
│                                                                             │
│ [รายละเอียดเพิ่มเติม ▾]  Issue / category / channel / location / property  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tablet — 768–1279px

```text
[Menu] ITOMS               [Property] [ช่วงเวลา]
ภาพรวมงานบริการ IT                         [สร้าง Task]
[Overdue] [SLA risk]
[Critical] [Open]
┌──────────────────────────────────────────┐
│ สิ่งที่ต้องจัดการวันนี้                  │
│ task rows เต็มความกว้าง                  │
└──────────────────────────────────────────┘
┌──────────────────────────────────────────┐
│ SLA Operations                           │
└──────────────────────────────────────────┘
[CCTV] [PM] [Asset] [License]
[รายละเอียดเพิ่มเติม ▾]
```

### Mobile — ต่ำกว่า 768px

```text
┌──────────────────────────────┐
│ [Menu]  ภาพรวมงานบริการ IT   │
│ [Property ▾] [ช่วงเวลา ▾]    │
│ [สร้าง Task]                 │
├──────────────────────────────┤
│ [เกินกำหนด]   [SLA risk]     │
│ [Critical]     [งานเปิด]     │
├──────────────────────────────┤
│ สิ่งที่ต้องจัดการวันนี้      │
│ [เกินกำหนด]                  │
│ task row / next action       │
│ [SLA risk]                   │
│ task row / next action       │
├──────────────────────────────┤
│ SLA Operations               │
│ summary + horizontal trend   │
├──────────────────────────────┤
│ สถานะบริการ                 │
│ CCTV · PM · Asset · License │
├──────────────────────────────┤
│ รายละเอียดเพิ่มเติม ▾        │
└──────────────────────────────┘
```

## 8. Visual direction

### Design principles

1. **Urgency before completeness** — งานที่ต้องทำก่อนข้อมูลที่อยากรู้
2. **Calm but not quiet** — พื้นผิวสงบ แต่ danger/warning ต้องเห็นชัด
3. **One action per row** — task row มีจุดนำทางหลักที่ชัด ไม่ใส่ปุ่มหลายตัวแข่งกัน
4. **Progressive disclosure** — insights อยู่หลัง accordion/secondary navigation
5. **Trust through context** — ทุก metric มี scope, freshness หรือคำอธิบายเมื่อยังประเมินไม่ได้

### Color tokens

| Token | Value | ใช้สำหรับ |
|---|---|---|
| Canvas | `#F4F7F4` | พื้นหลังหน้าหลัก |
| Surface | `#FFFFFF` | panel และ row ที่ยกขึ้นจาก canvas |
| Ink | `#26312C` | heading และ primary text |
| Muted | `#5D6B63` | secondary text / metadata |
| Border | `#DCE5DE` | divider และ card boundary |
| Brand | `#47765C` | primary action / selected state |
| Focus | `#2E7D5B` | keyboard focus ring |
| Danger | `#B42318` | overdue / critical / breach |
| Warning | `#9A6700` | SLA risk / attention |
| Info | `#175CD3` | informational state / link |
| SLA | `#7552A2` | SLA-specific visual family |

ข้อกำหนดสี:

- ไม่ใช้ gradient เป็นพื้นหลังหลัก
- ไม่ใช้สีแดงกับทุก failure; critical/overdue ใช้ red แต่ risk ใช้ amber และ neutral issue ใช้ muted
- ห้ามใช้สีเป็นตัวบอกสถานะเพียงอย่างเดียว ต้องมี label, icon หรือ text
- ตรวจ contrast อย่างน้อย WCAG AA โดยเฉพาะ muted text และ status chips

### Typography and spacing

- Body: 16px เป็นฐาน, line-height ประมาณ 1.5
- Label/control: 14px
- Metadata: 12–13px และต้องไม่เป็นข้อมูลสำคัญเพียงช่องทางเดียว
- H1: 28–32px desktop, 24px mobile
- H2: 20–24px desktop, 18–20px mobile
- Spacing scale: 4 / 8 / 12 / 16 / 24 / 32px
- Primary panel radius: 16px; control radius: 12px; หลีกเลี่ยงการซ้อน card หลายชั้น
- Desktop content max width: 1440px พร้อม gutter 24–32px
- Mobile gutter: 16px; ไม่ให้เกิด horizontal overflow

## 9. Component specification

### `DashboardContextBar`

รับผิดชอบ property selector, period selector, last updated และ primary action

- แสดง active property และช่วงเวลาบนหน้าจอเดียวกัน
- Super Admin เห็น `ทุก property` ได้เมื่อ role อนุญาต
- mobile ใช้ 2 controls แบบ full-width หรือ stacked
- ปุ่ม `สร้าง Task` แสดงตาม permission เท่านั้น

### `DashboardKpiRail`

แสดง metric 4 ตัวตามลำดับ:

1. Overdue
2. SLA risk
3. Critical
4. Open tasks

แต่ละ KPI ต้องมี value, label, supporting text และ link/filter target ที่ชัดเจน ไม่ใช้สีอย่างเดียว

### `DashboardAttentionQueue`

เป็น primary work surface ของหน้า:

- grouping: Overdue → SLA risk → Critical
- row fields: title, ticket id, property/location, priority/status, age/deadline, owner ถ้ามี
- row click เปิด detail; keyboard ใช้งานได้ทั้ง row และ action
- ถ้าไม่มีงาน: แสดงข้อความยืนยันว่าไม่มีงานใน scope พร้อม link `ดูงานทั้งหมด` หรือ `ตรวจสอบ filter`
- ถ้าข้อมูลมีมาก: แสดง preview ที่มี priority สูงสุดและ link ไปหน้า Tickets

### `DashboardSlaPanel`

- แสดง `On track`, `At risk`, `Breached` แยกจากกัน
- ไม่มีข้อมูลต้องแสดง `ยังประเมินไม่ได้` พร้อมเหตุผลสั้น ๆ
- trend ใช้เป็น supporting signal ไม่ใช่ chart ใหญ่
- link ไป filtered task list โดยคง property/period scope

### `DashboardServiceHealth`

แสดง CCTV, PM, Asset, License เป็น compact rows/tiles ขนาดเท่ากัน:

- CCTV: daily check status
- PM: due/upcoming status
- Asset: damaged/open issue count
- License: expiring/expired count

แต่ละ tile ต้องมี status + next action/link และยุบเป็น horizontal scroll ที่ควบคุมได้เฉพาะเมื่อจำเป็น; default mobile ให้เรียงแนวตั้งเพื่อไม่ให้ข้อมูลถูกตัด

### `DashboardInsights`

รวม Issue Area, Problem Category, Channel, Problem Details, Property และ Location

- default collapsed บน mobile และเปิดได้บน desktop ตาม user preference
- ใช้ table/list ที่อ่านง่ายแทน card ซ้อนหลายชั้น
- ไม่ทำให้ insight section ดัน Today's attention ออกจาก first viewport

### `DashboardState`

ใช้ state pattern เดียวกันทั้งหน้า:

- loading: skeleton ที่รักษา layout โดยไม่กระพริบ
- empty: สื่อว่าไม่มีข้อมูลใน scope พร้อม next action
- error: ข้อความสั้น + `ลองใหม่` เฉพาะ section
- permission: ซ่อน action หรือแสดง read-only state ตาม policy
- partial: แสดงส่วนที่สำเร็จต่อไป และระบุส่วนที่ยังไม่พร้อม

## 10. Interaction and state rules

### Filters

- เปลี่ยน property/period แล้ว refresh เฉพาะข้อมูลใน dashboard scope
- รักษา filter ใน link ไปหน้า Tickets, SLA, PM หรือ CCTV
- มี accessible label ที่บอก current value
- ไม่ reset filter เงียบ ๆ หลัง retry หรือกลับจาก detail

### Task rows

- desktop: row hover + visible focus + one primary navigation target
- mobile: row ใช้พื้นที่แตะอย่างน้อย 44×44px และไม่ทำ action สำคัญเป็น hover-only
- ถ้ามี action ที่แก้สถานะ ให้มี confirmation หรือ undo ตามความเสี่ยงของ action
- ใน phase dashboard นี้ หลีกเลี่ยง destructive action inline; ให้ไปทำที่ detail page

### Loading / error / stale

- initial load แสดง skeleton ใน KPI, attention และ SLA ตามลำดับ
- section error ไม่บล็อก section อื่น
- ถ้า data stale ให้แสดง timestamp และ action retry
- ห้ามใช้ spinner เต็มหน้าหากมีข้อมูลเก่าที่อ่านได้อยู่แล้ว

### Responsive

- 1280px+: attention และ SLA อยู่ 2 columns
- 768–1279px: attention เต็มก่อน SLA เต็มถัดไป
- <768px: KPI 2×2, attention ก่อน, SLA ถัดไป, service health ต่อท้าย
- ห้ามตัด title/deadline จนผู้ใช้แยก task ไม่ได้
- chart ต้องย่อหรือเปลี่ยนเป็น list; ห้ามใช้ fixed-width canvas ที่ทำให้เกิด overflow

## 11. Role and permission behavior

| Capability | Support Engineer | Client Executive | Super Admin |
|---|---:|---:|---:|
| ดู dashboard ตาม property scope | ✓ | ✓ | ✓ |
| ดู attention queue | ✓ | read-only | ✓ |
| สร้าง/จัดการ Ticket | ตาม policy | ตาม policy | ✓ |
| จัดการ Asset / PM | ✓ เมื่อ assigned หรือ policy อนุญาต | – | ✓ |
| จัดการ CCTV daily checks | ✓ | – | ✓ |
| เปลี่ยน property scope | assigned scope | assigned scope | ทุก property |
| เข้า SLA/catalog settings | ตาม permission | – | ✓ |

หมายเหตุ: ตารางนี้เป็น UX visibility matrix และต้องไม่แทนที่ Firestore Security Rules

## 12. Accessibility and localization

- ใช้ semantic landmarks: `header`, `main`, `section`, `nav`
- ทุก section มี heading ที่สัมพันธ์กับเนื้อหา
- KPI status ต้องประกาศเป็นข้อความ เช่น `เกินกำหนด 3 รายการ` ไม่พึ่ง color bar อย่างเดียว
- keyboard order: context → KPI → attention → SLA → service health → insights
- focus ring ต้องเห็นชัดบนทุก control
- minimum touch target 44×44px
- รองรับ `prefers-reduced-motion`; หลีกเลี่ยง animation ที่ไม่เพิ่มความเข้าใจ
- ตารางหรือ list ต้องมี heading/label ที่ screen reader เข้าใจ
- วันที่ เวลา และ SLA duration ใช้ภาษาไทยได้ แต่ควรคง ticket id และ technical identifier ตามรูปแบบระบบ
- ระบุ `aria-live` เฉพาะผลลัพธ์สำคัญ เช่น retry สำเร็จ/ล้มเหลว ไม่ประกาศทุก metric ตอน render
- ทดสอบ zoom 200% และ viewport มือถือโดยไม่เกิด content loss

## 13. Acceptance criteria

### Visual and UX

- ผู้ใช้ระบุ active property และ period ได้โดยไม่ต้อง scroll
- Overdue/SLA risk/Critical/Open tasks อยู่ใน first operational view
- Today's attention อยู่ก่อน insights ทั้ง desktop และ mobile
- สถานะ service health เห็นได้โดยไม่ต้องเปิด chart หลายตัว
- ไม่มี card pile ที่ทำให้ผู้ใช้สับสนว่า section ไหนสำคัญที่สุด
- empty/error/partial states มี next action หรือเหตุผลเสมอ

### Functional

- KPI click เปิด filtered destination ที่ใช้ scope เดิม
- attention row เปิด task detail ที่ถูกต้อง
- role ที่ไม่มีสิทธิ์ไม่เห็น action ที่ทำไม่ได้
- เปลี่ยน property/period แล้วทุก section ไม่แสดง scope เก่าปะปน
- retry ระดับ section ทำงานโดยไม่ reset filter

### Responsive and accessibility

- mobile 390px และ tablet 768px ไม่มี horizontal overflow
- desktop 1440px ไม่เกิด layout collapse หรือ section ยาวผิดสัดส่วน
- keyboard-only flow ไปถึงทุก interactive element
- axe/accessibility test ไม่พบ critical/serious issue ใหม่
- text และ status ผ่าน contrast ที่กำหนด

## 14. QA scenarios for implementation

เมื่อเริ่ม implementation ให้เพิ่มหรือปรับ automated checks เหล่านี้:

1. Dashboard renders with active property and period visible.
2. KPI order is Overdue → SLA risk → Critical → Open tasks.
3. Clicking Overdue filters or navigates to the matching task list.
4. Today's attention precedes Insights in DOM order.
5. Empty attention queue shows a useful next action.
6. One section failure still leaves other sections usable.
7. Support Engineer, Client Executive และ Super Admin เห็น action ต่างกันตาม matrix.
8. 390px, 768px และ 1440px ไม่ overflow และไม่ตัด task identity.
9. Keyboard focus and accessible names exist for selectors, KPI links, task rows and retry buttons.
10. Loading, stale, partial and retry states are covered with deterministic fixtures.

## 15. Implementation phases

### Phase 0 — ITOMS shared foundation

- ยืนยัน user-facing brand เป็น `ITOMS` ใน app shell, page title, sign-in และ product copy
- สร้างหรือปรับ shared primitives สำหรับ page frame, heading, button, status, table/list, form, empty/error และ focus state
- ผูกทุกหน้าเข้ากับ color, typography, spacing, radius และ responsive tokens เดียวกัน
- ทำ shared shell ให้ active property, mobile navigation และ permission visibility ทำงานเหมือนกันทุกหน้า
- เก็บ technical identifiers เดิมที่มีคำว่า `lotus` ไว้ชั่วคราวจนกว่าจะมี migration plan แยก

### Phase 1 — Dashboard operational shell

- สร้าง `DashboardContextBar`
- ปรับ KPI order และ hierarchy
- สร้าง `DashboardAttentionQueue`
- ย้าย SLA มาเป็น secondary panel ที่อ่านได้เร็ว
- เพิ่ม loading/empty/error/partial state
- ทำ desktop/tablet/mobile layout

### Phase 2 — Dashboard service health and progressive disclosure

- สร้าง compact `DashboardServiceHealth`
- ย้าย insights เข้า collapsible `DashboardInsights`
- เพิ่ม freshness/scope metadata
- ปรับ deep links ให้คง filter context
- เพิ่ม role-aware action visibility

### Phase 3 — Align ทุกหน้ากับ ITOMS system

ทำ page-by-page pass ตามลำดับความเสี่ยงและความถี่ใช้งาน:

1. Task pages และ Calendar — ทำงานประจำวัน
2. Asset, Licence, Damaged Assets และ PM — operational management
3. CCTV และ Incident Log — daily check / incident response
4. Settings, Users, Property Setup — configuration/admin
5. Activities และ Audit Log — audit/read-heavy views

สำหรับทุกหน้าให้ตรวจอย่างน้อย: header/context, heading/action hierarchy, surface/border, status language, loading/empty/error, responsive, keyboard/focus และ deep link scope

### Phase 4 — Validation and polish

- unit tests ของ view-model/metric states
- Playwright E2E ของ critical flows
- accessibility test
- responsive regression screenshots
- performance measurement ของ initial dashboard load
- visual review เทียบ concept และ current product language
- cross-page visual regression ของ shared shell และ representative page templates

แต่ละ phase ต้องผ่าน test และ review ของ phase ก่อนหน้า จึงค่อยเริ่ม phase ถัดไป

## 16. Open decisions before coding

### Decision 1 — KPI layout บน mobile

ข้อเสนอ: ใช้ 2×2 grid บน mobile เพื่อคงความสามารถในการ scan โดยไม่ทำให้ page ยาวเกินไป หาก label ภาษาไทยยาวเกินพื้นที่ ให้ใช้ label สั้น + supporting text แทนการลด font ต่ำกว่า 14px

### Decision 2 — Dashboard first viewport

ข้อเสนอ: ให้ `Today's attention` เป็น content หลักก่อน `SLA Operations` บนทุก breakpoint เพราะทีมมีขนาดเล็กและ dashboard ต้องช่วยตัดสินใจรายวันมากกว่ารายงานย้อนหลัง

### Decision 3 — Service health presentation

ข้อเสนอ: ใช้ compact row/tile ที่มี next action แทน chart แยก 4 ใบ เพื่อรักษา visual weight ให้สมดุลและลดการ scroll

### Decision 4 — Insight default state

ข้อเสนอ: collapsed บน mobile และ expanded ได้บน desktop แต่ไม่ควรแย่งพื้นที่กับ attention queue โดย default

### Decision 5 — Metric semantics

ข้อเสนอ: ทุก metric ที่คำนวณจาก client-side bounded data ต้องมี scope/freshness metadata และไม่ใช้คำว่า “ทั้งหมด” หากไม่ได้อ่านข้อมูลทั้งหมด

## 17. Fidelity ledger

| รายการ | จาก concept | ในระบบจริง |
|---|---|---|
| 4 urgency KPI | ใช้กำหนด hierarchy | bind กับข้อมูลจริงและ permission scope |
| ตัวเลขในภาพ | placeholder | ห้าม hard-code |
| Today's attention | primary work surface | ใช้ task/deadline ที่โหลดได้จริง |
| SLA donut/trend | visual reference | ใช้ summary/list ที่ accessible และไม่ทำให้ 0% หลอกตา |
| CCTV/PM/Asset/License strip | compact service health | link ไปหน้าที่มีอยู่และรักษา role scope |
| sidebar / top navigation | concept direction | reuse navigation ที่มีอยู่ หากไม่ทำให้เกิด migration scope เพิ่ม |
| สี sage + danger/warning/SLA | design direction | align กับ current Phase 0 tokens |

## 18. Definition of ready for implementation

Dashboard design ถือว่าพร้อมให้เริ่ม coding เมื่อ:

- product owner ยืนยัน 4 KPI และลำดับ attention queue
- role/permission matrix ไม่ขัดกับ policy และ rules ที่ใช้อยู่
- data scope/freshness copy ได้รับการยืนยัน
- desktop, tablet และ mobile wireframe นี้ถูกยอมรับ
- open decisions ทั้ง 5 ข้อถูกปิดหรือมี default ที่ตกลงร่วมกัน
- test scenarios ใน section 14 ถูกใช้เป็น implementation checklist
