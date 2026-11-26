export function demoPassword() {
  const url = new URL(process.env.DATABASE_URL ?? '');
  const password = process.env.DEMO_PASSWORD;
  if (process.env.RENTFLOW_V10_DEMO !== '1' || process.env.NODE_ENV === 'production' || process.env.PUBLIC_ORIGIN ||
      !['mysql', 'localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/rentflow_v10_demo') {
    throw new Error('Tác vụ chỉ được chạy trong cơ sở dữ liệu rentflow_v10_demo khi bật chế độ demo.');
  }
  if (!password || (password.length < 12 && password !== 'Demo@2026!')) {
    throw new Error('Hãy đặt DEMO_PASSWORD theo gói demo hoặc dùng mật khẩu ít nhất 12 ký tự.');
  }
  return password;
}
