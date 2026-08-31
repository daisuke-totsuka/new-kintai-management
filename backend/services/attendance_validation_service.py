import calendar
from decimal import Decimal, InvalidOperation

from services.holiday_service import HolidayCalendarService
from services.midnight_work_service import MidnightWorkService
from services.work_time_calculation_service import WorkTimeCalculationService


MAX_LATE_EARLY_MINUTES = Decimal("999.5")

ERROR_MESSAGES = {
    "E001": "基本時間の入力がありません。",
    "E002": "範囲外の入力があります。",
    "E003": "{day}日の実働時間が15分単位になっていません。",
    "E004": "{day}日の始業時間が一致しません。",
    "E005": "{day}日の終業時間が一致しません。",
    "E006": "{day}日の作業内容が未入力です。",
    "E007": "{day}日の勤務時間が未入力です。",
    "E008": "{day}日に勤務時間が入力されてます。",
    "E009": "{day}日は休日のため、欠勤を指定できません。",
    "E010": "{day}日は休日です。",
    "E011": "{day}日は休日出勤の条件を満たしていません。",
    "E012": "{day}日は通常出勤時間と一致しません。",
    "E013": "{day}日の勤務時間が6時間未満です。",
    "E014": "{day}日の勤務時間が8時間未満です。",
    "E015": "{day}日の休憩時間が基準時間に達していません。",
    "E016": "{day}日の遅刻早退時間が未入力です。",
    "E017": "{day}日の遅刻早退時間が30分単位になっていません。",
    "E018": "{day}日の勤務区分がリストにありません。",
    "E019": "祝日表の入力年が不正です。",
    "E020": "祝日表の入力月が不正です。",
}

ERROR_MESSAGES.update({
    "E001": "通常勤務時間が設定されていません。",
    "E002": "日が対象年月の範囲外です。",
    "E003": "5分単位で入力してください。",
    "E004": "通常勤務開始時刻と一致しません。",
    "E005": "通常勤務終了時刻と一致しません。",
    "E006": "必須です。",
    "E007": "必須です。",
    "E008": "勤務時間は入力できません。",
    "E009": "休日のため欠勤を指定できません。",
    "E010": "休日です。",
    "E011": "休日出勤の条件を満たしていません。",
    "E012": "通常勤務時間と一致しません。",
    "E013": "勤務時間が6時間未満です。",
    "E014": "勤務時間が8時間未満です。",
    "E015": "基準の休憩時間に達していません。",
    "E016": "必須です。",
    "E017": f"0以上{MAX_LATE_EARLY_MINUTES}以下、30分単位で入力してください。",
    "E018": "登録済みの勤務区分を選択してください。",
    "E019": "対象年が不正です。",
    "E020": "対象月が不正です。",
    "FORMAT_TIME": "HH:mm形式で入力してください。",
    "FORMAT_BREAK": "0以上の整数で入力してください。",
    "TIME_ORDER": "出勤時刻より前です。",
    "NORMAL_WORK_TIME_MULTIPLE": "通常勤務時間の適用期間が複数の設定に該当しています。設定を確認してください。",
})


class AttendanceValidationService:
    def __init__(self, holiday_service=None, work_time_service=None, midnight_service=None):
        self.holidays = holiday_service or HolidayCalendarService()
        self.work_time = work_time_service or WorkTimeCalculationService()
        self.midnight = midnight_service or MidnightWorkService()

    def validate_save(self, target_year, target_month, rows, valid_work_type_codes=None):
        results = []
        target_year_value, target_month_value, target_year_month_errors = self._validate_target_year_month(target_year, target_month)
        if target_year_month_errors:
            results.extend(target_year_month_errors)
            return results

        for raw in rows:
            row = normalize_input_row(raw)
            attendance_day = row.get("attendance_day")
            day = _day(attendance_day)
            if not _day_in_month(attendance_day, target_year_value, target_month_value):
                results.append(self._result("E002", attendance_day, "attendance_day", day))
                continue
            results.extend(self._validate_input_format(row, day, valid_work_type_codes))
        return results

    def _validate_target_year_month(self, target_year, target_month):
        results = []

        try:
            target_year_value = int(target_year)
        except (TypeError, ValueError):
            target_year_value = None
        if target_year_value is None or target_year_value < 1 or target_year_value > 3000:
            results.append(self._result("E019", None, "target_year"))

        try:
            target_month_value = int(target_month)
        except (TypeError, ValueError):
            target_month_value = None
        if target_month_value is None or target_month_value < 1 or target_month_value > 12:
            results.append(self._result("E020", None, "target_month"))

        return target_year_value, target_month_value, results

    def validate_submit(self, target_year, target_month, rows, normal_work_times, valid_work_type_codes=None):
        results = self.validate_save(target_year, target_month, rows, valid_work_type_codes)
        if any(item["severity"] == "error" for item in results):
            return results, rows

        calculated_rows = []
        for raw in rows:
            row = normalize_input_row(raw)
            day = _day(row.get("attendance_day"))
            normal_candidates = self._normal_work_times_for_day(normal_work_times, day)
            if len(normal_candidates) == 0:
                results.append(self._result("E001", row.get("attendance_day"), "normal_work_time", day))
                normal = None
            elif len(normal_candidates) > 1:
                results.append(self._result("NORMAL_WORK_TIME_MULTIPLE", row.get("attendance_day"), "normal_work_time", day))
                normal = normal_candidates[0]
            else:
                normal = normal_candidates[0]
            work_type = str(row.get("work_type_code") or "").strip()

            actual = self.work_time.actual_work_minutes(
                row.get("start_time"),
                row.get("end_time"),
                row.get("break_minutes"),
            )
            row["actual_work_minutes"] = actual
            row["midnight_minutes"] = self.midnight.calculate_midnight_minutes(
                row.get("start_time"),
                row.get("end_time"),
                row.get("break_minutes"),
            ) if actual is not None else 0
            row["warning_flag"] = False

            if _is_unknown_work_type(work_type, valid_work_type_codes):
                results.append(self._result("E018", row.get("attendance_day"), "work_type_code", day))
                calculated_rows.append(row)
                continue

            if actual is not None:
                if actual % 5 != 0:
                    results.append(self._result("E003", row.get("attendance_day"), "actual_work_minutes", day))
                elif actual % 15 != 0:
                    row["warning_flag"] = True
                    results.append({
                        "code": "WARNING_15_MINUTES",
                        "severity": "warning",
                        "attendance_day": row.get("attendance_day"),
                        "field": "actual_work_minutes",
                        "message": "実働時間が15分単位ではありません。",
                    })

            self._validate_work_type_row(row, normal, results)
            calculated_rows.append(row)

        return results, calculated_rows

    def _validate_input_format(self, row, day, valid_work_type_codes=None):
        results = []
        attendance_day = row.get("attendance_day")

        invalid_time_fields = set()
        for field in ("start_time", "end_time"):
            value = row.get(field)
            if value not in (None, "") and self.work_time.parse_time(value) is None:
                invalid_time_fields.add(field)
                results.append(self._result("FORMAT_TIME", attendance_day, field, day))

        start = self.work_time.parse_time(row.get("start_time"))
        end = self.work_time.parse_time(row.get("end_time"))
        if (
            "start_time" not in invalid_time_fields
            and "end_time" not in invalid_time_fields
            and start is not None
            and end is not None
            and end < start
            and not row.get("work_type_code")
        ):
            results.append(self._result("TIME_ORDER", attendance_day, "end_time", day))

        break_value = row.get("break_minutes")
        if break_value not in (None, ""):
            try:
                if int(break_value) < 0:
                    raise ValueError
            except (TypeError, ValueError):
                results.append(self._result("FORMAT_BREAK", attendance_day, "break_minutes", day))

        late_early = row.get("late_early_minutes")
        if late_early not in (None, "") and not _is_thirty_minute_unit(late_early):
            results.append(self._result("E017", attendance_day, "late_early_minutes", day))

        work_type = str(row.get("work_type_code") or "").strip()
        if _is_unknown_work_type(work_type, valid_work_type_codes):
            results.append(self._result("E018", attendance_day, "work_type_code", day))
        return results

    def _validate_work_type_row(self, row, normal, results):
        work_type = str(row.get("work_type_code") or "").strip()
        if work_type == "":
            self._validate_normal_work(row, normal, results)
        elif work_type == "休出":
            self._validate_holiday_work(row, normal, results)
        elif work_type == "有休":
            self._validate_full_day_leave(row, normal, results)
        elif work_type == "前休":
            self._validate_front_half_leave(row, normal, results)
        elif work_type == "後休":
            self._validate_full_day_leave(row, normal, results, require_content=True)
        elif work_type == "特休":
            self._validate_full_day_leave(row, normal, results)
        elif work_type == "振休":
            self._validate_comp_leave(row, normal, results)
        elif work_type == "振予":
            self._validate_comp_plan(row, results)
        elif work_type == "欠勤":
            self._validate_absence(row, results)
        elif work_type == "遅刻":
            self._validate_late(row, normal, results)
        elif work_type == "早退":
            self._validate_early(row, normal, results)
        elif work_type == "遅延":
            self._validate_delay(row, normal, results)
        elif work_type == "ｼﾌﾄ":
            self._validate_shift(row, normal, results)
        elif work_type == "休業":
            self._validate_closure(row, results)

    def _validate_normal_work(self, row, normal, results):
        if self.holidays.is_holiday(row):
            return
        self._validate_required_time_fields(row, results)
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        self._validate_start_equals(row, normal, results)
        self._validate_end_not_before(row, normal, results)
        self._validate_break(row, normal, results)

    def _validate_holiday_work(self, row, normal, results):
        if not self.holidays.is_holiday(row):
            self._add(results, "E011", row, "work_type_code")
        self._validate_required_time_fields(row, results)
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        if row.get("actual_work_minutes") is not None and row.get("actual_work_minutes") < 360:
            self._add(results, "E011", row, "actual_work_minutes")
        self._validate_break(row, normal, results)

    def _validate_full_day_leave(self, row, normal, results, require_content=False):
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        self._validate_required_time_fields(row, results)
        if require_content and not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        self._validate_start_equals(row, normal, results)
        self._validate_end_equals(row, normal, results)
        self._validate_break(row, normal, results)

    def _validate_front_half_leave(self, row, normal, results):
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        self._validate_required_time_fields(row, results)
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        self._validate_start_equals(row, normal, results)
        self._validate_end_not_before(row, normal, results)
        self._validate_break(row, normal, results)

    def _validate_comp_leave(self, row, normal, results):
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        self._validate_required_time_fields(row, results)
        actual = row.get("actual_work_minutes")
        if actual is not None and actual < 360:
            self._add(results, "E013", row, "actual_work_minutes")
        elif actual is not None and actual < 480:
            row["warning_flag"] = True
            self._add(results, "E014", row, "actual_work_minutes", severity="warning")
        self._validate_break(row, normal, results)

    def _validate_comp_plan(self, row, results):
        if not self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        if self._has_any_time(row):
            self._add(results, "E008", row, "start_time")

    def _validate_absence(self, row, results):
        if self.holidays.is_holiday(row):
            self._add(results, "E009", row, "work_type_code")
        if self._has_any_time(row):
            self._add(results, "E008", row, "start_time")

    def _validate_late(self, row, normal, results):
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        self._validate_required_time_fields(row, results)
        if row.get("late_early_minutes") in (None, ""):
            self._add(results, "E016", row, "late_early_minutes")
        elif not _is_thirty_minute_unit(row.get("late_early_minutes")):
            self._add(results, "E017", row, "late_early_minutes")
        else:
            start = self.work_time.parse_time(row.get("start_time"))
            if start is not None and normal and start - int(Decimal(str(row.get("late_early_minutes")))) > normal["start_minutes"]:
                self._add(results, "E004", row, "start_time")
        self._validate_end_not_before(row, normal, results)
        self._validate_break(row, normal, results)

    def _validate_early(self, row, normal, results):
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        self._validate_required_time_fields(row, results)
        if row.get("late_early_minutes") in (None, ""):
            self._add(results, "E016", row, "late_early_minutes")
        elif not _is_thirty_minute_unit(row.get("late_early_minutes")):
            self._add(results, "E017", row, "late_early_minutes")
        else:
            self._validate_start_equals(row, normal, results)
            end = self.work_time.parse_time(row.get("end_time"))
            if end is not None and normal:
                adjusted = end + int(Decimal(str(row.get("late_early_minutes"))))
                if adjusted < normal["end_minutes"]:
                    self._add(results, "E005", row, "end_time")
        self._validate_break(row, normal, results)

    def _validate_delay(self, row, normal, results):
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        self._validate_end_not_before(row, normal, results)
        self._validate_break(row, normal, results)

    def _validate_shift(self, row, normal, results):
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        self._validate_break(row, normal, results)

    def _validate_closure(self, row, results):
        if not _has_text(row.get("work_description")):
            self._add(results, "E006", row, "work_description")
        if self.holidays.is_holiday(row):
            self._add(results, "E010", row, "work_type_code")
        if self._has_any_time(row):
            self._add(results, "E008", row, "start_time")

    def _validate_start_equals(self, row, normal, results):
        if not normal:
            return
        start = self.work_time.parse_time(row.get("start_time"))
        if start is not None and start != normal["start_minutes"]:
            self._add(results, "E004", row, "start_time")

    def _validate_end_equals(self, row, normal, results):
        if not normal:
            return
        end = self.work_time.parse_time(row.get("end_time"))
        if end is not None and end != normal["end_minutes"]:
            self._add(results, "E005", row, "end_time")

    def _validate_end_not_before(self, row, normal, results):
        if not normal or not self.work_time.is_same_day(row.get("start_time"), row.get("end_time")):
            return
        end = self.work_time.parse_time(row.get("end_time"))
        if end is not None and end < normal["end_minutes"]:
            self._add(results, "E005", row, "end_time")

    def _validate_break(self, row, normal, results):
        if not normal:
            return
        if self.work_time.has_break_shortage(
            row.get("start_time"),
            row.get("end_time"),
            row.get("break_minutes"),
            normal["break_minutes"],
        ):
            self._add(results, "E015", row, "break_minutes")

    def _normal_work_times_for_day(self, settings, day):
        day = _day(day)
        if day is None:
            return []

        usable = []
        for setting in settings or []:
            start = self.work_time.parse_time(setting.get("start_time") or setting.get("startTime"))
            end = self.work_time.parse_time(setting.get("end_time") or setting.get("endTime"))
            break_minutes = setting.get("break_minutes")
            if break_minutes is None:
                break_minutes = setting.get("breakMinutes")
            if start is None or end is None or break_minutes is None:
                continue
            usable.append({
                "from": int(setting.get("effective_from_day") or setting.get("effectiveFromDay") or 1),
                "to": int(setting.get("effective_to_day") or setting.get("effectiveToDay") or 31),
                "start_minutes": start,
                "end_minutes": end,
                "break_minutes": int(break_minutes),
            })

        return [
            item
            for item in sorted(usable, key=lambda row: row["from"])
            if item["from"] <= day <= item["to"]
        ]

    def _validate_required_time_fields(self, row, results):
        for field in ("start_time", "end_time", "break_minutes"):
            if row.get(field) in (None, ""):
                self._add(results, "E007", row, field)

    def _has_required_time(self, row):
        return bool(row.get("start_time") and row.get("end_time") and row.get("break_minutes") not in (None, ""))

    def _has_any_time(self, row):
        return bool(row.get("start_time") or row.get("end_time") or row.get("break_minutes") not in (None, ""))

    def _add(self, results, code, row, field, severity="error"):
        results.append(self._result(code, row.get("attendance_day"), field, _day(row.get("attendance_day")), severity))

    def _result(self, code, attendance_day, field, day=None, severity="error"):
        message = ERROR_MESSAGES[code].format(day=day or "xx")
        return {
            "code": code,
            "severity": severity,
            "attendance_day": attendance_day,
            "field": field,
            "message": message,
        }


def normalize_input_row(raw):
    row = dict(raw or {})
    return {
        "id": row.get("id"),
        "attendance_day": _normalize_attendance_day(row.get("attendance_day") or row.get("attendanceDay")),
        "day_of_week": row.get("day_of_week") or row.get("dayOfWeek") or "",
        "holiday_flag": row.get("holiday_flag") if row.get("holiday_flag") is not None else row.get("holidayFlag", 0),
        "start_time": _blank_to_none(row.get("start_time", row.get("startTime"))),
        "end_time": _blank_to_none(row.get("end_time", row.get("endTime"))),
        "break_minutes": _blank_to_none(row.get("break_minutes", row.get("breakMinutes"))),
        "actual_work_minutes": row.get("actual_work_minutes", row.get("actualWorkMinutes")),
        "work_type_code": str(row.get("work_type_code", row.get("workTypeCode", "")) or "").strip(),
        "work_description": _blank_to_none(row.get("work_description", row.get("workDescription"))),
        "late_early_minutes": _blank_to_none(row.get("late_early_minutes", row.get("lateEarlyMinutes"))),
        "midnight_minutes": row.get("midnight_minutes", row.get("midnightMinutes", 0)),
        "warning_flag": bool(row.get("warning_flag", row.get("warningFlag", False))),
    }


def _blank_to_none(value):
    if value is None:
        return None
    text = str(value).strip()
    return text if text != "" else None


def _normalize_attendance_day(value):
    if value in (None, ""):
        return None
    text = str(value)
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        return int(text[8:10])
    return value


def _day_in_month(attendance_day, target_year, target_month):
    day = _day(attendance_day)
    if day is None:
        return False
    _, last_day = calendar.monthrange(target_year, target_month)
    return 1 <= day <= last_day


def _day(attendance_day):
    try:
        return int(attendance_day)
    except (TypeError, ValueError):
        return None


def _has_text(value):
    return value is not None and str(value).strip() != ""


def _is_thirty_minute_unit(value):
    try:
        decimal = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return False
    return decimal >= 0 and decimal <= MAX_LATE_EARLY_MINUTES and decimal % Decimal("30") == 0


def _is_unknown_work_type(work_type, valid_work_type_codes):
    if not work_type:
        return False
    if valid_work_type_codes is None:
        return False
    return work_type not in valid_work_type_codes
