/* TEST WORLD saves are intentionally separate from the archived KR planner. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FMTestState = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const STORE_KEY = 'fmkr_test_world_v1';
  const IMPORT_BACKUP_KEY = STORE_KEY + '_backup_before_import';
  const SCHEMA_VERSION = 1;
  const EQUIPMENT_SLOTS = Object.freeze(['Helmet', 'Armour', 'Gloves', 'Necklace', 'Ring', 'Weapon', 'Shoes', 'Belt']);
  const SKIN_TYPES = Object.freeze(['Helmet', 'Armour', 'Weapon']);
  const BATTLE_SPEEDS = Object.freeze([0.25, 0.5, 1, 2, 4, 8]);
  const LEVEL_TECH = {Helmet: 'HelmetLevelUp', Armour: 'BodyLevelUp', Gloves: 'GloveLevelUp', Necklace: 'NecklaceLevelUp', Ring: 'RingLevelUp', Weapon: 'WeaponLevelUp', Shoes: 'ShoeLevelUp', Belt: 'BeltLevelUp'};
  const ASCENSION_TYPES = {forgeAsc: 'Forge', petAsc: 'Pets', mountAsc: 'Mounts', skillAsc: 'Skills'};
  const CUSTOM_ENEMY_DEFAULTS = Object.freeze({health: 80, damage: 10, count: 1, attackSpeed: 1, range: 0.3});
  // These are TEST WORLD engine bounds, not claims about the original game.
  const ENCOUNTER_STAT_RANGES = Object.freeze({
    health: [1, 1e300], damage: [0, 1e300], attackSpeed: [0.05, 100], attackInterval: [0.05, 1e300],
    windup: [0, 1e300], range: [0, 1e300], moveSpeed: [0, 1e300], criticalChance: [0, 1],
    criticalMultiplier: [0, 1e300], blockChance: [0, 1], doubleChance: [0, 1], lifeSteal: [0, 1e300],
    regen: [0, 1e300], shield: [0, 1e300], reflectChance: [0, 1], criticalDamageReduction: [0, 1],
    nthAttackDamage: [0, 1e300], nthAttackInterval: [0, 1e300], regenDivisor: [0.001, 1e300]
  });
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const object = x => x !== null && typeof x === 'object' && !Array.isArray(x);
  const entries = x => object(x) ? Object.entries(x) : [];
  const values = x => Array.isArray(x) ? x : object(x) ? Object.values(x) : [];
  const finite = x => typeof x === 'number' && Number.isFinite(x);
  const number = x => finite(x) ? x : typeof x === 'string' && x.trim() !== '' && Number.isFinite(Number(x)) ? Number(x) : NaN;
  const sortedNumbers = xs => [...new Set(xs.filter(Number.isSafeInteger))].sort((a, b) => a - b);
  const statType = x => x && x.StatNode && x.StatNode.UniqueStat && x.StatNode.UniqueStat.StatType;

  function createDefaultState() {
    return {
      schemaVersion: SCHEMA_VERSION,
      equipment: Object.fromEntries(EQUIPMENT_SLOTS.map(k => [k, null])),
      pets: [null, null, null],
      skills: [null, null, null],
      mount: null,
      skins: Object.fromEntries(SKIN_TYPES.map(k => [k, null])),
      forgeLevel: 1,
      forgeAsc: 0,
      petAsc: 0,
      mountAsc: 0,
      skillAsc: 0,
      stage: {difficulty: 0, age: 0, battle: 0, wave: 0, customEnemy: null, overrides: {}},
      playerTech: {},
      clanTech: {},
      battle: {speed: 1, auto: false, autoSkills: true},
      manualStats: {}
    };
  }

  // Accept raw config dictionaries, a {configs, gameData} bundle, or the UI catalog.
  function catalogData(catalog) {
    const input = object(catalog) ? catalog : {};
    const raw = object(input.configs) ? Object.assign({}, input.configs, input) : input;
    const ui = input.gameData || input.GameData || input['game-data'] || input;
    const library = (name, list) => own(raw, name) ? raw[name] : Object.fromEntries(values(ui[list]).filter(x => x && x.definition).map(x => [x.key, x.definition]));
    const items = new Map();
    const playable = new Set(values(raw.AutoItemMapping || ui.equipment).map(x => {
      const id = x.ItemId || (x.definition && x.definition.ItemId) || x;
      return [id.Age, id.TypeName || (typeof id.Type === 'string' ? id.Type : x.TypeName), id.Idx].join(':');
    }));
    for (const row of values(library('ItemBalancingLibrary', 'equipment'))) {
      if (!row || !row.ItemId) continue;
      const id = row.ItemId;
      const key = [id.Age, id.Type, id.Idx].join(':');
      if (!EQUIPMENT_SLOTS.includes(id.Type) || id.Age < 0 || id.Age >= 10000 || (playable.size && !playable.has(key))) continue;
      items.set(key, {key, age: id.Age, type: id.Type, idx: id.Idx, definition: row});
    }
    function companions(name, list, idField) {
      const map = new Map();
      const aliases = new Map();
      for (const [rawKey, row] of entries(library(name, list))) {
        const id = row && row[idField];
        if (!id) continue;
        const key = id.Rarity + '_' + id.Id;
        map.set(key, {key, rarity: id.Rarity, id: id.Id, definition: row});
        aliases.set(rawKey, key);
        aliases.set(key, key);
      }
      return {map, aliases};
    }
    const pets = companions('PetLibrary', 'pets', 'PetId');
    const mounts = companions('MountLibrary', 'mounts', 'MountId');
    const skills = new Map();
    for (const [key, row] of entries(library('SkillLibrary', 'skills'))) {
      if (row) skills.set(key, {key, rarity: row.Rarity, definition: row});
    }
    const skins = new Map();
    const skinAliases = new Map();
    for (const [rawKey, row] of entries(library('SkinsLibrary', 'skins'))) {
      const id = row && row.SkinId;
      if (!id || !SKIN_TYPES.includes(id.Type)) continue;
      const key = id.Type + '_' + id.Idx;
      skins.set(key, {key, type: id.Type, idx: id.Idx, definition: row});
      skinAliases.set(rawKey, key);
      skinAliases.set(key, key);
    }
    const rarityRows = values((raw.GameTiers || {}).rarities || ui.rarities);
    const rarityOrder = new Map(rarityRows.map((r, i) => [r.key, finite(r.index) ? r.index : i]));
    for (const row of [...pets.map.values(), ...mounts.map.values(), ...skills.values()]) {
      if (!rarityOrder.has(row.rarity)) rarityOrder.set(row.rarity, rarityOrder.size);
    }
    return {raw, ui, items, pets, mounts, skills, skins, skinAliases, rarityOrder};
  }

  function limitsFrom(data) {
    const raw = data.raw;
    const limits = {
      equipmentLevel: {}, petLevel: {}, mountLevel: {}, skillLevel: {}, skinLevelByKey: {},
      forgeLevel: 1, forgeLevelByAsc: {}, ascension: {}, playerTech: {}, clanTech: {}, clanTechPreset: {},
      stage: {difficulties: [], ages: [], battles: {}, waves: {}}, battleSpeeds: [...BATTLE_SPEEDS]
    };
    // Match upstream mainBattleDifficultyCount: table positions when present;
    // otherwise MainBattleBalancing.MaxDifficultyIdx is 2 (three difficulties).
    const difficultyTable = (raw.MainBattleConfig || {}).DifficultyScaling;
    const difficultyCount = Array.isArray(difficultyTable) && difficultyTable.length ? difficultyTable.length : 3;
    limits.stage.difficulties = Array.from({length: difficultyCount}, (_, index) => index);
    for (const [field, kind] of Object.entries(ASCENSION_TYPES)) {
      const config = (raw.AscensionConfigsLibrary || {})[kind];
      limits.ascension[field] = config && Array.isArray(config.AscensionConfigPerLevel) ? config.AscensionConfigPerLevel.length : 3;
    }
    const extraLevels = {};
    for (const [treeName, tree] of entries(raw.PlayerTechTreePositionLibrary)) {
      for (const node of values(tree.Nodes)) {
        const type = (raw.PlayerTechTreeNodeValuesLibrary || {})[node.Type];
        const tier = type && values(type.Tiers)[node.Tier];
        const levels = tier && values(tier.StatValuePerLevel);
        if (!levels) continue;
        limits.playerTech[treeName + ':' + node.Id] = levels.length;
        extraLevels[node.Type] = (extraLevels[node.Type] || 0) + Math.max(0, ...levels.filter(finite));
      }
    }
    const baseMax = finite((raw.ItemBalancingConfig || {}).ItemBaseMaxLevel) ? raw.ItemBalancingConfig.ItemBaseMaxLevel + 1 : 99;
    for (const slot of EQUIPMENT_SLOTS) limits.equipmentLevel[slot] = Math.max(1, Math.floor(baseMax + (extraLevels[LEVEL_TECH[slot]] || 0)));
    function upgradeLevels(library, output, rows) {
      for (const row of rows.values()) {
        const upgrade = (library || {})[row.rarity];
        const levels = upgrade && values(upgrade.LevelInfo);
        output[row.rarity] = levels && levels.length ? levels.length : 100;
      }
    }
    upgradeLevels(raw.PetUpgradeLibrary, limits.petLevel, data.pets.map);
    upgradeLevels(raw.MountUpgradeLibrary, limits.mountLevel, data.mounts.map);
    const skillUpgradeMax = Math.max(0, ...values(raw.SkillUpgradeLibrary).map(row => number(row.Level)).filter(finite)) + 1;
    for (const row of data.skills.values()) {
      const defined = Math.max(values(row.definition.DamagePerLevel).length, values(row.definition.HealthPerLevel).length);
      limits.skillLevel[row.key] = Math.max(1, skillUpgradeMax, defined);
    }
    limits.skinLevel = Object.fromEntries(SKIN_TYPES.map(type => [type, 0]));
    for (const skin of data.skins.values()) {
      const config = (raw.SkinUpgradeLibrary || {})[skin.type] || {};
      // Game code classifies Idx < 100 as Good. Skin levels start at zero;
      // the last experience row is the maximum, not an additional upgrade.
      const experience = values(config[skin.idx < 100 ? 'GoodSkinsLevelExperience' : 'BadSkinsLevelExperience']);
      limits.skinLevelByKey[skin.key] = Math.max(0, experience.length - 1);
      limits.skinLevel[skin.type] = Math.max(limits.skinLevel[skin.type], limits.skinLevelByKey[skin.key]);
    }
    const forgeRows = values(raw.ForgeUpgradeLibrary);
    const groupedForge = forgeRows.some(row => Array.isArray(row.ForgeLevelConfigs));
    for (let asc = 0; asc <= limits.ascension.forgeAsc; asc++) {
      limits.forgeLevelByAsc[asc] = groupedForge
        ? 1 + forgeRows.filter(row => number(row.AscensionLevel) <= asc).reduce((n, row) => n + values(row.ForgeLevelConfigs).length, 0)
        : 1 + forgeRows.length;
    }
    limits.forgeLevel = Math.max(1, ...Object.values(limits.forgeLevelByAsc));
    for (const [key, row] of entries(raw.GuildTechTreeUpgradeLibrary)) {
      const base = Math.max(0, Math.floor(number(row.MaxLevel) || 0));
      const infinite = finite(row.PointsPerInfiniteLevel) && row.PointsPerInfiniteLevel > 0 && finite(row.ValuePerInfiniteLevel);
      limits.clanTech[key] = infinite ? null : base;
      limits.clanTechPreset[key] = base;
    }
    for (const row of values(raw.MainBattleLibrary)) {
      const id = row && row.BattleId;
      if (!id || !Number.isSafeInteger(id.AgeIdx) || !Number.isSafeInteger(id.BattleIdx)) continue;
      limits.stage.ages.push(id.AgeIdx);
      (limits.stage.battles[id.AgeIdx] || (limits.stage.battles[id.AgeIdx] = [])).push(id.BattleIdx);
      limits.stage.waves[id.AgeIdx + ':' + id.BattleIdx] = sortedNumbers(values(row.Waves).map(w => w.WaveIdx));
    }
    limits.stage.ages = sortedNumbers(limits.stage.ages);
    for (const key of Object.keys(limits.stage.battles)) limits.stage.battles[key] = sortedNumbers(limits.stage.battles[key]);
    return limits;
  }

  function getLimits(catalog) { return limitsFrom(catalogData(catalog)); }

  function validateState(input, catalog) {
    const errors = [], warnings = [];
    const error = (path, message) => errors.push({path, message});
    let visits = 0;
    function copy(value, path, depth) {
      if (++visits > 100000 || depth > 40) { error(path, 'Save is too large or deeply nested.'); return null; }
      if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
      if (typeof value === 'number') {
        if (!finite(value)) error(path, 'Numbers must be finite.');
        return finite(value) ? value : null;
      }
      if (Array.isArray(value)) return value.map((v, i) => copy(v, path + '[' + i + ']', depth + 1));
      if (object(value) && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)) {
        const output = {};
        for (const [key, val] of Object.entries(value)) {
          if (['__proto__', 'prototype', 'constructor'].includes(key)) { error(path + '.' + key, 'Unsafe save key.'); continue; }
          output[key] = copy(val, path + '.' + key, depth + 1);
        }
        return output;
      }
      error(path, 'Expected JSON data.');
      return null;
    }
    if (!object(input)) return {ok: false, state: null, errors: [{path: '$', message: 'Expected a save object.'}], warnings};
    const source = copy(input, '$', 0);
    if (errors.length) return {ok: false, state: null, errors, warnings};
    if (own(source, 'schemaVersion') && source.schemaVersion !== SCHEMA_VERSION) error('schemaVersion', 'Unsupported save version.');
    const state = Object.assign(createDefaultState(), source, {schemaVersion: SCHEMA_VERSION});
    const data = catalogData(catalog);
    const limits = limitsFrom(data);
    function dictionary(value, path, fallback) {
      if (value === undefined) return fallback || {};
      if (!object(value)) { error(path, 'Expected an object.'); return fallback || {}; }
      return value;
    }
    function integer(value, fallback, min, max, path) {
      if (value === undefined) return fallback;
      const n = number(value);
      if (!finite(n)) { error(path, 'Expected a finite number.'); return fallback; }
      const result = Math.max(min, Math.min(max, Math.floor(n)));
      if (result !== n) warnings.push({path, message: 'Level or index adjusted to the catalog range.', from: n, to: result});
      return result;
    }
    function statMap(value, path, nonnegative) {
      const map = dictionary(value, path, {});
      const result = {};
      for (const [key, val] of Object.entries(map)) {
        if (!/^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(key)) { error(path + '.' + key, 'Invalid stat name.'); continue; }
        // Null clears an override; zero is a real override.
        if (val === null) continue;
        const n = number(val);
        if (!finite(n) || (nonnegative && n < 0)) { error(path + '.' + key, 'Expected a ' + (nonnegative ? 'nonnegative ' : '') + 'finite stat.'); continue; }
        result[key] = n;
      }
      return result;
    }
    function enumIndex(value, fallback, choices, path) {
      const n = integer(value, fallback, 0, Number.MAX_SAFE_INTEGER, path);
      if (!choices.length || choices.includes(n)) return n;
      const nearest = choices.reduce((a, b) => Math.abs(b - n) < Math.abs(a - n) ? b : a);
      warnings.push({path, message: 'Index adjusted to an available catalog entry.', from: n, to: nearest});
      return nearest;
    }
    function encounterNumber(value, fallback, range, path) {
      if (value === undefined) return fallback;
      const n = number(value);
      if (!finite(n) || n < 0) { error(path, 'Expected a nonnegative finite stat.'); return fallback; }
      const result = Math.max(range[0], Math.min(range[1], n));
      if (result !== n) warnings.push({path, message: 'Stat adjusted to the TEST WORLD engine range.', from: n, to: result});
      return result;
    }
    function customEnemy(value) {
      const path = 'stage.customEnemy';
      if (value === undefined || value === null) return null;
      if (!object(value)) { error(path, 'Expected custom enemy settings or null.'); return null; }
      const result = {};
      for (const key of Object.keys(value)) if (!own(CUSTOM_ENEMY_DEFAULTS, key)) error(path + '.' + key, 'Unknown custom enemy field.');
      for (const [key, fallback] of Object.entries(CUSTOM_ENEMY_DEFAULTS)) {
        const numberValue = encounterNumber(value[key], fallback, key === 'count' ? [1, 50] : ENCOUNTER_STAT_RANGES[key], path + '.' + key);
        result[key] = key === 'count' ? integer(numberValue, 1, 1, 50, path + '.' + key) : numberValue;
      }
      return result;
    }
    function encounterOverrides(value) {
      const path = 'stage.overrides';
      const input = dictionary(value, path, {});
      const result = {};
      for (const [key, val] of Object.entries(input)) {
        if (val === null) continue;
        if (key === 'ranged') {
          if (typeof val !== 'boolean') error(path + '.ranged', 'Expected true or false.');
          else result.ranged = val;
        } else if (own(ENCOUNTER_STAT_RANGES, key)) {
          result[key] = encounterNumber(val, ENCOUNTER_STAT_RANGES[key][0], ENCOUNTER_STAT_RANGES[key], path + '.' + key);
        } else error(path + '.' + key, 'Unknown encounter stat.');
      }
      return result;
    }
    function manualOverrides(value) {
      const input = dictionary(value, 'manualStats', {});
      const result = {}, seen = {};
      const aliases = {Damage: 'damage', Health: 'health'};
      for (const [inputKey, val] of Object.entries(input)) {
        const key = own(aliases, inputKey) ? aliases[inputKey] : inputKey;
        const path = 'manualStats.' + inputKey;
        if (!own(ENCOUNTER_STAT_RANGES, key)) { error(path, 'Unknown manual combat stat.'); continue; }
        if (val === null) continue;
        const n = number(val);
        if (own(seen, key)) {
          if (!finite(n) || n !== seen[key]) error(path, 'Conflicting values for ' + key + ' and its alias.');
          continue;
        }
        seen[key] = n;
        result[key] = encounterNumber(val, ENCOUNTER_STAT_RANGES[key][0], ENCOUNTER_STAT_RANGES[key], path);
      }
      return result;
    }
    for (const field of Object.keys(ASCENSION_TYPES)) state[field] = integer(state[field], 0, 0, limits.ascension[field], field);
    state.forgeLevel = integer(state.forgeLevel, 1, 1, limits.forgeLevelByAsc[state.forgeAsc], 'forgeLevel');
    const equipment = dictionary(source.equipment, 'equipment', {});
    state.equipment = {};
    for (const key of Object.keys(equipment)) if (!EQUIPMENT_SLOTS.includes(key)) error('equipment.' + key, 'Unknown equipment slot.');
    for (const slot of EQUIPMENT_SLOTS) {
      const item = equipment[slot];
      if (item === undefined || item === null) { state.equipment[slot] = null; continue; }
      if (!object(item)) { error('equipment.' + slot, 'Expected equipment or null.'); state.equipment[slot] = null; continue; }
      const path = 'equipment.' + slot;
      const age = integer(item.age, 0, 0, Number.MAX_SAFE_INTEGER, path + '.age');
      const idx = integer(item.idx, 0, 0, Number.MAX_SAFE_INTEGER, path + '.idx');
      if (item.type !== undefined && item.type !== slot) error(path + '.type', 'Equipment type must match its slot.');
      if (!data.items.has([age, slot, idx].join(':'))) error(path, 'Equipment does not exist in this catalog.');
      state.equipment[slot] = Object.assign({}, item, {
        age, type: slot, idx,
        level: integer(item.level, 1, 1, limits.equipmentLevel[slot], path + '.level'),
        baseStatsOverrides: statMap(item.baseStatsOverrides, path + '.baseStatsOverrides', true),
        secondaryStats: statMap(item.secondaryStats, path + '.secondaryStats', false)
      });
    }
    function selected(value, path, kind) {
      if (value === undefined || value === null) return null;
      if (!object(value)) { error(path, 'Expected a selection or null.'); return null; }
      const group = kind === 'pet' ? data.pets : kind === 'mount' ? data.mounts : null;
      const key = group ? group.aliases.get(value.key) : value.key;
      const row = group ? group.map.get(key) : data.skills.get(key);
      if (!row) { error(path + '.key', 'Selection does not exist in this catalog.'); return null; }
      const max = kind === 'pet' ? limits.petLevel[row.rarity] : kind === 'mount' ? limits.mountLevel[row.rarity] : limits.skillLevel[key];
      const result = Object.assign({}, value, {key, level: integer(value.level, 1, 1, max, path + '.level')});
      if (own(value, 'asc')) result.asc = integer(value.asc, 0, 0, limits.ascension[kind + 'Asc'], path + '.asc');
      if (kind === 'pet') result.secondaryStats = statMap(value.secondaryStats, path + '.secondaryStats', false);
      if (kind === 'mount') {
        result.statsOverrides = statMap(value.statsOverrides, path + '.statsOverrides', true);
        result.secondaryStats = statMap(value.secondaryStats, path + '.secondaryStats', false);
      }
      return result;
    }
    function three(value, path, kind) {
      if (value === undefined) return [null, null, null];
      if (!Array.isArray(value) || value.length > 3) { error(path, 'Expected up to three selections.'); return [null, null, null]; }
      return Array.from({length: 3}, (_, i) => selected(value[i], path + '[' + i + ']', kind));
    }
    state.pets = three(source.pets, 'pets', 'pet');
    state.skills = three(source.skills, 'skills', 'skill');
    state.mount = selected(source.mount, 'mount', 'mount');
    const skins = dictionary(source.skins, 'skins', {});
    state.skins = {};
    for (const key of Object.keys(skins)) if (!SKIN_TYPES.includes(key)) error('skins.' + key, 'Unknown skin slot.');
    for (const type of SKIN_TYPES) {
      const skin = skins[type];
      if (skin === null || skin === undefined) { state.skins[type] = null; continue; }
      const path = 'skins.' + type;
      if (!object(skin)) { error(path, 'Expected a skin or null.'); state.skins[type] = null; continue; }
      const key = data.skinAliases.get(skin.key);
      const row = data.skins.get(key);
      if (!row || row.type !== type) error(path + '.key', 'Skin does not exist in this slot.');
      state.skins[type] = Object.assign({}, skin, {key: key || skin.key, level: integer(skin.level, 0, 0, row ? limits.skinLevelByKey[key] : 0, path + '.level'), statOverrides: statMap(skin.statOverrides, path + '.statOverrides', false)});
    }
    for (const field of ['playerTech', 'clanTech']) {
      state[field] = {};
      for (const [key, val] of Object.entries(dictionary(source[field], field, {}))) {
        if (!own(limits[field], key)) { error(field + '.' + key, 'Technology does not exist in this catalog.'); continue; }
        state[field][key] = integer(val, 0, 0, limits[field][key] === null ? Number.MAX_SAFE_INTEGER : limits[field][key], field + '.' + key);
      }
    }
    const stage = dictionary(source.stage, 'stage', {});
    state.stage = Object.assign({difficulty: 0, age: 0, battle: 0, wave: 0, customEnemy: null, overrides: {}}, stage);
    state.stage.difficulty = enumIndex(stage.difficulty, 0, limits.stage.difficulties, 'stage.difficulty');
    state.stage.age = enumIndex(stage.age, 0, limits.stage.ages, 'stage.age');
    state.stage.battle = enumIndex(stage.battle, 0, limits.stage.battles[state.stage.age] || [0], 'stage.battle');
    state.stage.wave = enumIndex(stage.wave, 0, limits.stage.waves[state.stage.age + ':' + state.stage.battle] || [0], 'stage.wave');
    state.stage.customEnemy = customEnemy(stage.customEnemy);
    state.stage.overrides = encounterOverrides(stage.overrides);
    const battle = dictionary(source.battle, 'battle', {});
    state.battle = Object.assign({speed: 1, auto: false, autoSkills: true}, battle);
    state.battle.speed = number(state.battle.speed);
    if (!BATTLE_SPEEDS.includes(state.battle.speed)) error('battle.speed', 'Unsupported battle speed.');
    if (typeof state.battle.auto !== 'boolean') error('battle.auto', 'Expected true or false.');
    if (typeof state.battle.autoSkills !== 'boolean') error('battle.autoSkills', 'Expected true or false.');
    state.manualStats = manualOverrides(source.manualStats);
    return {ok: errors.length === 0, state: errors.length ? null : state, errors, warnings};
  }

  function createPreset(name, catalog) {
    if (name !== 'starter' && name !== 'max') throw new Error('Unknown preset: ' + name);
    const max = name === 'max';
    const data = catalogData(catalog);
    const limits = limitsFrom(data);
    const state = createDefaultState();
    for (const field of Object.keys(ASCENSION_TYPES)) state[field] = max ? limits.ascension[field] : 0;
    state.forgeLevel = max ? limits.forgeLevel : 1;
    for (const slot of EQUIPMENT_SLOTS) {
      const rows = [...data.items.values()].filter(row => row.type === slot).sort((a, b) => a.age - b.age || a.idx - b.idx);
      const row = max ? rows[rows.length - 1] : rows[0];
      if (row) state.equipment[slot] = {age: row.age, type: slot, idx: row.idx, level: max ? limits.equipmentLevel[slot] : 1, baseStatsOverrides: {}, secondaryStats: {}};
    }
    function order(rows) {
      return [...rows].sort((a, b) => {
        const rarity = data.rarityOrder.get(a.rarity) - data.rarityOrder.get(b.rarity);
        return (max ? -rarity : rarity) || ((a.id === undefined || b.id === undefined) ? a.key.localeCompare(b.key) : a.id - b.id);
      });
    }
    state.pets = order(data.pets.map.values()).slice(0, 3).map(row => ({key: row.key, level: max ? limits.petLevel[row.rarity] : 1}));
    state.skills = order(data.skills.values()).slice(0, 3).map(row => ({key: row.key, level: max ? limits.skillLevel[row.key] : 1}));
    const mount = order(data.mounts.map.values())[0];
    if (mount) state.mount = {key: mount.key, level: max ? limits.mountLevel[mount.rarity] : 1, statsOverrides: {}, secondaryStats: {}};
    if (max) {
      state.playerTech = Object.assign({}, limits.playerTech);
      state.clanTech = Object.assign({}, limits.clanTechPreset);
      for (const type of SKIN_TYPES) {
        const rows = [...data.skins.values()].filter(row => row.type === type).sort((a, b) => limits.skinLevelByKey[a.key] - limits.skinLevelByKey[b.key] || a.idx - b.idx);
        const row = rows[rows.length - 1];
        if (!row) continue;
        const statOverrides = {};
        const count = Number.isSafeInteger(row.definition.MaxStatCount) ? row.definition.MaxStatCount : 0;
        for (const stat of values(row.definition.PossibleStats).slice(0, count)) {
          if (statType(stat) && finite(stat.MaxValue)) statOverrides[statType(stat)] = stat.MaxValue;
        }
        state.skins[type] = {key: row.key, level: limits.skinLevelByKey[row.key], statOverrides};
      }
    }
    // Both presets start at the same battle for useful side-by-side testing.
    const result = validateState(state, catalog);
    if (!result.ok) throw new Error('Catalog cannot produce a valid preset: ' + result.errors.map(x => x.path + ': ' + x.message).join('; '));
    return result.state;
  }

  function failure(error, details) { return Object.assign({ok: false, state: null, error: error instanceof Error ? error.message : String(error)}, details); }

  function loadState(storage, catalog) {
    try {
      const raw = storage.getItem(STORE_KEY);
      if (raw === null) return {ok: true, found: false, state: createPreset('starter', catalog), warnings: []};
      const result = validateState(JSON.parse(raw), catalog);
      return result.ok ? Object.assign({found: true}, result) : failure('Stored TEST WORLD save is invalid.', {found: true, errors: result.errors});
    } catch (error) { return failure(error); }
  }

  function saveState(storage, state, catalog) {
    const result = validateState(state, catalog);
    if (!result.ok) return failure('TEST WORLD save is invalid.', {errors: result.errors});
    try {
      storage.setItem(STORE_KEY, JSON.stringify(result.state));
      return result;
    } catch (error) { return failure(error); }
  }

  function exportState(state, catalog) {
    const result = validateState(state, catalog);
    if (!result.ok) throw new Error('Cannot export invalid TEST WORLD save: ' + result.errors.map(x => x.path + ': ' + x.message).join('; '));
    return JSON.stringify(result.state, null, 2);
  }

  function importState(storage, json, catalog) {
    let result;
    try {
      if (typeof json !== 'string') return failure('Import expects JSON text.');
      result = validateState(JSON.parse(json), catalog);
      if (!result.ok) return failure('Imported TEST WORLD save is invalid.', {errors: result.errors});
      const serialized = JSON.stringify(result.state);
      const previous = storage.getItem(STORE_KEY);
      // Validate and serialize everything first. Web Storage setItem is atomic;
      // a quota/security failure leaves the previous active save intact.
      if (previous !== null) storage.setItem(IMPORT_BACKUP_KEY, previous);
      storage.setItem(STORE_KEY, serialized);
      return Object.assign({backedUp: previous !== null, backupKey: previous === null ? null : IMPORT_BACKUP_KEY}, result);
    } catch (error) { return failure(error); }
  }

  return Object.freeze({STORE_KEY, STORAGE_KEY: STORE_KEY, IMPORT_BACKUP_KEY, SCHEMA_VERSION, EQUIPMENT_SLOTS, SKIN_TYPES, BATTLE_SPEEDS, createDefaultState, getLimits, validateState, createPreset, loadState, saveState, exportState, importState});
});
