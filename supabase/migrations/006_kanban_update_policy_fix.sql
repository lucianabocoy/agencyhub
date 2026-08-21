-- Corrige la policy kanban_update para que traffickers puedan editar
-- tareas de sus clientes asignados (no solo las que crearon).
-- La policy original en 001_initial.sql usaba created_by = auth.uid(),
-- lo que impedía que el equipo moviera o editara tareas ajenas.
DROP POLICY IF EXISTS "kanban_update" ON public.kanban_tasks;
CREATE POLICY "kanban_update" ON public.kanban_tasks
  FOR UPDATE USING (
    get_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.client_assignments ca
      WHERE ca.client_id = kanban_tasks.client_id
        AND ca.user_id = auth.uid()
    )
  );
