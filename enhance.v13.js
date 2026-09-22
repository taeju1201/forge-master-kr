(function(){
S.savedProfiles=Array.isArray(S.savedProfiles)?S.savedProfiles:[];
S.profileCompare=Object.assign({a:0,b:1},S.profileCompare||{});
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
function snap(name){
  return{name:name||('백업 '+new Date().toLocaleString()),created:Date.now(),data:{
    name:S.name,fairy:structuredClone(S.fairy),loadout:structuredClone(S.loadout),techTree:structuredClone(S.techTree),clanTech:structuredClone(S.clanTech),resources:structuredClone(S.resources),war:structuredClone(S.war),
    forgeLevel:S.forgeLevel||1,summonCalc:structuredClone(S.summonCalc||{}),eggPlan:structuredClone(S.eggPlan||{}),clanPlan:structuredClone(S.clanPlan||{})
  }}
}
function applyData(d){
  if(!d)return;for(const k of ['fairy','loadout','techTree','clanTech','resources','war','summonCalc','eggPlan','clanPlan'])if(d[k]!=null)S[k]=structuredClone(d[k]);
  if(d.name!=null)S.name=d.name;if(d.forgeLevel!=null)S.forgeLevel=d.forgeLevel;globalThis.__fmAggregateSecondary?.()
}
async function statFor(s){
  const old=snap('__tmp__').data;
  try{applyData(s.data);return await globalThis.__fmProfileCompute()}finally{applyData(old)}
}
pages.profilemanager=async function(){
  const e=$('#app'),st=S.profileCompare;
  async function render(){
    let comp='';
    if(S.savedProfiles.length>=2){
      st.a=Math.max(0,Math.min(S.savedProfiles.length-1,num(st.a,0)));st.b=Math.max(0,Math.min(S.savedProfiles.length-1,num(st.b,1)));
      const [a,b]=await Promise.all([statFor(S.savedProfiles[st.a]),statFor(S.savedProfiles[st.b])]);
      const line=(nm,x,y,unit='')=>`<div class="metric"><small>${nm}</small><b>${fmt(x)}${unit} → ${fmt(y)}${unit}</b><div class="small" style="color:${y>=x?'var(--green)':'var(--red)'}">${y-x>=0?'+':''}${fmt(y-x)}${unit}</div></div>`;
      comp=`<div class="panel"><h2>두 빌드 비교</h2><div class="grid g2"><label class="field"><span>A</span><select id="pcA">${S.savedProfiles.map((x,i)=>`<option value="${i}" ${i===st.a?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label><label class="field"><span>B</span><select id="pcB">${S.savedProfiles.map((x,i)=>`<option value="${i}" ${i===st.b?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label></div><div class="grid g3" style="margin-top:10px">${line('피해',a.damage,b.damage)}${line('체력',a.health,b.health)}${line('전투력',a.power,b.power)}${line('총 DPS',a.totalDps,b.totalDps)}${line('치명타',a.critChance*100,b.critChance*100,'%')}${line('공격주기',a.interval,b.interval,'초')}</div></div>`
    }
    e.innerHTML=`<div class="hero"><span class="chip">프로필 관리</span><h1>백업 / 불러오기 / 비교</h1><p class="muted">현재 빌드를 여러 개 저장하고 파일로 내보내거나 불러온 뒤, 종합 피해·체력·전투력·DPS를 서로 비교합니다.</p></div>
    <div class="panel grid g2"><label class="field"><span>백업 이름</span><input id="pbName" placeholder="예: 클랜전 세팅"></label><button class="btn gold" id="pbSave">현재 빌드 저장</button><button class="btn" id="pbExportAll">전체 백업 파일 내보내기</button><label class="btn" style="display:flex;align-items:center;justify-content:center;cursor:pointer">백업 파일 불러오기<input id="pbFile" type="file" accept=".json,application/json" style="display:none"></label></div>
    <div class="cards">${S.savedProfiles.map((x,i)=>`<div class="card"><b>${esc(x.name)}</b><div class="muted small">${new Date(x.created||0).toLocaleString()}</div><div class="grid g2" style="margin-top:8px"><button class="btn gold" data-pb-apply="${i}">적용</button><button class="btn" data-pb-export="${i}">파일 저장</button><button class="btn red" data-pb-del="${i}">삭제</button></div></div>`).join('')||'<div class="muted">저장된 빌드가 없어.</div>'}</div>
    ${comp}`;
    $('#pbSave').onclick=()=>{const n=$('#pbName').value.trim()||('빌드 '+(S.savedProfiles.length+1));S.savedProfiles.push(snap(n));save();render()};
    $('#pbExportAll').onclick=()=>download({type:'ForgeMasterKRBackup',version:1,profiles:S.savedProfiles,current:snap('현재 빌드')},'forge-master-kr-backup.json');
    $('#pbFile').onchange=ev=>{const f=ev.target.files?.[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{try{const d=JSON.parse(fr.result);if(Array.isArray(d.profiles))S.savedProfiles.push(...d.profiles);else if(d.data)S.savedProfiles.push(d);else throw Error('지원하지 않는 백업 형식');save();toast('백업을 불러왔어');render()}catch(err){toast('백업 파일을 읽지 못했어')}};fr.readAsText(f)};
    e.onclick=ev=>{let b=ev.target.closest('[data-pb-apply]');if(b){applyData(S.savedProfiles[+b.dataset.pbApply].data);save();toast('빌드를 적용했어');go('profile');return}b=ev.target.closest('[data-pb-del]');if(b){S.savedProfiles.splice(+b.dataset.pbDel,1);save();render();return}b=ev.target.closest('[data-pb-export]');if(b){const x=S.savedProfiles[+b.dataset.pbExport];download(x,(x.name||'profile').replace(/[\\/:*?"<>|]/g,'_')+'.json')}}
    const a=$('#pcA'),bb=$('#pcB');if(a)a.onchange=ev=>{st.a=+ev.target.value;save();render()};if(bb)bb.onchange=ev=>{st.b=+ev.target.value;save();render()}
  }
  function download(obj,name){const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
  render()
};
addNav('내 정보','profilemanager','💾','프로필 백업·비교');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();