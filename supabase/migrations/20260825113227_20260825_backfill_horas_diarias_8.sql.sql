/*
# Backfill horas_diarias to 8 for all employees

Sets horas_diarias = 8 for every employee where it is still NULL.
This ensures all workers have a default daily hours expectation of 8h
until individually changed from the employee form.
*/

UPDATE empleados SET horas_diarias = 8 WHERE horas_diarias IS NULL;
