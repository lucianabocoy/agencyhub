-- Allow admin to read, update and delete any user's time entries
DROP POLICY IF EXISTS "admin_time_entries_select" ON public.time_entries;
CREATE POLICY "admin_time_entries_select" ON public.time_entries
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "admin_time_entries_update" ON public.time_entries;
CREATE POLICY "admin_time_entries_update" ON public.time_entries
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (get_user_role() = 'admin');

DROP POLICY IF EXISTS "admin_time_entries_delete" ON public.time_entries;
CREATE POLICY "admin_time_entries_delete" ON public.time_entries
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (get_user_role() = 'admin');
