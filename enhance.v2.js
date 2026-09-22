(function v2Factory(){
  const CLAN_NAMES={
    WeaponBonus:'무기 능력치',HelmetBonus:'투구 능력치',BodyBonus:'갑옷 능력치',ShoeBonus:'신발 능력치',GloveBonus:'장갑 능력치',BeltBonus:'벨트 능력치',NecklaceBonus:'목걸이 능력치',RingBonus:'반지 능력치',
    SkillDamage:'스킬 피해',PetBonusDamage:'펫 피해',PetBonusHealth:'펫 체력',MountDamage:'탈것 피해',MountHealth:'탈것 체력',
    CommonEggTimer:'일반 알 부화 시간',RareEggTimer:'희귀 알 부화 시간',EpicEggTimer:'에픽 알 부화 시간',LegendaryEggTimer:'전설 알 부화 시간',UltimateEggTimer:'궁극 알 부화 시간',MythicEggTimer:'신화 알 부화 시간',
    AutoForge:'자동 제련',ForgeAnimationSpeed:'제련 애니메이션 속도',PlayerMoveSpeed:'이동 속도',PlayerAttackRange:'공격 사거리',
    WarPointsFromForging:'장비 제작 점수',WarPointsFromSkillSummon:'스킬 소환 점수',WarPointsFromSkillUpgrade:'스킬 강화 점수',WarPointsFromTechUpgrade:'기술 연구 점수',WarPointsFromForgeSpend:'대장간 재화 점수',WarPointsFromDungeonKey:'던전 열쇠 점수',WarPointsFromEggHatch:'알 부화 점수',WarPointsFromPetMerge:'펫 합성 점수',WarPointsFromMountSummon:'탈것 소환 점수',WarPointsFromMountMerge:'탈것 합성 점수',
    WarPointsOnDay1:'1일차 전체 점수',WarPointsOnDay2:'2일차 전체 점수',WarPointsOnDay3:'3일차 전체 점수',WarPointsOnDay4:'4일차 전체 점수',WarPointsOnDay5:'5일차 전체 점수',WarPointsOnDay6:'6일차 전체 점수',
    ClanWarDamage:'클랜전 피해',ClanWarHealth:'클랜전 체력',PersonalWarRewards:'개인전 보상',ClanWarWinRewards:'클랜전 승리 보상',ClanWarLoseRewards:'클랜전 패배 보상',
    MissionDamage:'클랜 임무 피해',MissionHealth:'클랜 임무 체력',MissionRewards:'클랜 임무 보상',
    HammerThiefDungeonDamage:'망치 도둑 피해',HammerThiefDungeonHealth:'망치 도둑 체력',GhostTownDungeonDamage:'유령 마을 피해',GhostTownDungeonHealth:'유령 마을 체력',InvasionDungeonDamage:'침공 피해',InvasionDungeonHealth:'침공 체력',ZombieRushDungeonDamage:'좀비 러시 피해',ZombieRushDungeonHealth:'좀비 러시 체력',
    GuildPotionsFromMissions:'임무 클랜 포션',GuildPotionsFromPersonalWar:'개인전 클랜 포션',GuildPotionsFromClanWarWin:'클랜전 승리 클랜 포션',GuildPotionsFromClanWarLose:'클랜전 패배 클랜 포션',GuildTechRaceRewardMultiplier:'기술 레이스 보상',GuildTechRaceScoreMultiplier:'기술 레이스 점수'
  };
  const CAT_NAMES={Power:'전투',EggTimers:'알 부화',Special:'특수',ClanWar:'클랜전',ClanMissions:'클랜 임무',Dungeons:'던전',ClanTechPotions:'클랜 포션'};
  function clanEffect(def,level){
    level=Math.max(0,Math.floor(num(level)));
    if(!def||level<=0)return 0;
    const cap=Math.max(0,num(def.MaxLevel));
    const base=Math.min(level,cap)*num(def.ValuePerLevel);
    const extra=Math.max(0,level-cap)*num(def.ValuePerInfiniteLevel);
    return base+extra;
  }
  function clanCost(def,level){
    level=Math.max(0,Math.floor(num(level)));
    if(!def||level<=0)return 0;
    const cap=Math.max(0,num(def.MaxLevel));
    return Math.min(level,cap)*num(def.PointsPerLevel)+Math.max(0,level-cap)*num(def.PointsPerInfiniteLevel);
  }
  function hasInfinite(def){return num(def?.PointsPerInfiniteLevel)>0&&num(def?.ValuePerInfiniteLevel)!==0}
  function rectStyle(entry,size=58){
    if(!entry?.sprite_rect)return '';
    const r=entry.sprite_rect,ts=entry.texture_size||{width:1024,height:1024},cols=Math.max(1,Math.round(ts.width/r.width)),rows=Math.max(1,Math.round(ts.height/r.height)),col=Math.round(r.x/r.width),row=Math.round(r.y/r.height),px=cols>1?col*(100/(cols-1)):0,py=rows>1?row*(100/(rows-1)):0,tex=entry.texture||'ClanTechTreeIcons.png';
    return `width:${size}px;height:${size}px;background-image:url('${TEX}/${tex}');background-position:${px}% ${py}%;background-size:${cols*100}% ${rows*100}%;background-repeat:no-repeat`;
  }
  function playerRectStyle(mapNode,map,size=58){
    if(!mapNode?.sprite_rect)return '';
    return rectStyle({sprite_rect:mapNode.sprite_rect,texture_size:map.texture_size,texture:map.texture||'TechTreeIcons.png'},size);
  }
  async function clanTechV3(){
    const e=$('#app'),[lib,pos,icons]=await Promise.all([j(`${CFG}/GuildTechTreeUpgradeLibrary.json`),j(`${CFG}/GuildTechTreePositionLibrary.json`),j(`${RAW}/parsed_configs/ClanTechTreeIconsMap.json`)]);
    let cat='ClanWar';
    function render(){
      const keys=pos?.[cat]?.Nodes||[];
      e.innerHTML=`<div class="hero"><span class="chip">2.9.0 실제 규칙</span><h1>클랜 기술</h1><p class="muted">기본 최대레벨 뒤 무한레벨이 있는 노드는 계속 올릴 수 있습니다. 클랜전 점수 기술은 Lv.10까지 +4%/Lv, 이후 +1%/Lv입니다.</p></div>
      <div class="tabs panel" id="ctabs">${Object.keys(pos||{}).map(k=>`<button data-cat="${k}" class="${k===cat?'active':''}">${CAT_NAMES[k]||k}</button>`).join('')}</div>
      <div class="cards">${keys.map(k=>{const d=lib[k],lv=Math.max(0,Math.floor(num(S.clanTech[k]))),inf=hasInfinite(d),eff=clanEffect(d,lv),cost=clanCost(d,lv),baseMax=num(d?.MaxLevel),entry=icons?.mapping?.[k];return `<div class="card techCard" data-ct="${esc(k)}">
        <div class="media"><div class="sprite" style="${rectStyle(entry,60)}"></div><div><b>${esc(CLAN_NAMES[k]||k)}</b><div class="muted small">Lv.${lv}${inf?` · 기본구간 ${baseMax} 이후 ∞`:`/${baseMax}`}</div><div>효과 +${fmt(eff*100)}%</div></div></div>
        <div class="muted small" style="margin-top:7px">누적 클랜 기술 포인트 ${fmt(cost)}${inf&&lv>=baseMax?` · 다음 레벨 ${fmt(d.PointsPerInfiniteLevel)}포인트 / +${fmt(d.ValuePerInfiniteLevel*100)}%`:''}</div>
        <div class="controls"><button data-d="-1">-1</button><button data-d="1">+1</button><button data-d="5">+5</button><button data-d="${inf?'10':'max'}">${inf?'+10':'MAX'}</button></div>
      </div>`}).join('')}</div>`;
      $('#ctabs').onclick=ev=>{const b=ev.target.closest('[data-cat]');if(b){cat=b.dataset.cat;render()}};
      e.onclick=ev=>{const b=ev.target.closest('[data-ct] button[data-d]');if(!b)return;const card=b.closest('[data-ct]'),k=card.dataset.ct,d=lib[k],cur=Math.max(0,Math.floor(num(S.clanTech[k]))),delta=b.dataset.d,inf=hasInfinite(d);let next=delta==='max'?num(d.MaxLevel):Math.max(0,cur+num(delta));if(!inf)next=Math.min(num(d.MaxLevel),next);S.clanTech[k]=next;save();render()}
    }
    render()
  }
  function warMeta(task){
    const [label,key]=taskLabel(task);
    if(task==='SpendCoinsOnForge')return{label:'대장간 코인 사용',key,divisor:1000,unit:'코인',scoreUnit:'1,000 코인당'};
    if(task==='SpendGemOnForge')return{label:'대장간 보석 사용',key,divisor:1,unit:'보석',scoreUnit:'1 보석당'};
    return{label,key,divisor:1,unit:'개수/횟수',scoreUnit:'1회당'};
  }
  async function guildWarV3(){
    const e=$('#app'),[days,clib]=await Promise.all([j(`${CFG}/GuildWarDayConfigLibrary.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)]);
    let day=Math.max(1,Math.min(5,num(S.war.day,1)));
    function taskTotal(d,t){
      const m=warMeta(t.Task),base=num(t.Rewards?.find(r=>r.$type==='WarPointsReward')?.Amount),raw=Math.max(0,num(S.war.counts[d+':'+t.Task])),units=Math.floor(raw/m.divisor),cat=clanEffect(clib[m.key],S.clanTech[m.key]),db=clanEffect(clib['WarPointsOnDay'+d],S.clanTech['WarPointsOnDay'+d]),per=base*(1+cat+db);
      return{...m,base,raw,units,cat,db,per,total:Math.round(units*per)};
    }
    function dayTotal(d){return (days[String(d-1)]?.Tasks||[]).reduce((a,t)=>a+taskTotal(d,t).total,0)}
    function render(){
      const tasks=days[String(day-1)]?.Tasks||[],totals=[1,2,3,4,5].map(dayTotal);
      e.innerHTML=`<div class="hero"><span class="chip">클랜전</span><h1>1~5일차 점수 계산</h1><p class="muted">2.9.0 행동 점수 + 행동별 클랜 기술 + 일차별 클랜 기술을 실제 무한레벨 규칙까지 반영합니다.</p></div>
      <div class="panel"><div class="grid g3">${totals.map((v,i)=>`<div class="metric"><small>${i+1}일차</small><b>${fmt(v)}</b></div>`).join('')}<div class="metric"><small>1~5일차 합계</small><b class="sum">${fmt(totals.reduce((a,b)=>a+b,0))}</b></div></div></div>
      <div class="tabs panel" id="wdays">${[1,2,3,4,5].map(d=>`<button data-day="${d}" class="${d===day?'active':''}">${d}일차</button>`).join('')}</div>
      <div class="panel"><div class="scoreList">${tasks.map(t=>{const r=taskTotal(day,t);return `<div class="scoreRow"><div><b>${esc(r.label)}</b><small>${r.scoreUnit} 기본 ${fmt(r.base)}점 · 행동기술 +${fmt(r.cat*100)}% · ${day}일차 +${fmt(r.db*100)}%</small></div><div><small>적용 1회</small><b>${fmt(r.per)}</b></div><label class="field"><span>${r.unit}</span><input data-war-task="${esc(t.Task)}" type="number" min="0" value="${r.raw||''}" placeholder="0"></label><div><small>총점</small><b class="sum">${fmt(r.total)}</b></div><div class="muted small">${esc(r.key||'')}</div></div>`}).join('')}</div></div>
      <div class="panel"><small>${day}일차 최종 총점</small><div class="sum">${fmt(totals[day-1])}</div></div>`;
      $('#wdays').onclick=ev=>{const b=ev.target.closest('[data-day]');if(b){day=+b.dataset.day;S.war.day=day;save();render()}};
      e.oninput=ev=>{const inp=ev.target.closest('[data-war-task]');if(!inp)return;S.war.counts[day+':'+inp.dataset.warTask]=Math.max(0,num(inp.value));save();render()}
    }
    render()
  }
  async function techTreeV3(){
    const e=$('#app'),[pos,vals,tiers,map]=await Promise.all([j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`),j(`${CFG}/PlayerTechTreeTierLibrary.json`),j(`${RAW}/parsed_configs/TechTreeMapping.json`)]);
    const names={Forge:'대장간',Power:'힘',SkillsPetTech:'스킬·펫·기술'};let tree='Forge',tier=0;
    const label=t=>({ForgeTimerSpeed:'제련 속도',ForgeUpgradeCost:'대장간 강화 비용 감소',EquipmentSellPrice:'장비 판매 가격',HammerThiefHammerReward:'망치 보상',HammerThiefCoinReward:'코인 보상',AutoForge:'자동 제련',FreeForgeChance:'무료 제련 확률',MaxOfflineReward:'최대 방치 시간',CoinOfflineReward:'방치 코인',HammerOfflineReward:'방치 망치'}[t]||CLAN_NAMES[t]||t);
    function arr(t,ti){return vals?.[t]?.Tiers?.[ti]?.StatValuePerLevel||[]}
    function lv(id){return Math.max(0,Math.floor(num(S.techTree?.[tree]?.[id])))}
    function desc(nodes,id){let out=[];function rec(x){for(const n of nodes)if((n.Requirements||[]).includes(x)&&!out.includes(n.Id)){out.push(n.Id);rec(n.Id)}}rec(id);return out}
    function render(){
      const nodes=(pos[tree]?.Nodes||[]).filter(n=>n.Tier===tier),mapNodes=map?.trees?.[tree]?.nodes||[];
      e.innerHTML=`<div class="hero"><span class="chip">실제 아이콘 매핑</span><h1>기술 트리</h1><p class="muted">실제 노드 배치/선행조건/티어 비용과 1vcian의 인게임 스프라이트 매핑을 사용합니다.</p></div>
      <div class="panel"><div class="tabs" id="ptree">${Object.entries(names).map(([k,v])=>`<button data-tree="${k}" class="${k===tree?'active':''}">${v}</button>`).join('')}</div><div class="tabs" id="ptier">${[0,1,2,3,4].map(x=>`<button data-tier="${x}" class="${x===tier?'active':''}">${x+1}티어</button>`).join('')}</div></div>
      <div class="cards">${nodes.map(n=>{const l=lv(n.Id),a=arr(n.Type,n.Tier),mx=a.length,val=l?a[Math.min(l,a.length)-1]:0,req=(n.Requirements||[]).every(r=>lv(r)>=1),next=tiers[String(n.Tier)]?.LevelInfoByTier?.[l],mn=mapNodes.find(x=>x.id===n.Id);return `<div class="card techCard" data-node="${n.Id}"><div class="media"><div class="sprite" style="${playerRectStyle(mn,map,60)}"></div><div><b>${esc(label(n.Type))}</b><div class="muted small">${names[tree]} · Lv.${l}/${mx}</div><div>${n.Type==='AutoForge'?`단계 ${fmt(val)}`:/LevelUp$/.test(n.Type)?`+${fmt(val)}레벨`:`+${fmt(val*100)}%`}</div></div></div><div class="muted small" style="margin-top:7px">${l>=mx?'MAX':req?`다음 연구: ${fmt(next?.Cost||0)} 포션 · ${Math.round(num(next?.Duration)/60)}분`:'선행 노드 Lv.1 필요'}</div><div class="controls"><button data-d="-1">-1</button><button data-d="1">+1</button><button data-d="5">+5</button><button data-d="max">MAX</button></div></div>`}).join('')}</div>`;
      $('#ptree').onclick=ev=>{const b=ev.target.closest('[data-tree]');if(b){tree=b.dataset.tree;tier=0;render()}};
      $('#ptier').onclick=ev=>{const b=ev.target.closest('[data-tier]');if(b){tier=+b.dataset.tier;render()}};
      e.onclick=ev=>{const b=ev.target.closest('[data-node] button[data-d]');if(!b)return;const id=+b.closest('[data-node]').dataset.node,n=(pos[tree]?.Nodes||[]).find(x=>x.Id===id),cur=lv(id),mx=arr(n.Type,n.Tier).length,d=b.dataset.d;let v=d==='max'?mx:Math.max(0,Math.min(mx,cur+num(d)));if(v>cur&&!(n.Requirements||[]).every(r=>lv(r)>=1)){toast('선행 노드부터 찍어야 합니다');return}S.techTree[tree]??={};S.techTree[tree][id]=v;if(v===0)for(const x of desc(pos[tree].Nodes,id))S.techTree[tree][x]=0;save();render()}
    }
    render()
  }
  async function forgeV3(){
    const e=$('#app'),[up,pos,vals,war,wcfg,clib]=await Promise.all([j(`${CFG}/ForgeUpgradeLibrary.json`),j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`),j(`${CFG}/GuildWarDayConfigLibrary.json`),j(`${CFG}/GuildWarConfig.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)]);
    function peff(type){let out=0;for(const tr of ['Forge','Power','SkillsPetTech'])for(const n of pos?.[tr]?.Nodes||[])if(n.Type===type){let l=Math.max(0,Math.floor(num(S.techTree?.[tr]?.[n.Id]))),a=vals?.[type]?.Tiers?.[n.Tier]?.StatValuePerLevel||[];if(l&&a.length)out+=num(a[Math.min(l,a.length)-1])}return out}
    function reward(task){for(const d of Object.values(war||{}))for(const t of d.Tasks||[])if(t.Task===task)return num(t.Rewards?.find(r=>r.$type==='WarPointsReward')?.Amount);return 0}
    S.calc.forge=Object.assign({from:Math.max(1,num(S.forgeLevel,1)),to:35,gems:0},S.calc.forge||{});
    function render(){
      let from=Math.max(1,Math.min(35,num(S.calc.forge.from,1))),to=Math.max(from,Math.min(35,num(S.calc.forge.to,35))),cost=0,dur=0;for(let l=from;l<to;l++){cost+=num(up[String(l)]?.Cost);dur+=num(up[String(l)]?.Duration)}
      const red=Math.min(.95,peff('ForgeUpgradeCost')),speed=peff('ForgeTimerSpeed'),realCost=Math.round(cost*(1-red)),realDur=dur/(1+speed),gems=Math.max(0,num(S.calc.forge.gems)),coinUnit=num(wcfg.CoinsSpentOnForgeNeededToGrantOneActionReward,1000),base=Math.floor(realCost/coinUnit)*(reward('SpendCoinsOnForge')||27)+gems*(reward('SpendGemOnForge')||50),cat=clanEffect(clib.WarPointsFromForgeSpend,S.clanTech.WarPointsFromForgeSpend),d2=base*(1+cat+clanEffect(clib.WarPointsOnDay2,S.clanTech.WarPointsOnDay2)),d4=base*(1+cat+clanEffect(clib.WarPointsOnDay4,S.clanTech.WarPointsOnDay4));
      e.innerHTML=`<div class="hero"><span class="chip">대장간</span><h1>대장간 계산기</h1><p class="muted">2.9.0 강화 비용·시간, 플레이어 기술, 클랜전 무한레벨 효과까지 연결합니다.</p></div><div class="panel grid g3"><label class="field"><span>현재 레벨</span><input id="vf" type="number" min="1" max="35" value="${from}"></label><label class="field"><span>목표 레벨</span><input id="vt" type="number" min="1" max="35" value="${to}"></label><label class="field"><span>사용 보석</span><input id="vg" type="number" min="0" value="${gems}"></label></div><div class="panel grid g4"><div class="metric"><small>기본 비용</small><b>${fmt(cost)}</b></div><div class="metric"><small>기술 적용 비용</small><b>${fmt(realCost)}</b></div><div class="metric"><small>기본 시간</small><b>${Math.round(dur/3600*10)/10}시간</b></div><div class="metric"><small>기술 적용 시간</small><b>${Math.round(realDur/3600*10)/10}시간</b></div></div><div class="panel grid g3"><div class="metric"><small>클랜전 기본 점수</small><b>${fmt(base)}</b></div><div class="metric"><small>2일차 최종</small><b class="sum">${fmt(Math.round(d2))}</b></div><div class="metric"><small>4일차 최종</small><b class="sum">${fmt(Math.round(d4))}</b></div></div>`;
      e.oninput=()=>{S.calc.forge.from=num($('#vf').value);S.calc.forge.to=num($('#vt').value);S.calc.forge.gems=num($('#vg').value);S.forgeLevel=S.calc.forge.from;save();render()}
    }
    render()
  }
  pages.clantech=clanTechV3;
  pages.guildwar=guildWarV3;
  pages.techtree=techTreeV3;
  pages.forge=forgeV3;
})();