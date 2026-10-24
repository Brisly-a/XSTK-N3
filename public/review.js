// Ôn tập: biểu đồ kết quả học + nhận xét từ AI
let RV=[];
const pct=(c,t)=>t?Math.round(c/t*100):0;
async function loadReview(){
  const{data:{user}}=await sb.auth.getUser();
  const{data,error}=await sb.from('study_results').select('*').eq('user_id',user.id).order('created_at').limit(300);
  if(error){$('rv-body').innerHTML='<p class="sub">Không tải được: '+esc(error.message)+'</p>';return}
  RV=data;if(!RV.length){$('rv-body').innerHTML='<div class="card"><h2>Chưa có dữ liệu</h2><p class="sub">Chơi một ván ở mục Trò chơi để xem biểu đồ tiến bộ của bạn.</p><button class="btn" data-go="s-games">Chơi ngay</button></div>';$('rv-body').querySelector('[data-go]').onclick=()=>go('s-games');return}
  const C=RV.reduce((a,r)=>a+r.correct,0),T=RV.reduce((a,r)=>a+r.total,0);
  const topics={};RV.forEach(r=>{const t=topics[r.topic]||(topics[r.topic]={c:0,t:0,n:0});t.c+=r.correct;t.t+=r.total;t.n++});
  const names=Object.keys(topics),weak=names.sort((a,b)=>pct(topics[a].c,topics[a].t)-pct(topics[b].c,topics[b].t))[0];
  $('rv-body').innerHTML=`
  <div class="stats"><div><b>${RV.length}</b><span>ván đã chơi</span></div><div><b>${pct(C,T)}%</b><span>tỉ lệ đúng</span></div><div><b>${C}</b><span>câu đúng</span></div><div><b>${T-C}</b><span>câu sai</span></div></div>
  <div class="card"><h2>Tỉ lệ đúng theo chủ đề</h2>${barChart(names,topics)}</div>
  <div class="card"><h2>Tiến bộ qua các ván gần đây</h2>${lineChart(RV.slice(-12))}</div>
  <div class="card"><h2>Tổng quan đúng và sai</h2>${donut(C,T-C)}</div>
  <div class="card"><h2>Gợi ý</h2><p>Chủ đề cần luyện thêm: <b>${esc(weak)}</b> (${pct(topics[weak].c,topics[weak].t)}% đúng).</p>
  <button class="btn" id="rv-practice">Luyện chủ đề ${esc(weak)}</button>
  <button class="btn2" id="rv-ai">Nhờ AI nhận xét</button><div class="msg" id="rv-ai-out" style="font-size:15px"></div></div>`;
  $('rv-practice').onclick=()=>startGame(weak);
  $('rv-ai').onclick=async()=>{
    say('rv-ai-out','AI đang xem kết quả...');
    const sum=names.map(n=>`${n}: ${topics[n].c}/${topics[n].t} đúng`).join('; ');
    try{const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${encodeURIComponent(state.key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{parts:[{text:`Học sinh vừa chơi game toán xúc xắc (phép cộng, trừ, nhân với số từ 1 đến 6). Kết quả: ${sum}. Hãy nhận xét ngắn gọn, khích lệ bằng tiếng Việt và gợi ý 3 cách ôn tập cụ thể. Không dùng ký tự đặc biệt như * hoặc #.`}]}]})});
      const j=await r.json();if(!r.ok)throw new Error(j.error&&j.error.message);$('rv-ai-out').className='msg';$('rv-ai-out').innerHTML=esc(j.candidates[0].content.parts[0].text).replace(/\n/g,'<br>')}
    catch(e){say('rv-ai-out','Lỗi: '+e.message,'err')}
  };
}
function barChart(names,t){
  const w=420,h=40*names.length+10;
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Biểu đồ cột tỉ lệ đúng">`+names.map((n,i)=>{const p=pct(t[n].c,t[n].t),y=i*40+6;
   return `<text x="0" y="${y+16}" font-size="13" fill="var(--ink)">${esc(n)}</text><rect x="80" y="${y}" width="270" height="22" rx="11" fill="var(--line)"/><rect x="80" y="${y}" width="${Math.max(4,2.7*p)}" height="22" rx="11" fill="${p>=70?'var(--ok)':p>=40?'var(--acc)':'var(--bad)'}"/><text x="360" y="${y+16}" font-size="13" font-weight="700" fill="var(--ink)">${p}%</text><text x="80" y="${y+34}" font-size="10" fill="var(--mute)">${t[n].n} ván • ${t[n].c}/${t[n].t} câu</text>`}).join('')+'</svg>';
}
function lineChart(rows){
  const w=420,h=190,L=34,B=24,pts=rows.map((r,i)=>[L+(rows.length>1?i*(w-L-14)/(rows.length-1):(w-L)/2),10+(h-B-10)*(1-pct(r.correct,r.total)/100),pct(r.correct,r.total)]);
  const grid=[0,50,100].map(v=>{const y=10+(h-B-10)*(1-v/100);return `<line x1="${L}" x2="${w-6}" y1="${y}" y2="${y}" stroke="var(--line)"/><text x="0" y="${y+4}" font-size="11" fill="var(--mute)">${v}%</text>`}).join('');
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="Biểu đồ đường tiến bộ">${grid}<polyline fill="none" stroke="var(--pri)" stroke-width="3" stroke-linejoin="round" points="${pts.map(p=>p[0]+','+p[1]).join(' ')}"/>${pts.map((p,i)=>`<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="var(--pri)"/><text x="${p[0]}" y="${h-6}" font-size="10" text-anchor="middle" fill="var(--mute)">${i+1}</text>`).join('')}</svg><p class="sub" style="margin:0;font-size:12px">Trục ngang: thứ tự ván chơi, từ cũ đến mới.</p>`;
}
function donut(ok,bad){
  const T=ok+bad,r=52,c=2*Math.PI*r,a=c*ok/T;
  return `<div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap"><svg viewBox="0 0 140 140" width="140" role="img" aria-label="Biểu đồ tròn đúng sai"><circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--bad)" stroke-width="20"/><circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--ok)" stroke-width="20" stroke-dasharray="${a} ${c-a}" transform="rotate(-90 70 70)"/><text x="70" y="76" text-anchor="middle" font-size="22" font-weight="800" fill="var(--ink)">${pct(ok,T)}%</text></svg><div><p style="margin:4px 0"><span class="dot" style="background:var(--ok)"></span>Đúng: <b>${ok}</b></p><p style="margin:4px 0"><span class="dot" style="background:var(--bad)"></span>Sai: <b>${bad}</b></p></div></div>`;
}
