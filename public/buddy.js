// AI Buddy: chat toán, chụp đề (OCR), micro, nút "=", đọc tiếng Việt
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SYS=`Bạn là Math Buddy, gia sư toán thân thiện cho học sinh Việt Nam. Chỉ trả lời các câu hỏi liên quan đến toán (số học, đại số, hình học, xác suất, giải tích...). Nếu câu hỏi ngoài toán, nhẹ nhàng mời bạn quay lại chủ đề toán. Trả lời bằng tiếng Việt, giải từng bước, ngắn gọn dễ hiểu. Viết công thức bằng ký hiệu đơn giản: x^2, sqrt(x), a/b, dấu =, không dùng LaTeX hay ký tự $. Khi cần dùng thuật ngữ tiếng Anh, bọc trong {{en:từ}}, ví dụ {{en:vector}}. Với ảnh đề bài: đọc lại đề (OCR) rồi giải.`;
let hist=[],micOn=false,calcMode=false,rec=null,speaking=false;
const box=$('chat'),inp=$('b-in');
function addMsg(who,html){const d=document.createElement('div');d.className='bub '+who;d.innerHTML=html;box.appendChild(d);box.scrollTop=box.scrollHeight;return d}
function fmt(t){return esc(t).replace(/\*\*(.+?)\*\*/g,'<b>$1</b>').replace(/\{\{en:(.+?)\}\}/g,'$1').replace(/\n/g,'<br>')}

// ---- Gọi Gemini
async function ask(parts){
  hist.push({role:'user',parts});
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${state.model}:generateContent?key=${encodeURIComponent(state.key)}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({systemInstruction:{parts:[{text:SYS}]},contents:hist.slice(-12)})});
  const j=await r.json();if(!r.ok){hist.pop();throw new Error(j.error&&j.error.message||'Lỗi kết nối')}
  const t=(j.candidates&&j.candidates[0].content.parts.map(p=>p.text||'').join(''))||'Mình chưa trả lời được, bạn thử lại nhé.';
  hist.push({role:'model',parts:[{text:t}]});return t;
}
async function reply(parts,shown){
  addMsg('me',shown);const w=addMsg('bot','Đang suy nghĩ...');
  try{const t=await ask(parts);w.innerHTML=fmt(t)+`<div><button class="mini" data-say>🔊 Đọc</button></div>`;w.dataset.raw=t;box.scrollTop=box.scrollHeight}
  catch(e){w.innerHTML='<span style="color:var(--bad)">Lỗi: '+esc(e.message)+'</span>'}
}
box.onclick=e=>{if(e.target.dataset.say!==undefined)speak(e.target.closest('.bub').dataset.raw)};

// ---- Gửi tin / nút "="
async function send(){
  const t=inp.value.trim();if(!t)return;inp.value='';
  if(calcMode){
    try{
      const ex=t.replace(/[−–]/g,'-').replace(/²/g,'^2').replace(/³/g,'^3').replace(/√(\d+(?:[.,]\d+)?|\([^)]*\))/g,'sqrt($1)').replace(/[x×]/g,'*').replace(/÷/g,'/').replace(/,/g,'.').replace(/π/g,'pi');
      const v=math.evaluate(ex);if(typeof v==='function'||v===undefined)throw 0;
      const s=math.format(v,{precision:12});addMsg('me',esc(t)+' =');
      const w=addMsg('bot','<b>= '+esc(s)+'</b><div><button class="mini" data-say>🔊 Đọc</button></div>');w.dataset.raw=t+' = '+s;return;
    }catch(e){} // không tính được: chuyển cho AI
  }
  reply([{text:t}],esc(t));
}
$('b-send').onclick=send;
inp.onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();send()}};
$('b-calc').onclick=()=>{calcMode=!calcMode;$('b-calc').classList.toggle('on',calcMode);inp.placeholder=calcMode?'Nhập phép tính, ví dụ 12*(3+4)/6':'Hỏi bài toán hoặc dán đề...'};

// ---- Chụp / chọn ảnh đề (AI đọc chữ và công thức trong ảnh)
$('b-cam').onclick=()=>$('b-file').click();
$('b-file').onchange=async e=>{
  const f=e.target.files[0];e.target.value='';if(!f)return;
  const img=new Image();img.src=URL.createObjectURL(f);await img.decode();
  const k=Math.min(1,1400/Math.max(img.width,img.height)),c=document.createElement('canvas');
  c.width=img.width*k;c.height=img.height*k;c.getContext('2d').drawImage(img,0,0,c.width,c.height);
  const b64=c.toDataURL('image/jpeg',.85).split(',')[1];
  const note=inp.value.trim();inp.value='';
  reply([{inlineData:{mimeType:'image/jpeg',data:b64}},{text:(note||'Hãy đọc đề trong ảnh rồi giải từng bước.')}],`<img src="${c.toDataURL('image/jpeg',.5)}" class="shot"><br>${esc(note)}`);
};

// ---- Lời nói -> ký hiệu toán (ví dụ "hai cộng ba bằng năm" -> "2 + 3 = 5")
const VD={'không':0,'một':1,'mốt':1,'hai':2,'ba':3,'bốn':4,'tư':4,'năm':5,'lăm':5,'sáu':6,'bảy':7,'bẩy':7,'tám':8,'chín':9};
const VS={'nghìn':1e3,'ngàn':1e3,'triệu':1e6,'tỷ':1e9,'tỉ':1e9};
const isNum=t=>VD[t]!==undefined||VS[t]!==undefined||['mười','mươi','trăm','linh','lẻ'].includes(t);
function numRun(tk){
  const res=[];let total=0,chunk=0,pend=null,tens=false,linh=false,aft=false,has=false;
  const flush=()=>{if(!has)return;let p=pend;if(p!==null&&aft&&!tens&&!linh&&p>0)p*=10;res.push(total+chunk+(p||0));total=chunk=0;pend=null;tens=linh=aft=has=false};
  for(const t of tk){
    if(VD[t]!==undefined){if(pend!==null)flush();pend=VD[t];has=true}
    else if(t==='mười'){chunk+=10;tens=has=true}
    else if(t==='mươi'){chunk+=(pend||0)*10;pend=null;tens=has=true}
    else if(t==='trăm'){chunk+=(pend===null?1:pend)*100;pend=null;aft=has=true}
    else if(t==='linh'||t==='lẻ'){linh=true}
    else if(VS[t]){chunk+=pend||0;total+=(chunk||1)*VS[t];chunk=0;pend=null;aft=tens=linh=false;has=true}
  }
  flush();return res.join(' ');
}
function viToMath(src){
  const w=src.toLowerCase().replace(/phần trăm/g,'phầntrăm').replace(/căn bậc (?:hai|2)(?: của)?/g,'căn').replace(/căn bậc (?:ba|3)(?: của)?/g,'cănba').replace(/căn của/g,'căn').replace(/[.,!?;:]+(?=\s|$)/g,'').split(/\s+/).filter(Boolean).map(t=>t==='ích'?'x':t);
  const out=[];let i=0;
  while(i<w.length){
    if(!isNum(w[i])){out.push(w[i++]);continue}
    let j=i;while(j<w.length&&isNum(w[j]))j++;
    let s=numRun(w.slice(i,j));i=j;
    if((w[i]==='phẩy'||w[i]==='chấm')&&VD[w[i+1]]!==undefined&&s&&!s.includes(' ')){s+=',';i++;while(VD[w[i]]!==undefined){s+=VD[w[i]];i++}}
    out.push(s);
  }
  const O='(?<=[\\d)²³%]|(?:^|\\s|√)[a-zπ])';
  let t=out.join(' ');
  [[/mở ngoặc/g,'('],[/đóng ngoặc/g,')'],
   [/(\d+)\s+(?:phẩy|chấm)\s+(\d+)/g,'$1,$2'],[/cănba\s*(?=\()/g,'³√'],[/căn\s*(?=\()/g,'√'],[/cănba\s+(\d+(?:[.,]\d+)?|[a-z])/g,'³√$1'],[/căn\s+(\d+(?:[.,]\d+)?|[a-z])/g,'√$1'],
   [/\s+bình phương/g,'²'],[/\s+lập phương/g,'³'],[/\s+mũ\s+(-?\d+|[a-z])/g,'^$1'],
   [/(\d+)\s+phầntrăm/g,'$1%'],[/(\d+|(?<=^|\s)[a-z])\s+phần\s+(\d+|[a-z]\b)/g,'$1/$2'],
   [new RegExp(O+'\\s+lớn hơn hoặc bằng\\s+','g'),' ≥ '],[new RegExp(O+'\\s+nhỏ hơn hoặc bằng\\s+','g'),' ≤ '],
   [new RegExp(O+'\\s+lớn hơn\\s+','g'),' > '],[new RegExp(O+'\\s+nhỏ hơn\\s+','g'),' < '],
   [new RegExp(O+'\\s+khác\\s+(?=[\\d(a-z√])','g'),' ≠ '],[new RegExp(O+'\\s+bằng\\s+(?!nhau)','g'),' = '],
   [/=\s+bao nhiêu/g,'= ?'],[/\s+cộng\s+/g,' + '],[/\s+trừ\s+/g,' − '],
   [/\s+nhân\s+(?!tử|đôi|đạo|viên)/g,' × '],[/\s+chia\s+(?!hết|đều|sẻ|cho)/g,' ÷ '],
   [/(^|\s)âm\s+(?=[\d(a-z√])/g,'$1−'],[/\bpi\b/g,'π'],[/vô cực/g,'∞'],
   [/(\d)\s+([a-z])(?=\s|$|[²³^+−×÷=<>≤≥)])/g,'$1$2'],[/\(\s+/g,'('],[/\s+\)/g,')'],[/\s+/g,' ']
  ].forEach(([a,b])=>t=t.replace(a,b));
  return t.trim();
}

// ---- Micro: không tự ngắt cho đến khi người dùng bấm tắt
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
function startRec(){
  rec=new SR();rec.lang='vi-VN';rec.continuous=true;rec.interimResults=true;
  let typed='',spoken='';
  rec.onstart=()=>{typed=inp.value?inp.value.trim()+' ':'';spoken=''};
  rec.onresult=e=>{let fin='',tmp='';for(let i=e.resultIndex;i<e.results.length;i++){(e.results[i].isFinal?fin+=e.results[i][0].transcript:tmp+=e.results[i][0].transcript)}
    if(fin)spoken+=fin+' ';inp.value=typed+viToMath(spoken+tmp)};
  rec.onerror=e=>{if(e.error==='not-allowed'||e.error==='service-not-allowed'){micOn=false;mark();alert('Hãy cho phép trình duyệt dùng micro.')}};
  rec.onend=()=>{if(micOn)setTimeout(()=>{try{startRec()}catch(e){}},150)}; // tự bật lại khi trình duyệt ngắt
  rec.start();
}
function mark(){$('b-mic').classList.toggle('on',micOn);$('b-mic').textContent=micOn?'⏹':'🎤'}
$('b-mic').onclick=()=>{
  if(!SR)return alert('Trình duyệt này chưa hỗ trợ nhận giọng nói. Hãy dùng Chrome hoặc Edge.');
  micOn=!micOn;mark();if(micOn)startRec();else if(rec)rec.stop();
};

// ---- Đọc tiếng Việt: chuyển công thức thành lời, từ tiếng Anh đọc bằng giọng Anh
function mathToSpeech(t){
  const R=[[/\\frac\{([^}]*)\}\{([^}]*)\}/g,' $1 phần $2 '],[/\\sqrt\{([^}]*)\}/g,' căn bậc hai của $1 '],[/\\cdot|\\times/g,' nhân '],[/\\le(q)?/g,' nhỏ hơn hoặc bằng '],[/\\ge(q)?/g,' lớn hơn hoặc bằng '],[/\\pi/g,' pi '],
  [/\s\*\s/g,' nhân '],[/[$\\{}]/g,' '],[/[*#`_]{1,3}/g,' '],
  [/sqrt\(([^)]*)\)/g,' căn bậc hai của $1 '],[/cbrt\(([^)]*)\)/g,' căn bậc ba của $1 '],
  [/²/g,' bình phương '],[/³/g,' lập phương '],[/\^2\b/g,' bình phương '],[/\^3\b/g,' lập phương '],[/\^\(?(-?[\w.]+)\)?/g,' mũ $1 '],
  [/(\d),(\d)/g,'$1 phẩy $2'],[/(\d)\.(\d)/g,'$1 phẩy $2'],
  [/≤|<=/g,' nhỏ hơn hoặc bằng '],[/≥|>=/g,' lớn hơn hoặc bằng '],[/≠|!=/g,' khác '],[/π/g,' pi '],[/∞/g,' vô cực '],[/√/g,' căn bậc hai của '],
  [/(\d+)\s*%/g,'$1 phần trăm'],[/\s*=\s*/g,' bằng '],[/\s*[×·]\s*|(?<=[\w)])\s\*\s(?=[\w(])/g,' nhân '],[/\s*÷\s*/g,' chia '],
  [/(?<=[\w)])\s*\/\s*(?=[\w(])/g,' chia '],[/(?<=[\w)])\s*\+\s*(?=[\w(])/g,' cộng '],[/(?<=[\w)])\s+[-−–]\s+(?=[\w(])/g,' trừ '],[/(?<=[\w)])[-−](?=[\w(])/g,' trừ '],
  [/(?<![\w)])[-−](?=\d)/g,' âm '],[/</g,' nhỏ hơn '],[/>/g,' lớn hơn '],[/[()[\]]/g,' , ']];
  R.forEach(([a,b])=>t=t.replace(a,b));return t.replace(/\s+/g,' ').trim();
}
function pickVoice(l){const v=speechSynthesis.getVoices();return v.find(x=>x.lang===l)||v.find(x=>x.lang.startsWith(l.slice(0,2)))}
function speak(raw){
  if(!('speechSynthesis' in window))return alert('Trình duyệt chưa hỗ trợ đọc văn bản.');
  speechSynthesis.cancel();
  raw.split(/(\{\{en:.+?\}\})/).forEach(seg=>{
    const en=seg.match(/^\{\{en:(.+?)\}\}$/);const txt=en?en[1]:mathToSpeech(seg);if(!txt)return;
    const u=new SpeechSynthesisUtterance(txt);u.lang=en?'en-US':'vi-VN';u.rate=.95;
    const v=pickVoice(u.lang);if(v)u.voice=v;speechSynthesis.speak(u);
  });
}
$('b-stop').onclick=()=>speechSynthesis.cancel();
speechSynthesis&&(speechSynthesis.onvoiceschanged=()=>{});
addMsg('bot','Chào bạn! Mình là Math Buddy 👋 Hãy gõ câu hỏi, chụp ảnh đề bài, hoặc bấm 🎤 để nói. Bấm <b>=</b> nếu chỉ cần tính nhanh một phép tính.');
