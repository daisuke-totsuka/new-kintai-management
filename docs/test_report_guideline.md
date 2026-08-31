# テストレポートガイドライン

## 目的

テスト結果Excelの出力ルール、metadata、screenName、testName、testID、判定、ファイル命名、保存場所、運用方法を標準化する。

## Excel出力ルール

- Frontendは `frontend/test-results/` に出力する。
- Backendは `backend/test-results/` に出力する。
- Excelファイル名は `{screenName}_{yyyyMMdd_HHmmss}.xlsx` とする。
- `screenName` はmetadataの値をそのまま使用するため、正式日本語名で記述する。
- Excelの1ファイルは1つの `screenName` に対応する。
- シート名は `TestResult` とする。

## metadata

metadataはExcelレポートの正本情報である。テスト実装を追加・変更した場合は必ず更新する。

| 項目 | 必須 | ルール |
|---|---|---|
| testId | 必須 | 一意のID。画面/API/分類ごとに接頭辞を決める |
| type | 必須 | Frontend、Backend、API、DB、E2Eなど |
| screenName | 必須 | Excelファイル名と画面名列に使う正式日本語名 |
| testName | 必須 | 実テスト名と完全一致 |
| input | 必須 | 入力値、前提条件、payload、DB状態 |
| expected | 必須 | 期待結果 |
| actual | 必須 | 実際結果または確認内容 |
| nodeid | Backend推奨 | pytestのnodeidと紐づける |

## screenName

- 画面名はアプリ内の正式日本語表示名または業務上の日本語名称に統一する。
- 英語のルート名、コンポーネント名、テスト分類名をそのまま使わない。
- APIやDB境界値など画面でない分類も日本語にする。
- 例: `Dashboard` ではなく `確定画面`。
- 例: `Next API Proxy` ではなく `Next APIプロキシ`。
- 例: `DB Boundary` ではなく `DB境界値`。

## testName

- Frontendは `it("...")` のタイトルと一致させる。
- Backendはpytest関数名または `nodeid` と一致させる。
- 日本語画面テストは日本語のテスト名を原則とする。
- APIやBackend関数名が英語でも、期待結果と画面名は日本語で補足する。

## testID

- 画面、API、Service、DB境界値ごとに接頭辞を定義する。
- 既存例に合わせ、連番は欠番を再利用しない。
- 例: `ATT_UI001`, `ATT_API001`, `ROLE_API001`, `NEXT_API001`。
- 不具合再現テストは既存分類に追加し、必要に応じて `REG` を含める。

## 判定

| 判定 | 意味 | 運用 |
|---|---|---|
| OK | テスト成功 | 期待結果を満たした |
| NG | テスト失敗 | 修正または仕様確認が必要 |
| SKIP | 条件不足で未実行 | 実DB未接続、900番台データ不足など理由を残す |
| NOT_RUN | 未実行 | 手動確認待ち、環境未整備など理由を残す |

現行スクリプトは主にOK/NGを出力する。SKIPとNOT_RUNを正式運用する場合は、Excel export scriptで判定変換を追加する。

## ファイル命名規則

- `{screenName}_{yyyyMMdd_HHmmss}.xlsx` とする。
- `screenName` に英語名、テストファイル名、コンポーネント名、ルート名を使わない。
- ファイル名に使用できない文字はmetadata登録時に避ける。
- 同じ時刻に複数生成されても、screenName単位で区別できるようにする。

## 保存場所

| 種別 | 保存場所 |
|---|---|
| Frontend結果JSON | `frontend/test-results/result.json` |
| Frontend Excel | `frontend/test-results/*.xlsx` |
| Backend結果JSON | `backend/test-results/result.json` |
| Backend Excel | `backend/test-results/*.xlsx` |
| 全体実行 | `scripts/run-test-report-all.js` |

## 運用方法

1. テストを追加または変更する。
2. metadataを追加または更新する。
3. テストを実行する。
4. Excelを生成する。
5. Excelファイル名、画面名列、testId、testName、期待結果、判定を確認する。
6. 英語screenNameが出た場合はmetadataを修正する。

## 英語名混入防止

現在のExcel export scriptは `screenName` を変換せず、そのままファイル名と画面名列に使う。したがって、英語名混入の主原因はmetadataである。

| 英語名 | 推奨日本語名 |
|---|---|
| Attendance Settings | 年度設定 |
| Dashboard | 確定画面 |
| Leader | 提出状況 |
| Login | ログイン |
| Business Bill Details | 業務請求明細 |
| Expense Claims | 経費請求 |
| Next API Proxy | Next APIプロキシ |
| DB Boundary | DB境界値 |
| Role DB Boundary | 権限DB境界値 |

推奨実装は、metadataの `screenName` を日本語に修正し、必要に応じてExcel export scriptに英語screenName検出のバリデーションを追加することである。
