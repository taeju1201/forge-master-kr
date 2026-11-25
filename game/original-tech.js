/* Forge Master KR — original-style research graph.
 * Geometry follows the pinned game's Tier, Layer and Requirements fields. Icons are
 * the original atlases, using the normalized mapping in assets/ui-original/tech-icons.json.
 * The test world deliberately leaves every level editable, regardless of prerequisites.
 */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FMOriginalTech = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const ICONS = {"player:EquipmentSellPrice":[0,3,0,"장비 판매 가격"],"player:WeaponBonus":[0,4,0,"무기 능력치"],"player:HelmetBonus":[0,5,0,"투구 체력"],"player:BodyBonus":[0,6,0,"갑옷 체력"],"player:ShoeBonus":[0,7,0,"신발 체력"],"player:TechResearchTimer":[0,1,1,"기술 연구 시간"],"player:GloveBonus":[0,2,1,"장갑 공격력"],"player:BeltBonus":[0,3,1,"벨트 체력"],"player:NecklaceBonus":[0,4,1,"목걸이 공격력"],"player:RingBonus":[0,5,1,"반지 공격력"],"player:WeaponLevelUp":[0,6,1,"무기 레벨 상한"],"player:HelmetLevelUp":[0,7,1,"투구 레벨 상한"],"player:BodyLevelUp":[0,0,2,"갑옷 레벨 상한"],"player:ShoeLevelUp":[0,1,2,"신발 레벨 상한"],"player:GloveLevelUp":[0,2,2,"장갑 레벨 상한"],"player:BeltLevelUp":[0,3,2,"벨트 레벨 상한"],"player:NecklaceLevelUp":[0,4,2,"목걸이 레벨 상한"],"player:RingLevelUp":[0,5,2,"반지 레벨 상한"],"player:MountDamage":[0,6,2,"탈것 공격력"],"player:MountHealth":[0,7,2,"탈것 체력"],"player:ExtraMountChance":[0,0,3,"추가 탈것 확률"],"player:MountSummonCost":[0,1,3,"탈것 소환 비용"],"player:ForgeTimerSpeed":[0,2,3,"대장간 업그레이드 시간"],"player:ForgeUpgradeCost":[0,3,3,"대장간 업그레이드 비용"],"player:AutoForge":[0,4,3,"자동 제작"],"player:HammerOfflineReward":[0,5,3,"오프라인 망치"],"player:CoinOfflineReward":[0,6,3,"오프라인 코인"],"player:MaxOfflineReward":[0,7,3,"오프라인 보상 시간"],"player:FreeForgeChance":[0,0,4,"무료 제작 확률"],"player:HammerThiefHammerReward":[0,1,4,"망치 도둑 망치 보상"],"player:HammerThiefCoinReward":[0,2,4,"망치 도둑 코인 보상"],"player:SkillDamage":[0,3,4,"스킬 피해"],"player:SkillPassiveDamage":[0,4,4,"스킬 패시브 공격력"],"player:SkillPassiveHealth":[0,5,4,"스킬 패시브 체력"],"player:GhostTownSkillBonus":[0,6,4,"유령 마을 스킬 보상"],"player:SkillSummonCost":[0,7,4,"스킬 소환 비용"],"player:PetBonusDamage":[0,0,5,"펫 공격력"],"player:PetBonusHealth":[0,1,5,"펫 체력"],"player:ExtraEggChance":[0,2,5,"추가 알 확률"],"player:CommonEggTimer":[0,3,5,"일반 알 부화 시간"],"player:RareEggTimer":[0,4,5,"희귀 알 부화 시간"],"player:EpicEggTimer":[0,5,5,"영웅 알 부화 시간"],"player:LegendaryEggTimer":[0,6,5,"전설 알 부화 시간"],"player:UltimateEggTimer":[0,7,5,"궁극 알 부화 시간"],"player:MythicEggTimer":[0,0,6,"신화 알 부화 시간"],"player:ZombieRushTechPotions":[0,1,6,"좀비 러시 기술 물약"],"player:TechNodeUpgradeCost":[0,2,6,"개인 기술 업그레이드 비용"],"player:HeroicEggTimer":[0,3,6,"영웅급 알 부화 시간"],"player:InfiniteEggTimer":[0,4,6,"무한 알 부화 시간"],"player:EternalEggTimer":[0,5,6,"영원 알 부화 시간"],"clan:WeaponBonus":[0,4,0,"무기 능력치"],"clan:HelmetBonus":[0,5,0,"투구 체력"],"clan:BodyBonus":[0,6,0,"갑옷 체력"],"clan:ShoeBonus":[0,7,0,"신발 체력"],"clan:GloveBonus":[0,2,1,"장갑 공격력"],"clan:BeltBonus":[0,3,1,"벨트 체력"],"clan:NecklaceBonus":[0,4,1,"목걸이 공격력"],"clan:RingBonus":[0,5,1,"반지 공격력"],"clan:SkillDamage":[0,3,4,"스킬 피해"],"clan:PetBonusDamage":[0,0,5,"펫 공격력"],"clan:PetBonusHealth":[0,1,5,"펫 체력"],"clan:MountDamage":[0,6,2,"탈것 공격력"],"clan:MountHealth":[0,7,2,"탈것 체력"],"clan:CommonEggTimer":[0,3,5,"일반 알 부화 시간"],"clan:RareEggTimer":[0,4,5,"희귀 알 부화 시간"],"clan:EpicEggTimer":[0,5,5,"영웅 알 부화 시간"],"clan:LegendaryEggTimer":[0,6,5,"전설 알 부화 시간"],"clan:UltimateEggTimer":[0,7,5,"궁극 알 부화 시간"],"clan:MythicEggTimer":[0,0,6,"신화 알 부화 시간"],"clan:AutoForge":[0,4,3,"자동 제작"],"clan:ForgeAnimationSpeed":[1,5,3,"장비 제작 속도"],"clan:PlayerMoveSpeed":[1,0,3,"이동 속도"],"clan:PlayerAttackRange":[1,0,5,"공격 사거리"],"clan:WarPointsFromForging":[1,0,0,"장비 제작 클랜전 점수"],"clan:WarPointsFromSkillSummon":[1,1,0,"스킬 소환 클랜전 점수"],"clan:WarPointsFromSkillUpgrade":[1,2,0,"스킬 강화 클랜전 점수"],"clan:WarPointsFromTechUpgrade":[1,3,0,"기술 연구 클랜전 점수"],"clan:WarPointsFromForgeSpend":[1,4,0,"망치 소비 클랜전 점수"],"clan:WarPointsFromDungeonKey":[1,5,0,"던전 열쇠 사용 클랜전 점수"],"clan:WarPointsFromEggHatch":[1,6,0,"알 부화 클랜전 점수"],"clan:WarPointsFromPetMerge":[1,7,0,"펫 합성 클랜전 점수"],"clan:WarPointsFromMountSummon":[1,0,1,"탈것 소환 클랜전 점수"],"clan:WarPointsFromMountMerge":[1,1,1,"탈것 합성 클랜전 점수"],"clan:WarPointsOnDay1":[1,2,1,"1일차 클랜전 점수"],"clan:WarPointsOnDay2":[1,3,1,"2일차 클랜전 점수"],"clan:WarPointsOnDay3":[1,4,1,"3일차 클랜전 점수"],"clan:WarPointsOnDay4":[1,5,1,"4일차 클랜전 점수"],"clan:WarPointsOnDay5":[1,6,1,"5일차 클랜전 점수"],"clan:WarPointsOnDay6":[1,7,1,"6일차 클랜전 점수"],"clan:ClanWarDamage":[1,0,2,"클랜전 공격력"],"clan:ClanWarHealth":[1,1,2,"클랜전 체력"],"clan:PersonalWarRewards":[1,2,2,"개인 클랜전 보상"],"clan:ClanWarWinRewards":[1,3,2,"클랜전 승리 보상"],"clan:ClanWarLoseRewards":[1,4,2,"클랜전 패배 보상"],"clan:MissionDamage":[1,5,2,"임무 공격력"],"clan:MissionHealth":[1,6,2,"임무 체력"],"clan:MissionRewards":[1,7,2,"임무 보상"],"clan:HammerThiefDungeonDamage":[1,6,3,"망치 도둑 공격력"],"clan:HammerThiefDungeonHealth":[1,7,3,"망치 도둑 체력"],"clan:GhostTownDungeonDamage":[1,0,4,"유령 마을 공격력"],"clan:GhostTownDungeonHealth":[1,1,4,"유령 마을 체력"],"clan:InvasionDungeonDamage":[1,2,4,"침공 공격력"],"clan:InvasionDungeonHealth":[1,3,4,"침공 체력"],"clan:ZombieRushDungeonDamage":[1,4,4,"좀비 러시 공격력"],"clan:ZombieRushDungeonHealth":[1,5,4,"좀비 러시 체력"],"clan:GuildPotionsFromMissions":[1,1,3,"임무 클랜 물약"],"clan:GuildPotionsFromPersonalWar":[1,2,3,"개인 클랜전 클랜 물약"],"clan:GuildPotionsFromClanWarWin":[1,3,3,"클랜전 승리 클랜 물약"],"clan:GuildPotionsFromClanWarLose":[1,4,3,"클랜전 패배 클랜 물약"],"clan:GuildTechRaceRewardMultiplier":[1,1,5,"기술 경주 보상"],"clan:GuildTechRaceScoreMultiplier":[1,2,5,"기술 경주 점수"]};
  const ASSET_BASE = 'assets/releases/live_2_12_1/';
  const CATEGORY_NAMES = {
    Power: '전투 능력', EggTimers: '알 부화 시간', Special: '특별 기술',
    ClanWar: '클랜전', ClanMissions: '클랜 임무', Dungeons: '던전', ClanTechPotions: '클랜 기술 물약'
  };
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const integer = value => Math.max(0, Math.floor(finite(value)));

  function getIcon(type, guild) {
    return ICONS[(guild ? 'clan:' : 'player:') + type] || ICONS['player:' + type] || ICONS['clan:' + type] || null;
  }

  function nameFor(type, options, guild) {
    const supplied = options.techName ? options.techName(type) : '';
    // Use the host's localized name first; fill its English fallbacks from the icon map.
    if (supplied && /[가-힣]/.test(supplied)) return supplied;
    const icon = getIcon(type, guild);
    return icon && icon[3] || supplied || type;
  }

  function iconMarkup(type, guild) {
    const icon = getIcon(type, guild);
    if (!icon) return '<span class="ot-symbol" aria-hidden="true">?</span>';
    const atlas = icon[0] === 1 ? 'ClanTechTreeIcons.png' : 'TechTreeIcons.png';
    return `<span class="ot-icon" aria-hidden="true" style="background-image:url('${ASSET_BASE}${atlas}');background-position:${icon[1] / 7 * 100}% ${icon[2] / 7 * 100}%"></span>`;
  }

  // Numeric Layers in the config establish vertical order; IDs establish left-to-right
  // order within each row. Every dependency (including those crossing tiers) survives.
  function layout(nodes) {
    const ordered = (Array.isArray(nodes) ? nodes : []).filter(n => n && n.Id !== undefined)
      .slice().sort((a, b) => finite(a.Layer) - finite(b.Layer) || finite(a.Id) - finite(b.Id));
    const layers = new Map();
    for (const node of ordered) {
      const layer = finite(node.Layer);
      if (!layers.has(layer)) layers.set(layer, []);
      layers.get(layer).push(node);
    }
    const placed = [], tiers = [], positions = new Map();
    let y = 0, lastTier = null;
    for (const [layer, row] of layers) {
      const tier = integer(row[0].Tier);
      if (tier !== lastTier) {
        tiers.push({ tier, y: y + 14 });
        y += 52;
        lastTier = tier;
      }
      const centerY = y + 38;
      row.forEach((node, index) => {
        const x = row.length > 2 ? (index + 0.5) * 1000 / row.length : (index + 1) * 1000 / (row.length + 1);
        const item = { node, x, y: centerY, layer, tier, column: index, columns: row.length };
        placed.push(item);
        positions.set(String(node.Id), item);
      });
      y += 132;
    }
    const edges = [];
    for (const to of placed) {
      for (const requirement of to.node.Requirements || []) {
        const from = positions.get(String(requirement));
        if (from) edges.push({ from, to });
      }
    }
    return { nodes: placed, edges, tiers, height: Math.max(132, y + 8) };
  }

  function effectLabel(value, type, options, guild) {
    if (!value) return '레벨을 입력해 바로 적용';
    const format = options.format || (n => String(Number(n.toFixed(2))));
    const statNodes = options.configs.TechNodesLibrary && options.configs.TechNodesLibrary[type] && options.configs.TechNodesLibrary[type].StatNodes || [];
    const additive = statNodes.some(n => n.UniqueStat && n.UniqueStat.StatNature === 'Additive');
    if (additive || type === 'AutoForge' || /LevelUp$/.test(type) || type === 'PlayerAttackRange') return `연구 효과 ${format(value)}`;
    return `연구 효과 ${format(value * 100)}%`;
  }

  function renderNode(node, options, position, guild) {
    const state = options.state || {}, limits = options.limits || {}, E = options.escape || esc;
    const tree = options.tree, type = node.Type;
    const key = guild ? type : `${tree}:${node.Id}`;
    const values = guild ? state.clanTech || {} : state.playerTech || {};
    const caps = guild ? limits.clanTech || {} : limits.playerTech || {};
    const value = integer(values[key]);
    let maximum = caps[key];
    if (maximum === undefined) {
      maximum = guild ? node.MaxLevel : (options.configs.PlayerTechTreeNodeValuesLibrary[type]?.Tiers?.[node.Tier]?.StatValuePerLevel || []).length;
    }
    const infinite = maximum === null;
    const max = infinite ? null : integer(maximum);
    const title = nameFor(type, options, guild);
    const id = `ot-${guild ? 'guild' : tree}-${guild ? type : node.Id}`;
    const label = `${title}${guild ? '' : ` ${integer(node.Tier) + 1}단계`} 연구 레벨`;
    const learned = value > 0, maxed = !infinite && max > 0 && value >= max;
    let effect = 0;
    if (guild) {
      effect = Math.min(value, integer(node.MaxLevel)) * finite(node.ValuePerLevel);
      if (infinite && value > integer(node.MaxLevel)) effect += (value - integer(node.MaxLevel)) * finite(node.ValuePerInfiniteLevel);
    } else {
      const levels = options.configs.PlayerTechTreeNodeValuesLibrary[type]?.Tiers?.[node.Tier]?.StatValuePerLevel || [];
      effect = finite(levels[value - 1]);
    }
    const dense = position && position.columns > 2;
    const inline = position ? ` style="left:${position.x / 10}%;top:${position.y - (dense ? 32 : 38)}px"` : '';
    const classes = `ot-node${guild ? ' ot-guild-node' : ''}${learned ? ' is-learned' : ''}${maxed ? ' is-maxed' : ''}${dense ? ' is-dense' : ''}${dense && position.column === 0 ? ' is-edge-left' : ''}${dense && position.column === position.columns - 1 ? ' is-edge-right' : ''}`;
    return `<div class="${classes}" data-tech-id="${E(key)}"${inline}>
      <details class="ot-info">
        <summary class="ot-disc" aria-label="${E(title)} 설명" title="${E(title)}">${iconMarkup(type, guild)}</summary>
        <div class="ot-tooltip"><b>${E(title)}</b><span>${E(effectLabel(effect, type, options, guild))}</span><small>${infinite ? `기본 ${integer(node.MaxLevel)}레벨 이후 계속 연구` : `최대 ${max}레벨`}</small></div>
      </details>
      <label class="ot-level" for="${E(id)}"><input id="${E(id)}" class="ot-level-input" style="--ot-digits:${Math.max(2, String(value).length) + 0.25}ch" type="number" inputmode="numeric" min="0" ${infinite ? '' : `max="${max}"`} step="1" value="${value}" data-path="${guild ? 'clanTech' : 'playerTech'}.${E(key)}" aria-label="${E(label)}"><span aria-hidden="true">/${infinite ? '∞' : max}</span></label>
    </div>`;
  }

  function renderPlayer(options) {
    const nodes = options.configs.PlayerTechTreePositionLibrary?.[options.tree]?.Nodes || [];
    const graph = layout(nodes), E = options.escape || esc;
    if (!nodes.length) return '<p class="ot-empty">표시할 기술이 없어요.</p>';
    const path = edge => {
      const start = edge.from.y + (edge.from.columns > 2 ? 56 : 62), end = edge.to.y - (edge.to.columns > 2 ? 31 : 37), middle = (start + end) / 2;
      return `<path d="M${edge.from.x},${start} V${middle} H${edge.to.x} V${end}"/>`;
    };
    const levels = options.state.playerTech || {};
    const total = nodes.reduce((n, row) => n + integer(levels[`${options.tree}:${row.Id}`]), 0);
    const maximum = nodes.reduce((n, row) => n + integer(options.limits.playerTech[`${options.tree}:${row.Id}`]), 0);
    return `<div class="ot-tech ot-player-tech" data-original-tree="${E(options.tree)}">
      <div class="ot-tree-summary"><b>${total} / ${maximum}</b><span>연구 레벨</span><small>노드를 눌러 효과 확인 · 숫자로 레벨 변경</small></div>
      <div class="ot-graph" style="height:${graph.height}px">
        <svg class="ot-links" width="100%" height="${graph.height}" viewBox="0 0 1000 ${graph.height}" preserveAspectRatio="none" aria-hidden="true">${graph.edges.map(path).join('')}</svg>
        ${graph.tiers.map(t => `<div class="ot-tier-title" style="top:${t.y}px"><span>${ROMAN[t.tier] || t.tier + 1} 단계</span></div>`).join('')}
        ${graph.nodes.map(p => renderNode(p.node, options, p, false)).join('')}
      </div>
    </div>`;
  }

  function renderGuild(options) {
    const groups = options.configs.GuildTechTreePositionLibrary || {};
    const upgrades = options.configs.GuildTechTreeUpgradeLibrary || {};
    const E = options.escape || esc, seen = new Set();
    const sections = [];
    for (const [category, group] of Object.entries(groups)) {
      const rows = (group.Nodes || []).filter(type => upgrades[type] && !seen.has(type));
      rows.forEach(type => seen.add(type));
      if (rows.length) sections.push([category, rows]);
    }
    const remaining = Object.keys(upgrades).filter(type => !seen.has(type));
    if (remaining.length) sections.push(['기타 연구', remaining]);
    return `<div class="ot-tech ot-guild-tech" data-original-tree="guild"><p class="ot-guild-help">노드를 눌러 효과 확인 · 숫자로 레벨 변경</p>${sections.map(([category, types]) =>
      `<section class="ot-guild-category"><h3>${E(CATEGORY_NAMES[category] || category)}</h3><div class="ot-guild-grid${types.length <= 3 ? ' ot-guild-grid-small' : ''}">${types.map(type => renderNode({...upgrades[type], Type:type}, options, null, true)).join('')}</div></section>`
    ).join('')}</div>`;
  }

  function render(options) {
    options = Object.assign({configs:{},state:{},limits:{playerTech:{},clanTech:{}},tree:'Power'}, options || {});
    return options.tree === 'guild' ? renderGuild(options) : renderPlayer(options);
  }

  return { render, layout, getIcon };
});
