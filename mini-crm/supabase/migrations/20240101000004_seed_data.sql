-- Trigger: auto-create profile on user signup
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
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
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- TEST USERS (create manually in Supabase Dashboard)
-- ============================================
-- Authentication → Users → Add user:
-- 1. setter@test.com / password123
--    raw_user_meta_data: {"full_name": "Иван Постановщик", "role": "setter"}
--
-- 2. executor1@test.com / password123
--    raw_user_meta_data: {"full_name": "Петр Исполнитель", "role": "executor"}
--
-- 3. executor2@test.com / password123
--    raw_user_meta_data: {"full_name": "Сергей Исполнитель", "role": "executor"}
--
-- Then in SQL Editor:
-- UPDATE profiles SET role = 'setter' WHERE email = 'setter@test.com';
-- UPDATE profiles SET role = 'executor' WHERE email IN ('executor1@test.com', 'executor2@test.com');

-- ============================================
-- SAMPLE DATA (optional, run after creating users)
-- ============================================
-- DO $$
-- DECLARE
--   v_setter_id UUID;
--   v_executor1_id UUID;
--   v_executor2_id UUID;
-- BEGIN
--   SELECT id INTO v_setter_id FROM profiles WHERE email = 'setter@test.com';
--   SELECT id INTO v_executor1_id FROM profiles WHERE email = 'executor1@test.com';
--   SELECT id INTO v_executor2_id FROM profiles WHERE email = 'executor2@test.com';
--
--   IF v_setter_id IS NOT NULL AND v_executor1_id IS NOT NULL AND v_executor2_id IS NOT NULL THEN
--     -- Objects
--     INSERT INTO objects (name, address, created_by) VALUES
--       ('ЖК Солнечный', 'ул. Ленина, 123', v_setter_id),
--       ('Стройка на окраине', 'Край города, у пустыря', v_setter_id)
--     ON CONFLICT DO NOTHING;
--
--     -- Tasks with history (run after objects exist)
--   END IF;
-- END $$;