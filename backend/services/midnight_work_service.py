from services.work_time_calculation_service import WorkTimeCalculationService


class MidnightWorkService:
    def __init__(self):
        self.work_time = WorkTimeCalculationService()

    def calculate_midnight_minutes(self, start_time, end_time, break_minutes=0):
        start = self.work_time.parse_time(start_time)
        end = self.work_time.parse_time(end_time)
        if start is None or end is None:
            return 0

        if end <= start:
            end += 24 * 60

        intervals = [(22 * 60, 24 * 60), (24 * 60, 29 * 60)]
        if start < 5 * 60:
            intervals.append((0, 5 * 60))

        midnight = 0
        for interval_start, interval_end in intervals:
            midnight += max(0, min(end, interval_end) - max(start, interval_start))

        try:
            rest = int(break_minutes or 0)
        except (TypeError, ValueError):
            rest = 0

        return max(0, midnight - min(rest, midnight))
