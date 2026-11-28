BEGIN;

SET LOCAL lock_timeout = '10s';
LOCK TABLE "operaciones_compra" IN ACCESS EXCLUSIVE MODE;

DO $$
BEGIN
    IF EXISTS (
        SELECT FROM "operaciones_compra" d JOIN "operaciones_compra" r ON r.id = d."recepcionId"
        WHERE r."ordenId" <> d."ordenId" OR r."recepcionId" IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Una devolución no está vinculada a una recepción de su orden';
    END IF;
END $$;

-- Una recepción carece de referencia anterior. Una devolución apunta a su recepción.
ALTER TABLE "operaciones_compra" DROP COLUMN "tipo";
DROP TYPE "TipoOperacionCompra";

CREATE FUNCTION "validar_recepcion_compra"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF ROW(NEW.id, NEW."ordenId", NEW."recepcionId") IS DISTINCT FROM ROW(OLD.id, OLD."ordenId", OLD."recepcionId") THEN
            RAISE EXCEPTION 'La orden y la referencia de una operación registrada son inmutables' USING ERRCODE = '23514';
        END IF;
    ELSIF NEW."recepcionId" IS NOT NULL AND NOT EXISTS (
        SELECT FROM "operaciones_compra" r
        WHERE r.id = NEW."recepcionId" AND r."ordenId" = NEW."ordenId" AND r."recepcionId" IS NULL
    ) THEN
        RAISE EXCEPTION 'La devolución debe citar una recepción de la misma orden' USING ERRCODE = '23503';
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER "operaciones_compra_recepcion_de_orden"
BEFORE INSERT OR UPDATE OF id, "ordenId", "recepcionId" ON "operaciones_compra"
FOR EACH ROW EXECUTE FUNCTION "validar_recepcion_compra"();

COMMIT;
