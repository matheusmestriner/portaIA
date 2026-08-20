import * as bcrypt from 'bcryptjs';
import { PasswordHasherService } from '../password-hasher.service';
import { DUMMY_PASSWORD_HASH } from './login.use-case';

/**
 * Guards the exact regression a security audit found: bcryptjs.compare()
 * short-circuits to `false` in under a millisecond for ANY hash whose
 * length isn't exactly 60 — the DUMMY_PASSWORD_HASH constant existing at
 * all doesn't help if a future edit accidentally shortens/lengthens it by
 * even one character. A normal "login with unknown email returns 401" test
 * wouldn't catch that; only measuring cost does.
 */
describe('DUMMY_PASSWORD_HASH (login timing-oracle guard)', () => {
  it('is exactly 60 characters — bcryptjs.compare() silently no-ops on any other length', () => {
    expect(DUMMY_PASSWORD_HASH).toHaveLength(60);
  });

  it('looks like a real bcrypt hash', () => {
    expect(DUMMY_PASSWORD_HASH).toMatch(/^\$2[aby]\$\d{2}\$[A-Za-z0-9./]{53}$/);
  });

  it('costs roughly as much to compare against as a real hash — not a near-instant no-op', async () => {
    const hasher = new PasswordHasherService();
    const realHash = await bcrypt.hash('some-real-looking-password', 12);

    const timeIt = async (hash: string) => {
      const start = process.hrtime.bigint();
      await hasher.verify('whatever-the-attacker-sent', hash);
      return Number(process.hrtime.bigint() - start) / 1_000_000;
    };

    const dummyMs = await timeIt(DUMMY_PASSWORD_HASH);
    const realMs = await timeIt(realHash);

    // Generous margin (not equality) to stay stable under CI/system jitter —
    // the regression this guards against was ~400x faster (a same-length
    // valid hash vs bcryptjs's <1ms length-mismatch short-circuit), not a
    // borderline difference. Half the real cost is still overwhelming
    // evidence the short-circuit path fired again.
    expect(dummyMs).toBeGreaterThan(realMs * 0.5);
  });
});
