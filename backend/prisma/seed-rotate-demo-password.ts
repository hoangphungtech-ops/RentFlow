import { db, matchesPassword, passwordHash } from '../src/auth';
import { demoPassword } from './seed-demo-config';

const legacy = ['owner.a', 'owner.b', 'staff.a', 'accountant.a', 'renter.a', 'renter.b'];
const v10 = ['user.demo', 'admin.demo', 'manager.demo'];
const rbac = ['testnguoidung', 'testchutro', 'testquanly', 'testadmin', 'testnhanvien',
  'testketoan', 'testnguoidung2', 'testchutro2', 'testquanly2'];

async function rotate() {
  const password = demoPassword();
  const emails = [...legacy, ...v10, ...rbac].map(name => name + '@rentflow.test');
  const changed = await db.$transaction(async tx => {
    const users = await tx.user.findMany({ where: { email: { in: emails } } });
    if (users.length !== emails.length) throw new Error('Chưa khởi tạo đủ 18 tài khoản demo.');
    const changes = users.filter(user => {
      const name = user.email.split('@')[0];
      const legacyIndex = legacy.indexOf(name);
      const previousIndex = v10.indexOf(name);
      const expected = legacyIndex >= 0 ? user.id === '11111111-1111-4111-8111-11111111110' + (legacyIndex + 1)
        : previousIndex >= 0 ? user.isDemo && user.id === 'a9251100-0000-4000-8000-00000000000' + (previousIndex + 1)
          : user.isDemo && user.username === name;
      if (!expected) throw new Error('Tài khoản ngoài bộ seed demo: ' + user.email);
      return !user.isDemo || !matchesPassword(password, user.passwordHash);
    });
    for (const user of changes) {
      await tx.user.update({ where: { id: user.id }, data: { passwordHash: passwordHash(password), isDemo: true } });
      await tx.session.deleteMany({ where: { userId: user.id } });
    }
    return changes.length;
  }, { timeout: 15000 });
  console.log('Đã kiểm tra 18 tài khoản demo. Đã đổi mật khẩu và kết thúc phiên cũ cho ' + changed + ' tài khoản.');
}

rotate().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
