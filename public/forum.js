// Diễn đàn dùng chung qua Supabase
let me=null,openPost=null;
const ago=d=>{const m=Math.round((Date.now()-new Date(d))/6e4);return m<1?'vừa xong':m<60?m+' phút trước':m<1440?Math.round(m/60)+' giờ trước':Math.round(m/1440)+' ngày trước'};
async function loadForum(){
  const{data:{user}}=await sb.auth.getUser();me=user;
  const{data,error}=await sb.from('posts').select('id,user_id,author,title,body,created_at').order('created_at',{ascending:false}).limit(50);
  if(error)return $('f-list').innerHTML='<p class="sub">Chưa tải được diễn đàn: '+esc(error.message)+'. Hãy chắc chắn đã chạy schema.sql.</p>';
  $('f-list').innerHTML=data.length?data.map(p=>`<button class="post" data-id="${p.id}"><b>${esc(p.title)}</b><small>${esc(p.author)} • ${ago(p.created_at)}</small></button>`).join(''):'<p class="sub">Chưa có bài nào. Hãy đặt câu hỏi đầu tiên!</p>';
  window._posts=Object.fromEntries(data.map(p=>[p.id,p]));
}
$('f-list').onclick=e=>{const b=e.target.closest('.post');if(b)showPost(+b.dataset.id)};
async function showPost(id){
  openPost=window._posts[id];go('s-post');
  const p=openPost;$('p-body').innerHTML=`<h2>${esc(p.title)}</h2><small class="sub">${esc(p.author)} • ${ago(p.created_at)}</small><p>${esc(p.body).replace(/\n/g,'<br>')}</p>`+(me&&me.id===p.user_id?'<button class="mini" id="p-del">Xóa bài</button>':'');
  const d=$('p-del');if(d)d.onclick=async()=>{if(confirm('Xóa bài này?')){await sb.from('posts').delete().eq('id',p.id);go('s-forum');loadForum()}};
  loadComments();
}
async function loadComments(){
  const{data}=await sb.from('comments').select('*').eq('post_id',openPost.id).order('created_at');
  $('c-list').innerHTML=(data||[]).map(c=>`<div class="bub bot"><b>${esc(c.author)}</b> <small>${ago(c.created_at)}</small><br>${esc(c.body).replace(/\n/g,'<br>')}</div>`).join('')||'<p class="sub">Chưa có trả lời.</p>';
}
async function myName(){const{data}=await sb.from('profiles').select('display_name').eq('id',me.id).maybeSingle();return(data&&data.display_name)||'Bạn học'}
$('c-send').onclick=async()=>{
  const t=$('c-in').value.trim();if(!t)return;
  const{error}=await sb.from('comments').insert({post_id:openPost.id,user_id:me.id,author:await myName(),body:t});
  if(!error){$('c-in').value='';loadComments()}
};
$('f-new').onclick=()=>go('s-newpost');
$('n-send').onclick=async()=>{
  const title=$('n-title').value.trim(),body=$('n-body').value.trim();
  if(!title||!body)return say('m-new','Hãy nhập cả tiêu đề và nội dung.','err');
  const{error}=await sb.from('posts').insert({user_id:me.id,author:await myName(),title,body});
  if(error)return say('m-new','Lỗi: '+error.message,'err');
  $('n-title').value=$('n-body').value='';say('m-new','');go('s-forum');loadForum();
};
// Cập nhật tức thì khi người khác đăng bài
sb.channel('forum').on('postgres_changes',{event:'*',schema:'public',table:'posts'},()=>{if($('s-forum').classList.contains('on'))loadForum()})
  .on('postgres_changes',{event:'INSERT',schema:'public',table:'comments'},()=>{if($('s-post').classList.contains('on'))loadComments()}).subscribe();
