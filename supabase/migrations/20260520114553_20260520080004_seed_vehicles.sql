/*
  # Seed Vehicle Data

  Adds sample vehicles for all four societies so the vehicle module
  has data to display on first load. All vehicles start as 'libre'.
*/

INSERT INTO vehicles (matricula, marca, modelo, kilometros_actuales, fecha_itv, estado, society_id)
VALUES
  ('1234-ABC', 'Volkswagen', 'Golf', 45230, '2027-03-15', 'libre', 'alfa'),
  ('5678-DEF', 'Toyota', 'Corolla', 78900, '2026-08-20', 'libre', 'alfa'),
  ('9012-GHI', 'Ford', 'Transit', 112500, '2026-02-10', 'libre', 'beta'),
  ('3456-JKL', 'Renault', 'Clio', 32100, '2027-11-05', 'libre', 'beta'),
  ('7890-MNO', 'SEAT', 'Ibiza', 56780, '2025-12-01', 'libre', 'gamma'),
  ('2345-PQR', 'Peugeot', '208', 23450, '2027-06-30', 'libre', 'gamma'),
  ('6789-STU', 'Nissan', 'Qashqai', 91200, '2026-09-14', 'libre', 'delta'),
  ('0123-VWX', 'BMW', 'Serie 3', 67300, '2026-04-22', 'libre', 'delta')
ON CONFLICT (matricula) DO NOTHING;
