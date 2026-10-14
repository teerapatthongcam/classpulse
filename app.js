import { getClient } from "./supabase.js";

export const $ = (id) => document.getElementById(id);
export const statusText = { pending: "ต้องติดตาม", in_progress: "กำลังดำเนินการ", done: "ดำเนินการเสร็จ" };
export const priorityText = { high: "สูง", medium: "ปานกลาง", low: "ต่ำ" };
export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
export function errorText(error) {
  if (/^(ยังไม่ได้|ห้ามใช้|คีย์ไม่ถูกต้อง|โหลด Supabase)/.test(error?.message || "")) return error.message;
  if (error?.code === "invalid_credentials") return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
  if (error?.code === "email_not_confirmed") return "บัญชียังไม่ได้ยืนยันอีเมล กรุณาติดต่อผู้ดูแล";
  if (error?.status === 429 || error?.code === "over_request_rate_limit") return "มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่";
  if (error?.code === "42501") return "คุณไม่มีสิทธิ์ดำเนินการนี้ กรุณาติดต่อผู้ดูแล";
  if (error?.code === "23503") return "ไม่พบข้อมูลที่เกี่ยวข้องหรือสิทธิ์ได้รับการเปลี่ยนแปลง กรุณาโหลดข้อมูลใหม่";
  if (error?.code === "23514" || error?.code === "22007") return "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแบบฟอร์ม";
  if (error?.code === "NO_PROFILE") return "บัญชีนี้ยังไม่ได้รับบทบาท กรุณาติดต่อผู้ดูแลเพื่อตั้งค่า profiles";
  if (error?.code === "NO_ROW") return "ไม่พบรายการหรือสิทธิ์เปลี่ยนไป กรุณาโหลดข้อมูลใหม่";
  if (error?.code === "SESSION_EXPIRED") return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
  return "ไม่สามารถติดต่อระบบหรือดำเนินการได้ กรุณาตรวจสอบอินเทอร์เน็ตและการตั้งค่า Supabase แล้วลองใหม่";
}
export function showError(id, error) {
  $(id).textContent = errorText(error);
  $(id).classList.remove("hidden");
}
export function toast(message) {
  $("toast").textContent = message;
  $("toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("toast").classList.remove("show"), 3500);
}
export async function busy(form, action) {
  if (form.dataset.busy === "true") return;
  form.dataset.busy = "true";
  const controls = [...form.querySelectorAll("button, input, select, textarea")];
  const previous = controls.map(el => el.disabled);
  controls.forEach(el => { el.disabled = true; });
  form.setAttribute("aria-busy", "true");
  try { return await action(); }
  finally {
    controls.forEach((el, i) => { el.disabled = previous[i]; });
    form.dataset.busy = "false";
    form.removeAttribute("aria-busy");
  }
}
export async function currentProfile() {
  const db = getClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error) {
    if (error.name === "AuthSessionMissingError" || error.status === 401 || error.code === "refresh_token_not_found") return null;
    throw error;
  }
  if (!user) return null;
  const result = await db.from("profiles").select("id, display_name, role").eq("id", user.id).single();
  if (result.error) {
    if (result.error.code === "PGRST116") throw { code: "NO_PROFILE" };
    throw result.error;
  }
  if (!["teacher", "student"].includes(result.data.role)) throw { code: "NO_PROFILE" };
  return result.data;
}
export async function requireRole(role) {
  const profile = await currentProfile();
  if (!profile) { location.replace("index.html"); return null; }
  if (profile.role !== role) { location.replace(`${profile.role}.html`); return null; }
  const { data: subscription } = getClient().auth.onAuthStateChange((event, session) => {
    // Never await Supabase calls inside this callback.
    if (event === "SIGNED_OUT" || (session && session.user.id !== profile.id)) location.replace("index.html");
  });
  window.addEventListener("pagehide", () => subscription.subscription.unsubscribe(), { once: true });
  return profile;
}
export async function logout(button, errorId) {
  button.disabled = true;
  try {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
    location.replace("index.html");
  } catch (error) { showError(errorId, error); button.disabled = false; }
}
// Avoid the default PostgREST row limit silently truncating dashboard counts.
export async function readAll(table, columns, order = "id") {
  const rows = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await getClient().from(table).select(columns).order(order).range(from, from + 499);
    if (error) throw error;
    rows.push(...data);
    if (data.length < 500) return rows;
  }
}
export function dateText(value, time = false) {
  if (!value) return "—";
  return new Date(time ? value : `${value}T00:00:00`).toLocaleString("th-TH", time ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}
