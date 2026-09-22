(function(){
S.stageCalc=Object.assign({age:0,battle:0,diff:0},S.stageCalc||{});
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
pages.stage=async function(){
  globalThis.__fmAggregateSecondary?.();
  const e=$('#app'),[main,ageScale,enemies,weapons,ibc,mbc,stats]=await Promise.all([
    j(`${CFG}/MainBattleLibrary.json`),j(`${CFG}/EnemyAgeScalingLibrary.json`),j(`${CFG}/EnemyLibrary.json`),j(`${CFG}/WeaponLibrary.json`),j(`${CFG}/ItemBalancingConfig.json`),j(`${CFG}/MainBattleConfig.json`),globalThis.__fmProfileCompute()
  ]);
  const st=S.stageCalc;
  const ages=[...new Set(Object.values(main).map(x=>num(x.BattleId?.AgeIdx)))].sort((a,b)=>a-b);
  function countForAge(a){return Object.values(main).filter(x=>num(x.BattleId?.AgeIdx)===a).length}
  function stageData(age,battle,diff){
    const row=main[`{'AgeIdx': ${age}, 'BattleIdx': ${battle}}`];if(!row)return null;
    const sc=ageScale[String(age)]||{},hp=num(sc.Health)*Math.pow(num(mbc.EnemyHpDifficultyMulti,6000000),diff),baseD=num(sc.Damage)*Math.pow(num(mbc.EnemyDmgDifficultyMulti,6000000),diff),rangedMul=num(ibc.EnemyRangedDamageMultiplier,.67),waves=[];
    let totalEnemies=0,totalHp=0,remain=num(stats.health),passed=true,totalTime=0;
    for(const w of row.Waves||[]){
      let enemyCount=0,waveHp=0,waveDps=0,details=[];
      for(const g of w.Enemies||[]){
        const id=num(g.Id),count=num(g.Count),ec=enemies[String(id)],wid=ec?.WeaponId,weapon=wid?weapons[`{'Age': ${wid.Age}, 'Type': 'Weapon', 'Idx': ${wid.Idx}}`]:null,isRanged=weapon?.IsRanged??(num(weapon?.AttackRange)>1),dmg=baseD*(isRanged?rangedMul:1),cycle=Math.max(.1,num(weapon?.AttackDuration,1.5)),dps=dmg/cycle;
        enemyCount+=count;waveHp+=hp*count;waveDps+=dps*count;details.push({id,count,isRanged,dmg,cycle,dps})
      }
      const time=waveHp/Math.max(.0001,num(stats.totalDps)),incoming=waveDps*time;remain-=incoming;totalTime+=time;if(remain<=0)passed=false;
      totalEnemies+=enemyCount;totalHp+=waveHp;waves.push({enemyCount,hp:waveHp,dps:waveDps,time,incoming,remain:Math.max(0,remain),details})
    }
    return{row,hp,baseD,waves,totalEnemies,totalHp,coins:totalEnemies*num(mbc.CoinsPerEnemy,1),passed,totalTime,remain:Math.max(0,remain)}
  }
  function findMax(diff){
    let last=null;
    for(const a of ages){for(let b=0;b<countForAge(a);b++){const x=stageData(a,b,diff);if(x?.passed)last={age:a,battle:b,data:x};else return last}}
    return last
  }
  function render(){
    const maxAge=Math.max(...ages),age=Math.max(Math.min(maxAge,Math.floor(num(st.age))),Math.min(...ages)),count=countForAge(age),battle=Math.max(0,Math.min(count-1,Math.floor(num(st.battle)))),diff=Math.max(0,Math.min(1,Math.floor(num(st.diff)))),x=stageData(age,battle,diff),mxN=findMax(0),mxH=findMax(1);
    e.innerHTML=`<div class="hero"><span class="chip">메인 전투</span><h1>스테이지 진행 예측</h1><p class="muted">적 HP/피해·하드 배율·원거리 피해 보정은 실제 2.9.0 공식. 클리어 여부는 현재 프로필 DPS/체력을 사용한 빠른 근사치입니다.</p></div>
    <div class="panel grid g4"><label class="field"><span>시대</span><select id="sAge">${ages.map(a=>`<option value="${a}" ${a===age?'selected':''}>${AGE[a]||('Age '+(a+1))}</option>`).join('')}</select></label><label class="field"><span>스테이지</span><input id="sBattle" type="number" min="1" max="${count}" value="${battle+1}"></label><label class="field"><span>난이도</span><select id="sDiff"><option value="0" ${diff===0?'selected':''}>일반</option><option value="1" ${diff===1?'selected':''}>하드</option></select></label><div class="metric"><small>선택</small><b>${age+1}-${battle+1} ${diff?'HARD':''}</b></div></div>
    <div class="panel grid g4"><div class="metric"><small>적 1명 HP</small><b>${fmt(x?.hp||0)}</b></div><div class="metric"><small>근접 적 1타 피해</small><b>${fmt(x?.baseD||0)}</b></div><div class="metric"><small>총 적 수</small><b>${x?.totalEnemies||0}</b></div><div class="metric"><small>총 적 HP</small><b>${fmt(x?.totalHp||0)}</b></div><div class="metric"><small>예상 클리어 시간</small><b>${x?x.totalTime.toFixed(2):0}초</b></div><div class="metric"><small>예상 남은 체력</small><b class="${x?.passed?'sum':''}">${fmt(x?.remain||0)}</b></div><div class="metric"><small>빠른 추정</small><b style="color:${x?.passed?'var(--green)':'var(--red)'}">${x?.passed?'클리어':'실패'}</b></div><div class="metric"><small>기본 코인</small><b>${fmt(x?.coins||0)}</b></div></div>
    <div class="panel"><h2>웨이브</h2><div class="cards">${(x?.waves||[]).map((w,i)=>`<div class="card"><b>Wave ${i+1} · 적 ${w.enemyCount}명</b><div class="grid g2" style="margin-top:7px"><div class="metric"><small>총 HP</small><b>${fmt(w.hp)}</b></div><div class="metric"><small>적 합산 DPS</small><b>${fmt(w.dps)}</b></div><div class="metric"><small>처치 예상</small><b>${w.time.toFixed(2)}초</b></div><div class="metric"><small>받는 피해 추정</small><b>${fmt(w.incoming)}</b></div></div><div class="muted small" style="margin-top:6px">${w.details.map(d=>`#${d.id} ×${d.count} ${d.isRanged?'원거리':'근접'} · ${fmt(d.dmg)}/타`).join('<br>')}</div></div>`).join('')}</div></div>
    <div class="panel grid g2"><div class="metric"><small>일반 빠른 예상 최고</small><b>${mxN?(mxN.age+1)+'-'+(mxN.battle+1):'없음'}</b></div><div class="metric"><small>하드 빠른 예상 최고</small><b>${mxH?(mxH.age+1)+'-'+(mxH.battle+1):'없음'}</b></div></div>
    <div class="notice">빠른 추정은 위치·투사체 이동·피격 타이밍·스킬 사용 타이밍 같은 전투 시뮬레이션 요소를 생략합니다. 적 기본 HP/피해와 웨이브 구성 자체는 게임 설정값 기준입니다.</div>`;
    $('#sAge').onchange=ev=>{st.age=+ev.target.value;st.battle=0;save();render()};$('#sBattle').oninput=ev=>{st.battle=Math.max(0,+ev.target.value-1);save();render()};$('#sDiff').onchange=ev=>{st.diff=+ev.target.value;save();render()}
  }
  render()
};
addNav('계산','stage','⚔️','스테이지 예측');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();