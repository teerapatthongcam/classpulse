# แผนและผลการทดสอบ ClassPulse

## ผลที่รันในเครื่องนี้

- `node --test tests/unit.test.mjs`: **ผ่าน 9 tests** (HTML escaping, ข้อผิดพลาดภาษาไทย, Config ว่าง, ปฏิเสธ Secret/Service Role Key, วันนัดหมาย, ป้องกันส่งซ้ำ, คืนสถานะปุ่มหลังล้มเหลว, Pagination และ Read failure)
- `node tests/browser-smoke.mjs`: **ผ่าน 15 checks** ใน Headless Chrome ด้วย **Mock Supabase** รวม Login/Logout ตามบทบาท, Session หลัง Refresh, Create/Edit/Delete, หมายเหตุ, Search/Filter, Write/Read error, ป้องกันส่งซ้ำ, HTML escaping และ Layout 390/768/1440 px ไม่มี Uncaught JavaScript errors
- ภาพ QA: `.qa/teacher-1440.png`, `.qa/teacher-768.png`, `.qa/teacher-390.png`, `.qa/student-390.png` และผล `.qa/browser-results.json`
- **ยังไม่ได้รัน:** Auth จริง, การ Persist ในฐานข้อมูล Supabase จริง, SQL Schema/Seed/RLS tests และการทดสอบ URL ที่ Deploy เพราะผู้ใช้จะกรอก Config และสร้าง Project/บัญชีด้วยตนเอง

Mock ตรวจพฤติกรรมของ UI เท่านั้น การกรองข้อมูลใน Mock ไม่ใช่หลักฐานว่า RLS ปลอดภัย ต้องทดสอบฐานข้อมูลและ Request จริงด้านล่าง

## Checklist กับ Supabase จริง

ก่อนทดสอบ รัน Schema, สร้าง Auth Users, รัน Seed และกรอก Config ตาม README ใช้หน้าต่าง/Browser profiles แยกครูกับนักเรียน รหัสผ่านขอจากผู้ดูแล ไม่บันทึกลงรายงาน

| # | วิธีทดสอบ | ผลที่ต้องได้ | สถานะจริง |
| --- | --- | --- | --- |
| 1 | Login บัญชีครู | หน้า Teacher; นักเรียนเฉพาะที่มอบหมาย | ยังไม่รัน |
| 2 | Login นักเรียนทั้ง 01 และ 02 | หน้า Student; แต่ละบัญชีเห็นงานตน | ยังไม่รัน |
| 3 | Logout แล้ว Login ใหม่ | กลับหน้า Login; เข้าใช้งานใหม่ได้ | ยังไม่รัน |
| 4 | Refresh หน้า Dashboard | Session และบทบาทถูกต้อง | ยังไม่รัน |
| 5 | ครูเพิ่มงาน หัวข้อ/ประเภท/ความสำคัญ/วันนัด/รายละเอียด แล้ว Logout/Login | งานอยู่ใน `follow_up_tasks` และอ่านกลับได้ | ยังไม่รัน |
| 6 | แก้สถานะและเพิ่มหมายเหตุทั้งสอง Visibility | สถิติเปลี่ยน; งานและหมายเหตุอยู่ใน Table Editor | ยังไม่รัน |
| 7 | Login นักเรียนแต่ละคน | เห็นเฉพาะงานที่ผูกกับ `students.user_id` ของตน | ยังไม่รัน |
| 8 | เปลี่ยน URL เป็น `teacher.html`; ส่ง Query ด้วย UUID นักเรียน/งานคนอื่น | หน้า Redirect; Request คืนแถวว่างหรือปฏิเสธ | ยังไม่รัน |
| 9 | Query `follow_up_notes` และกรอง UUID หมายเหตุ `internal` โดยตรง | ไม่คืนหมายเหตุภายใน แม้ทราบ UUID | ยังไม่รัน |
| 10 | เปิดหน้าภายในและ Query API ใน Incognito ที่ยังไม่ Login | Redirect; API อ่านข้อมูลส่วนตัวไม่ได้ | ยังไม่รัน |
| 11 | DevTools → Network → Offline แล้วโหลดใหม่/บันทึก | Error ภาษาไทย; ไม่แสดง Toast สำเร็จ; ไม่แทนด้วย Seed | ยังไม่รัน |
| 12 | เปิด URL จริงบนคอมพิวเตอร์ Tablet และโทรศัพท์ | อ่านได้ กดปุ่มได้ ฟอร์ม/ตารางเลื่อนได้ ไม่มีหน้าล้น | ยังไม่รัน |

ตรวจเพิ่ม: ครูลบงาน/หมายเหตุต้องยืนยันก่อน, นักเรียนไม่มีปุ่มแก้ไข, Validation ไม่รับหัวข้อ/หมายเหตุเป็นช่องว่าง, กดบันทึกซ้ำไม่สร้างหลายแถว, แก้งานเดียวกันจากสอง Tab ต้องไม่ทับเวอร์ชันที่ใหม่กว่า

## ตรวจ RLS ที่ฐานข้อมูล

รัน `tests/rls-tests.sql` ทั้งไฟล์ใน Supabase SQL Editor ด้วยผู้ดูแล **หลัง Seed** สคริปต์ตั้ง `ROLE authenticated/anon` และ JWT claims ให้เหมือนผู้ใช้จริง แล้วทดสอบ SELECT/INSERT/UPDATE/DELETE, Role escalation, Metadata role ปลอม, ครูคนอื่น/นักเรียนที่ไม่ได้มอบหมาย, หมายเหตุภายใน และ Cascade delete

Fixture และการแก้ไขทั้งหมดอยู่ใน Transaction ที่จบด้วย `ROLLBACK` ไม่มีบัญชี/ข้อมูลทดสอบคงเหลือ ถ้าเกิด Exception ให้หยุดและตรวจ Policy; อย่าปิด RLS เพื่อให้ทดสอบผ่าน หากใช้ SQL Editor ที่แสดง Notices ให้ตรวจข้อความ `PASS`; ถ้าไม่มี Notices ผลสำเร็จของสคริปต์ทั้งไฟล์โดยไม่มี Exception คือการผ่าน Assertions

## ตรวจ Request จริงจากบัญชีนักเรียน

ใน Browser Console ขณะ Login นักเรียน เรียก Client เดิมด้วย Dynamic import (อย่าคัดลอก Access Token ไปแชร์):

```js
const { getClient } = await import("./supabase.js");
const db = getClient();
await db.from("students").select("id, student_code");
await db.from("follow_up_tasks").select("id, student_id, title");
await db.from("follow_up_notes").select("id, visibility, note");
// แทน UUID ด้วยข้อมูล Demo ของอีกบัญชีที่ผู้ดูแลทราบ:
await db.from("follow_up_tasks").select("id").eq("id", "UUID-งานของอีกคน");
await db.from("follow_up_notes").select("note").eq("id", "UUID-หมายเหตุภายใน");
```

Query ตาม UUID ที่ถูกต้องของคนอื่น/หมายเหตุภายในต้องคืน `data: []` ส่วน Query ไม่กรองต้องไม่มีข้อมูลที่เกินสิทธิ์ ห้ามถือว่าหน้าเว็บซ่อนปุ่มแล้วเพียงพอ

ทดสอบคำขอที่ไม่ Login ใน Incognito Console โดยใช้ Public Config (ไม่มี Bearer token):

```js
const { SUPABASE_URL, SUPABASE_PUBLIC_KEY } = await import("./config.js");
const response = await fetch(`${SUPABASE_URL}/rest/v1/students?select=*`, {
  headers: { apikey: SUPABASE_PUBLIC_KEY }
});
console.log(response.status, await response.json());
```

ต้องไม่คืนข้อมูลนักเรียน คำขอถูกปฏิเสธด้วย Grants/RLS; ตรวจครบทุกตารางใน SQL test ด้วย ใช้เฉพาะข้อมูล Demo และกรอกผลจริงใน Checklist หลังรันทดสอบ
