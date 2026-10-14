// Dependency-free Chrome DevTools QA. Uses a MOCK Supabase transport; never contacts a real project.
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { readFile, mkdir, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const qaDir = path.join(root, ".qa");
await mkdir(qaDir, { recursive: true });
const candidates = [process.env.CHROME_PATH, "C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
let binary;
for (const candidate of candidates) { try { await access(candidate); binary = candidate; break; } catch {} }
if (!binary) throw new Error("Chrome/Edge unavailable. Set CHROME_PATH to a browser executable.");
let configured = false;
const server = http.createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const file = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
    if (!file.startsWith(root) || ![".html", ".js", ".css"].includes(path.extname(file))) { response.writeHead(404); response.end(); return; }
    let content = await readFile(file, "utf8");
    if (pathname === "/config.js") content = configured
      ? 'export const SUPABASE_URL = "https://qa.supabase.co"; export const SUPABASE_PUBLIC_KEY = "sb_publishable_QA_ONLY";'
      : 'export const SUPABASE_URL = ""; export const SUPABASE_PUBLIC_KEY = "";';
    if (file.endsWith(".html")) content = content.replace(/https:\/\/cdn\.jsdelivr\.net\/npm\/@supabase\/supabase-js@[^" ]+/, "/tests/mock-supabase.js");
    if (file.endsWith(".css")) content = content.replace(/^@import.*$/m, "");
    response.writeHead(200, { "Content-Type": { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[path.extname(file)] + ";charset=utf-8", "Cache-Control": "no-store" });
    response.end(content);
  } catch { response.writeHead(404); response.end(); }
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const chrome = spawn(binary, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--disable-component-update", "--disable-sync", "--disable-extensions", "--remote-debugging-port=0", `--user-data-dir=${path.join(qaDir, `chrome-${Date.now()}`)}`, "about:blank"], { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] });
let ws;
const checks = [];
const errors = [];
try {
  const debugUrl = await new Promise((resolve, reject) => {
    let buffer = "";
    const timeout = setTimeout(() => reject(new Error("Browser startup timeout")), 15000);
    chrome.on("error", reject);
    chrome.on("exit", code => reject(new Error(`Browser exited: ${code}`)));
    chrome.stderr.on("data", chunk => {
      buffer += chunk.toString();
      const match = buffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  const debugOrigin = debugUrl.replace(/^ws:/, "http:").split("/devtools/")[0];
  const target = await (await fetch(`${debugOrigin}/json/new?about:blank`, { method: "PUT" })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener("open", resolve, { once: true }); ws.addEventListener("error", reject, { once: true }); });
  let nextId = 0;
  const pending = new Map();
  ws.addEventListener("message", event => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.exception?.description || message.params.exceptionDetails.text);
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id); clearTimeout(waiter.timeout);
    if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result);
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 12000);
    pending.set(id, { resolve, reject, timeout }); ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label) => {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try { if (await evaluate(expression)) return; } catch {}
      await new Promise(resolve => setTimeout(resolve, 60));
    }
    throw new Error(`Timeout: ${label}`);
  };
  const navigate = async file => { await cdp("Page.navigate", { url: `${base}/${file}` }); };
  const click = async id => evaluate(`document.getElementById(${JSON.stringify(id)}).click()`);
  const fill = async (id, value) => evaluate(`{ const el = document.getElementById(${JSON.stringify(id)}); el.value = ${JSON.stringify(value)}; el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }`);
  const dashboardReady = () => waitFor('document.getElementById("dataContent") && !document.getElementById("dataContent").classList.contains("hidden") && !document.getElementById("refreshBtn").disabled', "dashboard ready");
  const check = async (name, action) => { await action(); checks.push(name); console.log(`PASS: ${name}`); };
  const login = async email => {
    await waitFor('document.getElementById("loginBtn") && !document.getElementById("loginBtn").disabled', "login form");
    await fill("email", email); await fill("password", "test-only-password"); await click("loginBtn"); await dashboardReady();
  };
  await cdp("Page.enable"); await cdp("Runtime.enable");
  await check("missing config produces a visible Thai setup error", async () => {
    await navigate("index.html");
    await waitFor('document.getElementById("loginError")?.textContent.includes("config.js")', "config error");
  });
  configured = true;
  await check("unauthenticated teacher page redirects to login", async () => {
    await navigate("teacher.html");
    await waitFor('location.pathname.endsWith("index.html") && document.getElementById("loginBtn") && !document.getElementById("loginBtn").disabled', "auth redirect");
  });
  await check("invalid login produces Thai credentials error", async () => {
    await fill("email", "teacher@classpulse.demo"); await fill("password", "wrong"); await click("loginBtn");
    await waitFor('document.getElementById("loginError").textContent.includes("ไม่ถูกต้อง")', "invalid login");
    await waitFor('!document.getElementById("loginBtn").disabled', "login unlocked");
  });
  await check("teacher login loads database-derived dashboard counts", async () => {
    await login("teacher@classpulse.demo");
    assert.equal(await evaluate('document.getElementById("totalStudents").textContent'), "2");
    assert.equal(await evaluate('document.getElementById("openTasks").textContent'), "1");
  });
  await check("student search and class filter work", async () => {
    await fill("studentSearch", "DEMO001");
    assert.equal(await evaluate('document.querySelectorAll(".student-card").length'), 1);
    await fill("studentSearch", ""); await fill("classFilter", "ม.2/2");
    assert.equal(await evaluate('document.querySelectorAll(".student-card").length'), 1);
    await fill("classFilter", "all");
  });
  await check("failed write keeps form open, shows error, and shows no success toast", async () => {
    await click("addTaskBtn"); await fill("taskTitle", "QA write failure"); await fill("taskDueDate", "2026-10-21");
    await evaluate('window.__qaFailWrites = true; document.getElementById("toast").textContent = ""; document.getElementById("taskForm").requestSubmit();');
    await waitFor('!document.getElementById("taskError").classList.contains("hidden") && document.getElementById("taskForm").dataset.busy === "false"', "write failure");
    assert.equal(await evaluate('document.getElementById("taskDialog").open'), true);
    assert.equal(await evaluate('document.getElementById("toast").textContent'), "");
    await evaluate('window.__qaFailWrites = false;');
  });
  await check("task creation persists once despite duplicate submission and escapes HTML", async () => {
    await fill("taskTitle", '<img src=x onerror="alert(1)"> QA');
    await evaluate('document.getElementById("taskForm").requestSubmit(); document.getElementById("taskForm").requestSubmit();');
    await waitFor('!document.getElementById("taskDialog").open', "task saved"); await dashboardReady();
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("qa-db")).follow_up_tasks.length'), 3);
    assert.equal(await evaluate('document.querySelectorAll("#taskRows img").length'), 0);
  });
  await check("refresh restores teacher session and saved task", async () => {
    await navigate("teacher.html"); await dashboardReady();
    assert.equal(await evaluate('document.querySelectorAll("#taskRows tr").length'), 3);
  });
  await check("teacher edits status and records an internal note", async () => {
    await evaluate('document.querySelector("[data-task=t1]").click()');
    await click("editTaskBtn"); await fill("taskStatus", "done");
    await evaluate('document.getElementById("taskForm").requestSubmit()');
    await waitFor('!document.getElementById("taskDialog").open', "edit saved"); await dashboardReady();
    assert.equal(await evaluate('document.getElementById("doneTasks").textContent'), "1");
    await fill("noteText", "QA new internal note");
    await evaluate('document.getElementById("noteForm").requestSubmit()');
    await waitFor('document.getElementById("noteList").textContent.includes("QA new internal note") && document.getElementById("noteForm").dataset.busy === "false"', "note saved");
    await evaluate('document.getElementById("detailDialog").close()');
  });
  await check("teacher deletion requires confirmation and removes the task", async () => {
    await evaluate('document.querySelectorAll("[data-task]")[2].click()'); await click("deleteTaskBtn");
    assert.equal(await evaluate('document.getElementById("deleteDialog").open'), true);
    await evaluate('document.getElementById("deleteForm").requestSubmit()');
    await waitFor('!document.getElementById("deleteDialog").open', "delete completed"); await dashboardReady();
    assert.equal(await evaluate('JSON.parse(localStorage.getItem("qa-db")).follow_up_tasks.length'), 2);
  });
  await check("database read failure hides stale statistics and allows retry", async () => {
    await evaluate('window.__qaFailReads = true'); await click("refreshBtn");
    await waitFor('!document.getElementById("pageError").classList.contains("hidden")', "read failure");
    assert.equal(await evaluate('document.getElementById("dataContent").classList.contains("hidden")'), true);
    await evaluate('window.__qaFailReads = false'); await click("refreshBtn"); await dashboardReady();
  });
  await check("teacher layout fits desktop, tablet and mobile viewport", async () => {
    for (const width of [1440, 768, 390]) {
      await cdp("Emulation.setDeviceMetricsOverride", { width, height: 960, deviceScaleFactor: 1, mobile: width < 500 });
      assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), true, `viewport ${width}`);
      const shot = await cdp("Page.captureScreenshot", { format: "png" });
      await writeFile(path.join(qaDir, `teacher-${width}.png`), Buffer.from(shot.data, "base64"));
    }
  });
  await check("logout and student login show no teacher controls", async () => {
    await click("logoutBtn"); await login("student01@classpulse.demo");
    assert.equal(await evaluate('document.getElementById("addTaskBtn")'), null);
    assert.equal(await evaluate('document.getElementById("noteForm")'), null);
    assert.equal(await evaluate('document.querySelectorAll("#taskRows tr").length'), 1);
    await evaluate('document.querySelector("[data-task]").click()');
    assert.equal(await evaluate('document.getElementById("noteList").textContent.includes("INTERNAL_QA_MARKER")'), false);
    assert.match(await evaluate('document.getElementById("noteList").textContent'), /คำแนะนำเปิด/);
    await evaluate('document.getElementById("detailDialog").close()');
  });
  await check("student is routed back from teacher URL and survives refresh", async () => {
    await navigate("teacher.html");
    await waitFor('location.pathname.endsWith("student.html")', "role redirect"); await dashboardReady();
    await navigate("student.html"); await dashboardReady();
    assert.equal(await evaluate('document.getElementById("totalStudents").textContent'), "1");
    const shot = await cdp("Page.captureScreenshot", { format: "png" });
    await writeFile(path.join(qaDir, "student-390.png"), Buffer.from(shot.data, "base64"));
  });
  await check("second student login displays its own fixture", async () => {
    await click("logoutBtn"); await login("student02@classpulse.demo");
    assert.match(await evaluate('document.getElementById("taskRows").textContent'), /ติดตามการเข้าเรียน/);
    assert.doesNotMatch(await evaluate('document.getElementById("taskRows").textContent'), /ติดตามงานค้างส่ง/);
  });
  assert.deepEqual(errors, [], "uncaught JavaScript errors");
  await writeFile(path.join(qaDir, "browser-results.json"), JSON.stringify({ transport: "mock", checks, screenshots: ["teacher-1440.png", "teacher-768.png", "teacher-390.png", "student-390.png"], uncaughtErrors: errors }, null, 2));
  console.log(`Completed ${checks.length} browser checks with MOCK Supabase. Live Auth and RLS remain unverified.`);
} finally {
  ws?.close(); chrome.kill(); await new Promise(resolve => server.close(resolve));
}
