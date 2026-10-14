import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { escapeHtml, errorText, dateText, busy } from "../app.js";
const clientSource = (await readFile(new URL("../supabase.js", import.meta.url), "utf8"))
  .replace('import { SUPABASE_URL, SUPABASE_PUBLIC_KEY } from "./config.js";', 'const { SUPABASE_URL, SUPABASE_PUBLIC_KEY } = globalThis.__testConfig;');
async function clientFor(config) {
  globalThis.__testConfig = config;
  return import(`data:text/javascript;base64,${Buffer.from(clientSource + `\n// ${JSON.stringify(config)}`).toString("base64")}`);
}

test("HTML values escape markup and quoted attributes", () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)"> & \'x\''), "&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;x&#39;");
  assert.equal(escapeHtml(null), "");
});
test("errors are Thai messages, not raw database or server details", () => {
  assert.equal(errorText({ code: "invalid_credentials" }), "อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  assert.match(errorText({ code: "42501" }), /ไม่มีสิทธิ์/);
  assert.match(errorText({ code: "NO_PROFILE" }), /บทบาท/);
  assert.match(errorText({ code: "NO_ROW" }), /โหลดข้อมูลใหม่/);
  assert.doesNotMatch(errorText({ message: "private SQL detail / token" }), /private|token/);
});
test("empty configuration fails explicitly without creating a client", async () => {
  const { getClient } = await clientFor({ SUPABASE_URL: "", SUPABASE_PUBLIC_KEY: "" });
  assert.throws(() => getClient(), /config.js/);
});
test("secret and service-role keys are rejected before SDK initialization", async () => {
  const secret = await clientFor({ SUPABASE_URL: "https://qa.supabase.co", SUPABASE_PUBLIC_KEY: "sb_secret_TEST_ONLY" });
  assert.throws(() => secret.getClient(), /ห้ามใช้ Secret Key/);
  const jwt = `header.${Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url")}.signature`;
  const service = await clientFor({ SUPABASE_URL: "https://qa.supabase.co", SUPABASE_PUBLIC_KEY: jwt });
  assert.throws(() => service.getClient(), /Anon Key/);
});
test("dates do not shift a date-only deadline into the previous day", () => {
  assert.equal(dateText(null), "—");
  assert.equal(dateText("2026-10-13"), new Date(2026, 9, 13).toLocaleString("th-TH", { dateStyle: "medium" }));
});
function mockForm() {
  const controls = [{ disabled: false }, { disabled: true }];
  return { controls, dataset: {}, querySelectorAll: () => controls, setAttribute() {}, removeAttribute() {} };
}
test("a concurrent duplicate save is suppressed and prior disabled states restored", async () => {
  const form = mockForm();
  let finish;
  let calls = 0;
  const pending = busy(form, async () => { calls++; await new Promise(resolve => { finish = resolve; }); });
  assert.deepEqual(form.controls.map(c => c.disabled), [true, true]);
  await busy(form, async () => { calls++; });
  assert.equal(calls, 1);
  finish(); await pending;
  assert.deepEqual(form.controls.map(c => c.disabled), [false, true]);
  assert.equal(form.dataset.busy, "false");
});
test("failed writes re-enable controls and preserve the failure", async () => {
  const form = mockForm();
  await assert.rejects(busy(form, async () => { throw new Error("offline"); }), /offline/);
  assert.deepEqual(form.controls.map(c => c.disabled), [false, true]);
  assert.equal(form.dataset.busy, "false");
});
// Replace only the client boundary; execute the application's actual pagination logic.
const source = (await readFile(new URL("../app.js", import.meta.url), "utf8"))
  .replace('import { getClient } from "./supabase.js";', 'const getClient = () => globalThis.__testClient;');
const isolated = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);
test("dashboard reads all pages beyond the API default row limit", async () => {
  const calls = [];
  globalThis.__testClient = { from: () => ({ select: () => ({ order: () => ({ range: async (from, to) => {
    calls.push([from, to]);
    return { data: Array.from({ length: from < 1000 ? 500 : 17 }, (_, i) => ({ id: from + i })), error: null };
  } }) }) }) };
  const rows = await isolated.readAll("follow_up_tasks", "id");
  assert.equal(rows.length, 1017);
  assert.deepEqual(calls, [[0, 499], [500, 999], [1000, 1499]]);
});
test("read failure rejects instead of returning seed or partial data", async () => {
  globalThis.__testClient = { from: () => ({ select: () => ({ order: () => ({ range: async () => ({ data: null, error: new Error("database offline") }) }) }) }) };
  await assert.rejects(isolated.readAll("students", "id"), /database offline/);
});
