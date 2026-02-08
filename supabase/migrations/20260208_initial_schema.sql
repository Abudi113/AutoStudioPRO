
-- Create a table for user profiles
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  credits integer default 5,
  created_at timestamp with time zone default now() not null,
  primary key (id)
);

-- Turn on Row Level Security
alter table public.profiles enable row level security;

-- Create policies
create policy "Public profiles are viewable by everyone."
  on profiles for select
  using ( true );

create policy "Users can update their own profile."
  on profiles for update
  using ( auth.uid() = id );

-- Create a trigger to create a profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, credits)
  values (new.id, new.email, 5);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Create a secure function to deduct credits
create or replace function public.deduct_credit()
returns boolean
language plpgsql
security definer
as $$
declare
  current_credits integer;
begin
  -- Get current credits for the user
  select credits into current_credits from public.profiles where id = auth.uid();
  
  if current_credits > 0 then
    update public.profiles
    set credits = credits - 1
    where id = auth.uid();
    return true;
  else
    return false;
  end if;
end;
$$;
