/*
# Remove the ambiguous web fichaje function overload

## Problem
There are two public functions named `web_register_fichaje` with the same first
nine parameters. PostgREST receives the named parameters from the mobile app,
but cannot choose between the old function and the PIN-enabled function. The
mobile flow therefore fails before either function runs.

## Changes
1. Remove the obsolete nine-parameter overload.
2. Keep the ten-parameter PIN-enabled function created by the previous fix.
3. Re-grant execution on the remaining function to both anonymous PIN users
   and authenticated users.

## Data safety
This changes only a stored function definition and does not delete or alter
any fichaje rows, employee records, or location data.

## Security
The remaining function keeps its existing `SECURITY DEFINER` and fixed
`search_path = public` settings. PIN validation, employee mode checks, and
location validation remain enforced inside the function.
*/

DROP FUNCTION IF EXISTS public.web_register_fichaje(
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  boolean,
  text
);

GRANT EXECUTE ON FUNCTION public.web_register_fichaje(
  text,
  double precision,
  double precision,
  text,
  text,
  text,
  text,
  boolean,
  text,
  text
) TO anon, authenticated;