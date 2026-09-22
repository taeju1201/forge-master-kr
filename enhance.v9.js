(function v9Factory(){
  S.baseDrops=Object.assign({tab:'forge',version:VER,compare:false,baseVersion:'2026_09_02_09_08',level:1},S.baseDrops||{});
  S.configBrowser=Object.assign({version:VER,file:'GuildWarDayConfigLibrary.json',filter:''},S.configBrowser||{});
  const RARS=['Common','Rare','Epic','Legendary','Ultimate','Mythic'];
  const RKO={Common:'일반',Rare:'희귀',Epic:'에픽',Legendary:'전설',Ultimate:'궁극',Mythic:'신화'};
  const FILES={forge:'ItemAgeDropChancesLibrary.json',skills:'SkillSummonConfig.json',mounts:'MountSummonConfig.json',eggs:'EggSummonConfig.json'};
  function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
  const cfgv=(ver,file)=>`${RAW}/parsed_configs/${ver}/${file}`;
  const pct=v=>num(v)*100;
  const diffLine=(base,target,fmtFn=v=>fmt(v))=>{
    if(base==null)return '';
    const d=target-base;if(Math.abs(d)<1e-12)return `<div class="muted small">비교버전과 동일</div>`;
    return `<div class="small" style="color:${d>0?'var(--green)':'var(--red)'}">${d>0?'+':''}${fmtFn(d)} 변화</div>`;
  };
  async function baseDropsV9(){
    const e=$('#app'),versions=await j(`${RAW}/parsed_configs/versions.json`),st=S.baseDrops;
    if(!versions.includes(st.version))st.version=versions[0]||VER;if(!versions.includes(st.baseVersion))st.baseVersion=versions[1]||st.version;
    async function render(){
      const tab=st.tab,file=FILES[tab],[target,base]=await Promise.all([j(cfgv(st.version,file)),st.compare?j(cfgv(st.baseVersion,file)):Promise.resolve(null)]);
      let max=1;if(tab==='forge')max=Object.keys(target||{}).length;else max=target?.Levels?.length||1;st.level=Math.max(1,Math.min(max,Math.floor(num(st.level,1))));
      let body='';
      if(tab==='forge'){
        const tr=target[String(st.level-1)]||{},br=base?.[String(st.level-1)]||null;
        body=`<div class="panel"><h2>대장간 Lv.${st.level} 시대 드랍 확률</h2><div class="cards">${AGE.map((a,i)=>{const tv=num(tr['Age'+i]),bv=br?num(br['Age'+i]):null;return `<div class="card"><b>${a}</b><div class="sum">${tv?fmt(tv*100)+'%':'-'}</div>${st.compare?diffLine(bv*100,tv*100,v=>fmt(v)+'%'):''}</div>`}).join('')}</div></div>`;
      }else{
        const tr=target.Levels?.[st.level-1]||{},br=base?.Levels?.[st.level-1]||null;
        const tc=(target.Levels||[]).slice(0,st.level).reduce((a,x)=>a+num(x.SummonsRequired),0),bc=base?(base.Levels||[]).slice(0,st.level).reduce((a,x)=>a+num(x.SummonsRequired),0):null;
        body=`<div class="panel grid g3"><div class="metric"><small>현재 레벨 필요 소환</small><b>${fmt(tr.SummonsRequired||0)}</b>${st.compare?diffLine(num(br?.SummonsRequired),num(tr.SummonsRequired)):''}</div><div class="metric"><small>Lv.1~${st.level} 누적 소환</small><b>${fmt(tc)}</b>${st.compare?diffLine(bc,tc):''}</div><div class="metric"><small>단일 소환 비용</small><b>${fmt(target.SingleSummonCost?.Amount||0)}</b></div></div><div class="panel"><h2>등급 확률</h2><div class="grid g3">${RARS.map(r=>{const tv=num(tr[r]),bv=br?num(br[r]):null;return `<div class="metric"><small>${RKO[r]}</small><b>${fmt(tv*100)}%</b>${st.compare?diffLine(bv*100,tv*100,v=>fmt(v)+'%'):''}</div>`}).join('')}</div></div>`;
      }
      e.innerHTML=`<div class="hero"><span class="chip">BASE DROPS</span><h1>기본 드랍 / 소환 확률</h1><p class="muted">1vcian과 같은 버전별 원본 설정을 읽어 대장간·스킬·탈것·알 확률을 비교합니다.</p></div>
      <div class="panel"><div class="tabs" id="bdtabs">${[['forge','대장간'],['skills','스킬'],['mounts','탈것'],['eggs','알']].map(([k,n])=>`<button data-tab="${k}" class="${tab===k?'active':''}">${n}</button>`).join('')}</div><div class="grid g3"><label class="field"><span>현재 버전</span><select id="bdver">${versions.map(v=>`<option value="${v}" ${v===st.version?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>버전 비교</span><select id="bdcmp"><option value="0" ${!st.compare?'selected':''}>사용 안 함</option><option value="1" ${st.compare?'selected':''}>사용</option></select></label>${st.compare?`<label class="field"><span>비교 기준 버전</span><select id="bdbase">${versions.map(v=>`<option value="${v}" ${v===st.baseVersion?'selected':''}>${v}</option>`).join('')}</select></label>`:''}</div><label class="field" style="margin-top:10px"><span>${tab==='forge'?'대장간':'소환'} 레벨 ${st.level}/${max}</span><input id="bdlvl" type="range" min="1" max="${max}" value="${st.level}"></label></div>${body}`;
      $('#bdtabs').onclick=ev=>{const b=ev.target.closest('[data-tab]');if(b){st.tab=b.dataset.tab;st.level=1;save();render()}};
      e.onchange=ev=>{if(ev.target.id==='bdver')st.version=ev.target.value;if(ev.target.id==='bdcmp')st.compare=ev.target.value==='1';if(ev.target.id==='bdbase')st.baseVersion=ev.target.value;save();render()};
      $('#bdlvl').oninput=ev=>{st.level=+ev.target.value;save();render()}
    }
    render()
  }
  async function configsV9(){
    const e=$('#app'),manifest=await j(`${RAW}/parsed_configs/config_manifest.json`),versions=Object.keys(manifest).sort().reverse(),st=S.configBrowser;
    if(!versions.includes(st.version))st.version=versions[0]||VER;
    function fileList(){const q=String(st.filter||'').toLowerCase();return (manifest[st.version]||[]).filter(x=>x.toLowerCase().includes(q))}
    async function render(){
      let files=fileList();if(!files.includes(st.file))st.file=files[0]||manifest[st.version]?.[0]||'';let data=null,err='';
      if(st.file)try{data=await j(cfgv(st.version,st.file))}catch(x){err=String(x.message||x)}
      let raw=data?JSON.stringify(data,null,2):err;
      if(raw.length>120000)raw=raw.slice(0,120000)+'\\n\\n... 화면 보호를 위해 120,000자에서 잘랐습니다.';
      e.innerHTML=`<div class="hero"><span class="chip">RAW CONFIG</span><h1>게임 설정 브라우저</h1><p class="muted">2.9.0 및 과거 버전의 파싱된 게임 설정 JSON을 직접 확인합니다.</p></div><div class="panel grid g3"><label class="field"><span>버전</span><select id="cv">${versions.map(v=>`<option value="${v}" ${v===st.version?'selected':''}>${v}</option>`).join('')}</select></label><label class="field"><span>파일 검색</span><input id="cf" value="${esc(st.filter)}" placeholder="GuildWar, Pet, Skill..."></label><label class="field"><span>설정 파일</span><select id="cfile">${files.map(f=>`<option value="${esc(f)}" ${f===st.file?'selected':''}>${esc(f)}</option>`).join('')}</select></label></div><div class="panel"><h2>${esc(st.file)}</h2><pre style="white-space:pre-wrap;overflow:auto;max-height:70vh;font-family:ui-monospace,monospace;font-size:11px;line-height:1.45;background:#09101a;padding:12px;border-radius:10px">${esc(raw)}</pre></div>`;
      e.onchange=ev=>{if(ev.target.id==='cv'){st.version=ev.target.value;st.file=''}if(ev.target.id==='cfile')st.file=ev.target.value;save();render()};
      $('#cf').oninput=ev=>{st.filter=ev.target.value;save();clearTimeout(configsV9._t);configsV9._t=setTimeout(render,180)}
    }
    render()
  }
  pages.basedrops=baseDropsV9;
  pages.configs=configsV9;
  addNav('도감','basedrops','🎯','기본 드랍');
  initNav();go((location.hash||'#/home').slice(2)||'home')
})();