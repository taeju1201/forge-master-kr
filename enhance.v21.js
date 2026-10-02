(function(){
S.opponentWatch=Object.assign({records:[]},S.opponentWatch||{});
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
function uniqRows(rows){
 const seen=new Set(),out=[];
 for(const r of rows){
  const k=[r.opponent_name,r.opponent_tag,r.opponent_tier,r.opponent_server,r.host_ts||r.ts].join('|');
  if(!r.opponent_name||seen.has(k))continue;seen.add(k);out.push(r)
 }
 return out.sort((a,b)=>String(b.host_ts||b.ts||'').localeCompare(String(a.host_ts||a.ts||'')))
}
pages.opponentwatch=async function(){
 const e=$('#app');
 function render(){
  const rows=uniqRows(S.opponentWatch.records||[]),last=rows[0]||null;
  e.innerHTML=`<div class="hero"><span class="chip">상대 배정 감지</span><h1>다음 클랜전 상대 감지</h1><p class="muted">클랜 이름을 미리 추측하는 기능이 아니라, 게임 서버가 새 상대를 배정하는 순간 GuildWarManager에서 정확한 이름/태그/티어를 읽어오는 기능입니다.</p></div>
  <div class="notice"><b>확인된 구조</b><br>Metaplay의 NextParticipantIdx는 “다음 상대”가 아니라 새 참가자에게 부여할 다음 숫자 인덱스입니다. 그래서 상대 예측에 사용하지 않습니다. 정확한 상대 이름은 서버가 새 Guild War Division을 배정한 뒤에만 클라이언트에 생깁니다.</div>
  <div class="panel grid g2"><label class="btn gold" style="display:flex;align-items:center;justify-content:center;cursor:pointer">감지 결과 JSONL 불러오기<input id="owFile" type="file" accept=".jsonl,.json,application/json,text/plain" style="display:none"></label><button class="btn" id="owClear">불러온 기록 초기화</button></div>
  ${last?`<div class="panel"><h2>최근 배정 상대</h2><div class="grid g4"><div class="metric"><small>클랜</small><b class="sum">${esc(last.opponent_name||'-')}</b></div><div class="metric"><small>태그</small><b>[${esc(last.opponent_tag||'-')}]</b></div><div class="metric"><small>티어</small><b>${last.opponent_tier??'-'}</b></div><div class="metric"><small>서버</small><b>${esc(last.opponent_server||'-')}</b></div><div class="metric"><small>감지 시각</small><b>${esc(last.host_ts||last.ts||'-')}</b></div><div class="metric"><small>현재 일차</small><b>${last.current_day??'-'}</b></div><div class="metric"><small>우리 참가자 인덱스</small><b>${last.participant_index??'-'}</b></div><div class="metric"><small>상태</small><b>${last.sitting_out?'이번 전쟁 불참':'배정 감지됨'}</b></div></div></div>`:'<div class="panel muted">아직 불러온 상대 배정 기록이 없어. PC에서 tools/FM_NEXT_OPPONENT_WATCH.bat를 실행한 뒤 생성된 FM_NEXT_OPPONENT_RESULT.jsonl을 불러오면 돼.</div>'}
  <div class="panel"><h2>배정 이력</h2><div class="cards">${rows.map((r,i)=>`<div class="card"><b>#${i+1} ${esc(r.opponent_name||'')}</b><div class="muted small">[${esc(r.opponent_tag||'')}] · Tier ${r.opponent_tier??'-'} · ${esc(r.opponent_server||'')}</div><div class="small" style="margin-top:6px">${esc(r.host_ts||r.ts||'')}</div></div>`).join('')||'<div class="muted">기록 없음</div>'}</div></div>
  <div class="panel"><h2>PC 감지기</h2><div class="muted small">저장소 <code>tools/</code> 폴더의 <b>FM_NEXT_OPPONENT_WATCH.bat</b> 실행 → 게임 서버가 상대를 배정하면 자동 저장 → 생성된 JSONL을 이 화면에서 불러오기.</div></div>`;
  $('#owClear').onclick=()=>{S.opponentWatch.records=[];save();render()};
  $('#owFile').onchange=ev=>{const f=ev.target.files?.[0];if(!f)return;const fr=new FileReader();fr.onload=()=>{try{const txt=String(fr.result||''),rows=[];for(const line of txt.split(/\r?\n/)){const s=line.trim();if(!s)continue;try{const o=JSON.parse(s);if(o?.type==='opponent_assigned')rows.push(o)}catch{}}if(!rows.length){const o=JSON.parse(txt);if(Array.isArray(o))for(const x of o)if(x?.type==='opponent_assigned')rows.push(x);else if(o?.type==='opponent_assigned')rows.push(o)}S.opponentWatch.records.push(...rows);save();toast(rows.length+'개 배정 기록 불러옴');render()}catch(err){toast('파일을 읽지 못했어')}};fr.readAsText(f)}
 }
 render()
};
addNav('계산','opponentwatch','🔭','상대 배정 감지');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();