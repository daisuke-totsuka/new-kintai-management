from pathlib import Path

from app import app
from api.attendance import attendance as attendance_api
from services import attendance_monthly_service
from services.attendance_validation_service import AttendanceValidationService
from services.holiday_service import HolidayCalendarService


USER_ID = "0000000001"
OTHER_USER_ID = "0000000002"
UUID_USER_ID = "550e8400-e29b-41d4-a716-446655440000"
EMPLOYEE_ID = "U001"
TWENTY_CHAR_OPERATOR_ID = "EMP00000000000000012"
TOO_LONG_OPERATOR_ID = "EMP000000000000000123"
WORK_TYPE_ROWS = [
    ("HOLIDAY_WORK", "休出"),
    ("PAID_LEAVE", "有休"),
    ("AM_LEAVE", "前休"),
    ("PM_LEAVE", "後休"),
    ("SPECIAL_LEAVE", "特休"),
    ("COMP_LEAVE", "振休"),
    ("COMP_PLAN", "振予"),
    ("ABSENCE", "欠勤"),
    ("LATE", "遅刻"),
    ("EARLY", "早退"),
    ("DELAY", "遅延"),
    ("SHIFT", "ｼﾌﾄ"),
    ("SUSPENSION", "休業"),
]
ACTIVE_WORK_TYPES = [name for _, name in WORK_TYPE_ROWS]


def _day(value):
    text = str(value)
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return int(text[8:10])
    return int(value)


class FakeAttendanceRepository:
    def __init__(self):
        self.headers = []
        self.records = []
        self.summaries = {}
        self.validation_results = {}
        self.work_types = [
            {"work_type_code": code, "work_type_name": name, "is_active": True}
            for code, name in WORK_TYPE_ROWS
        ]
        self.normal = [
            {
                "id": "n1",
                "user_id": USER_ID,
                "effective_from_day": 1,
                "effective_to_day": 31,
                "start_time": "09:00",
                "end_time": "18:00",
                "break_minutes": 60,
                "created_by": "SYSTEM",
                "updated_by": "SYSTEM",
                "updated_at": "2026-07-01T00:00:00+00:00",
            }
        ]

    def find_header(self, user_id, target_year, target_month):
        for header in self.headers:
            header_year = header.get("target_year", header.get("targetYear"))
            header_month = header.get("target_month", header.get("targetMonth"))
            if header["user_id"] == user_id and header_year == target_year and header_month == target_month:
                return dict(header)
        return None

    def create_header(self, header):
        row = dict(header)
        row["id"] = row.get("id") or f"h{len(self.headers) + 1}"
        row["updated_at"] = row.get("updated_at") or "2026-07-01T00:00:00+00:00"
        self.headers.append(row)
        return dict(row)

    def update_header(self, header_id, data):
        for index, header in enumerate(self.headers):
            if header["id"] == header_id:
                self.headers[index] = {**header, **data}
                return dict(self.headers[index])
        return None

    def find_daily_records(self, header_id):
        return [dict(row) for row in self.records if row["monthly_header_id"] == header_id]

    def find_daily_record(self, header_id, attendance_day):
        for row in self.records:
            if row["monthly_header_id"] == header_id and _day(row["attendance_day"]) == _day(attendance_day):
                return dict(row)
        return None

    def create_daily_record(self, record):
        row = dict(record)
        row["id"] = row.get("id") or f"r{len(self.records) + 1}"
        self.records.append(row)
        return dict(row)

    def update_daily_record(self, record_id, record):
        for index, row in enumerate(self.records):
            if row["id"] == record_id:
                self.records[index] = {**row, **record}
                return dict(self.records[index])
        return None

    def delete_daily_record(self, header_id, attendance_day):
        before = len(self.records)
        self.records = [
            row
            for row in self.records
            if not (row["monthly_header_id"] == header_id and _day(row["attendance_day"]) == _day(attendance_day))
        ]
        return before - len(self.records)

    def find_summary(self, header_id):
        return self.summaries.get(header_id)

    def replace_summary(self, header_id, summary):
        self.summaries[header_id] = dict(summary)
        return dict(summary)

    def find_validation_results(self, header_id):
        return [dict(row) for row in self.validation_results.get(header_id, [])]

    def replace_validation_results(self, header_id, results):
        self.validation_results[header_id] = [dict(row) for row in results]
        return self.find_validation_results(header_id)

    def find_work_types(self):
        return [
            dict(row)
            for row in self.work_types
            if row.get("is_active", True)
        ]

    def find_holidays(self):
        return [{"holiday_date": "2026-07-20", "holiday_name": "祝日", "holiday_flag": 2}]

    def find_workday_overrides(self):
        return []

    def find_normal_work_time_settings(self, user_id):
        return [dict(row) for row in self.normal if row["user_id"] == user_id]

    def create_normal_work_time_setting(self, setting):
        row = dict(setting)
        row["id"] = f"n{len(self.normal) + 1}"
        self.normal.append(row)
        return dict(row)

    def update_normal_work_time_setting(self, setting_id, setting):
        for index, row in enumerate(self.normal):
            if row["id"] == setting_id:
                self.normal[index] = {**row, **setting}
                return dict(self.normal[index])
        return None

    def delete_normal_work_time_setting(self, setting_id, user_id):
        deleted = [row for row in self.normal if row["id"] == setting_id and row["user_id"] == user_id]
        self.normal = [
            row
            for row in self.normal
            if not (row["id"] == setting_id and row["user_id"] == user_id)
        ]
        return [dict(row) for row in deleted]


class FakeUserRepository:
    def find_by_id(self, user_id):
        return {
            "id": user_id,
            "employee_id": EMPLOYEE_ID,
            "name": "山田 太郎",
            "branch_name": "東京本社",
            "role_name": "一般ユーザー",
        }

    def find_by_employee_id(self, employee_id):
        return {
            "employee_id": employee_id,
            "name": "山田 太郎",
            "branch_name": "東京本社",
            "role_name": "一般ユーザ",
        }


def _client(monkeypatch):
    repo = FakeAttendanceRepository()
    monkeypatch.setattr(attendance_monthly_service, "AttendanceRepository", lambda: repo)
    monkeypatch.setattr(attendance_monthly_service, "UserRepository", lambda: FakeUserRepository())
    monkeypatch.setattr(attendance_api, "get_current_user", lambda: {"user_id": USER_ID, "employee_id": EMPLOYEE_ID})
    app.config["TESTING"] = True
    return app.test_client(), repo


def test_monthly_get_and_work_types(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.get(f"/api/attendance/monthly?userId={USER_ID}&targetYear=2026&targetMonth=7")
    work_types_response = client.get("/api/attendance/work-types")

    assert response.status_code == 200
    body = response.get_json()
    assert body["header"]["status"] == "draft"
    assert len(body["rows"]) == 31
    assert body["normalWorkTime"][0]["startTime"] == "09:00"

    assert work_types_response.status_code == 200
    assert work_types_response.get_json()["workTypes"][0] == {
        "code": "ABSENCE",
        "displayName": "欠勤",
    }


def test_work_types_are_listed(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.get("/api/attendance/work-types")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert len(body["workTypes"]) == 13
    assert body["workTypes"][0] == {
        "code": "ABSENCE",
        "displayName": "欠勤",
    }
    assert body["workTypes"][-1] == {
        "code": "SUSPENSION",
        "displayName": "休業",
    }
    assert all("sortOrder" not in item for item in body["workTypes"])


def test_monthly_get_requires_user_id(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.get("/api/attendance/monthly?targetYear=2026&targetMonth=7")

    assert response.status_code == 400
    assert response.get_json()["error"] == "userId is required"


def test_monthly_get_rejects_other_user(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.get(f"/api/attendance/monthly?userId={OTHER_USER_ID}&targetYear=2026&targetMonth=7")

    assert response.status_code == 403


def test_save_changed_rows_and_delete(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "09:00",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "",
                    "workDescription": "作業",
                    "lateEarlyMinutes": "",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert len(repo.records) == 1
    assert repo.records[0]["actual_work_minutes"] == 480
    updated_at = response.get_json()["header"]["updatedAt"]

    delete_response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": updated_at,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "",
                    "endTime": "",
                    "breakMinutes": "",
                    "workTypeCode": "",
                    "workDescription": "",
                    "lateEarlyMinutes": "",
                }
            ],
        },
    )

    assert delete_response.status_code == 200
    assert repo.records == []


def test_save_accepts_uuid_user_id_and_uses_employee_id_for_audit_columns(monkeypatch):
    client, repo = _client(monkeypatch)
    monkeypatch.setattr(
        attendance_api,
        "get_current_user",
        lambda: {"user_id": UUID_USER_ID, "employee_id": EMPLOYEE_ID},
    )

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": UUID_USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "09:00",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "",
                    "workDescription": "作業",
                    "lateEarlyMinutes": "",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert repo.headers[0]["user_id"] == UUID_USER_ID
    assert len(repo.headers[0]["user_id"]) == 36
    assert repo.headers[0]["created_by"] == EMPLOYEE_ID
    assert repo.headers[0]["updated_by"] == EMPLOYEE_ID
    assert repo.records[0]["created_by"] == EMPLOYEE_ID
    assert len(repo.headers[0]["created_by"]) <= 20
    assert len(repo.records[0]["created_by"]) <= 20


def test_save_accepts_twenty_character_operator_id(monkeypatch):
    client, repo = _client(monkeypatch)
    monkeypatch.setattr(
        attendance_api,
        "get_current_user",
        lambda: {"user_id": USER_ID, "employee_id": TWENTY_CHAR_OPERATOR_ID},
    )

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "09:00",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "",
                    "workDescription": "作業",
                    "lateEarlyMinutes": "",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert repo.headers[0]["created_by"] == TWENTY_CHAR_OPERATOR_ID
    assert repo.headers[0]["updated_by"] == TWENTY_CHAR_OPERATOR_ID
    assert len(repo.headers[0]["created_by"]) == 20


def test_save_rejects_operator_id_longer_than_twenty_characters(monkeypatch):
    client, repo = _client(monkeypatch)
    monkeypatch.setattr(
        attendance_api,
        "get_current_user",
        lambda: {"user_id": USER_ID, "employee_id": TOO_LONG_OPERATOR_ID},
    )

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [],
        },
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "operator_id must be 20 characters or less"
    assert repo.headers == []


def test_save_exception_returns_message_and_detail(monkeypatch):
    client, _ = _client(monkeypatch)

    class BrokenService:
        def save_monthly(self, data):
            raise RuntimeError("value too long for type character varying(20)")

    monkeypatch.setattr(attendance_api, "_service", lambda: BrokenService())

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [],
        },
    )

    assert response.status_code == 500
    assert response.get_json() == {
        "message": "保存処理でエラーが発生しました。",
        "detail": "value too long for type character varying(20)",
    }


def test_save_rejects_unknown_work_type(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "09:00",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "未登録",
                    "workDescription": "作業",
                    "lateEarlyMinutes": "",
                }
            ],
        },
    )

    assert response.status_code == 400
    assert repo.records == []
    assert response.get_json()["validationResults"][0]["code"] == "E018"


def test_save_rejects_inactive_work_type(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.work_types.append({
        "work_type_code": "INACTIVE",
        "work_type_name": "無効",
        "is_active": False,
    })

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "09:00",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "INACTIVE",
                    "workDescription": "作業",
                    "lateEarlyMinutes": "",
                }
            ],
        },
    )

    assert response.status_code == 400
    assert repo.records == []
    assert response.get_json()["validationResults"][0]["code"] == "E018"


def test_save_rejects_late_early_minutes_out_of_range(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "09:00",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "",
                    "workDescription": "作業",
                    "lateEarlyMinutes": "1000",
                }
            ],
        },
    )

    assert response.status_code == 400
    assert repo.records == []
    assert response.get_json()["validationResults"][0]["code"] == "E017"


def test_save_accepts_thirty_minute_late_early_minutes(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "09:30",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "LATE",
                    "workDescription": "作業",
                    "lateEarlyMinutes": "30",
                }
            ],
        },
    )

    assert response.status_code == 200
    assert repo.records[0]["late_early_minutes"] == 30.0


def test_conflict_returns_latest_rows_and_conflict_cells(monkeypatch):
    client, repo = _client(monkeypatch)
    header = repo.create_header({
        "user_id": USER_ID,
        "employee_no": EMPLOYEE_ID,
        "employee_name": "山田 太郎",
        "targetYear": 2026,
        "targetMonth": 7,
        "status": "draft",
        "updated_at": "latest",
    })
    repo.create_daily_record({
        "monthly_header_id": header["id"],
        "attendance_day": 1,
        "day_of_week": "水",
        "holiday_flag": 0,
        "start_time": "09:00",
        "end_time": "18:00",
        "break_minutes": 60,
        "actual_work_minutes": 480,
        "work_type_code": "",
        "work_description": "最新",
        "late_early_minutes": None,
        "midnight_minutes": 0,
        "warning_flag": False,
    })

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": "stale",
            "changedRows": [
                {
                    "attendanceDay": 1,
                    "startTime": "10:00",
                    "endTime": "18:00",
                    "breakMinutes": "60",
                    "workTypeCode": "",
                    "workDescription": "入力中",
                    "lateEarlyMinutes": "",
                }
            ],
        },
    )

    assert response.status_code == 409
    body = response.get_json()
    assert body["latestHeader"]["updatedAt"] == "latest"
    assert {"startTime", "workDescription"}.issubset({cell["field"] for cell in body["conflictCells"]})


def test_save_invalid_month_returns_e020_validation_result(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.post(
        "/api/attendance/monthly",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 13,
            "baseUpdatedAt": None,
            "changedRows": [],
        },
    )

    assert response.status_code == 400
    body = response.get_json()
    assert [result["code"] for result in body["validationResults"]] == ["E020"]
    assert body["validationResults"][0]["field"] == "targetMonth"


def test_submit_validation_error_uses_response_field_names_and_keeps_updated_at(monkeypatch):
    client, repo = _client(monkeypatch)
    header = repo.create_header({
        "user_id": USER_ID,
        "employee_no": EMPLOYEE_ID,
        "employee_name": "山田 太郎",
        "targetYear": 2026,
        "targetMonth": 7,
        "status": "draft",
        "updated_at": "base",
    })
    repo.create_daily_record({
        "monthly_header_id": header["id"],
        "attendance_day": 1,
        "day_of_week": "水",
        "holiday_flag": 0,
        "start_time": "10:00",
        "end_time": "18:00",
        "break_minutes": 60,
        "actual_work_minutes": 420,
        "work_type_code": "",
        "work_description": "作業",
        "late_early_minutes": None,
        "midnight_minutes": 0,
        "warning_flag": False,
    })

    response = client.post(
        "/api/attendance/monthly/submit",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": "base",
        },
    )

    assert response.status_code == 400
    body = response.get_json()
    assert body["header"]["updatedAt"] == "base"
    assert repo.find_header(USER_ID, 2026, 7)["updated_at"] == "base"
    e004 = next(result for result in body["validationResults"] if result["code"] == "E004")
    assert e004["field"] == "startTime"


def test_validate_monthly_returns_validation_results(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.post(
        "/api/attendance/monthly/validate",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": None,
        },
    )

    assert response.status_code == 400
    body = response.get_json()
    assert body["success"] is False
    assert len(body["validationResults"]) > 0
    assert repo.find_header(USER_ID, 2026, 7)["status"] == "draft"


def test_submit_success_calculates_midnight_summary_and_status(monkeypatch):
    client, repo = _client(monkeypatch)
    header = repo.create_header({
        "user_id": USER_ID,
        "employee_no": EMPLOYEE_ID,
        "employee_name": "山田 太郎",
        "targetYear": 2026,
        "targetMonth": 7,
        "status": "draft",
        "updated_at": "base",
    })
    weekday_days = [
        item
        for item in HolidayCalendarService(repo).days_for_month(2026, 7)
        if item["holiday_flag"] == 0
    ]
    for item in weekday_days:
        is_midnight_shift = item["attendance_day"] == 1
        repo.create_daily_record({
            "monthly_header_id": header["id"],
            "attendance_day": item["attendance_day"],
            "day_of_week": item["day_of_week"],
            "holiday_flag": item["holiday_flag"],
            "start_time": "21:00" if is_midnight_shift else "09:00",
            "end_time": "06:00" if is_midnight_shift else "18:00",
            "break_minutes": 60,
            "actual_work_minutes": None,
            "work_type_code": "ｼﾌﾄ" if is_midnight_shift else "",
            "work_description": "夜間作業" if is_midnight_shift else "作業",
            "late_early_minutes": None,
            "midnight_minutes": 0,
            "warning_flag": False,
        })

    response = client.post(
        "/api/attendance/monthly/submit",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": "base",
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    midnight_row = next(row for row in body["rows"] if row["attendanceDay"] == 1)
    assert body["success"] is True
    assert body["header"]["status"] == "submitted"
    assert body["header"]["completionLabel"] == "完了*"
    assert midnight_row["actualWorkMinutes"] == 480
    assert midnight_row["midnightMinutes"] == 360
    assert body["summary"]["totalWorkDays"] == float(len(weekday_days))
    assert body["summary"]["totalActualWorkMinutes"] == len(weekday_days) * 480
    assert body["summary"]["midnightMinutes"] == 360


def test_submit_returns_e009_and_keeps_e012_unimplemented(monkeypatch):
    client, repo = _client(monkeypatch)
    header = repo.create_header({
        "user_id": USER_ID,
        "employee_no": EMPLOYEE_ID,
        "employee_name": "山田 太郎",
        "targetYear": 2026,
        "targetMonth": 7,
        "status": "draft",
        "updated_at": "base",
    })
    repo.create_daily_record({
        "monthly_header_id": header["id"],
        "attendance_day": 4,
        "day_of_week": "土",
        "holiday_flag": 1,
        "start_time": None,
        "end_time": None,
        "break_minutes": None,
        "actual_work_minutes": None,
        "work_type_code": "欠勤",
        "work_description": None,
        "late_early_minutes": None,
        "midnight_minutes": 0,
        "warning_flag": False,
    })

    response = client.post(
        "/api/attendance/monthly/submit",
        json={
            "userId": USER_ID,
            "targetYear": 2026,
            "targetMonth": 7,
            "baseUpdatedAt": "base",
        },
    )

    assert response.status_code == 400
    codes = {result["code"] for result in response.get_json()["validationResults"]}
    assert "E009" in codes
    assert "E012" not in codes


def test_holiday_service_applies_substitute_holiday_and_workday_override():
    class HolidayRepo:
        def find_holidays(self):
            return [{"holiday_date": "2026-07-05", "holiday_name": "祝日", "holiday_flag": 2}]

        def find_workday_overrides(self):
            return [{"work_date": "2026-07-07", "override_type": "workday", "holiday_flag": 4}]

    days = HolidayCalendarService(HolidayRepo()).days_for_month(2026, 7)
    by_day = {item["attendance_day"]: item for item in days}

    assert by_day[5]["holiday_flag"] == 2
    assert by_day[6]["holiday_flag"] == 2
    assert by_day[7]["holiday_flag"] == 4


def test_holidays_are_listed(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.get("/api/attendance/holidays?targetYear=2026&targetMonth=7")

    assert response.status_code == 200
    body = response.get_json()
    by_day = {item["attendance_day"]: item for item in body["holidays"]}
    assert body["success"] is True
    assert len(body["holidays"]) == 31
    assert by_day[20]["holiday_flag"] == 2


def test_unlock_returns_validated_or_submitted_to_draft(monkeypatch):
    client, repo = _client(monkeypatch)
    header = repo.create_header({
        "user_id": USER_ID,
        "employee_no": EMPLOYEE_ID,
        "employee_name": "山田 太郎",
        "targetYear": 2026,
        "targetMonth": 7,
        "status": "submitted",
        "updated_at": "base",
        "updated_by": "OLD",
    })
    repo.validation_results[header["id"]] = [{
        "code": "E006",
        "severity": "error",
        "attendance_day": 1,
        "field": "work_description",
        "message": "error",
    }]

    response = client.post(
        "/api/attendance/monthly/unlock",
        json={"userId": USER_ID, "targetYear": 2026, "targetMonth": 7, "baseUpdatedAt": "base"},
    )

    assert response.status_code == 200
    unlocked = repo.find_header(USER_ID, 2026, 7)
    assert unlocked["status"] == "draft"
    assert unlocked["updated_by"] == EMPLOYEE_ID
    assert repo.find_validation_results(header["id"]) == []

    repo.update_header(header["id"], {"status": "approved", "updated_at": "approved"})
    denied = client.post(
        "/api/attendance/monthly/unlock",
        json={"userId": USER_ID, "targetYear": 2026, "targetMonth": 7, "baseUpdatedAt": "approved"},
    )

    assert denied.status_code == 409


def test_normal_work_time_is_returned(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.get(f"/api/attendance/normal-work-time?userId={USER_ID}")

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["normalWorkTime"][0]["userId"] == USER_ID
    assert body["normalWorkTime"][0]["effectiveFromDay"] == 1
    assert body["normalWorkTime"][0]["effectiveToDay"] == 31
    assert body["normalWorkTime"][0]["startTime"] == "09:00"
    assert body["normalWorkTime"][0]["endTime"] == "18:00"


def test_normal_work_time_zero_settings_are_returned(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal = []

    response = client.get(f"/api/attendance/normal-work-time?userId={USER_ID}")

    assert response.status_code == 200
    assert response.get_json()["normalWorkTime"] == []


def test_normal_work_time_multiple_periods_are_returned_sorted(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal = [
        {
            "id": "n2",
            "user_id": USER_ID,
            "effective_from_day": 16,
            "effective_to_day": 31,
            "start_time": "08:30",
            "end_time": "17:30",
            "break_minutes": 60,
        },
        {
            "id": "n1",
            "user_id": USER_ID,
            "effective_from_day": 1,
            "effective_to_day": 15,
            "start_time": "09:00",
            "end_time": "18:00",
            "break_minutes": 60,
        },
    ]

    response = client.get(f"/api/attendance/normal-work-time?userId={USER_ID}")

    assert response.status_code == 200
    assert [item["id"] for item in response.get_json()["normalWorkTime"]] == ["n1", "n2"]


def test_normal_work_time_can_be_created(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal = []

    response = client.put(
        "/api/attendance/normal-work-time",
        json={
            "userId": USER_ID,
            "normalWorkTime": [
                {
                    "effectiveFromDay": 1,
                    "effectiveToDay": 31,
                    "startTime": "08:30",
                    "endTime": "17:30",
                    "breakMinutes": 60,
                },
            ],
        },
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["success"] is True
    assert body["message"] == "通常勤務時間を保存しました。"
    assert len(body["normalWorkTime"]) == 1
    assert body["normalWorkTime"][0]["startTime"] == "08:30"
    assert repo.normal[0]["id"] == "n1"
    assert repo.normal[0]["created_by"] == EMPLOYEE_ID
    assert repo.normal[0]["updated_by"] == EMPLOYEE_ID


def test_normal_work_time_can_be_updated(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal[0]["created_by"] = "ORIGINAL"

    response = client.put(
        "/api/attendance/normal-work-time",
        json={
            "userId": USER_ID,
            "normalWorkTime": [
                {
                    "id": "n1",
                    "effectiveFromDay": 1,
                    "effectiveToDay": 31,
                    "startTime": "08:30",
                    "endTime": "17:30",
                    "breakMinutes": 60,
                },
            ],
        },
    )

    assert response.status_code == 200
    assert repo.normal[0]["start_time"] == "08:30"
    assert repo.normal[0]["updated_by"] == EMPLOYEE_ID
    assert repo.normal[0]["created_by"] == "ORIGINAL"


def test_normal_work_time_can_be_deleted(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.delete("/api/attendance/normal-work-time/n1")

    assert response.status_code == 200
    assert response.get_json()["message"] == "通常勤務時間設定を削除しました。"
    assert repo.normal == []


def test_normal_work_time_accepts_full_month_range(monkeypatch):
    client, repo = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={
            "userId": USER_ID,
            "normalWorkTime": [
                {
                    "id": "n1",
                    "effectiveFromDay": 1,
                    "effectiveToDay": 31,
                    "startTime": "09:00",
                    "endTime": "18:00",
                    "breakMinutes": 0,
                },
            ],
        },
    )

    assert response.status_code == 200
    assert repo.normal[0]["effective_from_day"] == 1
    assert repo.normal[0]["effective_to_day"] == 31
    assert repo.normal[0]["break_minutes"] == 0


def test_normal_work_time_rejects_start_day_zero(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=0)]},
    )

    assert response.status_code == 400
    assert response.get_json()["validationResults"][0]["field"] == "effectiveFromDay"


def test_normal_work_time_rejects_end_day_thirty_two(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveToDay=32)]},
    )

    assert response.status_code == 400
    assert response.get_json()["validationResults"][0]["field"] == "effectiveToDay"


def test_normal_work_time_rejects_start_day_after_end_day(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=20, effectiveToDay=10)]},
    )

    assert response.status_code == 400
    assert response.get_json()["validationResults"][0]["field"] == "effectivePeriod"


def test_normal_work_time_rejects_negative_break_minutes(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(breakMinutes=-1)]},
    )

    assert response.status_code == 400
    assert response.get_json()["validationResults"][0]["field"] == "breakMinutes"


def test_normal_work_time_rejects_invalid_time_format(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(startTime="9:00")]},
    )

    assert response.status_code == 400
    assert response.get_json()["validationResults"][0]["field"] == "startTime"


def test_normal_work_time_rejects_end_time_not_after_start_time(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(startTime="18:00", endTime="09:00")]},
    )

    assert response.status_code == 400
    assert response.get_json()["validationResults"][0]["field"] == "endTime"


def test_normal_work_time_rejects_same_period_overlap(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=1, effectiveToDay=31)]},
    )

    assert response.status_code == 400
    assert response.get_json()["validationResults"][0]["message"] == "通常勤務時間の適用期間が既存の設定と重複しています。期間を確認してください。"


def test_normal_work_time_rejects_partial_overlap(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal[0]["effective_to_day"] = 15

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=10, effectiveToDay=20)]},
    )

    assert response.status_code == 400


def test_normal_work_time_rejects_containing_period(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal[0]["effective_from_day"] = 10
    repo.normal[0]["effective_to_day"] = 20

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=1, effectiveToDay=31)]},
    )

    assert response.status_code == 400


def test_normal_work_time_rejects_contained_period(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=10, effectiveToDay=20)]},
    )

    assert response.status_code == 400


def test_normal_work_time_accepts_adjacent_period(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal[0]["effective_to_day"] = 15

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=16, effectiveToDay=31)]},
    )

    assert response.status_code == 200
    assert len(repo.normal) == 2


def test_normal_work_time_accepts_gap_period(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal[0]["effective_to_day"] = 15

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(effectiveFromDay=20, effectiveToDay=31)]},
    )

    assert response.status_code == 200
    assert len(repo.normal) == 2


def test_normal_work_time_update_excludes_itself_from_overlap(monkeypatch):
    client, repo = _client(monkeypatch)
    repo.normal.append({
        "id": "n2",
        "user_id": USER_ID,
        "effective_from_day": 16,
        "effective_to_day": 31,
        "start_time": "08:30",
        "end_time": "17:30",
        "break_minutes": 60,
    })
    repo.normal[0]["effective_to_day"] = 15

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": USER_ID, "normalWorkTime": [normal_setting_payload(id="n1", effectiveFromDay=1, effectiveToDay=15)]},
    )

    assert response.status_code == 200


def test_normal_work_time_rejects_other_user_operation(monkeypatch):
    client, _ = _client(monkeypatch)

    response = client.put(
        "/api/attendance/normal-work-time",
        json={"userId": OTHER_USER_ID, "normalWorkTime": []},
    )

    assert response.status_code == 403


def test_submit_uses_normal_work_time_matching_attendance_day():
    service = AttendanceValidationService()
    normal = [
        {
            "effective_from_day": 1,
            "effective_to_day": 15,
            "start_time": "09:00",
            "end_time": "18:00",
            "break_minutes": 60,
        },
        {
            "effective_from_day": 16,
            "effective_to_day": 31,
            "start_time": "08:30",
            "end_time": "17:30",
            "break_minutes": 60,
        },
    ]

    results, _ = service.validate_submit(
        2026,
        7,
        [row(16, "", start="08:30", end="17:30", rest="60", content="作業")],
        normal,
        set(ACTIVE_WORK_TYPES),
    )

    assert results == []


def test_submit_errors_when_normal_work_time_is_not_configured_for_day():
    service = AttendanceValidationService()
    normal = [
        {
            "effective_from_day": 20,
            "effective_to_day": 31,
            "start_time": "09:00",
            "end_time": "18:00",
            "break_minutes": 60,
        },
    ]

    results, _ = service.validate_submit(
        2026,
        7,
        [row(19, "", start="09:00", end="18:00", rest="60", content="作業")],
        normal,
        set(ACTIVE_WORK_TYPES),
    )

    assert {
        "code": "E001",
        "attendance_day": 19,
        "field": "normal_work_time",
    }.items() <= results[0].items()


def test_submit_errors_when_multiple_normal_work_time_settings_match_day():
    service = AttendanceValidationService()
    normal = [
        {
            "effective_from_day": 1,
            "effective_to_day": 20,
            "start_time": "09:00",
            "end_time": "18:00",
            "break_minutes": 60,
        },
        {
            "effective_from_day": 10,
            "effective_to_day": 31,
            "start_time": "09:00",
            "end_time": "18:00",
            "break_minutes": 60,
        },
    ]

    results, _ = service.validate_submit(
        2026,
        7,
        [row(10, "", start="09:00", end="18:00", rest="60", content="作業")],
        normal,
        set(ACTIVE_WORK_TYPES),
    )

    assert results[0]["code"] == "NORMAL_WORK_TIME_MULTIPLE"


def test_monthly_header_insert_values_match_column_lengths(monkeypatch):
    _client(monkeypatch)
    service = attendance_monthly_service.AttendanceMonthlyService()

    header = service._new_header(UUID_USER_ID, 2026, 7, EMPLOYEE_ID)

    assert len(header["id"]) == 20
    assert len(header["user_id"]) == 36
    assert header["target_year"] == 2026
    assert header["target_month"] == 7
    assert len(header["status"]) == 5
    assert len(header["created_by"]) == len(EMPLOYEE_ID)
    assert len(header["updated_by"]) == len(EMPLOYEE_ID)
    assert len(header["created_by"]) <= 20
    assert len(header["updated_by"]) <= 20


def test_attendance_monthly_headers_user_id_schema_allows_uuid():
    schema_path = Path(__file__).resolve().parents[1] / "db/schema/005_attendance.sql"
    schema = schema_path.read_text(encoding="utf-8")
    monthly_header_schema = schema.split("create table if not exists attendance_daily_records", 1)[0]

    assert "user_id text not null" in monthly_header_schema
    assert "alter column user_id type text" in monthly_header_schema
    assert "user_id character varying(20)" not in monthly_header_schema


def test_validation_service_returns_required_errors_by_field():
    service = AttendanceValidationService()
    normal = [{
        "effective_from_day": 1,
        "effective_to_day": 31,
        "start_time": "09:00",
        "end_time": "18:00",
        "break_minutes": 60,
    }]

    results, _ = service.validate_submit(2026, 7, [row(3, "")], normal, set(ACTIVE_WORK_TYPES))

    required = {
        (result["attendance_day"], result["field"], result["message"])
        for result in results
        if result["message"] == "必須です。"
    }
    assert (3, "start_time", "必須です。") in required
    assert (3, "end_time", "必須です。") in required
    assert (3, "break_minutes", "必須です。") in required
    assert (3, "work_description", "必須です。") in required


def test_validation_service_returns_time_order_error():
    service = AttendanceValidationService()

    results = service.validate_save(
        2026,
        7,
        [row(3, "", start="18:00", end="09:00", rest="60", content="作業")],
        set(ACTIVE_WORK_TYPES),
    )

    assert {
        "attendance_day": 3,
        "field": "end_time",
        "message": "出勤時刻より前です。",
    }.items() <= results[0].items()


def test_validation_service_returns_numeric_range_error():
    service = AttendanceValidationService()

    results = service.validate_save(
        2026,
        7,
        [row(3, "", start="09:00", end="18:00", rest="60", content="作業", late="1000")],
        set(ACTIVE_WORK_TYPES),
    )

    assert results[0]["field"] == "late_early_minutes"
    assert results[0]["message"] == "0以上999.5以下、30分単位で入力してください。"


def test_validation_service_returns_multiple_rows_and_same_row_multiple_errors():
    service = AttendanceValidationService()
    normal = [{
        "effective_from_day": 1,
        "effective_to_day": 31,
        "start_time": "09:00",
        "end_time": "18:00",
        "break_minutes": 60,
    }]

    results, _ = service.validate_submit(2026, 7, [row(3, ""), row(5, "")], normal, set(ACTIVE_WORK_TYPES))

    assert {result["attendance_day"] for result in results} >= {3, 5}
    day3_fields = {result["field"] for result in results if result["attendance_day"] == 3}
    assert {"start_time", "end_time", "break_minutes", "work_description"}.issubset(day3_fields)


def test_validation_service_returns_no_error_for_valid_input():
    service = AttendanceValidationService()
    normal = [{
        "effective_from_day": 1,
        "effective_to_day": 31,
        "start_time": "09:00",
        "end_time": "18:00",
        "break_minutes": 60,
    }]

    results, _ = service.validate_submit(
        2026,
        7,
        [row(3, "", start="09:00", end="18:00", rest="60", content="作業")],
        normal,
        set(ACTIVE_WORK_TYPES),
    )

    assert results == []


def test_validation_service_covers_documented_codes_except_e012():
    service = AttendanceValidationService()
    normal = [{
        "effective_from_day": 1,
        "effective_to_day": 31,
        "start_time": "09:00",
        "end_time": "18:00",
        "break_minutes": 60,
    }]

    scenarios = [
        ("E001", [row("2026-07-01", "", start="09:00", end="18:00", rest="60", content="作業")], []),
        ("E003", [row("2026-07-01", "", start="09:00", end="09:07", rest="0", content="作業")], normal),
        ("E004", [row("2026-07-01", "", start="10:00", end="18:00", rest="60", content="作業")], normal),
        ("E005", [row("2026-07-01", "", start="09:00", end="17:00", rest="60", content="作業")], normal),
        ("E006", [row("2026-07-01", "", start="09:00", end="18:00", rest="60")], normal),
        ("E007", [row("2026-07-01", "")], normal),
        ("E008", [row("2026-07-01", "欠勤", start="09:00")], normal),
        ("E009", [row("2026-07-04", "欠勤", holiday=1)], normal),
        ("E010", [row("2026-07-04", "有休", holiday=1, start="09:00", end="18:00", rest="60")], normal),
        ("E011", [row("2026-07-01", "休出", start="09:00", end="18:00", rest="60", content="作業")], normal),
        ("E013", [row("2026-07-01", "振休", start="09:00", end="14:00", rest="0", content="作業")], normal),
        ("E014", [row("2026-07-01", "振休", start="09:00", end="17:00", rest="60", content="作業")], normal),
        ("E015", [row("2026-07-01", "", start="09:00", end="18:00", rest="0", content="作業")], normal),
        ("E016", [row("2026-07-01", "遅刻", start="10:00", end="18:00", rest="60", content="作業")], normal),
        ("E017", [row("2026-07-01", "遅刻", start="10:00", end="18:00", rest="60", content="作業", late="15")], normal),
        ("E018", [row("2026-07-01", "不正", start="09:00", end="18:00", rest="60", content="作業")], normal),
    ]

    for expected_code, rows, settings in scenarios:
        results, _ = service.validate_submit(2026, 7, rows, settings, set(ACTIVE_WORK_TYPES))
        codes = {result["code"] for result in results}
        assert expected_code in codes
        assert "E012" not in codes

    assert {result["code"] for result in service.validate_save(2026, 7, [row(32, "")], set(ACTIVE_WORK_TYPES))} == {"E002"}
    assert {result["code"] for result in service.validate_save(0, 13, [row("2026-07-01", "")], set(ACTIVE_WORK_TYPES))} == {"E019", "E020"}


def test_validation_service_accepts_attendance_day_min_max_boundaries():
    service = AttendanceValidationService()

    for day in (1, 2, 30, 31):
        results = service.validate_save(
            2026,
            7,
            [row(day, "", start="09:00", end="18:00", rest="60", content="work")],
            set(ACTIVE_WORK_TYPES),
        )

        assert "E002" not in {result["code"] for result in results}


def test_validation_service_rejects_attendance_day_outside_boundaries():
    service = AttendanceValidationService()

    for day in (0, 32):
        results = service.validate_save(
            2026,
            7,
            [row(day, "", start="09:00", end="18:00", rest="60", content="work")],
            set(ACTIVE_WORK_TYPES),
        )

        assert {result["code"] for result in results} == {"E002"}
        assert results[0]["field"] == "attendance_day"


def test_validation_service_checks_break_minutes_db_boundaries():
    service = AttendanceValidationService()

    for break_minutes in ("0", "1", "60"):
        results = service.validate_save(
            2026,
            7,
            [row(1, "", start="09:00", end="18:00", rest=break_minutes, content="work")],
            set(ACTIVE_WORK_TYPES),
        )
        assert not [result for result in results if result["field"] == "break_minutes"]

    for break_minutes in ("-1", "1.5", "text"):
        results = service.validate_save(
            2026,
            7,
            [row(1, "", start="09:00", end="18:00", rest=break_minutes, content="work")],
            set(ACTIVE_WORK_TYPES),
        )
        assert "FORMAT_BREAK" in {result["code"] for result in results}


def test_validation_service_checks_late_early_minutes_numeric_boundaries():
    service = AttendanceValidationService()

    for late_early_minutes in ("0", "30", "990"):
        results = service.validate_save(
            2026,
            7,
            [
                row(
                    1,
                    "",
                    start="09:00",
                    end="18:00",
                    rest="60",
                    content="work",
                    late=late_early_minutes,
                )
            ],
            set(ACTIVE_WORK_TYPES),
        )
        assert not [result for result in results if result["field"] == "late_early_minutes"]

    for late_early_minutes in ("-1", "1", "999.5", "1000", "text"):
        results = service.validate_save(
            2026,
            7,
            [
                row(
                    1,
                    "",
                    start="09:00",
                    end="18:00",
                    rest="60",
                    content="work",
                    late=late_early_minutes,
                )
            ],
            set(ACTIVE_WORK_TYPES),
        )
        assert "E017" in {result["code"] for result in results}


def test_attendance_schema_declares_required_db_boundary_constraints():
    schema_path = Path(__file__).resolve().parents[1] / "db/schema/005_attendance.sql"
    schema = schema_path.read_text(encoding="utf-8").lower()

    assert "id character varying(20) not null" in schema
    assert "status character varying(20) not null" in schema
    assert "created_by character varying(20) not null" in schema
    assert "updated_by character varying(20) not null" in schema
    assert "start_time time" in schema
    assert "end_time time" in schema
    assert "work_description text" in schema
    assert "late_early_minutes numeric(4, 1)" in schema
    assert "total_work_days numeric(5, 1)" in schema
    assert "late_early_minutes numeric(6, 1)" in schema
    assert "constraint ck_normal_work_time_break_minutes" in schema
    assert "check (break_minutes >= 0)" in schema
    assert "effective_from_day between 1 and 31" in schema
    assert "effective_to_day between 1 and 31" in schema


def normal_setting_payload(**overrides):
    payload = {
        "effectiveFromDay": 1,
        "effectiveToDay": 31,
        "startTime": "09:00",
        "endTime": "18:00",
        "breakMinutes": 60,
    }
    payload.update(overrides)
    return payload


def row(
    attendance_day,
    work_type,
    holiday=0,
    start="",
    end="",
    rest="",
    content="",
    late="",
):
    return {
        "attendance_day": attendance_day,
        "day_of_week": "",
        "holiday_flag": holiday,
        "start_time": start,
        "end_time": end,
        "break_minutes": rest,
        "work_type_code": work_type,
        "work_description": content,
        "late_early_minutes": late,
    }
