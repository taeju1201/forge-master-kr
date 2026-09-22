(function v6Factory(){
  S.loadout.secondarySources=S.loadout.secondarySources||{};
  const STAT_KO={CriticalChance:'치명타 확률',CriticalMulti:'치명타 피해',BlockChance:'막기 확률',HealthRegen:'체력 재생',LifeSteal:'흡혈',DoubleDamageChance:'2배 피해 확률',DamageMulti:'피해',MeleeDamageMulti:'근접 피해',RangedDamageMulti:'원거리 피해',AttackSpeed:'공격속도',SkillDamageMulti:'스킬 피해',SkillCooldownMulti:'스킬 쿨다운 감소',HealthMulti:'체력'};
  const AGG_MAP={CriticalChance:'criticalChance',CriticalMulti:'criticalDamage',BlockChance:'blockChance',HealthRegen:'healthRegen',LifeSteal:'lifeSteal',DoubleDamageChance:'doubleDamageChance',DamageMulti:'damageMulti',MeleeDamageMulti:'meleeDamageMulti',RangedDamageMulti:'rangedDamageMulti',AttackSpeed:'attackSpeed',SkillDamageMulti:'skillDamageMulti',SkillCooldownMulti:'skillCooldownMulti',HealthMulti:'healthMulti'};
  let dataP=null;
  function data(){
    if(!dataP)dataP=Promise.all([j(`${CFG}/SecondaryStatLibrary.json`),j(`${CFG}/SecondaryStatItemUnlockLibrary.json`),j(`${CFG}/SecondaryStatPetUnlockLibrary.json`)]).then(([lib,item,pet])=>({lib,item,pet}));
    return dataP
  }
  function sourceKey(kind,id){return kind+':'+id}
  function allowedCount(kind,obj,D){
    if(!obj)return 0;
    if(kind==='item')return num(S.loadout.forgeAsc)>0?2:num(D.item[String(obj.age)]?.NumberOfSecondStats);
    if(kind==='pet'||kind==='mount')return num(D.pet[obj.rarity]?.NumberOfSecondStats);
    return 0
  }
  function rowsFor(kind,id,obj,D){
    const key=sourceKey(kind,id),max=allowedCount(kind,obj,D),rows=S.loadout.secondarySources[key]||(S.loadout.secondarySources[key]=[]);
    while(rows.length<max)rows.push({statId:'',value:0});
    if(rows.length>max)rows.length=max;
    return rows
  }
  function aggregate(){
    const base={damageMulti:0,healthMulti:0,meleeDamageMulti:0,rangedDamageMulti:0,criticalChance:0,criticalDamage:0,doubleDamageChance:0,attackSpeed:0,blockChance:0,skillDamageMulti:0,skillCooldownMulti:0,skillHealthMulti:0,lifeSteal:0,healthRegen:0};
    for(const rows of Object.values(S.loadout.secondarySources||{}))for(const x of rows||[]){const k=AGG_MAP[x.statId];if(k)base[k]+=num(x.value)}
    S.loadout.secondary=Object.assign(S.loadout.secondary||{},base);
  }
  function statEditor(kind,id,obj,D,title){
    const rows=rowsFor(kind,id,obj,D);
    if(!obj)return '';
    const options=Object.entries(D.lib).filter(([k,v])=>num(v.UpperRange)>0&&AGG_MAP[k]).map(([k,v])=>({k,name:STAT_KO[k]||k,min:num(v.LowerRange)*100,max:num(v.UpperRange)*100}));
    if(!rows.length)return `<div class="muted small">${title}: 현재 등급/시대에는 보조옵션이 없습니다.</div>`;
    return `<div class="card" data-sec-source="${kind}:${id}"><b>${title} 보조옵션 ${rows.length}줄</b><div class="grid g2" style="margin-top:8px">${rows.map((r,i)=>{const def=options.find(x=>x.k===r.statId);return `<div><select data-source-stat="${i}"><option value="">선택 안 함</option>${options.map(x=>`<option value="${x.k}" ${r.statId===x.k?'selected':''}>${x.name} (${fmt(x.min)}~${fmt(x.max)}%)</option>`).join('')}</select><label class="field"><span>수치 % ${def?`(${fmt(def.min)}~${fmt(def.max)})`:''}</span><input data-source-val="${i}" type="number" step=".01" min="${def?def.min:0}" max="${def?def.max:100}" value="${num(r.value)}" ${r.statId?'':'disabled'}></label></div>`}).join('')}</div></div>`
  }
  const prevProfile=pages.profile,prevPvp=pages.pvp,prevFairy=pages.fairies;
  pages.profile=async function(){
    aggregate();await prevProfile();
    const D=await data(),host=$('#app');
    const manual=[...host.querySelectorAll('details')].find(x=>x.querySelector('summary')?.textContent?.includes('보조옵션 풀'));
    if(manual){manual.querySelectorAll('input').forEach(x=>x.disabled=true);manual.insertAdjacentHTML('afterbegin','<div class="notice" style="margin:8px">아래 장비/펫/탈것별 보조옵션에서 자동 합산된 값입니다.</div>')}
    let html=`<div class="panel"><h2>장착 개별 보조옵션</h2><p class="muted small">게임의 실제 최소/최대 범위와 해금 줄 수를 적용합니다. 장비 승천 중이면 장비는 시대와 관계없이 2줄로 계산합니다.</p><div class="cards">`;
    for(const [slot,obj] of Object.entries(S.loadout.equipment||{}))html+=statEditor('item',slot,obj,D,SLOT?.[slot]||slot);
    for(let i=0;i<3;i++)html+=statEditor('pet',i,S.loadout.pets?.[i],D,`펫 ${i+1}`);
    html+=statEditor('mount',0,S.loadout.mount,D,'탈것')+'</div></div>';
    host.insertAdjacentHTML('beforeend',html);
    const prevChange=host.onchange,prevInput=host.oninput;
    host.onchange=ev=>{if(ev.target.closest('[data-sec-source]'))return sourceChange(ev);if(prevChange)return prevChange.call(host,ev)};
    host.oninput=ev=>{if(ev.target.dataset.sourceVal!==undefined||ev.target.dataset.sourceStat!==undefined)return sourceChange(ev);if(prevInput)return prevInput.call(host,ev)};
    function sourceChange(ev){
      const card=ev.target.closest('[data-sec-source]');if(!card)return;
      const [kind,id]=card.dataset.secSource.split(':'),obj=kind==='item'?S.loadout.equipment[id]:kind==='pet'?S.loadout.pets[+id]:S.loadout.mount;
      const rows=rowsFor(kind,id,obj,D),i=+(ev.target.dataset.sourceStat??ev.target.dataset.sourceVal);
      if(ev.target.dataset.sourceStat!==undefined){rows[i].statId=ev.target.value;const def=D.lib[ev.target.value];rows[i].value=def?Math.min(num(def.UpperRange)*100,Math.max(num(def.LowerRange)*100,num(rows[i].value)||num(def.LowerRange)*100)):0}
      if(ev.target.dataset.sourceVal!==undefined){const def=D.lib[rows[i].statId];let v=num(ev.target.value);if(def)v=Math.min(num(def.UpperRange)*100,Math.max(num(def.LowerRange)*100,v));rows[i].value=v}
      aggregate();save();pages.profile()
    }
  };
  pages.pvp=async function(){aggregate();return prevPvp()};
  pages.fairies=async function(){aggregate();return prevFairy()};
  pages.substats=async function(){
    const D=await data(),e=$('#app');e.innerHTML=`<div class="hero"><span class="chip">보조옵션</span><h1>보조옵션 도감</h1><p class="muted">2.9.0의 실제 옵션 범위와 장비/펫 해금 규칙입니다.</p></div>
    <div class="cards">${Object.entries(D.lib).filter(([,v])=>num(v.UpperRange)>0).map(([k,v])=>`<div class="card"><b>${STAT_KO[k]||k}</b><div class="muted small">${k}</div><div class="sum">${fmt(num(v.LowerRange)*100)} ~ ${fmt(num(v.UpperRange)*100)}%</div></div>`).join('')}</div>
    <div class="panel"><h2>장비 해금</h2><div class="grid g4">${Object.values(D.item).map(x=>`<div class="metric"><small>${AGE[x.ItemAge]||x.ItemAge}</small><b>${x.NumberOfSecondStats}줄</b></div>`).join('')}</div></div>
    <div class="panel"><h2>펫/탈것 해금</h2><div class="grid g3">${Object.values(D.pet).map(x=>`<div class="metric"><small>${({Common:'일반',Rare:'희귀',Epic:'에픽',Legendary:'전설',Ultimate:'궁극',Mythic:'신화'})[x.PetRarity]||x.PetRarity}</small><b>${x.NumberOfSecondStats}줄</b></div>`).join('')}</div></div>`
  };
  const g=nav.find(x=>x[0]==='도감');if(g&&!g[1].some(x=>x[0]==='substats'))g[1].push(['substats','📊','보조옵션']);
  aggregate();initNav();go((location.hash||'#/home').slice(2)||'home')
})();