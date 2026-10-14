import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "./config.js";

let client;
export function getClient() {
  if (!/^https:\/\/[a-z0-9.-]+(?::\d+)?\/?$/i.test(SUPABASE_URL) || !SUPABASE_PUBLIC_KEY) {
    throw new Error("ยังไม่ได้ตั้งค่าการเชื่อมต่อ กรุณากรอก Supabase URL และ Publishable/Anon Key ใน config.js");
  }
  if (SUPABASE_PUBLIC_KEY.startsWith("sb_secret_")) throw new Error("ห้ามใช้ Secret Key ในเว็บไซต์ กรุณาใช้ Publishable Key");
  if (!SUPABASE_PUBLIC_KEY.startsWith("sb_publishable_")) {
    try {
      const payload = JSON.parse(atob(SUPABASE_PUBLIC_KEY.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (payload.role !== "anon") throw new Error();
    } catch { throw new Error("คีย์ไม่ถูกต้อง กรุณาใช้ Publishable Key หรือ Anon Key เท่านั้น"); }
  }
  if (!window.supabase?.createClient) throw new Error("โหลด Supabase Client ไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วรีเฟรชหน้า");
  client ??= window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLIC_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  return client;
}
