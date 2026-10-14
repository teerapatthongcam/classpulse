-- Run once in the SQL Editor of a NEW Supabase project, as administrator.
begin;
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(trim(display_name)) between 1 and 100),
  role text not null check (role in ('teacher', 'student')),
  created_at timestamptz not null default now()
);
create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique not null references public.profiles(id) on delete cascade,
  student_code text unique not null,
  display_name text not null,
  class_name text not null,
  created_at timestamptz not null default now()
);
create table public.teacher_students (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  primary key (teacher_id, student_id)
);
create table public.follow_up_tasks (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  title text not null check (length(trim(title)) between 1 and 100),
  description text not null default '' check (length(description) <= 4000),
  category text not null check (category in ('การเรียน', 'การเข้าเรียน', 'พฤติกรรม', 'ทั่วไป')),
  priority text not null check (priority in ('high', 'medium', 'low')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done')),
  due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (teacher_id, student_id) references public.teacher_students(teacher_id, student_id) on delete cascade
);
create table public.follow_up_notes (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.follow_up_tasks(id) on delete cascade,
  teacher_id uuid not null references public.profiles(id),
  note text not null check (length(trim(note)) between 1 and 4000),
  visibility text not null check (visibility in ('internal', 'student_visible')),
  created_at timestamptz not null default now()
);
create index teacher_students_student_idx on public.teacher_students(student_id);
create index tasks_teacher_due_idx on public.follow_up_tasks(teacher_id, due_date);
create index tasks_student_idx on public.follow_up_tasks(student_id);
create index notes_task_created_idx on public.follow_up_notes(task_id, created_at);
create index notes_teacher_idx on public.follow_up_notes(teacher_id);

create function public.touch_task() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.teacher_id <> old.teacher_id or new.student_id <> old.student_id then
    raise exception 'Task ownership cannot be changed';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
create trigger task_updated before update on public.follow_up_tasks for each row execute function public.touch_task();

alter table public.profiles enable row level security;
alter table public.students enable row level security;
alter table public.teacher_students enable row level security;
alter table public.follow_up_tasks enable row level security;
alter table public.follow_up_notes enable row level security;
revoke all on public.profiles, public.students, public.teacher_students, public.follow_up_tasks, public.follow_up_notes from anon, authenticated;
grant select on public.profiles, public.students, public.teacher_students to authenticated;
grant select, insert, update, delete on public.follow_up_tasks, public.follow_up_notes to authenticated;
grant all on public.profiles, public.students, public.teacher_students, public.follow_up_tasks, public.follow_up_notes to service_role;
-- No client write policies for profiles, students or assignments. No auth metadata role is trusted.
create policy profile_self_read on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy assignment_teacher_read on public.teacher_students for select to authenticated using (
  teacher_id = (select auth.uid()) and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
);
create policy student_authorized_read on public.students for select to authenticated using (
  (user_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'student'))
  or exists (select 1 from public.teacher_students a where a.student_id = students.id and a.teacher_id = auth.uid())
);
create policy task_authorized_read on public.follow_up_tasks for select to authenticated using (
  (teacher_id = auth.uid() and exists (select 1 from public.teacher_students a where a.teacher_id = auth.uid() and a.student_id = follow_up_tasks.student_id))
  or exists (select 1 from public.students s join public.profiles p on p.id = s.user_id where s.id = follow_up_tasks.student_id and s.user_id = auth.uid() and p.role = 'student')
);
create policy task_teacher_insert on public.follow_up_tasks for insert to authenticated with check (
  teacher_id = auth.uid() and exists (select 1 from public.teacher_students a where a.teacher_id = auth.uid() and a.student_id = follow_up_tasks.student_id)
);
create policy task_teacher_update on public.follow_up_tasks for update to authenticated using (
  teacher_id = auth.uid() and exists (select 1 from public.teacher_students a where a.teacher_id = auth.uid() and a.student_id = follow_up_tasks.student_id)
) with check (
  teacher_id = auth.uid() and exists (select 1 from public.teacher_students a where a.teacher_id = auth.uid() and a.student_id = follow_up_tasks.student_id)
);
create policy task_teacher_delete on public.follow_up_tasks for delete to authenticated using (
  teacher_id = auth.uid() and exists (select 1 from public.teacher_students a where a.teacher_id = auth.uid() and a.student_id = follow_up_tasks.student_id)
);
create policy note_authorized_read on public.follow_up_notes for select to authenticated using (
  exists (select 1 from public.follow_up_tasks t where t.id = follow_up_notes.task_id and (
    (t.teacher_id = auth.uid() and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher'))
    or (follow_up_notes.visibility = 'student_visible' and exists (select 1 from public.students s where s.id = t.student_id and s.user_id = auth.uid()))
  ))
);
create policy note_teacher_insert on public.follow_up_notes for insert to authenticated with check (
  teacher_id = auth.uid() and exists (select 1 from public.follow_up_tasks t where t.id = follow_up_notes.task_id and t.teacher_id = auth.uid()
    and exists (select 1 from public.teacher_students a where a.teacher_id = auth.uid() and a.student_id = t.student_id))
);
-- Notes are append-only to preserve history; teachers can remove their own erroneous notes.
revoke update on public.follow_up_notes from authenticated;
create policy note_teacher_delete on public.follow_up_notes for delete to authenticated using (
  teacher_id = auth.uid() and exists (select 1 from public.follow_up_tasks t where t.id = follow_up_notes.task_id and t.teacher_id = auth.uid()
    and exists (select 1 from public.teacher_students a where a.teacher_id = auth.uid() and a.student_id = t.student_id))
);
commit;
