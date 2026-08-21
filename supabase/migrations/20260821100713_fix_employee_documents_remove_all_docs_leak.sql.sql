/*
# Fix: EmployeeDocuments — remove policy that leaked private docs to employees

1. Problem
   A SELECT policy "Employees view own all docs" was present on employee_documents
   with predicate `(employee_id = auth.uid())` and NO folder restriction.
   RLS policies are OR'd, so this policy overrode the correct
   "Employees view own public docs" policy (which restricts to folder='publica').
   As a result, employees could see their own documents in the 'privada' and
   'prevencion' folders — folders that should only be visible to RRHH/admin/prevencion.

2. Fix
   Drop the "Employees view own all docs" policy.
   Keep the existing "Employees view own public docs" policy so employees see only
   their own documents in the 'publica' folder.

3. Security
   No new policies created. No data lost. The remaining SELECT policies are:
   - "Employees view own public docs" (employee_id = auth.uid() AND folder = 'publica')
   - "Staff view all employee docs" (role in admin/rrhh/prevencion/supervisor/encargado/administracion)
   - "Prevencion view employee prevention docs" (folder = 'prevencion' AND role = 'prevencion')
*/

DROP POLICY IF EXISTS "Employees view own all docs" ON employee_documents;
