from datetime import datetime, timezone
from uuid import uuid4

from repositories.attendance_repository import AttendanceRepository
from repositories.user_repository import UserRepository
from services.attendance_aggregation_service import AttendanceAggregationService
from services.attendance_validation_service import AttendanceValidationService, normalize_input_row
from services.holiday_service import HolidayCalendarService
from services.midnight_work_service import MidnightWorkService
from services.work_time_calculation_service import WorkTimeCalculationService


FIELD_RESPONSE_NAMES = {
    "target_year": "targetYear",
    "target_month": "targetMonth",
    "attendance_day": "attendanceDay",
    "start_time": "startTime",
    "end_time": "endTime",
    "break_minutes": "breakMinutes",
    "actual_work_minutes": "actualWorkMinutes",
    "work_type_code": "workTypeCode",
    "work_description": "workDescription",
    "late_early_minutes": "lateEarlyMinutes",
    "midnight_minutes": "midnightMinutes",
    "warning_flag": "warningFlag",
    "normal_work_time": "normalWorkTime",
}

FIELD_STORAGE_NAMES = {value: key for key, value in FIELD_RESPONSE_NAMES.items()}
MAX_AUDIT_ID_LENGTH = 20
SYSTEM_OPERATOR_ID = "SYSTEM"
NORMAL_WORK_TIME_OVERLAP_MESSAGE = "通常勤務時間の適用期間が既存の設定と重複しています。期間を確認してください。"
NORMAL_WORK_TIME_SAVE_MESSAGE = "通常勤務時間を保存しました。"
NORMAL_WORK_TIME_DELETE_MESSAGE = "通常勤務時間設定を削除しました。"


class AttendanceMonthlyService:
    def __init__(self):
        self.repo = AttendanceRepository()
        self.user_repo = UserRepository()
        self.holidays = HolidayCalendarService(self.repo)
        self.work_time = WorkTimeCalculationService()
        self.midnight = MidnightWorkService()
        self.validation = AttendanceValidationService(self.holidays, self.work_time, self.midnight)
        self.aggregation = AttendanceAggregationService()

    def get_monthly(self, user_id, target_year, target_month):
        target_year, target_month = self._validate_target_year_month_or_raise(target_year, target_month)
        header = self.repo.find_header(user_id, target_year, target_month)
        normal_work_time = self._normal_work_time(user_id)
        rows = self._rows_for_response(header, target_year, target_month)
        summary = self._summary(header, rows)
        validation_results = self._validation_results(header)
        return {
            "success": True,
            "header": self._header_for_response(user_id, target_year, target_month, header),
            "normalWorkTime": [self._normal_for_response(item) for item in normal_work_time],
            "rows": [self._row_for_response(row) for row in rows],
            "summary": summary,
            "validationResults": [self._validation_for_response(item) for item in validation_results],
        }

    def save_monthly(self, data):
        user_id, raw_target_year, raw_target_month, operator_id = self._payload_identity_raw(data)
        changed_rows = data.get("changedRows")
        if changed_rows is None:
            return {"error": "changedRows is required"}, 400
        if not isinstance(changed_rows, list):
            return {"error": "changedRows is invalid"}, 400

        work_type_codes = self._active_work_type_codes()
        save_errors = self.validation.validate_save(raw_target_year, raw_target_month, changed_rows, work_type_codes)
        if save_errors:
            errors = [self._validation_for_response(item) for item in save_errors]
            return {"success": False, "errors": errors, "validationResults": errors}, 400
        target_year, target_month = self.holidays.validate_year_month(raw_target_year, raw_target_month)

        header = self.repo.find_header(user_id, target_year, target_month)
        conflict = self._conflict_response(header, data.get("baseUpdatedAt"), changed_rows, user_id, target_year, target_month)
        if conflict:
            return conflict, 409

        if header and header.get("status") != "draft":
            return {"error": "この状態では保存できません。"}, 409

        if not header:
            header = self.repo.create_header(self._new_header(user_id, target_year, target_month, operator_id))

        header_id = header["id"]
        now = self._now()
        for raw in changed_rows:
            row = normalize_input_row(raw)
            row["holiday_flag"] = self._holiday_flag(target_year, target_month, row["attendance_day"])
            row["day_of_week"] = self._day_of_week(target_year, target_month, row["attendance_day"])

            if self._is_delete_row(row):
                self.repo.delete_daily_record(header_id, row["attendance_day"])
                continue

            current = self.repo.find_daily_record(header_id, row["attendance_day"])
            if current:
                record = self._record_for_storage(header_id, row, now, operator_id, create=False)
                self.repo.update_daily_record(current["id"], record)
            else:
                record = self._record_for_storage(header_id, row, now, operator_id, create=True)
                self.repo.create_daily_record(record)

        updated_header = self.repo.update_header(header_id, {
            "updated_at": now,
            "updated_by": operator_id,
        }) or {**header, "updated_at": now, "updated_by": operator_id}

        rows = self._rows_for_response(updated_header, target_year, target_month)
        summary = self.aggregation.aggregate(rows)
        self.repo.replace_summary(header_id, summary)
        return self.get_monthly(user_id, target_year, target_month), 200

    def validate_monthly(self, data):
        body, status = self._run_validation(data, mutate_status=True, submit=False)
        return body, status

    def submit_monthly(self, data):
        body, status = self._run_validation(data, mutate_status=True, submit=True)
        return body, status

    def unlock_monthly(self, data):
        user_id, target_year, target_month, operator_id = self._payload_identity(data)
        header = self.repo.find_header(user_id, target_year, target_month)
        if not header:
            return {"error": "Attendance month not found"}, 404
        if header.get("status") not in {"validated", "submitted"}:
            return {"error": "この状態では編集再開できません。"}, 409

        self.repo.update_header(header["id"], {
            "status": "draft",
            "updated_at": self._now(),
            "updated_by": operator_id,
        })
        self.repo.replace_validation_results(header["id"], [])
        return self.get_monthly(user_id, target_year, target_month), 200

    def list_work_types(self):
        rows = self._active_work_types()
        rows = sorted(rows, key=lambda row: str(row.get("work_type_code") or ""))
        return {"success": True, "workTypes": [self._work_type_for_response(row) for row in rows]}

    def list_holidays(self, target_year, target_month):
        target_year, target_month = self._validate_target_year_month_or_raise(target_year, target_month)
        return {"success": True, "holidays": self.holidays.days_for_month(target_year, target_month)}

    def get_normal_work_time(self, user_id):
        return {"success": True, "normalWorkTime": [self._normal_for_response(item) for item in self._normal_work_time(user_id)]}

    def update_normal_work_time(self, data):
        user_id = str(data.get("userId") or data.get("user_id") or "").strip()
        if not user_id:
            return {"error": "userId is required"}, 400

        try:
            operator_id = _validate_audit_id(data.get("operator_id") or data.get("operatorId"), "operator_id")
        except ValueError as error:
            return {"error": str(error)}, 400

        settings = data.get("normalWorkTime") or data.get("settings") or []
        if not isinstance(settings, list):
            return {"error": "normalWorkTime is invalid"}, 400

        current = self._normal_work_time(user_id)
        current_by_id = {
            str(row.get("id")): row
            for row in current
            if row.get("id") is not None
        }

        normalized, errors = self._normal_work_time_settings_for_storage(settings, user_id)
        if errors:
            return _normal_work_time_error_body(errors), 400

        unknown_id = next(
            (
                item["id"]
                for item in normalized
                if item.get("id") and str(item.get("id")) not in current_by_id
            ),
            None,
        )
        if unknown_id:
            return {"error": "Forbidden"}, 403

        final_settings = [
            row
            for row in current
            if row.get("id") not in {item.get("id") for item in normalized if item.get("id")}
        ]
        final_settings.extend(item["storage"] | ({"id": item["id"]} if item.get("id") else {}) for item in normalized)
        overlap_errors = self._normal_work_time_overlap_errors(final_settings, source_rows=normalized)
        if overlap_errors:
            return _normal_work_time_error_body(overlap_errors), 400

        now = self._now()
        for item in normalized:
            storage = dict(item["storage"])
            storage["updated_at"] = now
            storage["updated_by"] = operator_id
            if item.get("id"):
                self.repo.update_normal_work_time_setting(item["id"], storage)
            else:
                storage["created_by"] = operator_id
                self.repo.create_normal_work_time_setting(storage)

        body = self.get_normal_work_time(user_id)
        body["message"] = NORMAL_WORK_TIME_SAVE_MESSAGE
        return body, 200

    def delete_normal_work_time(self, setting_id, user_id):
        setting_id = str(setting_id or "").strip()
        if not setting_id:
            return {"error": "id is required"}, 400

        deleted = self.repo.delete_normal_work_time_setting(setting_id, user_id)
        if not deleted:
            return {"error": "Not found"}, 404

        body = self.get_normal_work_time(user_id)
        body["message"] = NORMAL_WORK_TIME_DELETE_MESSAGE
        return body, 200

    def _run_validation(self, data, mutate_status, submit):
        user_id, raw_target_year, raw_target_month, operator_id = self._payload_identity_raw(data)
        target_year_month_errors = self.validation.validate_save(raw_target_year, raw_target_month, [], self._active_work_type_codes())
        if target_year_month_errors:
            errors = [self._validation_for_response(item) for item in target_year_month_errors]
            return {"success": False, "errors": errors, "validationResults": errors}, 400
        target_year, target_month = self.holidays.validate_year_month(raw_target_year, raw_target_month)

        header = self.repo.find_header(user_id, target_year, target_month)
        changed_rows = data.get("changedRows") if isinstance(data.get("changedRows"), list) else []
        conflict = self._conflict_response(header, data.get("baseUpdatedAt"), changed_rows, user_id, target_year, target_month)
        if conflict:
            return conflict, 409

        if not header:
            header = self.repo.create_header(self._new_header(user_id, target_year, target_month, operator_id))

        if submit and header.get("status") not in {"draft", "validated"}:
            return {"error": "この状態では提出できません。"}, 409

        rows = self._rows_for_response(header, target_year, target_month)
        normal = self._normal_work_time(user_id)
        validation_results, calculated_rows = self.validation.validate_submit(
            target_year,
            target_month,
            rows,
            normal,
            self._active_work_type_codes(),
        )
        summary = self.aggregation.aggregate(calculated_rows)
        errors = [item for item in validation_results if item["severity"] == "error"]
        warnings = [item for item in validation_results if item["severity"] == "warning"]
        completion_label = self._completion_label(errors, warnings, summary, calculated_rows)
        now = self._now()

        for row in calculated_rows:
            if row.get("id"):
                self.repo.update_daily_record(row["id"], self._record_for_storage(header["id"], row, now, operator_id, create=False))

        self.repo.replace_summary(header["id"], summary)
        self.repo.replace_validation_results(header["id"], [self._validation_for_storage(item) for item in validation_results])

        header_update = {}
        if len(errors) == 0:
            header_update["updated_at"] = now
            header_update["updated_by"] = operator_id
        if mutate_status and len(errors) == 0:
            header_update["status"] = "submitted" if submit else "validated"

        self.repo.update_header(header["id"], header_update)
        body = self.get_monthly(user_id, target_year, target_month)
        body["header"]["completionLabel"] = completion_label
        body["validationResults"] = [self._validation_for_response(item) for item in validation_results]
        body["errors"] = [item for item in body["validationResults"] if item.get("severity") == "error"]
        body["success"] = len(errors) == 0
        return body, 200 if len(errors) == 0 else 400

    def _payload_identity(self, data):
        user_id, target_year, target_month, operator_id = self._payload_identity_raw(data)
        target_year, target_month = self._validate_target_year_month_or_raise(target_year, target_month)
        return user_id, target_year, target_month, operator_id

    def _payload_identity_raw(self, data):
        user_id = str(data.get("userId") or data.get("user_id") or "").strip()
        if not user_id:
            raise ValueError("userId is required")
        operator_id = str(data.get("operator_id") or data.get("operatorId") or "").strip()
        if not operator_id:
            if len(user_id) <= MAX_AUDIT_ID_LENGTH:
                operator_id = user_id
            else:
                raise ValueError("operator_id is required")
        operator_id = _validate_audit_id(operator_id, "operator_id")
        return user_id, data.get("target_year") or data.get("targetYear"), data.get("target_month") or data.get("targetMonth"), operator_id

    def _validate_target_year_month_or_raise(self, target_year, target_month):
        target_year, target_month = self.holidays.validate_year_month(target_year, target_month)
        if target_year is None:
            raise ValueError("targetYear or targetMonth is invalid")
        return target_year, target_month

    def _new_header(self, user_id, target_year, target_month, operator_id=None):
        now = self._now()
        operator_id = _audit_id_or_system(operator_id)
        return {
            "id": _new_id("M"),
            "user_id": user_id,
            "target_year": target_year,
            "target_month": target_month,
            "status": "draft",
            "created_at": now,
            "created_by": operator_id,
            "updated_at": now,
            "updated_by": operator_id,
        }

    def _rows_for_response(self, header, target_year, target_month):
        calendar_rows = {row["attendance_day"]: row for row in self.holidays.days_for_month(target_year, target_month)}
        stored = {}
        if header and header.get("id"):
            stored = {
                int(row.get("attendance_day")): row
                for row in self.repo.find_daily_records(header["id"])
                if row.get("attendance_day") is not None
            }

        rows = []
        for attendance_day, calendar_row in sorted(calendar_rows.items()):
            row = dict(calendar_row)
            row.update(stored.get(attendance_day, {}))
            row["attendance_day"] = attendance_day
            row["day_of_week"] = calendar_row["day_of_week"]
            row["holiday_flag"] = calendar_row["holiday_flag"]
            rows.append(row)
        return rows

    def _summary(self, header, rows):
        if header and header.get("id"):
            summary = self.repo.find_summary(header["id"])
            if summary:
                return self._summary_for_response(summary)
        return self._summary_for_response(self.aggregation.aggregate(rows))

    def _validation_results(self, header):
        if not header or not header.get("id"):
            return []
        return self.repo.find_validation_results(header["id"])

    def _normal_work_time(self, user_id):
        rows = self.repo.find_normal_work_time_settings(user_id)
        return sorted(rows, key=lambda row: int(row.get("effective_from_day") or 0))

    def _normal_work_time_settings_for_storage(self, settings, user_id):
        normalized = []
        errors = []
        for index, raw in enumerate(settings):
            row_no = index + 1
            row = dict(raw or {})
            setting_id = str(row.get("id") or "").strip() or None
            from_day = _parse_int(row.get("effectiveFromDay", row.get("effective_from_day")))
            to_day = _parse_int(row.get("effectiveToDay", row.get("effective_to_day")))
            start_time = str(row.get("startTime") or row.get("start_time") or "").strip()
            end_time = str(row.get("endTime") or row.get("end_time") or "").strip()
            break_minutes = _parse_int(row.get("breakMinutes", row.get("break_minutes")))

            if from_day is None:
                errors.append(_normal_work_time_result(row_no, "effectiveFromDay", "適用開始日は必須です。"))
            elif from_day < 1 or from_day > 31:
                errors.append(_normal_work_time_result(row_no, "effectiveFromDay", "1～31で入力してください。"))

            if to_day is None:
                errors.append(_normal_work_time_result(row_no, "effectiveToDay", "適用終了日は必須です。"))
            elif to_day < 1 or to_day > 31:
                errors.append(_normal_work_time_result(row_no, "effectiveToDay", "1～31で入力してください。"))

            if from_day is not None and to_day is not None and from_day > to_day:
                errors.append(_normal_work_time_result(row_no, "effectivePeriod", "適用開始日は適用終了日以前で入力してください。"))

            start_minutes = self.work_time.parse_time(start_time)
            end_minutes = self.work_time.parse_time(end_time)
            if not start_time:
                errors.append(_normal_work_time_result(row_no, "startTime", "通常出勤時刻は必須です。"))
            elif start_minutes is None:
                errors.append(_normal_work_time_result(row_no, "startTime", "HH:mm形式で入力してください。"))

            if not end_time:
                errors.append(_normal_work_time_result(row_no, "endTime", "通常退勤時刻は必須です。"))
            elif end_minutes is None:
                errors.append(_normal_work_time_result(row_no, "endTime", "HH:mm形式で入力してください。"))

            if start_minutes is not None and end_minutes is not None and start_minutes >= end_minutes:
                errors.append(_normal_work_time_result(row_no, "endTime", "通常退勤時刻は通常出勤時刻より後にしてください。"))

            if break_minutes is None:
                errors.append(_normal_work_time_result(row_no, "breakMinutes", "休憩時間は必須です。"))
            elif break_minutes < 0:
                errors.append(_normal_work_time_result(row_no, "breakMinutes", "0以上で入力してください。"))

            if any(error["rowNo"] == row_no for error in errors):
                continue

            normalized.append({
                "id": setting_id,
                "rowNo": row_no,
                "storage": {
                    "user_id": user_id,
                    "effective_from_day": from_day,
                    "effective_to_day": to_day,
                    "start_time": start_time,
                    "end_time": end_time,
                    "break_minutes": break_minutes,
                },
            })

        return normalized, errors

    def _normal_work_time_overlap_errors(self, settings, source_rows=None):
        rows = []
        source_by_key = {}
        for row in source_rows or []:
            storage = row["storage"]
            key = (
                str(row.get("id") or ""),
                int(storage["effective_from_day"]),
                int(storage["effective_to_day"]),
            )
            source_by_key[key] = row.get("rowNo")

        for index, setting in enumerate(settings):
            rows.append({
                "id": str(setting.get("id") or ""),
                "rowNo": source_by_key.get((
                    str(setting.get("id") or ""),
                    int(setting["effective_from_day"]),
                    int(setting["effective_to_day"]),
                )),
                "from": int(setting["effective_from_day"]),
                "to": int(setting["effective_to_day"]),
                "index": index,
            })

        errors = []
        seen = set()
        for left_index, left in enumerate(rows):
            for right in rows[left_index + 1:]:
                if left["from"] <= right["to"] and left["to"] >= right["from"]:
                    target_row_no = left.get("rowNo") or right.get("rowNo")
                    key = target_row_no or (left["index"], right["index"])
                    if key in seen:
                        continue
                    seen.add(key)
                    errors.append(_normal_work_time_result(
                        target_row_no,
                        "effectivePeriod",
                        NORMAL_WORK_TIME_OVERLAP_MESSAGE,
                    ))
        return errors

    def _record_for_storage(self, header_id, row, now, operator_id, create=False):
        operator_id = _validate_audit_id(operator_id, "operator_id")
        actual = self.work_time.actual_work_minutes(row.get("start_time"), row.get("end_time"), row.get("break_minutes"))
        midnight = self.midnight.calculate_midnight_minutes(row.get("start_time"), row.get("end_time"), row.get("break_minutes")) if actual is not None else 0
        record = {
            "monthly_header_id": header_id,
            "attendance_day": int(row.get("attendance_day")),
            "start_time": row.get("start_time"),
            "end_time": row.get("end_time"),
            "break_minutes": int(row["break_minutes"]) if row.get("break_minutes") not in (None, "") else None,
            "actual_work_minutes": actual,
            "work_type_code": row.get("work_type_code") or None,
            "work_description": row.get("work_description") or None,
            "late_early_minutes": float(row["late_early_minutes"]) if row.get("late_early_minutes") not in (None, "") else None,
            "midnight_minutes": midnight,
            "updated_at": now,
            "updated_by": operator_id,
        }
        if create:
            record["id"] = _new_id("D")
            record["created_at"] = now
            record["created_by"] = operator_id
        return record

    def _is_delete_row(self, row):
        return all(row.get(field) in (None, "") for field in (
            "start_time",
            "end_time",
            "break_minutes",
            "work_type_code",
            "work_description",
            "late_early_minutes",
        ))

    def _conflict_response(self, header, base_updated_at, changed_rows, user_id, target_year, target_month):
        if not header:
            if base_updated_at in (None, ""):
                return None
            latest = self.get_monthly(user_id, target_year, target_month)
            return _conflict_body(latest, base_updated_at, None, changed_rows)

        current_updated_at = str(header.get("updated_at") or header.get("updatedAt") or "")
        if str(base_updated_at or "") == current_updated_at:
            return None
        latest = self.get_monthly(user_id, target_year, target_month)
        return _conflict_body(latest, base_updated_at, current_updated_at, changed_rows)

    def _header_for_response(self, user_id, target_year, target_month, header):
        if not header:
            header = self._new_header(user_id, target_year, target_month)
            header["id"] = None
            header["updated_at"] = None
        user = self.user_repo.find_by_id(user_id) or {}
        status = header.get("status") or "draft"
        return {
            "id": header.get("id"),
            "userId": header.get("user_id", user_id),
            "targetYear": int(header.get("target_year") or target_year),
            "targetMonth": int(header.get("target_month") or target_month),
            "status": status,
            "createdAt": header.get("created_at"),
            "createdBy": header.get("created_by"),
            "updatedAt": header.get("updated_at"),
            "updatedBy": header.get("updated_by"),
            "employeeNo": str(user.get("employee_id") or ""),
            "employeeName": str(user.get("name") or user.get("username") or ""),
            "workplace": user.get("workplace") or user.get("branch_name") or user.get("branch_code"),
            "department": user.get("department") or user.get("role_name") or user.get("role_id"),
            "completionLabel": None,
            "printable": status in {"validated", "submitted", "approved", "confirmed"},
        }

    def _row_for_response(self, row):
        return {
            "id": row.get("id"),
            "attendanceDay": int(row.get("attendance_day") or 0),
            "dayOfWeek": row.get("day_of_week"),
            "holidayFlag": int(row.get("holiday_flag") or 0),
            "startTime": _time_text(row.get("start_time")),
            "endTime": _time_text(row.get("end_time")),
            "breakMinutes": _optional_text(row.get("break_minutes")),
            "actualWorkMinutes": row.get("actual_work_minutes"),
            "workTypeCode": row.get("work_type_code") or "",
            "workDescription": row.get("work_description") or "",
            "lateEarlyMinutes": _optional_text(row.get("late_early_minutes")),
            "midnightMinutes": row.get("midnight_minutes") or 0,
            "warningFlag": bool(row.get("warning_flag")),
        }

    def _summary_for_response(self, summary):
        return {
            "totalWorkDays": float(summary.get("total_work_days") or 0),
            "normalWorkDays": float(summary.get("normal_work_days") or 0),
            "holidayWorkDays": float(summary.get("holiday_work_days") or 0),
            "absenceDays": float(summary.get("absence_days") or 0),
            "paidLeaveDays": float(summary.get("paid_leave_days") or 0),
            "totalActualWorkMinutes": int(summary.get("total_actual_work_minutes") or 0),
            "lateEarlyMinutes": float(summary.get("late_early_minutes") or 0),
            "midnightMinutes": int(summary.get("midnight_minutes") or 0),
        }

    def _validation_for_response(self, result):
        field = result.get("field")
        response_field = FIELD_RESPONSE_NAMES.get(field, field)
        attendance_day = result.get("attendance_day")
        return {
            "code": result.get("code"),
            "severity": result.get("severity"),
            "attendanceDay": attendance_day,
            "rowNo": result.get("row_no") or result.get("rowNo"),
            "field": response_field,
            "message": result.get("message"),
        }

    def _validation_for_storage(self, result):
        field = result.get("field")
        return {
            "attendance_day": result.get("attendance_day"),
            "field": FIELD_STORAGE_NAMES.get(field, field),
            "code": result.get("code"),
            "severity": result.get("severity"),
            "message": result.get("message"),
            "created_at": self._now(),
        }

    def _normal_for_response(self, row):
        return {
            "id": row.get("id"),
            "userId": row.get("user_id") or row.get("userId"),
            "effectiveFromDay": row.get("effective_from_day"),
            "effectiveToDay": row.get("effective_to_day"),
            "startTime": _time_text(row.get("start_time")),
            "endTime": _time_text(row.get("end_time")),
            "breakMinutes": row.get("break_minutes"),
            "updatedAt": row.get("updated_at"),
        }

    def _work_type_for_response(self, row):
        return {
            "code": row.get("work_type_code"),
            "displayName": row.get("work_type_name"),
        }

    def _active_work_types(self):
        return [row for row in self.repo.find_work_types() if _is_active(row)]

    def _active_work_type_codes(self):
        return {
            value
            for row in self._active_work_types()
            for value in (
                str(row.get("work_type_code") or "").strip(),
                str(row.get("work_type_name") or "").strip(),
            )
            if value
        }

    def _holiday_flag(self, target_year, target_month, attendance_day):
        day = int(attendance_day)
        for row in self.holidays.days_for_month(target_year, target_month):
            if row["attendance_day"] == day:
                return row["holiday_flag"]
        return 0

    def _day_of_week(self, target_year, target_month, attendance_day):
        day = int(attendance_day)
        for row in self.holidays.days_for_month(target_year, target_month):
            if row["attendance_day"] == day:
                return row["day_of_week"]
        return ""

    def _completion_label(self, errors, warnings, summary, rows):
        if errors:
            return None
        if any(item["code"] == "E014" for item in warnings):
            return "警告"
        if summary.get("midnight_minutes", 0) > 0:
            return "完了*"
        weekday_count = len([row for row in rows if int(row.get("holiday_flag") or 0) == 0])
        if summary.get("total_actual_work_minutes", 0) > weekday_count * 480 + 45:
            return "完了*"
        return "完了"

    def _now(self):
        return datetime.now(timezone.utc).isoformat()


def _time_text(value):
    if value is None:
        return ""
    text = str(value)
    return text[:5] if len(text) >= 5 else text


def _validate_audit_id(value, field_name):
    text = str(value or "").strip()
    if not text:
        raise ValueError(f"{field_name} is required")
    if len(text) > MAX_AUDIT_ID_LENGTH:
        raise ValueError(f"{field_name} must be {MAX_AUDIT_ID_LENGTH} characters or less")
    return text


def _audit_id_or_system(value):
    text = str(value or "").strip() or SYSTEM_OPERATOR_ID
    return _validate_audit_id(text, "operator_id")


def _optional_text(value):
    if value is None:
        return ""
    return str(value)


def _conflict_body(latest, base_updated_at, latest_updated_at, changed_rows):
    return {
        "success": False,
        "error": "他の更新があります。最新内容を確認してください。",
        "latestHeader": latest.get("header"),
        "latestRows": latest.get("rows"),
        "conflictCells": _conflict_cells(latest.get("rows", []), changed_rows),
        "baseUpdatedAt": base_updated_at,
        "latestUpdatedAt": latest_updated_at,
    }


def _conflict_cells(latest_rows, changed_rows):
    latest_by_day = {row.get("attendanceDay"): row for row in latest_rows}
    fields = {
        "start_time": "startTime",
        "end_time": "endTime",
        "break_minutes": "breakMinutes",
        "work_type_code": "workTypeCode",
        "work_description": "workDescription",
        "late_early_minutes": "lateEarlyMinutes",
    }
    cells = []
    for raw in changed_rows or []:
        row = normalize_input_row(raw)
        attendance_day = row.get("attendance_day")
        latest = latest_by_day.get(attendance_day, {})
        for snake, camel in fields.items():
            submitted = _conflict_value(row.get(snake))
            current = _conflict_value(latest.get(camel))
            if str(submitted) != str(current):
                cells.append({
                    "attendanceDay": attendance_day,
                    "field": camel,
                    "latestValue": current,
                    "submittedValue": submitted,
                })
    return cells


def _conflict_value(value):
    if value is None:
        return ""
    return str(value)


def _is_active(row):
    value = row.get("is_active")
    if value is None:
        value = row.get("isActive")
    return value is not False


def _parse_int(value):
    if value in (None, ""):
        return None
    text = str(value).strip()
    if not text or not text.lstrip("+-").isdigit():
        return None
    try:
        return int(text)
    except (TypeError, ValueError):
        return None


def _normal_work_time_result(row_no, field, message):
    result = {
        "code": "NORMAL_WORK_TIME_INVALID",
        "severity": "error",
        "field": field,
        "message": message,
    }
    if row_no:
        result["rowNo"] = row_no
    return result


def _normal_work_time_error_body(errors):
    return {
        "success": False,
        "errors": errors,
        "validationResults": errors,
    }


def _new_id(prefix):
    return f"{prefix}{uuid4().hex[:19]}".upper()
