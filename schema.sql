-- =====================================================================
-- AI CLASSROOM — SCHEMA SUPABASE (chạy MỘT LẦN trong Supabase → SQL Editor → New query → Run)
-- An toàn khi chạy lại nhiều lần (idempotent).
-- =====================================================================

-- 1) HỒ SƠ NGƯỜI DÙNG -------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  handle text unique not null,                 -- dạng @ten#1234
  avatar text not null default 'cat',
  school_class text not null default '',
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Tự tạo hồ sơ + mã @tag#xxxx khi có người đăng ký
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare uname text; h text; tries int := 0;
begin
  uname := lower(coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)));
  loop
    h := '@' || uname || '#' || lpad((floor(random()*9000)+1000)::int::text, 4, '0');
    exit when not exists (select 1 from public.profiles where handle = h);
    tries := tries + 1; exit when tries > 30;
  end loop;
  insert into public.profiles (id, username, handle) values (new.id, uname, h);
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Không cho tự đổi username/handle
create or replace function public.protect_profile() returns trigger language plpgsql as $$
begin new.username := old.username; new.handle := old.handle; new.id := old.id; return new; end $$;
drop trigger if exists protect_profile_trg on public.profiles;
create trigger protect_profile_trg before update on public.profiles for each row execute function public.protect_profile();

-- 2) DIỄN ĐÀN ----------------------------------------------------------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  tag text not null default 'Hỏi đáp chung',
  body text not null default '' check (char_length(body) <= 8000),
  images text[] not null default '{}',
  created_at timestamptz not null default now()
);
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  images text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists comments_post_idx on public.comments(post_id, created_at);
create index if not exists posts_created_idx on public.posts(created_at desc);

-- 3) BẠN BÈ & TIN NHẮN ---------------------------------------------------
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);
create unique index if not exists friendships_pair_uq on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 4000),
  image text,
  created_at timestamptz not null default now()
);
create index if not exists messages_pair_idx on public.messages (sender_id, receiver_id, created_at);
create index if not exists messages_recv_idx on public.messages (receiver_id, created_at);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null,
  unique (message_id, user_id, emoji)
);

-- 4) NHẬT KÝ HỌC TẬP (cho trang Ôn tập) ---------------------------------
create table if not exists public.study_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  client_id text not null,
  created_at timestamptz not null default now(),
  topic text, chapter text, kind text, result text, support text, error_label text, source text,
  problem text, solution text,
  unique (user_id, client_id)
);

-- 5) BẢO MẬT HÀNG (Row Level Security) -----------------------------------
alter table public.profiles    enable row level security;
alter table public.posts       enable row level security;
alter table public.comments    enable row level security;
alter table public.friendships enable row level security;
alter table public.messages    enable row level security;
alter table public.reactions   enable row level security;
alter table public.study_logs  enable row level security;

do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='public' and tablename in ('profiles','posts','comments','friendships','messages','reactions','study_logs') loop
    execute format('drop policy if exists %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

-- profiles: thành viên đăng nhập xem được nhau (để tìm bạn, hiện tên bài đăng); chỉ sửa hồ sơ của mình
create policy profiles_select on public.profiles for select to authenticated using (true);
create policy profiles_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- posts / comments
create policy posts_select on public.posts for select to authenticated using (true);
create policy posts_insert on public.posts for insert to authenticated with check (author_id = auth.uid());
create policy posts_delete on public.posts for delete to authenticated using (author_id = auth.uid());
create policy comments_select on public.comments for select to authenticated using (true);
create policy comments_insert on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated using (author_id = auth.uid());

-- friendships
create policy fr_select on public.friendships for select to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());
create policy fr_insert on public.friendships for insert to authenticated with check (requester_id = auth.uid() and status = 'pending');
create policy fr_update on public.friendships for update to authenticated using (addressee_id = auth.uid()) with check (addressee_id = auth.uid() and status = 'accepted');
create policy fr_delete on public.friendships for delete to authenticated using (requester_id = auth.uid() or addressee_id = auth.uid());

-- messages: chỉ nhắn được với người đã là bạn bè
create policy msg_select on public.messages for select to authenticated using (sender_id = auth.uid() or receiver_id = auth.uid());
create policy msg_insert on public.messages for insert to authenticated with check (
  sender_id = auth.uid() and exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and ((f.requester_id = auth.uid() and f.addressee_id = receiver_id) or (f.addressee_id = auth.uid() and f.requester_id = receiver_id))));

-- reactions: chỉ thả cảm xúc trên tin nhắn mà mình nhìn thấy
create policy rx_select on public.reactions for select to authenticated using (exists (select 1 from public.messages m where m.id = message_id));
create policy rx_insert on public.reactions for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.messages m where m.id = message_id));
create policy rx_delete on public.reactions for delete to authenticated using (user_id = auth.uid());

-- study_logs: riêng tư tuyệt đối
create policy sl_all on public.study_logs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 6) KHO ẢNH (Storage) ---------------------------------------------------
insert into storage.buckets (id, name, public) values ('images', 'images', true) on conflict (id) do nothing;
drop policy if exists "images_read" on storage.objects;
drop policy if exists "images_insert" on storage.objects;
drop policy if exists "images_delete" on storage.objects;
create policy "images_read"   on storage.objects for select using (bucket_id = 'images');
create policy "images_insert" on storage.objects for insert to authenticated with check (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "images_delete" on storage.objects for delete to authenticated using (bucket_id = 'images' and (storage.foldername(name))[1] = auth.uid()::text);

-- 7) THỜI GIAN THỰC (Realtime) -------------------------------------------
alter table public.friendships replica identity full;
alter table public.reactions   replica identity full;
do $$ begin
  begin alter publication supabase_realtime add table public.posts;       exception when others then null; end;
  begin alter publication supabase_realtime add table public.comments;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.friendships; exception when others then null; end;
  begin alter publication supabase_realtime add table public.messages;    exception when others then null; end;
  begin alter publication supabase_realtime add table public.reactions;   exception when others then null; end;
end $$;
