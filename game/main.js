/* Forge Master KR TEST WORLD — UI, battle lifecycle and validated local saves. */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const copy = x => JSON.parse(JSON.stringify(x));
  const DATA = 'data/releases/live_2_12_1/';
  const ASSET = 'assets/releases/live_2_12_1';
  const SLOTS = {Helmet:'투구',Armour:'갑옷',Gloves:'장갑',Necklace:'목걸이',Ring:'반지',Weapon:'무기',Shoes:'신발',Belt:'벨트'};
  const SLOT_ORDER = ['Helmet','Armour','Gloves','Weapon','Necklace','Ring','Shoes','Belt'];
  const AGE_NAMES = ['원시','중세','근대 초기','현대','우주','성간','다중 우주','양자','지하 세계','신성','영웅','무한','영원'];
  const RARITY_NAMES = {Common:'일반',Rare:'희귀',Epic:'에픽',Legendary:'전설',Ultimate:'궁극',Mythic:'신화',Heroic:'영웅',Infinite:'무한',Eternal:'영원'};
  const ASC_NAMES = ['기본 · 승천 0','메가 · 승천 1','울트라 · 승천 2','에이펙스 · 승천 3'];
  const SECONDARY = {CriticalChance:'치명타 확률',CriticalMulti:'치명타 피해 증가',BlockChance:'막기 확률',HealthRegen:'체력 재생',LifeSteal:'생명력 흡수',DoubleDamageChance:'2배 피해 확률',DamageMulti:'전체 피해 증가',MeleeDamageMulti:'근접 피해 증가',RangedDamageMulti:'원거리 피해 증가',AttackSpeed:'공격 속도 증가',SkillDamageMulti:'스킬 피해 증가',SkillCooldownMulti:'스킬 쿨다운 감소',HealthMulti:'체력 증가'};
  const SET_NAMES = {SantaSet:'산타',SkiSet:'스키',SnowmanSet:'눈사람',LeprechaunSet:'레프러콘',FlowerSet:'꽃',DruidSet:'드루이드',BunnySet:'토끼',ClownSet:'광대',MillionaireSet:'백만장자',KnightSet:'기사',ChefSet:'요리사',PirateSet:'해적',MummySet:'미라',SharkSet:'상어',EagleSet:'독수리',MothSet:'나방',AnubisSet:'아누비스',LavamanSet:'용암',GuardianSet:'수호자',SkaterSet:'스케이터',RobotSet:'로봇',VampireSet:'뱀파이어',NinjaSet:'닌자',AngelSet:'천사',DemonSet:'악마'};
  const TECH_NAMES = {WeaponBonus:'무기 능력치',HelmetBonus:'투구 체력',BodyBonus:'갑옷 체력',ShoeBonus:'신발 능력치',GloveBonus:'장갑 능력치',BeltBonus:'벨트 체력',NecklaceBonus:'목걸이 체력',RingBonus:'반지 능력치',WeaponLevelUp:'무기 레벨 상한',HelmetLevelUp:'투구 레벨 상한',BodyLevelUp:'갑옷 레벨 상한',ShoeLevelUp:'신발 레벨 상한',GloveLevelUp:'장갑 레벨 상한',BeltLevelUp:'벨트 레벨 상한',NecklaceLevelUp:'목걸이 레벨 상한',RingLevelUp:'반지 레벨 상한',SkillDamage:'스킬 공격력',SkillHealth:'스킬 체력',SkillCooldown:'스킬 쿨다운',PetBonusDamage:'펫 공격력',PetBonusHealth:'펫 체력',MountBonusDamage:'탈것 공격력',MountBonusHealth:'탈것 체력',ForgeTimerSpeed:'대장간 제작 속도',ForgeUpgradeCost:'대장간 비용 할인',EquipmentSellPrice:'장비 판매 가격',HammerThiefHammerReward:'망치 던전 보상',HammerThiefCoinReward:'던전 코인 보상',AutoForge:'자동 제작',FreeForgeChance:'무료 제작 확률',MaxOfflineReward:'오프라인 보상 시간',CoinOfflineReward:'오프라인 코인',HammerOfflineReward:'오프라인 망치',CriticalChance:'치명타 확률',CriticalDamage:'치명타 피해',AttackSpeed:'공격 속도',HealthRegen:'체력 재생',LifeSteal:'생명력 흡수',BlockChance:'막기 확률',DoubleDamageChance:'2배 피해 확률',Damage:'공격력',Health:'체력',SummonPet:'펫 소환',MergePet:'펫 합성',SummonMount:'탈것 소환',MergeMount:'탈것 합성',SummonSkill:'스킬 소환',UpgradeSkill:'스킬 강화'};
  const TABS = [['equipment','장비','⚒'],['pets','펫','♧'],['skills','스킬','ϟ'],['skins','스킨','♜'],['mounts','탈것','♞'],['ascension','승천','✦'],['stage','스테이지','⚑'],['tech','기술','⌘'],['stats','능력치','▥'],['save','세팅','☷']];
  const TREE_NAMES = {Power:'전투',Forge:'대장간',SkillsPetTech:'스킬·펫',Clan:'개인 클랜',guild:'클랜 연구'};
  const MANUAL = [['damage','최종 공격력',false],['health','최대 체력',false],['attackSpeed','공격 속도 배율',false],['criticalChance','치명타 확률',true],['criticalMultiplier','치명타 피해 배율',false],['blockChance','막기 확률',true],['doubleChance','2배 피해 확률',true],['lifeSteal','생명력 흡수',true],['regen','체력 재생',true],['shield','시작 보호막',false],['range','공격 사거리',false],['moveSpeed','이동 속도',false]];
  let D, C, V, catalog, limits, state, build, encounter, battle, renderer;
  let tab = 'equipment', selectedSlot = 'Weapon', techTree = 'Power', picker = null;
  let running = false, endedAt = 0, lastFrame = 0, lastHud = 0, blockedSave = false, toastTimer;
  let actions = [], previousPreset = null;
  let storage;
  try { storage = window.localStorage; } catch {
    storage = {getItem(){throw new Error('Storage unavailable');},setItem(){throw new Error('Storage unavailable');}};
  }
  const lookup = {};
  const assetUrl = file => `${ASSET}/${encodeURIComponent(file)}`;
  const fmt = n => {
    n = Number(n) || 0;
    if (Math.abs(n) < 1000) return new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(n);
    if (Math.abs(n) >= 1e24) return n.toExponential(2);
    const units = [[1e20,'해'],[1e16,'경'],[1e12,'조'],[1e8,'억'],[1e4,'만']];
    const unit = units.find(x => Math.abs(n) >= x[0]);
    return unit ? `${new Intl.NumberFormat('ko-KR',{maximumFractionDigits:2}).format(n/unit[0])}${unit[1]}` : Math.round(n).toLocaleString('ko-KR');
  };
  const percent = n => `${Number((Number(n || 0)*100).toFixed(2))}%`;
  const clock = n => `${String(Math.floor(n/60)).padStart(2,'0')}:${(n%60).toFixed(1).padStart(4,'0')}`;
  const ageName = n => AGE_NAMES[n] || `시대 ${n+1}`;
  const rarityName = n => RARITY_NAMES[n] || n;
  const rarityColor = r => D?.rarities.find(x => x.key === r)?.color || '#bbc9cd';
  function itemFor(slot, s = state) {
    const v = s.equipment[slot];
    return v ? lookup.equipment.get(`${v.age}:${v.type}:${v.idx}`) : null;
  }
  function nameOf(item, kind) {
    if (!item) return '비어 있음';
    if (kind === 'skins') {
      if (item.KoreanName) return item.KoreanName;
      return `${SET_NAMES[item.setId] || (item.setId ? item.setId.replace(/Set$/, '') : `기본 #${item.id}`)} · ${SLOTS[item.type]}`;
    }
    return item.KoreanName || item.EnglishName || item.name || item.ItemName || item.key;
  }
  function art(item, kind, size = 48) {
    if (!item) return `<span class="empty-icon" style="width:${size}px;height:${size}px" aria-hidden="true">+</span>`;
    if (kind === 'equipment') return `<img class="item-icon" src="${assetUrl(item.SpriteName+'.png')}" width="${size}" height="${size}" loading="lazy" alt="${esc(nameOf(item,kind))}">`;
    const asc = kind === 'pets' ? state.petAsc : kind === 'mounts' ? state.mountAsc : state.skillAsc;
    const rect = kind === 'skins' ? item.icon : item.icons?.[Math.max(asc,item.minimumAscension || 0)] || item.icons?.find(Boolean);
    if (!rect) return `<span class="empty-icon" style="width:${size}px;height:${size}px">?</span>`;
    const texture = rect.texture || `${rect.tex}.png`, ratio = size/rect.w;
    return `<span class="sprite-icon" role="img" aria-label="${esc(nameOf(item,kind))}" style="width:${size}px;height:${size}px;background-image:url('${assetUrl(texture)}');background-size:${rect.texW*ratio}px ${rect.texH*ratio}px;background-position:${-rect.x*ratio}px ${-rect.y*ratio}px"></span>`;
  }
  function toast(message) {
    $('#toast').textContent = message; $('#toast').classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
  }
  function reportSave() {
    if (blockedSave) { $('#save-status').textContent = '기존 저장 보호 중 · 세팅에서 복구'; return; }
    const result = FMTestState.saveState(storage,state,catalog);
    $('#save-status').textContent = result.ok ? '이 브라우저에 자동 저장됨' : '저장 실패 · 세팅을 내보내 주세요';
    if (!result.ok) toast('브라우저 저장에 실패했어. 세팅 저장에서 JSON을 내보내 줘.');
  }
  function adaptBuild() {
    const techLevels = {};
    for (const [key,level] of Object.entries(state.playerTech)) {
      const split = key.lastIndexOf(':'), tree = key.slice(0,split), id = key.slice(split+1);
      (techLevels[tree] ||= {})[id] = level;
    }
    const base = value => ({...(value?.Damage === undefined ? {} : {damage:value.Damage}),...(value?.Health === undefined ? {} : {health:value.Health})});
    return {
      equipment:Object.values(state.equipment).filter(Boolean).map(x => ({id:{Age:x.age,Type:x.type,Idx:x.idx},level:x.level,...base(x.baseStatsOverrides),secondary:x.secondaryStats})),
      pets:state.pets.filter(Boolean).map(x => ({id:x.key,level:x.level,secondary:x.secondaryStats || {}})),
      mount:state.mount ? {id:state.mount.key,level:state.mount.level,...base(state.mount.statsOverrides),secondary:state.mount.secondaryStats} : null,
      skills:state.skills.map(x => x ? {id:x.key,level:x.level} : null),
      skins:Object.values(state.skins).filter(Boolean).map(x => ({id:lookup.skins.get(x.key)?.definition.SkinId,level:x.level,stats:x.statOverrides})),
      techLevels,clanTech:state.clanTech,ascensions:{forge:state.forgeAsc,pets:state.petAsc,mounts:state.mountAsc,skills:state.skillAsc},overrides:state.manualStats
    };
  }
  function rebuildBattle({carry = null} = {}) {
    build = FMGameEngine.buildStats(C,adaptBuild());
    encounter = FMGameEngine.buildEncounter(C,state.stage);
    battle = FMGameEngine.createBattle({stats:build.stats,skills:build.skills,enemies:encounter.enemies,seed:1729,autoSkills:state.battle.autoSkills !== false});
    if (carry) {
      battle.player.hp = Math.min(carry.player.hp,battle.player.maxHp);
      for (const skill of battle.skills) {
        const old = carry.skills.find(x => x.id === skill.id && x.slot === skill.slot);
        if (old) skill.cooldownRemaining = old.cooldownRemaining;
      }
    }
    running = false; actions = []; endedAt = 0;
    $('#battle-result').hidden = true;
    renderSkillBar(); renderHud(); renderStageHeading();
  }
  function commit(mutator, options = {}) {
    const next = copy(state);
    mutator(next);
    const valid = FMTestState.validateState(next,catalog);
    if (!valid.ok) { toast(`설정을 확인해 줘: ${valid.errors[0]?.path || '유효하지 않은 값'}`); renderEditor(); return false; }
    state = valid.state;
    reportSave();
    if (options.reset !== false) rebuildBattle();
    if (options.render !== false) renderEditor();
    renderLoadout(); syncControls();
    if (options.message) toast(options.message);
    else if (valid.warnings?.length) toast('설정값을 선택한 데이터의 허용 범위에 맞췄어.');
    return true;
  }
  function syncControls() {
    $('#speed-select').value = String(state.battle.speed);
    $('#auto-next').checked = state.battle.auto;
    $('#auto-skills').checked = state.battle.autoSkills !== false;
  }
  function renderStageHeading() {
    const custom = !!state.stage.customEnemy;
    $('#stage-region').textContent = custom ? '훈련장 · 직접 설정한 상대' : `${ageName(state.stage.age)} 시대 · ${['일반','어려움','악몽'][state.stage.difficulty] || state.stage.difficulty}`;
    $('#stage-title').textContent = custom ? `상대 ${encounter.enemies.length}명 · 자유 전투` : `스테이지 ${state.stage.battle+1} · 웨이브 ${state.stage.wave+1} / ${encounter.waveCount}`;
  }
  function renderSkillBar() {
    $('#battle-skills').innerHTML = state.skills.map((value,i) => {
      const item = value && lookup.skills.get(value.key);
      return `<button class="battle-skill" data-cast="${i}" aria-label="${i+1}번 스킬 ${esc(nameOf(item,'skills'))}">${art(item,'skills',42)}<span><b>${esc(item ? nameOf(item,'skills') : '스킬 선택')}</b><small data-cooldown="${i}">준비 중</small></span><i class="cooldown-shade"></i><span class="skill-hotkey">${i+1}</span></button>`;
    }).join('');
  }
  function renderHud() {
    if (!battle) return;
    $('#stat-damage').textContent = fmt(battle.player.stats.damage);
    $('#stat-health').textContent = fmt(battle.player.maxHp);
    $('#stat-dps').textContent = fmt(battle.elapsed ? battle.totals.damageDealt / battle.elapsed : 0);
    $('#stat-total').textContent = fmt(battle.totals.damageDealt);
    $('#health-value').textContent = `${fmt(battle.player.hp)} / ${fmt(battle.player.maxHp)}`;
    $('#health-fill').style.width = `${Math.max(0,battle.player.hp/battle.player.maxHp*100)}%`;
    $('#battle-clock').textContent = clock(battle.elapsed);
    const label = battle.status === 'victory' ? '전투 승리' : battle.status === 'defeat' ? '전투 종료' : running ? '전투 진행 중' : battle.elapsed > 0 ? '일시 정지' : '출전 준비';
    $('#field-status').innerHTML = `<i></i> ${label}`;
    $('#play-button').textContent = running ? 'Ⅱ 일시 정지' : battle.status !== 'running' ? '↻ 다시 전투' : battle.elapsed > 0 ? '▶ 계속 전투' : '▶ 전투 시작';
    for (let i=0;i<3;i++) {
      const button = $(`[data-cast="${i}"]`), skill = battle.skills.find(x => x.slot === i);
      if (!button) continue;
      const ready = skill && skill.cooldownRemaining <= 1e-9 && skill.activeRemaining <= 1e-9;
      button.classList.toggle('ready',!!ready);
      button.disabled = !!skill && (!running || !ready);
      button.querySelector('small').textContent = !skill ? '클릭해서 장착' : skill.activeRemaining > 0 ? `활성 ${skill.activeRemaining.toFixed(1)}초` : ready ? '사용 가능' : `${skill.cooldownRemaining.toFixed(1)}초`;
      button.querySelector('.cooldown-shade').style.transform = `scaleY(${skill ? Math.min(1,skill.cooldownRemaining/Math.max(skill.cooldown,4)) : 0})`;
    }
    $('#log-count').textContent = `${battle.totals.attacks}회 타격 · 스킬 ${battle.totals.skillCasts}회`;
    if ($('.battle-log').open) renderLog();
  }
  function renderLog() {
    const rows = battle.events.filter(x => ['hit','damage','heal','skill','block','death'].includes(x.type)).slice(-35).reverse();
    $('#battle-log-content').innerHTML = rows.length ? rows.map(e => {
      const title = e.type === 'skill' ? `${nameOf(lookup.skills.get(e.skillId),'skills')} 사용` : e.type === 'death' ? `${e.targetId === 'player' ? '플레이어' : '적'} 쓰러짐` : e.type === 'heal' ? `${fmt(e.amount)} 회복` : `${e.targetId === 'player' ? '받은 피해' : '가한 피해'} ${fmt(e.amount)}${e.critical?' · 치명타':''}${e.blocked?' · 막기':''}`;
      return `<div class="log-row"><time>${e.time.toFixed(1)}초</time><b>${esc(title)}</b></div>`;
    }).join('') : '전투를 시작하면 피해와 스킬 사용 내역이 표시돼요.';
  }
  function nextStage() {
    if (state.stage.customEnemy) return null;
    const result = copy(state.stage), waves = limits.stage.waves[`${result.age}:${result.battle}`] || [0];
    if (waves.includes(result.wave+1)) { result.wave++; return result; }
    result.wave = 0;
    const battles = limits.stage.battles[result.age] || [];
    const bi = battles.indexOf(result.battle);
    if (bi >= 0 && bi+1 < battles.length) { result.battle = battles[bi+1]; return result; }
    const ai = limits.stage.ages.indexOf(result.age);
    if (ai >= 0 && ai+1 < limits.stage.ages.length) { result.age = limits.stage.ages[ai+1]; result.battle = limits.stage.battles[result.age][0]; return result; }
    return null;
  }
  function finishBattle(now) {
    running = false; endedAt = now;
    const won = battle.status === 'victory', next = nextStage();
    $('#battle-result').hidden = false;
    $('#battle-result').classList.toggle('defeat',!won);
    $('#result-overline').textContent = won ? 'VICTORY · 잘 싸웠어요' : 'TRY ANOTHER BUILD';
    $('#result-title').textContent = won ? '전투 승리!' : '다시 도전!';
    $('#result-description').textContent = `${battle.elapsed.toFixed(1)}초 · 가한 피해 ${fmt(battle.totals.damageDealt)} · 스킬 ${battle.totals.skillCasts}회${won && !next ? ' · 현재 전투 완료' : ''}`;
    $('#result-next').hidden = !won || !next;
    $('#result-next').textContent = next?.battle === state.stage.battle && next?.age === state.stage.age ? '다음 웨이브 →' : '다음 스테이지 →';
    renderHud();
  }
  function advance() {
    const next = nextStage();
    if (!next || battle.status !== 'victory') return;
    const carry = battle;
    state.stage = next; reportSave(); rebuildBattle({carry}); running = true;
    if (tab === 'stage') renderEditor();
    renderHud();
  }
  function togglePlay() {
    if (battle.status !== 'running') rebuildBattle();
    running = !running; renderHud();
  }
  function frame(now) {
    const dt = lastFrame ? Math.min((now-lastFrame)/1000,.12) : 0; lastFrame = now;
    if (running && battle.status === 'running') {
      FMGameEngine.step(battle,dt*state.battle.speed,actions); actions = [];
      if (battle.status !== 'running') finishBattle(now);
    } else if (endedAt && state.battle.auto && battle.status === 'victory' && now-endedAt>1600 && nextStage()) advance();
    renderer.render(battle,state,now/1000);
    if (now-lastHud>90) { renderHud(); lastHud=now; }
    requestAnimationFrame(frame);
  }
  function renderLoadout() {
    const pieces = SLOT_ORDER.map(slot => `<button class="mini-slot" data-open-slot="${slot}" title="${esc(`${SLOTS[slot]} · ${nameOf(itemFor(slot),'equipment')}`)}">${art(itemFor(slot),'equipment',41)}<small>${SLOTS[slot]}</small></button>`);
    state.pets.forEach((p,i) => pieces.push(`<button class="mini-slot ${i===0?'slot-separator':''}" data-pick="pets" data-slot="${i}" title="${esc(nameOf(p&&lookup.pets.get(p.key),'pets'))}">${art(p&&lookup.pets.get(p.key),'pets',41)}<small>펫 ${i+1}</small></button>`));
    pieces.push(`<button class="mini-slot" data-pick="mounts" title="탈것 변경">${art(state.mount&&lookup.mounts.get(state.mount.key),'mounts',41)}<small>탈것</small></button>`);
    $('#equipped-row').innerHTML = pieces.join('');
    $('#loadout-caption').textContent = `장비 ${Object.values(state.equipment).filter(Boolean).length}/8 · 펫 ${state.pets.filter(Boolean).length}/3 · 승천 ${state.forgeAsc}`;
  }
  function intro(title,description) { return `<div class="editor-intro"><h3>${title}</h3><p>${description}</p></div>`; }
  function field(label,path,value,opts={}) {
    const percentValue = opts.percent && value !== undefined ? Number((value*100).toFixed(6)) : value;
    return `<label class="field"><span>${label}</span>${opts.unit ? '<span class="unit-field">' : ''}<input type="number" data-path="${esc(path)}" ${opts.percent?'data-percent="true"':''} ${opts.optional?'data-optional="true"':''} value="${esc(percentValue ?? '')}" min="${opts.min ?? 0}" ${opts.max !== undefined?`max="${opts.max}"`:''} step="${opts.step ?? 'any'}" placeholder="${esc(opts.placeholder ?? (opts.optional?'자동 계산':'0'))}">${opts.unit?`<span>${opts.unit}</span></span>`:''}${opts.help?`<small>${opts.help}</small>`:''}</label>`;
  }
  function secondaryFields(path,value={}) {
    return `<details class="substats"><summary>보조 옵션 직접 설정 <span>(${Object.keys(value).length}개)</span></summary>${Object.keys(C.SecondaryStatLibrary).map(key => `<label class="substat-row"><span>${SECONDARY[key] || key}</span><span class="unit-field"><input type="number" step="any" data-path="${esc(path+'.'+key)}" data-percent="true" data-optional="true" value="${value[key] === undefined?'':Number((value[key]*100).toFixed(6))}" placeholder="0" aria-label="${esc(SECONDARY[key]||key)}"><span>%</span></span></label>`).join('')}<p class="editor-notice">테스트 모드에서는 옵션 개수와 게임 내 드롭 범위의 제한 없이 입력할 수 있어요. 빈칸은 옵션 제거예요.</p></details>`;
  }
  function editorEquipment() {
    const value = state.equipment[selectedSlot], item = itemFor(selectedSlot);
    let html = intro('내 장비 구성','부위를 고르고 장비와 능력치를 바꿔 보세요.') + `<div class="equipment-grid">${SLOT_ORDER.map(slot => `<button class="equipment-slot ${slot===selectedSlot?'selected':''}" data-select-slot="${slot}" aria-label="${SLOTS[slot]} 설정">${art(itemFor(slot),'equipment',54)}<small>${SLOTS[slot]}</small>${state.equipment[slot]?`<span class="slot-level">${state.equipment[slot].level}</span>`:''}</button>`).join('')}</div>`;
    html += `<div class="equipment-detail"><div class="editor-card-top">${art(item,'equipment',48)}<div><strong>${esc(nameOf(item,'equipment'))}</strong><small>${SLOTS[selectedSlot]}${item?` · ${ageName(item.Age)}`:''}</small></div><button class="button" data-pick="equipment" data-slot="${selectedSlot}">장비 변경</button></div>`;
    if (value) {
      html += field('장비 레벨',`equipment.${selectedSlot}.level`,value.level,{min:1,max:limits.equipmentLevel[selectedSlot],step:1,help:`테스트 상한 ${limits.equipmentLevel[selectedSlot]} · 기술 보너스 포함`});
      const raw = Object.fromEntries((item?.definition.EquipmentStats || []).map(x => [x.StatNode.UniqueStat.StatType,x.Value]));
      html += `<div class="fields-two">${field('기본 공격력',`equipment.${selectedSlot}.baseStatsOverrides.Damage`,value.baseStatsOverrides.Damage,{optional:true,placeholder:fmt(raw.Damage || 0)})}${field('기본 체력',`equipment.${selectedSlot}.baseStatsOverrides.Health`,value.baseStatsOverrides.Health,{optional:true,placeholder:fmt(raw.Health || 0)})}</div><div class="editor-notice">기본 수치는 레벨 1 기준이에요. 입력값에 장비 레벨·기술·승천 배율이 적용돼요.</div>${secondaryFields(`equipment.${selectedSlot}.secondaryStats`,value.secondaryStats)}`;
    } else html += '<p class="editor-notice">장비 변경을 누르면 모든 시대의 장비를 선택할 수 있어요.</p>';
    return html+'</div>';
  }
  function editorCompanions(kind) {
    const isMount = kind === 'mounts', list = isMount ? [state.mount] : state[kind];
    const title = kind === 'pets' ? '함께 싸울 펫' : kind === 'skills' ? '세 개의 액티브 스킬' : '내 탈것';
    let html = intro(title,`${kind==='pets'?34:kind==='skills'?27:21}종 전체를 자유롭게 장착할 수 있어요. 신규 등급을 고르면 해당 승천도 함께 적용돼요.`);
    list.forEach((value,i) => {
      const item = value && lookup[kind].get(value.key), path = isMount ? 'mount' : `${kind}.${i}`;
      const max = item ? kind === 'skills' ? limits.skillLevel[value.key] : (kind === 'pets' ? limits.petLevel : limits.mountLevel)[item.rarity] : 100;
      html += `<div class="editor-card"><div class="editor-card-top">${art(item,kind,58)}<div><strong>${esc(nameOf(item,kind))}</strong><small>${item?rarityName(item.rarity):`${isMount?'탈것':kind==='pets'?'펫':'스킬'} ${i+1}번 슬롯`}</small></div><button class="button" data-pick="${kind}" data-slot="${i}">변경</button></div>`;
      if (value) {
        html += field('레벨',`${path}.level`,value.level,{min:1,max,step:1});
        if (isMount) {
          html += `<div class="fields-two">${field('탈것 공격력',`${path}.statsOverrides.Damage`,value.statsOverrides.Damage,{optional:true})}${field('탈것 체력',`${path}.statsOverrides.Health`,value.statsOverrides.Health,{optional:true})}</div><div class="editor-notice">선택 레벨의 기본 수치를 대체해요. 기술과 승천 배율은 추가로 반영돼요.</div>${secondaryFields(`${path}.secondaryStats`,value.secondaryStats)}`;
        } else if (kind === 'pets') html += secondaryFields(`${path}.secondaryStats`,value.secondaryStats);
        else {
          const skill = build.skills.find(x => x.slot === i);
          html += `<div class="section-line"><span>쿨다운 ${fmt(skill?.cooldown)}초</span><span>${skill?.mode==='buff'?'버프':'공격'} · ${fmt(skill?.damage || skill?.health)}</span></div>`;
        }
      }
      html += '</div>';
    });
    if (kind==='skills') html += '<div class="editor-notice">시작 후 4초 충전하면 사용할 수 있어요. 자동을 끄고 스킬 버튼이나 숫자 1·2·3으로 직접 사용해 보세요.</div>';
    return html;
  }
  function editorSkins() {
    let html = intro('모습도, 옵션도 내 마음대로','스킨 114개를 선택할 수 있어요. 같은 세트의 장착 효과도 계산돼요.');
    for (const slot of ['Helmet','Armour','Weapon']) {
      const value = state.skins[slot], item = value && lookup.skins.get(value.key);
      html += `<div class="editor-card"><div class="editor-card-top">${art(item,'skins',54)}<div><strong>${item?esc(nameOf(item,'skins')):`${SLOTS[slot]} 스킨`}</strong><small>${item?'장착 중':'장비 원래 모습 사용'}</small></div><button class="button" data-pick="skins" data-slot="${slot}">변경</button></div>`;
      if (value) {
        html += field('스킨 강화 단계',`skins.${slot}.level`,value.level,{min:0,max:limits.skinLevelByKey[value.key],step:1});
        for (const possible of item.definition.PossibleStats || []) {
          const stat = possible.StatNode.UniqueStat.StatType;
          html += field(stat==='Damage'?'공격력 기본 옵션':stat==='Health'?'체력 기본 옵션':stat,`skins.${slot}.statOverrides.${stat}`,value.statOverrides[stat],{percent:true,unit:'%',optional:true,help:`게임 기본 범위 ${percent(possible.MinValue)}–${percent(possible.MaxValue)} · 강화 증가분 별도`});
        }
      }
      html += '</div>';
    }
    return html+'<p class="editor-notice">스킨 명칭은 세트와 부위로 표시해요. 빈 옵션은 외형만 적용하고, 숫자를 입력하면 능력치에 반영돼요.</p>';
  }
  function editorAscension() {
    let html = intro('승천 등급 설정','각 시스템의 승천을 독립적으로 바꾸고 전투 차이를 확인하세요.');
    for (const [key,label,description] of [['forgeAsc','장비 승천','장비 능력치 배율'],['petAsc','펫 승천','펫 능력치 · 외형'],['mountAsc','탈것 승천','탈것 능력치 · 외형'],['skillAsc','스킬 승천','스킬 능력치 · 아이콘']]) html += `<div class="asc-card"><div><b>${label}</b><small>${description}</small></div><select data-path="${key}" aria-label="${label}">${ASC_NAMES.map((name,i) => `<option value="${i}" ${state[key]===i?'selected':''}>${name}</option>`).join('')}</select></div>`;
    html += `<div class="editor-section">${field('대장간 레벨','forgeLevel',state.forgeLevel,{min:1,max:limits.forgeLevelByAsc[state.forgeAsc],step:1,help:'테스트 월드는 드롭 대기 없이 장비를 직접 지급해요.'})}</div><div class="editor-notice">장비 승천 배율은 기본 1배 → 50배 → 2,500배 → 125,000배예요. 영웅·무한·영원 동료는 승천 3이 기준이며 테스트 모드에서는 자유롭게 실험할 수 있어요.</div>`;
    return html;
  }
  function selectField(label,path,values,current) {
    return `<label class="field"><span>${label}</span><select data-path="${path}">${values.map(([v,t]) => `<option value="${v}" ${v===current?'selected':''}>${esc(t)}</option>`).join('')}</select></label>`;
  }
  function editorStage() {
    const s = state.stage;
    let html = intro('전투할 곳을 골라 보세요','스테이지와 웨이브를 건너뛰거나 훈련 상대의 능력치를 직접 정할 수 있어요.');
    html += `<label class="field"><span>전투 모드</span><select id="stage-mode"><option value="stage" ${!s.customEnemy?'selected':''}>게임 데이터 스테이지</option><option value="custom" ${s.customEnemy?'selected':''}>훈련장 · 상대 직접 설정</option></select></label>`;
    if (s.customEnemy) {
      html += `<div class="fields-two">${field('상대 체력','stage.customEnemy.health',s.customEnemy.health,{min:1})}${field('상대 공격력','stage.customEnemy.damage',s.customEnemy.damage)}</div><div class="fields-two">${field('상대 수','stage.customEnemy.count',s.customEnemy.count,{min:1,max:50,step:1})}${field('공격 속도 배율','stage.customEnemy.attackSpeed',s.customEnemy.attackSpeed ?? 1,{min:.05,max:100})}</div><button class="button full-button" id="match-enemy">내 능력치에 맞춘 연습 상대</button>`;
    } else {
      html += selectField('난이도','stage.difficulty',limits.stage.difficulties.map(x=>[x,['일반','어려움 · 적 능력치 6,000,000배','악몽 · 적 능력치 36조 배'][x] || `난이도 ${x+1}`]),s.difficulty);
      html += selectField('시대','stage.age',limits.stage.ages.map(x=>[x,ageName(x)]),s.age);
      html += `<div class="fields-two">${selectField('스테이지','stage.battle',(limits.stage.battles[s.age]||[]).map(x=>[x,`${x+1} 스테이지`]),s.battle)}${selectField('웨이브','stage.wave',(limits.stage.waves[`${s.age}:${s.battle}`]||[]).map(x=>[x,`${x+1} 웨이브`]),s.wave)}</div>`;
      html += '<div class="editor-notice">현재 공개 전투 데이터는 원시~영웅 시대를 포함해요. 무한·영원 장비는 어느 전투에서든 사용할 수 있어요.</div>';
    }
    html += `<div class="editor-card"><h3>이번 전투의 적</h3><table class="stats-table"><tr><td>등장 수</td><td>${encounter.enemies.length}명</td></tr><tr><td>첫 상대 공격력</td><td>${fmt(encounter.enemies[0]?.stats.damage)}</td></tr><tr><td>첫 상대 체력</td><td>${fmt(encounter.enemies[0]?.stats.health)}</td></tr></table></div>`;
    return html;
  }
  function techName(type) { return TECH_NAMES[type] || type.replace(/([a-z])([A-Z])/g,'$1 $2'); }
  function editorTech() {
    let html = intro('기술 연구실','재화와 선행 조건 없이 개인·클랜 기술 레벨을 설정하세요.');
    html += `<div class="tech-tabs">${Object.entries(TREE_NAMES).map(([key,name])=>`<button class="tech-tab ${key===techTree?'active':''}" data-tech-tree="${key}">${name}</button>`).join('')}</div><div class="tech-actions"><button class="button" data-tech-fill="max">이 트리 최대</button><button class="button" data-tech-fill="zero">이 트리 초기화</button></div>`;
    if (techTree === 'guild') {
      for (const [key,row] of Object.entries(C.GuildTechTreeUpgradeLibrary)) html += `<div class="tech-row"><label for="guild-${esc(key)}"><strong>${esc(techName(key))}</strong><small>${row.ValuePerLevel ? `레벨당 ${percent(row.ValuePerLevel)}`:'연구 효과'} · ${limits.clanTech[key]===null?'기본 상한 이후 계속 연구':`상한 ${limits.clanTech[key]}`}</small></label><input id="guild-${esc(key)}" type="number" min="0" ${limits.clanTech[key]!==null?`max="${limits.clanTech[key]}"`:''} step="1" value="${state.clanTech[key]||0}" data-path="clanTech.${esc(key)}"></div>`;
    } else {
      let tier = -1;
      for (const row of C.PlayerTechTreePositionLibrary[techTree]?.Nodes || []) {
        if (row.Tier!==tier) { tier=row.Tier; html += `<div class="tech-tier">TIER ${tier+1}</div>`; }
        const key = `${techTree}:${row.Id}`, max = limits.playerTech[key], value = state.playerTech[key]||0;
        const vals = C.PlayerTechTreeNodeValuesLibrary[row.Type]?.Tiers?.[row.Tier]?.StatValuePerLevel;
        const benefit = value>0?vals?.[value-1]:0;
        html += `<div class="tech-row"><label for="tech-${row.Id}"><strong>${esc(techName(row.Type))}</strong><small>${esc(row.Type)} · ${value}/${max}${benefit?` · 값 ${fmt(benefit)}`:''}</small></label><input id="tech-${row.Id}" type="number" min="0" max="${max}" step="1" value="${value}" data-path="playerTech.${key}"></div>`;
      }
    }
    return html+'<div class="editor-notice">공격·체력·공속 등 전투에 쓰는 기술은 반영돼요. 재화 보상·제작 시간 같은 경제 기능은 전투 결과에 영향을 주지 않아요.</div>';
  }
  function editorStats() {
    const s = build.stats;
    let html = intro('최종 능력치','현재 장비·동료·기술·스킨·승천을 합산한 전투 능력치예요.');
    const rows = [['공격력',fmt(s.damage)],['최대 체력',fmt(s.health)],['초당 공격',fmt(s.attackSpeed/s.attackInterval)+'회'],['치명타 확률',percent(s.criticalChance)],['치명타 피해',fmt(s.criticalMultiplier)+'배'],['막기 확률',percent(s.blockChance)],['2배 피해 확률',percent(s.doubleChance)],['생명력 흡수',percent(s.lifeSteal)],['체력 재생',percent(s.regen)],['무기 타입',s.ranged?'원거리':'근접'],['공격 사거리',fmt(s.range)],['시작 보호막',fmt(s.shield)]];
    html += `<table class="stats-table">${rows.map(([k,v])=>`<tr><td>${k}</td><td>${v}</td></tr>`).join('')}</table><div class="editor-section"><h3>최종값 직접 덮어쓰기</h3><p class="editor-notice">빈칸은 자동 계산이에요. 공격력 0도 적용되며, 체력은 최소 1·공속 배율은 최소 0.05예요. 모든 장비·기술 계산 후 적용돼요.</p>`;
    html += MANUAL.map(([key,label,pct])=>field(label,`manualStats.${key}`,state.manualStats[key],{optional:true,percent:pct,unit:pct?'%':undefined,placeholder:pct?Number((s[key]*100).toFixed(2)):fmt(s[key])})).join('');
    return html+'<button class="button full-button" id="clear-manual">직접 입력한 최종값 제거</button></div>';
  }
  function saveContent() {
    return `<p class="utility-copy">테스트 세팅은 이 브라우저에 자동으로 저장돼요. JSON 파일로 내보내면 다른 기기에서도 불러올 수 있어요.</p>${blockedSave?'<p class="editor-notice warning">기존 저장값을 읽지 못해서 자동 저장을 멈췄어요. 원본을 내보내 보관하거나 유효한 세팅을 가져오면 복구할 수 있어요.</p><button class="button full-button" data-save-action="raw">읽지 못한 원본 내보내기</button>':''}<div class="utility-actions"><button class="button primary" data-save-action="export">JSON 내보내기 ↓</button><button class="button" data-save-action="copy">JSON 복사</button></div><div class="editor-section"><label class="field"><span>저장 파일 불러오기</span><input type="file" accept=".json,application/json" data-import-file></label><label class="field"><span>또는 JSON 붙여넣기</span><textarea data-import-text placeholder="세팅 JSON을 여기에 붙여넣으세요." spellcheck="false"></textarea></label><button class="button full-button" data-save-action="import">세팅 가져오기</button></div><div class="editor-section"><h3>빠르게 시작하기</h3><button class="preset-card" data-preset="starter"><b>처음부터 시작</b><small>원시 장비와 일반 펫·스킬·탈것을 장착해요.</small></button><button class="preset-card" data-preset="max"><b>최대 성장 세팅</b><small>영원 장비·동료, 승천 3, 최대 레벨과 기술을 한 번에 적용해요.</small></button>${previousPreset?'<button class="button full-button" id="undo-preset">프리셋 적용 전 세팅으로 되돌리기</button>':''}</div>`;
  }
  function renderEditor() {
    $('#editor-tabs').innerHTML = TABS.map(([id,name,icon])=>`<button class="editor-tab ${tab===id?'active':''}" data-tab="${id}" aria-pressed="${tab===id}"><span class="tab-icon" aria-hidden="true">${icon}</span>${name}</button>`).join('');
    const render = {equipment:editorEquipment,pets:()=>editorCompanions('pets'),skills:()=>editorCompanions('skills'),mounts:()=>editorCompanions('mounts'),skins:editorSkins,ascension:editorAscension,stage:editorStage,tech:editorTech,stats:editorStats,save:saveContent};
    $('#editor-content').innerHTML = (render[tab]||editorEquipment)();
  }
  function setTab(next,scroll=false) {
    tab = next; renderEditor(); $('#editor-content').scrollTop=0;
    if (scroll && matchMedia('(max-width:930px)').matches) $('.workshop').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function openPicker(kind,slot) {
    picker = {kind,slot:kind==='pets'||kind==='skills'?Number(slot):slot};
    const title = {equipment:`${SLOTS[slot]} 장비`,pets:`펫 ${Number(slot)+1}`,skills:`스킬 ${Number(slot)+1}`,mounts:'탈것',skins:`${SLOTS[slot]} 스킨`}[kind];
    $('#picker-title').textContent = `${title} 선택`;
    $('#picker-eyebrow').textContent = 'ALL UNLOCKED · 자유롭게 장착';
    $('#picker-search').value='';
    $('#picker-filter').innerHTML = '<option value="">전체 '+(kind==='equipment'?'시대':'등급')+'</option>' + (kind==='equipment'?D.ages.map(x=>`<option value="${x.index}">${ageName(x.index)}</option>`):kind==='skins'?[]:D.rarities.map(x=>`<option value="${x.key}">${rarityName(x.key)}</option>`)).join('');
    $('#picker-filter').hidden = kind==='skins';
    renderPicker();
    $('#picker-dialog').showModal();
    $('#picker-search').focus();
  }
  function renderPicker() {
    if (!picker) return;
    const {kind,slot}=picker, query=$('#picker-search').value.trim().toLowerCase(),filter=$('#picker-filter').value;
    let items=D[kind].filter(item=>kind==='equipment'?item.TypeName===slot:kind==='skins'?item.type===slot:true);
    const total=items.length;
    items=items.filter(item=>(!query || `${nameOf(item,kind)} ${item.name||''} ${item.ItemName||''} ${item.key}`.toLowerCase().includes(query)) && (!filter || String(kind==='equipment'?item.Age:item.rarity)===filter));
    const current=kind==='equipment'?itemFor(slot)?.key:kind==='mounts'?state.mount?.key:kind==='skins'?state.skins[slot]?.key:state[kind][slot]?.key;
    $('#picker-count').textContent=`${items.length} / ${total}개 · 클릭하면 바로 장착`;
    $('#picker-grid').innerHTML=items.map(item=>`<button class="picker-card ${current===item.key?'chosen':''}" data-choose="${esc(item.key)}" style="--rarity:${kind==='equipment'?D.ages[item.Age]?.color:rarityColor(item.rarity)}" title="${esc(nameOf(item,kind))}">${current===item.key?'<span class="selected-mark">✓</span>':''}${art(item,kind,68)}<b>${esc(nameOf(item,kind))}</b><small>${kind==='equipment'?ageName(item.Age):kind==='skins'?SLOTS[item.type]:rarityName(item.rarity)}</small>${item.minimumAscension===3?'<em>승천 3</em>':''}</button>`).join('') || '<div class="empty-list">검색 조건에 맞는 항목이 없어요.</div>';
  }
  function chooseItem(key) {
    const {kind,slot}=picker, item=D[kind].find(x=>x.key===key);
    if (key!==null && !item) return;
    commit(s=>{
      if (kind==='equipment') {
        const old=s.equipment[slot];
        s.equipment[slot]=item?{age:item.Age,type:item.TypeName,idx:item.Idx,level:old?.level||1,baseStatsOverrides:{},secondaryStats:old?.secondaryStats||{}}:null;
      } else if (kind==='skins') {
        const rolls={};
        const possible=item?.definition.PossibleStats?.[0];
        if (possible) rolls[possible.StatNode.UniqueStat.StatType]=possible.MinValue;
        s.skins[slot]=item?{key:item.key,level:0,statOverrides:rolls}:null;
      } else {
        const isMount=kind==='mounts', old=isMount?s.mount:s[kind][slot];
        const value=item?{key:item.key,level:old?.level||1,...(kind==='skills'?{}:{secondaryStats:old?.secondaryStats||{}}),...(isMount?{statsOverrides:{}}:{})}:null;
        if (isMount) s.mount=value; else s[kind][slot]=value;
        if (item?.minimumAscension===3) s[kind==='pets'?'petAsc':kind==='skills'?'skillAsc':'mountAsc']=3;
      }
    },{message:item?`${nameOf(item,kind)} 장착 · 전투 준비`:'장착 해제했어.'});
    $('#picker-dialog').close();
  }
  function openUtility(title,content) {
    $('#utility-title').textContent=title; $('#utility-content').innerHTML=content; $('#utility-dialog').showModal();
  }
  function download(text,name) {
    const url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    const a=document.createElement('a'); a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);
  }
  async function saveAction(action,target) {
    if (action==='export') { download(FMTestState.exportState(state,catalog),'forge-master-test-world.json'); toast('세팅 JSON을 내보냈어.'); }
    if (action==='raw') {
      try { download(storage.getItem(FMTestState.STORE_KEY)||'','forge-master-test-world-original.json'); } catch { toast('브라우저 저장소에 접근할 수 없어.'); }
    }
    if (action==='copy') {
      const json=FMTestState.exportState(state,catalog);
      try { await navigator.clipboard.writeText(json); toast('세팅 JSON을 복사했어.'); }
      catch { const input=target.closest('#utility-content,#editor-content').querySelector('[data-import-text]'); input.value=json;input.focus();input.select();toast('입력창에서 JSON을 복사할 수 있어.'); }
    }
    if (action==='import') {
      const input=target.closest('#utility-content,#editor-content').querySelector('[data-import-text]');
      const result=FMTestState.importState(storage,input.value,catalog);
      if (!result.ok) { toast(`가져오지 못했어. ${result.errors?.[0]?.path||'JSON 형식'}을 확인해 줘. 기존 세팅은 유지했어.`); return; }
      state=result.state;blockedSave=false;rebuildBattle();renderEditor();renderLoadout();syncControls();reportSave();
      if ($('#utility-dialog').open) $('#utility-dialog').close();
      toast('세팅을 가져왔어. 이전 원문도 복구용으로 보관했어.');
    }
  }
  function applyPreset(name) {
    previousPreset=copy(state);
    const preset=FMTestState.createPreset(name,catalog);
    commit(s=>Object.assign(s,preset),{message:name==='max'?'최대 성장 세팅을 적용했어.':'처음 시작 세팅을 적용했어.'});
    if ($('#utility-dialog').open) $('#utility-dialog').close();
  }
  function onPathChange(element) {
    const path=element.dataset.path.split('.');
    const optional=element.dataset.optional==='true', empty=element.value.trim()==='';
    if (!optional && empty) { renderEditor(); toast('숫자를 입력해 줘.');return; }
    const numeric=Number(element.value)/(element.dataset.percent==='true'?100:1);
    if (!empty && !Number.isFinite(numeric)) { toast('유효한 숫자를 입력해 줘.'); return; }
    commit(s=>{
      let obj=s;
      for (const key of path.slice(0,-1)) obj=obj[key] ||= {};
      if (optional && empty) delete obj[path.at(-1)]; else obj[path.at(-1)]=numeric;
      if (element.dataset.path==='stage.age') { s.stage.battle=limits.stage.battles[s.stage.age][0];s.stage.wave=0; }
      if (element.dataset.path==='stage.battle') s.stage.wave=0;
    });
  }
  function bind() {
    document.addEventListener('click',event=>{
      const target=event.target.closest('button,[data-tab]'); if (!target) return;
      if (target.dataset.tab) return setTab(target.dataset.tab,!target.closest('#editor-tabs'));
      if (target.dataset.close) return $('#'+target.dataset.close).close();
      if (target.dataset.selectSlot) { selectedSlot=target.dataset.selectSlot;return renderEditor(); }
      if (target.dataset.openSlot) { selectedSlot=target.dataset.openSlot;return setTab('equipment',true); }
      if (target.dataset.pick) return openPicker(target.dataset.pick,target.dataset.slot);
      if (target.dataset.choose) return chooseItem(target.dataset.choose);
      if (target.dataset.cast!==undefined) {
        const slot=Number(target.dataset.cast);
        if (!state.skills[slot]) return openPicker('skills',slot);
        if (running) actions.push({type:'skill',slot});
        return;
      }
      if (target.dataset.techTree) { techTree=target.dataset.techTree;return renderEditor(); }
      if (target.dataset.techFill) return commit(s=>{
        const max=target.dataset.techFill==='max';
        if (techTree==='guild') for (const [key,row] of Object.entries(C.GuildTechTreeUpgradeLibrary)) s.clanTech[key]=max?row.MaxLevel:0;
        else for (const row of C.PlayerTechTreePositionLibrary[techTree]?.Nodes||[]) s.playerTech[`${techTree}:${row.Id}`]=max?limits.playerTech[`${techTree}:${row.Id}`]:0;
      },{message:'기술 레벨을 적용했어.'});
      if (target.dataset.preset) return applyPreset(target.dataset.preset);
      if (target.dataset.saveAction) return void saveAction(target.dataset.saveAction,target);
      switch(target.id) {
        case 'play-button':return togglePlay();
        case 'restart-button':rebuildBattle();return toast('같은 세팅으로 전투를 초기화했어.');
        case 'apply-button':rebuildBattle();return toast('현재 세팅을 전투에 적용했어.');
        case 'result-retry':rebuildBattle();running=true;return renderHud();
        case 'result-next':return advance();
        case 'picker-clear':return chooseItem(null);
        case 'preset-button':return openUtility('빠른 세팅',`<p class="utility-copy">현재 세팅을 한 번에 바꿔요. 적용 전 세팅은 이번 접속 동안 되돌릴 수 있어요.</p><button class="preset-card" data-preset="starter"><b>처음부터 시작</b><small>원시 장비와 일반 동료로 기본 전투를 시작해요.</small></button><button class="preset-card" data-preset="max"><b>최대 성장 세팅</b><small>영원 장비·펫·탈것·스킬, 승천 3과 최대 기술을 적용해요.</small></button>${previousPreset?'<button class="button full-button" id="undo-preset">이전 세팅으로 되돌리기</button>':''}`);
        case 'undo-preset':if (previousPreset) { const old=previousPreset;previousPreset=null;commit(s=>Object.assign(s,old),{message:'이전 세팅으로 돌아왔어.'});if($('#utility-dialog').open)$('#utility-dialog').close(); }return;
        case 'save-menu':return openUtility('테스트 세팅 저장',saveContent());
        case 'clear-manual':return commit(s=>{s.manualStats={};},{message:'최종값을 자동 계산으로 돌렸어.'});
        case 'match-enemy':return commit(s=>{s.stage.customEnemy={health:Math.max(1,build.stats.damage*30),damage:Math.max(1,build.stats.health/25),count:1,attackSpeed:1};},{message:'30회 타격 정도 버티는 연습 상대를 준비했어.'});
        case 'about-button':return openUtility('이 테스트 월드의 구현 범위','<p class="utility-copy">게임 데이터를 바탕으로 만든 독립 웹 전투 시뮬레이션이에요. 실제 게임 계정이나 공식 서버와 연결되지 않아요.</p><h3 class="utility-subtitle">현재 적용되는 것</h3><ul class="utility-list"><li>장비 295개, 펫 34종, 탈것 21종, 스킬 27종, 스킨 114개 선택과 외형</li><li>레벨, 승천, 개인·클랜 전투 기술, 스킨 옵션·세트, 장비·탈것 보조 옵션</li><li>자동 공격, 치명타·막기·2배 피해, 흡혈·재생, 수동·자동 스킬과 쿨다운</li><li>스테이지·웨이브 진행, 훈련 상대, 전투 배속과 세팅 저장</li></ul><h3 class="utility-subtitle">전투 모델의 차이</h3><p class="utility-copy">스킬 피해는 가까운 적에게 나누어 적용해요. 원본의 정확한 광역 판정·투사체 충돌·드론 AI·고정소수점 계산과 입자 효과까지 재현한 것은 아니에요. 펫은 능력치와 선택 옵션을 통해 전투에 기여해요. 제작·재화 획득·상점·계정·멀티플레이는 이 테스트 월드에 없어요.</p><p class="utility-copy">기준: 2.12.1 공개 설정 · 2026-11-16 스냅샷. 이전 2.11.1 계산기와 데이터는 <a href="archive/">작업 기록</a>에 보관했어요.</p>');
      }
    });
    document.addEventListener('change',event=>{
      const el=event.target;
      if (el.dataset.path) return onPathChange(el);
      if (el.matches('[data-import-file]')) {
        const file=el.files[0]; if (file) file.text().then(text=>{el.closest('#utility-content,#editor-content').querySelector('[data-import-text]').value=text;toast('파일을 읽었어. 세팅 가져오기를 누르면 적용돼.');});
      }
      if (el.id==='speed-select') commit(s=>{s.battle.speed=Number(el.value);},{reset:false,render:false});
      if (el.id==='auto-next') commit(s=>{s.battle.auto=el.checked;},{reset:false,render:false});
      if (el.id==='auto-skills') { commit(s=>{s.battle.autoSkills=el.checked;},{reset:false,render:false});battle.autoSkills=el.checked; }
      if (el.id==='picker-filter') renderPicker();
      if (el.id==='stage-mode') commit(s=>{s.stage.customEnemy=el.value==='custom'?{health:10000,damage:100,count:1,attackSpeed:1}:null;});
    });
    $('#picker-search').addEventListener('input',renderPicker);
    $('.battle-log').addEventListener('toggle',()=>{if(battle)renderLog();});
    document.addEventListener('keydown',event=>{
      if (/INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || $('dialog[open]')) return;
      if (['1','2','3'].includes(event.key) && running) actions.push({type:'skill',slot:Number(event.key)-1});
      if (event.code==='Space') { event.preventDefault();togglePlay(); }
    });
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){running=false;renderHud();}});
    for (const dialog of $$('dialog')) dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  }
  async function init() {
    try {
      const read = async name => {const response=await fetch(DATA+name);if(!response.ok)throw new Error(`${name}: ${response.status}`);return response.json();};
      [D,C,V]=await Promise.all([read('game-data.json'),read('game-configs.json'),read('BattleVisuals.json')]);
      catalog={configs:C,gameData:D}; limits=FMTestState.getLimits(catalog);
      lookup.equipment=new Map(D.equipment.map(x=>[`${x.Age}:${x.TypeName}:${x.Idx}`,x]));
      for (const kind of ['pets','skills','mounts','skins']) lookup[kind]=new Map(D[kind].map(x=>[x.key,x]));
      const loaded=FMTestState.loadState(storage,catalog);
      blockedSave=!loaded.ok;
      state=loaded.ok?loaded.state:FMTestState.createPreset('starter',catalog);
      renderer=FMRenderer.create($('#battle-canvas'),{visuals:V,catalog:D,assetBase:ASSET,configs:C});
      rebuildBattle();renderEditor();renderLoadout();syncControls();bind();reportSave();
      $('#play-button').disabled=false;$('#restart-button').disabled=false;
      $('#load-cover').hidden=true;$('#world').setAttribute('aria-busy','false');
      // Read-only inspection endpoints are useful for reproducible integration checks.
      window.FMTestWorld=Object.freeze({getState:()=>copy(state),getBattle:()=>copy(battle),getBuild:()=>copy(build),getCatalogCounts:()=>copy(D.counts),getCoverage:()=>copy(build.coverage)});
      requestAnimationFrame(frame);
      if (blockedSave) toast('기존 테스트 세팅을 읽지 못해서 원본을 보호했어. 세팅 저장에서 확인해 줘.');
    } catch(error) {
      console.error(error);$('#load-message').textContent=`준비하지 못했어요: ${error.message}. 새로고침해서 다시 시도해 주세요.`;
      $('#load-cover h2').textContent='데이터를 불러오지 못했어요';
      $('#save-status').textContent='준비 실패 · 새로고침 필요';
    }
  }
  init();
})();
