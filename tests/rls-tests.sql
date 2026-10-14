-- Run the WHOLE file in Supabase SQL Editor after schema + demo seed.
-- All fixtures and test writes are rolled back. Failure raises an exception.
begin;
create function pg_temp.assert_true(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is distinct from true then raise exception 'FAIL: %', label; end if;
  raise notice 'PASS: %', label;
end $$;
create function pg_temp.expect_denied(statement text, label text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege then
    raise notice 'PASS: %', label;
    return;
  end;
  raise exception 'FAIL (operation was allowed): %', label;
end $$;
select set_config('test.teacher', (select id::text from public.profiles where id = (select id from auth.users where email = 'teacher@classpulse.demo')), true);
select set_config('test.student1', (select id::text from auth.users where email = 'student01@classpulse.demo'), true);
select set_config('test.student2', (select id::text from auth.users where email = 'student02@classpulse.demo'), true);
select set_config('test.s1', (select id::text from public.students where user_id = current_setting('test.student1')::uuid), true);
select set_config('test.s2', (select id::text from public.students where user_id = current_setting('test.student2')::uuid), true);
select pg_temp.assert_true(current_setting('test.teacher', true) <> '' and current_setting('test.s1', true) <> '' and current_setting('test.s2', true) <> '', 'demo seed exists');
select set_config('test.task1', gen_random_uuid()::text, true);
select set_config('test.task2', gen_random_uuid()::text, true);
select set_config('test.internal', gen_random_uuid()::text, true);
select set_config('test.visible', gen_random_uuid()::text, true);
select set_config('test.otherteacher', gen_random_uuid()::text, true);
select set_config('test.othertask', gen_random_uuid()::text, true);
-- An additional teacher fixture ensures ownership isolation even with the same assigned student.
insert into auth.users(id, email) values (current_setting('test.otherteacher')::uuid, 'rls-fixture@classpulse.demo');
insert into public.profiles(id, display_name, role) values (current_setting('test.otherteacher')::uuid, 'ครูทดสอบ RLS', 'teacher');
insert into public.teacher_students(teacher_id, student_id) values (current_setting('test.otherteacher')::uuid, current_setting('test.s1')::uuid);
insert into public.follow_up_tasks(id, student_id, teacher_id, title, category, priority, due_date) values
  (current_setting('test.task1')::uuid, current_setting('test.s1')::uuid, current_setting('test.teacher')::uuid, 'RLS student 1', 'ทั่วไป', 'medium', current_date),
  (current_setting('test.task2')::uuid, current_setting('test.s2')::uuid, current_setting('test.teacher')::uuid, 'RLS student 2', 'ทั่วไป', 'medium', current_date),
  (current_setting('test.othertask')::uuid, current_setting('test.s1')::uuid, current_setting('test.otherteacher')::uuid, 'RLS other teacher', 'ทั่วไป', 'medium', current_date);
insert into public.follow_up_notes(id, task_id, teacher_id, note, visibility) values
  (current_setting('test.internal')::uuid, current_setting('test.task1')::uuid, current_setting('test.teacher')::uuid, 'Internal fixture', 'internal'),
  (current_setting('test.visible')::uuid, current_setting('test.task1')::uuid, current_setting('test.teacher')::uuid, 'Visible fixture', 'student_visible');

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('test.teacher'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.teacher'), 'role', 'authenticated')::text, true);
select pg_temp.assert_true((select count(*) = 2 from public.students where id in (current_setting('test.s1')::uuid, current_setting('test.s2')::uuid)), 'teacher sees assigned students');
select pg_temp.assert_true((select count(*) = 0 from public.follow_up_tasks where id = current_setting('test.othertask')::uuid), 'teacher cannot read another teacher task');
with changed as (update public.follow_up_tasks set status = 'done' where id = current_setting('test.task1')::uuid returning id)
select pg_temp.assert_true((select count(*) = 1 from changed), 'teacher updates own task');
with changed as (update public.follow_up_tasks set status = 'done' where id = current_setting('test.othertask')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'teacher cannot update another teacher task');
with removed as (delete from public.follow_up_tasks where id = current_setting('test.othertask')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from removed), 'teacher cannot delete another teacher task');
select pg_temp.expect_denied(format('insert into public.follow_up_tasks(student_id, teacher_id, title, category, priority, due_date) values (%L, %L, ''forged'', ''ทั่วไป'', ''low'', current_date)', current_setting('test.s1'), current_setting('test.otherteacher')), 'teacher cannot forge ownership');
select pg_temp.assert_true((select count(*) = 2 from public.follow_up_notes where task_id = current_setting('test.task1')::uuid), 'teacher sees both note visibilities');
with inserted as (insert into public.follow_up_tasks(student_id, teacher_id, title, category, priority, due_date) values (current_setting('test.s2')::uuid, auth.uid(), 'Insert fixture', 'ทั่วไป', 'low', current_date) returning id)
select pg_temp.assert_true((select count(*) = 1 from inserted), 'teacher creates an assigned task');
with inserted as (insert into public.follow_up_notes(task_id, teacher_id, note, visibility) values (current_setting('test.task1')::uuid, auth.uid(), 'Added fixture', 'internal') returning id)
select pg_temp.assert_true((select count(*) = 1 from inserted), 'teacher adds note');

select set_config('request.jwt.claim.sub', current_setting('test.student1'), true);
-- A forged user_metadata role must have no effect.
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.student1'), 'role', 'authenticated', 'user_metadata', json_build_object('role', 'teacher'))::text, true);
select pg_temp.assert_true((select count(*) = 1 from public.students), 'student sees only own student record');
select pg_temp.assert_true((select count(*) = 0 from public.students where id = current_setting('test.s2')::uuid), 'student cannot query another student ID');
select pg_temp.assert_true((select count(*) = 0 from public.follow_up_tasks where id = current_setting('test.task2')::uuid), 'student cannot query another task ID');
select pg_temp.assert_true((select count(*) = 1 from public.follow_up_tasks where id = current_setting('test.task1')::uuid), 'student sees own task');
select pg_temp.assert_true((select count(*) = 0 from public.follow_up_notes where id = current_setting('test.internal')::uuid), 'internal note never reaches student');
select pg_temp.assert_true((select count(*) = 1 from public.follow_up_notes where id = current_setting('test.visible')::uuid), 'student reads visible note');
select pg_temp.assert_true((select count(*) = 0 from public.teacher_students), 'student cannot read assignments');
select pg_temp.expect_denied(format('update public.profiles set role = ''teacher'' where id = %L', current_setting('test.student1')), 'student cannot promote own role');
select pg_temp.expect_denied(format('insert into public.profiles(id, display_name, role) values (%L, ''forged'', ''teacher'')', current_setting('test.student1')), 'student cannot create teacher profile');
select pg_temp.expect_denied(format('insert into public.teacher_students(teacher_id, student_id) values (%L, %L)', current_setting('test.student1'), current_setting('test.s2')), 'student cannot assign self');
select pg_temp.expect_denied(format('insert into public.follow_up_tasks(student_id, teacher_id, title, category, priority, due_date) values (%L, %L, ''forged'', ''ทั่วไป'', ''low'', current_date)', current_setting('test.s1'), current_setting('test.teacher')), 'student cannot insert task');
with changed as (update public.follow_up_tasks set status = 'done' where id = current_setting('test.task1')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from changed), 'student cannot update own task');
with removed as (delete from public.follow_up_tasks where id = current_setting('test.task1')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from removed), 'student cannot delete own task');
select pg_temp.expect_denied(format('insert into public.follow_up_notes(task_id, teacher_id, note, visibility) values (%L, %L, ''forged'', ''student_visible'')', current_setting('test.task1'), current_setting('test.teacher')), 'student cannot add note');
select pg_temp.expect_denied(format('update public.follow_up_notes set note = ''forged'' where id = %L', current_setting('test.visible')), 'student cannot edit note');
with removed as (delete from public.follow_up_notes where id = current_setting('test.visible')::uuid returning id)
select pg_temp.assert_true((select count(*) = 0 from removed), 'student cannot delete visible note');

select set_config('request.jwt.claim.sub', current_setting('test.student2'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.student2'), 'role', 'authenticated')::text, true);
select pg_temp.assert_true((select count(*) = 1 from public.follow_up_tasks where id = current_setting('test.task2')::uuid), 'second student sees own task');
select pg_temp.assert_true((select count(*) = 0 from public.follow_up_tasks where id = current_setting('test.task1')::uuid), 'second student cannot read first student task');

select set_config('request.jwt.claim.sub', current_setting('test.otherteacher'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.otherteacher'), 'role', 'authenticated')::text, true);
select pg_temp.assert_true((select count(*) = 0 from public.students where id = current_setting('test.s2')::uuid), 'teacher cannot read unassigned student');
select pg_temp.expect_denied(format('insert into public.follow_up_tasks(student_id, teacher_id, title, category, priority, due_date) values (%L, %L, ''forged'', ''ทั่วไป'', ''low'', current_date)', current_setting('test.s2'), current_setting('test.otherteacher')), 'teacher cannot insert for unassigned student');
select pg_temp.assert_true((select count(*) = 0 from public.follow_up_notes where task_id = current_setting('test.task1')::uuid), 'other teacher cannot read task notes');
select pg_temp.expect_denied(format('insert into public.follow_up_notes(task_id, teacher_id, note, visibility) values (%L, %L, ''forged'', ''internal'')', current_setting('test.task1'), current_setting('test.otherteacher')), 'teacher cannot add note to another teacher task');

select set_config('request.jwt.claim.sub', current_setting('test.teacher'), true);
select set_config('request.jwt.claims', json_build_object('sub', current_setting('test.teacher'), 'role', 'authenticated')::text, true);
with removed as (delete from public.follow_up_notes where id = current_setting('test.internal')::uuid returning id)
select pg_temp.assert_true((select count(*) = 1 from removed), 'teacher deletes own note');
with removed as (delete from public.follow_up_tasks where id = current_setting('test.task1')::uuid returning id)
select pg_temp.assert_true((select count(*) = 1 from removed), 'teacher deletes own task');
select pg_temp.assert_true((select count(*) = 0 from public.follow_up_notes where task_id = current_setting('test.task1')::uuid), 'task delete cascades to notes');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select pg_temp.expect_denied('select * from public.profiles', 'anonymous cannot read profiles');
select pg_temp.expect_denied('select * from public.students', 'anonymous cannot read students');
select pg_temp.expect_denied('select * from public.teacher_students', 'anonymous cannot read assignments');
select pg_temp.expect_denied('select * from public.follow_up_tasks', 'anonymous cannot read tasks');
select pg_temp.expect_denied('select * from public.follow_up_notes', 'anonymous cannot read notes');
select pg_temp.expect_denied('delete from public.follow_up_tasks', 'anonymous cannot delete tasks');
reset role;
rollback;
