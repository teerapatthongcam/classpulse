// Browser QA fixture only. Not deployed. This mocks transport, NOT a proof of RLS.
(() => {
  const profiles = {
    "teacher@classpulse.demo": { id: "teacher-id", role: "teacher", display_name: "ครูสาธิต" },
    "student01@classpulse.demo": { id: "student-1", role: "student", display_name: "นักเรียนตัวอย่าง 01" },
    "student02@classpulse.demo": { id: "student-2", role: "student", display_name: "นักเรียนตัวอย่าง 02" }
  };
  const initial = {
    students: [{ id: "s1", user_id: "student-1", display_name: "นักเรียนตัวอย่าง 01", student_code: "DEMO001", class_name: "ม.2/1" }, { id: "s2", user_id: "student-2", display_name: "นักเรียนตัวอย่าง 02", student_code: "DEMO002", class_name: "ม.2/2" }],
    follow_up_tasks: [{ id: "t1", student_id: "s1", teacher_id: "teacher-id", title: "ติดตามงานค้างส่ง", description: "คำแนะนำตัวอย่าง", category: "การเรียน", priority: "high", status: "pending", due_date: "2026-10-20", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }, { id: "t2", student_id: "s2", teacher_id: "teacher-id", title: "ติดตามการเข้าเรียน", description: "คำแนะนำคนที่สอง", category: "การเข้าเรียน", priority: "medium", status: "in_progress", due_date: "2026-10-19", created_at: "2026-10-01T00:00:00Z", updated_at: "2026-10-01T00:00:00Z" }],
    follow_up_notes: [{ id: "n1", task_id: "t1", teacher_id: "teacher-id", note: "INTERNAL_QA_MARKER", visibility: "internal", created_at: "2026-10-02T00:00:00Z" }, { id: "n2", task_id: "t1", teacher_id: "teacher-id", note: "คำแนะนำเปิดให้นักเรียนอ่าน", visibility: "student_visible", created_at: "2026-10-03T00:00:00Z" }]
  };
  const load = () => JSON.parse(localStorage.getItem("qa-db") || JSON.stringify(initial));
  const profile = () => profiles[localStorage.getItem("qa-user")];
  const listeners = [];
  class Query {
    constructor(table) { this.table = table; this.operation = "read"; this.filters = []; }
    select() { return this; }
    order() { return this; }
    range(from, to) { this.slice = [from, to]; return this; }
    eq(key, value) { this.filters.push([key, value]); return this; }
    insert(payload) { this.operation = "insert"; this.payload = payload; return this; }
    update(payload) { this.operation = "update"; this.payload = payload; return this; }
    delete() { this.operation = "delete"; return this; }
    single() { this.one = true; return this; }
    then(resolve, reject) { return this.run().then(resolve, reject); }
    async run() {
      await new Promise(resolve => setTimeout(resolve, 40));
      if ((this.operation === "read" && window.__qaFailReads) || (this.operation !== "read" && window.__qaFailWrites)) return { data: null, error: { message: "QA simulated database unavailable" } };
      const p = profile();
      if (!p) return { data: null, error: { code: "42501" } };
      const data = load();
      let all = this.table === "profiles" ? [p] : data[this.table];
      if (p.role === "student") {
        const ownIds = data.students.filter(s => s.user_id === p.id).map(s => s.id);
        const taskIds = data.follow_up_tasks.filter(t => ownIds.includes(t.student_id)).map(t => t.id);
        if (this.table === "students") all = all.filter(s => ownIds.includes(s.id));
        if (this.table === "follow_up_tasks") all = all.filter(t => taskIds.includes(t.id));
        if (this.table === "follow_up_notes") all = all.filter(n => taskIds.includes(n.task_id) && n.visibility === "student_visible");
      }
      let matches = all.filter(row => this.filters.every(([key, value]) => row[key] === value));
      if (this.operation !== "read") {
        if (p.role !== "teacher") return { data: null, error: { code: "42501" } };
        if (this.operation === "insert") {
          const row = { id: crypto.randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...this.payload };
          all.push(row); matches = [row];
        }
        if (this.operation === "update") matches.forEach(row => Object.assign(row, this.payload, { updated_at: new Date().toISOString() }));
        if (this.operation === "delete") {
          data[this.table] = all.filter(row => !matches.includes(row));
          if (this.table === "follow_up_tasks") data.follow_up_notes = data.follow_up_notes.filter(n => !matches.some(t => t.id === n.task_id));
        }
        localStorage.setItem("qa-db", JSON.stringify(data));
      }
      if (this.slice) matches = matches.slice(this.slice[0], this.slice[1] + 1);
      if (this.one && matches.length !== 1) return { data: null, error: { code: "PGRST116" } };
      return { data: this.one ? matches[0] : matches, error: null };
    }
  }
  window.supabase = { createClient: () => ({
    from: table => new Query(table),
    auth: {
      async getUser() { const p = profile(); return { data: { user: p ? { id: p.id } : null }, error: p ? null : { name: "AuthSessionMissingError" } }; },
      async signInWithPassword({ email, password }) {
        if (!profiles[email] || password !== "test-only-password") return { error: { code: "invalid_credentials" } };
        localStorage.setItem("qa-user", email); return { error: null };
      },
      async signOut() { localStorage.removeItem("qa-user"); listeners.forEach(fn => fn("SIGNED_OUT", null)); return { error: null }; },
      onAuthStateChange(fn) { listeners.push(fn); return { data: { subscription: { unsubscribe() {} } } }; }
    }
  }) };
})();
