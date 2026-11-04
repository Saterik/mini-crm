-- This migration creates test users and sample data
-- Note: Users must be created via Supabase Auth first, then profiles are created via trigger
-- Run this AFTER creating users in Supabase Auth dashboard

-- Example: Create test users in Supabase Auth first:
-- setter@test.com / password123
-- executor1@test.com / password123
-- executor2@test.com / password123

-- Then run this to create profiles (or use the trigger below)

-- Trigger to auto-create profile on user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    COALESCE(NEW.raw_user_meta_data->>'role', 'executor')::user_role
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Sample data (run after creating users and getting their IDs)
-- Replace UUIDs with actual user IDs from auth.users

-- DO $$
-- DECLARE
--   v_setter_id UUID := 'your-setter-user-id';
--   v_executor1_id UUID := 'your-executor1-user-id';
--   v_executor2_id UUID := 'your-executor2-user-id';
--   v_object1_id UUID;
--   v_object2_id UUID;
--   v_object3_id UUID;
--   v_task1_id UUID;
--   v_task2_id UUID;
--   v_task3_id UUID;
--   v_task4_id UUID;
--   v_task5_id UUID;
-- BEGIN
--   -- Create objects
--   INSERT INTO objects (name, address, created_by) VALUES
--     ('ЖК Солнечный', 'ул. Ленина, 123', v_setter_id),
--     ('ТЦ Горизонт', 'пр. Мира, 456', v_setter_id),
--     ('Склад Северный', 'ул. Промышленная, 789', v_setter_id)
--   RETURNING id INTO v_object1_id, v_object2_id, v_object3_id;
--
--   -- Create tasks
--   INSERT INTO tasks (title, description, object_id, assignee_id, author_id, status) VALUES
--     ('Залить фундамент', 'Подготовить опалубку и залить бетон', v_object1_id, v_executor1_id, v_setter_id, 'accepted'),
--     ('Смонтировать каркас', 'Сборка металлоконструкций 1 этажа', v_object1_id, v_executor1_id, v_setter_id, 'on_review'),
--     ('Провести коммуникации', 'Водоснабжение и электрика 2 этажа', v_object1_id, v_executor2_id, v_setter_id, 'in_progress'),
--     ('Отделка фасада', 'Установка термопанелей', v_object2_id, v_executor1_id, v_setter_id, 'new'),
--     ('Монтаж вентиляции', 'Приточно-вытяжная вентиляция', v_object3_id, v_executor2_id, v_setter_id, 'rework')
--   RETURNING id INTO v_task1_id, v_task2_id, v_task3_id, v_task4_id, v_task5_id;
--
--   -- Create status history
--   INSERT INTO task_status_history (task_id, changed_by, from_status, to_status, comment) VALUES
--     (v_task1_id, v_setter_id, NULL, 'new', NULL),
--     (v_task1_id, v_executor1_id, 'new', 'in_progress', NULL),
--     (v_task1_id, v_executor1_id, 'in_progress', 'on_review', NULL),
--     (v_task1_id, v_setter_id, 'on_review', 'accepted', NULL),
--
--     (v_task2_id, v_setter_id, NULL, 'new', NULL),
--     (v_task2_id, v_executor1_id, 'new', 'in_progress', NULL),
--     (v_task2_id, v_executor1_id, 'in_progress', 'on_review', NULL),
--
--     (v_task3_id, v_setter_id, NULL, 'new', NULL),
--     (v_task3_id, v_executor2_id, 'new', 'in_progress', NULL),
--
--     (v_task4_id, v_setter_id, NULL, 'new', NULL),
--
--     (v_task5_id, v_setter_id, NULL, 'new', NULL),
--     (v_task5_id, v_executor2_id, 'new', 'in_progress', NULL),
--     (v_task5_id, v_executor2_id, 'in_progress', 'on_review', NULL),
--     (v_task5_id, v_setter_id, 'on_review', 'rework', 'Нужно переделать монтаж по проекту');
-- END $$;