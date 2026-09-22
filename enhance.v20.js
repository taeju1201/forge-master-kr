(function(){
S.emblem=Object.assign({shape:0,icon:0,bg:0,fg:8},S.emblem||{});
S.chatColor=Object.assign({text:'Forge Master KR',start:'#FC672A',end:'#FFD700',mode:'chars'},S.chatColor||{});
function addNav(group,id,icon,name){const g=nav.find(x=>x[0]===group);if(g&&!g[1].some(x=>x[0]===id))g[1].push([id,icon,name])}
const IMG_CACHE={};
function loadImg(url){if(IMG_CACHE[url])return IMG_CACHE[url];IMG_CACHE[url]=new Promise((res,rej)=>{const im=new Image();im.crossOrigin='anonymous';im.onload=()=>res(im);im.onerror=()=>rej(Error('이미지 로드 실패: '+url));im.src=url});return IMG_CACHE[url]}
function drawCell(ctx,img,cols,rows,index,hex,scale,offsetY,size){
 const cw=img.width/cols,ch=img.height/rows,col=((index%(cols*rows))+cols*rows)%(cols*rows)%cols,row=Math.floor((((index%(cols*rows))+cols*rows)%(cols*rows))/cols),edge=Math.round(size*scale),dx=Math.round((size-edge)/2),dy=Math.round((size-edge)/2+size*offsetY);
 const s=document.createElement('canvas');s.width=edge;s.height=edge;const x=s.getContext('2d');if(!x)return;
 x.drawImage(img,col*cw,row*ch,cw,ch,0,0,edge,edge);x.globalCompositeOperation='multiply';x.fillStyle=hex;x.fillRect(0,0,edge,edge);x.globalCompositeOperation='destination-in';x.drawImage(img,col*cw,row*ch,cw,ch,0,0,edge,edge);ctx.drawImage(s,dx,dy)
}
async function drawEmblem(){
 const canvas=$('#emblemCanvas');if(!canvas)return;const [sh,ic,ho]=await Promise.all([loadImg(`${GTEX}/EmblemShapes.png`),loadImg(`${GTEX}/EmblemIcons.png`),loadImg(`${GTEX}/EmblemHolder.png`)]),colors=await j(`${CFG}/GuildEmblemColors.json`),bg=Object.values(colors).find(x=>x.ColorId===num(S.emblem.bg))?.HexCode||'#FC672A',fg=Object.values(colors).find(x=>x.ColorId===num(S.emblem.fg))?.HexCode||'#FFFFFF',ctx=canvas.getContext('2d'),size=canvas.width;ctx.clearRect(0,0,size,size);drawCell(ctx,sh,4,4,num(S.emblem.shape),bg,.75,.0625,size);drawCell(ctx,ic,8,8,num(S.emblem.icon),fg,.5,0,size);drawCell(ctx,ho,1,1,0,fg,1,-.375,size)
}
pages.emblems=async function(){
 const e=$('#app'),colors=await j(`${CFG}/GuildEmblemColors.json`),bg=Object.values(colors).filter(x=>x.ColorType==='Background'),fg=Object.values(colors).filter(x=>x.ColorType==='Foreground');
 e.innerHTML=`<div class="hero"><span class="chip">클랜 문양</span><h1>문양 디자이너</h1><p class="muted">게임의 실제 EmblemShapes / EmblemIcons / EmblemHolder와 GuildEmblemColors를 사용해 문양을 합성합니다.</p></div>
 <div class="grid g2"><div class="panel" style="text-align:center"><canvas id="emblemCanvas" width="256" height="256" style="width:min(256px,80vw);height:auto"></canvas><div class="grid g2" style="margin-top:10px"><button class="btn" id="emRandom">랜덤</button><button class="btn gold" id="emSave">PNG 저장</button></div><div class="muted small" style="margin-top:8px">패턴 #${S.emblem.shape} · 심볼 #${S.emblem.icon}</div></div>
 <div><div class="panel"><h2>패턴 색상</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${bg.map(x=>`<button data-em-bg="${x.ColorId}" title="${x.HexCode}" style="width:44px;height:44px;border-radius:50%;border:${S.emblem.bg===x.ColorId?'3px solid white':'1px solid var(--line)'};background:${x.HexCode}"></button>`).join('')}</div><h2 style="margin-top:14px">심볼/홀더 색상</h2><div style="display:flex;gap:8px;flex-wrap:wrap">${fg.map(x=>`<button data-em-fg="${x.ColorId}" title="${x.HexCode}" style="width:44px;height:44px;border-radius:50%;border:${S.emblem.fg===x.ColorId?'3px solid white':'1px solid var(--line)'};background:${x.HexCode}"></button>`).join('')}</div></div></div></div>
 <div class="panel"><h2>패턴 16종</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:8px">${Array.from({length:16},(_,i)=>`<button class="btn" data-em-shape="${i}" style="height:72px;padding:3px;border:${S.emblem.shape===i?'2px solid var(--gold)':'1px solid var(--line)'}"><div style="width:60px;height:60px;margin:auto;${spriteStyle(`${GTEX}/EmblemShapes.png`,i,4,256,60)}"></div></button>`).join('')}</div></div>
 <div class="panel"><h2>심볼 64종</h2><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(56px,1fr));gap:6px">${Array.from({length:64},(_,i)=>`<button class="btn" data-em-icon="${i}" style="height:62px;padding:2px;border:${S.emblem.icon===i?'2px solid var(--gold)':'1px solid var(--line)'}"><div style="width:52px;height:52px;margin:auto;${spriteStyle(`${GTEX}/EmblemIcons.png`,i,8,256,52)}"></div></button>`).join('')}</div></div>`;
 e.onclick=ev=>{let b=ev.target.closest('[data-em-shape]');if(b){S.emblem.shape=+b.dataset.emShape;save();pages.emblems();return}b=ev.target.closest('[data-em-icon]');if(b){S.emblem.icon=+b.dataset.emIcon;save();pages.emblems();return}b=ev.target.closest('[data-em-bg]');if(b){S.emblem.bg=+b.dataset.emBg;save();pages.emblems();return}b=ev.target.closest('[data-em-fg]');if(b){S.emblem.fg=+b.dataset.emFg;save();pages.emblems();return}};
 $('#emRandom').onclick=()=>{S.emblem.shape=Math.floor(Math.random()*16);S.emblem.icon=Math.floor(Math.random()*64);S.emblem.bg=bg[Math.floor(Math.random()*bg.length)].ColorId;S.emblem.fg=fg[Math.floor(Math.random()*fg.length)].ColorId;save();pages.emblems()};
 $('#emSave').onclick=()=>{const a=document.createElement('a');a.download='forge-master-clan-emblem.png';a.href=$('#emblemCanvas').toDataURL('image/png');a.click()};
 await drawEmblem()
};
function hexRgb(h){h=h.replace('#','');return[parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]}
function rgbHex(a){return'#'+a.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('').toUpperCase()}
pages.colors=async function(){
 const e=$('#app'),st=S.chatColor;
 function generate(){
  const text=st.text||'',tokens=st.mode==='words'?text.split(/(\s+)/):[...text],colored=tokens.filter(x=>!/^\s+$/.test(x)),a=hexRgb(st.start),b=hexRgb(st.end),steps=Math.max(1,colored.length),out=[],preview=[];let ci=0;
  for(const t of tokens){if(/^\s+$/.test(t)){out.push(t);preview.push(t);continue}const q=steps<=1?0:ci/(steps-1),col=rgbHex(a.map((v,i)=>v+(b[i]-v)*q));out.push('<#'+col.slice(1)+'%>'+t);preview.push('<span style="color:'+col+'">'+esc(t)+'</span>');ci++}
  return{code:out.join(''),preview:preview.join('')}
 }
 function render(){
  const g=generate();e.innerHTML=`<div class="hero"><span class="chip">인게임 채팅</span><h1>텍스트 그라데이션</h1><p class="muted">1vcian의 색상 코드 방식처럼 문자/단어별 &lt;#HEX%&gt; 코드를 생성합니다.</p></div>
  <div class="panel grid g2"><label class="field"><span>텍스트</span><input id="ctxt" value="${esc(st.text)}"></label><label class="field"><span>모드</span><select id="cmode"><option value="chars" ${st.mode==='chars'?'selected':''}>글자별</option><option value="words" ${st.mode==='words'?'selected':''}>단어별</option></select></label><label class="field"><span>시작색</span><input id="cstart" type="color" value="${st.start}"></label><label class="field"><span>끝색</span><input id="cend" type="color" value="${st.end}"></label></div>
  <div class="panel"><h2>미리보기</h2><div style="font-size:26px;word-break:break-all">${g.preview}</div></div>
  <div class="panel"><h2>게임 코드</h2><textarea id="ccode" readonly style="width:100%;min-height:130px;background:#09101a;color:white;border:1px solid var(--line);border-radius:10px;padding:10px">${esc(g.code)}</textarea><button class="btn gold" id="ccopy" style="width:100%;margin-top:8px">코드 복사</button></div>`;
  e.oninput=ev=>{if(ev.target.id==='ctxt')st.text=ev.target.value;if(ev.target.id==='cstart')st.start=ev.target.value;if(ev.target.id==='cend')st.end=ev.target.value;save();render()};$('#cmode').onchange=ev=>{st.mode=ev.target.value;save();render()};$('#ccopy').onclick=()=>navigator.clipboard.writeText(g.code).then(()=>toast('복사했어')).catch(()=>toast('복사 권한이 없어'))
 }
 render()
};
addNav('정보','emblems','🛡️','클랜 문양');
addNav('정보','colors','🎨','채팅 색상');
initNav();go((location.hash||'#/home').slice(2)||'home');
})();