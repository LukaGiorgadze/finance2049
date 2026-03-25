const fs = require('fs');
const path = require('path');

const testsDir = path.dirname(require.resolve('./setup-test-dist.cjs'));
const distNodeModulesDir = path.join(testsDir, '..', '.test-dist', 'node_modules');

function writeModule(modulePath, content) {
  const target = path.join(distNodeModulesDir, ...modulePath.split('/'));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

writeModule('@react-native-firebase/crashlytics/index.js', `
const noop = () => {};
const noopAsync = async () => {};

function getCrashlytics() {
  return {};
}

module.exports = {
  getCrashlytics,
  log: noop,
  recordError: noop,
  setAttribute: noopAsync,
  setAttributes: noopAsync,
  setCrashlyticsCollectionEnabled: noopAsync,
  setUserId: noopAsync,
};
`);

writeModule('@react-native-async-storage/async-storage/index.js', `
const storage = new Map();

const api = {
  async getItem(key) {
    return storage.has(key) ? storage.get(key) : null;
  },
  async setItem(key, value) {
    storage.set(key, String(value));
  },
  async removeItem(key) {
    storage.delete(key);
  },
  async clear() {
    storage.clear();
  },
  async multiGet(keys) {
    return keys.map((key) => [key, storage.has(key) ? storage.get(key) : null]);
  },
  async multiSet(entries) {
    for (const [key, value] of entries) {
      storage.set(key, String(value));
    }
  },
  async multiRemove(keys) {
    for (const key of keys) {
      storage.delete(key);
    }
  },
};

module.exports = {
  __esModule: true,
  ...api,
  default: api,
};
`);
