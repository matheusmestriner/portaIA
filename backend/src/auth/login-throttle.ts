/**
 * Bloqueio progressivo por conta contra força bruta.
 *
 * O rate limit do Throttler é por IP: não impede um atacante distribuído
 * (botnet, proxies rotativos) de martelar uma única conta. Estas regras são
 * por conta, então valem independentemente de quantos IPs o atacante use.
 *
 * O atraso cresce a cada bloqueio para que um ataque sustentado fique
 * inviável em tempo, sem trancar permanentemente um usuário legítimo que
 * errou a senha algumas vezes.
 */
export const MAX_FAILED_ATTEMPTS = 5;

/** Janela após a qual tentativas antigas deixam de contar. */
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

const LOCK_STEPS_MS = [
  1 * 60 * 1000, // 1 min
  5 * 60 * 1000, // 5 min
  15 * 60 * 1000, // 15 min
  60 * 60 * 1000, // 1 h
];

/**
 * Duração do bloqueio dado quantas falhas o usuário já acumulou. Cada bloco
 * de MAX_FAILED_ATTEMPTS falhas sobe um degrau, até o teto.
 */
export function lockDurationMs(failedAttempts: number): number {
  const step = Math.floor(failedAttempts / MAX_FAILED_ATTEMPTS) - 1;
  return LOCK_STEPS_MS[Math.min(Math.max(step, 0), LOCK_STEPS_MS.length - 1)];
}

export function shouldLock(failedAttempts: number): boolean {
  return failedAttempts > 0 && failedAttempts % MAX_FAILED_ATTEMPTS === 0;
}

/** Tentativas anteriores à janela são descartadas. */
export function effectiveAttempts(current: number, lastFailedAt: Date | null, now: Date = new Date()): number {
  if (!lastFailedAt) return 0;
  return now.getTime() - lastFailedAt.getTime() > ATTEMPT_WINDOW_MS ? 0 : current;
}

export function isLocked(lockedUntil: Date | null, now: Date = new Date()): boolean {
  return !!lockedUntil && lockedUntil.getTime() > now.getTime();
}
