(function v4Factory(){
  const SLOT_KEYS=['Weapon','Helmet','Armour','Gloves','Belt','Necklace','Ring','Shoes'];
  const SLOT_KO={Weapon:'무기',Helmet:'투구',Armour:'갑옷',Gloves:'장갑',Belt:'벨트',Necklace:'목걸이',Ring:'반지',Shoes:'신발'};
  const SLOT_TECH={Weapon:'WeaponBonus',Helmet:'HelmetBonus',Armour:'BodyBonus',Gloves:'GloveBonus',Belt:'BeltBonus',Necklace:'NecklaceBonus',Ring:'RingBonus',Shoes:'ShoeBonus'};
  const RR=['Common','Rare','Epic','Legendary','Ultimate','Mythic'];
  const RKO={Common:'일반',Rare:'희귀',Epic:'에픽',Legendary:'전설',Ultimate:'궁극',Mythic:'신화'};
  const FAIRY={
    Mira:{required:'skillDamageMulti',divider:.15,target:'criticalChance',step:.01,cap:.8,need:'스킬 피해',gain:'치명타 확률'},
    Tira:{required:'skillCooldownMulti',divider:.01,target:'blockChance',step:.0025,cap:.3,need:'스킬 쿨다운 감소',gain:'막기 확률'},
    Lora:{required:'healthMulti',divider:.10,target:'reflectChance',step:.0075,cap:.3,need:'체력',gain:'반사 확률'}
  };
  const SKILL_MECH={
    Meat:{count:0,buff:true},Morale:{count:0,buff:true},Berserk:{count:0,buff:true},Buff:{count:0,buff:true},HigherMorale:{count:0,buff:true},
    Arrows:{count:3},Shuriken:{count:5},Shout:{count:8},Meteorite:{count:5},Lightning:{count:5},RainOfArrows:{count:15},
    CannonBarrage:{count:3},Bomb:{count:1},Worm:{count:1},
    Stampede:{count:2,damageIsPerHit:true},Thorns:{count:3,damageIsPerHit:true},StrafeRun:{count:3,damageIsPerHit:true},Drone:{count:10,damageIsPerHit:true}
  };
  const defaultEquip=Object.fromEntries(SLOT_KEYS.map(k=>[k,null]));
  S.loadout=Object.assign({forgeAsc:0,petAsc:0,mountAsc:0,skillAsc:0,equipment:defaultEquip,pets:[null,null,null],mount:null,skillLevels:{},secondary:{
    damageMulti:0,healthMulti:0,meleeDamageMulti:0,rangedDamageMulti:0,criticalChance:0,criticalDamage:0,doubleDamageChance:0,attackSpeed:0,blockChance:0,skillDamageMulti:0,skillCooldownMulti:0,skillHealthMulti:0,lifeSteal:0,healthRegen:0
  }},S.loadout||{});
  S.loadout.equipment=Object.assign({},defaultEquip,S.loadout.equipment||{});
  S.loadout.secondary=Object.assign({damageMulti:0,healthMulti:0,meleeDamageMulti:0,rangedDamageMulti:0,criticalChance:0,criticalDamage:0,doubleDamageChance:0,attackSpeed:0,blockChance:0,skillDamageMulti:0,skillCooldownMulti:0,skillHealthMulti:0,lifeSteal:0,healthRegen:0},S.loadout.secondary||{});
  while(S.loadout.pets.length<3)S.loadout.pets.push(null);
  S.loadout.skins=Object.assign({Weapon:null,Helmet:null,Armour:null},S.loadout.skins||{});
  S.loadout.equippedSkills=Array.isArray(S.loadout.equippedSkills)?S.loadout.equippedSkills.slice(0,3):['','',''];
  while(S.loadout.equippedSkills.length<3)S.loadout.equippedSkills.push('');

  let libsPromise=null;
  function libs(){
    if(libsPromise)return libsPromise;
    libsPromise=Promise.all([
      j(`${CFG}/ItemBalancingConfig.json`),j(`${CFG}/ItemBalancingLibrary.json`),j(`${RAW}/parsed_configs/AutoItemMapping.json`),
      j(`${CFG}/WeaponLibrary.json`),j(`${CFG}/PetLibrary.json`),j(`${CFG}/PetUpgradeLibrary.json`),j(`${CFG}/PetBalancingLibrary.json`),
      j(`${CFG}/MountUpgradeLibrary.json`),j(`${CFG}/SkillLibrary.json`),j(`${CFG}/SkillPassiveLibrary.json`),
      j(`${RAW}/parsed_configs/ManualSpriteMapping.json`),j(`${CFG}/PlayerTechTreePositionLibrary.json`),j(`${CFG}/PlayerTechTreeNodeValuesLibrary.json`),
      j(`${CFG}/GuildTechTreeUpgradeLibrary.json`),j(`${CFG}/AscensionConfigsLibrary.json`),j(`${CFG}/SkinsLibrary.json`),j(`${CFG}/SetsLibrary.json`)
    ]).then(([itemCfg,itemLib,itemMap,weaponLib,petLib,petUp,petBal,mountUp,skillLib,skillPass,sprites,pos,vals,clib,asc,skins,sets])=>({itemCfg,itemLib,itemMap,weaponLib,petLib,petUp,petBal,mountUp,skillLib,skillPass,sprites,pos,vals,clib,asc,skins,sets}));
    return libsPromise;
  }
  function playerTech(type,L){
    let out=0;
    for(const tr of ['Forge','Power','SkillsPetTech'])for(const n of L.pos?.[tr]?.Nodes||[])if(n.Type===type){
      const lv=Math.max(0,Math.floor(num(S.techTree?.[tr]?.[n.Id])));
      const a=L.vals?.[type]?.Tiers?.[n.Tier]?.StatValuePerLevel||[];
      if(lv&&a.length)out+=num(a[Math.min(lv,a.length)-1]);
    }
    return out;
  }
  function clanTech(type,L){
    const d=L.clib?.[type],lv=Math.max(0,Math.floor(num(S.clanTech?.[type])));
    if(!d||!lv)return 0;
    const cap=Math.max(0,num(d.MaxLevel));
    return Math.min(lv,cap)*num(d.ValuePerLevel)+Math.max(0,lv-cap)*num(d.ValuePerInfiniteLevel);
  }
  function ascMulti(section,level,L,stat){
    level=Math.max(0,Math.min(3,Math.floor(num(level))));
    if(!level)return 1;
    const c=L.asc?.[section]?.AscensionConfigPerLevel?.[level-1];
    const x=(c?.StatContributions||[]).find(s=>s.StatNode?.UniqueStat?.StatType===stat||s.StatNode?.UniqueStat?.StatType===('Ascension'+stat));
    return x?num(x.Value)+1:1;
  }
  function statVal(stats,type){return (stats||[]).filter(s=>s.StatNode?.UniqueStat?.StatType===type).reduce((a,s)=>a+num(s.Value),0)}
  function attackInterval(mult,duration){
    mult=Math.max(.01,num(mult,1));duration=Math.max(.1,num(duration,1.5));
    const SIM=429496729,inc=Math.floor((SIM*Math.round(mult*1e6))/4294967296)||1;
    return (Math.ceil(Math.round(duration*1e6)/inc)+1)*.1;
  }
  function fairyApply(sec){
    const n=S.fairy?.name,lv=Math.max(1,Math.min(20,num(S.fairy?.level,1)));
    const target={criticalChance:sec.criticalChance,blockChance:sec.blockChance,reflectChance:0};
    if(!n||!FAIRY[n])return{name:null,granted:0,...target};
    const f=FAIRY[n],required=Math.abs(num(sec[f.required])),steps=Math.floor(required/f.divider+1e-9),raw=steps*f.step*lv,before=num(target[f.target]),after=Math.min(before+raw,f.cap);
    target[f.target]=after;
    return{name:n,required,steps,granted:Math.max(0,after-before),...target};
  }
  async function compute(){
    const L=await libs(),cfg=L.itemCfg,sec=Object.fromEntries(Object.entries(S.loadout.secondary).map(([k,v])=>[k,num(v)/100]));
    let itemD=0,itemH=0,weaponD=0,isRanged=false,attackRange=0,attackDuration=1.5,attackWindup=.5;
    for(const slot of SLOT_KEYS){
      const it=S.loadout.equipment[slot];if(!it)continue;
      const key=`{'Age': ${it.age}, 'Type': '${slot}', 'Idx': ${it.idx}}`,d=L.itemLib[key];if(!d)continue;
      const bonus=playerTech(SLOT_TECH[slot],L)+clanTech(SLOT_TECH[slot],L);
      let dg=0,hp=0;
      for(const s of d.EquipmentStats||[]){let v=num(s.Value)*Math.pow(num(cfg.LevelScalingBase,1.01),Math.max(0,num(it.level,1)-1))*(1+bonus);if(s.StatNode?.UniqueStat?.StatType==='Damage')dg+=v;if(s.StatNode?.UniqueStat?.StatType==='Health')hp+=v}
      itemD+=dg;itemH+=hp;if(slot==='Weapon'){weaponD=dg;const w=L.weaponLib[key];if(w){attackRange=num(w.AttackRange);isRanged=attackRange>=1;attackDuration=num(w.AttackDuration,1.5);attackWindup=num(w.WindupTime,.5)}}
    }
    let petD=0,petH=0;
    for(const p of S.loadout.pets){if(!p)continue;const info=L.petUp?.[p.rarity]?.LevelInfo?.[Math.max(0,Math.min((L.petUp?.[p.rarity]?.LevelInfo?.length||1)-1,num(p.level,1)-1))];if(!info)continue;const pd=L.petLib?.[`{'Rarity': '${p.rarity}', 'Id': ${p.id}}`],bal=L.petBal?.[pd?.Type||'Balanced']||{DamageMultiplier:1,HealthMultiplier:1},bd=playerTech('PetBonusDamage',L)+clanTech('PetBonusDamage',L),bh=playerTech('PetBonusHealth',L)+clanTech('PetBonusHealth',L),ad=ascMulti('Pets',S.loadout.petAsc,L,'Damage'),ah=ascMulti('Pets',S.loadout.petAsc,L,'Health');petD+=statVal(info.PetStats?.Stats,'Damage')*num(bal.DamageMultiplier,1)*(1+bd)*ad;petH+=statVal(info.PetStats?.Stats,'Health')*num(bal.HealthMultiplier,1)*(1+bh)*ah}
    let mountD=0,mountH=0;
    const m=S.loadout.mount;if(m){const info=L.mountUp?.[m.rarity]?.LevelInfo?.[Math.max(0,Math.min((L.mountUp?.[m.rarity]?.LevelInfo?.length||1)-1,num(m.level,1)-1))];if(info){mountD=statVal(info.MountStats?.Stats,'Damage')*(1+playerTech('MountDamage',L)+clanTech('MountDamage',L))*ascMulti('Mounts',S.loadout.mountAsc,L,'Damage');mountH=statVal(info.MountStats?.Stats,'Health')*(1+playerTech('MountHealth',L)+clanTech('MountHealth',L))*ascMulti('Mounts',S.loadout.mountAsc,L,'Health')}}
    let skillD=0,skillH=0;for(const [id,lv0] of Object.entries(S.loadout.skillLevels)){const lv=Math.max(0,Math.floor(num(lv0)));if(!lv)continue;const rarity=L.skillLib?.[id]?.Rarity;if(!rarity)continue;const row=L.skillPass?.[rarity]?.LevelStats?.[Math.max(0,Math.min((L.skillPass?.[rarity]?.LevelStats?.length||1)-1,lv-1))];skillD+=statVal(row?.Stats,'Damage');skillH+=statVal(row?.Stats,'Health')}
    skillD*=1+playerTech('SkillPassiveDamage',L)+clanTech('SkillPassiveDamage',L);skillH*=1+playerTech('SkillPassiveHealth',L)+clanTech('SkillPassiveHealth',L);
    skillD*=ascMulti('Skills',S.loadout.skillAsc,L,'Damage');skillH*=ascMulti('Skills',S.loadout.skillAsc,L,'Health');
    const fairy=fairyApply(sec);
    const commonD=1+num(sec.damageMulti),commonH=1+num(sec.healthMulti),forgeD=ascMulti('Forge',S.loadout.forgeAsc,L,'Damage'),forgeH=ascMulti('Forge',S.loadout.forgeAsc,L,'Health');
    const weaponM=isRanged?weaponD:weaponD*num(cfg.PlayerMeleeDamageMultiplier,1.6),other=itemD-weaponD;
    const equipD=(num(cfg.PlayerBaseDamage,10)+weaponM+other)*commonD*forgeD,equipH=(num(cfg.PlayerBaseHealth,80)+itemH)*commonH*forgeH;
    const sysD=(petD+mountD+skillD)*commonD,sysH=(petH+mountH+skillH)*commonH;
    const specific=1+(isRanged?num(sec.rangedDamageMulti):num(sec.meleeDamageMulti));
    let damage=(equipD+sysD)*specific,health=equipH+sysH,skinD=0,skinH=0,setD=0,setH=0;
    const setCounts={};
    for(const type of ['Weapon','Helmet','Armour']){const sk=S.loadout.skins?.[type];if(!sk)continue;const entry=Object.values(L.skins||{}).find(x=>x.SkinId?.Type===type&&x.SkinId?.Idx===sk.idx);if(!entry)continue;if(sk.statType==='Damage')skinD+=num(sk.value)/100;if(sk.statType==='Health')skinH+=num(sk.value)/100;if(entry.BaseSetId)setCounts[entry.BaseSetId]=(setCounts[entry.BaseSetId]||0)+1}
    for(const [setId,count] of Object.entries(setCounts)){const set=L.sets?.[setId];for(const tier of set?.BonusTiers||[])if(count>=num(tier.RequiredPieces))for(const s of tier.BonusStats?.Stats||[]){const t=s.StatNode?.UniqueStat?.StatType;if(t==='Damage')setD+=num(s.Value);if(t==='Health')setH+=num(s.Value)}}
    damage*=1+skinD+setD;health*=1+skinH+setH;
    const critChance=fairy.criticalChance,critMulti=1+num(cfg.PlayerBaseCritDamage,.2)+num(sec.criticalDamage),doubleChance=num(sec.doubleDamageChance),attackSpeed=1+num(sec.attackSpeed),interval=attackInterval(attackSpeed,attackDuration),expectedHit=damage*(1+critChance*(critMulti-1))*(1+doubleChance),dps=expectedHit/interval;
    const activeTech=playerTech('SkillDamage',L)+clanTech('SkillDamage',L),skillAsc=ascMulti('Skills',S.loadout.skillAsc,L,'Damage');
    const skillDamageFactor=(1+activeTech)*(1+num(sec.skillDamageMulti))*skillAsc*commonD;
    const skillHealthFactor=(1+activeTech)*(1+num(sec.skillHealthMulti)+num(sec.skillDamageMulti))*skillAsc*commonD;
    const cdFactor=Math.max(.1,1-num(sec.skillCooldownMulti)),critExpected=1+Math.min(critChance,1)*(critMulti-1),doubleExpected=1+Math.min(doubleChance,1),basicAps=attackSpeed/Math.max(.1,attackDuration);
    let activeSkillDps=0,skillBuffDps=0,skillHps=0;const activeBreakdown=[];
    for(const id of S.loadout.equippedSkills){
      if(!id)continue;const s=L.skillLib?.[id],lv=Math.max(0,Math.floor(num(S.loadout.skillLevels?.[id])));if(!s||!lv)continue;
      const idx=Math.max(0,lv-1),baseDmg=num(s.DamagePerLevel?.[idx]),baseHeal=num(s.HealthPerLevel?.[idx]),finalCd=Math.max(.1,num(s.Cooldown,1)*cdFactor),mech=SKILL_MECH[id]||{count:1};
      let sdps=0,bdps=0,hps=0;
      if(mech.buff){
        const skillVal=baseDmg>0?baseDmg:baseHeal,finalBonus=skillVal*skillDamageFactor,uptime=num(s.ActiveDuration)/(Math.max(.1,finalCd+num(s.ActiveDuration)));
        bdps=finalBonus*basicAps*critExpected*doubleExpected*uptime;skillBuffDps+=bdps;
      }else if(baseDmg>0){
        const count=Math.max(1,num(mech.count,1)),buffed=baseDmg*skillDamageFactor,total=mech.damageIsPerHit?buffed*count:buffed;
        sdps=total/finalCd;activeSkillDps+=sdps;
      }
      if(baseHeal>0){hps=baseHeal*skillHealthFactor/finalCd;skillHps+=hps}
      activeBreakdown.push({id,level:lv,baseDmg,baseHeal,cooldown:finalCd,dps:sdps,buffDps:bdps,hps});
    }
    const totalDps=dps+activeSkillDps+skillBuffDps;
    const power=Math.round(((damage-num(cfg.PlayerBaseDamage,10))*8+(health-num(cfg.PlayerBaseHealth,80)))*3);
    const contextBonuses={
      clanWar:{dmg:clanTech('ClanWarDamage',L),hp:clanTech('ClanWarHealth',L)},
      mission:{dmg:clanTech('MissionDamage',L),hp:clanTech('MissionHealth',L)},
      hammer:{dmg:clanTech('HammerThiefDungeonDamage',L),hp:clanTech('HammerThiefDungeonHealth',L)},
      skillDungeon:{dmg:clanTech('GhostTownDungeonDamage',L),hp:clanTech('GhostTownDungeonHealth',L)},
      eggDungeon:{dmg:clanTech('InvasionDungeonDamage',L),hp:clanTech('InvasionDungeonHealth',L)},
      potionDungeon:{dmg:clanTech('ZombieRushDungeonDamage',L),hp:clanTech('ZombieRushDungeonHealth',L)}
    };
    return{L,damage,health,power,contextBonuses,dps,totalDps,activeSkillDps,skillBuffDps,skillHps,activeBreakdown,expectedHit,critChance,critMulti,blockChance:fairy.blockChance,reflectChance:fairy.reflectChance,attackSpeed,interval,isRanged,attackRange,attackDuration,attackWindup,itemD,itemH,petD,petH,mountD,mountH,skillD,skillH,fairy,skinD,skinH,setD,setH,setCounts};
  }
  globalThis.__fmProfileCompute=compute;
  function equipOptions(map,slot,current){
    return `<option value="">미착용</option>`+Object.values(map).filter(x=>x.TypeName===slot).sort((a,b)=>a.Age-b.Age||a.Idx-b.Idx).map(x=>{const v=x.Age+':'+x.Idx;return `<option value="${v}" ${current&&current.age===x.Age&&current.idx===x.Idx?'selected':''}>${AGE[x.Age]||x.Age} · ${x.ItemName}</option>`}).join('');
  }
  function petLookup(spriteMap){const out={};for(const [idx,x] of Object.entries(spriteMap?.pets?.mapping||{}))out[x.rarity+':'+x.id]={...x,idx:+idx};return out}
  function mountLookup(spriteMap){const out={};for(const [idx,x] of Object.entries(spriteMap?.mounts?.mapping||{}))out[x.rarity+':'+x.id]={...x,idx:+idx};return out}
  async function profileV4(){
    const e=$('#app'),L=await libs(),stats=await compute(),pLook=petLookup(L.sprites),mLook=mountLookup(L.sprites);
    function render(){
      e.innerHTML=`<div class="hero"><span class="chip">통합 프로필</span><h1>내 프로필</h1><p class="muted">장비·펫·탈것·스킬·기술·요정을 한 계산식으로 묶습니다. 입력값은 기기에 저장됩니다.</p></div>
      <div class="panel grid g4"><div class="metric"><small>총 피해</small><b class="sum">${fmt(stats.damage)}</b></div><div class="metric"><small>총 체력</small><b class="sum">${fmt(stats.health)}</b></div><div class="metric"><small>전투력</small><b>${fmt(stats.power)}</b></div><div class="metric"><small>총 지속 DPS</small><b>${fmt(stats.totalDps)}</b></div><div class="metric"><small>공격주기</small><b>${stats.interval.toFixed(2)}초</b></div><div class="metric"><small>치명타</small><b>${fmt(stats.critChance*100)}%</b></div><div class="metric"><small>막기</small><b>${fmt(stats.blockChance*100)}%</b></div><div class="metric"><small>반사</small><b>${fmt(stats.reflectChance*100)}%</b></div><div class="metric"><small>무기</small><b>${stats.isRanged?'원거리':'근접'}</b></div></div>
      ${stats.fairy.name?`<div class="notice">${stats.fairy.name} 적용: ${FAIRY[stats.fairy.name].gain} +${fmt(stats.fairy.granted*100)}% · 변환 단계 ${stats.fairy.steps}</div>`:''}
      <div class="panel"><h2>승천</h2><div class="grid g4">${[['forgeAsc','대장간'],['petAsc','펫'],['mountAsc','탈것'],['skillAsc','스킬']].map(([k,n])=>`<label class="field"><span>${n} 승천</span><input data-asc="${k}" type="number" min="0" max="3" value="${num(S.loadout[k])}"></label>`).join('')}</div></div>
      <div class="panel"><h2>장비 8부위</h2><div class="cards">${SLOT_KEYS.map(slot=>{const it=S.loadout.equipment[slot],mapEntry=it?L.itemMap[it.age+'_'+({Helmet:0,Armour:1,Gloves:2,Necklace:3,Ring:4,Weapon:5,Shoes:6,Belt:7}[slot])+'_'+it.idx]:null;return `<div class="card"><div class="media">${mapEntry?`<img class="art" src="${GTEX}/items/${mapEntry.SpriteName}.png">`:''}<div style="min-width:0;flex:1"><b>${SLOT_KO[slot]}</b><select data-equip="${slot}">${equipOptions(L.itemMap,slot,it)}</select><label class="field"><span>레벨</span><input data-equip-level="${slot}" type="number" min="1" max="300" value="${it?num(it.level,1):1}" ${it?'':'disabled'}></label></div></div></div>`}).join('')}</div></div>
      <div class="panel"><h2>펫 3마리</h2><div class="cards">${[0,1,2].map(i=>{const p=S.loadout.pets[i],look=p?pLook[p.rarity+':'+p.id]:null;return `<div class="card"><div class="media">${look?`<div class="sprite rarity-${p.rarity}" style="${spriteStyle(`${GTEX}/Pets.png`,look.idx,8,256,72)}"></div>`:''}<div style="flex:1"><b>펫 ${i+1}</b><select data-pet="${i}"><option value="">미착용</option>${Object.values(pLook).sort((a,b)=>RR.indexOf(a.rarity)-RR.indexOf(b.rarity)||a.id-b.id).map(x=>`<option value="${x.rarity}:${x.id}" ${p&&p.rarity===x.rarity&&p.id===x.id?'selected':''}>${RKO[x.rarity]} · ${x.name}</option>`).join('')}</select><label class="field"><span>레벨</span><input data-pet-level="${i}" type="number" min="1" max="300" value="${p?num(p.level,1):1}" ${p?'':'disabled'}></label></div></div></div>`}).join('')}</div></div>
      <div class="panel"><h2>탈것</h2>${(()=>{const m=S.loadout.mount,look=m?mLook[m.rarity+':'+m.id]:null;return `<div class="card media">${look?`<div class="sprite rarity-${m.rarity}" style="${spriteStyle(`${GTEX}/MountIcons.png`,look.idx,4,256,72)}"></div>`:''}<div style="flex:1"><select id="mountSel"><option value="">미착용</option>${Object.values(mLook).sort((a,b)=>RR.indexOf(a.rarity)-RR.indexOf(b.rarity)||a.id-b.id).map(x=>`<option value="${x.rarity}:${x.id}" ${m&&m.rarity===x.rarity&&m.id===x.id?'selected':''}>${RKO[x.rarity]} · ${x.name}</option>`).join('')}</select><label class="field"><span>레벨</span><input id="mountLv" type="number" min="1" max="300" value="${m?num(m.level,1):1}" ${m?'':'disabled'}></label></div></div>`})()}</div>
      <div class="panel"><h2>장착 스킬 3칸</h2><p class="muted small">아래 보유 레벨을 사용해 실제 쿨다운·다단히트·버프 지속시간을 계산합니다.</p><div class="cards">${[0,1,2].map(i=>{const id=S.loadout.equippedSkills[i]||'',info=id?L.skillLib[id]:null,idx=id?Object.entries(L.sprites?.skills?.mapping||{}).find(([,v])=>v.name===id)?.[0]:null,b=stats.activeBreakdown.find(x=>x.id===id);return `<div class="card"><div class="media">${idx!=null?`<div class="sprite rarity-${info?.Rarity||''}" style="${spriteStyle(`${GTEX}/SkillIcons.png`,+idx,8,256,60)}"></div>`:''}<div style="flex:1"><b>스킬 ${i+1}</b><select data-equipped-skill="${i}"><option value="">미장착</option>${Object.keys(L.skillLib).map(k=>`<option value="${k}" ${id===k?'selected':''}>${SKILL_KO[k]||k} · Lv.${num(S.loadout.skillLevels[k])}</option>`).join('')}</select></div></div>${b?`<div class="grid g2" style="margin-top:8px"><div class="metric"><small>실제 쿨다운</small><b>${b.cooldown.toFixed(2)}초</b></div><div class="metric"><small>DPS 기여</small><b>${fmt(b.dps+b.buffDps)}</b></div><div class="metric"><small>회복 HPS</small><b>${fmt(b.hps)}</b></div><div class="metric"><small>레벨</small><b>Lv.${b.level}</b></div></div>`:'<div class="muted small" style="margin-top:8px">보유 레벨이 0이면 전투 기여도 0</div>'}</div>`}).join('')}</div><div class="grid g4" style="margin-top:10px"><div class="metric"><small>기본 공격 DPS</small><b>${fmt(stats.dps)}</b></div><div class="metric"><small>공격 스킬 DPS</small><b>${fmt(stats.activeSkillDps)}</b></div><div class="metric"><small>버프 평균 DPS</small><b>${fmt(stats.skillBuffDps)}</b></div><div class="metric"><small>스킬 HPS</small><b>${fmt(stats.skillHps)}</b></div></div></div>
      <details class="panel"><summary><b>스킬 보유 레벨 (패시브 합산)</b></summary><div class="cards" style="margin-top:10px">${Object.entries(L.skillLib).map(([id,x])=>{const idx=Object.entries(L.sprites?.skills?.mapping||{}).find(([,v])=>v.name===id)?.[0];return `<div class="card media">${idx!=null?`<div class="sprite rarity-${x.Rarity}" style="${spriteStyle(`${GTEX}/SkillIcons.png`,+idx,8,256,60)}"></div>`:''}<div style="flex:1"><b>${SKILL_KO[id]||id}</b><div class="muted small">${RKO[x.Rarity]||x.Rarity}</div><input data-skill-level="${esc(id)}" type="number" min="0" max="300" value="${num(S.loadout.skillLevels[id])}" placeholder="0"></div></div>`}).join('')}</div></details>
      <details class="panel"><summary><b>보조옵션 풀 (%)</b></summary><div class="grid g3" style="margin-top:10px">${[['damageMulti','피해'],['healthMulti','체력'],['meleeDamageMulti','근접 피해'],['rangedDamageMulti','원거리 피해'],['criticalChance','치명타 확률'],['criticalDamage','치명타 피해 추가'],['doubleDamageChance','2배 피해 확률'],['attackSpeed','공격속도'],['blockChance','막기 확률'],['skillDamageMulti','스킬 피해'],['skillCooldownMulti','스킬 쿨다운 감소'],['skillHealthMulti','스킬 체력/회복'],['lifeSteal','흡혈'],['healthRegen','재생']].map(([k,n])=>`<label class="field"><span>${n}</span><input data-sec="${k}" type="number" step=".01" value="${num(S.loadout.secondary[k])}"></label>`).join('')}</div></details>
      <div class="panel"><h2>계산 구성</h2><div class="grid g4"><div class="metric"><small>장비 피해</small><b>${fmt(stats.itemD)}</b></div><div class="metric"><small>펫 피해</small><b>${fmt(stats.petD)}</b></div><div class="metric"><small>탈것 피해</small><b>${fmt(stats.mountD)}</b></div><div class="metric"><small>스킬 패시브 피해</small><b>${fmt(stats.skillD)}</b></div></div></div>
      <div class="panel"><h2>콘텐츠 전용 클랜 기술 적용치</h2><div class="cards">${[
        ['클랜전','clanWar'],['클랜 임무','mission'],['망치 도둑','hammer'],['유령 마을','skillDungeon'],['침공','eggDungeon'],['좀비 러시','potionDungeon']
      ].map(([n,k])=>{const x=stats.contextBonuses[k];return `<div class="card"><b>${n}</b><div class="grid g2" style="margin-top:7px"><div class="metric"><small>피해 +${fmt(x.dmg*100)}%</small><b>${fmt(stats.damage*(1+x.dmg))}</b></div><div class="metric"><small>체력 +${fmt(x.hp*100)}%</small><b>${fmt(stats.health*(1+x.hp))}</b></div></div></div>`}).join('')}</div></div>`;
      e.onchange=handle;e.oninput=ev=>{if(ev.target.matches('input[type=number]'))handle(ev)}
    }
    async function handle(ev){
      const t=ev.target;
      if(t.dataset.asc)S.loadout[t.dataset.asc]=Math.max(0,Math.min(3,num(t.value)));
      if(t.dataset.equip!==undefined){const slot=t.dataset.equip;if(!t.value)S.loadout.equipment[slot]=null;else{const [age,idx]=t.value.split(':').map(Number);S.loadout.equipment[slot]={age,idx,level:S.loadout.equipment[slot]?.level||1}}}
      if(t.dataset.equipLevel!==undefined){const slot=t.dataset.equipLevel;if(S.loadout.equipment[slot])S.loadout.equipment[slot].level=Math.max(1,num(t.value,1))}
      if(t.dataset.pet!==undefined){const i=+t.dataset.pet;if(!t.value)S.loadout.pets[i]=null;else{const [rarity,id]=t.value.split(':');S.loadout.pets[i]={rarity,id:+id,level:S.loadout.pets[i]?.level||1}}}
      if(t.dataset.petLevel!==undefined){const i=+t.dataset.petLevel;if(S.loadout.pets[i])S.loadout.pets[i].level=Math.max(1,num(t.value,1))}
      if(t.id==='mountSel'){if(!t.value)S.loadout.mount=null;else{const [rarity,id]=t.value.split(':');S.loadout.mount={rarity,id:+id,level:S.loadout.mount?.level||1}}}
      if(t.id==='mountLv'&&S.loadout.mount)S.loadout.mount.level=Math.max(1,num(t.value,1));
      if(t.dataset.equippedSkill!==undefined){const i=+t.dataset.equippedSkill,next=t.value;if(next&&S.loadout.equippedSkills.some((x,j)=>j!==i&&x===next)){toast('같은 스킬은 중복 장착할 수 없습니다');return}S.loadout.equippedSkills[i]=next}
      if(t.dataset.skillLevel!==undefined)S.loadout.skillLevels[t.dataset.skillLevel]=Math.max(0,num(t.value));
      if(t.dataset.sec!==undefined)S.loadout.secondary[t.dataset.sec]=num(t.value);
      save();const ns=await compute();Object.assign(stats,ns);render()
    }
    render()
  }
  async function pvpV4(){
    const e=$('#app'),me=await compute();S.pvp=Object.assign({useProfile:true,enD:100,enH:800,enA:1.5,enCrit:0,enBlock:0},S.pvp||{});
    function render(){
      const x=S.pvp,myD=x.useProfile?me.expectedHit:num(x.myD,me.expectedHit),myH=x.useProfile?me.health:num(x.myH,me.health),myA=x.useProfile?me.interval:num(x.myA,me.interval),enHit=num(x.enD,100)*(1+num(x.enCrit)/100*.2)*(1-num(me.blockChance)),myHit=myD*(1-num(x.enBlock)/100),myDps=x.useProfile?me.totalDps*(1-num(x.enBlock)/100):myHit/Math.max(.01,myA),enDps=enHit/Math.max(.01,num(x.enA,1.5)),kill=num(x.enH,800)/Math.max(.0001,myDps),die=myH/Math.max(.0001,enDps);
      e.innerHTML=`<div class="hero"><span class="chip">PVP</span><h1>PVP 비교</h1><p class="muted">내 프로필 계산 결과를 바로 가져와 상대 수치와 비교합니다. 막기 확률까지 기대값에 반영합니다.</p></div>
      <div class="panel"><label class="field"><span>내 프로필 자동 사용</span><select id="puse"><option value="1" ${x.useProfile?'selected':''}>사용</option><option value="0" ${!x.useProfile?'selected':''}>직접 입력</option></select></label></div>
      <div class="grid g2"><div class="panel"><h2>나</h2><div class="grid g2">${[['myD','기대 타격 피해',myD],['myH','체력',myH],['myA','공격주기',myA]].map(([k,n,v])=>`<label class="field"><span>${n}</span><input data-pvp="${k}" type="number" step=".01" value="${num(v)}" ${x.useProfile?'disabled':''}></label>`).join('')}<div class="metric"><small>치명타</small><b>${fmt(me.critChance*100)}%</b></div><div class="metric"><small>막기</small><b>${fmt(me.blockChance*100)}%</b></div><div class="metric"><small>반사</small><b>${fmt(me.reflectChance*100)}%</b></div></div></div>
      <div class="panel"><h2>상대</h2><div class="grid g2">${[['enD','피해'],['enH','체력'],['enA','공격주기'],['enCrit','치명타 확률 %'],['enBlock','막기 확률 %']].map(([k,n])=>`<label class="field"><span>${n}</span><input data-pvp="${k}" type="number" step=".01" value="${num(x[k])}"></label>`).join('')}</div></div></div>
      <div class="panel"><h2 class="${kill<die?'sum':''}">${kill<die?'예상 승리':'예상 패배'}</h2><div class="grid g4"><div class="metric"><small>내 지속 DPS</small><b>${fmt(myDps)}</b></div><div class="metric"><small>상대 유효 DPS</small><b>${fmt(enDps)}</b></div><div class="metric"><small>상대 처치 예상</small><b>${kill.toFixed(2)}초</b></div><div class="metric"><small>내 생존 예상</small><b>${die.toFixed(2)}초</b></div></div></div>`;
      e.onchange=handle;e.oninput=ev=>{if(ev.target.dataset.pvp)handle(ev)}
    }
    function handle(ev){const t=ev.target;if(t.id==='puse')x.useProfile=t.value==='1';if(t.dataset.pvp)x[t.dataset.pvp]=num(t.value);save();render()}
    render()
  }
  async function fairyV4(){
    const e=$('#app'),st=await compute(),up=await j(`${CFG}/FairyUpgradesLibrary.json`),lv=Math.max(1,Math.min(20,num(S.fairy.level,1)));
    let costs={};for(const row of Object.values(up||{}))if(row.Level<=lv)for(const c of row.Costs||[])costs[c.Currency]=(costs[c.Currency]||0)+num(c.Amount);
    e.innerHTML=`<div class="hero"><span class="chip">2.9.0 시즌</span><h1>요정</h1><p class="muted">현재 프로필의 보조옵션 풀을 실제 요정 변환식에 넣어 최종 증가량을 보여줍니다.</p></div>
    <div class="tabs panel" id="fsel"><button data-f="" class="${!S.fairy.name?'active':''}">없음</button>${['Lora','Mira','Tira'].map(n=>`<button data-f="${n}" class="${S.fairy.name===n?'active':''}">${n}</button>`).join('')}</div>
    <div class="panel grid g2"><label class="field"><span>요정 레벨</span><input id="flv4" type="range" min="1" max="20" value="${lv}"></label><div class="metric"><small>현재 레벨</small><b>Lv.${lv}/20</b></div></div>
    <div class="cards">${['Lora','Mira','Tira'].map(n=>{const f=FAIRY[n],sel=S.fairy.name===n,sec=S.loadout.secondary,req=num(sec[f.required]),steps=Math.floor(Math.abs(req/100)/f.divider+1e-9),raw=steps*f.step*lv;return `<div class="card"><img class="fairyArt" src="${GTEX}/FairyIcon${n}.png"><h2>${n}</h2><div class="small">${f.need} ${fmt(f.divider*100)}%마다 ${f.gain} +${fmt(f.step*lv*100)}%</div><div class="muted small">프로필 ${f.need}: ${fmt(req)}% · 변환 단계 ${steps}</div><div class="${sel?'sum':''}">예상 원시 증가 +${fmt(raw*100)}% · 상한 ${fmt(f.cap*100)}%</div></div>`}).join('')}</div>
    ${S.fairy.name?`<div class="panel"><h2>현재 실제 적용</h2><div class="grid g3"><div class="metric"><small>변환 단계</small><b>${st.fairy.steps}</b></div><div class="metric"><small>상한 적용 후 증가</small><b class="sum">+${fmt(st.fairy.granted*100)}%</b></div><div class="metric"><small>대상 최종</small><b>${fmt((S.fairy.name==='Mira'?st.critChance:S.fairy.name==='Tira'?st.blockChance:st.reflectChance)*100)}%</b></div></div></div>`:''}
    <div class="panel"><h2>Lv.${lv}까지 강화 누적비용</h2><div class="grid g3">${Object.entries(costs).map(([k,v])=>`<div class="metric"><small>${({Coins:'코인',SkillSummonTickets:'스킬 티켓',Eggshells:'에그셸',TechPotions:'기술 포션',ClockWinders:'탈것 열쇠'})[k]||k}</small><b>${fmt(v)}</b></div>`).join('')}</div><p class="muted small">각 레벨에서 5종을 전부 내는 게 아니라 재화 1종을 선택해서 지불합니다.</p></div>`;
    $('#fsel').onclick=ev=>{const b=ev.target.closest('[data-f]');if(b){S.fairy.name=b.dataset.f||null;save();fairyV4()}};
    $('#flv4').oninput=ev=>{S.fairy.level=+ev.target.value;save();fairyV4()}
  }
  pages.profile=profileV4;
  pages.pvp=pvpV4;
  pages.fairies=fairyV4;
})();