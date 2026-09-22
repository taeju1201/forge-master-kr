(function v3Factory(){
  S.summonCalc=Object.assign({
    Skills:{level:1,progress:0,asc:0,simulateAsc:true},
    Mounts:{level:1,progress:0,asc:0,simulateAsc:true},
    Eggs:{level:1,progress:0,asc:0,simulateAsc:true},
    mode:'Skills'
  },S.summonCalc||{});
  S.eggPlan=Object.assign({slots:2,hours:24,readyMerges:0,counts:{Common:0,Rare:0,Epic:0,Legendary:0,Ultimate:0,Mythic:0}},S.eggPlan||{});
  S.passDifficulty=num(S.passDifficulty,0);
  const RR=['Common','Rare','Epic','Legendary','Ultimate','Mythic'];
  const RKR={Common:'일반',Rare:'희귀',Epic:'에픽',Legendary:'전설',Ultimate:'궁극',Mythic:'신화'};
  const CUR={Coins:'코인',Hammers:'망치',SkillSummonTickets:'스킬 티켓',Eggshells:'에그셸',TechPotions:'기술 포션',ClockWinders:'탈것 열쇠',Gems:'보석',Token:'전쟁 토큰',GuildPotions:'클랜 포션'};
  function addNav(group,id,icon,name){
    const g=nav.find(x=>x[0]===group);
    if(!g)return;
    if(!g[1].some(x=>x[0]===id))g[1].push([id,icon,name]);
  }
  function techVal(type,pos,vals){
    let out=0;
    for(const tree of ['Forge','Power','SkillsPetTech']){
      for(const n of pos?.[tree]?.Nodes||[]){
        if(n.Type!==type)continue;
        const lv=Math.max(0,Math.floor(num(S.techTree?.[tree]?.[n.Id])));
        const arr=vals?.[type]?.Tiers?.[n.Tier]?.StatValuePerLevel||[];
        if(lv&&arr.length)out+=num(arr[Math.min(lv,arr.length)-1]);
      }
    }
    return out;
  }
  function cEffect(def,level){
    level=Math.max(0,Math.floor(num(level)));
    if(!def||level<=0)return 0;
    const cap=Math.max(0,num(def.MaxLevel));
    return Math.min(level,cap)*num(def.ValuePerLevel)+Math.max(0,level-cap)*num(def.ValuePerInfiniteLevel);
  }
  function taskReward(war,task){
    for(const d of Object.values(war||{}))for(const t of d.Tasks||[])if(t.Task===task)return num(t.Rewards?.find(r=>r.$type==='WarPointsReward')?.Amount);
    return 0;
  }
  function pageTitle(chip,title,desc){return `<div class="hero"><span class="chip">${chip}</span><h1>${title}</h1><p class="muted">${desc}</p></div>`}
  async function summonV4(){
    const e=$('#app');
    const [skillCfg,mountCfg,eggCfg,pos,vals,war,clib]=await Promise.all([
      j(`${CFG}/SkillSummonConfig.json`),j(`${CFG}/MountSummonConfig.json`),j(`${CFG}/EggSummonConfig.json`),
      j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`),
      j(`${CFG}/GuildWarDayConfigLibrary.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)
    ]);
    const meta={
      Skills:{name:'스킬 소환',cfg:skillCfg,res:'SkillSummonTickets',baseUnits:5,costType:'SkillSummonCost',extraType:null,warKey:'WarPointsFromSkillSummon',taskSuffix:'Skill'},
      Mounts:{name:'탈것 소환',cfg:mountCfg,res:'ClockWinders',baseUnits:1,costType:'MountSummonCost',extraType:'ExtraMountChance',warKey:'WarPointsFromMountSummon',taskSuffix:'Mount'},
      Eggs:{name:'알 소환',cfg:eggCfg,res:'Eggshells',baseUnits:1,costType:null,extraType:null,warKey:null,taskSuffix:null}
    };
    let mode=S.summonCalc.mode||'Skills';
    function simulate(m,st,resCount){
      const cfg=m.cfg,levels=cfg.Levels||[],max=levels.length;
      let lv=Math.max(1,Math.min(max,num(st.level,1))),prog=Math.max(0,num(st.progress)),asc=Math.max(0,Math.min(3,num(st.asc,0)));
      const red=m.costType?Math.min(.9,techVal(m.costType,pos,vals)):0;
      const extra=m.extraType?Math.max(0,techVal(m.extraType,pos,vals)):0;
      const units=m.baseUnits*(1+extra);
      const baseCost=num(cfg.SingleSummonCost?.Amount)*m.baseUnits;
      const cost=Math.max(1,Math.ceil(baseCost*(1-red)));
      let paid=Math.floor(Math.max(0,resCount)/cost),remaining=paid;
      const expected={Common:0,Rare:0,Epic:0,Legendary:0,Ultimate:0,Mythic:0};
      while(remaining>0){
        if(lv>=max&&st.simulateAsc&&asc<3){lv=1;prog=0;asc++;continue}
        const row=levels[Math.min(lv-1,max-1)]||{},threshold=Math.max(1,num(row.SummonsRequired,1));
        if(lv>=max&&(!st.simulateAsc||asc>=3)){
          for(const r of RR)expected[r]+=remaining*units*num(row[r]);
          prog+=remaining*units;remaining=0;break
        }
        const need=Math.max(.000001,threshold-prog);
        const chunk=Math.min(remaining,Math.max(1,Math.ceil(need/units)));
        for(const r of RR)expected[r]+=chunk*units*num(row[r]);
        prog+=chunk*units;remaining-=chunk;
        while(prog>=threshold&&lv<max){prog-=threshold;lv++;break}
        if(lv>=max&&st.simulateAsc&&asc<3&&prog>=0){lv=1;prog=0;asc++}
      }
      return{cost,red,extra,units,paid,expected,endLevel:lv,endProgress:prog,endAsc:asc};
    }
    function warTotals(m,expected){
      if(!m.warKey)return[];
      const cat=cEffect(clib[m.warKey],S.clanTech[m.warKey]),out=[];
      for(let d=1;d<=5;d++){
        const tasks=war[String(d-1)]?.Tasks||[];
        let found=false,total=0;
        for(const r of RR){
          const tn=`Summon${r}${m.taskSuffix}`;
          if(tasks.some(t=>t.Task===tn)){found=true;const base=taskReward(war,tn),db=cEffect(clib['WarPointsOnDay'+d],S.clanTech['WarPointsOnDay'+d]);total+=expected[r]*base*(1+cat+db)}
        }
        if(found)out.push([d,total]);
      }
      return out;
    }
    function render(){
      const m=meta[mode],st=S.summonCalc[mode]=Object.assign({level:1,progress:0,asc:0,simulateAsc:true},S.summonCalc[mode]||{}),res=Math.max(0,num(S.resources[m.res])),r=simulate(m,st,res),wt=warTotals(m,r.expected),levels=m.cfg.Levels||[],current=levels[Math.min(num(st.level,1)-1,levels.length-1)]||{};
      e.innerHTML=`${pageTitle('소환 계산',m.name,'보유 재화와 현재 소환 레벨을 기준으로, 소환 중 레벨업·승천·확률 변화를 순서대로 시뮬레이션합니다.')}
      <div class="tabs panel" id="smode">${Object.entries(meta).map(([k,v])=>`<button data-mode="${k}" class="${k===mode?'active':''}">${v.name}</button>`).join('')}</div>
      <div class="panel grid g4">
        <label class="field"><span>현재 소환 레벨</span><input id="slv" type="number" min="1" max="${levels.length}" value="${num(st.level,1)}"></label>
        <label class="field"><span>현재 진행도</span><input id="sprog" type="number" min="0" value="${num(st.progress)}"></label>
        <label class="field"><span>승천</span><input id="sasc" type="number" min="0" max="3" value="${num(st.asc)}"></label>
        <label class="field"><span>${CUR[m.res]||m.res} 보유량</span><input id="sres" type="number" min="0" value="${res}"></label>
      </div>
      <div class="panel"><label class="field"><span>최대 레벨 도달 시 자동 승천</span><select id="sauto"><option value="1" ${st.simulateAsc?'selected':''}>사용</option><option value="0" ${!st.simulateAsc?'selected':''}>사용 안 함</option></select></label></div>
      <div class="panel grid g4"><div class="metric"><small>1회 비용</small><b>${fmt(r.cost)}</b><div class="muted small">기술 할인 ${fmt(r.red*100)}%</div></div><div class="metric"><small>가능 소환 횟수</small><b>${fmt(r.paid)}</b></div><div class="metric"><small>1회 기대 획득</small><b>${fmt(r.units)}</b></div><div class="metric"><small>종료 상태</small><b>승천 ${r.endAsc} · Lv.${r.endLevel}</b><div class="muted small">진행 ${fmt(r.endProgress)}</div></div></div>
      <div class="panel"><h2>현재 레벨 확률</h2><div class="grid g3">${RR.map(x=>`<div class="metric"><small>${RKR[x]}</small><b>${fmt(num(current[x])*100)}%</b></div>`).join('')}</div></div>
      <div class="panel"><h2>보유 재화 전부 사용 시 기대 획득량</h2><div class="grid g3">${RR.map(x=>`<div class="metric"><small>${RKR[x]}</small><b class="sum">${fmt(r.expected[x])}</b></div>`).join('')}</div></div>
      ${wt.length?`<div class="panel"><h2>클랜전 예상 소환 점수</h2><div class="grid g3">${wt.map(([d,v])=>`<div class="metric"><small>${d}일차</small><b>${fmt(Math.round(v))}</b></div>`).join('')}</div></div>`:'<div class="notice">알 소환 자체는 클랜전 점수가 아니고, 실제 점수는 알 부화 시 발생합니다.</div>'}`;
      $('#smode').onclick=ev=>{const b=ev.target.closest('[data-mode]');if(b){mode=b.dataset.mode;S.summonCalc.mode=mode;save();render()}};
      e.oninput=ev=>{if(ev.target.id==='slv')st.level=num(ev.target.value);if(ev.target.id==='sprog')st.progress=num(ev.target.value);if(ev.target.id==='sasc')st.asc=num(ev.target.value);if(ev.target.id==='sres')S.resources[m.res]=Math.max(0,num(ev.target.value));if(ev.target.id==='sauto')st.simulateAsc=ev.target.value==='1';save();render()};
      e.onchange=e.oninput;
    }
    render()
  }
  async function eggsV4(){
    const e=$('#app');
    const [eggLib,petBase,forgeCfg,pos,vals,war,clib]=await Promise.all([
      j(`${CFG}/EggLibrary.json`),j(`${CFG}/PetBaseConfig.json`),j(`${CFG}/ForgeConfig.json`),
      j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`),
      j(`${CFG}/GuildWarDayConfigLibrary.json`),j(`${CFG}/GuildTechTreeUpgradeLibrary.json`)
    ]);
    function effTime(r){return num(eggLib[r]?.HatchTime)/(1+techVal(r+'EggTimer',pos,vals))}
    function scoreForDay(d){
      let total=0,catH=cEffect(clib.WarPointsFromEggHatch,S.clanTech.WarPointsFromEggHatch),catM=cEffect(clib.WarPointsFromPetMerge,S.clanTech.WarPointsFromPetMerge),db=cEffect(clib['WarPointsOnDay'+d],S.clanTech['WarPointsOnDay'+d]);
      const tasks=war[String(d-1)]?.Tasks||[];
      for(const r of RR){const tn=`Hatch${r}Egg`;if(tasks.some(t=>t.Task===tn))total+=num(S.eggPlan.counts[r])*taskReward(war,tn)*(1+catH+db)}
      if(tasks.some(t=>String(t.Task).startsWith('Merge')&&String(t.Task).endsWith('Pet'))){const base=taskReward(war,'MergeCommonPet')||1250;total+=num(S.eggPlan.readyMerges)*base*(1+catM+db)}
      return total
    }
    function schedule(){
      const slots=Math.max(1,Math.min(num(petBase.EggHatchSlotMaxCount,4),Math.floor(num(S.eggPlan.slots,2)))),loads=Array(slots).fill(0);
      const jobs=[];
      for(const r of RR){const c=Math.max(0,Math.floor(num(S.eggPlan.counts[r]))),t=effTime(r);for(let i=0;i<c;i++)jobs.push(t)}
      jobs.sort((a,b)=>b-a);
      for(const t of jobs){let idx=0;for(let i=1;i<loads.length;i++)if(loads[i]<loads[idx])idx=i;loads[idx]+=t}
      const limit=Math.max(0,num(S.eggPlan.hours,24))*3600,overflow=loads.reduce((a,x)=>a+Math.max(0,x-limit),0),gem=Math.ceil(overflow*num(forgeCfg.PetGemSkipCostPerSecond));
      return{slots,loads,makespan:Math.max(0,...loads),overflow,gem}
    }
    function render(){
      const s=schedule(),d3=scoreForDay(3),d5=scoreForDay(5);
      e.innerHTML=`${pageTitle('알 부화','알 부화 플래너','현재 기술트리의 부화 시간 감소, 부화 슬롯, 보유 알, 보석 스킵 비용과 클랜전 점수를 함께 계산합니다.')}
      <div class="panel grid g3"><label class="field"><span>부화 슬롯</span><input id="eslots" type="number" min="1" max="${petBase.EggHatchSlotMaxCount}" value="${s.slots}"></label><label class="field"><span>계획 시간</span><input id="ehours" type="number" min="0" value="${num(S.eggPlan.hours,24)}"></label><label class="field"><span>합성 가능 펫 횟수</span><input id="emerge" type="number" min="0" value="${num(S.eggPlan.readyMerges)}"></label></div>
      <div class="panel"><h2>보유 알</h2><div class="grid g3">${RR.map(r=>`<label class="field"><span>${RKR[r]} · 1개 ${Math.round(effTime(r)/60)}분</span><input data-egg="${r}" type="number" min="0" value="${num(S.eggPlan.counts[r])}"></label>`).join('')}</div></div>
      <div class="panel grid g4"><div class="metric"><small>모두 부화 완료</small><b>${(s.makespan/3600).toFixed(1)}시간</b></div><div class="metric"><small>계획시간 초과 작업</small><b>${(s.overflow/3600).toFixed(1)} 슬롯시간</b></div><div class="metric"><small>초과분 즉시완료 보석</small><b>${fmt(s.gem)}</b></div><div class="metric"><small>슬롯별 종료</small><b>${s.loads.map(x=>(x/3600).toFixed(1)+'h').join(' / ')}</b></div></div>
      <div class="panel grid g2"><div class="metric"><small>3일차 전부 부화/합성 시</small><b class="sum">${fmt(Math.round(d3))}</b></div><div class="metric"><small>5일차 전부 부화/합성 시</small><b class="sum">${fmt(Math.round(d5))}</b></div></div>`;
      e.oninput=ev=>{if(ev.target.id==='eslots')S.eggPlan.slots=num(ev.target.value);if(ev.target.id==='ehours')S.eggPlan.hours=num(ev.target.value);if(ev.target.id==='emerge')S.eggPlan.readyMerges=num(ev.target.value);if(ev.target.dataset.egg)S.eggPlan.counts[ev.target.dataset.egg]=num(ev.target.value);save();render()}
    }
    render()
  }
  function rewardText(r){
    if(!r)return '-';
    if(r.$type==='CurrencyReward')return `${CUR[r.Type]||r.Type} ${fmt(r.Amount)}`;
    if(r.$type==='DungeonKeyReward')return `${r.Type||'던전'} 열쇠 ${fmt(r.Amount||1)}`;
    if(r.$type==='ProgressPassPurchaseReward')return `진행 패스 ${r.PassId}`;
    if(r.$type==='StarterPackageReward')return `장비 ${r.ItemId?.Age??''}/${r.ItemId?.Type??''}/${r.ItemId?.Idx??''}`;
    return `${r.Type||r.$type||'보상'} ${r.Amount!=null?fmt(r.Amount):''}`;
  }
  async function passV4(){
    const e=$('#app'),data=await j(`${CFG}/MainGameProgressPassLibrary.json`);let diff=Math.max(0,Math.min(1,num(S.passDifficulty)));
    function render(){
      const rows=Object.values(data||{}).filter(x=>num(x.ProgressKey?.MainBattleId?.DifficultyIdx)===diff).sort((a,b)=>num(a.ProgressKey.MainBattleId.AgeIdx)-num(b.ProgressKey.MainBattleId.AgeIdx)||num(a.ProgressKey.MainBattleId.BattleIdx)-num(b.ProgressKey.MainBattleId.BattleIdx));
      e.innerHTML=`${pageTitle('진행 패스','진행 패스','메인 스테이지 진행에 따라 받는 무료/프리미엄 보상을 실제 2.9.0 설정으로 표시합니다.')}
      <div class="tabs panel"><button data-diff="0" class="${diff===0?'active':''}">일반</button><button data-diff="1" class="${diff===1?'active':''}">하드</button></div>
      <div class="cards">${rows.map(x=>{const id=x.ProgressKey.MainBattleId,free=x.Rewards?.[0]?.Rewards||[],premium=x.Rewards?.[1]?.Rewards||[];return `<div class="card"><b>${AGE[id.AgeIdx]||('시대 '+(id.AgeIdx+1))} · ${id.AgeIdx+1}-${id.BattleIdx+1}</b><div class="small" style="margin-top:8px"><span class="chip">무료</span> ${free.map(rewardText).join(' · ')||'-'}</div><div class="small" style="margin-top:6px"><span class="chip">프리미엄</span> ${premium.map(rewardText).join(' · ')||'-'}</div></div>`}).join('')}</div>`;
      e.onclick=ev=>{const b=ev.target.closest('[data-diff]');if(b){diff=+b.dataset.diff;S.passDifficulty=diff;save();render()}}
    }
    render()
  }
  async function unlocksV4(){
    const e=$('#app'),data=await j(`${CFG}/PlayerSegments.json`);
    const N={IdleCash:'오프라인 보상',Shop:'상점',StarterPackage:'스타터 패키지',AutoForge:'자동 제련',Dungeons:'던전',HammerDungeon:'망치 도둑',SkillCollection:'스킬',SkillSlot0:'스킬 슬롯 1',SkillDungeon:'유령 마을',Pets:'펫',PetSlot0:'펫 슬롯 1',PetDungeon:'에그셸 던전',Chat:'채팅',Arena:'아레나',SkillSlot1:'스킬 슬롯 2',TechTree:'기술 트리',PotionDungeon:'기술 포션 던전',Guilds:'클랜',SkillSlot2:'스킬 슬롯 3',PetSlot1:'펫 슬롯 2',PetSlot2:'펫 슬롯 3',Missions:'미션',SwitchWorlds:'월드 전환',GuildMissions:'클랜 임무',ForgeAscension:'대장간 승천',MountsAscension:'탈것 승천',SkillsAscension:'스킬 승천',PetsAscension:'펫 승천',AscensionStarsBonus:'승천 보너스',ClanTechTree:'클랜 기술',AutoForgeStack:'자동 제련 스택',EggStarterOffer:'알 스타터 오퍼'};
    const rows=Object.entries(data||{}).map(([id,x])=>{const req=x.PlayerCondition?.PropertyRequirements||[],stage=req.find(r=>String(r.Id?.$type||'').endsWith('MainBattleProgress')&&r.Min?._value)?.Min?._value,force=req.some(r=>String(r.Id?.$type||'').endsWith('FeatureForceLock')&&r.Min?._value===true),extra=[];for(const r of req){const t=String(r.Id?.$type||'');if(t.endsWith('AccountAge')&&r.Max?._value)extra.push('계정 생성 후 24시간 이내');if(t.endsWith('ForgeLevel')&&typeof r.Min?._value==='number')extra.push('대장간 Lv.'+r.Min._value);if(t.endsWith('ForgeLevelMaxed'))extra.push('대장간 최대레벨');}for(const dep of x.PlayerCondition?.RequireAllSegments||[])extra.push((N[dep]||dep)+' 이후');return{id,name:N[id]||x.DisplayName||id,desc:x.Description||'',stage,force,extra}}).sort((a,b)=>{if(a.stage&&b.stage)return a.stage.AgeIdx-b.stage.AgeIdx||a.stage.BattleIdx-b.stage.BattleIdx;if(a.stage)return-1;if(b.stage)return 1;return a.name.localeCompare(b.name)});
    e.innerHTML=`${pageTitle('해금','콘텐츠 해금','PlayerSegments의 실제 스테이지 조건과 추가 조건을 한국어로 정리합니다.')}<div class="cards">${rows.map(x=>`<div class="card"><b>${esc(x.name)}</b><div class="muted small">${x.stage?`스테이지 ${x.stage.AgeIdx+1}-${x.stage.BattleIdx+1}`:'스테이지 조건 없음'}${x.force?' · 현재 강제 잠금':''}</div>${x.extra.length?`<div class="small" style="margin-top:5px">${x.extra.join(' · ')}</div>`:''}<div class="muted small" style="margin-top:5px">${esc(x.desc)}</div></div>`).join('')}</div>`
  }
  async function shopV4(){
    const e=$('#app'),[iap,res]=await Promise.all([j(`${CFG}/InAppProducts.json`),j(`${CFG}/ShopResourcesLibrary.json`)]);
    const seen=new Set(),products=[];
    for(const p of Object.values(iap||{})){if(!p?.ProductId||seen.has(p.ProductId))continue;seen.add(p.ProductId);products.push(p)}
    e.innerHTML=`${pageTitle('상점','상점 데이터','2.9.0의 인앱 상품과 무료/일일 리소스 상품을 그대로 표시합니다. 가격은 설정 파일의 원본 가격값입니다.')}
    <div class="panel"><h2>무료/리소스 상품</h2><div class="cards">${Object.values(res||{}).map(x=>`<div class="card"><b>${esc(x.Id)}</b><div>${rewardText(x.Reward)}</div><div class="muted small">${x.Limit?.ResetsWithNewDay?'매일 초기화':''} · ${x.Limit?.AllowedPurchasesPerCooldown||'-'}회</div></div>`).join('')||'<div class="muted">없음</div>'}</div></div>
    <div class="panel"><h2>인앱 상품</h2><div class="cards">${products.map(p=>`<div class="card"><b>${esc(p.Name||p.ProductId)}</b><div class="muted small">${esc(p.ProductId)} · ${esc(p.Type||'')}</div><div style="margin-top:6px">가격값 <b>${p.Price!=null?p.Price:'-'}</b></div><div class="small" style="margin-top:6px">${(p.Rewards||[]).map(rewardText).join(' · ')||'-'}</div></div>`).join('')}</div></div>`
  }
  addNav('계산','summon','🎲','소환 계산');
  addNav('계산','eggs','🥚','알 부화');
  addNav('정보','progresspass','🎟️','진행 패스');
  addNav('정보','unlocks','🔓','해금');
  addNav('정보','shop','🛒','상점');
  pages.summon=summonV4;
  pages.eggs=eggsV4;
  pages.progresspass=passV4;
  pages.unlocks=unlocksV4;
  pages.shop=shopV4;
  initNav();
  const current=(location.hash||'#/home').slice(2)||'home';
  go(current);
})();