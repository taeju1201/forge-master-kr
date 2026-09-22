(function(){
S.techPlan=Object.assign({hours:72,gems:0,day:2,maxSteps:120,last:null},S.techPlan||{});
const NAMES={ForgeTimerSpeed:'제련 속도',ForgeUpgradeCost:'대장간 강화 비용',EquipmentSellPrice:'판매 가격',HammerThiefHammerReward:'망치 보상',HammerThiefCoinReward:'코인 보상',AutoForge:'자동 제련',FreeForgeChance:'무료 제련',MaxOfflineReward:'방치 시간',CoinOfflineReward:'방치 코인',HammerOfflineReward:'방치 망치',TechNodeUpgradeCost:'기술 연구 비용 감소',TechResearchTimer:'기술 연구 속도',SkillDamage:'스킬 피해',SkillPassiveDamage:'스킬 패시브 피해',SkillPassiveHealth:'스킬 패시브 체력',PetBonusDamage:'펫 피해',PetBonusHealth:'펫 체력',MountDamage:'탈것 피해',MountHealth:'탈것 체력'};
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
function cloneTree(){return{Forge:{...(S.techTree.Forge||{})},Power:{...(S.techTree.Power||{})},SkillsPetTech:{...(S.techTree.SkillsPetTech||{})}}}
function maxLevel(node,vals){return vals?.[node.Type]?.Tiers?.[node.Tier]?.StatValuePerLevel?.length||0}
function effect(type,node,levels,vals){const lv=Math.max(0,Math.floor(num(levels?.[node.Id]))),a=vals?.[type]?.Tiers?.[node.Tier]?.StatValuePerLevel||[];return lv&&a.length?num(a[Math.min(lv,a.length)-1]):0}
function bonuses(tree,pos,vals){
  let cost=0,speed=0;
  for(const [tn,td] of Object.entries(pos||{}))for(const n of td.Nodes||[]){if(n.Type==='TechNodeUpgradeCost')cost+=effect(n.Type,n,tree[tn],vals);if(n.Type==='TechResearchTimer')speed+=effect(n.Type,n,tree[tn],vals)}
  return{cost:Math.min(.95,cost),speed}
}
function warTierPoints(dayCfg,day,clib){
  const out=[920,9000,26000,47800,90700],row=dayCfg[String(day-1)]||{},map={FinishITechTreeUpgrade:0,FinishIITechTreeUpgrade:1,FinishIIITechTreeUpgrade:2,FinishIVTechTreeUpgrade:3,FinishVTechTreeUpgrade:4};
  for(const t of row.Tasks||[]){const ti=map[t.Task],v=t.Rewards?.find(r=>r.$type==='WarPointsReward')?.Amount;if(ti!=null&&v!=null)out[ti]=num(v)}
  const eff=(k)=>{const d=clib[k],lv=Math.max(0,Math.floor(num(S.clanTech[k])));if(!d||!lv)return 0;const cap=num(d.MaxLevel);return Math.min(lv,cap)*num(d.ValuePerLevel)+Math.max(0,lv-cap)*num(d.ValuePerInfiniteLevel)};
  const mult=1+eff('WarPointsFromTechUpgrade')+eff('WarPointsOnDay'+day);
  return out.map(x=>x*mult)
}
async function planner(){
  const e=$('#app'),[pos,vals,tiers,war,clib,forge]=await Promise.all([j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`),j(`${CFG}/PlayerTechTreeTierLibrary.json`),j(`${CFG}/GuildWarDayConfigLibrary.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`),j(`${CFG}/ForgeConfig.json`)]);
  const st=S.techPlan;
  function run(){
    const tree=cloneTree(),points=warTierPoints(war,st.day,clib),horizon=Math.max(0,num(st.hours,72))*3600,gemBudget=Math.max(0,num(st.gems)),gemRate=num(forge.TechTreeGemSkipCostPerSecond,.0023),potions=Math.max(0,num(S.resources.TechPotions)),startPot=potions;
    let elapsed=0,gems=0,total=0,steps=[];
    for(let iter=0;iter<Math.max(1,Math.min(500,num(st.maxSteps,120)));iter++){
      const b=bonuses(tree,pos,vals),cands=[];
      for(const [tn,td] of Object.entries(pos||{}))for(const n of td.Nodes||[]){
        const cur=Math.max(0,Math.floor(num(tree[tn]?.[n.Id]))),mx=maxLevel(n,vals);if(cur>=mx)continue;
        if(!(n.Requirements||[]).every(id=>num(tree[tn]?.[id])>=1))continue;
        const info=tiers[String(n.Tier)]?.LevelInfoByTier?.[cur];if(!info)continue;
        const cost=Math.ceil(num(info.Cost)*(1-b.cost)),duration=Math.ceil(num(info.Duration)/(1+b.speed)),score=points[n.Tier]||0,end=elapsed+duration,overflow=Math.max(0,end-horizon),gemCost=overflow>0?Math.ceil(Math.min(duration,overflow)*gemRate):0;
        if(cost<=potions&&gems+gemCost<=gemBudget)cands.push({tree:tn,node:n,cur,cost,duration,score,gemCost,eff:score/Math.max(1,duration)})
      }
      if(!cands.length)break;cands.sort((a,b)=>b.eff-a.eff||b.score-a.score||a.cost-b.cost);const x=cands[0];
      tree[x.tree][x.node.Id]=x.cur+1;potions-=x.cost;elapsed+=x.duration;gems+=x.gemCost;total+=x.score;steps.push({tree:x.tree,id:x.node.Id,type:x.node.Type,tier:x.node.Tier,from:x.cur,to:x.cur+1,cost:x.cost,duration:x.duration,score:x.score,gem:x.gemCost})
    }
    const endBonus=bonuses(tree,pos,vals);return{steps,total,potionsUsed:startPot-potions,potionsLeft:potions,gems,time:elapsed,tree,endBonus}
  }
  function render(){
    const r=st.last;
    e.innerHTML=`<div class="hero"><span class="chip">기술 플래너</span><h1>기술 연구 최적 순서</h1><p class="muted">현재 기술트리에서 시작해 선행조건을 지키고, 포션/시간/보석 한도 안에서 클랜전 기술연구 점수 효율이 높은 순서로 연구합니다.</p></div>
    <div class="panel grid g4"><label class="field"><span>보유 기술 포션</span><input id="tpPot" type="number" min="0" value="${num(S.resources.TechPotions)}"></label><label class="field"><span>계획 시간</span><input id="tpHours" type="number" min="0" value="${num(st.hours,72)}"></label><label class="field"><span>시간초과 스킵 보석</span><input id="tpGems" type="number" min="0" value="${num(st.gems)}"></label><label class="field"><span>기술 점수 일차</span><select id="tpDay"><option value="2" ${st.day==2?'selected':''}>2일차</option><option value="5" ${st.day==5?'selected':''}>5일차</option></select></label></div>
    <div class="panel"><button class="btn gold" id="tpRun" style="width:100%">연구 계획 계산</button></div>
    ${r?`<div class="panel grid g4"><div class="metric"><small>예상 클랜전 점수</small><b class="sum">${fmt(Math.round(r.total))}</b></div><div class="metric"><small>사용 포션</small><b>${fmt(r.potionsUsed)}</b></div><div class="metric"><small>사용 보석</small><b>${fmt(r.gems)}</b></div><div class="metric"><small>연구 시간</small><b>${(r.time/3600).toFixed(1)}시간</b></div><div class="metric"><small>연구 수</small><b>${r.steps.length}</b></div><div class="metric"><small>남은 포션</small><b>${fmt(r.potionsLeft)}</b></div><div class="metric"><small>최종 비용감소</small><b>${fmt(r.endBonus.cost*100)}%</b></div><div class="metric"><small>최종 연구속도</small><b>+${fmt(r.endBonus.speed*100)}%</b></div></div><div class="panel"><h2>추천 순서</h2><div class="cards">${r.steps.slice(0,120).map((x,i)=>`<div class="card"><b>#${i+1} ${NAMES[x.type]||x.type}</b><div class="muted small">${x.tree} · ${x.tier+1}티어 · Lv.${x.from}→${x.to}</div><div class="grid g3" style="margin-top:7px"><div class="metric"><small>포션</small><b>${fmt(x.cost)}</b></div><div class="metric"><small>시간</small><b>${(x.duration/3600).toFixed(2)}h</b></div><div class="metric"><small>점수</small><b>${fmt(Math.round(x.score))}</b></div></div></div>`).join('')}</div><button class="btn gold" id="tpApply" style="width:100%;margin-top:10px">이 연구 결과를 내 기술트리에 적용</button></div>`:''}`;
    e.oninput=ev=>{if(ev.target.id==='tpPot')S.resources.TechPotions=Math.max(0,num(ev.target.value));if(ev.target.id==='tpHours')st.hours=Math.max(0,num(ev.target.value));if(ev.target.id==='tpGems')st.gems=Math.max(0,num(ev.target.value));save()};
    e.onchange=ev=>{if(ev.target.id==='tpDay'){st.day=+ev.target.value;save()}};
    $('#tpRun').onclick=()=>{st.last=run();save();render()};
    const a=$('#tpApply');if(a)a.onclick=()=>{for(const tn of ['Forge','Power','SkillsPetTech'])S.techTree[tn]={...st.last.tree[tn]};S.resources.TechPotions=st.last.potionsLeft;save();toast('연구 계획 결과를 기술트리에 적용했어');go('techtree')}
  }
  render()
}
pages.techplanner=planner;
addNav('계산','techplanner','🧠','기술 연구 플래너');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();