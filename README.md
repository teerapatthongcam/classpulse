# ClassPulse Demo

ระบบสาธิตติดตามและช่วยเหลือนักเรียนด้วย HTML, CSS, Vanilla JavaScript และ Supabase Auth/PostgreSQL ไม่ใช้ Framework หรือ Backend Server ของตนเอง ใช้ข้อมูลสมมติเท่านั้น

**สถานะส่งมอบ:** มีโค้ดเชื่อมต่อฐานข้อมูลและ SQL สำหรับสิทธิ์ครบ แต่ `config.js` ยังเว้นว่างตามที่ผู้ใช้จะกรอกเอง ยังไม่ได้สร้างบัญชีบน Supabase จริง ทดสอบ Auth/RLS จริง หรือ Deploy เป็น URL สาธารณะ ดูผลทดสอบใน `TESTING.md`

## โครงสร้างไฟล์

| ไฟล์ | หน้าที่ |
| --- | --- |
| `index.html`, `login.js` | Login ด้วยอีเมล/รหัสผ่าน และตรวจสอบ Session |
| `teacher.html`, `teacher.js` | จุดเริ่มต้น Dashboard ครู |
| `student.html`, `student.js` | จุดเริ่มต้น Dashboard นักเรียน |
| `dashboard.js` | UI ร่วม สถิติ ค้นหา แบบฟอร์มงาน และประวัติหมายเหตุ |
| `app.js` | ตรวจบทบาท ข้อความภาษาไทย ป้องกันกดซ้ำ และอ่านข้อมูลแบบแบ่งหน้า |
| `config.js`, `supabase.js` | Public config และ Supabase Client |
| `styles.css` | สไตล์ ClassPulse และ Responsive |
| `supabase-schema.sql` | ตาราง Foreign Keys, Indexes, Trigger, Grants และ RLS |
| `seed-demo.sql` | เชื่อม Auth Users ที่สร้างแล้วกับข้อมูล Demo |
| `tests/` | Unit tests, Browser tests ด้วย Mock และ SQL tests สำหรับ RLS จริง |
| `scripts/package-site.mjs` | คัดเฉพาะไฟล์เว็บไซต์ไป `dist/` เพื่อ Deploy |

`data.json` เดิมเก็บไว้เป็นข้อมูลอ้างอิงของต้นแบบ ไม่ถูกโหลดโดยระบบออนไลน์ และข้อมูลเดิมใน `localStorage` ไม่ถูกนำเข้าฐานข้อมูลโดยอัตโนมัติ

## 1. สร้าง Supabase Project และ Schema

1. เข้าสู่ [Supabase Dashboard](https://supabase.com/dashboard) แล้วเลือก New project ตั้งชื่อและรหัสผ่านฐานข้อมูลผ่าน Dashboard เก็บรหัสผ่านนี้ในที่ปลอดภัย
2. เมื่อ Project พร้อม เปิด SQL Editor วางเนื้อหา `supabase-schema.sql` ทั้งไฟล์แล้ว Run **หนึ่งครั้งใน Project ใหม่** หากมีตารางชื่อเดียวกันอยู่แล้ว ให้ใช้ Project ใหม่หรือวางแผน Migration ก่อน ไม่ลบตารางเดิมเพื่อรันซ้ำ
3. ตรวจ Table Editor ว่ามี `profiles`, `students`, `teacher_students`, `follow_up_tasks`, `follow_up_notes` และเปิด RLS ทุกตาราง
4. ใน Authentication เปิด Email/Password Sign-in และปิดการสมัครบัญชีใหม่ของผู้ใช้ทั่วไป (Allow new users to sign up) รวมถึงไม่เปิด Anonymous Sign-ins สำหรับ Demo นี้

## 2. สร้างบัญชี Demo อย่างปลอดภัย

ใน Authentication → Users → Add user → Create new user สร้างบัญชีต่อไปนี้โดยผู้ดูแล:

| อีเมล | บทบาทที่ Seed จะกำหนด |
| --- | --- |
| `teacher@classpulse.demo` | teacher |
| `student01@classpulse.demo` | student |
| `student02@classpulse.demo` | student |

ตั้งรหัสผ่านแยกแต่ละบัญชีด้วย Password Manager ตามข้อกำหนดของ Project เลือก Auto confirm user/ยืนยันอีเมลจากฝั่งผู้ดูแล เพราะอีเมลตัวอย่างเหล่านี้ไม่ใช่กล่องจดหมายสำหรับรับลิงก์ยืนยัน **อีเมลที่แสดงบนหน้า Login ไม่ได้สร้างบัญชีให้เอง** ต้องสร้างใน Auth ก่อนจึง Login ได้

ส่งรหัสผ่านให้ผู้ทดลองผ่านช่องทางส่วนตัว ไม่ใส่ในโค้ดเว็บไซต์ README หรือ Git หากต้องเปลี่ยนรหัสผ่านของอีเมล Demo ให้ผู้ดูแลใช้ Dashboard หรือ Auth Admin API จากเครื่องส่วนตัว ไม่ใช้หน้าเว็บสาธารณะ

จากนั้นรัน `seed-demo.sql` ทั้งไฟล์ใน SQL Editor ด้วยสิทธิ์ผู้ดูแล Seed จะตรวจว่ามี Auth Users ทั้งสามก่อน สร้าง profiles/นักเรียน/การมอบหมาย และงานตัวอย่างพร้อมหมายเหตุภายในและหมายเหตุที่นักเรียนอ่านได้ รันซ้ำได้โดยไม่ทับงานเดิม แต่ไม่ใช้เพื่อ Reset ข้อมูลทั้งหมด

ผู้ดูแลเท่านั้นที่เพิ่ม/แก้บทบาทหรือมอบหมายนักเรียนผ่าน Dashboard/SQL Editor ไม่มี Trigger ที่เชื่อ `user_metadata.role` และไม่มีหน้า Signup หรือปุ่มเปลี่ยนบทบาทจาก Client

## 3. กรอก Public Config

หา Project URL และ Publishable Key ใน Connect หรือ Settings → API Keys ของ Project กรอกใน `config.js`:

```js
export const SUPABASE_URL = "";        // Project URL ของคุณ
export const SUPABASE_PUBLIC_KEY = ""; // Publishable Key หรือ legacy Anon Key
```

ใช้เฉพาะ `sb_publishable_...` หรือ JWT Anon Key **ห้ามใช้ `sb_secret_...`, Service Role Key, รหัสผ่านฐานข้อมูล หรือรหัสผ่านบัญชีในไฟล์นี้** Public Key สามารถมองเห็นได้ในเบราว์เซอร์ การควบคุมสิทธิ์อยู่ที่ Grants/RLS ของฐานข้อมูล ไม่ใช่การซ่อน Key

เว็บไซต์ใช้ Supabase JS **2.117.3** แบบ UMD จาก CDN และ Google Fonts จึงต้องมีอินเทอร์เน็ต ไม่ต้อง `npm install` เพื่อเปิดเว็บ และไม่ใช้ `.env` เพราะ Static HTML ไม่มีเครื่องมือแทนค่าตัวแปร Environment ระหว่าง Build

## 4. เปิดในเครื่อง

```powershell
python -m http.server 8000
```

เปิด `http://localhost:8000` หรือใช้ VS Code Live Server อย่าเปิดด้วย `file://` เพราะใช้ JavaScript Modules ระบบจะแสดงข้อผิดพลาดชัดเจนเมื่อ Config ว่าง/Client โหลดไม่ได้/ฐานข้อมูลติดต่อไม่ได้ โดยไม่ใช้ข้อมูล Seed จากไฟล์แทน

Login ครูจะไป `teacher.html`; นักเรียนจะไป `student.html` เมื่อเปิด URL ของอีกบทบาทจะถูกส่งกลับหน้าที่ถูกต้อง ผู้ไม่ Login จะถูกส่งไปหน้าเริ่มต้น หน้าภายในจะไม่โหลดข้อมูลจนตรวจ Auth User และ `profiles` สำเร็จ

## สิทธิ์และการจัดการข้อมูล

| ข้อมูล | ครู | นักเรียน |
| --- | --- | --- |
| profiles | อ่านของตนเอง; แก้บทบาทไม่ได้ | อ่านของตนเอง; แก้บทบาทไม่ได้ |
| students | อ่านเฉพาะที่ผู้ดูแลมอบหมาย | อ่านเฉพาะข้อมูลที่ผูกกับ Auth User ของตน |
| งานติดตาม | อ่าน/สร้าง/แก้ไข/ลบงานของตนสำหรับนักเรียนที่มอบหมาย | อ่านงานของตนจากครูที่เกี่ยวข้อง; เขียนไม่ได้ |
| หมายเหตุ | อ่าน/เพิ่ม/ลบในงานของตน | อ่านเฉพาะ `student_visible` ของงานตน |
| การมอบหมาย | อ่านของตน; เขียนไม่ได้ | อ่าน/เขียนไม่ได้ |

รายละเอียดงานและคำแนะนำใน `description` เปิดให้นักเรียนเห็นเสมอ ข้อมูลภายในต้องใส่ในหมายเหตุและเลือก `internal` ซึ่ง RLS จะไม่ส่งแถวเหล่านี้ให้นักเรียน หมายเหตุเป็นประวัติแบบเพิ่มรายการใหม่ ไม่แก้ข้อความเดิม ครูลบหมายเหตุที่ผิดได้หลังยืนยัน

เมื่อแก้ไขหรือลบงาน ระบบตรวจ `updated_at` เพื่อป้องกันทับข้อมูลที่เปลี่ยนไปแล้ว และ Trigger ไม่ให้เปลี่ยนครูเจ้าของ/นักเรียนของงาน การลบงานลบหมายเหตุที่เกี่ยวข้องด้วย หากผู้ดูแลลบการมอบหมาย `teacher_students` งานของครูสำหรับการมอบหมายนั้นจะถูกลบตาม Foreign Key — หากต้องการเก็บประวัติ ให้พิจารณาปิดสิทธิ์ด้วย Migration แทนการลบ

Dashboard อ่านข้อมูลที่ RLS อนุญาตจาก Supabase และแบ่งหน้าเพื่อไม่ตัดสถิติที่ API row limit ตามปกติ การบันทึกไม่ใช้ `localStorage` แทนฐานข้อมูล; Supabase SDK ใช้พื้นที่นี้สำหรับ Auth Session เท่านั้น ไม่เก็บรหัสผ่าน ไม่มี Realtime ใน Demo นี้ กดโหลดใหม่เพื่อดูการเปลี่ยนแปลงจากอีกเครื่อง ครูส่งออกข้อมูลที่ได้รับอนุญาตเป็น JSON ได้

## 5. ทดสอบก่อนสาธิต

ใช้ `TESTING.md` ตรวจครบ 12 กรณี และรัน `tests/rls-tests.sql` **ทั้งไฟล์** ใน SQL Editor หลัง Seed สคริปต์จะเปลี่ยนบทบาทฐานข้อมูลจริงเพื่อตรวจคำขอที่อนุญาตและปฏิเสธ แล้ว Rollback ข้อมูลทดสอบ ตรวจผล Notices ว่า PASS และไม่มี Exception หากเกิด Exception ไม่ถือว่าผ่าน

ทดสอบฝั่ง Client ด้วย Node.js 22+ (ไม่มี Dependencies):

```powershell
node --test tests/unit.test.mjs
node tests/browser-smoke.mjs
```

Browser tests ต้องมี Chrome/Edge; ตั้ง `CHROME_PATH` ถ้าโปรแกรมอยู่ตำแหน่งอื่น ใช้ Mock Supabase ที่แยกจาก Config จริง ไม่ติดต่อ Project ของคุณ และใช้โปรไฟล์เบราว์เซอร์ชั่วคราวใน `.qa/` สำหรับข้อมูลทดสอบเท่านั้น สคริปต์เปิดเบราว์เซอร์แบบ Headless โดยปิด Sandbox เฉพาะกระบวนการ QA ภายในเครื่อง ภาพหน้าจอและผลอยู่ใน `.qa/` ซึ่งไม่ถูก Deploy

## 6. Deploy เป็น Static Website

กรอก Config และทดสอบจริงก่อน จากนั้นเตรียมเฉพาะไฟล์เว็บไซต์:

```powershell
node scripts/package-site.mjs
python -m http.server 8001 --directory dist
```

ตรวจที่ `http://localhost:8001` เมื่อแก้ไฟล์ต้นฉบับหรือ Config ให้รัน Package ใหม่ก่อน Deploy

- **Netlify:** อัปโหลดโฟลเดอร์ `dist/` ผ่าน Deploy manually แล้วใช้ URL ที่บริการคืนให้ หากเชื่อม Git ตั้ง Build command เป็น `node scripts/package-site.mjs` และ Publish directory เป็น `dist`
- **GitHub Pages:** อัปโหลดไฟล์ภายใน `dist/` ไป Publishing branch แยก เช่น `gh-pages` แล้วตั้ง Settings → Pages → Deploy from a branch → `gh-pages` / root หรือใช้ Workflow ที่ Upload artifact จาก `dist` อย่านำทั้ง Repository ขึ้นเป็นเว็บไซต์ เพราะมี SQL และ Test fixtures
- **Static Hosting อื่น:** Publish เฉพาะไฟล์ใน `dist/` ให้ `index.html` เป็นหน้าเริ่มต้น และให้ `.js` ใช้ JavaScript MIME type รองรับ HTTPS

ตั้ง Authentication → URL Configuration → Site URL เป็น URL ที่ Deploy และเพิ่ม URL พัฒนา/Production ที่จำเป็นใน Redirect URLs แม้ Email/Password ของ Demo ไม่ใช้ OAuth Callback ปัจจุบัน หน้าเว็บใช้ Relative paths จึงรองรับ GitHub Pages ใต้ชื่อ Repository

เปิด URL ที่ Deploy แล้วทดสอบครูและนักเรียนทั้งสองจากเบราว์เซอร์/อุปกรณ์ต่างกัน ข้อมูลที่ครูบันทึกต้องตรวจพบใน Table Editor และยังอยู่หลัง Logout/Login ก่อนถือว่าพร้อมสาธิต

## เอกสารอ้างอิง

- [Supabase JavaScript installation](https://supabase.com/docs/reference/javascript/installing)
- [Supabase JS 2.117.3 release](https://github.com/supabase/supabase-js/releases/tag/v2.117.3)
- [API keys และการใช้ Public Key](https://supabase.com/docs/guides/getting-started/api-keys)
- [Row Level Security และ Grants](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration)
