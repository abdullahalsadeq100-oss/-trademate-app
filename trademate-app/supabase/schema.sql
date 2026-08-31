-- TradeMate Ireland — Supabase schema
-- Run this in your Supabase project's SQL editor (Project → SQL Editor → New query).

create extension if not exists "pgcrypto";

-- ---------- Businesses ----------
create table if not exists businesses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  slug text not null unique,
  area text,
  lat double precision,
  lng double precision,
  services text[] default '{}',
  blurb text default '',
  job_seq integer not null default 0,
  created_at timestamptz not null default now()
);

alter table businesses enable row level security;

-- Anyone can browse the public directory
create policy "businesses are publicly readable"
  on businesses for select
  using (true);

-- Only the owner can create/update/delete their own business
create policy "owners manage their business"
  on businesses for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ---------- Leads (jobs) ----------
create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  job_no text not null,
  name text not null,
  phone text not null,
  address text not null,
  problem text not null,
  has_photos boolean default false,
  channel text default 'web',
  status text not null default 'new', -- new | quoted | booked | invoiced | paid
  messages jsonb not null default '[]',
  quote jsonb,
  booking jsonb,
  invoice jsonb,
  created_at timestamptz not null default now()
);

alter table leads enable row level security;
create index if not exists leads_business_id_idx on leads(business_id);
create unique index if not exists leads_job_no_idx on leads(job_no);

-- Business owners can see and manage only their own leads
create policy "owners manage their leads"
  on leads for all
  using (business_id in (select id from businesses where owner_id = auth.uid()))
  with check (business_id in (select id from businesses where owner_id = auth.uid()));

-- No direct public SELECT/UPDATE on leads — the public interacts only
-- through the SECURITY DEFINER functions below, which check identity
-- (job number + phone) before returning or changing anything.

-- ---------- Public function: submit a new enquiry ----------
create or replace function create_lead(
  p_business_id uuid,
  p_name text,
  p_phone text,
  p_address text,
  p_problem text,
  p_has_photos boolean,
  p_channel text default 'web'
) returns leads
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slug text;
  v_next int;
  v_job_no text;
  v_lead leads;
begin
  update businesses set job_seq = job_seq + 1
    where id = p_business_id
    returning slug, job_seq into v_slug, v_next;

  if v_slug is null then
    raise exception 'Business not found';
  end if;

  v_job_no := v_slug || '-' || lpad(v_next::text, 4, '0');

  insert into leads (business_id, job_no, name, phone, address, problem, has_photos, channel, status)
  values (p_business_id, v_job_no, p_name, p_phone, p_address, p_problem, p_has_photos, p_channel, 'new')
  returning * into v_lead;

  return v_lead;
end;
$$;

grant execute on function create_lead to anon, authenticated;

-- ---------- Public function: check job status ----------
create or replace function get_job_status(p_job_no text, p_phone text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads;
  v_business businesses;
begin
  select * into v_lead from leads
    where upper(job_no) = upper(p_job_no)
      and regexp_replace(phone, '\D', '', 'g') = regexp_replace(p_phone, '\D', '', 'g')
    limit 1;

  if v_lead.id is null then
    return null;
  end if;

  select * into v_business from businesses where id = v_lead.business_id;

  return jsonb_build_object('lead', to_jsonb(v_lead), 'business', jsonb_build_object('name', v_business.name));
end;
$$;

grant execute on function get_job_status to anon, authenticated;

-- ---------- Public function: customer replies to a message ----------
create or replace function add_customer_reply(p_lead_id uuid, p_phone text, p_message text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  select phone into v_phone from leads where id = p_lead_id;

  if v_phone is null or regexp_replace(v_phone, '\D', '', 'g') <> regexp_replace(p_phone, '\D', '', 'g') then
    raise exception 'Phone number does not match this job';
  end if;

  update leads
    set messages = messages || jsonb_build_array(jsonb_build_object('role', 'customer', 'text', p_message, 'time', now()))
    where id = p_lead_id;
end;
$$;

grant execute on function add_customer_reply to anon, authenticated;

-- ---------- Public function: confirm payment after returning from Stripe ----------
-- Deliberately returns only paid/total/business name, not the full lead —
-- this is called from the post-payment redirect, before we'd want to ask
-- the customer for their phone number again.
create or replace function get_payment_confirmation(p_job_no text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lead leads;
  v_business businesses;
begin
  select * into v_lead from leads where upper(job_no) = upper(p_job_no) limit 1;
  if v_lead.id is null then
    return null;
  end if;
  select * into v_business from businesses where id = v_lead.business_id;
  return jsonb_build_object(
    'business_name', v_business.name,
    'paid', coalesce((v_lead.invoice->>'paid')::boolean, false),
    'total', v_lead.invoice->>'total'
  );
end;
$$;

grant execute on function get_payment_confirmation to anon, authenticated;
