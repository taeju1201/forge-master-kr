(function(){
S.ascCalc=Object.assign({type:'Forge',target:3},S.ascCalc||{});
const TYPES={Forge:['대장간','forgeAsc'],Pets:['펫','petAsc'],Mounts:['탈것','mountAsc'],Skills:['스킬','skillAsc']};
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
pages.ascension=async function(){
 const e=$('#app'),cfg=await j(`${CFG}/AscensionConfigsLibrary.json`),st=S.ascCalc;
 function targetStats(type,target){
   let dmg=1,hp=1,totalCost=0,currency='';
   if(target>0){
     const row=cfg[type]?.AscensionConfigPerLevel?.[target-1],stats=row?.StatContributions||[];
     for(const s of stats){const t=s.StatNode?.UniqueStat?.StatType;if(t==='Damage'||t==='AscensionDamage')dmg=Math.max(dmg,num(s.Value)+1);if(t==='Health'||t==='AscensionHealth')hp=Math.max(hp,num(s.Value)+1)}
     if(type==='Forge'){for(let i=0;i<target;i++){const c=cfg[type]?.AscensionConfigPerLevel?.[i]?.Cost;if(c){totalCost+=num(c.Amount);currency=c.Currency||currency}}}
   }
   return{dmg,hp,totalCost,currency}
 }
 function render(){
   const type=st.type in TYPES?st.type:'Forge',[ko,key]=TYPES[type],cur=Math.max(0,Math.min(3,num(S.loadout[key]))),tar=Math.max(cur,Math.min(3,num(st.target,3))),c=targetStats(type,cur),t=targetStats(type,tar);
   e.innerHTML=`<div class="hero"><span class="chip">승천</span><h1>승천 계산기</h1><p class="muted">2.9.0 AscensionConfigs의 실제 배율을 사용해 현재 승천과 목표 승천의 피해/체력 배율을 비교합니다.</p></div>
   <div class="tabs panel" id="ascTabs">${Object.entries(TYPES).map(([k,v])=>`<button data-type="${k}" class="${type===k?'active':''}">${v[0]}</button>`).join('')}</div>
   <div class="panel grid g3"><label class="field"><span>현재 승천</span><input id="ascCur" type="number" min="0" max="3" value="${cur}"></label><label class="field"><span>목표 승천</span><input id="ascTar" type="number" min="${cur}" max="3" value="${tar}"></label><div class="metric"><small>대상</small><b>${ko}</b></div></div>
   <div class="panel grid g4"><div class="metric"><small>현재 피해 배율</small><b>×${fmt(c.dmg)}</b></div><div class="metric"><small>목표 피해 배율</small><b class="sum">×${fmt(t.dmg)}</b></div><div class="metric"><small>현재 체력 배율</small><b>×${fmt(c.hp)}</b></div><div class="metric"><small>목표 체력 배율</small><b class="sum">×${fmt(t.hp)}</b></div></div>
   <div class="panel"><h2>승천 단계</h2><div class="cards">${[0,1,2,3].map(l=>{const x=targetStats(type,l),row=l?cfg[type]?.AscensionConfigPerLevel?.[l-1]:null;return `<div class="card"><b>${l}승천</b><div class="grid g2" style="margin-top:7px"><div class="metric"><small>피해</small><b>×${fmt(x.dmg)}</b></div><div class="metric"><small>체력</small><b>×${fmt(x.hp)}</b></div></div><div class="muted small" style="margin-top:6px">${row?.Cost?`직접 비용: ${fmt(row.Cost.Amount)} ${row.Cost.Currency}`:(l?'직접 Cost 없음 · 해당 소환/성장 시스템의 승천 조건 사용':'기본')}</div></div>`}).join('')}</div></div>
   ${type==='Forge'? `<div class="panel grid g2"><div class="metric"><small>목표까지 누적 직접 비용</small><b>${fmt(t.totalCost)} ${t.currency||'Coins'}</b></div><div class="metric"><small>현재까지 누적 직접 비용</small><b>${fmt(c.totalCost)} ${c.currency||'Coins'}</b></div></div>`:'<div class="notice">펫/탈것/스킬은 AscensionConfigs에 직접 Cost가 null입니다. 그래서 임의 화폐 비용을 만들지 않고 소환 시스템 승천 진행으로만 표시합니다.</div>'}
   <div class="panel"><button class="btn gold" id="ascApply" style="width:100%">목표 승천을 내 프로필에 적용</button></div>`;
   $('#ascTabs').onclick=ev=>{const b=ev.target.closest('[data-type]');if(b){st.type=b.dataset.type;st.target=3;save();render()}};
   $('#ascCur').oninput=ev=>{S.loadout[key]=Math.max(0,Math.min(3,num(ev.target.value)));save();render()};
   $('#ascTar').oninput=ev=>{st.target=Math.max(cur,Math.min(3,num(ev.target.value)));save();render()};
   $('#ascApply').onclick=()=>{S.loadout[key]=tar;save();toast(ko+' '+tar+'승천 적용');go('profile')}
 }
 render()
};
addNav('계산','ascension','⭐','승천 계산');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();