'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = require('../game/engine.js');

// Small independent fixtures exercise the actual public config shapes, not UI internals.
const node = (type, nature = 'Multiplier', target = 'Player', layer = 'None', qualifiers = [], condition = 'None') => ({
  UniqueStat: { StatType: type, StatNature: nature }, Layer: layer, Condition: condition,
  Target: { Kind: target, Qualifiers: qualifiers }
});
const contribution = (type, value) => ({ StatNode: node(type, 'Additive'), Value: value });
const weaponId = { Age: 0, Type: 'Weapon', Idx: 0 };
const weaponKey = engine.itemKey(weaponId);
const companion = "{'Rarity': 'Common', 'Id': 0}";
const fixture = {
  ItemBalancingConfig: { PlayerBaseDamage: 10, PlayerBaseHealth: 80, LevelScalingBase: 1.01,
    PlayerMeleeDamageMultiplier: 1.6, PlayerBaseCritDamage: 0.2, EnemyRangedDamageMultiplier: 0.67 },
  ItemBalancingLibrary: { [weaponKey]: { ItemId: weaponId, EquipmentStats: [contribution('Damage', 100), contribution('Health', 10)] } },
  WeaponLibrary: { [weaponKey]: { AttackRange: 0.3, AttackDuration: 1.5, WindupTime: 0.5, IsRanged: false } },
  PetLibrary: { [companion]: { PetId: { Rarity: 'Common', Id: 0 }, Type: 'Damage' } },
  PetBalancingLibrary: { Damage: { DamageMultiplier: 1.5, HealthMultiplier: 0.5 } },
  PetUpgradeLibrary: { Common: { LevelInfo: [{ Level: 0, PetStats: { Stats: [contribution('Damage', 100), contribution('Health', 800)] } }] } },
  MountLibrary: { [companion]: { MountId: { Rarity: 'Common', Id: 0 } } },
  MountUpgradeLibrary: { Common: { LevelInfo: [{ Level: 0, MountStats: { Stats: [contribution('Damage', 300), contribution('Health', 2400)] } }] } },
  SkillLibrary: {
    Meat: { Type: 'Meat', Rarity: 'Common', DamagePerLevel: [], HealthPerLevel: [100], Cooldown: 8, ActiveDuration: 10 },
    Arrows: { Type: 'Arrows', Rarity: 'Common', DamagePerLevel: [90], HealthPerLevel: [], Cooldown: 7, ActiveDuration: 0 }
  },
  SkillPassiveLibrary: { Common: { LevelStats: [{ Stats: [contribution('Damage', 10), contribution('Health', 80)] }] } },
  TechNodesLibrary: {
    WeaponBonus: { StatNodes: [node('Damage', 'Multiplier', 'Equipment', 'TechTree', [{ Type: 'ItemType', Value: 5 }])] },
    SkillDamage: { StatNodes: [node('Damage', 'Multiplier', 'ActiveSkill', 'TechTree')] }
  },
  PlayerTechTreeNodeValuesLibrary: { WeaponBonus: { Tiers: [{ StatValuePerLevel: [0.1, 0.2, 0.3, 0.4, 0.5] }] } },
  PlayerTechTreePositionLibrary: { Power: { Nodes: [{ Id: 3, Tier: 0, Type: 'WeaponBonus' }] } },
  GuildTechTreeUpgradeLibrary: { WeaponBonus: { MaxLevel: 20, ValuePerLevel: 0.05, ValuePerInfiniteLevel: null },
    SkillDamage: { MaxLevel: 2, ValuePerLevel: 0.1, ValuePerInfiniteLevel: 0.01 } },
  SecondaryStatLibrary: {
    DamageMulti: { StatNodes: [node('Damage'), node('Damage', 'Multiplier', 'ActiveSkill')] },
    CriticalChance: { StatNodes: [node('CriticalChance')] },
    CriticalMulti: { StatNodes: [node('CriticalDamage')] },
    AttackSpeed: { StatNodes: [node('AttackSpeed')] },
    MeleeDamageMulti: { StatNodes: [node('Damage', 'Multiplier', 'Player', 'GeneralCompounding', [], 'Melee')] },
    SkillCooldownMulti: { StatNodes: [node('TimerSpeed', 'OneMinusMultiplier', 'ActiveSkill')] }
  },
  AscensionConfigsLibrary: Object.fromEntries(Object.entries({ Forge: ['Equipment'], Pets: ['Pet'], Mounts: ['Mount'], Skills: ['ActiveSkill', 'PassiveSkill'] })
    .map(([kind, targets]) => [kind, { AscensionConfigPerLevel: [49, 2499, 124999].map(Value => ({
      StatContributions: targets.flatMap(target => ['Damage', 'Health'].map(type => ({ StatNode: node(type, 'Multiplier', target, 'Ascensions'), Value })))
    })) }])),
  SkinsLibrary: { skin: { SkinId: { Type: 'Helmet', Idx: 0 }, BaseSetId: 'TestSet',
    PossibleStats: [{ StatNode: node('Damage', 'Multiplier', 'Player', 'Skins') }] } },
  SkinUpgradeLibrary: { Helmet: { GoodSkinStatIncreasePerLevel: 0.1, GoodSkinsLevelExperience: [100, 800, 2900, 4400],
    BadSkinStatIncreasePerLevel: 0, BadSkinsLevelExperience: [10] } },
  SetsLibrary: { TestSet: { BonusTiers: [{ RequiredPieces: 1, BonusStats: { Stats: [{ StatNode: node('Health', 'Multiplier', 'Player', 'Skins'), Value: 0.1 }] } }] } },
  MainBattleConfig: { EnemyHpDifficultyMulti: 6000000, EnemyDmgDifficultyMulti: 6000000 },
  MainBattleLibrary: { "{'AgeIdx': 0, 'BattleIdx': 0}": { Waves: [{ Enemies: [{ Id: 0, Count: 2 }] }, { Enemies: [{ Id: 0, Count: 1 }] }] } },
  EnemyAgeScalingLibrary: { 0: { Damage: 10, Health: 70 } },
  EnemyLibrary: { 0: { WeaponId: weaponId } }, BaseConfig: { NthAttackInterval: 5, SecondsToFullyRegenerate: 1 }
};
function freeze(value) { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
freeze(fixture);
let passed = 0;
function test(name, run) { run(); console.log(`ok ${++passed} - ${name}`); }
function close(actual, expected) { assert.ok(Math.abs(actual - expected) <= Math.max(1, Math.abs(expected)) * 1e-10, `${actual} != ${expected}`); }
function battle(options = {}) { return engine.createBattle({ stats: { damage: 10, health: 100, range: 20, attackInterval: 1, windup: 0 },
  enemies: [{ x: 2, stats: { damage: 0, health: 1000, moveSpeed: 0, range: 20, attackInterval: 1, windup: 0 } }],
  seed: 123, autoSkills: false, ...options }); }

test('empty build is the configured player base and config input stays immutable', () => {
  const result = engine.buildStats(fixture, {});
  assert.equal(result.stats.damage, 10); assert.equal(result.stats.health, 80);
  close(result.stats.criticalMultiplier, 1.2);
  assert.equal(fixture.ItemBalancingLibrary[weaponKey].EquipmentStats[0].Value, 100);
});
test('equipment scales level, per-slot technology, ascension and melee once each', () => {
  const build = { equipment: [{ id: weaponId, level: 2 }], techLevels: { Power: { 3: 5 } }, ascensions: { forge: 1 } };
  const result = engine.buildStats(fixture, build);
  close(result.stats.damage, 10 + 100 * 1.01 * 1.5 * 50 * 1.6);
  close(result.stats.health, 80 + 10 * 1.01 * 50);
  assert.equal(result.coverage.warnings.length, 0);
});
test('custom item bases still scale and custom mount values replace the current level', () => {
  const result = engine.buildStats(fixture, { equipment: [{ id: weaponKey, level: 2, damage: 250, health: 0 }],
    mount: { id: 'Common_0', level: 99, damage: 900, health: 1200 } });
  close(result.stats.damage, 10 + 250 * 1.01 * 1.6 + 900);
  assert.equal(result.stats.health, 1280);
});
test('pet type, pet ascension, mount and selected skill passives all contribute', () => {
  const result = engine.buildStats(fixture, { pets: [{ id: 'Common_0', level: 1 }], mount: { id: 'Common_0' },
    skills: [{ id: 'Meat' }], ascensions: { pets: 1, mounts: 1, skills: 1 } });
  assert.equal(result.stats.damage, 10 + 150 * 50 + 300 * 50 + 10 * 50);
  assert.equal(result.stats.health, 80 + 400 * 50 + 2400 * 50 + 80 * 50);
  assert.equal(result.skills[0].health, 5000);
});
test('skin rolls, upgrades and active set tiers modify the player independently', () => {
  const result = engine.buildStats(fixture, { skins: [{ id: 'skin', level: 1, stats: { Damage: 0.1 } }] });
  close(result.stats.damage, 12); close(result.stats.health, 88);
});
test('bad skins use their own level cap and do not inherit good-skin growth', () => {
  const config = structuredClone(fixture);
  config.SkinsLibrary.bad = { SkinId: { Type: 'Helmet', Idx: 100 },
    PossibleStats: [{ StatNode: node('Damage', 'Multiplier', 'Player', 'Skins') }] };
  const result = engine.buildStats(config, { skins: [{ id: 'bad', level: 99, stats: { Damage: 0.1 } }] });
  close(result.stats.damage, 11); assert.equal(result.sources[0].level, 0);
});
test('secondary stats on pets and equipment affect combat, including weapon conditions', () => {
  const result = engine.buildStats(fixture, { equipment: [{ id: weaponKey, secondary: { MeleeDamageMulti: 0.5, CriticalMulti: 0.8 } }],
    pets: [{ id: 'Common_0', secondary: { CriticalChance: 0.35, AttackSpeed: 0.2 } }],
    secondary: { DamageMulti: 0.1 } });
  close(result.stats.damage, (10 + 160 + 150) * 1.1 * 1.5);
  close(result.stats.criticalChance, 0.35); close(result.stats.criticalMultiplier, 2); close(result.stats.attackSpeed, 1.2);
});
test('clan tech compounds with personal tech and respects finite/infinite caps', () => {
  const result = engine.buildStats(fixture, { equipment: [{ id: weaponKey }], tech: [{ type: 'WeaponBonus', tier: 0, level: 5 }],
    clanTech: { WeaponBonus: 99, SkillDamage: 5 }, skills: [{ id: 'Arrows' }] });
  close(result.sources.find(x => x.kind === 'equipment').damage, 100 * 1.5 * 2 * 1.6);
  close(result.skills[0].damage, 90 * 1.23);
  assert.equal(result.sources.find(x => x.kind === 'clan tech' && x.id === 'WeaponBonus').level, 20);
});
test('active skills derive their own scaling/cooldowns, separate from weapon tech', () => {
  const result = engine.buildStats(fixture, { skills: [{ id: 'Arrows' }], ascensions: { skills: 2 },
    tech: [{ type: 'WeaponBonus', tier: 0, level: 5 }], secondary: { DamageMulti: 0.1, SkillCooldownMulti: 0.2 } });
  close(result.skills[0].damage, 90 * 2500 * 1.1); close(result.skills[0].cooldown, 5.6);
  assert.equal(result.skills[0].hits, 3);
});
test('unknown selections are reported and manual combat stats are bounded', () => {
  const result = engine.buildStats(fixture, { pets: [{ id: 'Nope_0' }], skills: [{ id: 'Nope' }],
    overrides: { damage: 123, health: 456, criticalChance: 9, attackSpeed: -3 } });
  assert.equal(result.stats.damage, 123); assert.equal(result.stats.health, 456);
  assert.equal(result.stats.criticalChance, 1); assert.equal(result.stats.attackSpeed, 0.05);
  assert.equal(result.coverage.warnings.length, 2);
});
test('explicit zero damage overrides survive equipment and final-stat resolution', () => {
  const zeroItem = engine.buildStats(fixture, { equipment: [{ id: weaponKey, damage: 0 }] });
  assert.equal(zeroItem.stats.damage, 10);
  const zeroTotal = engine.buildStats(fixture, { equipment: [{ id: weaponKey }], overrides: { damage: 0, regen: 0 } });
  assert.equal(zeroTotal.stats.damage, 0); assert.equal(zeroTotal.stats.regen, 0);
});
test('configured enemy count, age scaling and difficulty use actual table values', () => {
  const encounter = engine.buildEncounter(fixture, { age: 0, battle: 0, wave: 0, difficulty: 1 });
  assert.equal(encounter.enemies.length, 2); assert.equal(encounter.waveCount, 2);
  assert.equal(encounter.enemies[0].stats.health, 70 * 6000000);
  assert.equal(encounter.enemies[0].stats.damage, 10 * 6000000);
  assert.throws(() => engine.buildEncounter(fixture, { age: 12 }), /No configured/);
});
test('custom enemy endpoint bypasses missing stages and applies sandbox count/stats', () => {
  const encounter = engine.buildEncounter({}, { customEnemy: { damage: 17, health: 250, count: 3 } });
  assert.equal(encounter.enemies.length, 3); assert.equal(encounter.enemies[2].stats.damage, 17);
  assert.equal(encounter.custom, true); assert.ok(encounter.coverage.warnings[0].includes('TEST WORLD'));
});
test('seeded combat produces identical results at different render frame rates', () => {
  const options = { stats: { damage: 10, health: 100, range: 20, attackInterval: 0.8, criticalChance: 0.4, doubleChance: 0.3 } };
  const a = battle(options), b = battle(options);
  for (let i = 0; i < 200; i++) engine.step(a, 0.05);
  for (let i = 0; i < 600; i++) engine.step(b, 1 / 60);
  assert.equal(a.tick, b.tick); assert.equal(a.enemies[0].hp, b.enemies[0].hp);
  assert.deepEqual(a.events, b.events); assert.deepEqual(a.totals, b.totals);
});
test('guaranteed critical and double attacks cause two separately rolled hits', () => {
  const state = battle({ stats: { damage: 10, health: 100, range: 20, windup: 0, criticalChance: 1, criticalMultiplier: 2, doubleChance: 1 } });
  engine.step(state, 0.05);
  assert.equal(state.enemies[0].hp, 960);
  assert.equal(state.events.filter(x => x.type === 'hit' && x.attackerId === 'player').length, 2);
});
test('block prevents damage and lifesteal; shield absorbs before health', () => {
  const blocked = battle({ enemies: [{ x: 2, stats: { health: 100, damage: 0, blockChance: 1 } }] });
  engine.step(blocked, 0.05); assert.equal(blocked.enemies[0].hp, 100);
  const shielded = battle({ enemies: [{ x: 2, stats: { health: 100, damage: 0, shield: 6 } }] });
  engine.step(shielded, 0.05); assert.equal(shielded.enemies[0].hp, 96); assert.equal(shielded.enemies[0].shield, 0);
});
test('lifesteal and continuous health regeneration restore missing health', () => {
  const state = battle({ stats: { damage: 10, health: 100, range: 20, windup: 0, lifeSteal: 0.5, regen: 0.1 } });
  state.player.hp = 50; engine.step(state, 0.05); close(state.player.hp, 55.5);
  close(state.totals.healing, 5.5);
});
test('reflected hits are included in damage totals without recursive reflection', () => {
  const state = battle({ enemies: [{ x: 2, stats: { damage: 0, health: 1000, reflectChance: 1 } }] });
  engine.step(state, 0.05);
  assert.equal(state.player.hp, 90); assert.equal(state.totals.damageTaken, 10);
  assert.equal(state.events.filter(event => event.source === 'reflect').length, 1);
});
test('movement closes distance and battle reaches victory or defeat', () => {
  const win = battle({ stats: { damage: 1000, health: 100, range: 0.3, moveSpeed: 2, windup: 0 },
    enemies: [{ x: 8, stats: { health: 10, damage: 0, moveSpeed: 0 } }] });
  engine.step(win, 10); assert.equal(win.status, 'victory'); assert.ok(win.player.x > 1); assert.equal(win.totals.kills, 1);
  const loss = battle({ stats: { damage: 0, health: 10 }, enemies: [{ x: 1.1, stats: { damage: 100, health: 100, windup: 0 } }] });
  engine.step(loss, 1); assert.equal(loss.status, 'defeat'); assert.equal(loss.player.hp, 0);
});
test('skills start with a four second charge and manual cooldown prevents repeat casts', () => {
  const skill = engine.buildStats(fixture, { skills: [{ id: 'Arrows' }] }).skills[0];
  const state = battle({ skills: [skill], autoAttack: false });
  assert.equal(engine.useSkill(state, 0), false); engine.step(state, 4);
  assert.equal(engine.useSkill(state, 0), true); assert.equal(engine.useSkill(state, 0), false);
  engine.step(state, 1); close(state.enemies[0].hp, 910); assert.equal(state.skills[0].casts, 1);
});
test('health buff heals on activation then clamps health when duration expires', () => {
  const state = battle({ skills: [{ id: 'Meat', slot: 0, mode: 'buff', damage: 0, health: 100, activeDuration: 1, cooldown: 8 }],
    initialSkillCooldown: 0, autoAttack: false });
  state.player.hp = 50; assert.equal(engine.useSkill(state, 0), true);
  assert.equal(state.player.maxHp, 200); assert.equal(state.player.hp, 150);
  engine.step(state, 1.1); assert.equal(state.player.maxHp, 100); assert.equal(state.player.hp, 100);
  assert.ok(state.skills[0].cooldownRemaining > 7.8);
});
test('auto skills, pause-compatible zero dt, and replay serialization remain usable', () => {
  const state = battle({ skills: [{ id: 'Hit', slot: 0, mode: 'damage', damage: 30, hits: 1, cooldown: 0.5, activeDuration: 0 }],
    autoSkills: true, autoAttack: false, initialSkillCooldown: 0 });
  engine.step(state, 1.2); assert.ok(state.skills[0].casts >= 2);
  const restored = JSON.parse(JSON.stringify(state));
  engine.step(state, 1); engine.step(restored, 1); assert.deepEqual(restored, state);
  const elapsed = state.elapsed; engine.step(state, 0); assert.equal(state.elapsed, elapsed);
  const beforeInvalidStep = JSON.stringify(state);
  assert.throws(() => engine.step(state, -1, [{ type: 'shield', amount: 1000 }]), /dt/);
  assert.equal(JSON.stringify(state), beforeInvalidStep);
});
test('browser and CommonJS share the same sandbox API', () => {
  const context = { window: {} }; vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../game/engine.js'), 'utf8'), context);
  assert.deepEqual(Object.keys(context.window.FMGameEngine), Object.keys(engine));
  assert.equal(context.window.FMGameEngine.buildStats(fixture, {}).stats.health, 80);
});

// Always exercise the installed release used by the UI. FM_CONFIG_DIR can select
// a second release for compatibility checks, but omission never skips this gate.
test('actual release covers every playable equipment, pet, mount, skill, skin and configured stage', () => {
  const configDir = process.env.FM_CONFIG_DIR || path.join(__dirname, '../data/releases/live_2_12_1');
  assert.ok(fs.existsSync(configDir), `Missing game release: ${configDir}`);
  const bundle = path.join(configDir, 'game-configs.json');
  const configs = fs.existsSync(bundle) ? JSON.parse(fs.readFileSync(bundle, 'utf8')) : {};
  const required = ['BaseConfig', 'ItemBalancingConfig', 'ItemBalancingLibrary', 'WeaponLibrary',
    'PetLibrary', 'PetBalancingLibrary', 'PetUpgradeLibrary', 'MountLibrary', 'MountUpgradeLibrary',
    'SkillLibrary', 'SkillPassiveLibrary', 'AscensionConfigsLibrary', 'TechNodesLibrary',
    'PlayerTechTreeNodeValuesLibrary', 'PlayerTechTreePositionLibrary', 'GuildTechTreeUpgradeLibrary',
    'SecondaryStatLibrary', 'SkinsLibrary', 'SkinUpgradeLibrary', 'SetsLibrary',
    'MainBattleLibrary', 'MainBattleConfig', 'EnemyAgeScalingLibrary', 'EnemyLibrary'];
  for (const name of required) {
    if (!fs.existsSync(bundle)) configs[name] = JSON.parse(fs.readFileSync(path.join(configDir, name + '.json'), 'utf8'));
    assert.ok(configs[name] && typeof configs[name] === 'object' && Object.keys(configs[name]).length,
      `Missing or empty required game config: ${name}`);
  }
  let equipment = 0, pets = 0, mounts = 0, skills = 0, skins = 0, stages = 0;
  for (const [id, row] of Object.entries(configs.ItemBalancingLibrary)) {
    if (row.ItemId.Age < 0 || row.ItemId.Age >= 10000) continue;
    const result = engine.buildStats(configs, { equipment: [{ id, level: 100 }], ascensions: { forge: 3 } });
    assert.ok(Number.isFinite(result.stats.damage) && result.stats.health > 0); assert.equal(result.coverage.warnings.length, 0); equipment++;
  }
  for (const id of Object.keys(configs.PetLibrary)) {
    const result = engine.buildStats(configs, { pets: [{ id, level: 100 }], ascensions: { pets: 3 } });
    assert.ok(result.stats.damage > 10 && result.stats.health > 80); assert.equal(result.coverage.warnings.length, 0); pets++;
  }
  for (const id of Object.keys(configs.MountLibrary)) {
    const result = engine.buildStats(configs, { mount: { id, level: 100 }, ascensions: { mounts: 3 } });
    assert.ok(result.stats.damage > 10 && result.stats.health > 80); assert.equal(result.coverage.warnings.length, 0); mounts++;
  }
  for (const id of Object.keys(configs.SkillLibrary)) {
    const result = engine.buildStats(configs, { skills: [{ id, level: 100 }], ascensions: { skills: 3 } });
    assert.equal(result.skills.length, 1); assert.ok(result.skills[0].damage > 0 || result.skills[0].health > 0);
    assert.equal(result.coverage.warnings.length, 0); skills++;
  }
  for (const [id, row] of Object.entries(configs.SkinsLibrary || {})) {
    const rolls = Object.fromEntries((row.PossibleStats || []).map(value => [value.StatNode.UniqueStat.StatType, value.MinValue]));
    const result = engine.buildStats(configs, { skins: [{ id, level: 99, stats: rolls }] });
    assert.ok(Number.isFinite(result.stats.damage) && Number.isFinite(result.stats.health));
    assert.equal(result.coverage.warnings.length, 0); skins++;
  }
  for (const row of Object.values(configs.MainBattleLibrary)) {
    const result = engine.buildEncounter(configs, { age: row.BattleId.AgeIdx, battle: row.BattleId.BattleIdx });
    assert.ok(result.enemies.length > 0); assert.ok(result.enemies.every(x => x.stats.damage >= 0 && x.stats.health > 0)); stages++;
  }
  const manifestPath = path.join(configDir, 'release.json');
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    for (const [key, actual] of Object.entries({ equipmentCount: equipment, petCount: pets, mountCount: mounts,
      skillCount: skills, skinCount: skins })) {
      if (manifest[key] != null) assert.equal(actual, manifest[key], `${key} must match the installed release manifest`);
    }
  }
  console.log(`Config coverage: ${equipment} equipment, ${pets} pets, ${mounts} mounts, ${skills} skills, ${skins} skins, ${stages} stages.`);
});
console.log(`Passed ${passed} sandbox engine test groups.`);
