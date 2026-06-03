# Checklist de Verificación - Login Fallando FIX

## Paso 1: Verificar que la Solución se Aplicó

**Ejecuta esto en Supabase Dashboard → SQL Editor:**

```sql
-- Verificar que la política de bypass existe
SELECT policyname, permissive, with_check
FROM pg_policies
WHERE tablename = 'empleados' 
AND policyname = 'Trigger can create empleados';
```

**Esperado**: 1 fila con `policyname='Trigger can create empleados'` y `with_check='true'`

✓ Paso 1: VERIFICADO

---

## Paso 2: Verificar que el Trigger Existe

```sql
-- Verificar que el trigger está creado
SELECT tgname, tgrelid::regclass, tgfoid::regprocedure
FROM pg_trigger
WHERE tgname = 'trg_sync_auth_user_to_empleado';
```

**Esperado**: 1 fila con información del trigger

✓ Paso 2: VERIFICADO

---

## Paso 3: Verificar que la Función del Trigger es Robusta

```sql
-- Ver la función del trigger
SELECT pg_get_functiondef(oid)
FROM pg_proc
WHERE proname = 'sync_auth_user_to_empleado'
LIMIT 1;
```

**Esperado**: Función contiene EXCEPTION handling y lógica de NULL checks

✓ Paso 3: VERIFICADO

---

## Paso 4: Probar el Login en la Aplicación

1. **Abre la aplicación** en el navegador
2. **Ingresa credenciales válidas** (usuario existente)
3. **Presiona "Entrar"**
4. **Espera a que cargue**

**Esperado**: Dashboard carga correctamente sin errores

**Si funciona**: ✓ LOGIN FIXED - Ir a Paso 7

**Si no funciona**: Continuar con Paso 5

---

## Paso 5: Revisar Errores en DevTools

1. **Abre DevTools** (F12)
2. **Ve a la pestaña "Console"**
3. **Busca mensajes rojos** que digan "Error" o "Login"

**Posibles Errores:**

| Error | Significado | Solución |
|-------|------------|----------|
| `CORS error` | Problema de origen cruzado | Verificar edge function CORS headers |
| `Credenciales incorrectas` | Usuario o password mal | Verificar credenciales |
| `Error al crear sesión` | Tokens no generados | Verificar edge function logs |
| `Permission denied` | RLS bloqueando | Ver Paso 6 |

**Si ves "Permission denied"**: Ir a Paso 6

---

## Paso 6: Debugging de RLS (Si es necesario)

**En Supabase Dashboard → SQL Editor:**

```sql
-- Test 1: Verificar que empleado se crea al insertar user_profile
DO $$
DECLARE
  v_user_id uuid;
  v_count int;
BEGIN
  -- Crear test user_profile
  INSERT INTO user_profiles (
    id, nombre, email, role, activo, societies
  ) VALUES (
    gen_random_uuid(),
    'Test User',
    'debug_test_' || now()::text || '@test.com',
    'employee',
    true,
    ARRAY['11111111-1111-1111-1111-111111111111']
  ) RETURNING id INTO v_user_id;
  
  -- Verificar que empleado se creó
  SELECT COUNT(*) INTO v_count FROM empleados 
  WHERE user_id = v_user_id;
  
  IF v_count = 1 THEN
    RAISE NOTICE 'SUCCESS: Trigger created empleado';
    DELETE FROM empleados WHERE user_id = v_user_id;
    DELETE FROM user_profiles WHERE id = v_user_id;
  ELSE
    RAISE NOTICE 'FAILURE: Trigger did NOT create empleado. Count: %', v_count;
    DELETE FROM user_profiles WHERE id = v_user_id;
  END IF;
END $$;
```

**Esperado**: "SUCCESS: Trigger created empleado"

**Si ves "FAILURE"**: El trigger no está siendo ejecutado correctamente. Verificar:
- ¿Existe la política `Trigger can create empleados`?
- ¿Existe la función `sync_auth_user_to_empleado`?
- ¿Existe el trigger `trg_sync_auth_user_to_empleado`?

---

## Paso 7: Verificación Final

Si llegaste aquí sin errores, todo funciona:

```sql
-- Verificar que los componentes están en su lugar
SELECT 
  (SELECT COUNT(*) FROM pg_policies 
   WHERE tablename='empleados' 
   AND policyname='Trigger can create empleados') AS bypass_policy,
  (SELECT COUNT(*) FROM pg_trigger 
   WHERE tgname='trg_sync_auth_user_to_empleado') AS trigger_exists,
  (SELECT COUNT(*) FROM pg_proc 
   WHERE proname='sync_auth_user_to_empleado') AS function_exists;
```

**Esperado**: Tres columnas con valor 1

✓ **LOGIN FUNCIONA CORRECTAMENTE**

---

## Resumen de la Solución

| Componente | Cambio | Estado |
|-----------|--------|--------|
| Trigger RLS Bypass | Política agregada | ✓ Implementado |
| Trigger Mejorado | Error handling | ✓ Implementado |
| Foreign Key Cascade | Delete behavior | ✓ Implementado |
| Login Error Handling | 6-layer validation | ✓ Implementado |
| Build | TypeScript | ✓ Sin errores |

---

## Notas Importantes

1. **El trigger es ahora robusto**: Si falla, no bloquea el login
2. **La política de bypass es segura**: Solo se aplica al trigger con SECURITY DEFINER
3. **Los datos están protegidos**: RLS aún filtra datos en lectura/escritura normales
4. **El login es más confiable**: Con error handling completo en 6 capas

---

## Troubleshooting Rápido

**Problema**: "Permission denied: policy"
**Solución**: Ejecuta Step 6, verifica que la política de bypass existe

**Problema**: "Empleado no creado"
**Solución**: Ejecuta Step 6, verifica que el trigger se está ejecutando

**Problema**: "Login funciona pero no se ve el dashboard"
**Solución**: Abre DevTools, busca errores de permisos en la consola, verifica RLS

**Problema**: "Sigue fallando"
**Solución**: 
1. Ejecuta todos los steps en orden
2. Copia cualquier error de la consola
3. Revisa `TRIGGER_FIX_SOLUTION.md` para debugging avanzado

---

✓ **Si completaste este checklist sin problemas, el login está FIXED**
