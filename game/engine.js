/* Forge Master TEST WORLD: original, deterministic sandbox engine.
 * Config field meanings were checked against the public 1vcian/fm config files and
 * src/engine/{mapStats,enemies,skills,scene}.ts. This is not the game's binary engine.
 * Numbers are config-derived; movement, projectile delivery and time steps are a
 * deliberately simplified sandbox model. No upstream engine implementation is copied.
 * Browser global and CommonJS API. Only step() mutates its explicitly supplied state.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.FMGameEngine = api;
})(typeof window === 'object' ? window : null, function () {
  'use strict';
  const FIXED_STEP = 0.05;
  const ITEM_TYPES = ['Helmet', 'Armour', 'Gloves', 'Necklace', 'Ring', 'Weapon', 'Shoes', 'Belt'];
  const BUFFS = new Set(['Meat', 'Morale', 'Berserk', 'Buff', 'HigherMorale', 'InfiniteRenewal']);
  const MULTI_HITS = { Arrows: 3, Shuriken: 5, Shout: 8, Meteorite: 5, Lightning: 5,
    CannonBarrage: 3, GhostRush: 3, RisingBlades: 3, FiringSquad: 12, BarrelRoll: 3,
    EternalLeaves: 8, RainOfArrows: 15, DeathStar: 8, Stomp: 4 };
  const COMBAT_STATS = new Set(['Damage', 'Health', 'AttackSpeed', 'CriticalChance',
    'CriticalDamage', 'BlockChance', 'DoubleDamageChance', 'LifeSteal', 'HealthRegen',
    'MoveSpeed', 'AttackRange', 'ReflectChance', 'CriticalDamageReduction', 'NthAttackDamage', 'TimerSpeed']);
  const LIMIT = 1e300;
  const num = (v, fallback = 0) => {
    if (v && typeof v === 'object') {
      if (Object.prototype.hasOwnProperty.call(v, 'Value')) return num(v.Value, fallback);
      if (Object.prototype.hasOwnProperty.call(v, 'Raw')) return num(v.Raw, 0) / 50;
    }
    return (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v))
      ? Number(v) : fallback;
  };
  const cap = (v, lo, hi) => Math.min(hi, Math.max(lo, num(v, lo)));
  const safe = v => Number.isFinite(v) ? Math.max(-LIMIT, Math.min(LIMIT, v)) : (v < 0 ? -LIMIT : LIMIT);
  const level = (v, max = 10000) => Math.floor(cap(v == null ? 1 : v, 1, Math.max(1, max)));
  const lib = (configs, name) => configs[name] || configs[name[0].toLowerCase() + name.slice(1)] || {};
  const itemKey = id => `{'Age': ${id.Age ?? id.age}, 'Type': '${id.Type ?? id.type}', 'Idx': ${id.Idx ?? id.idx}}`;
  const companionKey = id => {
    if (typeof id === 'string' && id.startsWith('{')) return id;
    if (typeof id === 'string') {
      const match = /^([A-Za-z]+)_(\d+)$/.exec(id);
      if (match) return `{'Rarity': '${match[1]}', 'Id': ${match[2]}}`;
    }
    return `{'Rarity': '${id && (id.Rarity ?? id.rarity)}', 'Id': ${id && (id.Id ?? id.id)}}`;
  };
  function resolveItem(library, input) {
    const id = input && (input.id ?? input.ItemId ?? input);
    const key = typeof id === 'string' ? id : itemKey(id || {});
    return { key, row: library[key] };
  }
  function coverage() {
    return { model: 'sandbox', configDerived: ['equipment', 'companions', 'skill values', 'technology', 'enemy stage stats'],
      simplified: ['Fixed 0.05-second combat steps and movement',
        'Skill projectiles and areas use simplified hit delivery; this is not an exact game replay',
        'Shields and direct stat overrides are TEST WORLD controls'], unsupported: [], warnings: [] };
  }
  const warn = (report, message) => { if (!report.warnings.includes(message)) report.warnings.push(message); };
  function secondaryEntries(configs, values, label, entries, report) {
    if (!values) return;
    const rows = Array.isArray(values) ? values.map(x => [x.stat ?? x.Stat ?? x.type, x.value ?? x.Value]) : Object.entries(values);
    for (const [key, value] of rows) {
      const nodes = lib(configs, 'SecondaryStatLibrary')[key]?.StatNodes;
      if (!nodes) { warn(report, `Unknown secondary stat: ${key}`); continue; }
      for (const node of nodes) entries.push({ node, value: num(value), label });
    }
  }
  function matches(entry, kind, type, context) {
    const node = entry.node || {};
    const contexts = Array.isArray(context) ? context : [context];
    if (node.Condition && node.Condition !== 'None' && !contexts.includes(node.Condition)) return false;
    const target = node.Target || {};
    if (target.Kind && target.Kind !== kind) return false;
    for (const qualifier of target.Qualifiers || []) {
      if (qualifier.Type === 'ItemType' && ITEM_TYPES[num(qualifier.Value, -1)] !== type) return false;
      if (qualifier.Type !== 'ItemType') return false;
    }
    return true;
  }
  function stat(entries, kind, type, name, base, context, zeroDefault = false) {
    const buckets = {};
    let additive = 0;
    for (const entry of entries) {
      if (!matches(entry, kind, type, context) || entry.node?.UniqueStat?.StatType !== name) continue;
      const nature = entry.node.UniqueStat.StatNature || 'Additive';
      if (nature === 'Additive') { additive += entry.value; continue; }
      const key = `${entry.node.Layer || 'None'}:${nature}`;
      buckets[key] = (buckets[key] || 0) + entry.value;
    }
    let result = base + additive;
    if (zeroDefault) {
      for (const value of Object.values(buckets)) result += value;
      return safe(result);
    }
    for (const [key, value] of Object.entries(buckets)) {
      if (key.endsWith(':OneMinusMultiplier')) result *= Math.max(0, 1 - value);
      else if (key.endsWith(':Divisor')) result /= Math.max(0.001, 1 + value);
      else result *= Math.max(0, 1 + value);
    }
    return safe(result);
  }
  function collectTechnology(configs, build, entries, sources, report) {
    const selected = [...(build.tech || [])];
    for (const [tree, chosen] of Object.entries(build.techLevels || {})) {
      const positions = lib(configs, 'PlayerTechTreePositionLibrary')[tree]?.Nodes || [];
      for (const [id, selectedLevel] of Object.entries(chosen || {})) {
        const position = positions.find(row => String(row.Id) === String(id));
        if (position) selected.push({ type: position.Type, tier: position.Tier, level: selectedLevel });
        else warn(report, `Unknown technology node: ${tree}/${id}`);
      }
    }
    for (const chosen of selected) {
      if (num(chosen.level) <= 0) continue;
      const type = chosen.type ?? chosen.Type;
      const values = lib(configs, 'PlayerTechTreeNodeValuesLibrary')[type]?.Tiers?.[num(chosen.tier ?? chosen.Tier)]?.StatValuePerLevel;
      const nodes = lib(configs, 'TechNodesLibrary')[type]?.StatNodes;
      if (!values?.length || !nodes) { warn(report, `Missing technology config: ${type}`); continue; }
      const selectedLevel = level(chosen.level, values.length);
      const value = num(values[selectedLevel - 1]);
      for (const node of nodes) {
        entries.push({ node, value, label: `tech:${type}` });
        if (!COMBAT_STATS.has(node.UniqueStat?.StatType) && !report.unsupported.includes(type)) report.unsupported.push(type);
      }
      sources.push({ kind: 'tech', id: type, level: selectedLevel, tier: num(chosen.tier ?? chosen.Tier), value });
    }
  }
  function collectAscensions(configs, build, entries, report) {
    for (const [kind, key] of Object.entries({ Forge: 'forge', Pets: 'pets', Mounts: 'mounts', Skills: 'skills' })) {
      const chosen = Math.max(0, Math.floor(num(build.ascensions?.[key] ?? build.ascensions?.[kind] ?? build.ascension)));
      if (!chosen) continue;
      const rows = lib(configs, 'AscensionConfigsLibrary')[kind]?.AscensionConfigPerLevel;
      if (!rows?.[chosen - 1]) { warn(report, `Missing ${kind} ascension ${chosen}`); continue; }
      // Rows contain the entire bonus at that ascension; earlier stages are not multiplied again.
      for (const contribution of rows[chosen - 1].StatContributions || []) {
        entries.push({ node: contribution.StatNode, value: num(contribution.Value), label: `ascension:${kind}:${chosen}` });
      }
    }
  }
  function collectClanTechnology(configs, build, entries, sources, report) {
    for (const [type, chosenLevel] of Object.entries(build.clanTech || {})) {
      const selectedLevel = Math.max(0, Math.floor(num(chosenLevel)));
      if (!selectedLevel) continue;
      const row = lib(configs, 'GuildTechTreeUpgradeLibrary')[type];
      const nodes = lib(configs, 'TechNodesLibrary')[type]?.StatNodes;
      if (!row || !nodes) { warn(report, `Missing clan technology config: ${type}`); continue; }
      const max = Math.max(0, num(row.MaxLevel));
      const effectiveLevel = row.ValuePerInfiniteLevel == null ? Math.min(selectedLevel, max) : selectedLevel;
      const value = Math.min(effectiveLevel, max) * num(row.ValuePerLevel) +
        Math.max(0, effectiveLevel - max) * num(row.ValuePerInfiniteLevel);
      for (const node of nodes) {
        entries.push({ node: { ...node, Layer: 'ClanTechTree' }, value, label: `clan:${type}` });
        if (!COMBAT_STATS.has(node.UniqueStat?.StatType) && !report.unsupported.includes(type)) report.unsupported.push(type);
      }
      sources.push({ kind: 'clan tech', id: type, level: effectiveLevel, value });
    }
  }
  function valuesOfStats(rows) {
    const values = {};
    for (const row of rows || []) {
      const name = row.StatNode?.UniqueStat?.StatType;
      values[name] = (values[name] || 0) + num(row.Value ?? row._legacyValue);
    }
    return values;
  }
  function collectSkins(configs, build, entries, sources, report) {
    const sets = {};
    const skins = [...(build.skins || []), ...(build.equipment || []).flatMap(item => item.skin ? [item.skin] : [])];
    for (const chosen of skins) {
      let id = chosen.id ?? chosen.SkinId;
      if (id && typeof id === 'object') id = `{'Type': '${id.Type ?? id.type}', 'Idx': ${id.Idx ?? id.idx}}`;
      const row = lib(configs, 'SkinsLibrary')[id];
      if (!row) { warn(report, `Unknown skin: ${String(id)}`); continue; }
      const upgrade = lib(configs, 'SkinUpgradeLibrary')[row.SkinId?.Type] || {};
      const good = num(row.SkinId?.Idx) < 100;
      const experience = good ? upgrade.GoodSkinsLevelExperience : upgrade.BadSkinsLevelExperience;
      const maxLevel = experience?.length ? experience.length - 1 : 0;
      const selectedLevel = Math.floor(cap(chosen.level, 0, maxLevel));
      const increase = num(good ? upgrade.GoodSkinStatIncreasePerLevel : upgrade.BadSkinStatIncreasePerLevel);
      const rolls = chosen.stats || {};
      for (const possible of row.PossibleStats || []) {
        const name = possible.StatNode?.UniqueStat?.StatType;
        if (!Object.prototype.hasOwnProperty.call(rolls, name)) continue;
        const value = num(rolls[name]) + increase * selectedLevel;
        entries.push({ node: possible.StatNode, value, label: `skin:${id}` });
      }
      if (!Object.keys(rolls).length) warn(report, `Skin ${id} has no selected stat rolls; appearance only`);
      if (row.BaseSetId) sets[row.BaseSetId] = (sets[row.BaseSetId] || 0) + 1;
      sources.push({ kind: 'skin', id, level: selectedLevel, rolls: { ...rolls } });
    }
    for (const [id, count] of Object.entries(sets)) {
      for (const tier of lib(configs, 'SetsLibrary')[id]?.BonusTiers || []) {
        if (count < tier.RequiredPieces) continue;
        for (const entry of tier.BonusStats?.Stats || []) entries.push({ node: entry.StatNode, value: num(entry.Value), label: `set:${id}` });
        sources.push({ kind: 'set', id, pieces: count, required: tier.RequiredPieces });
      }
    }
  }
  /** Percentages are fractions. Item damage/health overrides replace their LEVEL-ONE base. */
  function buildStats(configs = {}, build = {}) {
    const report = coverage(), sources = [], entries = [];
    const context = build.context || 'None';
    const balancing = lib(configs, 'ItemBalancingConfig');
    const baseDamage = num(balancing.PlayerBaseDamage, 10), baseHealth = num(balancing.PlayerBaseHealth, 80);
    collectTechnology(configs, build, entries, sources, report);
    collectClanTechnology(configs, build, entries, sources, report);
    collectAscensions(configs, build, entries, report);
    collectSkins(configs, build, entries, sources, report);
    secondaryEntries(configs, build.secondary, 'custom secondary', entries, report);
    for (const chosen of [...(build.equipment || []), ...(build.pets || []), ...(build.mount ? [build.mount] : [])]) {
      secondaryEntries(configs, chosen.secondary, chosen.id || 'equipped secondary', entries, report);
    }
    let damage = baseDamage, health = baseHealth;
    let weapon = lib(configs, 'WeaponLibrary')["{'Age': 10000, 'Type': 'Weapon', 'Idx': 0}"] || {};
    let weaponId = null;
    for (const chosen of build.equipment || []) {
      if (!chosen) continue;
      const { key, row } = resolveItem(lib(configs, 'ItemBalancingLibrary'), chosen);
      const type = row?.ItemId?.Type || chosen.type || chosen.slot;
      if (!row && chosen.damage == null && chosen.health == null) { warn(report, `Unknown equipment: ${key}`); continue; }
      const raw = valuesOfStats(row?.EquipmentStats);
      const selectedLevel = level(chosen.level);
      const scaling = Math.pow(num(balancing.LevelScalingBase, 1.01), selectedLevel - 1);
      let itemDamage = Math.max(0, num(chosen.damage, raw.Damage || 0)) * scaling;
      let itemHealth = Math.max(0, num(chosen.health, raw.Health || 0)) * scaling;
      itemDamage = stat(entries, 'Equipment', type, 'Damage', itemDamage, context);
      itemHealth = stat(entries, 'Equipment', type, 'Health', itemHealth, context);
      if (type === 'Weapon') {
        weapon = lib(configs, 'WeaponLibrary')[key] || weapon;
        weaponId = row?.ItemId || chosen.id;
        if (!weapon.IsRanged) itemDamage *= num(balancing.PlayerMeleeDamageMultiplier, 1.6);
      }
      damage += itemDamage; health += itemHealth;
      sources.push({ kind: 'equipment', id: key, type, level: selectedLevel, damage: safe(itemDamage), health: safe(itemHealth) });
    }
    const addCompanion = (chosen, kind) => {
      if (!chosen) return;
      const key = companionKey(chosen.id ?? chosen);
      const row = lib(configs, `${kind}Library`)[key];
      const id = row?.[`${kind}Id`] || (typeof chosen.id === 'object' ? chosen.id : null);
      const rarity = id?.Rarity || chosen.rarity || /^\{'Rarity': '([^']+)'/.exec(key)?.[1];
      const upgrades = lib(configs, `${kind}UpgradeLibrary`)[rarity]?.LevelInfo;
      if (!upgrades?.length && chosen.damage == null && chosen.health == null) { warn(report, `Unknown ${kind.toLowerCase()}: ${key}`); return; }
      const selectedLevel = level(chosen.level, upgrades?.length || 100);
      const values = valuesOfStats(upgrades?.[selectedLevel - 1]?.[`${kind}Stats`]?.Stats);
      const type = kind === 'Pet' ? lib(configs, 'PetBalancingLibrary')[row?.Type] || {} : {};
      const companionDamage = stat(entries, kind, null, 'Damage',
        Math.max(0, num(chosen.damage, values.Damage || 0)) * num(type.DamageMultiplier, 1), context);
      const companionHealth = stat(entries, kind, null, 'Health',
        Math.max(0, num(chosen.health, values.Health || 0)) * num(type.HealthMultiplier, 1), context);
      damage += companionDamage; health += companionHealth;
      sources.push({ kind: kind.toLowerCase(), id: key, rarity, level: selectedLevel, damage: companionDamage, health: companionHealth });
    };
    for (const pet of build.pets || []) addCompanion(pet, 'Pet');
    addCompanion(build.mount, 'Mount');
    const skills = [];
    for (const [slot, chosen] of (build.skills || []).slice(0, 3).entries()) {
      if (!chosen?.id) continue;
      const row = lib(configs, 'SkillLibrary')[chosen.id];
      if (!row) { warn(report, `Unknown skill: ${chosen.id}`); continue; }
      const selectedLevel = level(chosen.level, Math.max(row.DamagePerLevel?.length || 0, row.HealthPerLevel?.length || 0, 1));
      const passive = valuesOfStats(lib(configs, 'SkillPassiveLibrary')[row.Rarity]?.LevelStats?.[selectedLevel - 1]?.Stats);
      const passiveDamage = stat(entries, 'PassiveSkill', null, 'Damage', passive.Damage || 0, context);
      const passiveHealth = stat(entries, 'PassiveSkill', null, 'Health', passive.Health || 0, context);
      damage += passiveDamage; health += passiveHealth;
      sources.push({ kind: 'skill passive', id: chosen.id, level: selectedLevel, damage: passiveDamage, health: passiveHealth });
      skills.push({ id: chosen.id, slot, level: selectedLevel, rarity: row.Rarity,
        damage: Math.max(0, num(chosen.damage, stat(entries, 'ActiveSkill', null, 'Damage', num(row.DamagePerLevel?.[selectedLevel - 1]), context))),
        health: Math.max(0, num(chosen.health, stat(entries, 'ActiveSkill', null, 'Health', num(row.HealthPerLevel?.[selectedLevel - 1]), context))),
        cooldown: Math.max(0, num(chosen.cooldown, stat(entries, 'ActiveSkill', null, 'TimerSpeed', num(row.Cooldown), context))),
        activeDuration: Math.max(0, num(row.ActiveDuration)), mode: BUFFS.has(chosen.id) ? 'buff' : chosen.id === 'Drone' ? 'summon' : 'damage',
        hits: MULTI_HITS[chosen.id] || 1, coverage: BUFFS.has(chosen.id) ? 'Configured timed damage/health buff' : 'Configured total damage; simplified delivery' });
    }
    const playerContext = [context, weapon.IsRanged ? 'Ranged' : 'Melee'];
    damage = stat(entries, 'Player', null, 'Damage', damage, playerContext);
    health = stat(entries, 'Player', null, 'Health', health, playerContext);
    const playerStat = (name, base, zero = false) => stat(entries, 'Player', null, name, base, playerContext, zero);
    const stats = {
      damage: safe(Math.max(0, damage)), health: safe(Math.max(1, health)),
      attackSpeed: cap(playerStat('AttackSpeed', 1), 0.05, 100),
      attackInterval: Math.max(0.05, num(weapon.AttackDuration, 1.5)),
      windup: Math.max(0, num(weapon.WindupTime, 0.5)),
      range: Math.max(0.1, playerStat('AttackRange', num(weapon.AttackRange, 0.3))),
      moveSpeed: Math.max(0, playerStat('MoveSpeed', 2)), ranged: !!weapon.IsRanged, weaponId,
      criticalChance: cap(playerStat('CriticalChance', 0, true), 0, 1),
      criticalMultiplier: Math.max(1, playerStat('CriticalDamage', 1 + num(balancing.PlayerBaseCritDamage, 0.2), true)),
      blockChance: cap(playerStat('BlockChance', 0, true), 0, 1),
      doubleChance: cap(playerStat('DoubleDamageChance', 0, true), 0, 1),
      lifeSteal: Math.max(0, playerStat('LifeSteal', 0, true)), regen: Math.max(0, playerStat('HealthRegen', 0, true)),
      reflectChance: cap(playerStat('ReflectChance', 0, true), 0, 1),
      criticalDamageReduction: cap(playerStat('CriticalDamageReduction', 0, true), 0, 1),
      nthAttackDamage: Math.max(0, playerStat('NthAttackDamage', 0, true)),
      nthAttackInterval: Math.max(0, Math.floor(num(lib(configs, 'BaseConfig').NthAttackInterval, 5))),
      regenDivisor: Math.max(0.001, num(lib(configs, 'BaseConfig').SecondsToFullyRegenerate, 1)), shield: 0
    };
    for (const [key, value] of Object.entries(build.overrides || {})) {
      if (Object.prototype.hasOwnProperty.call(stats, key) && typeof stats[key] === 'number') stats[key] = num(value, stats[key]);
    }
    const normalized = normalizeStats(stats);
    return { stats: normalized, skills, sources, coverage: report };
  }
  function normalizeStats(input = {}) {
    const stats = { damage: 10, health: 80, attackSpeed: 1, attackInterval: 1.5, windup: 0.5, range: 0.3,
      moveSpeed: 2, criticalChance: 0, criticalMultiplier: 1.2, blockChance: 0, doubleChance: 0,
      lifeSteal: 0, regen: 0, shield: 0, reflectChance: 0, criticalDamageReduction: 0,
      nthAttackDamage: 0, nthAttackInterval: 5, regenDivisor: 1, ranged: false, ...input };
    for (const key of ['damage', 'health', 'attackSpeed', 'attackInterval', 'windup', 'range', 'moveSpeed',
      'criticalMultiplier', 'lifeSteal', 'regen', 'shield', 'nthAttackDamage', 'nthAttackInterval', 'regenDivisor']) stats[key] = safe(Math.max(0, num(stats[key])));
    for (const key of ['criticalChance', 'blockChance', 'doubleChance', 'reflectChance', 'criticalDamageReduction']) stats[key] = cap(stats[key], 0, 1);
    stats.health = Math.max(1, stats.health); stats.attackSpeed = cap(stats.attackSpeed, 0.05, 100);
    stats.attackInterval = Math.max(0.05, stats.attackInterval); stats.regenDivisor = Math.max(0.001, stats.regenDivisor);
    return stats;
  }
  function buildEncounter(configs = {}, selection = {}) {
    const report = coverage();
    if (selection.customEnemy) {
      const custom = selection.customEnemy;
      const count = Math.floor(cap(custom.count ?? 1, 1, 50));
      const stats = normalizeStats({ ...(custom.stats || custom), ...(selection.overrides || {}) });
      warn(report, 'Custom enemies use TEST WORLD values, not a configured game stage');
      return { age: null, battle: null, difficulty: null, wave: 0, waveCount: 1, custom: true,
        enemies: Array.from({ length: count }, (_, index) => ({ id: `enemy-${index}`, configId: 'custom',
          x: 8 + (index % 4) * 0.9, y: (Math.floor(index / 4) % 3 - 1) * 0.9, stats: { ...stats } })), coverage: report };
    }
    const age = Math.max(0, Math.floor(num(selection.age)));
    const battle = Math.max(0, Math.floor(num(selection.battle)));
    const difficulty = Math.max(0, Math.floor(num(selection.difficulty)));
    const key = `{'AgeIdx': ${age}, 'BattleIdx': ${battle}}`;
    const row = lib(configs, 'MainBattleLibrary')[key];
    const scaling = lib(configs, 'EnemyAgeScalingLibrary')[String(age)];
    if (!row || !scaling) throw new RangeError(`No configured main stage for age ${age}, battle ${battle}`);
    const waveIndex = Math.floor(cap(selection.wave, 0, Math.max(0, (row.Waves?.length || 1) - 1)));
    const wave = row.Waves?.[waveIndex];
    const config = lib(configs, 'MainBattleConfig');
    const difficultyRow = config.DifficultyScaling?.[Math.min(difficulty, config.DifficultyScaling.length - 1)];
    const hpMulti = difficultyRow ? num(difficultyRow.HpMulti, 1) : Math.pow(num(config.EnemyHpDifficultyMulti, 1), difficulty);
    const damageMulti = difficultyRow ? num(difficultyRow.DmgMulti, 1) : Math.pow(num(config.EnemyDmgDifficultyMulti, 1), difficulty);
    const enemies = [];
    for (const group of wave?.Enemies || []) {
      const enemyRow = lib(configs, 'EnemyLibrary')[group.Id];
      const id = enemyRow?.WeaponId || { Age: 10000, Type: 'Weapon', Idx: 0 };
      const weapon = lib(configs, 'WeaponLibrary')[itemKey(id)] || {};
      for (let count = 0; count < Math.max(0, Math.floor(num(group.Count))); count++) {
        const index = enemies.length;
        const stats = normalizeStats({ damage: safe(num(scaling.Damage) * damageMulti * (weapon.IsRanged ? num(lib(configs, 'ItemBalancingConfig').EnemyRangedDamageMultiplier, 1) : 1)),
          health: safe(num(scaling.Health) * hpMulti), attackInterval: num(weapon.AttackDuration, 1.5),
          windup: num(weapon.WindupTime, 0.5), range: num(weapon.AttackRange, 0.3), ranged: !!weapon.IsRanged,
          criticalMultiplier: 1, ...selection.overrides });
        enemies.push({ id: `enemy-${index}`, configId: group.Id, weaponId: id, x: 8 + (index % 4) * 0.9,
          y: (Math.floor(index / 4) % 3 - 1) * 0.9, stats });
      }
    }
    return { age, battle, difficulty, wave: waveIndex, waveCount: row.Waves?.length || 0, enemies, coverage: report };
  }
  function unit(spec, id, side) {
    const stats = normalizeStats(spec.stats || spec);
    return { id: spec.id || id, side, stats, x: num(spec.x, side === 'player' ? 1 : 8), y: num(spec.y),
      hp: cap(spec.hp == null ? stats.health : spec.hp, 0, stats.health), maxHp: stats.health,
      shield: Math.max(0, stats.shield), cooldown: stats.windup / stats.attackSpeed,
      attackCount: 0, alive: spec.hp == null || num(spec.hp) > 0, facing: side === 'player' ? 1 : -1,
      configId: spec.configId ?? null, weaponId: spec.weaponId ?? null, flash: 0, attackFlash: 0 };
  }
  function createBattle(options = {}) {
    const stats = options.stats || {};
    const enemies = options.enemies || (options.enemy ? [options.enemy] : []);
    return { player: unit({ stats, x: 1, y: 0 }, 'player', 'player'),
      enemies: enemies.map((enemy, index) => unit(enemy, `enemy-${index}`, 'enemy')),
      skills: (options.skills || []).slice(0, 3).map((skill, index) => ({ ...skill,
        slot: skill.slot ?? index, cooldownRemaining: Math.max(0, num(options.initialSkillCooldown, 4)), activeRemaining: 0, casts: 0 })),
      elapsed: 0, tick: 0, accumulator: 0, status: enemies.length ? 'running' : 'victory',
      rng: (num(options.seed, 1) >>> 0) || 1, autoSkills: options.autoSkills !== false,
      autoAttack: options.autoAttack !== false, events: [], eventId: 0, scheduled: [],
      totals: { damageDealt: 0, damageTaken: 0, healing: 0, kills: 0, attacks: 0, skillCasts: 0 },
      coverage: coverage() };
  }
  function random(state) {
    // Deterministic xorshift32, intentionally not the original game's RNG sequence.
    let x = state.rng >>> 0; x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    state.rng = x >>> 0; return state.rng / 4294967296;
  }
  function emit(state, event) {
    state.events.push({ id: ++state.eventId, time: state.elapsed, ...event });
    if (state.events.length > 100) state.events.splice(0, state.events.length - 100);
  }
  function heal(state, target, amount, source) {
    const effective = Math.max(0, Math.min(target.maxHp - target.hp, amount));
    target.hp += effective;
    if (effective > 0) { if (target.side === 'player') state.totals.healing += effective;
      emit(state, { type: 'heal', source, targetId: target.id, amount: effective, x: target.x, y: target.y }); }
  }
  function kill(state, target) {
    if (target.hp > 0 || !target.alive) return;
    target.hp = 0; target.alive = false;
    if (target.side === 'enemy') state.totals.kills++;
    emit(state, { type: 'death', targetId: target.id, x: target.x, y: target.y });
  }
  function hit(state, attacker, target, amount, source, skill = false, details = {}) {
    if (!target?.alive) return;
    const blocked = random(state) < target.stats.blockChance;
    const reflected = random(state) < target.stats.reflectChance;
    const critical = !skill && random(state) < attacker.stats.criticalChance;
    let damage = Math.max(0, amount) * (critical ? attacker.stats.criticalMultiplier * (1 - target.stats.criticalDamageReduction) : 1);
    damage = safe(damage);
    const absorbed = blocked ? 0 : Math.min(target.shield, damage);
    if (!blocked) { target.shield -= absorbed; target.hp -= damage - absorbed; target.flash = 0.18; }
    const dealt = blocked ? 0 : damage - absorbed;
    if (attacker.side === 'player') state.totals.damageDealt += dealt;
    else state.totals.damageTaken += dealt;
    emit(state, { type: 'hit', source, attackerId: attacker.id, targetId: target.id, amount: dealt,
      damage, absorbed, blocked, critical, x: target.x, y: target.y, ...details });
    kill(state, target);
    if (!blocked && !skill && attacker.alive && attacker.stats.lifeSteal > 0) heal(state, attacker, damage * attacker.stats.lifeSteal, 'lifesteal');
    if (!blocked && reflected && !skill && attacker.alive) {
      attacker.hp -= damage;
      if (attacker.side === 'player') state.totals.damageTaken += damage;
      else state.totals.damageDealt += damage;
      emit(state, { type: 'hit', source: 'reflect', targetId: attacker.id, amount: damage, x: attacker.x, y: attacker.y });
      kill(state, attacker);
    }
  }
  function nearest(unitValue, units) {
    return units.filter(other => other.alive).sort((a, b) =>
      Math.hypot(a.x - unitValue.x, a.y - unitValue.y) - Math.hypot(b.x - unitValue.x, b.y - unitValue.y))[0];
  }
  function useSkill(state, slot) {
    const skill = state.skills.find(row => row.slot === slot);
    if (!skill || skill.cooldownRemaining > 1e-9 || skill.activeRemaining > 0 || state.status !== 'running' || !state.player.alive) return false;
    skill.casts++; state.totals.skillCasts++;
    emit(state, { type: 'skill', source: skill.id, skillId: skill.id, slot, x: state.player.x, y: state.player.y });
    if (skill.mode === 'buff') {
      skill.activeRemaining = Math.max(FIXED_STEP, num(skill.activeDuration));
      const priorMax = state.player.maxHp;
      state.player.maxHp += Math.max(0, num(skill.health));
      heal(state, state.player, state.player.maxHp - priorMax, skill.id);
    } else {
      const hits = skill.mode === 'summon' ? Math.max(1, Math.ceil(num(skill.activeDuration, 1))) : Math.max(1, Math.floor(num(skill.hits, 1)));
      const duration = skill.mode === 'summon' ? Math.max(1, num(skill.activeDuration)) : hits > 1 ? Math.min(3.5, 0.15 * hits) : 0;
      for (let i = 0; i < hits; i++) state.scheduled.push({ at: state.elapsed + i * duration / hits,
        damage: num(skill.damage) / hits, skillId: skill.id });
      skill.activeRemaining = Math.max(0, num(skill.activeDuration));
      if (!skill.activeRemaining) skill.cooldownRemaining = Math.max(FIXED_STEP, num(skill.cooldown));
      if (num(skill.health) > 0) heal(state, state.player, num(skill.health), skill.id);
    }
    return true;
  }
  function tick(state) {
    state.tick++; state.elapsed = state.tick * FIXED_STEP;
    for (const skill of state.skills) {
      if (skill.activeRemaining > 0) {
        const wasActive = skill.activeRemaining;
        skill.activeRemaining = Math.max(0, skill.activeRemaining - FIXED_STEP);
        if (skill.activeRemaining < 1e-9) skill.activeRemaining = 0;
        if (wasActive > 0 && skill.activeRemaining === 0) {
          skill.cooldownRemaining = Math.max(FIXED_STEP, num(skill.cooldown));
          if (skill.mode === 'buff') { state.player.maxHp = Math.max(1, state.player.maxHp - num(skill.health)); state.player.hp = Math.min(state.player.hp, state.player.maxHp); }
        }
      } else skill.cooldownRemaining = Math.max(0, skill.cooldownRemaining - FIXED_STEP);
    }
    if (state.autoSkills) for (const skill of state.skills) useSkill(state, skill.slot);
    for (const effect of state.scheduled.filter(row => row.at <= state.elapsed + 1e-9)) {
      // One-target total damage prevents an invented enemy-count damage multiplier.
      const target = nearest(state.player, state.enemies);
      if (target) hit(state, state.player, target, effect.damage, effect.skillId, true, { skillId: effect.skillId });
    }
    state.scheduled = state.scheduled.filter(row => row.at > state.elapsed + 1e-9);
    const units = [state.player, ...state.enemies];
    for (const current of units) {
      if (!current.alive) continue;
      current.flash = Math.max(0, current.flash - FIXED_STEP); current.attackFlash = Math.max(0, current.attackFlash - FIXED_STEP);
      const beforeRegen = current.hp;
      current.hp = Math.min(current.maxHp, current.hp + current.stats.regen * current.stats.health * FIXED_STEP / current.stats.regenDivisor);
      if (current.side === 'player') state.totals.healing += current.hp - beforeRegen;
      const target = current.side === 'player' ? nearest(current, state.enemies) : state.player.alive ? state.player : null;
      if (!target) continue;
      current.facing = target.x >= current.x ? 1 : -1;
      const destination = current.side === 'player' && state.moveTarget ? state.moveTarget : target;
      const dx = destination.x - current.x, dy = destination.y - current.y, distance = Math.hypot(dx, dy);
      const manual = destination !== target;
      const inRange = Math.hypot(target.x - current.x, target.y - current.y) <= current.stats.range + 0.7;
      if ((manual && distance > 0.05) || (!manual && !inRange)) {
        const advance = Math.min(distance, current.stats.moveSpeed * FIXED_STEP);
        if (distance > 0) { current.x += dx / distance * advance; current.y += dy / distance * advance; }
      }
      if (manual && distance <= 0.1) state.moveTarget = null;
      current.cooldown = Math.max(0, current.cooldown - FIXED_STEP);
      if (!inRange || current.cooldown > 1e-9 || (current.side === 'player' && !state.autoAttack)) continue;
      current.attackCount++; current.attackFlash = 0.2;
      let damage = current.stats.damage;
      if (current.side === 'player') {
        state.totals.attacks++;
        for (const skill of state.skills) if (skill.mode === 'buff' && skill.activeRemaining > 0) damage += num(skill.damage);
      }
      if (current.stats.nthAttackInterval > 0 && current.attackCount % current.stats.nthAttackInterval === 0) damage *= 1 + current.stats.nthAttackDamage;
      hit(state, current, target, damage, current.stats.ranged ? 'ranged' : 'melee');
      if (current.alive && target.alive && random(state) < current.stats.doubleChance) hit(state, current, target, damage, 'double attack', false, { double: true });
      current.cooldown = Math.max(FIXED_STEP, current.stats.attackInterval / current.stats.attackSpeed);
    }
    if (!state.player.alive) state.status = 'defeat';
    else if (!state.enemies.some(enemy => enemy.alive)) state.status = 'victory';
    if (state.status !== 'running') emit(state, { type: state.status, x: state.player.x, y: state.player.y });
  }
  /** Mutates only state. Fixed-step accumulator keeps results independent of render FPS. */
  function step(state, dt, actions = []) {
    if (!state || state.status !== 'running') return state;
    const duration = num(dt);
    if (duration < 0 || duration > 60) throw new RangeError('dt must be between 0 and 60 seconds');
    for (const action of actions || []) {
      if (action.type === 'skill') useSkill(state, num(action.slot));
      if (action.type === 'autoSkills') state.autoSkills = !!action.value;
      if (action.type === 'autoAttack') state.autoAttack = !!action.value;
      if (action.type === 'move') state.moveTarget = { x: num(action.x, state.player.x), y: num(action.y, state.player.y) };
      if (action.type === 'shield') state.player.shield = Math.max(0, num(action.amount));
      if (action.type === 'heal') heal(state, state.player, Math.max(0, num(action.amount)), 'sandbox');
    }
    state.accumulator += duration;
    while (state.accumulator + 1e-10 >= FIXED_STEP && state.status === 'running') {
      state.accumulator = Math.max(0, state.accumulator - FIXED_STEP); tick(state);
    }
    return state;
  }
  return Object.freeze({ buildStats, buildEncounter, createBattle, step, useSkill,
    normalizeStats, itemKey, companionKey, FIXED_STEP });
});
