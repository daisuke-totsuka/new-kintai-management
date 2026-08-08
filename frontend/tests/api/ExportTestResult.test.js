import { describe, expect, it } from "vitest";
import exporter from "../../scripts/export-test-result.js";

const { buildRowsByScreen, validateMetadata } = exporter;

describe("Excelレポート出力検証", () => {
  it("正式画面名のメタデータを許可する", () => {
    expect(() => validateMetadata([metadata()])).not.toThrow();
  });

  it("英語画面名のメタデータを拒否する", () => {
    expect(() =>
      validateMetadata([metadata({ screenName: "Dashboard" })]),
    ).toThrow(/metadata screenName は正式日本語名称を設定してください。/);
  });

  it("画面名未設定のメタデータを拒否する", () => {
    expect(() => validateMetadata([metadata({ screenName: "" })])).toThrow(
      /screenNameがありません。/,
    );
  });

  it("テストID重複のメタデータを拒否する", () => {
    expect(() =>
      validateMetadata([
        metadata({ testId: "REPORT_FE_DUP001", testName: "日本語の検証1" }),
        metadata({ testId: "REPORT_FE_DUP001", testName: "日本語の検証2" }),
      ]),
    ).toThrow(/testIdが重複しています。/);
  });

  it("画面名とテスト名重複のメタデータを拒否する", () => {
    expect(() =>
      validateMetadata([
        metadata({ testId: "REPORT_FE_DUP101", testName: "同一画面名とテスト名の検証" }),
        metadata({ testId: "REPORT_FE_DUP102", testName: "同一画面名とテスト名の検証" }),
      ]),
    ).toThrow(/screenNameとtestNameの組み合わせが重複しています。/);
  });

  it("メタデータ不足のテスト結果を拒否する", () => {
    const resultJson = {
      startTime: Date.UTC(2026, 7, 5),
      testResults: [
        {
          name: "tests/api/Sample.test.js",
          assertionResults: [
            {
              title: "metadataが存在しないテスト",
              status: "passed",
              failureMessages: [],
            },
          ],
        },
      ],
    };

    expect(() => buildRowsByScreen(resultJson, [])).toThrow(
      /metadataがありません。/,
    );
  });
});

function metadata(overrides = {}) {
  return {
    testId: "REPORT_FE001",
    type: "Frontend",
    screenName: "Excelレポート",
    testName: "正式画面名のメタデータを許可する",
    input: "画面名=Excelレポート",
    expected: "正式名称として許可される。",
    actual: "正式名称として許可される。",
    metadataFile: "ExportTestResult.metadata.json",
    ...overrides,
  };
}
