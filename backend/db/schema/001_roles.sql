create table if not exists roles (
  role_code text primary key,
  role_name text not null,
  description text not null default '',
  is_system_role boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into roles (
  role_code,
  role_name,
  description,
  is_system_role,
  display_order
) values
  ('ADMIN', '管理者', '管理メニューと一般メニューを利用できます', true, 10),
  ('ACCOUNTING', '経理', '経理メニューを利用できます', true, 20),
  ('ADMIN_ACCOUNTING', '管理者兼経理', '管理者と経理の全機能を利用できます', true, 30),
  ('USER', '一般ユーザ', '一般メニューを利用できます', true, 40)
on conflict (role_code) do update set
  role_name = excluded.role_name,
  description = excluded.description,
  is_system_role = excluded.is_system_role,
  display_order = excluded.display_order,
  updated_at = now();
