(function(){
S.techRace=Object.assign({rawScore:0,placement:1},S.techRace||{});
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
function eff(def,lv){lv=Math.max(0,Math.floor(num(lv)));if(!def||!lv)return 0;const cap=num(def.MaxLevel);return Math.min(lv,cap)*num(def.ValuePerLevel)+Math.max(0,lv-cap)*num(def.ValuePerInfiniteLevel)}
pages.techrace=async function(){
 const e=$('#app'),[elim,rewards,clib]=await Promise.all([j(`${CFG}/GuildTechRaceEliminationLibrary.json`),j(`${CFG}/GuildTechRaceRewardLibrary.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)]);
 const st=S.techRace;
 function render(){
  const scoreB=eff(clib.GuildTechRaceScoreMultiplier,S.clanTech.GuildTechRaceScoreMultiplier),rewardB=eff(clib.GuildTechRaceRewardMultiplier,S.clanTech.GuildTechRaceRewardMultiplier),raw=Math.max(0,num(st.rawScore)),final=raw*(1+scoreB),placement=Math.max(1,Math.min(7,Math.floor(num(st.placement,1)))),rw=rewards[String(placement)]?.Rewards||[],adj=rw.map(x=>({...x,Amount:Math.round(num(x.Amount)*(1+rewardB))}));
  e.innerHTML=`<div class="hero"><span class="chip">클랜 기술 레이스</span><h1>기술 레이스 계산</h1><p class="muted">2.9.0 탈락 규칙과 순위 보상, 클랜기술의 레이스 점수/보상 배율을 그대로 적용합니다.</p></div>
  <div class="panel grid g4"><label class="field"><span>기본 레이스 점수</span><input id="trScore" type="number" min="0" value="${raw}"></label><label class="field"><span>예상 순위</span><input id="trPlace" type="number" min="1" max="7" value="${placement}"></label><div class="metric"><small>점수 기술</small><b>+${fmt(scoreB*100)}%</b><div class="muted small">Lv.${num(S.clanTech.GuildTechRaceScoreMultiplier)}</div></div><div class="metric"><small>보상 기술</small><b>+${fmt(rewardB*100)}%</b><div class="muted small">Lv.${num(S.clanTech.GuildTechRaceRewardMultiplier)}</div></div></div>
  <div class="panel grid g3"><div class="metric"><small>기본 점수</small><b>${fmt(raw)}</b></div><div class="metric"><small>기술 적용 점수</small><b class="sum">${fmt(final)}</b></div><div class="metric"><small>${placement}위 보상</small><b>${adj.map(x=>fmt(x.Amount)+' '+(x.Type==='GuildPotions'?'클랜포션':x.Type)).join(' · ')||'-'}</b></div></div>
  <div class="panel"><h2>일일 탈락 컷</h2><div class="grid g3">${Object.values(elim).map(x=>`<div class="card"><b>${({Tuesday:'화요일',Wednesday:'수요일',Thursday:'목요일',Friday:'금요일',Saturday:'토요일',Sunday:'일요일'})[x.Day]||x.Day}</b><div class="sum">${x.MaxRemainingParticipantsEOD}개 클랜 생존</div></div>`).join('')}</div></div>
  <div class="panel"><h2>순위 보상</h2><div class="grid g4">${Object.values(rewards).sort((a,b)=>a.Placement-b.Placement).map(x=>{const base=num(x.Rewards?.[0]?.Amount),v=Math.round(base*(1+rewardB));return `<div class="metric"><small>${x.Placement}위 · 기본 ${fmt(base)}</small><b>${fmt(v)} 클랜포션</b></div>`}).join('')}</div></div>
  <div class="notice">레이스의 ‘기본 점수 획득 원천’은 이 설정 파일들에 별도 산식으로 노출되지 않아 임의로 만들지 않았습니다. 게임/수집기에서 확인한 기본 점수를 입력하면 클랜기술 배율만 정확히 적용합니다.</div>`;
  e.oninput=ev=>{if(ev.target.id==='trScore')st.rawScore=Math.max(0,num(ev.target.value));if(ev.target.id==='trPlace')st.placement=Math.max(1,Math.min(7,num(ev.target.value)));save();render()}
 }
 render()
};
addNav('계산','techrace','🏁','클랜 기술 레이스');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();