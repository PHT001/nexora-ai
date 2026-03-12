-- =============================================
-- Seora SaaS — Supabase Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL)
-- =============================================

-- 1. PROFILES
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  stripe_customer_id text,
  plan text default 'free',
  plan_status text default 'inactive',
  articles_used integer default 0,
  articles_limit integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "Users read own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Service role full access profiles" on public.profiles for all using (auth.role() = 'service_role');

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. SITES
create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  url text,
  domain text,
  language text default 'fr',
  description text,
  audiences text[] default '{}',
  goals text[] default '{}',
  niche text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.sites enable row level security;
create policy "Users read own sites" on public.sites for select using (auth.uid() = user_id);
create policy "Users insert own sites" on public.sites for insert with check (auth.uid() = user_id);
create policy "Users update own sites" on public.sites for update using (auth.uid() = user_id);
create policy "Service role full access sites" on public.sites for all using (auth.role() = 'service_role');

-- 3. KEYWORDS
create table if not exists public.keywords (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  keyword text not null,
  volume integer default 0,
  difficulty integer default 0,
  position integer,
  trend text default 'stable',
  created_at timestamptz default now()
);

alter table public.keywords enable row level security;
create policy "Users read own keywords" on public.keywords for select using (
  exists (select 1 from public.sites where sites.id = keywords.site_id and sites.user_id = auth.uid())
);
create policy "Service role full access keywords" on public.keywords for all using (auth.role() = 'service_role');

-- 4. ARTICLES
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  keyword_id uuid references public.keywords(id) on delete set null,
  title text,
  content text,
  meta_description text,
  word_count integer default 0,
  seo_score integer default 0,
  article_type text default 'blog',
  status text default 'draft',
  scheduled_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.articles enable row level security;
create policy "Users read own articles" on public.articles for select using (
  exists (select 1 from public.sites where sites.id = articles.site_id and sites.user_id = auth.uid())
);
create policy "Users update own articles" on public.articles for update using (
  exists (select 1 from public.sites where sites.id = articles.site_id and sites.user_id = auth.uid())
);
create policy "Service role full access articles" on public.articles for all using (auth.role() = 'service_role');

-- 5. AUDITS
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sites(id) on delete cascade not null,
  overall_score integer default 0,
  performance_score integer default 0,
  seo_score integer default 0,
  accessibility_score integer default 0,
  best_practices_score integer default 0,
  speed_mobile integer default 0,
  speed_desktop integer default 0,
  fcp numeric(4,1) default 0,
  lcp numeric(4,1) default 0,
  issues jsonb default '[]',
  created_at timestamptz default now()
);

alter table public.audits enable row level security;
create policy "Users read own audits" on public.audits for select using (
  exists (select 1 from public.sites where sites.id = audits.site_id and sites.user_id = auth.uid())
);
create policy "Service role full access audits" on public.audits for all using (auth.role() = 'service_role');

-- 6. SETTINGS
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null unique,
  tone text default 'professionnel',
  article_length text default 'moyen',
  publish_frequency text default 'weekly',
  competitors text[] default '{}',
  brand_name text,
  brand_color text default '#6C5CE7',
  auto_publish boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.settings enable row level security;
create policy "Users read own settings" on public.settings for select using (auth.uid() = user_id);
create policy "Users insert own settings" on public.settings for insert with check (auth.uid() = user_id);
create policy "Users update own settings" on public.settings for update using (auth.uid() = user_id);
create policy "Service role full access settings" on public.settings for all using (auth.role() = 'service_role');

-- =============================================
-- 7. CMS INTEGRATION COLUMNS
-- =============================================

-- Sites: CMS connection info
alter table public.sites add column if not exists cms_type text;
alter table public.sites add column if not exists cms_url text;
alter table public.sites add column if not exists cms_api_key text;
alter table public.sites add column if not exists cms_username text;
alter table public.sites add column if not exists cms_extra jsonb default '{}';
alter table public.sites add column if not exists cms_connected_at timestamptz;

-- Articles: external CMS reference
alter table public.articles add column if not exists cms_post_id text;
alter table public.articles add column if not exists cms_post_url text;
alter table public.articles add column if not exists published_at timestamptz;

-- =============================================
-- DONE! All tables created with RLS policies.
-- =============================================
