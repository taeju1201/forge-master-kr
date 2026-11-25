'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {test} = require('node:test');
const state = require('../game/state.js');

const release = path.resolve(__dirname, '../data/releases/live_2_12_1');
const configNames = ['ItemBalancingLibrary', 'ItemBalancingConfig', 'AutoItemMapping', 'GameTiers', 'PetLibrary', 'PetUpgradeLibrary', 'MountLibrary', 'MountUpgradeLibrary', 'SkillLibrary', 'SkillUpgradeLibrary', 'SkinsLibrary', 'SkinUpgradeLibrary', 'PlayerTechTreePositionLibrary', 'PlayerTechTreeNodeValuesLibrary', 'GuildTechTreeUpgradeLibrary', 'AscensionConfigsLibrary', 'ForgeUpgradeLibrary', 'MainBattleLibrary', 'MainBattleConfig'];
const catalog = Object.fromEntries(configNames.map(name => [name, JSON.parse(fs.readFileSync(path.join(release, name + '.json'), 'utf8'))]));
const uiCatalog = JSON.parse(fs.readFileSync(path.join(release, 'game-data.json'), 'utf8'));

function memoryStorage(initial = {}, reject = () => false) {
  const map = new Map(Object.entries(initial));
  const reads = [], writes = [];
  return {
    map, reads, writes,
    getItem(key) { reads.push(key); return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { if (reject(key, value)) throw new Error('Quota exceeded'); writes.push([key, value]); map.set(key, String(value)); }
  };
}

test('default factories return independent full state without reading planner storage', () => {
  const a = state.createDefaultState(), b = state.createDefaultState();
  assert.equal(state.STORE_KEY, 'fmkr_test_world_v1');
  assert.deepEqual(Object.keys(a.equipment), [...state.EQUIPMENT_SLOTS]);
  assert.equal(a.pets.length, 3);
  assert.equal(a.skills.length, 3);
  assert.equal(a.stage.customEnemy, null);
  assert.deepEqual(a.stage.overrides, {});
  assert.equal(a.battle.autoSkills, true);
  a.stage.age = 8;
  a.pets[0] = {key: 'Common_0', level: 4};
  assert.equal(b.stage.age, 0);
  assert.equal(b.pets[0], null);
  const storage = memoryStorage({fmkr_rebuild_v1: '{ "legacy": "untouched" }'});
  const result = state.loadState(storage, catalog);
  assert.equal(result.ok, true);
  assert.equal(result.found, false);
  assert.equal(result.state.equipment.Helmet.age, 0);
  assert.deepEqual(storage.reads, [state.STORE_KEY]);
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.map.get('fmkr_rebuild_v1'), '{ "legacy": "untouched" }');
});

test('partial input merges defaults, preserves all legitimate zero values, and does not mutate input', () => {
  const input = {
    note: {text: 'custom build', number: 0},
    equipment: {Helmet: {age: 0, idx: 0, level: 1, baseStatsOverrides: {Health: 0}, secondaryStats: {CriticalChance: 0, AttackSpeed: -0.1}}},
    pets: [{key: 'Common_0', level: 1, asc: 0, secondaryStats: {AttackSpeed: 0, CriticalChance: 0.5}}],
    mount: {key: 'Common_0', level: 1, statsOverrides: {Damage: 0}},
    skins: {Helmet: {key: 'Helmet_0', level: 0, statOverrides: {Damage: 0}}},
    playerTech: {'Forge:0': 0}, clanTech: {WeaponBonus: 0},
    stage: {difficulty: 0, age: 0, battle: 0, wave: 0},
    manualStats: {Damage: 0, Health: 1, criticalChance: null}
  };
  const before = JSON.stringify(input);
  const result = state.validateState(input, catalog);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(JSON.stringify(input), before);
  const saved = result.state;
  assert.equal(saved.equipment.Helmet.type, 'Helmet');
  assert.equal(saved.equipment.Helmet.baseStatsOverrides.Health, 0);
  assert.equal(saved.equipment.Helmet.secondaryStats.AttackSpeed, -0.1);
  assert.equal(saved.pets[0].asc, 0);
  assert.deepEqual(saved.pets[0].secondaryStats, {AttackSpeed: 0, CriticalChance: 0.5});
  assert.deepEqual(saved.pets.slice(1), [null, null]);
  assert.equal(saved.mount.statsOverrides.Damage, 0);
  assert.equal(saved.skins.Helmet.level, 0);
  assert.equal(saved.skins.Helmet.statOverrides.Damage, 0);
  assert.equal(saved.playerTech['Forge:0'], 0);
  assert.equal(saved.clanTech.WeaponBonus, 0);
  assert.deepEqual(saved.manualStats, {damage: 0, health: 1});
  assert.deepEqual(saved.battle, {speed: 1, auto: false, autoSkills: true});
  assert.deepEqual(saved.note, input.note);
});

test('all current catalog IDs, including new gear, pets, mounts, skills, and skins, validate', () => {
  for (const item of uiCatalog.equipment) {
    const id = item.definition.ItemId;
    const result = state.validateState({equipment: {[id.Type]: {age: id.Age, idx: id.Idx, level: 1}}}, catalog);
    assert.equal(result.ok, true, JSON.stringify({id, errors: result.errors}));
  }
  for (const pet of uiCatalog.pets) assert.equal(state.validateState({pets: [{key: pet.key, level: 100}]}, catalog).ok, true, pet.key);
  for (const mount of uiCatalog.mounts) assert.equal(state.validateState({mount: {key: mount.key, level: 100}}, catalog).ok, true, mount.key);
  for (const skill of uiCatalog.skills) assert.equal(state.validateState({skills: [{key: skill.key, level: 100}]}, catalog).ok, true, skill.key);
  for (const skin of uiCatalog.skins) assert.equal(state.validateState({skins: {[skin.type]: {key: skin.key, level: 0}}}, catalog).ok, true, skin.key);
  assert.equal(uiCatalog.equipment.length, 295);
  assert.equal(uiCatalog.pets.length, 34);
  assert.equal(uiCatalog.mounts.length, 21);
  assert.equal(uiCatalog.skills.length, 27);
  assert.equal(uiCatalog.skins.length, 114);
});

test('unknown IDs, wrong slots, invalid arrays and nonnumeric custom stats are rejected', () => {
  const badInputs = [
    {equipment: {Helmet: {age: 10000, idx: 0}}},
    {equipment: {Helmet: {age: 0, idx: 0, type: 'Weapon'}}},
    {equipment: {Hat: null}},
    {pets: [{key: 'Imaginary_0', level: 1}]},
    {pets: [{key: 'Common_0', secondaryStats: {AttackSpeed: 'invalid'}}]},
    {pets: [{key: 'Common_0', secondaryStats: ['invalid']}]},
    {pets: [null, null, null, null]},
    {mount: {key: 'Eternal_999'}},
    {skills: [{key: 'MissingSkill'}]},
    {skins: {Helmet: {key: 'Weapon_0'}}},
    {playerTech: {'Missing:1': 4}},
    {clanTech: {MissingTech: 2}},
    {manualStats: {Damage: 'banana'}},
    {manualStats: {Damage: -1}},
    {battle: {auto: 'false'}},
    {battle: {autoSkills: 'false'}},
    {battle: {speed: 3}},
    {schemaVersion: 99}
  ];
  for (const input of badInputs) {
    const result = state.validateState(input, catalog);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(result.state, null);
    assert.ok(result.errors.length);
  }
});

test('manual combat stats normalize supported aliases and match engine numeric bounds', () => {
  const result = state.validateState({manualStats: {
    Damage: '0', damage: 0, Health: 0, health: '0', attackSpeed: 0, attackInterval: 0,
    criticalChance: 5, blockChance: 2, shield: 0, moveSpeed: 0, regenDivisor: 0,
    criticalDamageReduction: 2, lifeSteal: 1e301, range: null
  }}, catalog);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.state.manualStats, {
    damage: 0, health: 1, attackSpeed: 0.05, attackInterval: 0.05,
    criticalChance: 1, blockChance: 1, shield: 0, moveSpeed: 0, regenDivisor: 0.001,
    criticalDamageReduction: 1, lifeSteal: 1e300
  });
  assert.ok(result.warnings.length >= 8);
  const engine = require('../game/engine.js');
  const applied = engine.buildStats(catalog, {overrides: result.state.manualStats}).stats;
  for (const [key, value] of Object.entries(result.state.manualStats)) assert.equal(applied[key], value, key);
  const allNumericEngineKeys = Object.fromEntries(Object.entries(engine.buildStats(catalog, {}).stats).filter(([, value]) => typeof value === 'number').map(([key]) => [key, 1]));
  assert.equal(state.validateState({manualStats: allNumericEngineKeys}, catalog).ok, true);
  const storage = memoryStorage();
  const imported = state.importState(storage, JSON.stringify({manualStats: {Damage: 0, Health: 0}}), catalog);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.state.manualStats, {damage: 0, health: 1});
  assert.deepEqual(state.loadState(storage, catalog).state.manualStats, {damage: 0, health: 1});
});

test('conflicting manual aliases and unsupported stat keys reject imports without writing', () => {
  const storage = memoryStorage({[state.STORE_KEY]: 'unchanged'});
  for (const manualStats of [
    {Damage: 1, damage: 2}, {damage: 2, Damage: 1}, {Health: 0, health: 1},
    {health: 0, Health: 'not a number'}, {AttackSpeed: 1}, {unknown: 0},
    {unknown: null}, {ranged: true}, {weaponId: 1}, {criticalChance: -1}
  ]) {
    const imported = state.importState(storage, JSON.stringify({manualStats}), catalog);
    assert.equal(imported.ok, false, JSON.stringify(manualStats));
    assert.equal(storage.map.get(state.STORE_KEY), 'unchanged');
  }
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.reads.length, 0);
  const cleared = state.validateState({manualStats: {Damage: null, Health: null, criticalChance: null}}, catalog);
  assert.equal(cleared.ok, true);
  assert.deepEqual(cleared.state.manualStats, {});
});

test('catalog-derived upgrade caps include gear technology and correct zero-based skin levels', () => {
  const limits = state.getLimits(catalog);
  for (const slot of state.EQUIPMENT_SLOTS) assert.equal(limits.equipmentLevel[slot], 159);
  assert.deepEqual(Object.values(limits.petLevel), Array(9).fill(100));
  assert.deepEqual(Object.values(limits.mountLevel), Array(9).fill(100));
  assert.equal(limits.skillLevel.DeathStar, 100);
  assert.deepEqual(limits.forgeLevelByAsc, {0: 35, 1: 35, 2: 35, 3: 50});
  assert.equal(limits.skinLevelByKey.Helmet_0, 3);
  assert.equal(limits.skinLevelByKey.Helmet_123, 0);
  assert.equal(limits.playerTech['Forge:5'], 1);
  assert.equal(limits.playerTech['Forge:0'], 5);
  assert.equal(limits.clanTech.WeaponBonus, 20);
  assert.equal(limits.clanTech.WarPointsFromForging, null);
  const result = state.validateState({
    forgeAsc: 99, forgeLevel: 999,
    equipment: {Weapon: {age: 12, idx: 0, level: 999}},
    pets: [{key: 'Eternal_0', level: 999, asc: 7}],
    skills: [{key: 'DeathStar', level: 999}],
    mount: {key: 'Eternal_0', level: 999},
    skins: {Helmet: {key: 'Helmet_123', level: 7}, Weapon: {key: 'Weapon_0', level: 99}},
    playerTech: {'Forge:5': 99},
    clanTech: {WeaponBonus: 999, WarPointsFromForging: 250}
  }, catalog);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(result.state.forgeAsc, 3);
  assert.equal(result.state.forgeLevel, 50);
  assert.equal(result.state.equipment.Weapon.level, 159);
  assert.equal(result.state.pets[0].level, 100);
  assert.equal(result.state.pets[0].asc, 3);
  assert.equal(result.state.skills[0].level, 100);
  assert.equal(result.state.mount.level, 100);
  assert.equal(result.state.skins.Helmet.level, 0);
  assert.equal(result.state.skins.Weapon.level, 3);
  assert.equal(result.state.playerTech['Forge:5'], 1);
  assert.equal(result.state.clanTech.WeaponBonus, 20);
  assert.equal(result.state.clanTech.WarPointsFromForging, 250);
  assert.ok(result.warnings.length >= 10);
  assert.equal(state.validateState({forgeAsc: 0, forgeLevel: 50}, catalog).state.forgeLevel, 35);
});

test('stages use actual battle and wave entries rather than equipment era count', () => {
  const limits = state.getLimits(catalog);
  assert.equal(limits.stage.ages.at(-1), 10);
  const result = state.validateState({stage: {difficulty: 7, age: 12, battle: 999, wave: 999}}, catalog);
  assert.equal(result.ok, true);
  assert.deepEqual(result.state.stage, {difficulty: 2, age: 10, battle: 19, wave: 2, customEnemy: null, overrides: {}});
  assert.equal(state.validateState({stage: {wave: 0}}, catalog).state.stage.wave, 0);
});

test('main battle difficulties follow table length or the original three-difficulty fallback', () => {
  assert.equal(catalog.MainBattleConfig.EnemyHpDifficultyMulti, 6000000);
  assert.equal(catalog.MainBattleConfig.DifficultyScaling, undefined);
  assert.deepEqual(state.getLimits(catalog).stage.difficulties, [0, 1, 2]);
  const result = state.validateState({stage: {difficulty: 2}}, catalog);
  assert.equal(result.ok, true);
  assert.equal(result.state.stage.difficulty, 2);
  assert.equal(result.warnings.length, 0);
  const storage = memoryStorage();
  assert.equal(state.importState(storage, state.exportState(result.state, catalog), catalog).ok, true);
  assert.equal(state.loadState(storage, catalog).state.stage.difficulty, 2);
  const withTable = {...catalog, MainBattleConfig: {DifficultyScaling: [{DifficultyIdx: 10}, {DifficultyIdx: 20}, {DifficultyIdx: 30}, {DifficultyIdx: 40}]}};
  assert.deepEqual(state.getLimits(withTable).stage.difficulties, [0, 1, 2, 3]);
  assert.equal(state.validateState({stage: {difficulty: 99}}, withTable).state.stage.difficulty, 3);
  assert.deepEqual(state.getLimits({...catalog, MainBattleConfig: {DifficultyScaling: []}}).stage.difficulties, [0, 1, 2]);
  assert.deepEqual(state.getLimits({...catalog, MainBattleConfig: {DifficultyScaling: null}}).stage.difficulties, [0, 1, 2]);
});

test('custom enemies and encounter overrides retain valid zero values across import/export', () => {
  const input = {
    stage: {
      customEnemy: {health: 1000, damage: 0, count: 3, attackSpeed: 0.5, range: 0},
      overrides: {health: 2000, damage: 0, criticalChance: 0, moveSpeed: 0, shield: 0, ranged: false, regen: null}
    },
    battle: {auto: true, autoSkills: false, speed: 2}
  };
  const before = JSON.stringify(input);
  const result = state.validateState(input, catalog);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.equal(JSON.stringify(input), before);
  assert.deepEqual(result.state.stage.customEnemy, input.stage.customEnemy);
  assert.deepEqual(result.state.stage.overrides, {health: 2000, damage: 0, criticalChance: 0, moveSpeed: 0, shield: 0, ranged: false});
  assert.deepEqual(result.state.battle, input.battle);
  const storage = memoryStorage();
  const imported = state.importState(storage, state.exportState(result.state, catalog), catalog);
  assert.equal(imported.ok, true);
  assert.deepEqual(imported.state, result.state);
  assert.deepEqual(state.loadState(storage, catalog).state, result.state);
  const partial = state.validateState({stage: {customEnemy: {damage: 0}}}, catalog);
  assert.equal(partial.ok, true);
  assert.deepEqual(partial.state.stage.customEnemy, {health: 80, damage: 0, count: 1, attackSpeed: 1, range: 0.3});
  assert.equal(partial.state.battle.autoSkills, true);
});

test('custom enemy counts, speed, health and chance bounds match the sandbox engine', () => {
  const result = state.validateState({stage: {
    customEnemy: {health: 0, damage: 1e301, count: 50.8, attackSpeed: 200, range: 0},
    overrides: {attackSpeed: 0, attackInterval: 0, regenDivisor: 0, criticalChance: 2}
  }}, catalog);
  assert.equal(result.ok, true, JSON.stringify(result.errors));
  assert.deepEqual(result.state.stage.customEnemy, {health: 1, damage: 1e300, count: 50, attackSpeed: 100, range: 0});
  assert.deepEqual(result.state.stage.overrides, {attackSpeed: 0.05, attackInterval: 0.05, regenDivisor: 0.001, criticalChance: 1});
  assert.ok(result.warnings.length >= 8);
  assert.equal(state.validateState({stage: {customEnemy: {count: 2.8}}}, catalog).state.stage.customEnemy.count, 2);
});

test('invalid encounter imports fail before touching the active save or its backup', () => {
  const storage = memoryStorage({[state.STORE_KEY]: 'previous save'});
  for (const input of [
    {stage: {customEnemy: []}},
    {stage: {customEnemy: {health: 'invalid'}}},
    {stage: {customEnemy: {damage: -1}}},
    {stage: {customEnemy: {count: 'many'}}},
    {stage: {customEnemy: {range: null}}},
    {stage: {customEnemy: {stats: {health: 'bad'}}}},
    {stage: {overrides: []}},
    {stage: {overrides: {damage: false}}},
    {stage: {overrides: {health: -20}}},
    {stage: {overrides: {unknown: 1}}},
    {stage: {overrides: {ranged: 1}}},
    {battle: {autoSkills: 0}}
  ]) {
    const result = state.importState(storage, JSON.stringify(input), catalog);
    assert.equal(result.ok, false, JSON.stringify(input));
    assert.equal(storage.map.get(state.STORE_KEY), 'previous save');
  }
  assert.equal(storage.reads.length, 0);
  assert.equal(storage.writes.length, 0);
  assert.equal(state.validateState({stage: {customEnemy: {health: Infinity}}}, catalog).ok, false);
});

test('starter and max presets populate all slots with current available catalog entries', () => {
  const starter = state.createPreset('starter', catalog);
  const max = state.createPreset('max', catalog);
  assert.equal(state.validateState(starter, catalog).ok, true);
  assert.equal(state.validateState(max, catalog).ok, true);
  assert.equal(Object.values(starter.equipment).filter(Boolean).length, 8);
  assert.equal(Object.values(max.equipment).filter(Boolean).length, 8);
  assert.ok(Object.values(starter.equipment).every(item => item.age === 0 && item.level === 1));
  assert.ok(Object.values(max.equipment).every(item => item.age === 12 && item.level === 159));
  assert.deepEqual(max.pets.map(x => x.key), ['Eternal_0', 'Eternal_1', 'Eternal_2']);
  assert.deepEqual(max.skills.map(x => x.key), ['DeathStar', 'EternalLeaves', 'GiantForge']);
  assert.equal(max.mount.key, 'Eternal_0');
  assert.equal(max.mount.level, 100);
  assert.equal(max.forgeLevel, 50);
  assert.deepEqual([max.forgeAsc, max.petAsc, max.mountAsc, max.skillAsc], [3, 3, 3, 3]);
  assert.equal(Object.keys(max.playerTech).length, 318);
  assert.equal(Object.keys(max.clanTech).length, 61);
  assert.equal(max.clanTech.WarPointsFromForging, catalog.GuildTechTreeUpgradeLibrary.WarPointsFromForging.MaxLevel);
  assert.ok(Object.values(max.skins).every(skin => skin && skin.level === 3));
  assert.deepEqual(starter.stage, max.stage);
  assert.deepEqual(max.manualStats, {});
  assert.throws(() => state.createPreset('unknown', catalog), /Unknown preset/);
});

test('limits and presets also accept the bundled configs and UI catalog form', () => {
  const wrapped = {configs: catalog, gameData: uiCatalog};
  assert.deepEqual(state.createPreset('max', wrapped), state.createPreset('max', catalog));
  const definitionsFromUi = Object.assign({}, catalog);
  for (const key of ['ItemBalancingLibrary', 'AutoItemMapping', 'GameTiers', 'PetLibrary', 'MountLibrary', 'SkillLibrary', 'SkinsLibrary']) delete definitionsFromUi[key];
  assert.deepEqual(state.createPreset('max', {configs: definitionsFromUi, gameData: uiCatalog}), state.createPreset('max', catalog));
});

test('invalid imports do not write or overwrite either the active save or archive', () => {
  const initial = '{ "sentinel": true }';
  const storage = memoryStorage({[state.STORE_KEY]: initial, fmkr_rebuild_v1: 'archive'});
  for (const json of ['{broken', 'null', JSON.stringify({pets: [{key: 'invalid'}]}), JSON.stringify({schemaVersion: 2})]) {
    assert.equal(state.importState(storage, json, catalog).ok, false);
    assert.equal(storage.map.get(state.STORE_KEY), initial);
  }
  assert.equal(storage.map.get('fmkr_rebuild_v1'), 'archive');
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.reads.length, 0);
});

test('valid import backs up exact raw previous save and exports a zero-preserving round trip', () => {
  const previous = ' {\n "original" : true\n} ';
  const storage = memoryStorage({[state.STORE_KEY]: previous, fmkr_rebuild_v1: 'archive'});
  const build = state.createPreset('max', catalog);
  build.manualStats = {damage: 0, health: 1};
  build.skins.Helmet.statOverrides = {Damage: 0};
  const json = state.exportState(build, catalog);
  const imported = state.importState(storage, json, catalog);
  assert.equal(imported.ok, true);
  assert.equal(imported.backedUp, true);
  assert.equal(storage.map.get(state.IMPORT_BACKUP_KEY), previous);
  assert.deepEqual(JSON.parse(storage.map.get(state.STORE_KEY)), build);
  assert.deepEqual(state.loadState(storage, catalog).state, build);
  assert.equal(storage.map.get('fmkr_rebuild_v1'), 'archive');
  assert.deepEqual(storage.writes.map(x => x[0]), [state.IMPORT_BACKUP_KEY, state.STORE_KEY]);
});

test('storage failures retain the active save and are reported without throwing', () => {
  const active = '{ "old": 0 }';
  const json = state.exportState(state.createPreset('starter', catalog), catalog);
  for (const rejected of [state.IMPORT_BACKUP_KEY, state.STORE_KEY]) {
    const storage = memoryStorage({[state.STORE_KEY]: active}, key => key === rejected);
    const result = state.importState(storage, json, catalog);
    assert.equal(result.ok, false);
    assert.match(result.error, /Quota exceeded/);
    assert.equal(storage.map.get(state.STORE_KEY), active);
  }
  const denied = {getItem() { throw new Error('Blocked storage'); }, setItem() { throw new Error('Blocked storage'); }};
  assert.equal(state.loadState(denied, catalog).ok, false);
  assert.equal(state.saveState(denied, state.createDefaultState(), catalog).ok, false);
});

test('corrupted stored data is preserved and invalid save/export is rejected', () => {
  const storage = memoryStorage({[state.STORE_KEY]: '{broken'});
  assert.equal(state.loadState(storage, catalog).ok, false);
  assert.equal(storage.map.get(state.STORE_KEY), '{broken');
  assert.equal(state.saveState(storage, {pets: [{key: 'unknown'}]}, catalog).ok, false);
  assert.equal(storage.writes.length, 0);
  assert.throws(() => state.exportState({manualStats: {Damage: Infinity}}, catalog), /Cannot export invalid/);
});

test('unsafe keys, non-JSON values, and cycles are rejected without prototype pollution', () => {
  const unsafe = JSON.parse('{"manualStats":{"__proto__":{"polluted":true}}}');
  assert.equal(state.validateState(unsafe, catalog).ok, false);
  assert.equal({}.polluted, undefined);
  assert.equal(state.validateState({manualStats: {Damage: NaN}}, catalog).ok, false);
  assert.equal(state.validateState({metadata: new Date()}, catalog).ok, false);
  const cycle = {}; cycle.cycle = cycle;
  assert.equal(state.validateState(cycle, catalog).ok, false);
});

test('UMD exposes the same browser API without requiring Node globals', () => {
  const sandbox = {};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../game/state.js'), 'utf8'), sandbox);
  assert.equal(sandbox.FMTestState.STORE_KEY, state.STORE_KEY);
  assert.deepEqual(JSON.parse(JSON.stringify(sandbox.FMTestState.createDefaultState())), state.createDefaultState());
  assert.equal(typeof sandbox.FMTestState.importState, 'function');
});
