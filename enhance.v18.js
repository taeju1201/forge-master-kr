(function(){
S.resources=Object.assign({Hammers:0,Gems:0},S.resources||{});
S.warReady=Object.assign({skillUpgrades:0,mountMerges:0,petMerges:0,dungeonKeys:{hammer:0,ghost:0,invasion:0,zombie:0},tech:[0,0,0,0,0]},S.warReady||{});
S.warReady.dungeonKeys=Object.assign({hammer:0,ghost:0,invasion:0,zombie:0},S.warReady.dungeonKeys||{});
S.warReady.tech=Array.isArray(S.warReady.tech)?S.warReady.tech.slice(0,5):[0,0,0,0,0];while(S.warReady.tech.length<5)S.warReady.tech.push(0);
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
function cEff(def,lv){lv=Math.max(0,Math.floor(num(lv)));if(!def||!lv)return 0;const cap=num(def.MaxLevel);return Math.min(lv,cap)*num(def.ValuePerLevel)+Math.max(0,lv-cap)*num(def.ValuePerInfiniteLevel)}
function pTech(type,pos,vals){let out=0;for(const [tn,td] of Object.entries(pos||{}))for(const n of td.Nodes||[])if(n.Type===type){const lv=Math.max(0,Math.floor(num(S.techTree?.[tn]?.[n.Id]))),a=vals?.[type]?.Tiers?.[n.Tier]?.StatValuePerLevel||[];if(lv&&a.length)out+=num(a[Math.min(lv,a.length)-1])}return out}
pages.warready=async function(){
 const e=$('#app'),[clib,drops,skillCfg,mountCfg,pos,vals]=await Promise.all([
  j(`${CFG}/GuildTechTreeUpgradeLibrary.json`),j(`${CFG}/ItemAgeDropChancesLibrary.json`),j(`${CFG}/SkillSummonConfig.json`),j(`${CFG}/MountSummonConfig.json`),j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`)
 ]);
 const st=S.warReady;
 function cat(base,key,day){return base*(1+cEff(clib[key],S.clanTech[key])+cEff(clib['WarPointsOnDay'+day],S.clanTech['WarPointsOnDay'+day]))}
 function bases(){
   const forgeLv=Math.max(1,Math.min(Object.keys(drops).length,num(S.forgeLevel,1))),row=drops[String(forgeLv-1)]||{},free=Math.min(.95,pTech('FreeForgeChance',pos,vals)),forgeCount=num(S.resources.Hammers)/(1-free),forgeBase=AGE.reduce((a,_,i)=>a+forgeCount*num(row['Age'+i])*(i<=2?1:i<=5?2:3),0);
   const skillRed=Math.min(.9,pTech('SkillSummonCost',pos,vals)),skillCost=Math.max(1,Math.ceil(num(skillCfg.SingleSummonCost?.Amount)*5*(1-skillRed))),skillPulls=Math.floor(num(S.resources.SkillSummonTickets)/skillCost),skillUnits=skillPulls*5,skillBase=skillUnits*125;
   const mountRed=Math.min(.9,pTech('MountSummonCost',pos,vals)),mountExtra=Math.max(0,pTech('ExtraMountChance',pos,vals)),mountCost=Math.max(1,Math.ceil(num(mountCfg.SingleSummonCost?.Amount)*(1-mountRed))),mountPulls=Math.floor(num(S.resources.ClockWinders)/mountCost),mountUnits=mountPulls*(1+mountExtra),mountBase=mountUnits*600;
   const forgeSpend=Math.floor(num(S.resources.Coins)/1000)*27+num(S.resources.Gems)*50;
   const dungeon=(num(st.dungeonKeys.hammer)+num(st.dungeonKeys.ghost)+num(st.dungeonKeys.invasion)+num(st.dungeonKeys.zombie))*3000;
   const skillUp=num(st.skillUpgrades)*125,mountMerge=num(st.mountMerges)*600,petMerge=num(st.petMerges)*1250;
   const eggs=S.eggPlan?.counts||{},eggBase=num(eggs.Common)*400+num(eggs.Rare)*1600+num(eggs.Epic)*3200+num(eggs.Legendary)*6400+num(eggs.Ultimate)*12800+num(eggs.Mythic)*25600;
   const techBase=st.tech.reduce((a,c,i)=>a+num(c)*[920,9000,26000,47800,90700][i],0);
   return{forgeLv,forgeCount,forgeBase,skillCost,skillPulls,skillUnits,skillBase,mountCost,mountPulls,mountUnits,mountBase,forgeSpend,dungeon,skillUp,mountMerge,petMerge,eggBase,techBase}
 }
 function render(){
  const b=bases(),days=[
   [['장비 제작',b.forgeBase,'WarPointsFromForging'],['던전 열쇠',b.dungeon,'WarPointsFromDungeonKey'],['스킬 소환',b.skillBase,'WarPointsFromSkillSummon'],['스킬 강화',b.skillUp,'WarPointsFromSkillUpgrade']],
   [['대장간 재화',b.forgeSpend,'WarPointsFromForgeSpend'],['기술 연구',b.techBase,'WarPointsFromTechUpgrade'],['탈것 소환',b.mountBase,'WarPointsFromMountSummon'],['탈것 합성',b.mountMerge,'WarPointsFromMountMerge']],
   [['장비 제작',b.forgeBase,'WarPointsFromForging'],['스킬 소환',b.skillBase,'WarPointsFromSkillSummon'],['스킬 강화',b.skillUp,'WarPointsFromSkillUpgrade'],['알 부화',b.eggBase,'WarPointsFromEggHatch'],['펫 합성',b.petMerge,'WarPointsFromPetMerge']],
   [['대장간 재화',b.forgeSpend,'WarPointsFromForgeSpend'],['던전 열쇠',b.dungeon,'WarPointsFromDungeonKey'],['탈것 소환',b.mountBase,'WarPointsFromMountSummon'],['탈것 합성',b.mountMerge,'WarPointsFromMountMerge']],
   [['장비 제작',b.forgeBase,'WarPointsFromForging'],['기술 연구',b.techBase,'WarPointsFromTechUpgrade'],['알 부화',b.eggBase,'WarPointsFromEggHatch'],['펫 합성',b.petMerge,'WarPointsFromPetMerge']]
  ];
  const scored=days.map((arr,di)=>arr.map(([n,base,key])=>({n,base,key,score:cat(base,key,di+1)}))),totals=scored.map(x=>x.reduce((a,v)=>a+v.score,0));
  e.innerHTML=`<div class="hero"><span class="chip">전쟁 준비</span><h1>보유 재화 → 1~5일차 예상 점수</h1><p class="muted">현재 대장간 레벨·기술트리·클랜기술과 보유 재화를 한 번에 넣어 어디서 점수를 만들 수 있는지 계산합니다.</p></div>
  <div class="panel"><h2>보유 재화</h2><div class="grid g4">${[['Hammers','망치'],['Coins','코인'],['Gems','보석'],['SkillSummonTickets','스킬 티켓'],['ClockWinders','탈것 열쇠'],['TechPotions','기술 포션']].map(([k,n])=>`<label class="field"><span>${n}</span><input data-wr-res="${k}" type="number" min="0" value="${num(S.resources[k])}"></label>`).join('')}</div></div>
  <div class="panel"><h2>이미 준비된 행동</h2><div class="grid g4"><label class="field"><span>스킬 강화 횟수</span><input id="wrSkillUp" type="number" min="0" value="${num(st.skillUpgrades)}"></label><label class="field"><span>탈것 합성 횟수</span><input id="wrMountMerge" type="number" min="0" value="${num(st.mountMerges)}"></label><label class="field"><span>펫 합성 횟수</span><input id="wrPetMerge" type="number" min="0" value="${num(st.petMerges)}"></label><div class="metric"><small>알 부화 점수 입력</small><b>${fmt(b.eggBase)}</b><div class="muted small">알 부화 플래너의 보유 알 연동</div></div></div></div>
  <div class="panel"><h2>던전 열쇠</h2><div class="grid g4">${[['hammer','망치 도둑'],['ghost','유령 마을'],['invasion','침공'],['zombie','좀비 침공']].map(([k,n])=>`<label class="field"><span>${n}</span><input data-wr-key="${k}" type="number" min="0" value="${num(st.dungeonKeys[k])}"></label>`).join('')}</div></div>
  <div class="panel"><h2>완료할 기술 연구 수</h2><div class="grid g4">${['Ⅰ','Ⅱ','Ⅲ','Ⅳ','Ⅴ'].map((n,i)=>`<label class="field"><span>기술 ${n}</span><input data-wr-tech="${i}" type="number" min="0" value="${num(st.tech[i])}"></label>`).join('')}</div></div>
  <div class="panel"><h2>현재 재화 환산</h2><div class="grid g4"><div class="metric"><small>망치 → 기대 장비 제작</small><b>${fmt(b.forgeCount)}</b><div class="muted small">대장간 Lv.${b.forgeLv}</div></div><div class="metric"><small>스킬 소환</small><b>${fmt(b.skillUnits)}개</b><div class="muted small">${fmt(b.skillCost)}티켓/5개</div></div><div class="metric"><small>탈것 소환 기대값</small><b>${fmt(b.mountUnits)}</b><div class="muted small">${fmt(b.mountCost)}열쇠/회</div></div><div class="metric"><small>대장간 재화 기본점수</small><b>${fmt(b.forgeSpend)}</b></div></div></div>
  <div class="panel"><h2>일차별 예상</h2><div class="grid g3">${scored.map((arr,i)=>`<div class="card"><b>${i+1}일차</b><div class="sum">${fmt(Math.round(totals[i]))}</div><div class="small" style="margin-top:7px">${arr.map(x=>`${x.n}: ${fmt(Math.round(x.score))}`).join('<br>')}</div></div>`).join('')}<div class="card"><b>1~5일차 단순 합계</b><div class="sum">${fmt(Math.round(totals.reduce((a,b)=>a+b,0)))}</div><div class="muted small">같은 재화를 여러 날에 동시에 쓸 수 있다는 뜻은 아니며, 각 일차에 해당 재화를 전부 썼을 때의 잠재 점수 합입니다.</div></div></div></div>
  <div class="notice">소환 결과는 등급별 점수가 동일한 스킬/탈것 항목이라 기대 소환 개수만 사용합니다. 장비 제작은 현재 대장간 시대 드랍확률을 적용한 기대값입니다.</div>`;
  e.oninput=ev=>{const t=ev.target;if(t.dataset.wrRes)S.resources[t.dataset.wrRes]=Math.max(0,num(t.value));if(t.dataset.wrKey)st.dungeonKeys[t.dataset.wrKey]=Math.max(0,num(t.value));if(t.dataset.wrTech!==undefined)st.tech[+t.dataset.wrTech]=Math.max(0,num(t.value));if(t.id==='wrSkillUp')st.skillUpgrades=Math.max(0,num(t.value));if(t.id==='wrMountMerge')st.mountMerges=Math.max(0,num(t.value));if(t.id==='wrPetMerge')st.petMerges=Math.max(0,num(t.value));save();render()}
 }
 render()
};
addNav('계산','warready','📦','전쟁 준비');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();