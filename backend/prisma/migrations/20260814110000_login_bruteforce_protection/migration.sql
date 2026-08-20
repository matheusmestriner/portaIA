-- Bloqueio por conta contra força bruta. O rate limit por IP do Throttler não
-- impede um ataque distribuído contra uma única conta; estas colunas fecham
-- essa lacuna independentemente da origem das tentativas.
ALTER TABLE "users"
  ADD COLUMN "failed_login_attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "locked_until" TIMESTAMP(3),
  ADD COLUMN "last_failed_login_at" TIMESTAMP(3),
  ADD COLUMN "password_changed_at" TIMESTAMP(3);
