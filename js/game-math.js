/* Shared calculations for the verified Forge Master 2.11.1 config schema. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FMKRMath = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';

  const kinds = Object.freeze({
    forge: 'Forge', pet: 'Pets', pets: 'Pets', mount: 'Mounts', mounts: 'Mounts',
    skill: 'Skills', skills: 'Skills'
  });
  const targets = Object.freeze({ Forge: 'Equipment', Pets: 'Pet', Mounts: 'Mount' });

  function number(value, name) {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && value.trim() === '') || !Number.isFinite(Number(value))) {
      throw new TypeError(name + ' must be a finite number');
    }
    return Number(value);
  }

  function kindName(kind) {
    const key = typeof kind === 'string' ? kind.toLowerCase() : '';
    const name = Object.prototype.hasOwnProperty.call(kinds, key) && kinds[key];
    if (!name) throw new RangeError('Unknown kind: ' + String(kind));
    return name;
  }

  /** Display levels are integers starting at 1. Blank/non-finite input becomes 1. */
  function clampLevel(value, max = Number.MAX_SAFE_INTEGER) {
    const limit = number(max, 'max level');
    if (!Number.isSafeInteger(limit) || limit < 1) {
      throw new RangeError('max level must be a positive safe integer');
    }
    const parsed = typeof value === 'number' || typeof value === 'string' ? Number(value) : NaN;
    return Math.min(limit, Math.max(1, Number.isFinite(parsed) ? Math.floor(parsed) : 1));
  }

  /** Each ascension row already contains its complete bonus; never multiply prior rows. */
  function ascensionMultiplier(config, kind, asc, statType = 'Damage', targetKind) {
    const name = kindName(kind);
    const stage = number(asc, 'ascension');
    if (!Number.isSafeInteger(stage) || stage < 0) {
      throw new RangeError('ascension must be a non-negative integer');
    }
    if (stage === 0) return 1;
    const rows = config && config[name] && config[name].AscensionConfigPerLevel;
    if (!Array.isArray(rows) || stage > rows.length) {
      throw new RangeError('No ' + name + ' config for ascension ' + stage);
    }
    const contributions = rows[stage - 1] && rows[stage - 1].StatContributions;
    if (!Array.isArray(contributions)) throw new TypeError('Missing ascension StatContributions');
    const target = targetKind === undefined ? targets[name] : targetKind;
    const matches = contributions.filter(function (entry) {
      const node = entry && entry.StatNode;
      return node && node.UniqueStat && node.UniqueStat.StatType === statType &&
        node.UniqueStat.StatNature === 'Multiplier' &&
        (target === undefined || (node.Target && node.Target.Kind === target));
    });
    if (matches.length !== 1) {
      throw new RangeError('Expected one ' + name + ' ' + statType +
        ' ascension contribution; specify the correct targetKind');
    }
    const result = 1 + number(matches[0].Value, 'ascension Value');
    if (result <= 0 || !Number.isFinite(result)) throw new RangeError('Invalid ascension multiplier');
    return result;
  }

  /** Equipment only. The caller owns technology-dependent equipment level limits. */
  function equipmentValue(base, level, asc, ascensionConfig, levelScalingBase, statType = 'Damage') {
    const value = number(base, 'equipment base value');
    const scaling = number(levelScalingBase, 'LevelScalingBase');
    if (value < 0 || scaling <= 0) throw new RangeError('Invalid equipment value or level scaling');
    const multiplier = ascensionMultiplier(ascensionConfig, 'Forge', asc, statType, 'Equipment');
    const result = value === 0 ? 0 : value * Math.pow(scaling, clampLevel(level) - 1) * multiplier;
    if (!Number.isFinite(result)) throw new RangeError('Equipment value is outside the numeric range');
    return result;
  }

  /** Current probabilities use L-1; reaching the next level uses L. null means MAX. */
  function summonLevel(conf, displayLevel) {
    const rows = conf && conf.Levels;
    if (!Array.isArray(rows) || rows.length === 0) throw new TypeError('Missing summon Levels');
    const maxLevel = rows.length;
    const level = clampLevel(displayLevel, maxLevel);
    const row = rows[level - 1];
    if (!row || typeof row !== 'object') throw new TypeError('Missing summon probability row');
    let nextRequired = null;
    if (level < maxLevel) {
      nextRequired = number(rows[level] && rows[level].SummonsRequired, 'next SummonsRequired');
      if (!Number.isSafeInteger(nextRequired) || nextRequired < 1) {
        throw new RangeError('next SummonsRequired must be a positive integer');
      }
    }
    return { level, row, nextRequired, maxLevel };
  }

  /** discountPercent uses percentage units: 15 means 15%. Defaults to the configured base batch. */
  function summonBatchCost(conf, batch, discountPercent = 0) {
    const amount = number(conf && conf.SingleSummonCost && conf.SingleSummonCost.Amount, 'summon cost');
    const units = number(batch === undefined ? conf && conf.PossibleSummonCount &&
      conf.PossibleSummonCount[0] : batch, 'summon batch');
    const discount = number(discountPercent, 'discount percent');
    if (amount < 0 || !Number.isSafeInteger(units) || units < 1 || discount < 0 || discount > 100) {
      throw new RangeError('Invalid summon amount, batch, or discount percent');
    }
    // SummonConfig.CanAffordSummon rounds the complete discounted batch, not each unit.
    const result = Math.round(amount * units * (1 - discount / 100));
    if (!Number.isFinite(result)) throw new RangeError('Summon cost is outside the numeric range');
    return result;
  }

  /** Without a rarity, returns the largest configured cap. Pass rarity for a selected companion. */
  function companionMaxLevel(kind, upgradeLibrary, rarity) {
    const name = kindName(kind);
    if (!upgradeLibrary || typeof upgradeLibrary !== 'object') throw new TypeError('Missing upgrade library');
    if (name === 'Skills') {
      const rows = Object.values(upgradeLibrary);
      if (rows.length === 0) throw new TypeError('Missing skill upgrades');
      let max = 0;
      for (const row of rows) {
        const level = number(row && row.Level, 'skill upgrade Level');
        if (!Number.isSafeInteger(level) || level < 1) throw new RangeError('Invalid skill upgrade Level');
        max = Math.max(max, level);
      }
      // Upgrade entries 1..99 lead from displayed level 1 to displayed level 100.
      return max + 1;
    }
    if (name !== 'Pets' && name !== 'Mounts') throw new RangeError('Expected Pets, Mounts, or Skills');
    const entries = rarity === undefined ? Object.values(upgradeLibrary) : [upgradeLibrary[rarity]];
    if (entries.length === 0) throw new TypeError('Missing companion upgrades');
    let max = 0;
    for (const entry of entries) {
      const rows = entry && entry.LevelInfo;
      if (!Array.isArray(rows) || rows.length === 0) throw new TypeError('Missing companion LevelInfo');
      if (rows.some(function (row, index) { return !row || row.Level !== index; })) {
        throw new RangeError('Companion LevelInfo must contain contiguous zero-based levels');
      }
      max = Math.max(max, rows.length);
    }
    return max;
  }

  return Object.freeze({ clampLevel, ascensionMultiplier, equipmentValue, summonLevel,
    summonBatchCost, companionMaxLevel });
});
