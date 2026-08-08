create table if not exists attendance_monthly_headers (
  id character varying(20) not null,
  user_id text not null,
  target_year integer not null,
  target_month integer not null,
  status character varying(20) not null default 'draft'::character varying,
  updated_at timestamp with time zone not null default now(),
  updated_by character varying(20) not null,
  created_at timestamptz not null default now(),
  created_by character varying(20) not null,
  constraint attendance_monthly_headers_pkey primary key (id),
  constraint uq_attendance_month unique (user_id, target_year, target_month)
);

alter table attendance_monthly_headers
  alter column user_id type text;

create index if not exists idx_attendance_month_user
  on attendance_monthly_headers using btree (user_id, target_year, target_month);

create table if not exists attendance_daily_records (
  id character varying(20) not null,
  monthly_header_id character varying(20) not null,
  attendance_day integer not null,
  start_time time,
  end_time time,
  break_minutes integer,
  work_type_code character varying(20),
  work_description text,
  late_early_minutes numeric(4, 1),
  actual_work_minutes integer,
  midnight_minutes integer,
  created_at timestamptz not null default now(),
  created_by character varying(20) not null,
  updated_at timestamptz not null default now(),
  updated_by character varying(20) not null,
  constraint attendance_daily_records_pkey primary key (id),
  constraint uq_daily_record unique (monthly_header_id, attendance_day)
);

create index if not exists idx_daily_header
  on attendance_daily_records using btree (monthly_header_id);

create table if not exists attendance_summaries (
  monthly_header_id character varying(20) primary key references attendance_monthly_headers(id) on delete cascade,
  total_work_days numeric(5, 1) not null default 0,
  normal_work_days numeric(5, 1) not null default 0,
  holiday_work_days numeric(5, 1) not null default 0,
  absence_days numeric(5, 1) not null default 0,
  paid_leave_days numeric(5, 1) not null default 0,
  total_actual_work_minutes integer not null default 0,
  late_early_minutes numeric(6, 1) not null default 0,
  midnight_minutes integer not null default 0
);

create table if not exists attendance_validation_results (
  id uuid primary key default gen_random_uuid(),
  monthly_header_id character varying(20) not null references attendance_monthly_headers(id) on delete cascade,
  attendance_day integer,
  field text,
  code text not null,
  severity text not null check (severity in ('error', 'warning')),
  message text not null,
  created_at timestamptz not null default now()
);

create table if not exists work_type_masters (
  code text primary key,
  display_name text not null,
  sort_order integer not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into work_type_masters (code, display_name, sort_order, is_active) values
  ('休出', '休出', 10, true),
  ('有休', '有休', 20, true),
  ('前休', '前休', 30, true),
  ('後休', '後休', 40, true),
  ('特休', '特休', 50, true),
  ('振休', '振休', 60, true),
  ('振予', '振予', 70, true),
  ('欠勤', '欠勤', 80, true),
  ('遅刻', '遅刻', 90, true),
  ('早退', '早退', 100, true),
  ('遅延', '遅延', 110, true),
  ('ｼﾌﾄ', 'ｼﾌﾄ', 120, true),
  ('休業', '休業', 130, true)
on conflict (code) do update set
  display_name = excluded.display_name,
  sort_order = excluded.sort_order,
  is_active = excluded.is_active,
  updated_at = now();

create table if not exists holiday_masters (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null unique,
  holiday_name text not null,
  holiday_flag integer not null default 2,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists workday_override_masters (
  id uuid primary key default gen_random_uuid(),
  work_date date not null unique,
  override_type text not null,
  holiday_flag integer not null default 4,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create extension if not exists pgcrypto;

create table if not exists normal_work_time_settings (
  id character varying(20) not null default upper(
    (
      'N'::text || "left" (
        replace((gen_random_uuid ())::text, '-'::text, ''::text),
        19
      )
    )
  ),
  user_id text not null,
  start_time time without time zone not null,
  end_time time without time zone not null,
  break_minutes integer not null,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  created_by character varying(20) not null default 'SYSTEM'::character varying,
  updated_at timestamp with time zone not null default now(),
  updated_by character varying(20) not null default 'SYSTEM'::character varying,
  effective_from_day integer not null default 1,
  effective_to_day integer not null default 31,
  constraint normal_work_time_settings_pkey primary key (id),
  constraint uq_normal_work_time_user_period
    unique (user_id, effective_from_day, effective_to_day),
  constraint ck_normal_work_time_break_minutes
    check (break_minutes >= 0),
  constraint ck_normal_work_time_day_range check (
    effective_from_day between 1 and 31
    and effective_to_day between 1 and 31
    and effective_from_day <= effective_to_day
  )
);

create index if not exists idx_normal_work_time_user
  on normal_work_time_settings using btree (user_id);

create index if not exists idx_normal_work_time_user_day
  on normal_work_time_settings using btree (user_id, effective_from_day);
