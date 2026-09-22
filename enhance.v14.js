(function(){
function cEff(def,lv){lv=Math.max(0,Math.floor(num(lv)));if(!def||!lv)return 0;const cap=num(def.MaxLevel);return Math.min(lv,cap)*num(def.ValuePerLevel)+Math.max(0,lv-cap)*num(def.ValuePerInfiniteLevel)}
function warKey(t){if(/^Forge.*Equipment$/.test(t))return'WarPointsFromForging';if(/^Summon.*Skill$/.test(t))return'WarPointsFromSkillSummon';if(/^Upgrade.*Skill$/.test(t))return'WarPointsFromSkillUpgrade';if(/^Finish.*TechTreeUpgrade$/.test(t))return'WarPointsFromTechUpgrade';if(/^Spend.*OnForge$/.test(t))return'WarPointsFromForgeSpend';if(/^Use.*DungeonKey$/.test(t))return'WarPointsFromDungeonKey';if(/^Hatch.*Egg$/.test(t))return'WarPointsFromEggHatch';if(/^Merge.*Pet$/.test(t))return'WarPointsFromPetMerge';if(/^Summon.*Mount$/.test(t))return'WarPointsFromMountSummon';if(/^Merge.*Mount$/.test(t))return'WarPointsFromMountMerge';return''}
pages.home=async function(){
  globalThis.__fmAggregateSecondary?.();
  const e=$('#app'),[stats,days,clib]=await Promise.all([globalThis.__fmProfileCompute?globalThis.__fmProfileCompute():Promise.resolve(null),j(`${CFG}/GuildWarDayConfigLibrary.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)]);
  function dayTotal(day){let total=0;for(const t of days[String(day-1)]?.Tasks||[]){const key=warKey(t.Task),base=num(t.Rewards?.find(r=>r.$type==='WarPointsReward')?.Amount),raw=Math.max(0,num(S.war?.counts?.[day+':'+t.Task])),units=t.Task==='SpendCoinsOnForge'?Math.floor(raw/1000):raw,bonus=cEff(clib[key],S.clanTech[key])+cEff(clib['WarPointsOnDay'+day],S.clanTech['WarPointsOnDay'+day]);total+=Math.round(units*base*(1+bonus))}return total}
  const wt=[1,2,3,4,5].map(dayTotal),sum=wt.reduce((a,b)=>a+b,0);
  e.innerHTML=`<div class="hero"><span class="chip">Forge Master 2.9.0 · KR</span><h1>${S.name?esc(S.name)+'의 ':''}대시보드</h1><p class="muted">현재 프로필과 클랜전 계산값을 한 화면에서 확인하고 바로 필요한 계산기로 이동합니다.</p></div>
  <div class="panel grid g4"><div class="metric"><small>총 피해</small><b class="sum">${fmt(stats?.damage||0)}</b></div><div class="metric"><small>총 체력</small><b class="sum">${fmt(stats?.health||0)}</b></div><div class="metric"><small>전투력</small><b>${fmt(stats?.power||0)}</b></div><div class="metric"><small>총 지속 DPS</small><b>${fmt(stats?.totalDps||0)}</b></div><div class="metric"><small>요정</small><b>${S.fairy?.name||'없음'} ${S.fairy?.name?'Lv.'+num(S.fairy.level,1):''}</b></div><div class="metric"><small>기술 포션</small><b>${fmt(S.resources?.TechPotions||0)}</b></div><div class="metric"><small>저장 빌드</small><b>${(S.savedProfiles||[]).length}개</b></div><div class="metric"><small>클랜 기술 노드</small><b>${Object.values(S.clanTech||{}).filter(x=>num(x)>0).length}개 활성</b></div></div>
  <div class="panel"><h2>클랜전 1~5일차 입력 기준 예상점수</h2><div class="grid g3">${wt.map((v,i)=>`<div class="metric"><small>${i+1}일차</small><b>${fmt(v)}</b></div>`).join('')}<div class="metric"><small>전체 합계</small><b class="sum">${fmt(sum)}</b></div></div></div>
  <div class="panel"><h2>바로가기</h2><div class="grid g4">${[
    ['profile','👤','내 프로필'],['guildwar','🏰','클랜전 점수'],['clantech','🛡️','클랜 기술'],['summon','🎲','소환 계산'],
    ['techplanner','🧠','기술 연구 플래너'],['subopt','🧮','보조옵션 최적화'],['loadoutopt','🐾','펫·탈것 최적화'],['profilemanager','💾','백업·빌드 비교'],
    ['basedrops','🎯','기본 드랍'],['dungeons','🗝️','던전'],['arena','🏆','아레나'],['fairies','🧚','요정']
  ].map(([id,ic,n])=>`<button class="btn" data-home-go="${id}" style="min-height:62px">${ic}<br>${n}</button>`).join('')}</div></div>
  <div class="notice">게임 데이터/이미지는 1vcian의 최신 2.9.0 매핑과 Forge Master 설정을 기준으로 읽습니다. 폰트는 설치된 “빛의 계승자”를 우선 사용합니다.</div>`;
  e.onclick=ev=>{const b=ev.target.closest('[data-home-go]');if(b)go(b.dataset.homeGo)}
};
go((location.hash||'#/home').slice(2)||'home');
})();