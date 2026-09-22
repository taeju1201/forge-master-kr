(function v5Factory(){
  S.clanPlan=Object.assign({tier:'E',brawlAttacks:5,brawlAvg:50,hammerLevel:0,missionLevel:1},S.clanPlan||{});
  const CUR={Hammers:'망치',Coins:'코인',SkillSummonTickets:'스킬 티켓',Eggshells:'에그셸',TechPotions:'기술 포션',ClockWinders:'탈것 열쇠',GuildPotions:'클랜 포션',Gems:'보석'};
  function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
  function cEff(def,lv){lv=Math.max(0,Math.floor(num(lv)));if(!def||!lv)return 0;const cap=Math.max(0,num(def.MaxLevel));return Math.min(lv,cap)*num(def.ValuePerLevel)+Math.max(0,lv-cap)*num(def.ValuePerInfiniteLevel)}
  function rewardList(arr,mult=1){return (arr||[]).map(x=>`<div class="metric"><small>${CUR[x.Type]||x.Type}</small><b>${fmt(Math.round(num(x.Amount)*mult))}</b></div>`).join('')}
  async function clanV5(){
    const e=$('#app'),[base,tiers,wcfg,clib]=await Promise.all([j(`${CFG}/GuildBaseConfig.json`),j(`${CFG}/GuildTierConfig.json`),j(`${CFG}/GuildWarConfig.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)]);
    const order=Object.keys(tiers),tier=order.includes(S.clanPlan.tier)?S.clanPlan.tier:order[0];
    function render(){
      const t=tiers[tier],winB=cEff(clib.ClanWarWinRewards,S.clanTech.ClanWarWinRewards),loseB=cEff(clib.ClanWarLoseRewards,S.clanTech.ClanWarLoseRewards);
      const maxTickets=num(wcfg.MaxPersonalWarTickets,5),att=Math.max(0,Math.min(maxTickets,Math.floor(num(S.clanPlan.brawlAttacks,maxTickets)))),avg=Math.max(0,Math.min(num(wcfg.MaxPointsForAttackingOpponentGuildMember,50),num(S.clanPlan.brawlAvg,50))),personal=att*avg;
      e.innerHTML=`<div class="hero"><span class="chip">클랜 2.9.0</span><h1>클랜</h1><p class="muted">기본 규칙, 티어, 전쟁 보상, 6일차 전면전 계획을 한 화면에서 봅니다.</p></div>
      <div class="panel grid g4"><div class="metric"><small>최대 인원</small><b>${base.MaxGuildMemberCount}</b></div><div class="metric"><small>클랜 생성 비용</small><b>${fmt(base.GuildCreateCost)} 보석</b></div><div class="metric"><small>탈퇴 쿨다운</small><b>${fmt(base.GuildLeaveCooldownDurationMinutes/60)}시간</b></div><div class="metric"><small>공지 제한</small><b>${base.AnnouncementMaxLength}자 / ${base.AnnouncementMaxLines}줄</b></div></div>
      <div class="panel"><h2>기술 포인트 기부</h2><div class="grid g2">${(base.TechTreeDonationCurrencies||[]).map(x=>`<div class="card"><b>${CUR[x.Currency]||x.Currency}</b><div class="muted small">기술 1포인트당 ${x.CostPerPoint} · 기부 단위 ${x.PossiblePointDonations.join(' / ')}</div></div>`).join('')}</div></div>
      <div class="panel"><h2>클랜 티어 보상</h2><div class="tabs" id="ctier">${order.map(k=>`<button data-tier="${k}" class="${k===tier?'active':''}">${k}</button>`).join('')}</div><div class="grid g4"><div class="metric"><small>티어</small><b>${tier}</b></div><div class="metric"><small>필요 포인트</small><b>${t.RequiredPoints}</b></div><div class="metric"><small>승리 시 티어포인트</small><b>${t.TierPointsOnWin>=0?'+':''}${t.TierPointsOnWin}</b></div><div class="metric"><small>패배 시 티어포인트</small><b>${t.TierPointsOnLose>=0?'+':''}${t.TierPointsOnLose}</b></div></div>
      <h3>승리 보상 <span class="muted small">클랜기술 +${fmt(winB*100)}%</span></h3><div class="grid g3">${rewardList(t.WarWonRewards,1+winB)}</div><h3>패배 보상 <span class="muted small">클랜기술 +${fmt(loseB*100)}%</span></h3><div class="grid g3">${rewardList(t.WarLostRewards,1+loseB)}</div></div>
      <div class="panel"><h2>6일차 전면전 계획</h2><div class="grid g3"><label class="field"><span>사용 공격권 (최대 ${maxTickets})</span><input id="batt" type="number" min="0" max="${maxTickets}" value="${att}"></label><label class="field"><span>공격 1회 예상 점수 (최대 ${wcfg.MaxPointsForAttackingOpponentGuildMember})</span><input id="bavg" type="number" min="0" max="${wcfg.MaxPointsForAttackingOpponentGuildMember}" value="${avg}"></label><div class="metric"><small>예상 공격 점수 합</small><b class="sum">${fmt(personal)}</b></div></div><div class="notice" style="margin-top:10px">설정값: 개인 전쟁 티켓 최대 ${maxTickets}개 · 상대 클랜원 공격 최대점수 ${wcfg.MaxPointsForAttackingOpponentGuildMember} · BrawlWinPointsReward ${wcfg.BrawlWinPointsReward}. 마지막 값은 용도를 임의로 합산하지 않고 원본 값 그대로 표시합니다.</div></div>`;
      $('#ctier').onclick=ev=>{const b=ev.target.closest('[data-tier]');if(b){S.clanPlan.tier=b.dataset.tier;save();clanV5()}};
      $('#batt').oninput=ev=>{S.clanPlan.brawlAttacks=num(ev.target.value);save();render()};$('#bavg').oninput=ev=>{S.clanPlan.brawlAvg=num(ev.target.value);save();render()}
    }
    render()
  }
  async function warPassV5(){
    const e=$('#app'),data=await j(`${CFG}/GuildWarProgressPassLibrary.json`),rows=Object.values(data||{}).sort((a,b)=>num(a.ProgressKey?.Amount)-num(b.ProgressKey?.Amount));
    e.innerHTML=`<div class="hero"><span class="chip">클랜전</span><h1>개인 전쟁 진행 보상</h1><p class="muted">누적 WarPoints 기준 보상 마일스톤입니다.</p></div><div class="cards">${rows.map(x=>`<div class="card"><b>${fmt(x.ProgressKey?.Amount)}점</b><div class="small" style="margin-top:7px">${(x.Rewards?.[0]?.Rewards||[]).map(r=>`${CUR[r.Type]||r.Type} ${fmt(r.Amount)}`).join(' · ')||'-'}</div></div>`).join('')}</div>`
  }
  async function missionV5(){
    const e=$('#app'),[base,levels,rewards,battles,allRewards,rally,clib]=await Promise.all([
      j(`${CFG}/MissionBaseConfig.json`),j(`${CFG}/MissionLevelLibrary.json`),j(`${CFG}/MissionRewardLibrary.json`),j(`${CFG}/MissionBattleLibrary.json`),
      j(`${CFG}/MissionAllMemberRewardLibrary.json`),j(`${CFG}/MissionRallyTimeLibrary.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)
    ]);
    function render(){
      const hammer=Math.max(0,Math.min(399,Math.floor(num(S.clanPlan.hammerLevel)))),eligible=Object.values(levels).filter(x=>num(x.MinHammerThiefLevel)<=hammer).sort((a,b)=>a.Index-b.Index),band=eligible[eligible.length-1]||Object.values(levels)[0],min=num(band.MinLevel,1),max=num(band.MaxLevel,5),lv=Math.max(min,Math.min(max,Math.floor(num(S.clanPlan.missionLevel,min)))),rw=rewards[String(lv)]?.Rewards||[],bonus=cEff(clib.MissionRewards,S.clanTech.MissionRewards),available=Object.values(battles).filter(x=>num(x.MinLevel)<=lv);
      e.innerHTML=`<div class="hero"><span class="chip">클랜 임무</span><h1>클랜 임무 계산</h1><p class="muted">망치도둑 진행도에 따른 임무 레벨 범위와 보상을 실제 2.9.0 설정으로 계산합니다.</p></div>
      <div class="panel grid g4"><label class="field"><span>망치 도둑 던전 레벨 (0~399)</span><input id="mhammer" type="number" min="0" max="399" value="${hammer}"></label><label class="field"><span>임무 레벨 (${min}~${max})</span><input id="mlv" type="number" min="${min}" max="${max}" value="${lv}"></label><div class="metric"><small>일일 에너지</small><b>${base.DailyEnergy}</b></div><div class="metric"><small>무료 새로고침</small><b>${base.DailyFreeRefreshCount}회</b></div></div>
      <div class="panel grid g4"><div class="metric"><small>지원 인원 최대</small><b>${base.MaxSupportMembers}</b></div><div class="metric"><small>유료 새로고침</small><b>${base.RefreshGemCost} 보석</b></div><div class="metric"><small>매칭 제한</small><b>${base.MissionBattleMatchTimerSeconds}초</b></div><div class="metric"><small>랠리 시간</small><b>${Object.values(rally).map(x=>x.TimeInSeconds>=60?x.TimeInSeconds/60+'분':x.TimeInSeconds+'초').join(' / ')}</b></div></div>
      <div class="panel"><h2>임무 Lv.${lv} 보상 <span class="muted small">클랜 기술 +${fmt(bonus*100)}%</span></h2><div class="grid g3">${rewardList(rw,1+bonus)}</div><div class="muted small" style="margin-top:8px">모든 멤버 추가 보상: ${CUR[allRewards[String(lv)]?.Reward?.Type]||allRewards[String(lv)]?.Reward?.Type||'-'} ${fmt(allRewards[String(lv)]?.Reward?.Amount||0)}</div></div>
      <div class="panel"><h2>이 레벨에서 등장 가능한 임무 템플릿</h2><div class="cards">${available.map(x=>`<div class="card"><b>${x.MissionTitleId}</b><div class="muted small">최소 Lv.${x.MinLevel} · 적 ${x.UnitCount}명</div><div class="grid g2" style="margin-top:6px"><div class="metric"><small>기본 피해</small><b>${fmt(x.BaseDamage)}</b></div><div class="metric"><small>기본 체력</small><b>${fmt(x.BaseHealth)}</b></div></div></div>`).join('')}</div><p class="muted small">BaseDamage/BaseHealth는 템플릿 원본값입니다. 레벨별 적 스케일링은 임의 계산하지 않고 원본 구조가 확정되는 대로 별도 적용합니다.</p></div>`;
      $('#mhammer').oninput=ev=>{S.clanPlan.hammerLevel=num(ev.target.value);save();render()};$('#mlv').oninput=ev=>{S.clanPlan.missionLevel=num(ev.target.value);save();render()}
    }
    render()
  }
  addNav('계산','clan','👥','클랜');
  addNav('계산','clanmission','🛡️','클랜 임무');
  addNav('정보','warpass','🏅','전쟁 진행 보상');
  pages.clan=clanV5;pages.clanmission=missionV5;pages.warpass=warPassV5;
  initNav();go((location.hash||'#/home').slice(2)||'home');
})();