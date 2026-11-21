const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('node:net');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { setTimeout: delay } = require('node:timers/promises');
const { db, passwordHash } = require('../dist/src/auth');

async function listen(server) {
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function waitFor(check) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await check();
    if (result) return result;
    await delay(100);
  }
  throw Error('Test service timed out');
}

test('real SMTP loopback: possession proof, owner binding, new login, recovery and session revocation', async () => {
  const received = [];
  const sockets = new Set();
  const sink = createServer(socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.setEncoding('utf8');
    socket.write('220 loopback.test ESMTP\r\n');
    let buffer = '', content = null, recipient;
    socket.on('data', chunk => {
      buffer += chunk;
      while (buffer.includes('\r\n')) {
        const end = buffer.indexOf('\r\n');
        const line = buffer.slice(0,end);
        buffer = buffer.slice(end+2);
        if (content !== null) {
          if (line === '.') {
            received.push({ recipient, content });
            content = null;
            socket.write('250 queued\r\n');
          } else content += line + '\n';
        } else if (/^DATA$/i.test(line)) {
          content = '';
          socket.write('354 end with dot\r\n');
        } else if (/^RCPT TO:/i.test(line)) {
          recipient = line;
          socket.write('250 OK\r\n');
        } else if (/^QUIT$/i.test(line)) socket.end('221 bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  const smtpPort = await listen(sink);
  const reservation = createServer();
  const apiPort = await listen(reservation);
  await new Promise(resolve => reservation.close(resolve));
  const child = spawn(process.execPath, ['--env-file=.env', 'dist/src/main.js'], {
    env: { ...process.env, NODE_ENV: 'test', PUBLIC_ORIGIN: '', PORT: String(apiPort), API_HOST: '127.0.0.1',
      SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtpPort), SMTP_FROM: 'sender@rentflow.test',
      SMTP_USER: '', SMTP_PASSWORD: '', SMTP_SECURITY: 'auto', SMTP_LOOPBACK_TEST: '1' },
    stdio: 'ignore',
  });
  const tag = randomUUID().slice(0,16);
  const previousEmail = 'before-' + tag + '@rentflow.test';
  const targetEmail = 'after-' + tag + '@rentflow.test';
  const otherEmail = 'other-' + tag + '@rentflow.test';
  const password = randomUUID();
  const updated = randomUUID();
  const base = 'http://127.0.0.1:' + apiPort + '/api/';
  async function post(path, body, status, token) {
    const response = await fetch(base + path, { method: 'POST', headers: {
      'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}),
    }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    assert.equal(response.status, status, path);
    return response.json();
  }
  try {
    await waitFor(() => fetch(base + 'health').then(result => result.ok).catch(() => false));
    for (const email of [previousEmail,otherEmail]) await db.user.create({data:{
      email, fullName: 'SMTP test account', role: 'RENTER', passwordHash: passwordHash(password),
    }});
    const login = async (email, value=password) => (await post('login', {email,password:value}, 200)).token;
    const token = await login(previousEmail);
    const other = await login(otherEmail);
    await post('account/email/request', { email:targetEmail, currentPassword:randomUUID() },401,token);
    assert.equal(received.length,0);
    await post('account/email/request', { email:targetEmail, currentPassword:password },201,token);
    const email = received[0];
    assert(email?.recipient.includes(targetEmail));
    const code = email.content.match(/\b[a-f0-9]{64}\b/)[0];
    assert(!(await db.accountCode.findUnique({where:{hash:code}})));
    await post('account/email/confirm', {code},401,other);
    await post('account/email/confirm', {code},201,token);
    await post('account/email/confirm', {code},401,token);
    await post('login',{email:previousEmail,password},401);
    const renewed = await login(targetEmail);
    await post('account/email/confirm', {code},401,renewed);
    await post('auth/forgot-password',{email:otherEmail},200);
    const result = await post('auth/forgot-password',{email:targetEmail},200);
    assert.equal(result.code,undefined);
    const mail = await waitFor(() => received[1]);
    assert.equal(received.length,2);
    assert(mail.recipient.includes(targetEmail));
    const expired = mail.content.match(/\b[a-f0-9]{64}\b/)[0];
    const account = await db.user.findUniqueOrThrow({ where: { email: targetEmail } });
    const lookup = { userId_kind: { userId: account.id, kind: 'RESET' } };
    const issued = await db.accountCode.findUniqueOrThrow({ where: lookup });
    await db.accountCode.update({ where: lookup, data: { expiresAt: new Date(0) } });
    await post('auth/reset-password', {code:expired,newPassword:updated,confirmPassword:updated},401);
    await post('auth/forgot-password',{email:targetEmail},200);
    await delay(250);
    assert.equal(received.length,2);
    assert.equal((await db.accountCode.findUniqueOrThrow({ where: lookup })).hash,issued.hash);
    await db.user.update({ where: { id: account.id }, data: { recoveryRequestedAt: new Date(0) } });
    await post('auth/forgot-password',{email:targetEmail},200);
    const refreshed = await waitFor(() => received[2]);
    const reset = refreshed.content.match(/\b[a-f0-9]{64}\b/)[0];
    const body = {code:reset,newPassword:updated,confirmPassword:updated};
    await post('auth/reset-password',body,200);
    await post('auth/reset-password',body,401);
    const oldSession = await fetch(base+'account/me',{headers:{Authorization:'Bearer '+renewed}});
    assert.equal(oldSession.status,401);
    await post('login',{email:targetEmail,password},401);
    await login(targetEmail,updated);
  } finally {
    child.kill();
    for (const socket of sockets) socket.destroy();
    await new Promise(resolve => sink.close(resolve));
    await db.$disconnect();
  }
});
