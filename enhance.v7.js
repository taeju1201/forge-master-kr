(function v7Factory(){
  const prevProfile=pages.profile;
  const TYPE_KO={Weapon:'무기',Helmet:'투구',Armour:'갑옷'};
  const SET_KO={SantaSet:'산타',SkiSet:'스노보드',SnowmanSet:'눈사람',LeprechaunSet:'레프리콘',FlowerSet:'꽃',DruidSet:'드루이드',BunnySet:'토끼',ClownSet:'광대',MillionaireSet:'백만장자',FishbowlSet:'어항',EagleSet:'독수리',SkaterSet:'스케이터',CatSet:'고양이',SharkSet:'상어',MushroomSet:'버섯',AnubisSet:'아누비스',BoxerSet:'복서',DarkPlanetWarriorSet:'그림자',CubeguySet:'큐브가이',LavamanSet:'라바맨',ChefSet:'셰프',MummySet:'미라',SkeletonSet:'스켈레톤',ReaperSet:'리퍼',DemonSet:'데몬',KnightSet:'기사',KingSet:'왕'};
  let dataP=null;
  function data(){if(!dataP)dataP=Promise.all([j(`${CFG}/SkinsLibrary.json`),j(`${CFG}/SetsLibrary.json`),j(`${RAW}/parsed_configs/ManualSpriteMapping.json`)]).then(([skins,sets,map])=>({skins,sets,map}));return dataP}
  function entry(D,type,idx){return Object.values(D.skins||{}).find(x=>x.SkinId?.Type===type&&x.SkinId?.Idx===idx)}
  function skinStyle(D,type,idx,size=72){const i=D.map?.skins?.mapping?.[type+'_'+idx];if(i==null)return'';return spriteStyle(`${GTEX}/${D.map.skins.texture}`,i,D.map.skins.grid.columns,D.map.skins.sprite_size.width,size)}
  function setInfo(D){
    const counts={};
    for(const type of ['Weapon','Helmet','Armour']){const sk=S.loadout.skins?.[type];if(!sk)continue;const en=entry(D,type,sk.idx);if(en?.BaseSetId)counts[en.BaseSetId]=(counts[en.BaseSetId]||0)+1}
    return Object.entries(counts).map(([id,count])=>{const set=D.sets[id],tier=(set?.BonusTiers||[]).filter(x=>count>=x.RequiredPieces);return{id,count,need:set?.BonusTiers?.[0]?.RequiredPieces||3,active:tier.length>0,bonus:tier.flatMap(x=>x.BonusStats?.Stats||[])}});
  }
  pages.profile=async function(){
    await prevProfile();
    const D=await data(),host=$('#app');
    let html=`<div class="panel" id="skinProfile"><h2>스킨 / 세트 효과</h2><p class="muted small">실제 SkinsUiIcons 이미지와 스킨 옵션 범위를 사용합니다. 같은 세트 3부위를 착용하면 세트 보너스가 종합 피해/체력에 자동 적용됩니다.</p><div class="cards">`;
    for(const type of ['Weapon','Helmet','Armour']){
      const cur=S.loadout.skins?.[type],en=cur?entry(D,type,cur.idx):null,poss=en?.PossibleStats||[],selDef=poss.find(x=>x.StatNode?.UniqueStat?.StatType===cur?.statType),min=selDef?num(selDef.MinValue)*100:0,max=selDef?num(selDef.MaxValue)*100:100;
      const opts=Object.values(D.skins||{}).filter(x=>x.SkinId?.Type===type).sort((a,b)=>a.SkinId.Idx-b.SkinId.Idx);
      html+=`<div class="card" data-skin-type="${type}"><div class="media">${cur?`<div class="sprite" style="${skinStyle(D,type,cur.idx)}"></div>`:''}<div style="flex:1"><b>${TYPE_KO[type]} 스킨</b><select data-skin-id><option value="">없음</option>${opts.map(x=>`<option value="${x.SkinId.Idx}" ${cur&&cur.idx===x.SkinId.Idx?'selected':''}>${SET_KO[x.BaseSetId]||x.BaseSetId||'기타'} · #${x.SkinId.Idx}</option>`).join('')}</select></div></div>${cur&&en?`<div class="grid g2" style="margin-top:8px"><label class="field"><span>옵션</span><select data-skin-stat>${poss.map(x=>{const t=x.StatNode?.UniqueStat?.StatType;return `<option value="${t}" ${cur.statType===t?'selected':''}>${t==='Damage'?'피해':'체력'}</option>`}).join('')}</select></label><label class="field"><span>수치 % (${fmt(min)}~${fmt(max)})</span><input data-skin-val type="number" step=".01" min="${min}" max="${max}" value="${num(cur.value)}"></label></div><div class="muted small">${SET_KO[en.BaseSetId]||en.BaseSetId||'세트 없음'}</div>`:''}</div>`;
    }
    html+='</div>';
    const sets=setInfo(D);
    if(sets.length)html+=`<div class="grid g3" style="margin-top:10px">${sets.map(x=>`<div class="metric"><small>${SET_KO[x.id]||x.id} ${x.count}/${x.need}</small><b class="${x.active?'sum':''}">${x.active?'세트 활성':'미완성'}</b>${x.active?`<div class="muted small">${x.bonus.map(s=>(s.StatNode?.UniqueStat?.StatType==='Damage'?'피해':'체력')+' +'+fmt(num(s.Value)*100)+'%').join(' · ')}</div>`:''}</div>`).join('')}</div>`;
    html+='</div>';
    host.insertAdjacentHTML('beforeend',html);
    const oldChange=host.onchange,oldInput=host.oninput;
    host.onchange=ev=>{if(ev.target.closest('#skinProfile'))return change(ev);if(oldChange)return oldChange.call(host,ev)};
    host.oninput=ev=>{if(ev.target.closest('#skinProfile')&&ev.target.dataset.skinVal!==undefined)return change(ev);if(oldInput)return oldInput.call(host,ev)};
    function change(ev){
      const card=ev.target.closest('[data-skin-type]');if(!card)return;const type=card.dataset.skinType;
      if(ev.target.dataset.skinId!==undefined){
        if(!ev.target.value)S.loadout.skins[type]=null;
        else{const idx=+ev.target.value,en=entry(D,type,idx),first=en?.PossibleStats?.[0],statType=first?.StatNode?.UniqueStat?.StatType||'Damage',value=num(first?.MinValue)*100;S.loadout.skins[type]={idx,statType,value}}
      }
      const cur=S.loadout.skins[type];if(cur&&ev.target.dataset.skinStat!==undefined){cur.statType=ev.target.value;const d=entry(D,type,cur.idx)?.PossibleStats?.find(x=>x.StatNode?.UniqueStat?.StatType===cur.statType);cur.value=Math.min(num(d?.MaxValue)*100,Math.max(num(d?.MinValue)*100,num(cur.value)))}
      if(cur&&ev.target.dataset.skinVal!==undefined){const d=entry(D,type,cur.idx)?.PossibleStats?.find(x=>x.StatNode?.UniqueStat?.StatType===cur.statType);cur.value=Math.min(num(d?.MaxValue)*100,Math.max(num(d?.MinValue)*100,num(ev.target.value)))}
      save();pages.profile()
    }
  };
})();