create table if not exists public.demo_requests (
  id bigint generated always as identity primary key,
  created_at timestamp with time zone default now() not null,
  first_name text not null,
  last_name text not null,
  email text not null,
  company text,
  phone text,
  website text,
  stock_level text,
  source text not null,
  language text not null,
  status text not null default 'new'
);

alter table public.demo_requests enable row level security;

create policy "Allow public demo request inserts"
  on public.demo_requests
  for insert
  to anon, authenticated
  with check (true);
