# UI Redesign Phase 1 — Operations Control Room

สถานะ: implemented locally, verified against Firebase Emulator, deployment pending explicit approval.

## Intent

ปรับหน้าตา ITOMS ให้เหมาะกับผู้ใช้ 3 กลุ่มพร้อมกัน:

- ทีม IT Outsource ใช้ติดตามคิว งานเร่งด่วน และผู้รับผิดชอบ
- ผู้บริหารใช้ดูแนวโน้ม ปริมาณงาน SLA และคุณภาพการบริการ
- ลูกค้า/Property Management ใช้เห็นสถานะงานและขอบเขตข้อมูลของ Property ที่ตนเองได้รับอนุญาต

รอบนี้เป็น presentation-only change: ไม่เปลี่ยน Firestore schema, query contract, Rules, role model, bounded read หรือข้อจำกัด Spark.

## Visual direction

ใช้แนวคิด **Operations Control Room** แทนการวางทุกข้อมูลเป็น card ที่หน้าตาเหมือนกัน:

- `#172A23` ink สำหรับข้อมูลสำคัญและหัวข้อ
- `#174B38` / `#25634A` forest สำหรับ navigation, primary action และ healthy state
- `#F2F6F3` canvas กับ white surface เพื่อแยกพื้นที่โดยไม่ใช้เงาหนัก
- `#C68419` amber สำหรับงานที่ต้องติดตาม
- `#C54C55` coral สำหรับ incident/SLA risk
- เส้นแบ่งบางและ radius ระดับกลาง เพื่อให้ข้อมูลจำนวนมากยัง scan ได้เร็ว

Typography ใช้ `Noto Sans Thai`, `IBM Plex Sans Thai` และ system fallback เดิม เพื่อคงการอ่านภาษาไทยบนเครื่องที่ไม่มี web-font.

## Implemented in this phase

1. เพิ่ม shared visual tokens ใน `src/styles.css` และตั้ง `portal-*` primitives สำหรับ app shell
2. ปรับ header ให้มี brand rail, context bar และ visual hierarchy ที่ชัดขึ้น
3. ปรับ sidebar navigation ให้มี active rail, group label ที่ผ่าน contrast และ mobile behavior เดิม
4. ปรับ Dashboard ให้ใช้ hero, metric rail, attention panel และ operational panels ที่แยกลำดับความสำคัญชัดขึ้น
5. คงรายละเอียดข้อมูล, action, callback, query และ permission เดิมไว้ทั้งหมด
6. อัปเดต visual baselines ของ dashboard, task, calendar และ settings หลังตรวจภาพจริง
7. ปรับ Dashboard KPI เป็น metric rail แบบ 4 ช่องบน Desktop ที่กว้างพอ และคงการยุบเป็น 2 ช่องบน Tablet

## Operations Control Center pass

รอบ redesign ล่าสุดนำ visual grammar ไปใช้กับโครงสร้างการทำงานหลักตาม reference ที่อนุมัติ:

- top bar สี forest พร้อม context, global task search และ utility actions
- named navigation rail บน Desktop ที่แสดงไอคอน ชื่อเมนู และหมวดหมู่พร้อมกัน; Mobile ยังคงใช้เมนูแบบยุบได้
- Dashboard ใช้ KPI rail, attention queue, incident pulse และ SLA panel ตามลำดับความสำคัญ
- Task Board เปิดด้วย Table View เป็นค่าเริ่มต้นเพื่อรองรับข้อมูลมากขึ้น พร้อมคง List/Kanban ไว้
- ไม่มีการเปลี่ยน schema, Firestore Rules, query contract, role model หรือ bounded/manual limitation
- การตรวจสอบและ preview รอบนี้ทำกับ Local Vite + Firebase Emulator เท่านั้น ยังไม่มี Production deploy

## Responsive/accessibility contract

- Desktop: shell ใช้ sidebar คงที่และ content width สูงสุดประมาณ 1440px
- Mobile: sidebar ยุบเป็นเมนู, content ไม่สร้าง horizontal overflow
- interactive controls ต้องมี keyboard focus และ visible state
- navigation group label ต้องมี contrast อย่างน้อย WCAG AA
- prefers-reduced-motion ยังคงลด transition/animation ตาม global stylesheet

## Next UI passes

Phase ถัดไปควรทำเป็นราย feature โดยรักษา visual grammar นี้:

1. Task Board: เพิ่ม table-first density, column emphasis และ quick filters ที่รองรับรายการมาก
2. Operations pages: ใช้ status strip เดียวกันกับ CCTV, Incident, PM, Asset และ Damaged Asset
3. Reporting: เพิ่ม comparison mode ตาม Team/Property/ช่วงเวลา โดยยังระบุ bounded/manual ชัดเจน
4. Role-specific views: ปรับข้อความและ default emphasis ตาม IT team, outsource management และ customer view

ไม่ควรเพิ่ม chart library หรือ background worker เพียงเพื่อเปลี่ยนหน้าตา เพราะยังไม่จำเป็นต่อ Spark bounded/manual architecture.
