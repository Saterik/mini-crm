-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE objects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_status_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES POLICIES
-- ============================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- Admins/setters can read all profiles (for assigning tasks)
CREATE POLICY "Setters can read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- ============================================
-- OBJECTS POLICIES
-- ============================================

-- Setters can create objects
CREATE POLICY "Setters can create objects" ON objects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- Setters can read all objects
CREATE POLICY "Setters can read all objects" ON objects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- Executors can read objects where they have tasks
CREATE POLICY "Executors can read objects with their tasks" ON objects
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN profiles p ON p.id = auth.uid()
      WHERE t.object_id = objects.id
      AND t.assignee_id = auth.uid()
      AND p.role = 'executor'
    )
  );

-- Setters can update their own objects
CREATE POLICY "Setters can update own objects" ON objects
  FOR UPDATE USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- Setters can delete their own objects
CREATE POLICY "Setters can delete own objects" ON objects
  FOR DELETE USING (
    created_by = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- ============================================
-- TASKS POLICIES
-- ============================================

-- Setters can create tasks
CREATE POLICY "Setters can create tasks" ON tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- Setters can read all tasks
CREATE POLICY "Setters can read all tasks" ON tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- Executors can read only their assigned tasks
CREATE POLICY "Executors can read own tasks" ON tasks
  FOR SELECT USING (
    assignee_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'executor'
    )
  );

-- Setters can update any task (status, assignee, etc.)
CREATE POLICY "Setters can update tasks" ON tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- Executors can update status of their assigned tasks (via function)
CREATE POLICY "Executors can update own task status" ON tasks
  FOR UPDATE USING (
    assignee_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'executor'
    )
  ) WITH CHECK (
    assignee_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'executor'
    )
  );

-- Setters can delete tasks
CREATE POLICY "Setters can delete tasks" ON tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- ============================================
-- TASK STATUS HISTORY POLICIES
-- ============================================

-- Setters can read all history
CREATE POLICY "Setters can read all history" ON task_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'setter'
    )
  );

-- Executors can read history of their tasks
CREATE POLICY "Executors can read own task history" ON task_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN profiles p ON p.id = auth.uid()
      WHERE t.id = task_status_history.task_id
      AND t.assignee_id = auth.uid()
      AND p.role = 'executor'
    )
  );

-- Only system can insert history (via trigger/function)
-- No direct insert policy - handled by database function

-- No update/delete on history (immutable)
-- No policies = no access