(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FMKRProfiles = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const LEGACY_DEFAULT = '2026_09_08_08_08';
  const DEFAULT_VERSION = 'apk_2_11_1';
  const DEFAULT_STORE = 'fmkr_rebuild_v1';

  // Only the data-version pointer changes. Profiles and unknown fields remain
  // intact, and the caller's state (including its nested objects) is not mutated.
  function migrateState(state, newVersion = DEFAULT_VERSION) {
    if (typeof newVersion !== 'string' || newVersion.length === 0) {
      throw new TypeError('A non-empty data version is required');
    }
    if (!state || typeof state !== 'object' || Array.isArray(state)) {
      return { state, changed: false };
    }
    // A version explicitly picked in Settings stays selected, including the
    // historical version which happened to be the old default.
    if (state.versionSelectedByUser === true) return { state, changed: false };
    const version = state.version;
    const missing = version === undefined || version === null || version === '';
    if ((!missing && version !== LEGACY_DEFAULT) || version === newVersion) {
      return { state, changed: false };
    }
    return { state: { ...state, version: newVersion }, changed: true };
  }

  // Preserve the exact original JSON once, before replacing the existing key.
  // A failed Web Storage setItem is atomic: the old value remains available.
  // On failure return the original parsed state, never an unsaved migration.
  function migrateStoredState(storage, storeKey = DEFAULT_STORE, newVersion = DEFAULT_VERSION) {
    const backupKey = `${storeKey}_backup_before_${newVersion}`;
    let state = null;
    let backupCreated = false;
    let stage = 'read-state';
    const result = (ok, changed, value, error = null) => ({
      ok, changed, state: value, error, backupKey, backupCreated,
    });
    try {
      const originalJSON = storage.getItem(storeKey);
      if (originalJSON === null) return result(true, false, null);

      stage = 'parse-state';
      state = JSON.parse(originalJSON);
      stage = 'validate-state';
      if (!state || typeof state !== 'object' || Array.isArray(state) ||
          !Array.isArray(state.profiles) || state.profiles.some(profile =>
            !profile || typeof profile !== 'object' || Array.isArray(profile) ||
            typeof profile.id !== 'string' || profile.id.length === 0)) {
        throw new TypeError('Saved data does not contain a valid profiles array');
      }
      stage = 'prepare-state';
      const migration = migrateState(state, newVersion);
      if (!migration.changed) return result(true, false, state);
      const migratedJSON = JSON.stringify(migration.state);

      stage = 'read-backup';
      if (storage.getItem(backupKey) === null) {
        stage = 'write-backup';
        storage.setItem(backupKey, originalJSON);
        backupCreated = true;
      }

      stage = 'write-state';
      storage.setItem(storeKey, migratedJSON);
      return result(true, true, migration.state);
    } catch (error) {
      return result(false, false, state, {
        stage,
        name: error && error.name ? error.name : 'Error',
        message: error && error.message ? error.message : String(error),
      });
    }
  }

  return Object.freeze({ migrateState, migrateStoredState });
});
