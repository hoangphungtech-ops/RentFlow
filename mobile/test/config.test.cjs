const { test } = require('node:test');
const assert = require('node:assert/strict');
const config = require('../app.config.js');

function settings({ origin, release, devHttp, packageName, profile }) {
  const variables = {
    EXPO_PUBLIC_API_ORIGIN: origin, RENTFLOW_RELEASE_BUILD: release,
    RENTFLOW_ANDROID_DEV_HTTP: devHttp, RENTFLOW_ANDROID_PACKAGE: packageName, EAS_BUILD_PROFILE: profile,
  };
  const before = { ...process.env };
  try {
    for (const [key,value] of Object.entries(variables)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    return config({ config: structuredClone(require('../app.json').expo) });
  } finally {
    for (const key of Object.keys(variables)) {
      if (key in before) process.env[key] = before[key]; else delete process.env[key];
    }
  }
}
test('Android release keeps HTTPS, approved ID and target 36', () => {
  const result = settings({origin:'https://rentflow.example.org',release:'1',packageName:'vn.rentflow.tenant'});
  assert.equal(result.android.package,'vn.rentflow.tenant');
  assert.deepEqual(result.plugins[1][1].android,{targetSdkVersion:36,compileSdkVersion:37,usesCleartextTraffic:false});
});
test('Android release rejects HTTP even if the development switch is set', () => {
  assert.throws(() => settings({origin:'http://10.0.2.2:3000',release:'1',devHttp:'1'}), /HTTPS/);
  assert.throws(() => settings({origin:'https://rentflow.invalid',release:'1',packageName:'vn.rentflow.tenant'}), /HTTPS/);
  assert.throws(() => settings({origin:'https://rentflow.example.org',release:'1'}), /application ID/);
});
test('Android development HTTP is opt-in and loopback-only', () => {
  assert.throws(() => settings({origin:'http://127.0.0.1:3000'}), /HTTPS/);
  assert.throws(() => settings({origin:'http://192.168.1.3:3000',devHttp:'1'}), /HTTPS/);
  assert.equal(settings({origin:'http://10.0.2.2:3000',devHttp:'1'}).plugins[1][1].android.usesCleartextTraffic,true);
});

test('EAS profiles separate staging APK and production AAB', () => {
  const { build } = require('../eas.json');
  assert.equal(build.internal.environment,'preview');
  assert.equal(build.internal.android.buildType,'apk');
  assert.equal(build.production.environment,'production');
  assert.equal(build.production.android.buildType,'app-bundle');
  for (const profile of ['internal','production']) {
    assert.equal(build[profile].credentialsSource,'remote');
    assert.throws(() => settings({profile,origin:'http://10.0.2.2:3000',devHttp:'1'}), /HTTPS/);
    assert.throws(() => settings({profile,origin:'https://rentflow.example.org'}), /application ID/);
  }
});
