(function enhanceFactory(){
  S.techTree=Object.assign({Forge:{},Power:{},SkillsPetTech:{}},S.techTree||{});
  S.calc=Object.assign({forge:{from:1,to:35,gems:0},offline:{hours:4,minutes:0},dungeon:{type:'Hammer',level:1},arena:{league:0},skin:{}},S.calc||{});
  const TECH_KO={
    ForgeTimerSpeed:'제련 속도',ForgeUpgradeCost:'대장간 강화 비용 감소',EquipmentSellPrice:'장비 판매 가격 증가',
    HammerThiefHammerReward:'망치 도둑 망치 보상',HammerThiefCoinReward:'망치 도둑 코인 보상',AutoForge:'자동 제련',
    FreeForgeChance:'무료 제련 확률',MaxOfflineReward:'최대 오프라인 보상 시간',CoinOfflineReward:'오프라인 코인 보상',
    HammerOfflineReward:'오프라인 망치 보상',WeaponBonus:'무기 능력치',HelmetBonus:'투구 능력치',BodyBonus:'갑옷 능력치',
    ShoeBonus:'신발 능력치',GloveBonus:'장갑 능력치',BeltBonus:'벨트 능력치',NecklaceBonus:'목걸이 능력치',RingBonus:'반지 능력치',
    WeaponLevelUp:'무기 최대 레벨',HelmetLevelUp:'투구 최대 레벨',BodyLevelUp:'갑옷 최대 레벨',ShoeLevelUp:'신발 최대 레벨',
    GloveLevelUp:'장갑 최대 레벨',BeltLevelUp:'벨트 최대 레벨',NecklaceLevelUp:'목걸이 최대 레벨',RingLevelUp:'반지 최대 레벨',
    MountDamage:'탈것 피해',MountHealth:'탈것 체력',ExtraMountChance:'추가 탈것 획득 확률',MountSummonCost:'탈것 소환 비용 감소',
    SkillDamage:'스킬 피해',SkillPassiveDamage:'스킬 패시브 피해',SkillPassiveHealth:'스킬 패시브 체력',
    GhostTownSkillBonus:'유령 마을 스킬 티켓 보상',SkillSummonCost:'스킬 소환 비용 감소',PetBonusDamage:'펫 피해',
    PetBonusHealth:'펫 체력',ExtraEggChance:'추가 알 획득 확률',CommonEggTimer:'일반 알 부화 시간',
    RareEggTimer:'희귀 알 부화 시간',EpicEggTimer:'에픽 알 부화 시간',LegendaryEggTimer:'전설 알 부화 시간',
    UltimateEggTimer:'궁극 알 부화 시간',MythicEggTimer:'신화 알 부화 시간',ZombieRushTechPotions:'좀비 러시 기술 포션 보상',
    TechNodeUpgradeCost:'기술 연구 비용 감소',TechResearchTimer:'기술 연구 시간 단축'
  };
  const TREE_KO={Forge:'대장간',Power:'힘',SkillsPetTech:'스킬·펫·기술'};
  const CURRENCY_KO={Hammers:'망치',Coins:'코인',SkillSummonTickets:'스킬 티켓',Eggshells:'에그셸',TechPotions:'기술 포션',ClockWinders:'탈것 열쇠',GuildPotions:'클랜 포션'};
  const LEAGUE_KO=['언랭크','브론즈','실버','골드','플래티넘','다이아몬드 I','다이아몬드 II','다이아몬드 III'];
  const SET_KO={SantaSet:'산타 세트',SkiSet:'스노보드 세트',SnowmanSet:'눈사람 세트',LeprechaunSet:'레프리콘 세트',FlowerSet:'꽃 세트',DruidSet:'드루이드 세트',BunnySet:'토끼 세트',ClownSet:'광대 세트',MillionaireSet:'백만장자 세트',FishbowlSet:'어항 세트',EagleSet:'독수리 세트',SkaterSet:'스케이터 세트',CatSet:'고양이 세트',SharkSet:'상어 세트',MushroomSet:'버섯 세트',AnubisSet:'아누비스 세트',BoxerSet:'복서 세트',DarkPlanetWarriorSet:'그림자 세트',CubeguySet:'큐브가이 세트',LavamanSet:'라바맨 세트',ChefSet:'셰프 세트',MummySet:'미라 세트',SkeletonSet:'스켈레톤 세트',ReaperSet:'리퍼 세트',DemonSet:'데몬 세트',KnightSet:'기사 세트',KingSet:'왕 세트'};
  function sec(t){t=Math.max(0,num(t));let d=Math.floor(t/86400),h=Math.floor(t%86400/3600),m=Math.floor(t%3600/60),s=Math.round(t%60);return[d?d+'일':'',h?h+'시간':'',m?m+'분':'',(!d&&!h&&s)?s+'초':''].filter(Boolean).join(' ')||'0초'}
  function stage(l){l=Math.max(1,Math.min(400,Math.floor(num(l,1))));return Math.floor((l-1)/10)+1+'-'+(((l-1)%10)+1)}
  async function techData(){return Promise.all([j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`),j(`${CFG}/PlayerTechTreeTierLibrary.json`)])}
  function tLevel(tree,id){return Math.max(0,Math.floor(num(S.techTree?.[tree]?.[id])))}
  function tArray(type,tier,vals){return vals?.[type]?.Tiers?.[tier]?.StatValuePerLevel||[]}
  function tEffect(type,tier,level,vals){let a=tArray(type,tier,vals);return level>0?num(a[Math.min(level,a.length)-1]):0}
  function tMax(type,tier,vals){return tArray(type,tier,vals).length}
  function sumType(type,pos,vals){let out=0;for(const tree of ['Forge','Power','SkillsPetTech'])for(const node of pos?.[tree]?.Nodes||[])if(node.Type===type)out+=tEffect(type,node.Tier,tLevel(tree,node.Id),vals);return out}
  function effectText(type,val){
    if(!val)return '0';
    if(type==='AutoForge')return '단계 '+fmt(val);
    if(/LevelUp$/.test(type))return '+'+fmt(val)+'레벨';
    if(type==='PlayerAttackRange')return '+'+fmt(val);
    return '+'+fmt(val*100)+'%';
  }
  function descendants(nodes,id){let out=[];function rec(x){for(const n of nodes)if((n.Requirements||[]).includes(x)&&!out.includes(n.Id)){out.push(n.Id);rec(n.Id)}}rec(id);return out}
  async function techTreeV2(){
    let e=$('#app'),[pos,vals,tiers]=await techData(),tree='Forge',tier=0;
    function render(){
      const nodes=(pos[tree]?.Nodes||[]).filter(x=>x.Tier===tier);
      let spent=0,duration=0;
      for(const n of pos[tree]?.Nodes||[]){let lv=tLevel(tree,n.Id),inf=tiers[String(n.Tier)]?.LevelInfoByTier||[];for(let k=0;k<lv;k++){spent+=num(inf[k]?.Cost);duration+=num(inf[k]?.Duration)}}
      e.innerHTML=`<div class="hero"><span class="chip">2.9.0</span><h1>기술 트리</h1><p class="muted">1vcian 최신 트리 구조와 2.9.0 노드 수치/선행조건을 사용합니다.</p></div>
      <div class="panel"><div class="tabs" id="ttree">${Object.entries(TREE_KO).map(([k,v])=>`<button data-tree="${k}" class="${tree===k?'active':''}">${v}</button>`).join('')}</div>
      <div class="tabs" id="ttier">${[0,1,2,3,4].map(x=>`<button data-tier="${x}" class="${tier===x?'active':''}">${x+1}티어</button>`).join('')}</div>
      <div class="grid g3"><div class="metric"><small>현재 트리 사용 포션</small><b>${fmt(spent)}</b></div><div class="metric"><small>현재 트리 연구시간</small><b>${sec(duration)}</b></div><div class="metric"><small>선행 조건</small><b>Lv.1 이상</b></div></div></div>
      <div class="cards">${nodes.map(n=>{let lv=tLevel(tree,n.Id),mx=tMax(n.Type,n.Tier,vals),v=tEffect(n.Type,n.Tier,lv,vals),req=(n.Requirements||[]).every(id=>tLevel(tree,id)>=1),info=tiers[String(n.Tier)]?.LevelInfoByTier?.[lv];return `<div class="card techCard" data-node="${n.Id}">
      <div class="media"><div class="sprite" style="${spriteStyle(`${GTEX}/TechTreeIcons.png`,(n.Id%10),8,128,60)}"></div><div><b>${esc(TECH_KO[n.Type]||n.Type)}</b><div class="muted small">${TREE_KO[tree]} · ${n.Tier+1}티어 · Lv.${lv}/${mx}</div><div>${effectText(n.Type,v)}</div></div></div>
      <div class="muted small" style="margin-top:7px">${lv<mx?(req?`다음: 포션 ${fmt(info?.Cost||0)} · ${sec(info?.Duration||0)}`:'선행 기술 Lv.1 필요'):'MAX'}</div>
      <div class="controls"><button data-d="-1">-1</button><button data-d="1">+1</button><button data-d="5">+5</button><button data-d="max">MAX</button></div></div>`}).join('')}</div>`;
      $('#ttree').onclick=ev=>{let b=ev.target.closest('[data-tree]');if(b){tree=b.dataset.tree;tier=0;render()}};
      $('#ttier').onclick=ev=>{let b=ev.target.closest('[data-tier]');if(b){tier=+b.dataset.tier;render()}};
      e.onclick=ev=>{let b=ev.target.closest('.techCard button[data-d]');if(!b)return;let card=b.closest('[data-node]'),id=+card.dataset.node,node=(pos[tree]?.Nodes||[]).find(x=>x.Id===id);if(!node)return;let cur=tLevel(tree,id),mx=tMax(node.Type,node.Tier,vals),d=b.dataset.d,val=d==='max'?mx:Math.max(0,Math.min(mx,cur+num(d)));if(val>cur&&!(node.Requirements||[]).every(r=>tLevel(tree,r)>=1)){toast('선행 기술을 Lv.1 이상 찍어야 합니다');return}S.techTree[tree]??={};S.techTree[tree][id]=val;if(val===0)for(const ch of descendants(pos[tree].Nodes,id))S.techTree[tree][ch]=0;save();render()}
    }
    render()
  }
  async function forgeV2(){
    let e=$('#app'),[up,pos,vals,war]=await Promise.all([j(`${CFG}/ForgeUpgradeLibrary.json`),...await techData().then(x=>[x[0],x[1]]),j(`${CFG}/GuildWarDayConfigLibrary.json`)]).catch(()=>[]);
    if(!up){e.innerHTML='<div class="panel">대장간 데이터를 불러오지 못했습니다.</div>';return}
    S.forgeLevel=Math.max(1,Math.min(35,num(S.forgeLevel,1)));S.calc.forge=Object.assign({from:S.forgeLevel,to:35,gems:0},S.calc.forge||{});
    function reward(task){for(const d of Object.values(war||{}))for(const t of d.Tasks||[])if(t.Task===task)return num(t.Rewards?.find(r=>r.$type==='WarPointsReward')?.Amount);return 0}
    function render(){
      let from=Math.max(1,Math.min(35,num(S.calc.forge.from,S.forgeLevel))),to=Math.max(from,Math.min(35,num(S.calc.forge.to,35))),cost=0,dur=0;
      for(let lv=from;lv<to;lv++){let x=up[String(lv)];cost+=num(x?.Cost);dur+=num(x?.Duration)}
      let costRed=Math.min(.95,sumType('ForgeUpgradeCost',pos,vals)),speed=Math.max(0,sumType('ForgeTimerSpeed',pos,vals)),appliedCost=Math.round(cost*(1-costRed)),appliedDur=dur/(1+speed);
      let coinReward=reward('SpendCoinsOnForge')||27,gemReward=reward('SpendGemOnForge')||50,cat=Math.min(10,num(S.clanTech.WarPointsFromForgeSpend))*.04,gems=Math.max(0,num(S.calc.forge.gems));
      let coinActions=Math.floor(appliedCost/1000),baseWP=coinActions*coinReward+gems*gemReward,d2=baseWP*(1+cat+Math.min(10,num(S.clanTech.WarPointsOnDay2))*.04),d4=baseWP*(1+cat+Math.min(10,num(S.clanTech.WarPointsOnDay4))*.04);
      e.innerHTML=`<div class="hero"><span class="chip">대장간</span><h1>대장간 계산기</h1><p class="muted">실제 2.9.0 강화 비용·시간과 기술 효과를 계산합니다.</p></div>
      <div class="panel grid g3"><label class="field"><span>현재 레벨</span><input id="ffrom" type="number" min="1" max="35" value="${from}"></label><label class="field"><span>목표 레벨</span><input id="fto" type="number" min="1" max="35" value="${to}"></label><label class="field"><span>사용 보석</span><input id="fgem" type="number" min="0" value="${gems}"></label></div>
      <div class="panel grid g4"><div class="metric"><small>기본 코인 비용</small><b>${fmt(cost)}</b></div><div class="metric"><small>기술 적용 비용</small><b>${fmt(appliedCost)}</b><div class="muted small">-${fmt(costRed*100)}%</div></div><div class="metric"><small>기본 시간</small><b>${sec(dur)}</b></div><div class="metric"><small>기술 적용 시간</small><b>${sec(appliedDur)}</b><div class="muted small">속도 +${fmt(speed*100)}%</div></div></div>
      <div class="panel"><h2>클랜전 대장간 재화 점수</h2><div class="grid g3"><div class="metric"><small>기본 행동점수</small><b>${fmt(baseWP)}</b></div><div class="metric"><small>2일차 기술 적용</small><b>${fmt(Math.round(d2))}</b></div><div class="metric"><small>4일차 기술 적용</small><b>${fmt(Math.round(d4))}</b></div></div><p class="muted small">코인은 실제 강화비용 1,000당 ${coinReward}점, 보석은 1개당 ${gemReward}점으로 계산합니다.</p></div>`;
      e.oninput=()=>{S.calc.forge.from=num($('#ffrom').value);S.calc.forge.to=num($('#fto').value);S.calc.forge.gems=num($('#fgem').value);S.forgeLevel=S.calc.forge.from;save();render()}
    }
    render()
  }
  async function offlineV2(){
    let e=$('#app'),[idle,pos,vals]=await Promise.all([j(`${CFG}/IdleConfig.json`),...await techData().then(x=>[x[0],x[1]])]);
    function render(){
      let st=S.calc.offline=Object.assign({hours:4,minutes:0},S.calc.offline||{}),hours=Math.max(0,num(st.hours))+Math.max(0,Math.min(59,num(st.minutes)))/60,coin=1+sumType('CoinOfflineReward',pos,vals),hammer=1+sumType('HammerOfflineReward',pos,vals),maxMult=1+sumType('MaxOfflineReward',pos,vals),baseMax=num(idle.MaxIdleSeconds)/3600,maxH=baseMax*maxMult,eff=Math.min(hours,maxH),cps=num(idle.CoinsPerSecond)*coin,hpm=num(idle.HammersPerMinute)*hammer,totalC=Math.floor(cps*eff*3600),totalH=Math.floor(hpm*eff*60);
      e.innerHTML=`<div class="hero"><span class="chip">방치</span><h1>오프라인 계산</h1><p class="muted">IdleConfig와 현재 기술 트리를 직접 반영합니다.</p></div>
      <div class="panel grid g2"><label class="field"><span>오프라인 시간</span><input id="oh" type="number" min="0" value="${num(st.hours)}"></label><label class="field"><span>분</span><input id="om" type="number" min="0" max="59" value="${num(st.minutes)}"></label></div>
      <div class="panel grid g4"><div class="metric"><small>최대 보상 시간</small><b>${sec(maxH*3600)}</b></div><div class="metric"><small>코인/초</small><b>${fmt(cps)}</b></div><div class="metric"><small>망치/분</small><b>${fmt(hpm)}</b></div><div class="metric"><small>실제 적용 시간</small><b>${sec(eff*3600)}</b></div></div>
      <div class="panel grid g2"><div class="metric"><small>예상 코인</small><b class="sum">${fmt(totalC)}</b></div><div class="metric"><small>예상 망치</small><b class="sum">${fmt(totalH)}</b></div></div>${hours>maxH?'<div class="notice">입력 시간이 최대 오프라인 보상 시간을 넘어서 최대치까지만 계산했습니다.</div>':''}`;
      e.oninput=()=>{S.calc.offline.hours=num($('#oh').value);S.calc.offline.minutes=num($('#om').value);save();render()}
    }
    render()
  }
  async function dungeonsV2(){
    let e=$('#app'),[base,rewards,pos,vals]=await Promise.all([j(`${CFG}/DungeonBaseConfig.json`),j(`${CFG}/DungeonRewardLibrary.json`),...await techData().then(x=>[x[0],x[1]])]),types={Hammer:['망치 도둑','HammerThiefDungeonBattleLibrary.json'],Skill:['유령 마을','SkillDungeonBattleLibrary.json'],Egg:['침공','EggDungeonBattleLibrary.json'],Potion:['좀비 러시','PotionDungeonBattleLibrary.json']};
    S.calc.dungeon=Object.assign({type:'Hammer',level:1},S.calc.dungeon||{});
    async function render(){
      let type=S.calc.dungeon.type||'Hammer',level=Math.max(1,Math.min(num(base.MaxDungeonLevel,399)+1,num(S.calc.dungeon.level,1))),battle=await j(`${CFG}/${types[type][1]}`),b=battle[String(level-1)]||{},rw=rewards[type==='Egg'?'Pet':type],mult={Hammers:1+sumType('HammerThiefHammerReward',pos,vals),Coins:1+sumType('HammerThiefCoinReward',pos,vals),SkillSummonTickets:1+sumType('GhostTownSkillBonus',pos,vals),TechPotions:1+sumType('ZombieRushTechPotions',pos,vals),Eggshells:1};
      let out=(rw?.CurrencyType||[]).map((cur,i)=>[cur,(num(rw.RewardBase?.[i])+num(rw.RewardIncrease?.[i])*(level-1))*(mult[cur]||1)]);
      e.innerHTML=`<div class="hero"><span class="chip">던전</span><h1>던전 계산</h1><p class="muted">1-1 ~ 40-10 보상·적 피해/체력을 2.9.0 데이터로 계산합니다.</p></div>
      <div class="panel"><div class="tabs" id="dtabs">${Object.entries(types).map(([k,v])=>`<button data-type="${k}" class="${type===k?'active':''}">${v[0]}</button>`).join('')}</div><div class="grid g2"><label class="field"><span>단계 (1~${num(base.MaxDungeonLevel)+1})</span><input id="dlv" type="number" min="1" max="${num(base.MaxDungeonLevel)+1}" value="${level}"></label><div class="metric"><small>게임 표기</small><b>${stage(level)}</b></div></div></div>
      <div class="panel grid g4"><div class="metric"><small>적 피해</small><b>${fmt(b.Damage||0)}</b></div><div class="metric"><small>적 체력</small><b>${fmt(b.Health||0)}</b></div><div class="metric"><small>웨이브</small><b>${[b.Wave1,b.Wave2,b.Wave3].filter(x=>num(x)>=0).join(' / ')||'-'}</b></div><div class="metric"><small>일일 기본 열쇠</small><b>${fmt(base.DailyDungeonKeys)}</b></div></div>
      <div class="panel"><h2>클리어 보상</h2><div class="grid g3">${out.map(([k,v])=>`<div class="metric"><small>${CURRENCY_KO[k]||k}</small><b class="sum">${fmt(v)}</b></div>`).join('')}</div></div>`;
      $('#dtabs').onclick=ev=>{let b=ev.target.closest('[data-type]');if(b){S.calc.dungeon.type=b.dataset.type;save();render()}};
      $('#dlv').oninput=ev=>{S.calc.dungeon.level=num(ev.target.value);save();render()}
    }
    render()
  }
  async function arenaV2(){
    let e=$('#app'),[leagues,rewards]=await Promise.all([j(`${CFG}/ArenaLeagueLibrary.json`),j(`${CFG}/ArenaRewardLibrary.json`)]),league=Math.max(0,Math.min(7,num(S.calc.arena?.league,0)));
    function render(){
      let l=leagues[String(league)]||{},rr=rewards[String(league)]?.Rank||[];
      e.innerHTML=`<div class="hero"><span class="chip">아레나</span><h1>아레나 리그</h1><p class="muted">2.9.0 리그 승급/강등 조건과 순위별 보상입니다.</p></div>
      <div class="tabs panel" id="atabs">${LEAGUE_KO.map((x,i)=>`<button data-l="${i}" class="${i===league?'active':''}">${x}</button>`).join('')}</div>
      <div class="panel grid g3"><div class="metric"><small>현재 리그</small><b>${LEAGUE_KO[league]}</b></div><div class="metric"><small>승급</small><b>${num(l.PromotionEnd)>=0?'Top '+num(l.PromotionEnd):'없음'}</b></div><div class="metric"><small>강등</small><b>${num(l.DemotionStart)>=0?num(l.DemotionStart)+'위 이하':'없음'}</b></div></div>
      <div class="panel"><h2>순위별 보상</h2><div class="cards">${rr.map(r=>`<div class="card"><b>${r.FromRank===r.ToRank?(r.FromRank+1)+'위':(r.FromRank+1)+'~'+(r.ToRank+1)+'위'}</b><div class="muted small" style="margin-top:6px">${(r.Rewards||[]).map(x=>`${CURRENCY_KO[x.Type]||x.Type} ${fmt(x.Amount)}`).join(' · ')}</div></div>`).join('')}</div></div>`;
      $('#atabs').onclick=ev=>{let b=ev.target.closest('[data-l]');if(b){league=+b.dataset.l;S.calc.arena={league};save();render()}}
    }
    render()
  }
  async function skinsV2(){
    let e=$('#app'),[skins,sets,map,up]=await Promise.all([j(`${CFG}/SkinsLibrary.json`),j(`${CFG}/SetsLibrary.json`),j(`${RAW}/parsed_configs/ManualSpriteMapping.json`),j(`${CFG}/SkinUpgradeLibrary.json`)]),by={};
    for(const s of Object.values(skins||{}))if(s.BaseSetId)(by[s.BaseSetId]??=[]).push(s);
    function skinSprite(s){let idx=map?.skins?.mapping?.[s.SkinId.Type+'_'+s.SkinId.Idx];if(idx==null)return'';let cols=map.skins.grid.columns||8,rows=map.skins.grid.rows||8,col=idx%cols,row=Math.floor(idx/cols);return `background-image:url('${GTEX}/${map.skins.texture}');background-size:${cols*100}% ${rows*100}%;background-position:${cols>1?col*100/(cols-1):0}% ${rows>1?row*100/(rows-1):0}%;background-repeat:no-repeat;background-color:#0a0f16;`}
    e.innerHTML=`<div class="hero"><span class="chip">스킨</span><h1>스킨 & 세트</h1><p class="muted">인게임 스킨 스프라이트와 실제 세트 효과/강화 데이터를 사용합니다.</p></div>
    <div class="panel grid g3">${Object.entries(up||{}).map(([k,v])=>`<div class="metric"><small>${SLOT[k]||k} 강화</small><b>레벨당 +${fmt(v.GoodSkinStatIncreasePerLevel*100)}%</b><div class="muted small">EXP ${v.GoodSkinsLevelExperience.join(' / ')}</div></div>`).join('')}</div>
    ${Object.entries(by).map(([setId,arr])=>{let si=sets[setId],bonus=(si?.BonusTiers||[]).map(t=>`${t.RequiredPieces}세트: ${(t.BonusStats?.Stats||[]).map(x=>`${x.StatNode.UniqueStat.StatType==='Damage'?'피해':'체력'} +${fmt(x.Value*100)}%`).join(', ')}`).join(' · '),icon=map?.skinSets?.[setId];return `<div class="panel"><div class="media">${icon?`<img class="art" src="${GTEX}/${icon}">`:''}<div><h2>${SET_KO[setId]||setId}</h2><div class="muted small">${bonus}</div></div></div><div class="cards" style="margin-top:10px">${arr.map(s=>`<div class="card media"><div class="skinSprite" style="${skinSprite(s)}"></div><div><b>${SLOT[s.SkinId.Type]||s.SkinId.Type}</b><div class="muted small">Idx ${s.SkinId.Idx} · 옵션 ${s.MaxStatCount}개</div><div class="small">${(s.PossibleStats||[]).map(x=>`${x.StatNode.UniqueStat.StatType==='Damage'?'피해':'체력'} ${fmt(x.MinValue*100)}~${fmt(x.MaxValue*100)}%`).join(' · ')}</div></div></div>`).join('')}</div></div>`}).join('')}`
  }
  async function progressV2(){
    let e=$('#app');S.progress=Object.assign({now:0,goal:100000,daily:10000},S.progress||{});
    function render(){let x=S.progress,need=Math.max(0,num(x.goal)-num(x.now)),days=num(x.daily)>0?need/num(x.daily):Infinity;e.innerHTML=`<div class="hero"><span class="chip">성장</span><h1>성장 예측</h1><p class="muted">현재 보유량과 일일 획득량으로 목표 도달 시점을 계산합니다.</p></div><div class="panel grid g3"><label class="field"><span>현재</span><input id="pn" type="number" value="${num(x.now)}"></label><label class="field"><span>목표</span><input id="pg" type="number" value="${num(x.goal)}"></label><label class="field"><span>일일 획득</span><input id="pd" type="number" value="${num(x.daily)}"></label></div><div class="panel grid g3"><div class="metric"><small>남은 수량</small><b>${fmt(need)}</b></div><div class="metric"><small>예상 일수</small><b>${Number.isFinite(days)?days.toFixed(1)+'일':'-'}</b></div><div class="metric"><small>예상 주</small><b>${Number.isFinite(days)?(days/7).toFixed(1)+'주':'-'}</b></div></div>`;e.oninput=()=>{x.now=num($('#pn').value);x.goal=num($('#pg').value);x.daily=num($('#pd').value);save();render()}}render()
  }
  async function pvpV2(){
    let e=$('#app');S.pvp=Object.assign({myD:100,myH:800,myA:1.5,enD:100,enH:800,enA:1.5},S.pvp||{});
    function render(){let x=S.pvp,dps1=num(x.myD)/Math.max(.01,num(x.myA,1.5)),dps2=num(x.enD)/Math.max(.01,num(x.enA,1.5)),t1=num(x.enH)/Math.max(.0001,dps1),t2=num(x.myH)/Math.max(.0001,dps2),win=t1<t2;e.innerHTML=`<div class="hero"><span class="chip">PVP</span><h1>PVP 비교</h1><p class="muted">피해·체력·공격주기로 기본 전투 결과를 비교합니다. 요정/장비 종합 스탯 연결은 다음 확장 대상입니다.</p></div><div class="grid g2"><div class="panel"><h2>나</h2>${[['myD','피해'],['myH','체력'],['myA','공격주기(초)']].map(([k,nm])=>`<label class="field"><span>${nm}</span><input data-k="${k}" type="number" step=".01" value="${num(x[k])}"></label>`).join('')}</div><div class="panel"><h2>상대</h2>${[['enD','피해'],['enH','체력'],['enA','공격주기(초)']].map(([k,nm])=>`<label class="field"><span>${nm}</span><input data-k="${k}" type="number" step=".01" value="${num(x[k])}"></label>`).join('')}</div></div><div class="panel"><h2 class="${win?'sum':''}">${win?'예상 승리':'예상 패배'}</h2><div class="grid g4"><div class="metric"><small>내 DPS</small><b>${fmt(dps1)}</b></div><div class="metric"><small>상대 DPS</small><b>${fmt(dps2)}</b></div><div class="metric"><small>상대 처치</small><b>${t1.toFixed(2)}초</b></div><div class="metric"><small>내 생존</small><b>${t2.toFixed(2)}초</b></div></div></div>`;e.oninput=ev=>{let k=ev.target.dataset.k;if(k){x[k]=num(ev.target.value);save();render()}}}render()
  }
  pages.techtree=techTreeV2;
  pages.forge=forgeV2;
  pages.offline=offlineV2;
  pages.dungeons=dungeonsV2;
  pages.arena=arenaV2;
  pages.skins=skinsV2;
  pages.progress=progressV2;
  pages.pvp=pvpV2;
})();