-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Helper functions (created in 0003_functions.sql)
DROP POLICY IF EXISTS "Setters can read executors" ON profiles;
CREATE POLICY "Setters can read executors" ON profiles
  FOR SELECT USING (role = 'executor' AND public.is_setter());

DROP POLICY IF EXISTS "Executors can read authors of their tasks" ON profiles;
CREATE POLICY "Executors can read authors of their tasks" ON profiles
  FOR SELECT USING (public.can_read_author(id));

-- ============================================
-- OBJECTS POLICIES
-- ============================================

-- Setters can create objects
DROP POLICY IF EXISTS "Setters can create objects" ON objects;
CREATE POLICY "Setters can create objects" ON objects
  FOR INSERT WITH CHECK (public.is_setter());

-- Setters can read all objects
DROP POLICY IF EXISTS "Setters can read all objects" ON objects;
CREATE POLICY "Setters can read all objects" ON objects
  FOR SELECT USING (public.is_setter());

-- Executors can read objects with their tasks
DROP POLICY IF EXISTS "Executors can read objects with their tasks" ON objects;
CREATE POLICY "Executors can read objects with their tasks" ON objects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.object_id = objects.id
      AND t.assignee_id = auth.uid()
    )
  );

-- Setters can update own objects
DROP POLICY IF EXISTS "Setters can update own objects" ON objects;
CREATE POLICY "Setters can update own objects" ON objects
  FOR UPDATE USING (created_by = auth.uid() AND public.is_setter());

-- Setters can delete own objects
DROP POLICY IF EXISTS "Setters can delete own objects" ON objects;
CREATE POLICY "Setters can delete own objects" ON objects
  FOR DELETE USING (created_by = auth.uid() AND public.is_setter());

-- ============================================
-- TASKS POLICIES
-- ============================================

-- Setters can create tasks
DROP POLICY IF EXISTS "Setters can create tasks" ON tasks;
CREATE POLICY "Setters can create tasks" ON tasks
  FOR INSERT WITH CHECK (public.is_setter());

-- Setters can read all tasks
DROP POLICY IF EXISTS "Setters can read all tasks" ON tasks;
CREATE POLICY "Setters can read all tasks" ON tasks
  FOR SELECT USING (public.is_setter());

-- Executors can read own tasks
DROP POLICY IF EXISTS "Executors can read own tasks" ON tasks;
CREATE POLICY "Executors can read own tasks" ON tasks
  FOR SELECT USING (assignee_id = auth.uid());

-- Setters can update tasks
DROP POLICY IF EXISTS "Setters can update tasks" ON tasks;
CREATE POLICY "Setters can update tasks" ON tasks
  FOR UPDATE USING (public.is_setter());

-- Executors can update own task status
DROP POLICY IF EXISTS "Executors can update own task status" ON tasks;
CREATE POLICY "Executors can update own task status" ON tasks
  FOR UPDATE USING (
    assignee_id = auth.uid() AND public.is_executor()
  ) WITH CHECK (
    assignee_id = auth.uid() AND public.is_executor()
  );

-- Setters can delete tasks
DROP POLICY IF EXISTS "Setters can delete tasks" ON tasks;
CREATE POLICY "Setters can delete tasks" ON tasks
  FOR DELETE USING (public.is_setter());

-- ============================================
-- TASK_STATUS_HISTORY POLICIES
-- ============================================

-- Setters can read all history
DROP POLICY IF EXISTS "Setters can read all history" ON task_status_history;
CREATE POLICY "Setters can read all history" ON task_status_history
  FOR SELECT USING (public.is_setter());

-- Executors can read own task history
DROP POLICY IF EXISTS "Executors can read own task history" ON task_status_history;
CREATE POLICY "Executors can read own task history" ON task_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_status_history.task_id
      AND t.assignee_id = auth.uid()
    )
  );

-- History is immutable — no INSERT/UPDATE/DELETE policies for users
-- Functions (SECURITY DEFINER) bypass RLS for inserts