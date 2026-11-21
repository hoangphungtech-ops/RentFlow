const origin = process.env.RENTFLOW_API_ORIGIN ?? 'http://127.0.0.1:3001'
export default {
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/api/:path*', destination: origin + '/api/:path*' }]
  },
}
