from __future__ import annotations

from datetime import date, datetime
import os
from typing import Any

from flask import Flask, jsonify, request
from flask_cors import CORS


def parse_time_to_minutes(value: str | None) -> int | None:
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    if len(value) != 5 or value[2] != ":":
        return None
    try:
        hour = int(value[:2])
        minute = int(value[3:])
    except ValueError:
        return None
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        return None
    return hour * 60 + minute


def is_future_date(iso_date: str) -> bool:
    try:
        d = datetime.strptime(iso_date, "%Y-%m-%d").date()
    except ValueError:
        return False
    return d > date.today()


def create_app() -> Flask:
    app = Flask(__name__)
    env = os.getenv("ENV", "development")
    allow_origin = os.getenv("CORS_ORIGIN", "http://localhost:3000")
    debug = env == "development"

    CORS(app, resources={r"/api/*": {"origins": allow_origin}})
    app.config["JSON_AS_ASCII"] = False
    app.config["ENV"] = env
    app.config["DEBUG"] = debug

    @app.get("/api/health")
    def health() -> Any:
        return jsonify({"status": "ok", "env": env})

    @app.post("/api/worktime/validate")
    def validate_worktime() -> Any:
        payload = request.get_json(silent=True) or {}
        work_date = payload.get("work_date", "")
        start_time = payload.get("start_time")
        end_time = payload.get("end_time")
        break_minutes = payload.get("break_minutes")
        notes = (payload.get("notes") or "").strip()

        errors: list[dict[str, str]] = []

        if not work_date:
            errors.append({"field": "work_date", "message": "日付が未入力です"})
            return jsonify({"status": "error", "errors": errors}), 400

        try:
            datetime.strptime(work_date, "%Y-%m-%d")
        except ValueError:
            errors.append({"field": "work_date", "message": "存在しない日付です"})
            return jsonify({"status": "error", "errors": errors}), 400

        if is_future_date(work_date):
            return jsonify({"status": "ok", "errors": []})

        has_start = bool(start_time)
        has_end = bool(end_time)
        has_break = break_minutes is not None and break_minutes != ""

        if not has_start and not has_end and not has_break and notes == "":
            return jsonify({"status": "ok", "errors": []})

        if (has_start or has_end or has_break) and not (has_start and has_end and has_break):
            errors.append({"field": "start_time", "message": "開始時刻・終了時刻・休憩時間をすべて入力してください"})
            return jsonify({"status": "error", "errors": errors}), 400

        start_min = parse_time_to_minutes(start_time)
        end_min = parse_time_to_minutes(end_time)
        if start_min is None:
            errors.append({"field": "start_time", "message": "時刻はhh:mm形式で入力してください"})
            return jsonify({"status": "error", "errors": errors}), 400
        if end_min is None:
            errors.append({"field": "end_time", "message": "時刻はhh:mm形式で入力してください"})
            return jsonify({"status": "error", "errors": errors}), 400
        if end_min < start_min:
            errors.append({"field": "end_time", "message": "終了時刻が開始時刻より前です"})
            return jsonify({"status": "error", "errors": errors}), 400

        try:
            break_min = int(break_minutes)
        except (TypeError, ValueError):
            errors.append({"field": "break_minutes", "message": "休憩時間は数値で入力してください"})
            return jsonify({"status": "error", "errors": errors}), 400

        if break_min < 0:
            errors.append({"field": "break_minutes", "message": "休憩時間がマイナスです"})
            return jsonify({"status": "error", "errors": errors}), 400

        work_min = end_min - start_min - break_min
        if work_min < 0:
            errors.append({"field": "break_minutes", "message": "勤務時間がマイナスです"})
            return jsonify({"status": "error", "errors": errors}), 400
        if work_min >= 24 * 60:
            errors.append({"field": "end_time", "message": "勤務時間が24時間以上です"})
            return jsonify({"status": "error", "errors": errors}), 400

        if len(notes) > 20:
            errors.append({"field": "notes", "message": "備考は全角20文字以内にしてください"})
            return jsonify({"status": "error", "errors": errors}), 400

        return jsonify({"status": "ok", "errors": []})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=app.config["DEBUG"])
