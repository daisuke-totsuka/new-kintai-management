# Cursor Codex Implementation Instructions: normal_work_time_settings

## Goal

Align the implementation with the latest `normal_work_time_settings` database definition and the current normal work time setting specification used by the attendance submission flow.

## Latest DDL

Use the following DDL as the source of truth for the existing Supabase table. This is an ALTER migration, not a CREATE TABLE migration.

```sql
create extension if not exists pgcrypto;

alter table public.normal_work_time_settings
    drop constraint if exists uq_normal_work_time_user;

alter table public.normal_work_time_settings
    alter column user_id type text;

alter table public.normal_work_time_settings
    rename column work_start_time to start_time;

alter table public.normal_work_time_settings
    rename column work_end_time to end_time;

alter table public.normal_work_time_settings
    add column effective_from_day integer not null default 1,
    add column effective_to_day integer not null default 31;

alter table public.normal_work_time_settings
    alter column id set default upper('N' || left(replace(gen_random_uuid()::text, '-', ''), 19));

alter table public.normal_work_time_settings
    alter column created_at set default now();

alter table public.normal_work_time_settings
    alter column updated_at set default now();

alter table public.normal_work_time_settings
    alter column created_by set default 'SYSTEM';

alter table public.normal_work_time_settings
    alter column updated_by set default 'SYSTEM';

alter table public.normal_work_time_settings
    add constraint ck_normal_work_time_day_range
    check (
        effective_from_day between 1 and 31
        and effective_to_day between 1 and 31
        and effective_from_day <= effective_to_day
    );

alter table public.normal_work_time_settings
    add constraint ck_normal_work_time_break_minutes
    check (
        break_minutes >= 0
    );

alter table public.normal_work_time_settings
    add constraint uq_normal_work_time_user_period
    unique (
        user_id,
        effective_from_day,
        effective_to_day
    );

create index if not exists idx_normal_work_time_user_day
on public.normal_work_time_settings
(
    user_id,
    effective_from_day
);
```

## Current Specification

- `normal_work_time_settings` stores normal work time settings per user.
- A user can have multiple rows for different day ranges within a month.
- `effective_from_day` and `effective_to_day` define the applicable day range, from 1 to 31.
- The attendance monthly screen displays normal work time as read-only.
- Editing is performed from the normal work time settings screen.
- Attendance submission validation uses normal work time settings for:
  - E001: normal work time is not configured.
  - E004: start time does not match the applicable normal work time.
  - E005: end time does not match the applicable normal work time.
  - E015: break minutes are shorter than the normal break threshold.
- If multiple settings exist, the applicable row is selected by `effective_from_day <= attendance_day <= effective_to_day`.
- If no row applies to the day but at least one valid setting exists, the backend currently falls back to the first valid setting.
- If no valid normal work time exists, submission validation returns a `normal_work_time` error.

## Required Implementation Tasks

1. Update backend schema file.
   - File: `backend/db/schema/005_attendance.sql`
   - Replace the current `normal_work_time_settings` CREATE definition or add an idempotent migration block so it matches the latest DDL above.
   - Keep existing attendance table definitions unrelated to this task unchanged.

2. Align backend service behavior.
   - File: `backend/services/attendance_monthly_service.py`
   - Confirm that `update_normal_work_time` writes only columns that exist in the latest DDL:
     - `user_id`
     - `effective_from_day`
     - `effective_to_day`
     - `start_time`
     - `end_time`
     - `break_minutes`
     - `updated_at`
   - Add input validation before DB writes:
     - day range must be 1 to 31.
     - `effective_from_day <= effective_to_day`.
     - start/end must be valid HH:mm values.
     - end must be after start for same-day normal work settings.
     - `break_minutes` must be integer >= 0 and less than total minutes.
   - Decide whether to set `updated_by` from `operator_id`. If set, ensure the payload uses the latest DDL column.

3. Align repository behavior.
   - File: `backend/repositories/attendance_repository.py`
   - Keep SELECT by `user_id`.
   - Keep UPDATE by `id`.
   - Do not add DELETE unless the UI/API supports removing settings.
   - If `is_active` remains in the table, decide whether inactive rows should be excluded. Current implementation does not filter `is_active`.

4. Connect normal work time settings screen to API.
   - File: `frontend/app/NormalWorkTimeSettings/ClientPage.tsx`
   - Current screen saves only to local state and logs to console.
   - Implement:
     - GET `/api/attendance/normal-work-time?userId=...`
     - PUT `/api/attendance/normal-work-time`
   - Convert API rows to the current two-section UI model:
     - `until`: `effective_from_day = 1`, `effective_to_day = applyDay`
     - `from`: `effective_from_day = applyDay`, `effective_to_day = 31`
   - Convert the UI model back to API rows:
     - `effectiveFromDay`
     - `effectiveToDay`
     - `startTime`
     - `endTime`
     - `breakMinutes`
   - Preserve auth handling and use `NEXT_PUBLIC_API_URL` consistently with the attendance page.

5. Add or update backend tests.
   - File: `backend/tests/test_attendance.py`
   - Cover:
     - normal work time GET returns `effectiveFromDay`, `effectiveToDay`, `startTime`, `endTime`, `breakMinutes`.
     - PUT updates existing row by `id`.
     - PUT inserts additional period rows.
     - invalid day range returns 400.
     - invalid time or break minutes returns 400.
     - submission validation uses the period matching the attendance day.
     - no valid setting returns E001 / `normal_work_time`.

6. Add or update frontend tests.
   - Prefer adding tests for `frontend/app/NormalWorkTimeSettings/ClientPage.tsx`.
   - Cover:
     - initial GET maps API values into screen fields.
     - save sends PUT payload with two period rows.
     - validation blocks invalid day/time/break values.
   - Review `frontend/tests/components/attendance/AttendancePage.test.tsx` because it is currently date-dependent and expects July 2026 labels while the app defaults to the current month.

## Files Expected To Change

- `backend/db/schema/005_attendance.sql`
- `backend/services/attendance_monthly_service.py`
- `backend/repositories/attendance_repository.py` only if `is_active` filtering is intentionally added
- `backend/tests/test_attendance.py`
- `frontend/app/NormalWorkTimeSettings/ClientPage.tsx`
- frontend tests for the normal work time settings screen
- optionally `docs/attendance_database_design.md`
- optionally `docs/attendance_api_design.md`

## Verification Commands

Run at least:

```powershell
python -m pytest backend/tests/test_attendance.py
npm --prefix frontend test -- run tests/components/attendance/AttendancePage.test.tsx
```

If new normal work time setting screen tests are added, run them directly as well.

## Known Current Test Note

`frontend/tests/components/attendance/AttendancePage.test.tsx` currently has failures unrelated to the DDL because the test expects `2026-07` labels while the app defaults to the current month. Stabilize the test date or update expectations before treating those failures as regressions from this task.
