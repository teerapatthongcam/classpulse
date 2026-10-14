import { getClient } from "./supabase.js";
import { $, escapeHtml as h, statusText, priorityText, dateText, requireRole, currentProfile, logout, readAll, showError, errorText, busy, toast } from "./app.js";

function dashboardMarkup(teacher, profile) {
  const stats = [["totalStudents", teacher ? "นักเรียนที่ได้รับมอบหมาย" : "รายการติดตามของฉัน", "blue", "♙"], ["openTasks", "ต้องติดตาม", "amber", "◎"], ["inProgressTasks", "กำลังดำเนินการ", "violet", "↻"], ["doneTasks", "ดำเนินการเสร็จ", "green", "✓"]];
  return `<div class="app-shell">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">CP</div><div><strong>ClassPulse</strong><small>STUDENT FOLLOW-UP</small></div></div>
      <div class="nav-label">พื้นที่${teacher ? "ครู" : "นักเรียน"}</div>
      <a class="nav-item active" href="#dashboard"><span>▦</span> ภาพรวม</a>
      <a class="nav-item" href="#followups"><span>☷</span> รายการติดตาม</a>
      ${teacher ? '<a class="nav-item" href="#students"><span>♙</span> นักเรียน</a>' : ""}
      <div class="sidebar-note"><strong>Demo เพื่อการศึกษา</strong><p>ใช้ข้อมูลสมมติ และแสดงเฉพาะข้อมูลที่บัญชีนี้ได้รับอนุญาต</p></div>
      <div class="profile"><div class="avatar">${teacher ? "ค" : "น"}</div><div><strong>${h(profile.display_name)}</strong><small>${teacher ? "ครูผู้ติดตาม" : "นักเรียน"}</small></div></div>
    </aside>
    <main class="main-content" id="dashboard">
      <header class="topbar"><div><div class="eyebrow">${teacher ? "TEACHER WORKSPACE" : "MY LEARNING SUPPORT"}</div><h1>${teacher ? "ภาพรวมการติดตามนักเรียน" : "รายการติดตามของฉัน"}</h1><p class="subtitle">${teacher ? "จัดลำดับงาน นัดหมาย และบันทึกผลการติดตาม" : "ดูนัดหมาย คำแนะนำ และความก้าวหน้าของตัวเอง"}</p></div>
        <div class="top-actions"><button class="btn btn-light" id="refreshBtn">↻ โหลดใหม่</button><button class="btn btn-light" id="logoutBtn">ออกจากระบบ</button></div>
      </header>
      <p id="pageError" class="error-state hidden" role="alert"></p>
      <p id="loadingState" class="loading-state" role="status">กำลังโหลดข้อมูลจากฐานข้อมูล…</p>
      <div id="dataContent" class="hidden">
        <section class="stats-grid" aria-label="สรุปสถานะ">${stats.map(([id, label, color, icon]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${color}">${icon}</span></div><div class="stat-number" id="${id}">—</div><div class="stat-foot">จากข้อมูลที่ได้รับอนุญาตในฐานข้อมูล</div></article>`).join("")}</section>
        <section class="content-grid">
          <div class="panel task-panel" id="followups">
            <div class="panel-heading"><div><h2>${teacher ? "รายการติดตาม" : "งานและนัดหมาย"}</h2><p>รวมรายการปัจจุบันและรายการที่ดำเนินการเสร็จ</p></div>${teacher ? '<button class="btn btn-primary" id="addTaskBtn">＋ เพิ่มรายการ</button>' : ""}</div>
            <div class="toolbar"><label class="search-box"><span>⌕</span><input id="searchInput" type="search" aria-label="ค้นหารายการติดตาม" placeholder="ค้นหาชื่อ รหัส หรือหัวข้อ"></label><select id="statusFilter" aria-label="กรองสถานะ"><option value="all">ทุกสถานะ</option>${Object.entries(statusText).map(([v, text]) => `<option value="${v}">${text}</option>`).join("")}</select></div>
            <div class="table-wrap"><table><thead><tr><th>${teacher ? "นักเรียน / หัวข้อ" : "หัวข้อ"}</th><th>ประเภท</th><th>ความสำคัญ</th><th>กำหนดติดตาม</th><th>สถานะ</th><th>รายละเอียด</th></tr></thead><tbody id="taskRows"></tbody></table></div>
            <div id="emptyState" class="empty-state hidden">ยังไม่มีรายการ หรือไม่พบรายการที่ตรงกับการค้นหา</div>
            <div class="panel-footer"><span id="resultCount"></span>${teacher ? '<button class="text-button" id="exportBtn">↓ ส่งออก JSON</button>' : ""}</div>
          </div>
          <aside class="panel side-panel"><div class="panel-heading"><div><h2>ภาพรวมสถานะ</h2><p>ข้อมูลล่าสุดที่โหลดจาก Supabase</p></div></div>
            ${[["pending", "amber"], ["in_progress", "violet"], ["done", "green"]].map(([status, color]) => `<div class="progress-section"><div class="progress-label"><span>${statusText[status]}</span><strong id="${status}Count">0</strong></div><div class="progress-track"><div class="progress-fill ${color}-fill" id="${status}Bar"></div></div></div>`).join("")}
            <div class="tip-card"><div class="tip-title">✦ ${teacher ? "ติดตามอย่างต่อเนื่อง" : "ก้าวหน้าไปด้วยกัน"}</div><p>${teacher ? "รายละเอียดงานเปิดให้นักเรียนเห็น ส่วนบันทึกภายในใช้พื้นที่หมายเหตุที่เลือกสิทธิ์การมองเห็นได้" : "หน้านี้แสดงเฉพาะรายการของคุณและหมายเหตุที่ครูเปิดให้อ่าน หากต้องการความช่วยเหลือ กรุณาติดต่อครู"}</p></div>
          </aside>
        </section>
        ${teacher ? `<section class="panel students-panel" id="students"><div class="panel-heading"><div><h2>นักเรียนที่ได้รับมอบหมาย</h2><p>ค้นหาและกรองห้องเรียน</p></div><span class="section-count" id="studentCountLabel"></span></div><div class="toolbar"><label class="search-box"><input id="studentSearch" type="search" aria-label="ค้นหานักเรียน" placeholder="ค้นหาชื่อหรือรหัสนักเรียน"></label><select id="classFilter" aria-label="กรองห้องเรียน"><option value="all">ทุกห้องเรียน</option></select></div><div class="student-grid" id="studentGrid"></div><p class="empty-state hidden" id="studentsEmpty">ไม่พบนักเรียนที่ตรงกับการค้นหา</p></section>` : ""}
      </div>
      <footer>ClassPulse Demo · ข้อมูลสมมติเพื่อการศึกษา · บันทึกออนไลน์</footer>
    </main>
  </div>
  <dialog id="detailDialog"><div class="dialog-body"><div class="dialog-head"><h2 id="detailTitle"></h2><button type="button" class="icon-close" data-close="detailDialog" aria-label="ปิด">×</button></div><div id="detailContent"></div><p id="detailError" class="error-state hidden" role="alert"></p>${teacher ? '<div class="detail-actions"><button class="btn btn-primary" id="editTaskBtn">แก้ไขรายการ</button><button class="btn btn-danger" id="deleteTaskBtn">ลบรายการ</button></div>' : ""}<h3>ประวัติและหมายเหตุ</h3><div id="noteList"></div>${teacher ? `<form id="noteForm" class="standard-form"><label for="noteText">ผลการติดตาม / หมายเหตุ</label><textarea id="noteText" rows="3" required maxlength="4000"></textarea><label for="noteVisibility">ผู้ที่มองเห็น</label><select id="noteVisibility"><option value="internal">ภายใน — เฉพาะครูผู้ติดตาม</option><option value="student_visible">นักเรียนอ่านได้</option></select><button class="btn btn-primary" type="submit">บันทึกหมายเหตุ</button></form>` : ""}</div></dialog>
  ${teacher ? `<dialog id="taskDialog"><form id="taskForm" class="standard-form"><div class="dialog-head"><h2 id="taskFormTitle">เพิ่มรายการติดตาม</h2><button type="button" class="icon-close" data-close="taskDialog" aria-label="ปิด">×</button></div><p id="taskError" class="error-state hidden" role="alert"></p><label for="studentSelect">นักเรียน</label><select id="studentSelect" required></select><label for="taskTitle">หัวข้อ</label><input id="taskTitle" required maxlength="100"><div class="form-row"><div><label for="taskCategory">ประเภท</label><select id="taskCategory"><option>การเรียน</option><option>การเข้าเรียน</option><option>พฤติกรรม</option><option>ทั่วไป</option></select></div><div><label for="taskPriority">ความสำคัญ</label><select id="taskPriority"><option value="medium">ปานกลาง</option><option value="high">สูง</option><option value="low">ต่ำ</option></select></div></div><div class="form-row"><div><label for="taskDueDate">วันกำหนดติดตาม</label><input id="taskDueDate" type="date" required min="2000-01-01" max="2100-12-31"></div><div><label for="taskStatus">สถานะ</label><select id="taskStatus">${Object.entries(statusText).map(([v, text]) => `<option value="${v}">${text}</option>`).join("")}</select></div></div><label for="taskDescription">รายละเอียด / คำแนะนำ (นักเรียนอ่านได้)</label><textarea id="taskDescription" rows="3" maxlength="4000"></textarea><div class="dialog-actions"><button type="button" class="btn btn-light" data-close="taskDialog">ยกเลิก</button><button type="submit" class="btn btn-primary">บันทึกรายการ</button></div></form></dialog>
    <dialog id="deleteDialog"><form id="deleteForm" class="standard-form"><h2>ยืนยันการลบ</h2><p id="deleteMessage"></p><p id="deleteError" class="error-state hidden" role="alert"></p><div class="dialog-actions"><button type="button" class="btn btn-light" data-close="deleteDialog">ยกเลิก</button><button type="submit" class="btn btn-danger">ยืนยันลบ</button></div></form></dialog>` : ""}
  <div id="toast" class="toast" role="status" aria-live="polite"></div>`;
}

export async function startDashboard(role) {
  const teacher = role === "teacher";
  let profile;
  try { profile = await requireRole(role); }
  catch (error) {
    $("dashboardRoot").innerHTML = `<main class="panel startup-error"><h1>ไม่สามารถเปิดระบบได้</h1><p class="error-state">${h(errorText(error))}</p><a href="index.html">กลับหน้าเข้าสู่ระบบ</a><button class="btn btn-light" id="startupLogout">ออกจากบัญชีนี้</button><p id="startupError" class="error-state hidden" role="alert"></p></main>`;
    $("startupLogout").addEventListener("click", () => logout($("startupLogout"), "startupError"));
    return;
  }
  if (!profile) return;
  $("dashboardRoot").innerHTML = dashboardMarkup(teacher, profile);
  const db = getClient();
  let state = { students: [], tasks: [], notes: [] };
  let selectedTaskId = null;
  let editingTask = null;
  let pendingDelete = null;
  let writing = false;
  let loading = false;
  const studentFor = task => state.students.find(s => s.id === task.student_id);
  const selectedTask = () => state.tasks.find(t => t.id === selectedTaskId);

  function renderTasks() {
    const query = $("searchInput").value.trim().toLowerCase();
    const status = $("statusFilter").value;
    const rows = state.tasks.filter(task => {
      const student = studentFor(task);
      return (status === "all" || task.status === status) && `${student?.display_name || ""} ${student?.student_code || ""} ${task.title} ${task.category} ${task.description}`.toLowerCase().includes(query);
    });
    $("taskRows").innerHTML = rows.map(task => {
      const student = studentFor(task);
      return `<tr><td><div class="person-name">${h(teacher ? student?.display_name || "นักเรียน" : task.title)}</div><div class="person-sub">${h(teacher ? task.title : "สร้างเมื่อ " + dateText(task.created_at, true))}</div></td><td>${h(task.category)}</td><td><span class="priority-${h(task.priority)}">● ${h(priorityText[task.priority])}</span></td><td>${h(dateText(task.due_date))}</td><td><span class="pill status-${h(task.status)}">${h(statusText[task.status])}</span></td><td><button class="mini-btn" data-task="${h(task.id)}">ดูรายละเอียด</button></td></tr>`;
    }).join("");
    $("emptyState").classList.toggle("hidden", rows.length > 0);
    $("resultCount").textContent = `แสดง ${rows.length} จาก ${state.tasks.length} รายการ`;
  }
  function renderStudents() {
    if (!teacher) return;
    const query = $("studentSearch").value.trim().toLowerCase();
    const className = $("classFilter").value;
    const students = state.students.filter(s => `${s.display_name} ${s.student_code}`.toLowerCase().includes(query) && (className === "all" || s.class_name === className));
    $("studentGrid").innerHTML = students.map(s => `<div class="student-card"><div class="person-avatar">♙</div><div><strong>${h(s.display_name)}</strong><small>${h(s.student_code)} · ${h(s.class_name)}</small></div></div>`).join("");
    $("studentCountLabel").textContent = `${students.length} / ${state.students.length} คน`;
    $("studentsEmpty").classList.toggle("hidden", students.length > 0);
  }
  function render() {
    $("totalStudents").textContent = teacher ? state.students.length : state.tasks.length;
    const ids = { pending: "openTasks", in_progress: "inProgressTasks", done: "doneTasks" };
    for (const status of Object.keys(statusText)) {
      const count = state.tasks.filter(t => t.status === status).length;
      $(ids[status]).textContent = count;
      $(`${status}Count`).textContent = count;
      $(`${status}Bar`).style.width = `${count / Math.max(state.tasks.length, 1) * 100}%`;
    }
    if (teacher) {
      const previousClass = $("classFilter").value;
      $("classFilter").innerHTML = '<option value="all">ทุกห้องเรียน</option>' + [...new Set(state.students.map(s => s.class_name))].sort().map(c => `<option value="${h(c)}">${h(c)}</option>`).join("");
      $("classFilter").value = [...$("classFilter").options].some(o => o.value === previousClass) ? previousClass : "all";
      $("studentSelect").innerHTML = state.students.map(s => `<option value="${h(s.id)}">${h(s.display_name)} (${h(s.student_code)})</option>`).join("");
      $("addTaskBtn").disabled = state.students.length === 0;
      renderStudents();
    }
    renderTasks();
    if ($("detailDialog").open) {
      if (selectedTask()) renderDetail();
      else $("detailDialog").close();
    }
  }
  function renderDetail() {
    const task = selectedTask();
    if (!task) return;
    $("detailTitle").textContent = task.title;
    $("detailContent").innerHTML = `<p><strong>${h(studentFor(task)?.display_name || "")}</strong></p><p><span class="pill status-${h(task.status)}">${h(statusText[task.status])}</span> · ${h(task.category)} · ความสำคัญ${h(priorityText[task.priority])}</p><p>กำหนดติดตาม: <strong>${h(dateText(task.due_date))}</strong></p><p class="preserve-lines">${h(task.description || "ไม่มีรายละเอียดเพิ่มเติม")}</p><p class="person-sub">สร้าง ${h(dateText(task.created_at, true))}<br>อัปเดต ${h(dateText(task.updated_at, true))}</p>`;
    const notes = state.notes.filter(n => n.task_id === task.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
    $("noteList").innerHTML = notes.length ? notes.map(n => `<article class="note-card"><div class="note-meta">${h(dateText(n.created_at, true))}${teacher ? ` · ${n.visibility === "internal" ? "ภายใน — เฉพาะครู" : "นักเรียนอ่านได้"}` : ""}</div><p class="preserve-lines">${h(n.note)}</p>${teacher ? `<button class="text-button danger-text" data-delete-note="${h(n.id)}">ลบหมายเหตุนี้</button>` : ""}</article>`).join("") : '<p class="empty-state">ยังไม่มีหมายเหตุที่เปิดให้อ่าน</p>';
  }
  async function load() {
    if (loading) return false;
    loading = true;
    $("refreshBtn").disabled = true;
    $("pageError").classList.add("hidden");
    $("loadingState").classList.remove("hidden");
    $("dataContent").classList.add("hidden");
    try {
      const verified = await currentProfile();
      if (!verified) { location.replace("index.html"); return false; }
      if (verified.id !== profile.id || verified.role !== role) { location.replace("index.html"); return false; }
      const [students, tasks, notes] = await Promise.all([
        readAll("students", "id, student_code, display_name, class_name"),
        readAll("follow_up_tasks", "id, student_id, teacher_id, title, description, category, priority, status, due_date, created_at, updated_at"),
        readAll("follow_up_notes", "id, task_id, teacher_id, note, visibility, created_at")
      ]);
      tasks.sort((a, b) => a.due_date.localeCompare(b.due_date) || b.created_at.localeCompare(a.created_at));
      state = { students, tasks, notes };
      render();
      $("dataContent").classList.remove("hidden");
      return true;
    } catch (error) {
      state = { students: [], tasks: [], notes: [] };
      $("detailDialog").close();
      showError("pageError", error);
      return false;
    } finally {
      loading = false;
      $("refreshBtn").disabled = false;
      $("loadingState").classList.add("hidden");
    }
  }
  // Once the write is acknowledged, a failed reload must not suggest resubmitting it.
  async function committed(message) {
    const loaded = await load();
    toast(loaded ? message : `${message} แต่โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่`);
  }
  document.querySelectorAll("[data-close]").forEach(button => button.addEventListener("click", () => {
    if (!writing) $(button.dataset.close).close();
  }));
  document.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("cancel", event => { if (writing) event.preventDefault(); }));
  $("logoutBtn").addEventListener("click", () => { if (!writing && !loading) logout($("logoutBtn"), "pageError"); });
  $("refreshBtn").addEventListener("click", () => { if (!writing) load(); });
  $("searchInput").addEventListener("input", renderTasks);
  $("statusFilter").addEventListener("change", renderTasks);
  $("taskRows").addEventListener("click", event => {
    const button = event.target.closest("[data-task]");
    if (!button || loading || writing) return;
    selectedTaskId = button.dataset.task;
    $("detailError").classList.add("hidden");
    if (teacher) $("noteForm").reset();
    renderDetail();
    $("detailDialog").showModal();
  });

  if (teacher) {
    function openTaskForm(task = null) {
      editingTask = task ? { ...task } : null;
      $("taskForm").reset();
      $("taskError").classList.add("hidden");
      $("taskFormTitle").textContent = task ? "แก้ไขรายการติดตาม" : "เพิ่มรายการติดตาม";
      $("studentSelect").disabled = !!task;
      if (task) {
        $("studentSelect").value = task.student_id;
        $("taskTitle").value = task.title;
        $("taskCategory").value = task.category;
        $("taskPriority").value = task.priority;
        $("taskDueDate").value = task.due_date;
        $("taskStatus").value = task.status;
        $("taskDescription").value = task.description;
      }
      $("taskDialog").showModal();
    }
    $("studentSearch").addEventListener("input", renderStudents);
    $("classFilter").addEventListener("change", renderStudents);
    $("addTaskBtn").addEventListener("click", () => openTaskForm());
    $("editTaskBtn").addEventListener("click", () => { if (!writing && selectedTask()) openTaskForm(selectedTask()); });
    $("taskTitle").addEventListener("input", () => $("taskTitle").setCustomValidity(""));
    $("taskForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (writing || loading) return;
      $("taskTitle").setCustomValidity($("taskTitle").value.trim() ? "" : "กรุณาระบุหัวข้อ");
      if (!event.currentTarget.reportValidity()) return;
      const payload = { title: $("taskTitle").value.trim(), description: $("taskDescription").value.trim(), category: $("taskCategory").value, priority: $("taskPriority").value, status: $("taskStatus").value, due_date: $("taskDueDate").value };
      if (!editingTask) Object.assign(payload, { student_id: $("studentSelect").value, teacher_id: profile.id });
      $("taskError").classList.add("hidden");
      writing = true;
      await busy(event.currentTarget, async () => {
        try {
          const query = editingTask ? db.from("follow_up_tasks").update(payload).eq("id", editingTask.id).eq("updated_at", editingTask.updated_at) : db.from("follow_up_tasks").insert(payload);
          const { data, error } = await query.select("id").single();
          if (error) throw error.code === "PGRST116" ? { code: "NO_ROW" } : error;
          if (!data) throw { code: "NO_ROW" };
          $("taskDialog").close();
          await committed("บันทึกรายการแล้ว");
        } catch (error) { showError("taskError", error); }
        finally { writing = false; }
      });
    });
    $("noteText").addEventListener("input", () => $("noteText").setCustomValidity(""));
    $("noteForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (writing || loading || !selectedTask()) return;
      $("noteText").setCustomValidity($("noteText").value.trim() ? "" : "กรุณาระบุหมายเหตุ");
      if (!event.currentTarget.reportValidity()) return;
      const payload = { task_id: selectedTaskId, teacher_id: profile.id, note: $("noteText").value.trim(), visibility: $("noteVisibility").value };
      $("detailError").classList.add("hidden");
      writing = true;
      await busy(event.currentTarget, async () => {
        try {
          const { error } = await db.from("follow_up_notes").insert(payload).select("id").single();
          if (error) throw error;
          $("noteForm").reset();
          await committed("บันทึกหมายเหตุแล้ว");
        } catch (error) { showError("detailError", error); }
        finally { writing = false; }
      });
    });
    function confirmDelete(table, row) {
      if (writing || loading || !row) return;
      pendingDelete = { table, row };
      $("deleteMessage").textContent = table === "follow_up_tasks" ? `ลบ “${row.title}” และหมายเหตุทั้งหมดของรายการนี้? การลบไม่สามารถย้อนกลับได้` : "ลบหมายเหตุนี้? การลบไม่สามารถย้อนกลับได้";
      $("deleteError").classList.add("hidden");
      $("deleteDialog").showModal();
    }
    $("deleteTaskBtn").addEventListener("click", () => confirmDelete("follow_up_tasks", selectedTask()));
    $("noteList").addEventListener("click", event => {
      const button = event.target.closest("[data-delete-note]");
      if (button) confirmDelete("follow_up_notes", state.notes.find(n => n.id === button.dataset.deleteNote));
    });
    $("deleteForm").addEventListener("submit", async event => {
      event.preventDefault();
      if (writing || loading || !pendingDelete) return;
      writing = true;
      await busy(event.currentTarget, async () => {
        try {
          let query = db.from(pendingDelete.table).delete().eq("id", pendingDelete.row.id);
          if (pendingDelete.table === "follow_up_tasks") query = query.eq("updated_at", pendingDelete.row.updated_at);
          const { data, error } = await query.select("id").single();
          if (error) throw error.code === "PGRST116" ? { code: "NO_ROW" } : error;
          if (!data) throw { code: "NO_ROW" };
          $("deleteDialog").close();
          if (pendingDelete.table === "follow_up_tasks") $("detailDialog").close();
          pendingDelete = null;
          await committed("ลบข้อมูลแล้ว");
        } catch (error) { showError("deleteError", error); }
        finally { writing = false; }
      });
    });
    $("exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "classpulse-export.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("ส่งออกข้อมูลที่บัญชีนี้ได้รับอนุญาตแล้ว");
    });
  }
  window.addEventListener("pageshow", event => { if (event.persisted) location.reload(); });
  await load();
}
