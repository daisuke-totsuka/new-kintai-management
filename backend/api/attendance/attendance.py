from flask import Blueprint, jsonify, request

from common.auth import get_current_user
from services.attendance_monthly_service import AttendanceMonthlyService


attendance_bp = Blueprint("attendance", __name__)

MAX_OPERATOR_ID_LENGTH = 20
SAVE_ERROR_MESSAGE = "保存処理でエラーが発生しました。"


def _require_user():
    current = get_current_user()
    return current is not None


def _current_user():
    current = get_current_user()
    if current is None:
        return None, (jsonify({"error": "Unauthorized"}), 401)
    return current, None


def _current_user_id(current):
    value = current.get("user_id") or current.get("userId") or current.get("id")
    text = str(value or "").strip()
    return text or None


def _operator_id(current):
    value = current.get("employee_id") or current.get("employeeId")
    if value is None:
        user_id = _current_user_id(current)
        if user_id and len(user_id) <= MAX_OPERATOR_ID_LENGTH:
            value = user_id
    text = str(value or "").strip()
    return text or None


def _operator_error(operator_id):
    if not operator_id:
        return jsonify({"error": "operator_id is required"}), 400
    if len(operator_id) > MAX_OPERATOR_ID_LENGTH:
        return jsonify({"error": f"operator_id must be {MAX_OPERATOR_ID_LENGTH} characters or less"}), 400
    return None


def _authorize_user_id(requested_user_id, current):
    requested = str(requested_user_id or "").strip()
    if not requested:
        return None, (jsonify({"error": "userId is required"}), 400)

    current_user_id = _current_user_id(current)
    if not current_user_id:
        return None, (jsonify({"error": "Authenticated user id is missing"}), 401)

    if requested != current_user_id:
        return None, (jsonify({"error": "Forbidden"}), 403)

    return current_user_id, None


def _authorized_payload(data, current):
    requested = data.get("userId") or data.get("user_id")
    user_id, error = _authorize_user_id(requested, current)
    if error:
        return None, error

    payload = dict(data)
    payload["userId"] = user_id
    operator_id = _operator_id(current)
    error = _operator_error(operator_id)
    if error:
        return None, error
    payload["operator_id"] = operator_id
    return payload, None


def _service():
    return AttendanceMonthlyService()


def _save_error_response(error):
    return jsonify({"message": SAVE_ERROR_MESSAGE, "detail": str(error)}), 500


@attendance_bp.route("/api/attendance/monthly", methods=["GET"])
def get_monthly():
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    user_id, permission_error = _authorize_user_id(request.args.get("userId"), current)
    if permission_error:
        return permission_error
    try:
        body = _service().get_monthly(
            user_id,
            request.args.get("targetYear"),
            request.args.get("targetMonth"),
        )
        return jsonify(body)
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@attendance_bp.route("/api/attendance/monthly", methods=["POST"])
def save_monthly():
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400
    data, permission_error = _authorized_payload(data, current)
    if permission_error:
        return permission_error
    try:
        body, status = _service().save_monthly(data)
        return jsonify(body), status
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return _save_error_response(error)


@attendance_bp.route("/api/attendance/monthly/validate", methods=["POST"])
def validate_monthly():
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400
    data, permission_error = _authorized_payload(data, current)
    if permission_error:
        return permission_error
    try:
        body, status = _service().validate_monthly(data)
        return jsonify(body), status
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return _save_error_response(error)


@attendance_bp.route("/api/attendance/monthly/submit", methods=["POST"])
def submit_monthly():
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400
    data, permission_error = _authorized_payload(data, current)
    if permission_error:
        return permission_error
    try:
        body, status = _service().submit_monthly(data)
        return jsonify(body), status
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return _save_error_response(error)


@attendance_bp.route("/api/attendance/monthly/unlock", methods=["POST"])
def unlock_monthly():
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400
    data, permission_error = _authorized_payload(data, current)
    if permission_error:
        return permission_error
    try:
        body, status = _service().unlock_monthly(data)
        return jsonify(body), status
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return _save_error_response(error)


@attendance_bp.route("/api/attendance/work-types", methods=["GET"])
def list_work_types():
    if not _require_user():
        return jsonify({"error": "Unauthorized"}), 401
    return jsonify(_service().list_work_types())


@attendance_bp.route("/api/attendance/holidays", methods=["GET"])
def list_holidays():
    if not _require_user():
        return jsonify({"error": "Unauthorized"}), 401
    try:
        return jsonify(_service().list_holidays(request.args.get("targetYear"), request.args.get("targetMonth")))
    except ValueError as error:
        return jsonify({"error": str(error)}), 400


@attendance_bp.route("/api/attendance/normal-work-time", methods=["GET"])
def get_normal_work_time():
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    user_id, permission_error = _authorize_user_id(request.args.get("userId"), current)
    if permission_error:
        return permission_error
    return jsonify(_service().get_normal_work_time(user_id))


@attendance_bp.route("/api/attendance/normal-work-time", methods=["PUT"])
def update_normal_work_time():
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    data = request.get_json(silent=True)
    if data is None:
        return jsonify({"error": "Invalid JSON"}), 400
    data, permission_error = _authorized_payload(data, current)
    if permission_error:
        return permission_error
    try:
        body, status = _service().update_normal_work_time(data)
        return jsonify(body), status
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return _save_error_response(error)


@attendance_bp.route("/api/attendance/normal-work-time/<setting_id>", methods=["DELETE"])
def delete_normal_work_time(setting_id):
    current, auth_error = _current_user()
    if auth_error:
        return auth_error
    user_id = _current_user_id(current)
    if not user_id:
        return jsonify({"error": "Authenticated user id is missing"}), 401
    try:
        body, status = _service().delete_normal_work_time(setting_id, user_id)
        return jsonify(body), status
    except ValueError as error:
        return jsonify({"error": str(error)}), 400
    except Exception as error:
        return _save_error_response(error)
