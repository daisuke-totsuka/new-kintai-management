import json
import re
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

APPROVED_SCREEN_NAMES = [
    "勤務実績",
    "ユーザ管理",
    "ユーザ登録",
    "支店管理",
    "権限管理",
    "権限登録",
    "権限編集",
    "通常勤務時間設定",
    "年度設定",
    "経費請求",
    "業務請求明細",
    "提出状況",
    "確定画面",
    "ログイン",
    "サイドナビ",
    "Next APIプロキシ",
    "DB境界値",
    "権限DB境界値",
    "Excelレポート",
]
APPROVED_SCREEN_NAME_SET = set(APPROVED_SCREEN_NAMES)
ENGLISH_SCREEN_NAMES = {
    "Attendance Settings",
    "Business Bill Details",
    "Dashboard",
    "DB Boundary",
    "Expense Claims",
    "Leader",
    "Login",
    "Next API Proxy",
    "Role DB Boundary",
}
WINDOWS_FILE_NAME_INVALID_PATTERN = re.compile(r'[<>:"/\\|?*\x00-\x1f]')
JAPANESE_PATTERN = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")

HEADERS = [
    "テストID",
    "種別",
    "画面名",
    "テスト項目",
    "入力値",
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
            items = loaded
        else:
            items = [loaded]

        for item in items:
            item["metadataFile"] = path.name
            metadata.append(item)

    return metadata


def validate_metadata(metadata):
    missing_screen_name = [
        format_metadata_item(item)
        for item in metadata
        if not item.get("screenName")
    ]
    missing_test_name = [
        format_metadata_item(item)
        for item in metadata
        if not item.get("testName")
    ]
    missing_test_id = [
        format_metadata_item(item)
        for item in metadata
        if not item.get("testId")
    ]
    invalid_screen_name = [
        format_invalid_screen_name_item(item)
        for item in metadata
        if item.get("screenName") and not is_approved_screen_name(item.get("screenName"))
    ]
    english_only_test_name = [
        format_metadata_item(item)
        for item in metadata
        if item.get("testName") and not contains_japanese(item.get("testName"))
    ]
    duplicate_test_ids = find_duplicates(
        [
            (item.get("testId"), format_metadata_item(item))
            for item in metadata
            if item.get("testId")
        ]
    )
    duplicate_screen_and_test_names = find_duplicates(
        [
            (
                f"{item.get('screenName')}::{item.get('testName')}",
                format_metadata_item(item),
            )
            for item in metadata
            if item.get("screenName") and item.get("testName")
        ]
    )
    errors = []

    if missing_screen_name:
        errors.append("screenNameがありません。\n" + "\n".join(missing_screen_name))

    if missing_test_name:
        errors.append("testNameがありません。\n" + "\n".join(missing_test_name))

    if missing_test_id:
        errors.append("testIdがありません。\n" + "\n".join(missing_test_id))

    if invalid_screen_name:
        errors.append(
            "metadata screenName は正式日本語名称を設定してください。\n"
            + "\n".join(invalid_screen_name)
        )

    if english_only_test_name:
        errors.append(
            "metadata testName は日本語名称を設定してください。\n"
            + "\n".join(english_only_test_name)
        )

    if duplicate_test_ids:
        errors.append("testIdが重複しています。\n" + "\n".join(duplicate_test_ids))

    if duplicate_screen_and_test_names:
        errors.append(
            "screenNameとtestNameの組み合わせが重複しています。\n"
            + "\n".join(duplicate_screen_and_test_names)
        )

    if errors:
        raise RuntimeError("\n\n".join(errors))


def is_approved_screen_name(screen_name):
    value = str(screen_name or "")
    normalized = value.strip()
    return (
        value == normalized
        and normalized in APPROVED_SCREEN_NAME_SET
        and not is_ascii_only(normalized)
        and normalized not in ENGLISH_SCREEN_NAMES
    )


def is_ascii_only(value):
    return str(value or "").isascii()


def contains_japanese(value):
    return bool(JAPANESE_PATTERN.search(str(value or "")))


def find_duplicates(entries):
    by_value = {}

    for value, label in entries:
        by_value.setdefault(value, []).append(label)

    duplicates = []
    for value, labels in by_value.items():
        if len(labels) > 1:
            duplicates.append(str(value))
            duplicates.extend(labels)

    return duplicates


def find_result_path():
    existing_paths = [path for path in RESULT_PATHS if path.exists()]
    if existing_paths:
        return max(existing_paths, key=lambda path: path.stat().st_mtime)

    candidates = "\n".join(str(path) for path in RESULT_PATHS)
    raise FileNotFoundError(f"result.jsonが見つかりません:\n{candidates}")


def normalize_nodeid(value):
    return str(value or "").replace("\\", "/")


def base_test_name(nodeid):
    name = normalize_nodeid(nodeid).rsplit("::", 1)[-1]
    return name.split("[", 1)[0]


def index_metadata(metadata):
    by_nodeid = {}
    by_test_name = {}

    for item in metadata:
        nodeid = normalize_nodeid(item.get("nodeid"))
        test_name = item.get("testName")

        if nodeid:
            by_nodeid[nodeid] = item
        if test_name:
            by_test_name[test_name] = item

    return by_nodeid, by_test_name


def find_metadata(test, by_nodeid, by_test_name):
    nodeid = normalize_nodeid(test.get("nodeid", ""))

    if nodeid in by_nodeid:
        return by_nodeid[nodeid]

    for metadata_nodeid, item in by_nodeid.items():
        if nodeid.endswith(metadata_nodeid) or metadata_nodeid.endswith(nodeid):
            return item

    return by_test_name.get(base_test_name(nodeid))


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


def runtime_input(test):
    metadata = test.get("metadata") or {}
    if metadata.get("input"):
        return str(metadata.get("input"))

    pairs = [
        f"{key}={value}"
        for key, value in sorted(metadata.items())
        if str(key).startswith("input_") and value not in (None, "")
    ]
    return ", ".join(pairs)


def build_rows_by_screen(result_json, metadata):
    by_nodeid, by_test_name = index_metadata(metadata)
    execution_time = format_execution_time(result_json)
    rows_by_screen = {}
    matched = set()
    missing_metadata = []

    for test in result_json.get("tests", []):
        meta = find_metadata(test, by_nodeid, by_test_name)
        if not meta:
            missing_metadata.append(normalize_nodeid(test.get("nodeid", "")))
            continue

        if meta.get("nodeid"):
            matched.add(normalize_nodeid(meta.get("nodeid")))
        if meta.get("testName"):
            matched.add(meta.get("testName"))

        passed = test.get("outcome") == "passed"
        expected = meta.get("expected", "")
        actual = (meta.get("actual") or expected) if passed else get_failure_message(test)
        screen_name = meta.get("screenName") or "TestResult"

        rows_by_screen.setdefault(screen_name, [HEADERS]).append([
            meta.get("testId", ""),
            meta.get("type") or "Backend",
            screen_name,
            meta.get("testName", ""),
            runtime_input(test) or meta.get("input", ""),
            expected,
            actual,
            "OK" if passed else "NG",
            execution_time,
        ])

    unmatched = []
    for item in metadata:
        nodeid = normalize_nodeid(item.get("nodeid"))
        test_name = item.get("testName")
        if nodeid and nodeid in matched:
            continue
        if test_name and test_name in matched:
            continue
        unmatched.append(nodeid or test_name or item.get("testId", ""))

    errors = []
    if missing_metadata:
        errors.append("metadataがありません。\n" + "\n".join(missing_metadata))

    if unmatched:
        errors.append("metadataに一致するテスト結果がありません。\n" + "\n".join(unmatched))

    if errors:
        raise RuntimeError("\n\n".join(errors))

    return rows_by_screen


def write_excel(screen_name, rows, timestamp):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    workbook = Workbook()
    worksheet = workbook.active
    worksheet.title = SHEET_NAME

    for row in rows:
        worksheet.append(row)

    output_path = build_output_path(OUTPUT_DIR, screen_name, timestamp)
    workbook.save(output_path)
    return output_path


def build_output_path(target_dir, screen_name, timestamp):
    file_name = f"{screen_name}_{timestamp}.xlsx"

    if not screen_name or WINDOWS_FILE_NAME_INVALID_PATTERN.search(file_name):
        raise RuntimeError(f"Excelファイル名生成に失敗しました: {file_name}")

    output_path = Path(target_dir) / file_name
    if output_path.name != file_name:
        raise RuntimeError(f"Excelファイル名生成に失敗しました: {file_name}")

    return output_path


def main():
    result_path = find_result_path()
    result_json = load_json(result_path)
    metadata = load_metadata()
    validate_metadata(metadata)
    rows_by_screen = build_rows_by_screen(result_json, metadata)

    if not rows_by_screen:
        raise RuntimeError("metadataに一致するテスト結果がありません")

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    for screen_name, rows in rows_by_screen.items():
        output_path = write_excel(screen_name, rows, timestamp)
        print(f"Excel出力完了: {output_path}")


def format_metadata_item(item):
    file_name = item.get("metadataFile") or "(unknown metadata)"
    test_name = item.get("testName") or item.get("nodeid") or item.get("testId") or "(unknown test)"
    return f"{file_name}: {test_name}"


def format_invalid_screen_name_item(item):
    screen_name = str(item.get("screenName") or "")
    if screen_name in ENGLISH_SCREEN_NAMES or is_ascii_only(screen_name):
        reason = "英語または英数字のみの名称です"
    else:
        reason = "未承認名称です"
    return f'{format_metadata_item(item)}: screenName="{screen_name}" ({reason})'


if __name__ == "__main__":
    main()
