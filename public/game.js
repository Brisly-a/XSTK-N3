// Avatar + Trò chơi xúc xắc + lưu kết quả
const AVATARS={cat:['🐱','#ffd29c','#f08a4b'],dog:['🐶','#e9d2b4','#b9814a'],panda:['🐼','#dfe9e8','#7fa7a5'],fox:['🦊','#ffc9a8','#e2693a'],owl:['🦉','#e3d5f2','#8b6bb8'],frog:['🐸','#cdeab5','#59a24a'],lion:['🦁','#ffe29a','#d99a1c'],penguin:['🐧','#cfe6f7','#4a8cc2']};
let myAvatar='cat';
function avatarHTML(k,s=48){const a=AVATARS[k]||AVATARS.cat;return `<span class="av" style="width:${s}px;height:${s}px;font-size:${s*.58}px;background:radial-gradient(circle at 32% 28%,${a[1]},${a[2]});box-shadow:inset 0 -4px 8px rgba(0,0,0,.18),0 2px 6px rgba(0,0,0,.2)">${a[0]}</span>`}
const _enter=enter;
enter=async function(session){
  await _enter(session);if(!session)return;
  const{data}=await sb.from('profiles').select('avatar').eq('id',session.user.id).maybeSingle();
  myAvatar=(data&&data.avatar)||'cat';
  $('hello').innerHTML=`<span id="av-btn" title="Đổi avatar" style="cursor:pointer">${avatarHTML(myAvatar,46)}</span> <span>${$('hello').textContent}</span>`;
  $('av-btn').onclick=()=>{drawAvatars();go('s-avatar')};
};
function drawAvatars(){
  $('av-grid').innerHTML=Object.keys(AVATARS).map(k=>`<button class="avpick ${k===myAvatar?'on':''}" data-k="${k}">${avatarHTML(k,64)}</button>`).join('');
}
$('av-grid').onclick=async e=>{
  const b=e.target.closest('.avpick');if(!b)return;myAvatar=b.dataset.k;drawAvatars();
  const{data:{user}}=await sb.auth.getUser();await sb.from('profiles').update({avatar:myAvatar}).eq('id',user.id);
  const n=$('hello').textContent.trim();$('hello').innerHTML=`<span id="av-btn" style="cursor:pointer">${avatarHTML(myAvatar,46)}</span> <span>${esc(n)}</span>`;$('av-btn').onclick=()=>{drawAvatars();go('s-avatar')};
};

// ---- Xúc xắc SVG
const PIPS={1:[[1,1]],2:[[0,0],[2,2]],3:[[0,0],[1,1],[2,2]],4:[[0,0],[2,0],[0,2],[2,2]],5:[[0,0],[2,0],[1,1],[0,2],[2,2]],6:[[0,0],[2,0],[0,1],[2,1],[0,2],[2,2]]};
let did=0;
function die(n,s=84){const id='d'+(did++),pc=n===1?'#d62839':'#1b1b1f';
  return `<svg class="die" width="${s}" height="${s}" viewBox="0 0 100 100" role="img" aria-label="Xúc xắc ${n}"><defs>
  <linearGradient id="${id}f" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#f1ede4"/><stop offset="1" stop-color="#d4cdbd"/></linearGradient>
  <radialGradient id="${id}p" cx=".35" cy=".3"><stop offset="0" stop-color="#555"/><stop offset="1" stop-color="${pc}"/></radialGradient>
  <filter id="${id}s"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-opacity=".35"/></filter></defs>
  <rect x="7" y="6" width="86" height="86" rx="18" fill="url(#${id}f)" filter="url(#${id}s)"/>
  <rect x="9" y="8" width="82" height="82" rx="16" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2"/>
  ${PIPS[n].map(([x,y])=>`<circle cx="${26+x*24}" cy="${26+y*24}" r="${n===1?11:7.5}" fill="url(#${id}p)"/><circle cx="${24+x*24}" cy="${24+y*24}" r="2" fill="#fff" fill-opacity=".45"/>`).join('')}</svg>`}

// ---- Trò chơi
const G={topic:'Hỗn hợp',round:0,score:0,streak:0,best:0,a:1,b:1,op:'+',ans:0,me:0,bot:0,lock:false,N:10,GOAL:45};
const rnd=n=>1+Math.floor(Math.random()*n);
document.querySelectorAll('[data-topic]').forEach(b=>b.onclick=()=>startGame(b.dataset.topic));
function startGame(t){Object.assign(G,{topic:t,round:0,score:0,streak:0,best:0,me:0,bot:0,lock:false});go('s-play');$('g-end').style.display='none';$('g-main').style.display='block';
  $('g-me').innerHTML=avatarHTML(myAvatar,40);$('g-bot').innerHTML=avatarHTML('owl',40);nextQ()}
const diceRow=(a,b,c)=>die(a,c?70:84)+(c?'':`<b class="opx">${G.op}</b>`)+die(b,c?70:84)+(c?die(c,70):'');
function nextQ(){
  if(G.round>=G.N)return endGame();
  G.round++;G.lock=false;G.a=rnd(6);G.b=rnd(6);
  G.c=0;G.q='';
  G.op=G.topic==='Cộng'?'+':G.topic==='Trừ'?'−':G.topic==='Nhân'?'×':G.topic==='Chia'?'÷':G.topic==='Thử thách'?'3':['+','−','×','÷'][rnd(4)-1];
  if(G.op==='−'&&G.a<G.b)[G.a,G.b]=[G.b,G.a];
  if(G.op==='3'){G.c=rnd(6);const o=rnd(2)===1?'+':'−';if(o==='−'&&G.a+G.b*0<G.b*G.c){G.a=G.b*G.c+rnd(3)}G.o=o;G.q=`${G.a} ${o} ${G.b} × ${G.c}`;G.ans=o==='+'?G.a+G.b*G.c:G.a-G.b*G.c}
  else if(G.op==='÷'){G.q=`${G.a*G.b} ÷ ${G.b}`;G.ans=G.a}
  else{G.q=`${G.a} ${G.op} ${G.b}`;G.ans=G.op==='+'?G.a+G.b:G.op==='−'?G.a-G.b:G.a*G.b}
  $('g-dice').classList.add('roll');$('g-q').textContent='Đang gieo xúc xắc...';$('g-opts').innerHTML='';
  let f=0;const t=setInterval(()=>{$('g-dice').innerHTML=diceRow(rnd(6),rnd(6),G.c?rnd(6):0);if(++f>7){clearInterval(t);show()}},80);
}
function show(){
  $('g-dice').classList.remove('roll');$('g-dice').innerHTML=diceRow(G.a,G.b,G.c);
  $('g-q').textContent=`${G.q} = ?`;
  const s=new Set([G.ans]);while(s.size<4){const d=G.ans+rnd(9)-5;if(d>=0)s.add(d)}
  $('g-opts').innerHTML=[...s].sort(()=>Math.random()-.5).map(v=>`<button class="opt" data-v="${v}">${v}</button>`).join('');
  hud();
}
function hud(){$('g-info').textContent=`Câu ${G.round}/${G.N}  •  Điểm ${G.score}  •  Chuỗi đúng ${G.streak}`;
  $('g-fme').style.width=Math.min(100,G.me/G.GOAL*100)+'%';$('g-fbot').style.width=Math.min(100,G.bot/G.GOAL*100)+'%'}
$('g-opts').onclick=e=>{
  const b=e.target.closest('.opt');if(!b||G.lock)return;G.lock=true;const ok=+b.dataset.v===G.ans;
  document.querySelectorAll('.opt').forEach(o=>{if(+o.dataset.v===G.ans)o.classList.add('good')});
  if(ok){G.score++;G.streak++;G.best=Math.max(G.best,G.streak);G.me+=G.a+G.b+G.c;$('g-q').textContent='Chính xác! 🎉'}else{b.classList.add('bad');G.streak=0;$('g-q').textContent=`Chưa đúng. ${G.q} = ${G.ans}`}
  G.bot+=Math.random()<.7?rnd(6)+rnd(6):0;hud();setTimeout(nextQ,1300);
};
async function endGame(){
  $('g-main').style.display='none';$('g-end').style.display='block';
  const win=G.me>G.bot?'Bạn thắng cuộc đua! 🏆':G.me<G.bot?'Cú Mèo về trước, thử lại nhé!':'Hòa nhau!';
  $('g-res').innerHTML=`<h2>${win}</h2><p>Đúng <b>${G.score}/${G.N}</b> câu • Chuỗi đúng dài nhất <b>${G.best}</b></p><p class="sub" id="g-save">Đang lưu kết quả...</p>`;
  const{data:{user}}=await sb.auth.getUser();
  const{error}=await sb.from('study_results').insert({user_id:user.id,topic:G.topic,correct:G.score,total:G.N});
  $('g-save').textContent=error?'Chưa lưu được kết quả: '+error.message:'Đã lưu vào mục Ôn tập.';
}
$('g-again').onclick=()=>startGame(G.topic);
