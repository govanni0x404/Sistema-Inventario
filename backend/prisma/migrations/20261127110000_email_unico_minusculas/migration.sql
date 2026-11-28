-- Correos únicos sin distinguir mayúsculas. Se escribe a la defensiva: si la base ya tiene
-- dos cuentas que solo difieren en mayúsculas, NO se toca nada (ni se rompe el despliegue);
-- queda un aviso para que un administrador las unifique y luego cree el índice a mano.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "usuarios" GROUP BY lower("email") HAVING count(*) > 1
  ) THEN
    RAISE WARNING 'Hay correos de usuario repetidos (sin distinguir mayúsculas). No se creó el índice "usuarios_email_lower_key": unifica esas cuentas y créalo manualmente.';
  ELSE
    UPDATE "usuarios" SET "email" = lower("email") WHERE "email" <> lower("email");
    CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_lower_key" ON "usuarios" (lower("email"));
  END IF;
END
$$;
