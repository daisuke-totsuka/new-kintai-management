import re


class WorkTimeCalculationService:
    def parse_time(self, value):
        if value is None or str(value).strip() == "":
            return None

        text = str(value).strip()
        matched = re.match(r"^(\d{2}):(\d{2})(?::\d{2})?$", text)
        if not matched:
            return None

        hour = int(matched.group(1))
        minute = int(matched.group(2))
        if hour < 0 or hour > 23 or minute < 0 or minute > 59:
            return None
        return hour * 60 + minute

    def format_time(self, minutes):
        if minutes is None:
            return None
        minutes = minutes % (24 * 60)
        return f"{minutes // 60:02d}:{minutes % 60:02d}"

    def actual_work_minutes(self, start_time, end_time, break_minutes):
        start = self.parse_time(start_time)
        end = self.parse_time(end_time)
        if start is None or end is None or break_minutes is None:
            return None

        try:
            rest = int(break_minutes)
        except (TypeError, ValueError):
            return None

        if end <= start:
            end += 24 * 60

        actual = end - start - rest
        if actual < 0:
            return None
        return actual

    def is_same_day(self, start_time, end_time):
        start = self.parse_time(start_time)
        end = self.parse_time(end_time)
        return start is not None and end is not None and start < end

    def required_break_minutes(self, start_time, end_time, normal_break_minutes):
        start = self.parse_time(start_time)
        end = self.parse_time(end_time)
        if start is None or end is None or normal_break_minutes is None:
            return 0

        if end <= start:
            end += 24 * 60

        elapsed = end - start
        base = int(normal_break_minutes)
        if elapsed <= 360:
            return 0
        if elapsed - base > 720:
            return base + 60
        if elapsed - base > 480:
            return base + 30
        return base

    def has_break_shortage(self, start_time, end_time, break_minutes, normal_break_minutes):
        if start_time in (None, "") or end_time in (None, ""):
            return False
        if break_minutes is None:
            return True

        try:
            rest = int(break_minutes)
        except (TypeError, ValueError):
            return True

        return rest < self.required_break_minutes(start_time, end_time, normal_break_minutes)
