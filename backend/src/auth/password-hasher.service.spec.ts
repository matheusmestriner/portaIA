import { PasswordHasherService } from './password-hasher.service';

describe('PasswordHasherService', () => {
  const service = new PasswordHasherService();

  it('verifies a matching password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await service.hash('correct horse battery staple');
    await expect(service.verify('wrong password', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const [a, b] = await Promise.all([service.hash('same input'), service.hash('same input')]);
    expect(a).not.toBe(b);
  });
});
