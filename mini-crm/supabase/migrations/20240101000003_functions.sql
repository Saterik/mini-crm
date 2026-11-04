-- Function to validate status transitions
CREATE OR REPLACE FUNCTION validate_status_transition(
  p_task_id UUID,
  p_new_status task_status,
  p_user_id UUID,
  p_comment TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
  v_task RECORD;
  v_user_role user_role;
  v_is_assignee BOOLEAN;
  v_is_author BOOLEAN;
  v_allowed BOOLEAN := FALSE;
BEGIN
  -- Get task info
  SELECT * INTO v_task FROM tasks WHERE id = p_task_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task not found';
  END IF;

  -- Get user role
  SELECT role INTO v_user_role FROM profiles WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  v_is_assignee := (v_task.assignee_id = p_user_id);
  v_is_author := (v_task.author_id = p_user_id);

  -- Validate transition based on current status and user role
  CASE v_task.status
    WHEN 'new' THEN
      IF p_new_status = 'in_progress' AND v_user_role = 'executor' AND v_is_assignee THEN
        v_allowed := TRUE;
      END IF;
    WHEN 'in_progress' THEN
      IF p_new_status = 'on_review' AND v_user_role = 'executor' AND v_is_assignee THEN
        v_allowed := TRUE;
      END IF;
    WHEN 'on_review' THEN
      IF p_new_status = 'accepted' AND v_user_role = 'setter' AND v_is_author THEN
        v_allowed := TRUE;
      ELSIF p_new_status = 'rework' AND v_user_role = 'setter' AND v_is_author THEN
        IF p_comment IS NULL OR p_comment = '' THEN
          RAISE EXCEPTION 'Comment is required for rework';
        END IF;
        v_allowed := TRUE;
      END IF;
    WHEN 'rework' THEN
      IF p_new_status = 'in_progress' AND v_user_role = 'executor' AND v_is_assignee THEN
        v_allowed := TRUE;
      END IF;
    WHEN 'accepted' THEN
      -- No transitions from accepted
      v_allowed := FALSE;
    ELSE
      v_allowed := FALSE;
  END CASE;

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Invalid status transition: % -> % for role %', v_task.status, p_new_status, v_user_role;
  END IF;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update task status with history
CREATE OR REPLACE FUNCTION update_task_status(
  p_task_id UUID,
  p_new_status task_status,
  p_comment TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_old_status task_status;
BEGIN
  -- Validate transition
  PERFORM validate_status_transition(p_task_id, p_new_status, v_user_id, p_comment);

  -- Get old status
  SELECT status INTO v_old_status FROM tasks WHERE id = p_task_id;

  -- Update task status
  UPDATE tasks SET status = p_new_status, updated_at = NOW() WHERE id = p_task_id;

  -- Insert history record
  INSERT INTO task_status_history (task_id, changed_by, from_status, to_status, comment)
  VALUES (p_task_id, v_user_id, v_old_status, p_new_status, p_comment);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to create task with initial history
CREATE OR REPLACE FUNCTION create_task_with_history(
  p_title TEXT,
  p_description TEXT,
  p_object_id UUID,
  p_assignee_id UUID
) RETURNS UUID AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_task_id UUID;
BEGIN
  -- Verify user is setter
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_user_id AND role = 'setter') THEN
    RAISE EXCEPTION 'Only setters can create tasks';
  END IF;

  -- Verify object exists and user has access
  IF NOT EXISTS (SELECT 1 FROM objects WHERE id = p_object_id AND created_by = v_user_id) THEN
    RAISE EXCEPTION 'Object not found or access denied';
  END IF;

  -- Verify assignee is executor
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_assignee_id AND role = 'executor') THEN
    RAISE EXCEPTION 'Assignee must be an executor';
  END IF;

  -- Create task
  INSERT INTO tasks (title, description, object_id, assignee_id, author_id, status)
  VALUES (p_title, p_description, p_object_id, p_assignee_id, v_user_id, 'new')
  RETURNING id INTO v_task_id;

  -- Create initial history entry
  INSERT INTO task_status_history (task_id, changed_by, from_status, to_status, comment)
  VALUES (v_task_id, v_user_id, NULL, 'new', NULL);

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION validate_status_transition TO authenticated;
GRANT EXECUTE ON FUNCTION update_task_status TO authenticated;
GRANT EXECUTE ON FUNCTION create_task_with_history TO authenticated;