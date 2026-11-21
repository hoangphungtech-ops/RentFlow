import { fileURLToPath } from 'node:url'

const origin = process.env.RENTFLOW_API_ORIGIN ?? 'http://127.0.0.1:3001'
export default {
  poweredByHeader: false,
  output: 'standalone',
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  async rewrites() {
    return [{ source: '/api/:path*', destination: origin + '/api/:path*' }]
  },
}
