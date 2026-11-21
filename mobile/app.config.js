const { isIP } = require('node:net');

module.exports = ({ config }) => {
  const release = process.env.RENTFLOW_RELEASE_BUILD === '1';
  const value = process.env.EXPO_PUBLIC_API_ORIGIN;
  const endpoint = value ? new URL(value) : undefined;
  if (endpoint && (endpoint.username || endpoint.password || endpoint.pathname !== '/' || endpoint.search || endpoint.hash)) {
    throw new Error('EXPO_PUBLIC_API_ORIGIN must be an origin without path or credentials.');
  }

  if (release) {
    if (endpoint?.protocol !== 'https:' || !endpoint.hostname.includes('.') ||
        /\.(local|localhost|invalid|test|example)$/.test(endpoint.hostname) || isIP(endpoint.hostname)) {
      throw new Error('Set EXPO_PUBLIC_API_ORIGIN to the approved public HTTPS origin.');
    }
    if (!process.env.RENTFLOW_ANDROID_PACKAGE?.match(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/)) {
      throw new Error('Set RENTFLOW_ANDROID_PACKAGE to the approved application ID.');
    }
    config.android.package = process.env.RENTFLOW_ANDROID_PACKAGE;
  }

  const localHttp = !release && process.env.RENTFLOW_ANDROID_DEV_HTTP === '1' &&
    endpoint?.protocol === 'http:' && ['10.0.2.2', '127.0.0.1', 'localhost'].includes(endpoint.hostname);
  if (endpoint && endpoint.protocol !== 'https:' && !localHttp) {
    throw new Error('Use HTTPS or explicitly enable loopback HTTP for a native development build.');
  }
  const properties = config.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-build-properties');
  properties[1].android.usesCleartextTraffic = localHttp;
  return config;
};
