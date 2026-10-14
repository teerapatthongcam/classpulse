-- Create the three Auth users in Dashboard first. Run as administrator, never from the website.
-- Rerunnable: existing tasks/notes are preserved, seed entries are added only once.
begin;
do $$
declare teacher uuid; student01 uuid; student02 uuid; s1 uuid; s2 uuid; task1 uuid;
begin
  select id into teacher from auth.users where lower(email) = 'teacher@classpulse.demo';
  select id into student01 from auth.users where lower(email) = 'student01@classpulse.demo';
  select id into student02 from auth.users where lower(email) = 'student02@classpulse.demo';
  if teacher is null or student01 is null or student02 is null then
    raise exception 'Create all three demo Auth users before seeding';
  end if;
  insert into public.profiles(id, display_name, role) values
    (teacher, 'ครูสาธิต', 'teacher'), (student01, 'นักเรียนตัวอย่าง 01', 'student'), (student02, 'นักเรียนตัวอย่าง 02', 'student')
    on conflict (id) do nothing;
  insert into public.students(user_id, student_code, display_name, class_name) values
    (student01, 'DEMO001', 'นักเรียนตัวอย่าง 01', 'ม.2/1'), (student02, 'DEMO002', 'นักเรียนตัวอย่าง 02', 'ม.2/1')
    on conflict (user_id) do nothing;
  select id into s1 from public.students where user_id = student01;
  select id into s2 from public.students where user_id = student02;
  insert into public.teacher_students values (teacher, s1), (teacher, s2) on conflict do nothing;
  if not exists (select 1 from public.follow_up_tasks where teacher_id = teacher and student_id = s1) then
    insert into public.follow_up_tasks(student_id, teacher_id, title, description, category, priority, status, due_date)
    values (s1, teacher, 'ติดตามงานค้างส่ง', 'เตรียมรายการงานที่ต้องการคำแนะนำมาพูดคุยกับครู', 'การเรียน', 'high', 'pending', current_date + 7) returning id into task1;
    insert into public.follow_up_notes(task_id, teacher_id, note, visibility) values
      (task1, teacher, 'นัดพูดคุยและวางแผนแบ่งงานเป็นขั้นตอน', 'student_visible'),
      (task1, teacher, 'บันทึกภายในสำหรับทดสอบ RLS นักเรียนต้องอ่านไม่ได้', 'internal');
  end if;
  if not exists (select 1 from public.follow_up_tasks where teacher_id = teacher and student_id = s2) then
    insert into public.follow_up_tasks(student_id, teacher_id, title, description, category, priority, status, due_date)
    values (s2, teacher, 'ติดตามการเข้าเรียน', 'ร่วมวางแผนการมาเรียนให้ตรงเวลา', 'การเข้าเรียน', 'medium', 'in_progress', current_date + 3);
  end if;
end $$;
commit;
