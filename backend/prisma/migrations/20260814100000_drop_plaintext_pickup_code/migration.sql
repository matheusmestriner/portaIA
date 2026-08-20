-- O código de retirada passou a ser guardado apenas como HMAC
-- (pickup_code_hash). Manter uma cópia em texto puro anulava esse desenho:
-- qualquer leitura do banco revelaria a credencial. A unicidade por
-- condomínio também deixa de fazer sentido, já que o código não é mais
-- consultado diretamente.
DROP INDEX IF EXISTS "deliveries_condominium_id_pickup_code_key";
ALTER TABLE "deliveries" DROP COLUMN IF EXISTS "pickup_code";
