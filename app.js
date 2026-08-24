'use strict';

const CONFIG_STAMP = '2026_08_21_00_29';
const CONFIG_BASE = `https://raw.githubusercontent.com/1vcian/fm/refs/heads/main/public/parsed_configs/${CONFIG_STAMP}/`;
const CACHE_PREFIX = 'fmkr_cfg_v1_';
const STATE_KEY = 'fmkr_personal_state_v2';
const LEGACY_STATE_KEY = 'fmkr_state_v1';

const REQUIRED = [
  'ForgeUpgradeLibrary','WeaponLibrary','SkillLibrary','PetLibrary','MountLibrary',
  'PlayerTechTreeNodeValuesLibrary','TechNodesLibrary','GuildTechTreeUpgradeLibrary',
  'DungeonRewardLibrary','ArenaLeagueLibrary','ArenaRewardLibrary','GuildTierConfig'
];

const DUNGEON_FILES = {
  Hammer: 'HammerThiefDungeonBattleLibrary',
  Skill: 'SkillDungeonBattleLibrary',
  Potion: 'PotionDungeonBattleLibrary',
  Pet: 'EggDungeonBattleLibrary'
};

const data = {};
const loadState = {};

const DEFAULT_STATE = {
  forgeLevel: 1,
  baseMoveSpeed: 1,
  playerTech: {},
  guildTech: {},
  petLevels: {},
  mountLevels: {},
  skillLevels: {}
};
let state = loadSavedState();

const NAV = [
  ['home','🏠','홈'],['profile','👤','내 설정'],['player-tech','🧪','기술 트리'],['guild-tech','🏰','클랜 기술'],
  ['weapons','⚔️','무기 / 공격속도'],['movement','🏃','이속 / 공격범위'],['forge','🔨','대장간'],['skills','✨','스킬'],
  ['companions','🐾','펫 / 탈것'],['dungeons','🗝️','던전 보상'],['arena','🏆','리그 보상'],['guild-rewards','🛡️','클랜 보상'],['data','ℹ️','데이터']
];

const CURRENCY_KR = {
  Coins:'코인', Gems:'보석', Hammers:'망치', SkillSummonTickets:'스킬 소환권', TechPotions:'기술 포션',
  PvpTickets:'PvP 티켓', ClockWinders:'탈것 열쇠', WarBattleTickets:'클랜전 티켓', Token:'토큰',
  Eggshells:'펫알 재화', MissionEnergy:'미션 에너지', GuildPotions:'클랜 포션'
};
const RARITY_KR = {Common:'일반',Rare:'희귀',Epic:'영웅',Legendary:'전설',Ultimate:'궁극',Mythic:'신화'};
const PET_TYPE_KR = {Balanced:'균형형',Damage:'공격형',Health:'체력형'};
const SKILL_KR = {
  Meat:'고기', Arrows:'화살', Shout:'외침', Berserk:'광전사', Heal:'회복', Healing:'회복', Fireball:'화염구',
  Lightning:'번개', Meteor:'운석', Tornado:'회오리', Freeze:'빙결', Shield:'보호막', Poison:'독', Bomb:'폭탄',
  Rage:'분노', Stun:'기절', Spear:'창', Sword:'검', Axe:'도끼'
};

const EXACT_KR = {
  ForgeTimerSpeed:'대장간 업그레이드 시간 단축', ForgeUpgradeCost:'대장간 업그레이드 비용 감소', EquipmentSellPrice:'장비 판매가 증가',
  HammerThiefHammerReward:'망치 던전 망치 보상 증가', HammerThiefCoinReward:'망치 던전 코인 보상 증가',
  SkillDamage:'스킬 피해 증가', SkillPassiveDamage:'스킬 패시브 피해 증가', SkillPassiveHealth:'스킬 패시브 체력 증가',
  PetBonusDamage:'펫 피해 증가', PetBonusHealth:'펫 체력 증가', MountDamage:'탈것 피해 증가', MountHealth:'탈것 체력 증가',
  PlayerMoveSpeed:'플레이어 이동속도 증가', PlayerAttackRange:'플레이어 공격범위 증가', ForgeAnimationSpeed:'대장간 속도 증가',
  WeaponBonus:'무기 보너스', HelmetBonus:'투구 보너스', BodyBonus:'갑옷 보너스', ShoeBonus:'신발 보너스', GloveBonus:'장갑 보너스',
  BeltBonus:'벨트 보너스', NecklaceBonus:'목걸이 보너스', RingBonus:'반지 보너스', AutoForge:'자동 제작',
  CommonEggTimer:'일반 알 부화시간 단축', RareEggTimer:'희귀 알 부화시간 단축', EpicEggTimer:'영웅 알 부화시간 단축',
  LegendaryEggTimer:'전설 알 부화시간 단축', UltimateEggTimer:'궁극 알 부화시간 단축', MythicEggTimer:'신화 알 부화시간 단축',
  PersonalWarRewards:'개인 클랜전 보상 증가', ClanWarWinRewards:'클랜전 승리 보상 증가', ClanWarLoseRewards:'클랜전 패배 보상 증가',
  ClanWarDamage:'클랜전 피해 증가', ClanWarHealth:'클랜전 체력 증가', MissionDamage:'미션 피해 증가', MissionHealth:'미션 체력 증가',
  MissionRewards:'미션 보상 증가', GuildTechRaceScoreMultiplier:'클랜 기술 레이스 점수 증가', GuildTechRaceRewardMultiplier:'클랜 기술 레이스 보상 증가',
  SkillSummonCost:'스킬 소환 비용 감소', MountSummonCost:'탈것 소환 비용 감소', ExtraMountChance:'추가 탈것 획득 확률', TechResearchTimer:'기술 연구 시간 단축',
  TechNodeUpgradeCost:'기술 업그레이드 비용 감소'
};

const TOKEN_KR = {
  Player:'플레이어',Move:'이동',Speed:'속도',Attack:'공격',Range:'범위',Weapon:'무기',Helmet:'투구',Body:'갑옷',Shoe:'신발',Glove:'장갑',Belt:'벨트',Necklace:'목걸이',Ring:'반지',Bonus:'보너스',Damage:'피해',Health:'체력',Skill:'스킬',Passive:'패시브',Pet:'펫',Mount:'탈것',Forge:'대장간',Timer:'시간',Animation:'속도',Common:'일반',Rare:'희귀',Epic:'영웅',Legendary:'전설',Ultimate:'궁극',Mythic:'신화',Egg:'알',Tech:'기술',Potion:'포션',Cost:'비용',Summon:'소환',Level:'레벨',Auto:'자동',War:'클랜전',Points:'점수',Rewards:'보상',Reward:'보상',Win:'승리',Won:'승리',Lose:'패배',Lost:'패배',Mission:'미션',Dungeon:'던전',Hammer:'망치',Thief:'도둑',Ghost:'유령',Town:'마을',Invasion:'침공',Zombie:'좀비',Rush:'돌진',League:'리그',Guild:'클랜',Race:'레이스',Score:'점수',Multiplier:'배율',Personal:'개인',Forging:'제작',Spend:'소모',Hatch:'부화',Merge:'합성',Upgrade:'업그레이드',Price:'가격',Sell:'판매',Extra:'추가',Chance:'확률',Research:'연구',Node:'노드',Equipment:'장비',Coin:'코인',From:'획득',Day:'일차',On:'',All:'전체',Member:'멤버'
};

const FALLBACK_FORGE = (() => {
  const durations=[300,900,1800,3600,7200,27200,47200,67200,87200,107200,127200,147200,167200,187200,207200,227200,247200,277200,307200,337200,367200,397200,427200,457200,487200,517200,547200,577200,607200,637200,667200,697200,727200,757200];
  const costs=[400,700,1500,3500,10000,25000,50000,100000,150000,250000,350000,450000,600000,800000,910000,1020000,1130000,1240000,1350000,1460000,1570000,1680000,1790000,1900000,2010000,2120000,2230000,2340000,2450000,2560000,2670000,2780000,2890000,3000000];
  const tiers=[1,1,1,1,1,1,1,3,3,3,3,4,4,5,5,6,7,8,9,10,10,10,10,10,10,10,10,10,10,10,10,10,10,10];
  return Object.fromEntries(durations.map((Duration,i)=>[String(i+1),{Level:i+1,Duration,Cost:costs[i],Tiers:tiers[i]}]));
})();
const FALLBACK_DUNGEON_REWARDS = {
  Hammer:{DungeonType:'Hammer',CurrencyType:['Hammers','Coins'],RewardBase:[60,4000],RewardIncrease:[1,100]},
  Skill:{DungeonType:'Skill',CurrencyType:['SkillSummonTickets'],RewardBase:[200],RewardIncrease:[2]},
  Potion:{DungeonType:'Potion',CurrencyType:['TechPotions'],RewardBase:[100],RewardIncrease:[1]},
  Pet:{DungeonType:'Pet',CurrencyType:['Eggshells'],RewardBase:[200],RewardIncrease:[0.65]}
};
const FALLBACK_GUILD_TECH = {
  SkillDamage:{Type:'SkillDamage',MaxLevel:20,PointsPerLevel:1215,ValuePerLevel:.05},
  PetBonusDamage:{Type:'PetBonusDamage',MaxLevel:20,PointsPerLevel:608,ValuePerLevel:.05},PetBonusHealth:{Type:'PetBonusHealth',MaxLevel:20,PointsPerLevel:608,ValuePerLevel:.05},
  MountDamage:{Type:'MountDamage',MaxLevel:20,PointsPerLevel:608,ValuePerLevel:.05},MountHealth:{Type:'MountHealth',MaxLevel:20,PointsPerLevel:608,ValuePerLevel:.05},
  ForgeAnimationSpeed:{Type:'ForgeAnimationSpeed',MaxLevel:20,PointsPerLevel:608,ValuePerLevel:.05},PlayerMoveSpeed:{Type:'PlayerMoveSpeed',MaxLevel:20,PointsPerLevel:608,ValuePerLevel:.05},
  PlayerAttackRange:{Type:'PlayerAttackRange',MaxLevel:3,PointsPerLevel:4056,ValuePerLevel:1},ClanWarWinRewards:{Type:'ClanWarWinRewards',MaxLevel:10,PointsPerLevel:1622,ValuePerLevel:.01},ClanWarLoseRewards:{Type:'ClanWarLoseRewards',MaxLevel:10,PointsPerLevel:1622,ValuePerLevel:.01}
};

function $(id){return document.getElementById(id)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function num(v,d=0){const n=Number(v);return Number.isFinite(n)?n:d}
function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function fmt(n,dec=2){n=Number(n);if(!Number.isFinite(n))return '-';const a=Math.abs(n);if(a>=1e9)return `${trim(n/1e9,2)}B`;if(a>=1e6)return `${trim(n/1e6,2)}M`;if(a>=1e3)return `${trim(n/1e3,2)}K`;return trim(n,dec)}
function trim(n,d=2){return Number(n).toLocaleString('ko-KR',{maximumFractionDigits:d,minimumFractionDigits:0})}
function pct(n){return `${trim(num(n)*100,1)}%`}
function secText(s){s=num(s);if(s<60)return `${trim(s,1)}초`;const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600),m=Math.floor((s%3600)/60);return [d&&`${d}일`,h&&`${h}시간`,m&&`${m}분`].filter(Boolean).join(' ')||`${Math.round(s)}초`}
function splitCamel(s){return String(s).replace(/([a-z0-9])([A-Z])/g,'$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g,'$1 $2').split(/[_\s]+/).filter(Boolean)}
function krName(id){if(EXACT_KR[id])return EXACT_KR[id];if(SKILL_KR[id])return SKILL_KR[id];const parts=splitCamel(id);const out=parts.map(x=>TOKEN_KR[x]||x).filter(Boolean).join(' ');return out || id}
function rarityKr(r){return RARITY_KR[r]||r}
function currencyKr(c){return CURRENCY_KR[c]||krName(c)}
function metric(label,value,sub=''){return `<div class="metric"><span class="label">${esc(label)}</span><div class="value">${value}</div>${sub?`<div class="sub">${sub}</div>`:''}</div>`}
function statRow(label,value){return `<div class="stat-row"><span>${esc(label)}</span><b>${value}</b></div>`}
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>t.classList.remove('show'),1600)}
function loadSavedState(){
  try{
    let raw=localStorage.getItem(STATE_KEY);
    if(!raw){
      const legacy=localStorage.getItem(LEGACY_STATE_KEY);
      if(legacy){raw=legacy;localStorage.setItem(STATE_KEY,legacy)}
    }
    return {...structuredClone(DEFAULT_STATE),...JSON.parse(raw||'{}')}
  }catch{return structuredClone(DEFAULT_STATE)}
}
function saveState(){localStorage.setItem(STATE_KEY,JSON.stringify(state));renderComputed();}
function selectedCount(obj){return Object.values(obj||{}).filter(v=>num(v?.level??v)>0).length}

function cacheGet(name){try{const raw=localStorage.getItem(CACHE_PREFIX+name);if(!raw)return null;const x=JSON.parse(raw);if(Date.now()-x.t>7*864e5)return null;return x.v}catch{return null}}
function cacheSet(name,v){try{const text=JSON.stringify(v);if(text.length<700000)localStorage.setItem(CACHE_PREFIX+name,JSON.stringify({t:Date.now(),v}))}catch{}}
async function fetchConfig(name,{force=false,cache=true}={}){
  if(data[name]&&!force)return data[name];
  if(cache&&!force){const c=cacheGet(name);if(c){data[name]=c;loadState[name]='cache';return c}}
  loadState[name]='loading';renderDataFiles();
  try{
    const r=await fetch(`${CONFIG_BASE}${name}.json`,{cache:force?'reload':'default',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw new Error(`${r.status}`);
    const j=await r.json();data[name]=j;loadState[name]='ok';if(cache)cacheSet(name,j);renderDataFiles();return j;
  }catch(e){loadState[name]='fail';renderDataFiles();throw e}
}
function installFallbacks(){
  data.ForgeUpgradeLibrary ||= FALLBACK_FORGE;
  data.DungeonRewardLibrary ||= FALLBACK_DUNGEON_REWARDS;
  data.GuildTechTreeUpgradeLibrary ||= FALLBACK_GUILD_TECH;
}

function setupNav(){
  $('nav').innerHTML=NAV.map(([id,icon,label])=>`<button class="nav-btn ${id==='home'?'active':''}" data-page="${id}"><span class="nav-icon">${icon}</span><span>${label}</span></button>`).join('');
  document.querySelectorAll('.nav-btn').forEach(b=>b.addEventListener('click',()=>go(b.dataset.page)));
  $('quickGrid').innerHTML=NAV.slice(2,12).map(([id,icon,label])=>`<button class="quick-btn" data-go="${id}"><strong>${icon} ${label}</strong><small>바로 열기</small></button>`).join('');
  document.querySelectorAll('[data-go]').forEach(b=>b.addEventListener('click',()=>go(b.dataset.go)));
}
function go(id){
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id===id));
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.toggle('active',b.dataset.page===id));
  $('sidebar').classList.remove('open');$('backdrop').classList.remove('show');window.scrollTo({top:0,behavior:'instant'});
  if(id==='companions')ensureCompanionUpgrades();
  if(id==='dungeons')ensureDungeon(dataOrDefault('dungeonType','Hammer'));
}
function dataOrDefault(id,d){return $(id)?.value||d}

function getPlayerTechValue(type){
  const cfg=data.PlayerTechTreeNodeValuesLibrary?.[type];const s=state.playerTech[type];if(!cfg||!s||num(s.level)<=0)return 0;
  const tiers=cfg.Tiers||[];const ti=clamp(num(s.tier,1)-1,0,Math.max(0,tiers.length-1));const arr=tiers[ti]?.StatValuePerLevel||[];const li=clamp(num(s.level)-1,0,Math.max(0,arr.length-1));return num(arr[li]);
}
function getGuildTechValue(type){
  const cfg=data.GuildTechTreeUpgradeLibrary?.[type];if(!cfg)return 0;const level=Math.max(0,num(state.guildTech[type]));const max=num(cfg.MaxLevel,0);
  const regular=Math.min(level,max)*num(cfg.ValuePerLevel);const inf=Math.max(0,level-max)*num(cfg.ValuePerInfiniteLevel);return regular+inf;
}
function bonuses(){
  return {
    forgeSpeed:getPlayerTechValue('ForgeTimerSpeed')+getGuildTechValue('ForgeAnimationSpeed'),
    forgeCost:getPlayerTechValue('ForgeUpgradeCost'),
    skillDamage:getPlayerTechValue('SkillDamage')+getGuildTechValue('SkillDamage'),
    skillPassiveDamage:getPlayerTechValue('SkillPassiveDamage'),skillPassiveHealth:getPlayerTechValue('SkillPassiveHealth'),
    petDamage:getPlayerTechValue('PetBonusDamage')+getGuildTechValue('PetBonusDamage'),petHealth:getPlayerTechValue('PetBonusHealth')+getGuildTechValue('PetBonusHealth'),
    mountDamage:getPlayerTechValue('MountDamage')+getGuildTechValue('MountDamage'),mountHealth:getPlayerTechValue('MountHealth')+getGuildTechValue('MountHealth'),
    moveSpeed:getPlayerTechValue('PlayerMoveSpeed')+getGuildTechValue('PlayerMoveSpeed'),
    attackRange:getPlayerTechValue('PlayerAttackRange')+getGuildTechValue('PlayerAttackRange'),
    weapon:getPlayerTechValue('WeaponBonus')+getGuildTechValue('WeaponBonus'),
    warWinRewards:getGuildTechValue('ClanWarWinRewards'),warLoseRewards:getGuildTechValue('ClanWarLoseRewards')
  };
}

function renderSummary(){
  const b=bonuses();$('summaryCards').innerHTML=[
    metric('대장간',`Lv.${state.forgeLevel}`,'최대 Lv.35'),metric('대장간 속도 보너스',pct(b.forgeSpeed),'예상 시간 계산에 적용'),
    metric('스킬 피해 보너스',pct(b.skillDamage),'기술 + 클랜 기술'),metric('이동속도 보너스',pct(b.moveSpeed),'기본값에 곱연산')
  ].join('');
}
function renderProfile(){
  fillForgeSelects();$('profileForgeLevel').value=state.forgeLevel;$('baseMoveSpeed').value=state.baseMoveSpeed;$('moveBaseCalc').value=state.baseMoveSpeed;
  const b=bonuses();$('bonusSummary').innerHTML=[
    statRow('대장간 속도',`+${pct(b.forgeSpeed)}`),statRow('대장간 비용 감소',`-${pct(b.forgeCost)}`),statRow('스킬 피해',`+${pct(b.skillDamage)}`),
    statRow('펫 피해 / 체력',`+${pct(b.petDamage)} / +${pct(b.petHealth)}`),statRow('탈것 피해 / 체력',`+${pct(b.mountDamage)} / +${pct(b.mountHealth)}`),
    statRow('이동속도',`+${pct(b.moveSpeed)}`),statRow('공격범위',`+${trim(b.attackRange,2)}`)
  ].join('');
}

function techDescription(type,value){
  const percentLike=!['PlayerAttackRange','AutoForge'].includes(type);
  if(type==='PlayerAttackRange')return `공격범위 +${trim(value,2)}`;
  if(type==='AutoForge')return `효과값 ${trim(value,2)}`;
  return `${krName(type)} ${value>=0?'+':''}${percentLike?pct(value):trim(value)}`;
}
function renderPlayerTech(){
  const lib=data.PlayerTechTreeNodeValuesLibrary;if(!lib){$('playerTechList').innerHTML='<div class="skeleton">기술 데이터를 불러오지 못했습니다.</div>';return}
  const q=$('playerTechSearch').value.trim().toLowerCase(),active=$('playerTechFilter').value==='active';
  const rows=Object.entries(lib).filter(([type])=>(!active||num(state.playerTech[type]?.level)>0)&&(!q||`${type} ${krName(type)}`.toLowerCase().includes(q)));
  $('playerTechList').innerHTML=rows.map(([type,cfg])=>{
    const tiers=cfg.Tiers||[];const s=state.playerTech[type]||{tier:1,level:0};const ti=clamp(num(s.tier,1),1,Math.max(1,tiers.length));const levels=tiers[ti-1]?.StatValuePerLevel||[];const lv=clamp(num(s.level),0,levels.length);const val=lv?num(levels[lv-1]):0;
    return `<article class="data-card ${lv?'active-card':''}"><div class="card-head"><div><div class="card-title">${esc(krName(type))}</div><small class="internal">${esc(type)}</small></div><span class="badge">${tiers.length}티어</span></div>
      <div class="card-controls"><div class="control-line"><label>티어</label><select data-pt-tier="${esc(type)}">${tiers.map((_,i)=>`<option value="${i+1}" ${i+1===ti?'selected':''}>티어 ${i+1}</option>`).join('')}</select></div>
      <div class="control-line"><label>레벨</label><select data-pt-level="${esc(type)}"><option value="0">0</option>${levels.map((_,i)=>`<option value="${i+1}" ${i+1===lv?'selected':''}>${i+1}</option>`).join('')}</select></div></div>
      <div class="effect-box">현재 효과: <strong>${lv?esc(techDescription(type,val)):'미적용'}</strong></div></article>`;
  }).join('')||'<div class="skeleton">검색 결과가 없습니다.</div>';
  document.querySelectorAll('[data-pt-tier]').forEach(el=>el.onchange=()=>{const t=el.dataset.ptTier;const cur=state.playerTech[t]||{level:0};state.playerTech[t]={tier:num(el.value,1),level:cur.level||0};saveState();renderPlayerTech()});
  document.querySelectorAll('[data-pt-level]').forEach(el=>el.onchange=()=>{const t=el.dataset.ptLevel;const cur=state.playerTech[t]||{tier:1};state.playerTech[t]={tier:cur.tier||1,level:num(el.value)};saveState();renderPlayerTech()});
}
function renderGuildTech(){
  const lib=data.GuildTechTreeUpgradeLibrary;if(!lib){$('guildTechList').innerHTML='<div class="skeleton">클랜 기술 데이터를 불러오지 못했습니다.</div>';return}
  const q=$('guildTechSearch').value.trim().toLowerCase(),active=$('guildTechFilter').value==='active';
  const rows=Object.entries(lib).filter(([type])=>(!active||num(state.guildTech[type])>0)&&(!q||`${type} ${krName(type)}`.toLowerCase().includes(q)));
  $('guildTechList').innerHTML=rows.map(([type,cfg])=>{
    const max=num(cfg.MaxLevel),lv=clamp(num(state.guildTech[type]),0,max+99),val=getGuildTechValue(type),pts=Math.min(lv,max)*num(cfg.PointsPerLevel)+Math.max(0,lv-max)*num(cfg.PointsPerInfiniteLevel);
    return `<article class="data-card ${lv?'active-card':''}"><div class="card-head"><div><div class="card-title">${esc(krName(type))}</div><small class="internal">${esc(type)}</small></div><span class="badge">MAX ${max}${cfg.ValuePerInfiniteLevel!=null?' +∞':''}</span></div>
      <div class="card-meta"><span class="mini">레벨당 ${formatEffectUnit(type,num(cfg.ValuePerLevel))}</span><span class="mini">포인트/레벨 ${fmt(cfg.PointsPerLevel,0)}</span></div>
      <div class="card-controls one"><div class="control-line"><label>현재 레벨</label><input data-gt-level="${esc(type)}" type="number" min="0" max="${cfg.ValuePerInfiniteLevel!=null?max+99:max}" value="${lv}" /></div></div>
      <div class="effect-box">누적 효과: <strong>${formatEffectUnit(type,val)}</strong> · 사용 포인트 약 ${fmt(pts,0)}</div></article>`;
  }).join('')||'<div class="skeleton">검색 결과가 없습니다.</div>';
  document.querySelectorAll('[data-gt-level]').forEach(el=>el.onchange=()=>{state.guildTech[el.dataset.gtLevel]=Math.max(0,num(el.value));saveState();renderGuildTech()});
}
function formatEffectUnit(type,v){return type==='PlayerAttackRange'?`+${trim(v,2)} 범위`:(type==='AutoForge'?trim(v,2):`+${pct(v)}`)}

function weaponLabel(w){const id=w.ItemId||{};const age=num(id.Age);if(age<0)return `${age===-1001?'테스트 원거리':'테스트 근접'} #${id.Idx}`;return `시대 ${age} · 무기 #${id.Idx}`}
function renderWeapons(){
  const lib=data.WeaponLibrary;if(!lib){$('weaponRows').innerHTML='<tr><td colspan="8">무기 데이터를 불러오지 못했습니다.</td></tr>';return}
  const q=$('weaponSearch').value.trim().toLowerCase(),f=$('weaponRangeFilter').value,b=bonuses();
  const rows=Object.values(lib).filter(w=>{const label=weaponLabel(w).toLowerCase();return (!q||label.includes(q))&&(f==='all'||(f==='ranged'&&w.IsRanged)||(f==='melee'&&!w.IsRanged))}).sort((a,b)=>num(a.ItemId?.Age)-num(b.ItemId?.Age)||num(a.ItemId?.Idx)-num(b.ItemId?.Idx));
  $('weaponRows').innerHTML=rows.map(w=>{const dur=num(w.AttackDuration),range=num(w.AttackRange),final=range+b.attackRange;return `<tr><td>${esc(weaponLabel(w))}</td><td>${w.IsRanged?'원거리':'근접'}</td><td class="num">${trim(w.WindupTime,3)}초</td><td class="num">${trim(dur,3)}초</td><td class="num">${dur?trim(1/dur,3):'-'}회/초</td><td>${trim(range,2)}</td><td class="positive">+${trim(b.attackRange,2)}</td><td><b>${trim(final,2)}</b></td></tr>`}).join('');
}

function fillForgeSelects(){
  const opts=Array.from({length:35},(_,i)=>`<option value="${i+1}">Lv.${i+1}${i===34?' (MAX)':''}</option>`).join('');
  ['profileForgeLevel','forgeFrom','forgeTo'].forEach(id=>{if($(id)&&!$(id).options.length)$(id).innerHTML=opts});
  if(!$('forgeFrom').dataset.init){$('forgeFrom').value=state.forgeLevel;$('forgeTo').value=Math.min(35,Math.max(state.forgeLevel+1,35));$('forgeFrom').dataset.init='1'}
}
function forgeAdjusted(row){const b=bonuses();return {cost:num(row.Cost)*Math.max(0,1-b.forgeCost),duration:num(row.Duration)/(1+Math.max(0,b.forgeSpeed))}}
function renderForge(){
  fillForgeSelects();const lib=data.ForgeUpgradeLibrary||FALLBACK_FORGE;const from=clamp(num($('forgeFrom').value,state.forgeLevel),1,35),to=clamp(num($('forgeTo').value,35),1,35),a=Math.min(from,to),z=Math.max(from,to);
  const steps=[];for(let lv=a;lv<z;lv++){if(lib[String(lv)])steps.push(lib[String(lv)])}
  const baseCost=steps.reduce((s,r)=>s+num(r.Cost),0),baseTime=steps.reduce((s,r)=>s+num(r.Duration),0),adj=steps.reduce((s,r)=>{const x=forgeAdjusted(r);s.cost+=x.cost;s.time+=x.duration;return s},{cost:0,time:0}),b=bonuses();
  $('forgeResult').innerHTML=`<div class="result-main">Lv.${a} → Lv.${z}</div><div class="result-grid"><div class="result-tile"><span>기본 비용</span><b>${fmt(baseCost,0)}</b></div><div class="result-tile"><span>기술 적용 예상 비용</span><b>${fmt(adj.cost,0)}</b></div><div class="result-tile"><span>기본 시간</span><b>${secText(baseTime)}</b></div><div class="result-tile"><span>기술 적용 예상 시간</span><b>${secText(adj.time)}</b></div></div>`;
  $('forgeBonusInfo').innerHTML=statRow('대장간 시간 보너스',`+${pct(b.forgeSpeed)}`)+statRow('업그레이드 비용 감소',`-${pct(b.forgeCost)}`)+statRow('계산식','시간 ÷ (1 + 속도), 비용 × (1 - 감소율)');
  $('forgeRows').innerHTML=steps.map(r=>{const x=forgeAdjusted(r);return `<tr><td>Lv.${r.Level} → Lv.${num(r.Level)+1}</td><td>${fmt(r.Cost,0)}</td><td>${secText(r.Duration)}</td><td>${secText(x.duration)}</td><td>${r.Tiers??'-'}</td></tr>`}).join('')||'<tr><td colspan="5">같은 레벨입니다.</td></tr>';
}

function skillLevelStats(skill,displayLevel){const idx=clamp(displayLevel-1,0,9999);return {damage:num(skill.DamagePerLevel?.[idx]),health:num(skill.HealthPerLevel?.[idx])}}
function renderSkills(){
  const lib=data.SkillLibrary;if(!lib){$('skillList').innerHTML='<div class="skeleton">스킬 데이터를 불러오지 못했습니다.</div>';return}
  const rarities=[...new Set(Object.values(lib).map(x=>x.Rarity))];if($('skillRarity').options.length===1)rarities.forEach(r=>$('skillRarity').insertAdjacentHTML('beforeend',`<option value="${r}">${rarityKr(r)}</option>`));
  const q=$('skillSearch').value.trim().toLowerCase(),rf=$('skillRarity').value,b=bonuses();
  $('skillList').innerHTML=Object.entries(lib).filter(([id,s])=>(rf==='all'||s.Rarity===rf)&&(!q||`${id} ${krName(id)}`.toLowerCase().includes(q))).map(([id,s])=>{
    const max=Math.max(s.DamagePerLevel?.length||0,s.HealthPerLevel?.length||0,1),lv=clamp(num(state.skillLevels[id],1),1,max),st=skillLevelStats(s,lv),fd=st.damage*(1+b.skillDamage),fh=st.health*(1+b.skillPassiveHealth);
    return `<article class="data-card"><div class="card-head"><div><div class="card-title">${esc(krName(id))}</div><small class="internal">${esc(id)}</small></div><span class="badge">${rarityKr(s.Rarity)}</span></div>
      <div class="card-meta"><span class="mini">쿨타임 ${trim(s.Cooldown,2)}초</span><span class="mini">지속 ${trim(s.ActiveDuration,2)}초</span><span class="mini">최대 Lv.${max}</span></div>
      <div class="card-controls one"><div class="control-line"><label>레벨</label><input data-skill-level="${esc(id)}" type="number" min="1" max="${max}" value="${lv}"></div></div>
      <div class="effect-box">${st.damage?`피해 ${fmt(st.damage)} → <strong>${fmt(fd)}</strong> (${pct(b.skillDamage)} 적용)`:''}${st.damage&&st.health?'<br>':''}${st.health?`체력 ${fmt(st.health)} → <strong>${fmt(fh)}</strong> (${pct(b.skillPassiveHealth)} 적용)`:''}</div></article>`
  }).join('')||'<div class="skeleton">검색 결과가 없습니다.</div>';
  document.querySelectorAll('[data-skill-level]').forEach(el=>el.onchange=()=>{state.skillLevels[el.dataset.skillLevel]=num(el.value,1);saveState();renderSkills()});
}

let companionLoading=false;
async function ensureCompanionUpgrades(){if(companionLoading)return;companionLoading=true;try{await Promise.all([fetchConfig('PetUpgradeLibrary',{cache:false}),fetchConfig('MountUpgradeLibrary',{cache:false})])}catch{}finally{companionLoading=false;renderCompanions()}}
function extractCompanionStats(upgradeLib,rarity,displayLv,kind){
  const arr=upgradeLib?.[rarity]?.LevelInfo||[];const row=arr[clamp(displayLv-1,0,Math.max(0,arr.length-1))];const stats=row?.[`${kind}Stats`]?.Stats||[];const out={damage:0,health:0,exp:row?.Experience,max:arr.length};
  for(const x of stats){const t=x?.StatNode?.UniqueStat?.StatType;if(t==='Damage')out.damage=num(x.Value);if(t==='Health')out.health=num(x.Value)}return out;
}
function renderCompanions(){
  const b=bonuses();$('petBonusInfo').innerHTML=metric('펫 피해 보너스',`+${pct(b.petDamage)}`,'기술 + 클랜')+metric('펫 체력 보너스',`+${pct(b.petHealth)}`,'기술 + 클랜')+metric('펫 종류',data.PetLibrary?Object.keys(data.PetLibrary).length:'-','설정 데이터');
  $('mountBonusInfo').innerHTML=metric('탈것 피해 보너스',`+${pct(b.mountDamage)}`,'기술 + 클랜')+metric('탈것 체력 보너스',`+${pct(b.mountHealth)}`,'기술 + 클랜')+metric('탈것 종류',data.MountLibrary?Object.keys(data.MountLibrary).length:'-','설정 데이터');
  if(data.PetLibrary){$('petList').innerHTML=Object.values(data.PetLibrary).map(p=>{const id=p.PetId||{},key=`${id.Rarity}:${id.Id}`,max=data.PetUpgradeLibrary?.[id.Rarity]?.LevelInfo?.length||1,lv=clamp(num(state.petLevels[key],1),1,max),st=extractCompanionStats(data.PetUpgradeLibrary,id.Rarity,lv,'Pet');return `<article class="data-card"><div class="card-head"><div><div class="card-title">${rarityKr(id.Rarity)} 펫 #${id.Id+1}</div><small class="internal">${PET_TYPE_KR[p.Type]||p.Type}</small></div><span class="badge">${rarityKr(id.Rarity)}</span></div><div class="card-controls one"><div class="control-line"><label>레벨</label><input data-pet-level="${key}" type="number" min="1" max="${max}" value="${lv}"></div></div><div class="effect-box">${data.PetUpgradeLibrary?`피해 ${fmt(st.damage)} → <strong>${fmt(st.damage*(1+b.petDamage))}</strong><br>체력 ${fmt(st.health)} → <strong>${fmt(st.health*(1+b.petHealth))}</strong>`:'상세 레벨 데이터 불러오는 중…'}</div></article>`}).join('')}
  if(data.MountLibrary){$('mountList').innerHTML=Object.values(data.MountLibrary).map(m=>{const id=m.MountId||{},key=`${id.Rarity}:${id.Id}`,max=data.MountUpgradeLibrary?.[id.Rarity]?.LevelInfo?.length||1,lv=clamp(num(state.mountLevels[key],1),1,max),st=extractCompanionStats(data.MountUpgradeLibrary,id.Rarity,lv,'Mount');return `<article class="data-card"><div class="card-head"><div><div class="card-title">${rarityKr(id.Rarity)} 탈것 #${id.Id+1}</div><small class="internal">Collider ${trim(m.ColliderRadius,2)}</small></div><span class="badge">${rarityKr(id.Rarity)}</span></div><div class="card-controls one"><div class="control-line"><label>레벨</label><input data-mount-level="${key}" type="number" min="1" max="${max}" value="${lv}"></div></div><div class="effect-box">${data.MountUpgradeLibrary?`피해 ${fmt(st.damage)} → <strong>${fmt(st.damage*(1+b.mountDamage))}</strong><br>체력 ${fmt(st.health)} → <strong>${fmt(st.health*(1+b.mountHealth))}</strong>`:'상세 레벨 데이터 불러오는 중…'}</div></article>`}).join('')}
  document.querySelectorAll('[data-pet-level]').forEach(el=>el.onchange=()=>{state.petLevels[el.dataset.petLevel]=num(el.value,1);saveState();renderCompanions()});
  document.querySelectorAll('[data-mount-level]').forEach(el=>el.onchange=()=>{state.mountLevels[el.dataset.mountLevel]=num(el.value,1);saveState();renderCompanions()});
}

function renderMovement(){const b=bonuses(),mb=Math.max(0,num($('moveBaseCalc').value,state.baseMoveSpeed)),rb=Math.max(0,num($('rangeBaseCalc').value,1)),mf=mb*(1+b.moveSpeed),rf=rb+b.attackRange;
  $('moveCalc').innerHTML=`<div class="compare-item"><small>기본</small><b>${trim(mb,3)}</b></div><div class="compare-item"><small>증가</small><b class="positive">+${pct(b.moveSpeed)}</b></div><div class="compare-item"><small>최종</small><b>${trim(mf,3)}</b></div>`;
  $('rangeCalc').innerHTML=`<div class="compare-item"><small>기본</small><b>${trim(rb,3)}</b></div><div class="compare-item"><small>증가</small><b class="positive">+${trim(b.attackRange,3)}</b></div><div class="compare-item"><small>최종</small><b>${trim(rf,3)}</b></div>`;
}

function playerDungeonBonus(type,currency){
  const candidates=[];
  if(type==='Hammer'&&currency==='Hammers')candidates.push('HammerThiefHammerReward');
  if(type==='Hammer'&&currency==='Coins')candidates.push('HammerThiefCoinReward');
  if(type==='Skill')candidates.push('SkillDungeonReward','SkillDungeonTicketReward','SkillSummonTicketsDungeonReward');
  if(type==='Potion')candidates.push('PotionDungeonReward','TechPotionDungeonReward');
  if(type==='Pet')candidates.push('EggDungeonReward','PetDungeonReward','EggshellDungeonReward');
  for(const c of candidates){const v=getPlayerTechValue(c);if(v)return v}
  const keys=Object.keys(state.playerTech||{}).filter(k=>num(state.playerTech[k]?.level)>0);
  const words={Hammer:['HammerThief'],Skill:['Skill'],Potion:['Potion'],Pet:['Egg']}[type]||[];
  const currencyWord={Hammers:'Hammer',Coins:'Coin',SkillSummonTickets:'Skill',TechPotions:'Potion',Eggshells:'Egg'}[currency]||'';
  const match=keys.find(k=>words.some(w=>k.includes(w))&&k.includes('Reward')&&(!currencyWord||k.includes(currencyWord)));
  return match?getPlayerTechValue(match):0;
}
function dungeonRewardsAt(type,level){const cfg=(data.DungeonRewardLibrary||FALLBACK_DUNGEON_REWARDS)[type];if(!cfg)return[];return (cfg.CurrencyType||[]).map((c,i)=>{const base=num(cfg.RewardBase?.[i])+level*num(cfg.RewardIncrease?.[i]);const bonus=playerDungeonBonus(type,c);return {type:c,base,bonus,final:base*(1+bonus)}})}
async function ensureDungeon(type){const name=DUNGEON_FILES[type];if(!name||data[name]){renderDungeons();return}try{await fetchConfig(name)}catch{}renderDungeons()}
function renderDungeons(){
  const type=$('dungeonType').value,lib=data[DUNGEON_FILES[type]],max=lib?Math.max(...Object.values(lib).map(x=>num(x.Level))):0;let lv=clamp(Math.floor(num($('dungeonLevel').value)),0,max||999);$('dungeonLevel').value=lv;
  const rewards=dungeonRewardsAt(type,lv),battle=lib?.[String(lv)]||Object.values(lib||{}).find(x=>num(x.Level)===lv);
  $('dungeonSummary').innerHTML=metric('선택 단계',`${lv}`,'내부 단계값')+metric('적 피해',battle?fmt(battle.Damage,0):'-','BattleLibrary')+metric('적 체력',battle?fmt(battle.Health,0):'-','BattleLibrary')+metric('보상',rewards.map(r=>`${currencyKr(r.type)} ${fmt(r.final,1)}`).join('<br>')||'-','기술 보정 적용');
  if(!lib){$('dungeonRows').innerHTML='<tr><td colspan="4">단계 데이터 불러오는 중…</td></tr>';return}
  const vals=Object.values(lib).sort((a,b)=>num(a.Level)-num(b.Level));const start=Math.max(0,lv-12),end=Math.min(vals.length,start+25);$('dungeonRows').innerHTML=vals.slice(start,end).map(x=>{const rs=dungeonRewardsAt(type,num(x.Level));return `<tr ${num(x.Level)===lv?'class="selected"':''}><td>${x.Level}</td><td>${fmt(x.Damage,0)}</td><td>${fmt(x.Health,0)}</td><td>${rs.map(r=>`${currencyKr(r.type)} <b>${fmt(r.final,1)}</b>${r.bonus?` <span class="positive">(+${pct(r.bonus)})</span>`:''}`).join('<br>')}</td></tr>`}).join('');
}

function renderArena(){
  const leagues=data.ArenaLeagueLibrary,rewards=data.ArenaRewardLibrary;if(!leagues||!rewards){$('arenaRows').innerHTML='<tr><td colspan="2">리그 데이터를 불러오지 못했습니다.</td></tr>';return}
  if(!$('arenaLeague').options.length)$('arenaLeague').innerHTML=Object.keys(leagues).map(id=>`<option value="${id}">리그 ${num(id)+1}</option>`).join('');
  const id=$('arenaLeague').value||'0',l=leagues[id],r=rewards[id],q=$('arenaSearch').value.trim();
  $('arenaInfo').innerHTML=metric('선택 리그',`리그 ${num(id)+1}`,`내부 ID ${id}`)+metric('승급 기준',l.PromotionEnd<0?'최상위':`상위 ${l.PromotionEnd}%`,'설정값')+metric('강등 기준',l.DemotionStart<0?'없음':`${l.DemotionStart}%부터`,'설정값');
  const ranks=r?.Rank||[];$('arenaRows').innerHTML=ranks.filter(x=>{if(!q)return true;const n=num(q)-1;return n>=num(x.FromRank)&&n<=num(x.ToRank)}).map(x=>{const a=num(x.FromRank)+1,b=num(x.ToRank)+1;return `<tr><td>${a===b?`${a}위`:`${a}~${b}위`}</td><td>${renderRewardInline(x.Rewards)}</td></tr>`}).join('')||'<tr><td colspan="2">해당 순위가 없습니다.</td></tr>';
}
function rewardMultiplierFor(type,win){let mult=1+(win?bonuses().warWinRewards:bonuses().warLoseRewards);if(type==='GuildPotions'){const extra=getGuildTechValue(win?'GuildPotionsFromClanWarWin':'GuildPotionsFromClanWarLose')||getGuildTechValue(win?'GuildPotionsFromWarWin':'GuildPotionsFromWarLose');mult*=1+extra}return mult}
function renderRewardInline(rs){return (rs||[]).map(r=>`${currencyKr(r.Type)} <b>${fmt(r.Amount,0)}</b>`).join(' · ')}
function renderGuildRewards(){
  const lib=data.GuildTierConfig;if(!lib){$('guildWinRewards').innerHTML='클랜 등급 데이터를 불러오지 못했습니다.';return}
  if(!$('guildTier').options.length)$('guildTier').innerHTML=Object.keys(lib).map(t=>`<option value="${t}">${t} 등급</option>`).join('');const tier=$('guildTier').value||Object.keys(lib)[0],cfg=lib[tier];if(!cfg)return;
  $('guildRewardHeader').innerHTML=metric('클랜 등급',`${tier}`,'설정 데이터')+metric('필요 점수',fmt(cfg.RequiredPoints,0),'등급 진입 기준')+metric('등급점수',`승 +${cfg.TierPointsOnWin} / 패 +${cfg.TierPointsOnLose}`,'클랜전 결과');
  const render=(rs,win)=>(rs||[]).map(r=>{const m=rewardMultiplierFor(r.Type,win),final=num(r.Amount)*m;return `<div class="reward-row"><div class="reward-name">${currencyKr(r.Type)}</div><div class="reward-val"><b>${fmt(final,1)}</b>${m!==1?`<span class="base">기본 ${fmt(r.Amount,0)} · +${pct(m-1)}</span>`:''}</div></div>`}).join('');
  $('guildWinRewards').innerHTML=render(cfg.WarWonRewards,true);$('guildLoseRewards').innerHTML=render(cfg.WarLostRewards,false);
}

function renderDataFiles(){if(!$('dataFileList'))return;const names=[...new Set([...REQUIRED,...Object.values(DUNGEON_FILES),'PetUpgradeLibrary','MountUpgradeLibrary'])];$('dataFileList').innerHTML=names.map(n=>{const s=loadState[n]||(data[n]?'ok':'idle'),label={ok:'완료',cache:'캐시',loading:'로딩…',fail:'실패',idle:'필요 시 로드'}[s]||s;return `<div class="file-chip ${['ok','cache'].includes(s)?'ok':s==='fail'?'fail':''}"><span>${n}</span><span>${label}</span></div>`}).join('')}
function renderComputed(){renderSummary();renderProfile();renderWeapons();renderForge();renderSkills();renderCompanions();renderMovement();renderDungeons();renderArena();renderGuildRewards()}

async function loadCore(force=false){
  $('dataStatus').className='status-pill loading';$('dataStatus').textContent='데이터 불러오는 중';
  const settled=await Promise.allSettled(REQUIRED.map(n=>fetchConfig(n,{force})));
  installFallbacks();const ok=settled.filter(x=>x.status==='fulfilled').length;
  $('dataStatus').className=`status-pill ${ok===REQUIRED.length?'ok':'error'}`;$('dataStatus').textContent=ok===REQUIRED.length?'2.8.2 데이터 준비됨':`부분 로드 ${ok}/${REQUIRED.length}`;
  renderAll();
}
function renderAll(){renderPlayerTech();renderGuildTech();renderComputed();renderDataFiles()}

function bind(){
  $('menuBtn').onclick=()=>{$('sidebar').classList.toggle('open');$('backdrop').classList.toggle('show')};$('backdrop').onclick=()=>{$('sidebar').classList.remove('open');$('backdrop').classList.remove('show')};
  $('resetBtn').onclick=()=>{if(confirm('저장한 기술/클랜/레벨 설정을 모두 초기화할까요?')){state=structuredClone(DEFAULT_STATE);saveState();renderAll();toast('설정을 초기화했습니다')}};
  document.querySelectorAll('[data-reset]').forEach(b=>b.onclick=()=>{const k=b.dataset.reset;if(k==='playerTech')state.playerTech={};if(k==='guildTech')state.guildTech={};saveState();renderAll();toast('초기화했습니다')});
  $('profileForgeLevel').onchange=()=>{state.forgeLevel=num($('profileForgeLevel').value,1);$('forgeFrom').value=state.forgeLevel;saveState()};
  $('baseMoveSpeed').onchange=()=>{state.baseMoveSpeed=Math.max(0,num($('baseMoveSpeed').value,1));$('moveBaseCalc').value=state.baseMoveSpeed;saveState()};
  $('playerTechSearch').oninput=renderPlayerTech;$('playerTechFilter').onchange=renderPlayerTech;$('guildTechSearch').oninput=renderGuildTech;$('guildTechFilter').onchange=renderGuildTech;
  $('weaponSearch').oninput=renderWeapons;$('weaponRangeFilter').onchange=renderWeapons;$('forgeFrom').onchange=renderForge;$('forgeTo').onchange=renderForge;
  $('skillSearch').oninput=renderSkills;$('skillRarity').onchange=renderSkills;$('moveBaseCalc').oninput=renderMovement;$('rangeBaseCalc').oninput=renderMovement;
  $('dungeonType').onchange=()=>ensureDungeon($('dungeonType').value);$('dungeonLevel').oninput=renderDungeons;$('arenaLeague').onchange=renderArena;$('arenaSearch').oninput=renderArena;$('guildTier').onchange=renderGuildRewards;
  document.querySelectorAll('[data-subtab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-subtab]').forEach(x=>x.classList.toggle('active',x===b));$('petsPane').classList.toggle('active',b.dataset.subtab==='pets');$('mountsPane').classList.toggle('active',b.dataset.subtab==='mounts')});
  $('reloadData').onclick=async()=>{Object.keys(localStorage).filter(k=>k.startsWith(CACHE_PREFIX)).forEach(k=>localStorage.removeItem(k));await loadCore(true);toast('데이터를 다시 불러왔습니다')};
}

async function init(){
  setupNav();bind();installFallbacks();fillForgeSelects();renderAll();
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))navigator.serviceWorker.register('./sw.js').catch(()=>{});
  await loadCore(false);
}
init();
