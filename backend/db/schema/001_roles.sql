create table if not exists roles (
  role_id text primary key,
  role_name text not null,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text not null default 'SYSTEM',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'SYSTEM'
);

insert into roles (
  role_id,
  role_name,
  description,
  is_active,
  created_by,
  updated_by
) values
  ('ADMIN', 'Admin', 'Can use admin and general menus.', true, 'SYSTEM', 'SYSTEM'),
  ('ACCOUNTING', 'Accounting', 'Can use accounting menus.', true, 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'Admin Accounting', 'Can use admin, accounting, and general menus.', true, 'SYSTEM', 'SYSTEM'),
  ('LEADER', 'Leader', 'Can use leader menus.', true, 'SYSTEM', 'SYSTEM'),
  ('USER', 'User', 'Can use general menus.', true, 'SYSTEM', 'SYSTEM')
on conflict (role_id) do update set
  role_name = excluded.role_name,
  description = excluded.description,
  is_active = excluded.is_active,
  updated_at = now(),
  updated_by = excluded.updated_by;
