-- Agrega la sección "Reunión de equipo" al kanban (solo visible para cliente Agencia en el frontend)
ALTER TYPE kanban_section ADD VALUE IF NOT EXISTS 'reunion_de_equipo';
