update menu_master
set
  menu_name = 'ユーザ管理',
  updated_at = now(),
  updated_by = 'SYSTEM'
where menu_id = 'USER_MANAGEMENT'
  and menu_name in ('ユーザ' || '画面', 'User' || ' Screen');
