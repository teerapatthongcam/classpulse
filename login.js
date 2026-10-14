import { getClient } from "./supabase.js";
import { $, currentProfile, showError, busy } from "./app.js";

async function route() {
  const profile = await currentProfile();
  if (profile) { location.replace(`${profile.role}.html`); return true; }
  return false;
}
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  const email = $("email").value.trim();
  const password = $("password").value;
  $("loginError").classList.add("hidden");
  await busy(event.currentTarget, async () => {
    $("loginStatus").textContent = "กำลังเข้าสู่ระบบ…";
    try {
      const { error } = await getClient().auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (!await route()) throw { code: "SESSION_EXPIRED" };
    } catch (error) { showError("loginError", error); }
    finally { $("password").value = ""; $("loginStatus").textContent = ""; }
  });
});
try { await route(); }
catch (error) { showError("loginError", error); }
finally { $("loginStatus").textContent = ""; $("loginBtn").disabled = false; }
