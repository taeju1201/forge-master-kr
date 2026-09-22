(function(){
S.loadoutCandidates=Object.assign({pets:[],mounts:[],objective:'dps',top:5},S.loadoutCandidates||{});
const RR=['Common','Rare','Epic','Legendary','Ultimate','Mythic'];
const RKO={Common:'일반',Rare:'희귀',Epic:'에픽',Legendary:'전설',Ultimate:'궁극',Mythic:'신화'};
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
function score(s,obj){if(obj==='power')return num(s.power);if(obj==='damage')return num(s.damage);if(obj==='health')return num(s.health);if(obj==='hybrid')return Math.sqrt(Math.max(0,num(s.totalDps))*Math.max(0,num(s.health)));return num(s.totalDps)}
function combos(arr,k){
  const out=[];function rec(start,p){if(p.length===k){out.push(p.slice());return}for(let i=start;i<arr.length;i++){p.push(i);rec(i+1,p);p.pop()}}rec(0,[]);return out
}
pages.loadoutopt=async function(){
  const e=$('#app'),map=await j(`${RAW}/parsed_configs/ManualSpriteMapping.json`),st=S.loadoutCandidates;
  const petList=Object.entries(map?.pets?.mapping||{}).map(([idx,x])=>({...x,idx:+idx})).sort((a,b)=>RR.indexOf(a.rarity)-RR.indexOf(b.rarity)||a.id-b.id);
  const mountList=Object.entries(map?.mounts?.mapping||{}).map(([idx,x])=>({...x,idx:+idx})).sort((a,b)=>RR.indexOf(a.rarity)-RR.indexOf(b.rarity)||a.id-b.id);
  function label(c){const src=c.kind==='pet'?petList:mountList,f=src.find(x=>x.rarity===c.rarity&&x.id===c.id);return (f?.name||('#'+c.id))+' · '+RKO[c.rarity]+' · Lv.'+c.level}
  function render(){
    e.innerHTML=`<div class="hero"><span class="chip">조합 최적화</span><h1>펫 / 탈것 조합 최적화</h1><p class="muted">후보를 저장하고 3펫 + 1탈것 조합을 현재 장비·기술·스킨·요정 계산식 위에서 비교합니다.</p></div>
    <div class="panel grid g3"><label class="field"><span>최적화 기준</span><select id="loObj"><option value="dps" ${st.objective==='dps'?'selected':''}>총 DPS</option><option value="power" ${st.objective==='power'?'selected':''}>전투력</option><option value="damage" ${st.objective==='damage'?'selected':''}>피해</option><option value="health" ${st.objective==='health'?'selected':''}>체력</option><option value="hybrid" ${st.objective==='hybrid'?'selected':''}>DPS×체력 균형</option></select></label><label class="field"><span>상위 표시 개수</span><input id="loTop" type="number" min="1" max="20" value="${num(st.top,5)}"></label><div class="metric"><small>현재 후보</small><b>펫 ${st.pets.length} / 탈것 ${st.mounts.length}</b></div></div>
    <div class="grid g2"><div class="panel"><h2>펫 후보 추가</h2><select id="petAddSel">${petList.map(x=>`<option value="${x.rarity}:${x.id}">${RKO[x.rarity]} · ${x.name}</option>`).join('')}</select><div class="grid g2" style="margin-top:8px"><label class="field"><span>레벨</span><input id="petAddLv" type="number" min="1" max="300" value="1"></label><button class="btn" id="petAdd">후보 추가</button></div><div class="cards" style="margin-top:10px">${st.pets.map((x,i)=>`<div class="card"><b>${label({...x,kind:'pet'})}</b><button class="btn red" data-rm-pet="${i}" style="margin-top:6px;width:100%">삭제</button></div>`).join('')||'<div class="muted">등록된 펫 후보 없음</div>'}</div></div>
    <div class="panel"><h2>탈것 후보 추가</h2><select id="mountAddSel">${mountList.map(x=>`<option value="${x.rarity}:${x.id}">${RKO[x.rarity]} · ${x.name}</option>`).join('')}</select><div class="grid g2" style="margin-top:8px"><label class="field"><span>레벨</span><input id="mountAddLv" type="number" min="1" max="300" value="1"></label><button class="btn" id="mountAdd">후보 추가</button></div><div class="cards" style="margin-top:10px">${st.mounts.map((x,i)=>`<div class="card"><b>${label({...x,kind:'mount'})}</b><button class="btn red" data-rm-mount="${i}" style="margin-top:6px;width:100%">삭제</button></div>`).join('')||'<div class="muted">등록된 탈것 후보 없음</div>'}</div></div></div>
    <div class="panel"><div class="grid g2"><button class="btn" id="loAddCurrent">현재 장착을 후보에 추가</button><button class="btn gold" id="loRun">조합 최적화 실행</button></div><div id="loProg" class="muted small" style="margin-top:8px"></div></div>
    <div id="loRes">${st.last?resultHtml(st.last):''}</div>`;
    $('#loObj').onchange=ev=>{st.objective=ev.target.value;save()};$('#loTop').oninput=ev=>{st.top=Math.max(1,Math.min(20,num(ev.target.value,5)));save()};
    $('#petAdd').onclick=()=>{const [rarity,id]=$('#petAddSel').value.split(':');st.pets.push({rarity,id:+id,level:Math.max(1,num($('#petAddLv').value,1))});save();render()};
    $('#mountAdd').onclick=()=>{const [rarity,id]=$('#mountAddSel').value.split(':');st.mounts.push({rarity,id:+id,level:Math.max(1,num($('#mountAddLv').value,1))});save();render()};
    e.onclick=ev=>{let b=ev.target.closest('[data-rm-pet]');if(b){st.pets.splice(+b.dataset.rmPet,1);save();render();return}b=ev.target.closest('[data-rm-mount]');if(b){st.mounts.splice(+b.dataset.rmMount,1);save();render();return}};
    $('#loAddCurrent').onclick=()=>{for(const p of S.loadout.pets||[])if(p&&!st.pets.some(x=>x.rarity===p.rarity&&x.id===p.id&&x.level===p.level))st.pets.push({rarity:p.rarity,id:p.id,level:p.level});const m=S.loadout.mount;if(m&&!st.mounts.some(x=>x.rarity===m.rarity&&x.id===m.id&&x.level===m.level))st.mounts.push({rarity:m.rarity,id:m.id,level:m.level});save();render()};
    $('#loRun').onclick=run;
    const apply=e.querySelector('[data-apply-rank]');if(apply)apply.onclick=applyRank
  }
  function resultHtml(rows){
    return `<div class="panel"><h2>상위 조합</h2><div class="cards">${rows.map((r,i)=>`<div class="card"><b>#${i+1}</b><div class="small" style="margin-top:6px">${r.pets.map(x=>label({...x,kind:'pet'})).join('<br>')}</div><div class="small" style="margin-top:5px">${r.mount?label({...r.mount,kind:'mount'}):'탈것 없음'}</div><div class="grid g2" style="margin-top:8px"><div class="metric"><small>DPS</small><b>${fmt(r.stats.totalDps)}</b></div><div class="metric"><small>전투력</small><b>${fmt(r.stats.power)}</b></div><div class="metric"><small>피해</small><b>${fmt(r.stats.damage)}</b></div><div class="metric"><small>체력</small><b>${fmt(r.stats.health)}</b></div></div><button class="btn gold" data-apply-rank="${i}" style="width:100%;margin-top:8px">이 조합 장착</button></div>`).join('')}</div></div>`
  }
  async function evalCombo(pets,mount){
    const oldP=structuredClone(S.loadout.pets),oldM=structuredClone(S.loadout.mount),oldSrc=structuredClone(S.loadout.secondarySources||{});
    try{
      S.loadout.pets=pets.map(x=>({...x}));while(S.loadout.pets.length<3)S.loadout.pets.push(null);S.loadout.mount=mount?{...mount}:null;
      const keep={};for(const [k,v] of Object.entries(oldSrc))if(k.startsWith('item:'))keep[k]=v;S.loadout.secondarySources=keep;globalThis.__fmAggregateSecondary?.();return await globalThis.__fmProfileCompute()
    }finally{S.loadout.pets=oldP;S.loadout.mount=oldM;S.loadout.secondarySources=oldSrc;globalThis.__fmAggregateSecondary?.()}
  }
  async function run(){
    if(st.pets.length<3){toast('펫 후보를 최소 3개 등록해줘');return}
    const pc=combos(st.pets,3),mounts=st.mounts.length?st.mounts:[null],total=pc.length*mounts.length;if(total>6000){toast('조합이 너무 많아. 후보를 줄여줘 (최대 6000조합)');return}
    $('#loRun').disabled=true;const rows=[];let done=0;
    for(const idxs of pc){const pets=idxs.map(i=>st.pets[i]);for(const m of mounts){const stats=await evalCombo(pets,m),sc=score(stats,st.objective);rows.push({pets:structuredClone(pets),mount:m?structuredClone(m):null,stats,score:sc});done++;if(done%20===0){$('#loProg').textContent=`${done}/${total} 조합 계산 중…`;await new Promise(r=>setTimeout(r,0))}}}
    rows.sort((a,b)=>b.score-a.score);st.last=rows.slice(0,Math.max(1,Math.min(20,num(st.top,5))));save();render()
  }
  function applyRank(ev){
    const i=+ev.target.dataset.applyRank,r=st.last?.[i];if(!r)return;S.loadout.pets=r.pets.map(x=>({...x}));S.loadout.mount=r.mount?{...r.mount}:null;save();toast('조합을 장착했어');go('profile')
  }
  render()
};
addNav('계산','loadoutopt','🐾','펫·탈것 최적화');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();