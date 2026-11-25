'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { migrateState, migrateStoredState } = require('../js/profile-migration.js');

const STORE = 'fmkr_rebuild_v1';
const BACKUP = `${STORE}_backup_before_apk_2_11_1`;
const legacy = {
  version: '2026_09_08_08_08',
  activeId: 'second-profile',
  profiles: [
    {
      id: 'first-profile', name: '첫 프로필', equipment: { Weapon: { age: 9, idx: 2, level: 149 } },
      pets: [{ key: 'Mythic_2', level: 100, extra: { saved: true } }, null, null],
      skills: [{ key: 'Drone', level: 73 }, null, null], mount: { key: 'Mythic_1', level: 84 },
      tree: { 'Power:17': 5, 'Forge:21': 0 }, clanTech: { WarDamage: 1234 },
      resources: { Coins: '12345678901234567890', Gems: 0 },
      planner: { queue: [{ tree: 'Forge', id: 21, gems: 12 }], start: '2026-11-25T20:00' },
      eggPlanner: { queue: [{ rarity: 'Mythic' }], slots: 2 },
      note: '메모\n일본어 黒棺 · 이모지 🐱', unknownNested: [null, false, { retained: 'yes' }],
    },
    { id: 'second-profile', name: '두 번째', custom: { futureField: 42 } },
  ],
  unknownTopLevel: { nested: ['preserve', 0, false] },
};
const originalJSON = `\n${JSON.stringify(legacy, null, 2)}\n`;

function storageWith(initial = {}, fail = () => {}) {
  const data = new Map(Object.entries(initial));
  const writes = [];
  return {
    data, writes,
    getItem(key) {
      fail('get', key);
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      fail('set', key);
      writes.push(key);
      data.set(key, String(value));
    },
  };
}

function quotaError() {
  const error = new Error('Storage quota exceeded');
  error.name = 'QuotaExceededError';
  throw error;
}

let passed = 0;
function test(name, run) {
  run();
  passed += 1;
  console.log(`ok - ${name}`);
}

test('pure migration preserves all profiles and fields without mutating input', () => {
  const before = JSON.stringify(legacy);
  const migrated = migrateState(legacy);
  assert.equal(migrated.changed, true);
  assert.notStrictEqual(migrated.state, legacy);
  assert.strictEqual(migrated.state.profiles, legacy.profiles);
  assert.strictEqual(migrated.state.unknownTopLevel, legacy.unknownTopLevel);
  assert.deepEqual(migrated.state, { ...legacy, version: 'apk_2_11_1' });
  assert.equal(JSON.stringify(legacy), before);
});

test('missing versions migrate; explicit selections and repeated runs remain unchanged', () => {
  for (const version of [undefined, null, '']) {
    const source = { ...legacy, version };
    assert.equal(migrateState(source).state.version, 'apk_2_11_1');
    assert.equal(source.version, version);
  }
  const noVersion = { profiles: legacy.profiles, activeId: legacy.activeId };
  assert.equal(migrateState(noVersion).state.version, 'apk_2_11_1');
  assert.equal(Object.hasOwn(noVersion, 'version'), false);
  for (const version of ['2026_10_08_09_03', '2026_10_27_09_45', 'custom-data', 'apk_2_11_1']) {
    const source = { ...legacy, version };
    const result = migrateState(source);
    assert.equal(result.changed, false);
    assert.strictEqual(result.state, source);
  }
});

test('storage migration backs up the exact original JSON before saving once', () => {
  const storage = storageWith({ [STORE]: originalJSON });
  const result = migrateStoredState(storage);
  assert.equal(result.ok, true);
  assert.equal(result.changed, true);
  assert.equal(result.backupCreated, true);
  assert.equal(result.error, null);
  assert.equal(result.backupKey, BACKUP);
  assert.deepEqual(storage.writes, [BACKUP, STORE]);
  assert.equal(storage.getItem(BACKUP), originalJSON);
  assert.deepEqual(JSON.parse(storage.getItem(STORE)), { ...legacy, version: 'apk_2_11_1' });

  const repeated = migrateStoredState(storage);
  assert.equal(repeated.ok, true);
  assert.equal(repeated.changed, false);
  assert.equal(repeated.backupCreated, false);
  assert.equal(storage.getItem(BACKUP), originalJSON);
  assert.deepEqual(storage.writes, [BACKUP, STORE]);
});

test('existing backups and explicitly selected versions are never overwritten', () => {
  const priorBackup = 'original backup from the first migration';
  const storage = storageWith({ [STORE]: originalJSON, [BACKUP]: priorBackup });
  assert.equal(migrateStoredState(storage).ok, true);
  assert.equal(storage.getItem(BACKUP), priorBackup);
  assert.deepEqual(storage.writes, [STORE]);

  const selectedJSON = JSON.stringify({ ...legacy, version: '2026_10_27_09_45' });
  const selectedStorage = storageWith({ [STORE]: selectedJSON });
  const result = migrateStoredState(selectedStorage);
  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
  assert.equal(result.state.version, '2026_10_27_09_45');
  assert.equal(selectedStorage.getItem(STORE), selectedJSON);
  assert.equal(selectedStorage.getItem(BACKUP), null);
  assert.deepEqual(selectedStorage.writes, []);
});

test('choosing the old default explicitly survives a subsequent page load', () => {
  const selected = { ...legacy, versionSelectedByUser: true };
  const raw = JSON.stringify(selected);
  const storage = storageWith({ [STORE]: raw });
  const result = migrateStoredState(storage);
  assert.equal(result.ok, true);
  assert.equal(result.changed, false);
  assert.deepEqual(result.state, selected);
  assert.equal(storage.getItem(STORE), raw);
  assert.deepEqual(storage.writes, []);
});

test('valid JSON with an invalid profile envelope is retained without any write', () => {
  for (const value of [null, [], 0, {}, { profiles: null },
      { profiles: [null] }, { profiles: [{ name: 'keep this note' }] }]) {
    const raw = JSON.stringify(value);
    const storage = storageWith({ [STORE]: raw });
    const result = migrateStoredState(storage);
    assert.equal(result.ok, false);
    assert.equal(result.error.stage, 'validate-state');
    assert.equal(storage.getItem(STORE), raw);
    assert.deepEqual(storage.writes, []);
  }
});

test('backup quota failure leaves the original key and in-memory state unchanged', () => {
  const storage = storageWith({ [STORE]: originalJSON }, (operation, key) => {
    if (operation === 'set' && key === BACKUP) quotaError();
  });
  const result = migrateStoredState(storage);
  assert.equal(result.ok, false);
  assert.equal(result.changed, false);
  assert.equal(result.backupCreated, false);
  assert.equal(result.error.stage, 'write-backup');
  assert.equal(result.error.name, 'QuotaExceededError');
  assert.deepEqual(result.state, legacy);
  assert.equal(storage.getItem(STORE), originalJSON);
  assert.equal(storage.getItem(BACKUP), null);
  assert.deepEqual(storage.writes, []);
});

test('state-write failure retains the original state and the one-time backup', () => {
  let rejectWrite = true;
  const storage = storageWith({ [STORE]: originalJSON }, (operation, key) => {
    if (rejectWrite && operation === 'set' && key === STORE) quotaError();
  });
  const failed = migrateStoredState(storage);
  assert.equal(failed.ok, false);
  assert.equal(failed.changed, false);
  assert.equal(failed.backupCreated, true);
  assert.equal(failed.error.stage, 'write-state');
  assert.deepEqual(failed.state, legacy);
  assert.equal(storage.getItem(STORE), originalJSON);
  assert.equal(storage.getItem(BACKUP), originalJSON);
  assert.deepEqual(storage.writes, [BACKUP]);

  rejectWrite = false;
  const retry = migrateStoredState(storage);
  assert.equal(retry.ok, true);
  assert.equal(retry.changed, true);
  assert.equal(retry.backupCreated, false);
  assert.equal(storage.getItem(BACKUP), originalJSON);
  assert.deepEqual(storage.writes, [BACKUP, STORE]);
});

test('read failures, invalid JSON and missing saves never erase or replace data', () => {
  const unreadable = storageWith({ [STORE]: originalJSON }, operation => {
    if (operation === 'get') throw new Error('Storage access denied');
  });
  const failedRead = migrateStoredState(unreadable);
  assert.equal(failedRead.ok, false);
  assert.equal(failedRead.state, null);
  assert.equal(failedRead.error.stage, 'read-state');
  assert.equal(unreadable.data.get(STORE), originalJSON);
  assert.deepEqual(unreadable.writes, []);

  const invalid = storageWith({ [STORE]: '{unfinished' });
  const failedParse = migrateStoredState(invalid);
  assert.equal(failedParse.ok, false);
  assert.equal(failedParse.error.stage, 'parse-state');
  assert.equal(invalid.getItem(STORE), '{unfinished');
  assert.deepEqual(invalid.writes, []);

  const empty = storageWith();
  const missing = migrateStoredState(empty);
  assert.equal(missing.ok, true);
  assert.equal(missing.changed, false);
  assert.equal(missing.state, null);
  assert.deepEqual(empty.writes, []);
});

test('the browser build exposes the same two-function global API', () => {
  const context = vm.createContext({});
  const script = fs.readFileSync(path.join(__dirname, '../js/profile-migration.js'), 'utf8');
  vm.runInContext(script, context);
  assert.equal(typeof context.FMKRProfiles.migrateState, 'function');
  assert.equal(typeof context.FMKRProfiles.migrateStoredState, 'function');
  assert.equal(context.FMKRProfiles.migrateState({ version: legacy.version }).state.version, 'apk_2_11_1');
});

console.log(`${passed} profile migration tests passed`);
