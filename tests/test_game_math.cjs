'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const math = require('../js/game-math.js');

/* Minimal field projections from 1vcian/fm public/parsed_configs/2026_10_27_09_45.
 * These old-schema tables match the relevant Forge Master 2.11.1 APK fields.
 * Omitting unused costs/stats/probabilities keeps this suite independent of a data download.
 */
const ASCENSION_VALUES = [49, 2499, 124999];
const ASCENSIONS = Object.fromEntries(Object.entries({
  Forge: ['Equipment'], Pets: ['Pet'], Mounts: ['Mount'], Skills: ['ActiveSkill', 'PassiveSkill']
}).map(([kind, targets]) => [kind, {
  Type: kind,
  AscensionConfigPerLevel: ASCENSION_VALUES.map(Value => ({
    StatContributions: targets.flatMap(Kind => ['Damage', 'Health'].map(StatType => ({
      StatNode: { UniqueStat: { StatType, StatNature: 'Multiplier' },
        Layer: 'Ascensions', Condition: 'None', Target: { Kind, Qualifiers: [] } },
      Value
    })))
  }))
}]));
const LEVEL_SCALING_BASE = 1.0100000000093132;
const SKILL_REQUIREMENTS = [2, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 30, 40, 50, 60, 80, 100,
  ...Array(83).fill(110)];
const EGG_REQUIREMENTS = [2, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 9, 10, 11, 12, 13,
  14, 15, 16, 17, 18, 19, 20, 21, 22, ...Array(72).fill(23)];
const SKILL_SUMMON = {
  Id: 'Skills', SingleSummonCost: { Amount: 40, Currency: 'SkillSummonTickets' },
  PossibleSummonCount: [5, 75, 250], Levels: SKILL_REQUIREMENTS.map(SummonsRequired => ({ SummonsRequired }))
};
Object.assign(SKILL_SUMMON.Levels[0], { Common: 1, Rare: 0 });
Object.assign(SKILL_SUMMON.Levels[1], { Common: 0.9994999999180436, Rare: 0.0005000000819563866 });
Object.assign(SKILL_SUMMON.Levels[2], { Common: 0.9990000000689179, Rare: 0.0009999999310821295 });
Object.assign(SKILL_SUMMON.Levels[99], { Common: 0.17500000004656613, Rare: 0.1650000000372529 });
const EGG_SUMMON = {
  Id: 'Eggs', SingleSummonCost: { Amount: 100, Currency: 'Eggshells' },
  PossibleSummonCount: [1, 15, 50], Levels: EGG_REQUIREMENTS.map(SummonsRequired => ({ SummonsRequired }))
};
const MOUNT_SUMMON = {
  Id: 'Mounts', SingleSummonCost: { Amount: 50, Currency: 'ClockWinders' },
  PossibleSummonCount: [1, 15, 50], Levels: Array.from({ length: 100 }, () => ({ SummonsRequired: 20 }))
};
const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Ultimate', 'Mythic'];
// Each actual pet/mount rarity contains exactly Level 0..99.
const PET_UPGRADES = Object.fromEntries(RARITIES.map(Rarity => [Rarity, {
  Rarity, LevelInfo: Array.from({ length: 100 }, (_, Level) => ({ Level }))
}]));
const MOUNT_UPGRADES = structuredClone(PET_UPGRADES);
const SKILL_SHARDS = [2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 5, 5, 5,
  6, 6, 6, 6, 7, 7, 7, 7, ...Array(70).fill(8)];
const SKILL_UPGRADES = Object.fromEntries(SKILL_SHARDS.map((Shards, index) =>
  [String(index + 1), { Level: index + 1, Shards }]));

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
[ASCENSIONS, SKILL_SUMMON, EGG_SUMMON, MOUNT_SUMMON, PET_UPGRADES, MOUNT_UPGRADES, SKILL_UPGRADES]
  .forEach(deepFreeze);

let passed = 0;
function test(name, run) {
  run();
  passed++;
  console.log('ok ' + passed + ' - ' + name);
}
function close(actual, expected) {
  assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-12,
    actual + ' should be close to ' + expected);
}

test('display levels floor decimals, clamp to data, and tolerate an empty numeric input', () => {
  for (const value of [undefined, null, '', 'bad', NaN, Infinity, -Infinity, -5, 0, 1.5]) {
    assert.equal(math.clampLevel(value, 100), 1);
  }
  assert.equal(math.clampLevel('2.9', 100), 2);
  assert.equal(math.clampLevel(100.8, 100), 100);
  assert.equal(math.clampLevel(200, 100), 100);
  assert.equal(math.clampLevel(250), 250);
  assert.throws(() => math.clampLevel(1, 0), RangeError);
  assert.throws(() => math.clampLevel(1, 1.5), RangeError);
});

test('each ascension uses its complete 1/50/2500/125000 multiplier for the right target', () => {
  const expected = [1, 50, 2500, 125000];
  for (const [kind, targets] of Object.entries({
    Forge: ['Equipment'], Pets: ['Pet'], Mounts: ['Mount'], Skills: ['ActiveSkill', 'PassiveSkill']
  })) {
    for (const target of targets) for (const stat of ['Damage', 'Health']) {
      for (let asc = 0; asc < 4; asc++) {
        assert.equal(math.ascensionMultiplier(ASCENSIONS, kind, asc, stat, target), expected[asc]);
      }
    }
  }
  assert.equal(math.ascensionMultiplier(ASCENSIONS, 'forge', '2'), 2500);
  assert.equal(math.ascensionMultiplier(ASCENSIONS, 'pet', 3), 125000);
  assert.equal(math.ascensionMultiplier(null, 'Forge', 0), 1);
});

test('invalid ascension and ambiguous skill targets are reported, never guessed', () => {
  for (const asc of [-1, 1.5, 4, NaN, undefined]) {
    assert.throws(() => math.ascensionMultiplier(ASCENSIONS, 'Forge', asc));
  }
  assert.throws(() => math.ascensionMultiplier(ASCENSIONS, 'Skills', 1), /targetKind/);
  assert.throws(() => math.ascensionMultiplier(ASCENSIONS, 'Forge', 1, 'Damage', 'Pet'), /targetKind/);
  assert.throws(() => math.ascensionMultiplier(ASCENSIONS, 'Forge', 1, 'CriticalChance'), /targetKind/);
  assert.throws(() => math.ascensionMultiplier({}, 'Forge', 1), /No Forge config/);
  assert.throws(() => math.ascensionMultiplier(ASCENSIONS, 'unknown', 0), /Unknown kind/);
  assert.throws(() => math.ascensionMultiplier(ASCENSIONS, 'constructor', 0), /Unknown kind/);
  const broken = structuredClone(ASCENSIONS);
  broken.Forge.AscensionConfigPerLevel[0].StatContributions[0].Value = null;
  assert.throws(() => math.ascensionMultiplier(broken, 'Forge', 1), /finite number/);
});

test('equipment scales both stats with config precision and forge ascension, without a fixed level cap', () => {
  const expectedAtLevel1 = [100, 5000, 250000, 12500000];
  for (let asc = 0; asc < 4; asc++) {
    for (const stat of ['Damage', 'Health']) {
      assert.equal(math.equipmentValue(100, 1, asc, ASCENSIONS, LEVEL_SCALING_BASE, stat), expectedAtLevel1[asc]);
    }
  }
  close(math.equipmentValue(100, 2, 1, ASCENSIONS, LEVEL_SCALING_BASE), 5050.000000046566);
  assert.equal(math.equipmentValue(100, 1.5, 0, ASCENSIONS, LEVEL_SCALING_BASE), 100);
  close(math.equipmentValue(100, 151, 2, ASCENSIONS, LEVEL_SCALING_BASE),
    250000 * Math.pow(LEVEL_SCALING_BASE, 150));
  assert.equal(math.equipmentValue(0, 151, 3, ASCENSIONS, LEVEL_SCALING_BASE), 0);
  assert.throws(() => math.equipmentValue(100, 1, 0, ASCENSIONS, undefined), /finite number/);
  assert.throws(() => math.equipmentValue(100, 1e9, 0, ASCENSIONS, LEVEL_SCALING_BASE), /numeric range/);
});

test('summon probabilities use the current row, and level 2 needs the NEXT row value 4', () => {
  const result = math.summonLevel(SKILL_SUMMON, 2);
  assert.equal(result.level, 2);
  assert.equal(result.maxLevel, 100);
  assert.equal(result.row, SKILL_SUMMON.Levels[1]);
  assert.equal(result.row.Rare, 0.0005000000819563866);
  assert.equal(result.nextRequired, 4);
  assert.equal(math.summonLevel(SKILL_SUMMON, 3).nextRequired, 6);
  assert.equal(math.summonLevel(EGG_SUMMON, 3).nextRequired, 3);
});

test('decimal and out-of-range summon levels are normalized, and 100 is MAX', () => {
  for (const conf of [SKILL_SUMMON, EGG_SUMMON, MOUNT_SUMMON]) {
    assert.equal(math.summonLevel(conf, 1.5).level, 1);
    assert.equal(math.summonLevel(conf, 2.5).row, conf.Levels[1]);
    assert.equal(math.summonLevel(conf, -5).level, 1);
    for (const value of [100, 100.5, 200]) {
      const result = math.summonLevel(conf, value);
      assert.equal(result.level, 100);
      assert.equal(result.row, conf.Levels[99]);
      assert.equal(result.nextRequired, null);
    }
    assert.equal(math.summonLevel(conf, 99).nextRequired, conf.Levels[99].SummonsRequired);
  }
  assert.throws(() => math.summonLevel({ Levels: [] }, 1), /Levels/);
  assert.throws(() => math.summonLevel({ Levels: [{}, {}] }, 1), /SummonsRequired/);
});

test('base and bulk summon costs come from each config, and discount applies before batch rounding', () => {
  assert.equal(math.summonBatchCost(SKILL_SUMMON), 200);
  assert.equal(math.summonBatchCost(EGG_SUMMON), 100);
  assert.equal(math.summonBatchCost(MOUNT_SUMMON), 50);
  assert.equal(math.summonBatchCost(SKILL_SUMMON, 75), 3000);
  assert.equal(math.summonBatchCost(SKILL_SUMMON, 250), 10000);
  assert.equal(math.summonBatchCost(EGG_SUMMON, 15), 1500);
  assert.equal(math.summonBatchCost(MOUNT_SUMMON, 50), 2500);
  assert.equal(math.summonBatchCost(SKILL_SUMMON, 5, 15), 170);
  assert.equal(math.summonBatchCost(MOUNT_SUMMON, 1, 17.6), 41); // 41.2 rounds down, unlike ceil.
  assert.equal(math.summonBatchCost(MOUNT_SUMMON, 1, 15), 43); // 42.5 rounds up.
  assert.equal(math.summonBatchCost(SKILL_SUMMON, 5, 0.9), 198); // Round 198.2 once, not 5 x Round(39.64).
  assert.equal(math.summonBatchCost(MOUNT_SUMMON, 1, 100), 0);
  for (const batch of [0, -1, 1.5, NaN]) assert.throws(() => math.summonBatchCost(SKILL_SUMMON, batch));
  for (const discount of [-1, 101, NaN]) assert.throws(() => math.summonBatchCost(SKILL_SUMMON, 5, discount));
  assert.throws(() => math.summonBatchCost({}), /finite number/);
});

test('companion caps respect zero-based pet/mount rows and 99 skill upgrade transitions', () => {
  for (const rarity of RARITIES) {
    assert.equal(math.companionMaxLevel('Pets', PET_UPGRADES, rarity), 100);
    assert.equal(math.companionMaxLevel('Mounts', MOUNT_UPGRADES, rarity), 100);
  }
  assert.equal(math.companionMaxLevel('pets', PET_UPGRADES), 100);
  assert.equal(math.companionMaxLevel('mount', MOUNT_UPGRADES), 100);
  assert.equal(math.companionMaxLevel('Skills', SKILL_UPGRADES), 100);
  assert.equal(math.clampLevel(200, math.companionMaxLevel('Pets', PET_UPGRADES, 'Mythic')), 100);
  assert.equal(math.clampLevel(300, math.companionMaxLevel('Skills', SKILL_UPGRADES)), 100);
  assert.throws(() => math.companionMaxLevel('Pets', PET_UPGRADES, 'Missing'), /LevelInfo/);
  assert.throws(() => math.companionMaxLevel('Skills', {}), /skill upgrades/);
  assert.throws(() => math.companionMaxLevel('Forge', PET_UPGRADES), /Pets, Mounts, or Skills/);
});

test('browser and CommonJS expose the same pure helper API', () => {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../js/game-math.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.window.FMKRMath), Object.keys(math));
  assert.equal(context.window.FMKRMath.ascensionMultiplier(ASCENSIONS, 'Forge', 3), 125000);
  assert.equal(context.window.FMKRMath.summonLevel(SKILL_SUMMON, 2).nextRequired, 4);
  assert.equal(Object.isFrozen(math), true);
  assert.equal(ASCENSIONS.Forge.AscensionConfigPerLevel[0].StatContributions[0].Value, 49);
  assert.equal(SKILL_SUMMON.Levels.length, 100);
});

console.log('Passed ' + passed + ' game-math test groups.');
