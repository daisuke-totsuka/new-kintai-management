from decimal import Decimal


class AttendanceAggregationService:
    def aggregate(self, rows):
        summary = {
            "total_work_days": Decimal("0"),
            "normal_work_days": Decimal("0"),
            "holiday_work_days": Decimal("0"),
            "absence_days": Decimal("0"),
            "paid_leave_days": Decimal("0"),
            "total_actual_work_minutes": 0,
            "late_early_minutes": Decimal("0"),
            "midnight_minutes": 0,
        }

        start_count = Decimal("0")
        for row in rows:
            work_type = str(row.get("work_type_code") or "").strip()
            has_start = bool(row.get("start_time"))

            if has_start or work_type == "休業":
                summary["total_work_days"] += Decimal("1")
            if has_start:
                start_count += Decimal("1")
            if work_type == "休出":
                summary["holiday_work_days"] += Decimal("1")
            if work_type == "欠勤":
                summary["absence_days"] += Decimal("1")
            if work_type == "有休":
                summary["paid_leave_days"] += Decimal("1")
            if work_type in {"前休", "後休"}:
                summary["paid_leave_days"] += Decimal("0.5")

            summary["total_actual_work_minutes"] += int(row.get("actual_work_minutes") or 0)
            summary["midnight_minutes"] += int(row.get("midnight_minutes") or 0)
            summary["late_early_minutes"] += Decimal(str(row.get("late_early_minutes") or 0))

        summary["normal_work_days"] = start_count - summary["holiday_work_days"]
        return {key: _number(value) for key, value in summary.items()}


def _number(value):
    if isinstance(value, Decimal):
        return float(value)
    return value
