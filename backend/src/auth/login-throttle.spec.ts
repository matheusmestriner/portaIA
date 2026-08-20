import {
  ATTEMPT_WINDOW_MS,
  MAX_FAILED_ATTEMPTS,
  effectiveAttempts,
  isLocked,
  lockDurationMs,
  shouldLock,
} from './login-throttle';

describe('login throttle', () => {
  it('locks exactly on each multiple of the max attempts', () => {
    for (let attempts = 1; attempts < MAX_FAILED_ATTEMPTS; attempts += 1) {
      expect(shouldLock(attempts)).toBe(false);
    }
    expect(shouldLock(MAX_FAILED_ATTEMPTS)).toBe(true);
    expect(shouldLock(MAX_FAILED_ATTEMPTS * 2)).toBe(true);
    expect(shouldLock(MAX_FAILED_ATTEMPTS + 1)).toBe(false);
  });

  it('never locks on zero attempts', () => {
    expect(shouldLock(0)).toBe(false);
  });

  it('escalates the lock duration and then caps it', () => {
    const first = lockDurationMs(MAX_FAILED_ATTEMPTS);
    const second = lockDurationMs(MAX_FAILED_ATTEMPTS * 2);
    const third = lockDurationMs(MAX_FAILED_ATTEMPTS * 3);
    const fourth = lockDurationMs(MAX_FAILED_ATTEMPTS * 4);
    const way_beyond = lockDurationMs(MAX_FAILED_ATTEMPTS * 50);

    expect(first).toBeLessThan(second);
    expect(second).toBeLessThan(third);
    expect(third).toBeLessThan(fourth);
    // Não cresce indefinidamente: um usuário legítimo não fica trancado para sempre.
    expect(way_beyond).toBe(fourth);
  });

  it('forgets attempts older than the window', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const recent = new Date(now.getTime() - 1000);
    const old = new Date(now.getTime() - ATTEMPT_WINDOW_MS - 1000);

    expect(effectiveAttempts(4, recent, now)).toBe(4);
    expect(effectiveAttempts(4, old, now)).toBe(0);
    expect(effectiveAttempts(4, null, now)).toBe(0);
  });

  it('reports a lock only while it is still in the future', () => {
    const now = new Date('2026-01-01T12:00:00Z');
    expect(isLocked(new Date(now.getTime() + 1000), now)).toBe(true);
    expect(isLocked(new Date(now.getTime() - 1000), now)).toBe(false);
    expect(isLocked(null, now)).toBe(false);
  });
});
