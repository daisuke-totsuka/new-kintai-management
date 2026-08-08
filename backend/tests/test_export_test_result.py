import importlib.util
from pathlib import Path

import pytest


SCRIPT_PATH = Path(__file__).resolve().parents[1] / "scripts" / "export-test-result.py"
SPEC = importlib.util.spec_from_file_location("export_test_result", SCRIPT_PATH)
export_test_result = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(export_test_result)


def test_validate_metadata_accepts_japanese_screen_name():
    export_test_result.validate_metadata([metadata()])


def test_validate_metadata_rejects_english_screen_name():
    with pytest.raises(RuntimeError, match="metadata screenName は正式日本語名称"):
        export_test_result.validate_metadata([metadata(screenName="Dashboard")])


def test_validate_metadata_rejects_missing_screen_name():
    with pytest.raises(RuntimeError, match="screenNameがありません。"):
        export_test_result.validate_metadata([metadata(screenName="")])


def test_validate_metadata_rejects_duplicate_test_id():
    with pytest.raises(RuntimeError, match="testIdが重複しています。"):
        export_test_result.validate_metadata(
            [
                metadata(testId="REPORT_BE_DUP001", testName="日本語の検証1"),
                metadata(testId="REPORT_BE_DUP001", testName="日本語の検証2"),
            ]
        )


def test_validate_metadata_rejects_duplicate_screen_name_and_test_name():
    with pytest.raises(RuntimeError, match="screenNameとtestNameの組み合わせが重複しています。"):
        export_test_result.validate_metadata(
            [
                metadata(testId="REPORT_BE_DUP101", testName="同一画面名とテスト名の検証"),
                metadata(testId="REPORT_BE_DUP102", testName="同一画面名とテスト名の検証"),
            ]
        )


def test_build_rows_by_screen_rejects_missing_metadata():
    result_json = {
        "created": 1785812899.0,
        "tests": [
            {
                "nodeid": "backend/tests/test_sample.py::test_missing_metadata",
                "outcome": "passed",
            }
        ],
    }

    with pytest.raises(RuntimeError, match="metadataがありません。"):
        export_test_result.build_rows_by_screen(result_json, [])


def metadata(**overrides):
    item = {
        "testId": "REPORT_BE001",
        "type": "Backend",
        "screenName": "Excelレポート",
        "testName": "正式画面名のメタデータを許可する",
        "nodeid": "backend/tests/test_export_test_result.py::test_validate_metadata_accepts_japanese_screen_name",
        "input": "画面名=Excelレポート",
        "expected": "正式名称として許可される。",
        "actual": "正式名称として許可される。",
        "metadataFile": "export_test_result.metadata.json",
    }
    item.update(overrides)
    return item
