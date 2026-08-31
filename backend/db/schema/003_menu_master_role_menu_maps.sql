create table if not exists menu_master (
  menu_id text primary key,
  menu_name text not null,
  menu_category text not null check (menu_category in ('USER', 'ADMIN', 'LEADER', 'ACCOUNTING')),
  menu_path text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by text not null default 'SYSTEM',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'SYSTEM'
);

alter table menu_master
  drop constraint if exists menu_master_menu_category_check;

alter table menu_master
  add constraint menu_master_menu_category_check
  check (menu_category in ('USER', 'ADMIN', 'LEADER', 'ACCOUNTING'));

insert into menu_master (
  menu_id,
  menu_name,
  menu_category,
  menu_path,
  is_active,
  created_by,
  updated_by
) values
  ('ATTENDANCE', '勤務実績', 'USER', '/attendance', true, 'SYSTEM', 'SYSTEM'),
  ('WORK_TIME_SETTING', '通常出勤時間設定', 'USER', '/NormalWorkTimeSettings', true, 'SYSTEM', 'SYSTEM'),
  ('EXPENSE', '経費請求', 'USER', '/ExpenseClaims', true, 'SYSTEM', 'SYSTEM'),
  ('WORK_BILLING', '業務請求明細', 'USER', '/BusinessBillDetails', true, 'SYSTEM', 'SYSTEM'),
  ('SUBMISSION_STATUS', '提出状況', 'LEADER', '/leader', true, 'SYSTEM', 'SYSTEM'),
  ('DASHBOARD', '確定画面', 'ACCOUNTING', '/dashboard', true, 'SYSTEM', 'SYSTEM'),
  ('ATTENDANCE_SETTINGS', '年度設定', 'ACCOUNTING', '/AttendanceSettings', true, 'SYSTEM', 'SYSTEM'),
  ('USER_MANAGEMENT', 'ユーザ管理', 'ADMIN', '/admin/users', true, 'SYSTEM', 'SYSTEM'),
  ('BRANCH_MANAGEMENT', '支店管理', 'ADMIN', '/admin/branches', true, 'SYSTEM', 'SYSTEM'),
  ('ROLE_MANAGEMENT', '権限管理', 'ADMIN', '/admin/roles', true, 'SYSTEM', 'SYSTEM')
on conflict (menu_id) do update set
  menu_name = excluded.menu_name,
  menu_category = excluded.menu_category,
  menu_path = excluded.menu_path,
  is_active = excluded.is_active,
  updated_at = now(),
  updated_by = excluded.updated_by;

create table if not exists role_menu_maps (
  role_id text not null references roles(role_id) on delete cascade,
  menu_id text not null references menu_master(menu_id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text not null default 'SYSTEM',
  updated_at timestamptz not null default now(),
  updated_by text not null default 'SYSTEM',
  primary key (role_id, menu_id)
);

delete from role_menu_maps
where menu_id in ('USER_SEARCH', 'USER_CREATE', 'USER_EDIT');

delete from menu_master
where menu_id in ('USER_SEARCH', 'USER_CREATE', 'USER_EDIT');

insert into role_menu_maps (
  role_id,
  menu_id,
  created_by,
  updated_by
) values
  ('USER', 'ATTENDANCE', 'SYSTEM', 'SYSTEM'),
  ('USER', 'WORK_TIME_SETTING', 'SYSTEM', 'SYSTEM'),
  ('USER', 'EXPENSE', 'SYSTEM', 'SYSTEM'),
  ('USER', 'WORK_BILLING', 'SYSTEM', 'SYSTEM'),
  ('LEADER', 'ATTENDANCE', 'SYSTEM', 'SYSTEM'),
  ('LEADER', 'WORK_TIME_SETTING', 'SYSTEM', 'SYSTEM'),
  ('LEADER', 'EXPENSE', 'SYSTEM', 'SYSTEM'),
  ('LEADER', 'WORK_BILLING', 'SYSTEM', 'SYSTEM'),
  ('LEADER', 'SUBMISSION_STATUS', 'SYSTEM', 'SYSTEM'),
  ('ACCOUNTING', 'ATTENDANCE', 'SYSTEM', 'SYSTEM'),
  ('ACCOUNTING', 'WORK_TIME_SETTING', 'SYSTEM', 'SYSTEM'),
  ('ACCOUNTING', 'EXPENSE', 'SYSTEM', 'SYSTEM'),
  ('ACCOUNTING', 'WORK_BILLING', 'SYSTEM', 'SYSTEM'),
  ('ACCOUNTING', 'DASHBOARD', 'SYSTEM', 'SYSTEM'),
  ('ACCOUNTING', 'ATTENDANCE_SETTINGS', 'SYSTEM', 'SYSTEM'),
  ('ADMIN', 'ATTENDANCE', 'SYSTEM', 'SYSTEM'),
  ('ADMIN', 'WORK_TIME_SETTING', 'SYSTEM', 'SYSTEM'),
  ('ADMIN', 'USER_MANAGEMENT', 'SYSTEM', 'SYSTEM'),
  ('ADMIN', 'BRANCH_MANAGEMENT', 'SYSTEM', 'SYSTEM'),
  ('ADMIN', 'ROLE_MANAGEMENT', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'ATTENDANCE', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'WORK_TIME_SETTING', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'EXPENSE', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'WORK_BILLING', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'DASHBOARD', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'ATTENDANCE_SETTINGS', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'USER_MANAGEMENT', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'BRANCH_MANAGEMENT', 'SYSTEM', 'SYSTEM'),
  ('ADMIN_ACCOUNTING', 'ROLE_MANAGEMENT', 'SYSTEM', 'SYSTEM')
on conflict (role_id, menu_id) do update set
  updated_at = now(),
  updated_by = excluded.updated_by;
