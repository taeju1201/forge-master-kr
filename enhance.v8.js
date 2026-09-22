(function(){
S.upgradeCalc=Object.assign({mode:'Skill',rarity:'Common',current:1,target:100},S.upgradeCalc||{});
const RR=['Common','Rare','Epic','Legendary','Ultimate','Mythic'];
const RKO={Common:'일반',Rare:'희귀',Epic:'에픽',Legendary:'전설',Ultimate:'궁극',Mythic:'신화'};
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
pages.upgradecalc=async function(){
  const e=$('#app'),[skill,pet,mount]=await Promise.all([j(`${CFG}/SkillUpgradeLibrary.json`),j(`${CFG}/PetUpgradeLibrary.json`),j(`${CFG}/MountUpgradeLibrary.json`)]);
  let st=S.upgradeCalc;
  function render(){
    const mode=st.mode||'Skill',rarity=st.rarity||'Common',src=mode==='Pet'?pet?.[rarity]?.LevelInfo:mode==='Mount'?mount?.[rarity]?.LevelInfo:null,max=mode==='Skill'?Math.max(...Object.keys(skill).map(Number))+1:(src?.length||1),cur=Math.max(1,Math.min(max,Math.floor(num(st.current,1)))),tar=Math.max(cur,Math.min(max,Math.floor(num(st.target,max))));
    let need=0,next=0;
    if(mode==='Skill'){for(let lv=cur;lv<tar;lv++)need+=num(skill[String(lv)]?.Shards);next=num(skill[String(cur)]?.Shards)}
    else{for(let lv=cur;lv<tar;lv++)need+=num(src?.[lv-1]?.Experience);next=num(src?.[cur-1]?.Experience)}
    e.innerHTML=`<div class="hero"><span class="chip">성장 재화</span><h1>목표 레벨 계산</h1><p class="muted">2.9.0 실제 강화 테이블로 현재 레벨에서 목표 레벨까지 필요한 조각/경험치를 합산합니다.</p></div>
    <div class="tabs panel" id="umode">${[['Skill','스킬'],['Pet','펫'],['Mount','탈것']].map(([k,n])=>`<button data-mode="${k}" class="${mode===k?'active':''}">${n}</button>`).join('')}</div>
    <div class="panel grid g4">${mode==='Skill'?'':`<label class="field"><span>등급</span><select id="urarity">${RR.map(r=>`<option value="${r}" ${r===rarity?'selected':''}>${RKO[r]}</option>`).join('')}</select></label>`}<label class="field"><span>현재 레벨</span><input id="ucur" type="number" min="1" max="${max}" value="${cur}"></label><label class="field"><span>목표 레벨</span><input id="utar" type="number" min="${cur}" max="${max}" value="${tar}"></label><div class="metric"><small>최대 레벨</small><b>${max}</b></div></div>
    <div class="panel grid g3"><div class="metric"><small>다음 레벨 필요</small><b>${fmt(next)}</b></div><div class="metric"><small>${cur} → ${tar} 총 필요</small><b class="sum">${fmt(need)}</b></div><div class="metric"><small>단위</small><b>${mode==='Skill'?'스킬 조각':'경험치'}</b></div></div>`;
    $('#umode').onclick=ev=>{const b=ev.target.closest('[data-mode]');if(b){st.mode=b.dataset.mode;st.current=1;st.target=100;save();render()}};
    e.onchange=e.oninput=ev=>{if(ev.target.id==='urarity')st.rarity=ev.target.value;if(ev.target.id==='ucur')st.current=num(ev.target.value);if(ev.target.id==='utar')st.target=num(ev.target.value);save();if(ev.type==='change'||ev.target.id==='urarity')render()}
  }
  render()
};
addNav('계산','upgradecalc','📈','목표 레벨');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();