import json
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = BACKEND_DIR.parent
RESULT_PATHS = [
    BACKEND_DIR / "test-results" / "result.json",
    PROJECT_DIR / "test-results" / "result.json",
]
METADATA_DIR = BACKEND_DIR / "tests" / "metadata"
OUTPUT_DIR = BACKEND_DIR / "test-results"
SHEET_NAME = "TestResult"
OUTPUT_BASENAME = "ユーザ登録API"

HEADERS = [
    "テストID",
    "画面名(API名)",
    "テスト項目",
    "入力値(employee_id)",
    "入力値(email)",
    "期待結果",
    "実際結果",
    "判定",
    "実行日時",
]


def load_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def load_metadata():
    metadata = []

    for path in sorted(METADATA_DIR.glob("*.metadata.json")):
        loaded = load_json(path)
        if isinstance(loaded, list):
            metadata.extend(loaded)
        else:
            metadata.append(loaded)

    return metadata


def find_result_path():
    existing_paths = [path for path in RESULT_PATHS if path.exists()]
    if existing_paths:
        return max(existing_paths, key=lambda path: path.stat().st_mtime)

    candidates = "\n".join(str(path) for path in RESULT_PATHS)
    raise FileNotFoundError(f"result.jsonが見つかりません:\n{candidates}")


def index_metadata(metadata):
    by_nodeid = {}
    by_test_name = {}

    for item in metadata:
        nodeid = item.get("nodeid")
        test_name = item.get("testName")

        if nodeid:
            by_nodeid[nodeid] = item
        if test_name:
            by_test_name[test_name] = item

    return by_nodeid, by_test_name


def find_metadata(test, by_nodeid, by_test_name):
    nodeid = test.get("nodeid", "")
    test_name = nodeid.rsplit("::", 1)[-1]

    if nodeid in by_nodeid:
        return by_nodeid[nodeid]

    for metadata_nodeid, item in by_nodeid.items():
        if nodeid.endswith(metadata_nodeid) or metadata_nodeid.endswith(nodeid):
            return item

    return by_test_name.get(test_name)


def format_execution_time(result_json):
    created = result_json.get("created")
    if created:
        return datetime.fromtimestamp(created).strftime("%Y-%m-%d %H:%M:%S")
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


def get_failure_message(test):
    call = test.get("call") or {}
    setup = test.get("setup") or {}
    teardown = test.get("teardown") or {}

    for section in (call, setup, teardown):
        longrepr = section.get("longrepr")
        if longrepr:
            return str(longrepr)

    return test.get("outcome", "failed")


def get_runtime_value(test, key, default=""):
    metadata = test.get("metadata") or {}
    return metadata.get(key) or default


def build_rows(result_json, metadata):
    by_nodeid, by_test_name = index_metadata(metadata)
    execution_time = format_execution_time(result_json)
    rows = []

    for test in result_json.get("tests", []):
        meta = find_metadata(test, by_nodeid, by_test_name)
        if not meta:
            continue

        passed = test.get("outcome") == "passed"
        expected = meta.get("expected", "")

        rows.append([
            meta.get("testId", ""),
            meta.get("screenName", ""),
            meta.get("testName", ""),
            get_runtime_value(test, "input_employee_id", meta.get("input_employee_id", "")),
            get_runtime_value(test, "input_email", meta.get("input_email", "")),
            expected,
            expected if passed else get_failure_message(test),
            "OK" if passed else "NG",
            execution_time,
        ])

    return rows


def write_excel(rows):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = SHEET_NAME

    worksheet.append(HEADERS)
    for row in rows:
        worksheet.append(row)

    output_basename = rows[0][1] or OUTPUT_BASENAME
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = OUTPUT_DIR / f"{output_basename}_{timestamp}.xlsx"
    workbook.save(output_path)
    return output_path


def main():
    result_path = find_result_path()
    result_json = load_json(result_path)
    metadata = load_metadata()
    rows = build_rows(result_json, metadata)

    if not rows:
        raise RuntimeError("metadataに一致するテスト結果がありません")

    output_path = write_excel(rows)
    print(f"Excel出力完了: {output_path}")


if __name__ == "__main__":
    main()
