import calendar
from datetime import date, timedelta


WEEKDAYS_JA = ["月", "火", "水", "木", "金", "土", "日"]


class HolidayCalendarService:
    def __init__(self, repo=None):
        self.repo = repo

    def validate_year_month(self, target_year, target_month):
        try:
            target_year = int(target_year)
            target_month = int(target_month)
        except (TypeError, ValueError):
            return None, None

        if target_year < 1 or target_year > 3000 or target_month < 1 or target_month > 12:
            return None, None
        return target_year, target_month

    def days_for_month(self, target_year, target_month):
        target_year, target_month = self.validate_year_month(target_year, target_month)
        if target_year is None:
            return []

        holiday_map = self._holiday_map()
        substitute_holidays = self._substitute_holidays(holiday_map)
        override_map = self._override_map()
        days = []
        _, last_day = calendar.monthrange(target_year, target_month)

        for day in range(1, last_day + 1):
            current = date(target_year, target_month, day)
            iso = current.isoformat()
            weekday = current.weekday()
            holiday_flag = 0

            if weekday == 5:
                holiday_flag = 1
            elif weekday == 6:
                holiday_flag = 3

            if iso in holiday_map:
                holiday_flag = int(holiday_map[iso].get("holiday_flag") or 2)
            elif iso in substitute_holidays:
                holiday_flag = 2

            if iso in override_map:
                holiday_flag = int(override_map[iso].get("holiday_flag") or 4)

            days.append({
                "attendance_day": day,
                "day_of_week": WEEKDAYS_JA[weekday],
                "holiday_flag": holiday_flag,
            })

        return days

    def is_holiday(self, row):
        try:
            return int(row.get("holiday_flag") or 0) in {1, 2, 3}
        except (TypeError, ValueError):
            return False

    def _holiday_map(self):
        if not self.repo:
            return {}
        return {
            str(row.get("holiday_date") or row.get("date"))[:10]: row
            for row in self.repo.find_holidays()
        }

    def _substitute_holidays(self, holiday_map):
        substitute_dates = set()
        for iso in holiday_map:
            try:
                holiday = date.fromisoformat(str(iso)[:10])
            except ValueError:
                continue
            if holiday.weekday() == 6:
                substitute_dates.add((holiday + timedelta(days=1)).isoformat())
        return substitute_dates

    def _override_map(self):
        if not self.repo:
            return {}
        return {
            str(row.get("work_date") or row.get("date"))[:10]: row
            for row in self.repo.find_workday_overrides()
        }
