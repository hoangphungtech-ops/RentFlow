const { isIP } = require('node:net');

module.exports = ({ config }) => {
  if (process.env.RENTFLOW_RELEASE_BUILD === '1') {
    const endpoint = new URL(process.env.EXPO_PUBLIC_API_ORIGIN ?? '');
    if (endpoint.protocol !== 'https:' || endpoint.hostname === 'localhost' ||
        !endpoint.hostname.includes('.') || endpoint.hostname.endsWith('.local') ||
        isIP(endpoint.hostname) || endpoint.username || endpoint.password ||
        endpoint.pathname !== '/' || endpoint.search || endpoint.hash) {
      throw new Error('Set EXPO_PUBLIC_API_ORIGIN to the approved public HTTPS origin.');
    }
    if (!process.env.RENTFLOW_ANDROID_PACKAGE?.match(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/)) {
      throw new Error('Set RENTFLOW_ANDROID_PACKAGE to the approved application ID.');
    }
    config.android.package = process.env.RENTFLOW_ANDROID_PACKAGE;
  }
  return config;
};
