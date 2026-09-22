(function(){
S.subopt=Object.assign({objective:'dps',perfection:100,last:null},S.subopt||{});
const STAT_KO={CriticalChance:'치명타 확률',CriticalMulti:'치명타 피해',BlockChance:'막기 확률',HealthRegen:'체력 재생',LifeSteal:'흡혈',DoubleDamageChance:'2배 피해 확률',DamageMulti:'피해',MeleeDamageMulti:'근접 피해',RangedDamageMulti:'원거리 피해',AttackSpeed:'공격속도',SkillDamageMulti:'스킬 피해',SkillCooldownMulti:'스킬 쿨다운 감소',HealthMulti:'체력'};
const FAIRIES=[null,'Lora','Mira','Tira'];
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
function slotCountItem(age,asc,itemUnlock){if(!Number.isFinite(age))return 0;if(num(asc)>0)return 2;return num(itemUnlock?.[String(age)]?.NumberOfSecondStats)}
function slotCountRarity(r,petUnlock){return num(petUnlock?.[r]?.NumberOfSecondStats,1)}
function buildBodies(itemUnlock,petUnlock){
  const out=[];
  for(const [slot,it] of Object.entries(S.loadout.equipment||{}))if(it){const n=slotCountItem(num(it.age),S.loadout.forgeAsc,itemUnlock);if(n>0)out.push({key:'item:'+slot,label:slot,slots:n})}
  for(let i=0;i<(S.loadout.pets||[]).length;i++){const p=S.loadout.pets[i];if(p){const n=slotCountRarity(p.rarity,petUnlock);if(n>0)out.push({key:'pet:'+i,label:'펫 '+(i+1),slots:n})}}
  if(S.loadout.mount){const n=slotCountRarity(S.loadout.mount.rarity,petUnlock);if(n>0)out.push({key:'mount:0',label:'탈것',slots:n})}
  return out
}
function distribute(alloc,bodies,values){
  const free=new Map(bodies.map(b=>[b.key,b.slots])),out=Object.fromEntries(bodies.map(b=>[b.key,[]]));
  const stats=Object.entries(alloc).filter(([,c])=>c>0).map(([s,c])=>({s,c})).sort((a,b)=>b.c-a.c);
  for(const {s,c} of stats){
    const targets=bodies.filter(b=>(free.get(b.key)||0)>0&&!out[b.key].some(x=>x.statId===s)).sort((a,b)=>(free.get(b.key)||0)-(free.get(a.key)||0)).slice(0,c);
    for(const b of targets){free.set(b.key,(free.get(b.key)||0)-1);out[b.key].push({statId:s,value:values[s]||0})}
  }
  return out
}
function score(stats,obj){
  if(obj==='power')return num(stats.power);
  if(obj==='damage')return num(stats.damage);
  if(obj==='health')return num(stats.health);
  if(obj==='hybrid')return Math.sqrt(Math.max(0,num(stats.totalDps))*Math.max(0,num(stats.health)));
  return num(stats.totalDps)
}
pages.subopt=async function(){
  const e=$('#app'),[secLib,itemUnlock,petUnlock]=await Promise.all([j(`${CFG}/SecondaryStatLibrary.json`),j(`${CFG}/SecondaryStatItemUnlockLibrary.json`),j(`${CFG}/SecondaryStatPetUnlockLibrary.json`)]);
  const roll=Object.entries(secLib||{}).filter(([,v])=>num(v.UpperRange)>0).map(([k,v])=>({id:k,max:num(v.UpperRange)*100})).filter(x=>STAT_KO[x.id]);
  const bodies=buildBodies(itemUnlock,petUnlock),totalSlots=bodies.reduce((a,b)=>a+b.slots,0),cap=bodies.filter(b=>b.slots>0).length;
  const st=S.subopt;
  const render=()=>{
    e.innerHTML=`<div class="hero"><span class="chip">최적화</span><h1>보조옵션 최적화</h1><p class="muted">현재 장비·펫·탈것·기술·스킨·액티브 스킬을 그대로 두고, 보조옵션 슬롯만 재배치해 목표값을 최대화합니다. 요정 없음/Lora/Mira/Tira도 같이 비교합니다.</p></div>
    <div class="panel grid g4"><div class="metric"><small>옵션 슬롯 총합</small><b>${totalSlots}</b></div><div class="metric"><small>옵션 1종 최대 복사</small><b>${cap}</b></div><label class="field"><span>최적화 기준</span><select id="oobj"><option value="dps" ${st.objective==='dps'?'selected':''}>총 DPS</option><option value="power" ${st.objective==='power'?'selected':''}>전투력</option><option value="damage" ${st.objective==='damage'?'selected':''}>피해</option><option value="health" ${st.objective==='health'?'selected':''}>체력</option><option value="hybrid" ${st.objective==='hybrid'?'selected':''}>DPS×체력 균형</option></select></label><label class="field"><span>옵션 완성도 %</span><input id="operf" type="number" min="1" max="100" value="${num(st.perfection,100)}"></label></div>
    <div class="panel"><h2>현재 장착 슬롯</h2><div class="grid g4">${bodies.map(b=>`<div class="metric"><small>${b.label}</small><b>${b.slots}줄</b></div>`).join('')||'<div class="muted">보조옵션을 장착할 장비/펫/탈것이 없습니다.</div>'}</div></div>
    <div class="panel"><button class="btn gold" id="orun" style="width:100%">최적화 실행</button><div id="oprog" class="muted small" style="margin-top:8px"></div></div>
    <div id="ores">${st.last?resultHtml(st.last):''}</div>`;
    $('#oobj').onchange=ev=>{st.objective=ev.target.value;save()};$('#operf').oninput=ev=>{st.perfection=Math.max(1,Math.min(100,num(ev.target.value,100)));save()};
    $('#orun').onclick=run;
    const apply=$('#oapply');if(apply)apply.onclick=applyLast;
  };
  function resultHtml(r){
    return `<div class="panel"><h2>최적 결과</h2><div class="grid g4"><div class="metric"><small>요정</small><b>${r.fairy||'없음'}</b></div><div class="metric"><small>총 DPS</small><b class="sum">${fmt(r.stats.totalDps)}</b></div><div class="metric"><small>전투력</small><b>${fmt(r.stats.power)}</b></div><div class="metric"><small>피해 / 체력</small><b>${fmt(r.stats.damage)} / ${fmt(r.stats.health)}</b></div></div><div class="cards" style="margin-top:10px">${Object.entries(r.alloc).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="card"><b>${STAT_KO[k]||k}</b><div class="sum">${v}개</div><div class="muted small">개당 ${fmt(r.values[k])}%</div></div>`).join('')}</div><button class="btn gold" id="oapply" style="width:100%;margin-top:10px">이 조합을 프로필에 적용</button></div>`
  }
  async function evalAlloc(alloc,fairy,values){
    const oldSrc=structuredClone(S.loadout.secondarySources||{}),oldFairy=structuredClone(S.fairy);
    try{S.loadout.secondarySources=distribute(alloc,bodies,values);S.fairy={name:fairy,level:20};globalThis.__fmAggregateSecondary?.();return await globalThis.__fmProfileCompute()}finally{S.loadout.secondarySources=oldSrc;S.fairy=oldFairy;globalThis.__fmAggregateSecondary?.()}
  }
  async function greedy(fairy,values){
    let alloc={},remaining=totalSlots,current=await evalAlloc(alloc,fairy,values),currentScore=score(current,st.objective);
    while(remaining>0){
      let best=null;
      for(const s of roll){
        const cur=alloc[s.id]||0,maxAdd=Math.min(remaining,cap-cur);if(maxAdd<=0)continue;
        for(let k=1;k<=maxAdd;k++){
          const test={...alloc,[s.id]:cur+k},stats=await evalAlloc(test,fairy,values),sc=score(stats,st.objective),gain=(sc-currentScore)/k;
          if(!best||gain>best.gain)best={id:s.id,k,stats,score:sc,gain}
        }
      }
      if(!best)break;alloc[best.id]=(alloc[best.id]||0)+best.k;remaining-=best.k;current=best.stats;currentScore=best.score;
    }
    const placed=distribute(alloc,bodies,values);let used=Object.values(placed).reduce((a,x)=>a+x.length,0);
    if(used<totalSlots){
      for(const s of roll){while((alloc[s.id]||0)<cap&&used<totalSlots){const test={...alloc,[s.id]:(alloc[s.id]||0)+1},p=distribute(test,bodies,values),u=Object.values(p).reduce((a,x)=>a+x.length,0);if(u>used){alloc=test;used=u}else break}}
    }
    const finalStats=await evalAlloc(alloc,fairy,values);return{fairy,alloc,stats:finalStats,score:score(finalStats,st.objective)}
  }
  async function run(){
    if(!totalSlots){toast('먼저 프로필에 장비/펫/탈것을 설정해줘');return}
    $('#orun').disabled=true;const perf=Math.max(1,Math.min(100,num(st.perfection,100)))/100,values=Object.fromEntries(roll.map(x=>[x.id,x.max*perf]));let best=null;
    for(let i=0;i<FAIRIES.length;i++){const f=FAIRIES[i];$('#oprog').textContent=`요정 ${f||'없음'} 조합 계산 중… (${i+1}/${FAIRIES.length})`;await new Promise(r=>setTimeout(r,0));const r=await greedy(f,values);if(!best||r.score>best.score)best={...r,values}}
    st.last=best;save();render()
  }
  function applyLast(){
    const r=st.last;if(!r)return;S.loadout.secondarySources=distribute(r.alloc,bodies,r.values);S.fairy={name:r.fairy,level:20};globalThis.__fmAggregateSecondary?.();save();toast('최적 보조옵션 조합을 적용했어');go('profile')
  }
  render()
};
addNav('계산','subopt','🧮','보조옵션 최적화');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();