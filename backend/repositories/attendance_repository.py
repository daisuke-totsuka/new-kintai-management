import json
import logging

from db.connection import DBConnection


logger = logging.getLogger(__name__)


class AttendanceRepository:
    def __init__(self):
        self.db = DBConnection()

    def find_header(self, user_id, target_year, target_month):
        return self.db.find_one(
            table="attendance_monthly_headers",
            filters={
                "user_id": user_id,
                "target_year": target_year,
                "target_month": target_month,
            },
        )

    def create_header(self, header):
        logger.warning(
            "attendance_monthly_headers INSERT JSON: %s",
            json.dumps(header, ensure_ascii=False, default=str),
        )
        logger.warning(
            "attendance_monthly_headers INSERT lengths: %s",
            json.dumps(
                {column: _value_length(value) for column, value in header.items()},
                ensure_ascii=False,
            ),
        )
        return self.db.insert(table="attendance_monthly_headers", data=header)

    def update_header(self, header_id, data):
        return self.db.update(
            table="attendance_monthly_headers",
            filters={"id": header_id},
            data=data,
        )

    def find_daily_records(self, header_id):
        return self.db.find_all(
            table="attendance_daily_records",
            filters={"monthly_header_id": header_id},
        )

    def find_daily_record(self, header_id, attendance_day):
        return self.db.find_one(
            table="attendance_daily_records",
            filters={
                "monthly_header_id": header_id,
                "attendance_day": attendance_day,
            },
        )

    def create_daily_record(self, record):
        return self.db.insert(table="attendance_daily_records", data=record)

    def update_daily_record(self, record_id, record):
        return self.db.update(
            table="attendance_daily_records",
            filters={"id": record_id},
            data=record,
        )

    def delete_daily_record(self, header_id, attendance_day):
        return self.db.delete(
            table="attendance_daily_records",
            filters={
                "monthly_header_id": header_id,
                "attendance_day": attendance_day,
            },
        )

    def find_summary(self, header_id):
        return self.db.find_one(
            table="attendance_summaries",
            filters={"monthly_header_id": header_id},
        )

    def create_summary(self, summary):
        return self.db.insert(table="attendance_summaries", data=summary)

    def update_summary(self, header_id, summary):
        return self.db.update(
            table="attendance_summaries",
            filters={"monthly_header_id": header_id},
            data=summary,
        )

    def replace_summary(self, header_id, summary):
        current = self.find_summary(header_id)
        data = dict(summary)
        data["monthly_header_id"] = header_id
        if current:
            return self.update_summary(header_id, data)
        return self.create_summary(data)

    def find_validation_results(self, header_id):
        return self.db.find_all(
            table="attendance_validation_results",
            filters={"monthly_header_id": header_id},
        )

    def replace_validation_results(self, header_id, results):
        self.db.delete(
            table="attendance_validation_results",
            filters={"monthly_header_id": header_id},
        )
        stored = []
        for result in results:
            row = dict(result)
            row["monthly_header_id"] = header_id
            stored.append(self.db.insert(table="attendance_validation_results", data=row) or row)
        return stored

    def find_work_types(self):
        rows = self.db.find_all(table="work_type_masters", filters={"is_active": True})
        return sorted(rows, key=lambda row: str(row.get("work_type_code") or ""))

    def find_holidays(self):
        return self.db.find_all(table="holiday_masters")

    def find_workday_overrides(self):
        return self.db.find_all(table="workday_override_masters")

    def find_normal_work_time_settings(self, user_id):
        return self.db.find_all(
            table="normal_work_time_settings",
            filters={"user_id": user_id},
        )

    def create_normal_work_time_setting(self, setting):
        return self.db.insert(table="normal_work_time_settings", data=setting)

    def update_normal_work_time_setting(self, setting_id, setting):
        return self.db.update(
            table="normal_work_time_settings",
            filters={"id": setting_id},
            data=setting,
        )

    def delete_normal_work_time_setting(self, setting_id, user_id):
        return self.db.delete(
            table="normal_work_time_settings",
            filters={"id": setting_id, "user_id": user_id},
        )


def _value_length(value):
    if value is None:
        return 0
    return len(str(value))
