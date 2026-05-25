/*
  # Seed default prevention tags

  Inserts the standard prevention/occupational-risk tags if they don't already exist.
  These tags are assigned to employees by the prevention team to indicate their
  work environment category (e.g. electrician, office worker, etc.).
*/

INSERT INTO tags (nombre) VALUES
  ('Oficina'),
  ('Electricista'),
  ('Obras / Construccion'),
  ('Almacen / Logistica'),
  ('Conduccion'),
  ('Trabajo en Altura'),
  ('Espacios Confinados'),
  ('Manipulacion de Cargas'),
  ('Exposicion a Quimicos'),
  ('Pantallas de Visualizacion')
ON CONFLICT (nombre) DO NOTHING;
