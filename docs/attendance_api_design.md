# 勤務実績API設計

## 位置づけ

本資料は勤務実績機能のAPI設計を整理する。API名、Service名、Repository名はWeb設計上の論理名であり、Excelから直接取得できないため推測を含む。本更新は設計書のみであり、実装、API変更、DB変更、ソースコード変更は行わない。

Excel VBA `Module1` の業務判定はBackend Serviceを正本にする。Frontendは入力支援を行うが、保存、検証、提出時は必ずBackendで再検証する。

## API一覧

|Method|Path|概要|主な責務|
|---|---|---|---|
|GET|`/api/attendance/monthly`|月次勤務表取得|対象月の日数、社員情報、通常勤務時間、明細、集計、検証結果を返す|
|POST|`/api/attendance/monthly`|月次勤務表保存|月単位保存、入力形式チェック、updated_at排他、差分INSERT/UPDATE/DELETE|
|POST|`/api/attendance/monthly/validate`|検証|E001-E020、集計、深夜勤務、完了表示、印刷可否を算出|
|POST|`/api/attendance/monthly/submit`|提出|dirty保存後の提出、提出時チェック、status=submitted更新|
|POST|`/api/attendance/monthly/unlock`|編集再開|validated/submittedからdraftへ戻す。approved/confirmedは原則不可|
|GET|`/api/attendance/work-types`|勤務区分一覧取得|Excel `X44:X56` 相当の勤務区分マスタを返す。通常勤務はブランク扱いとする|
|GET|`/api/attendance/holidays`|休日カレンダー取得|`set_calendar` 相当の休日フラグを返す|
|GET|`/api/attendance/normal-work-time`|通常勤務時間取得|勤務実績画面で参照表示する|
|PUT|`/api/attendance/normal-work-time`|通常勤務時間更新|別画面で通常勤務時間を編集する|

## 月次取得

`GET /api/attendance/monthly` は、指定ユーザー・対象年月の勤務実績を取得する。

|Request項目|必須|説明|
|---|---|---|
|userId|必須|対象ユーザー|
|year|必須|対象年。E019対象|
|month|必須|対象月。E020対象|

|Response項目|説明|
|---|---|
|header|社員情報、対象年月、status、updatedAt、completionLabel、printable|
|normalWorkTime|通常勤務時間。勤務実績画面では参照のみ|
|rows|対象月の日数分の日別明細|
|summary|Backend集計結果|
|validationResults|エラー、警告、対象セル|

対象月の日数のみを返す。存在しない日付行は返さない。

## 保存

`POST /api/attendance/monthly` は月単位で保存する。

|Request項目|必須|説明|
|---|---|---|
|userId|必須|対象ユーザー|
|year|必須|対象年|
|month|必須|対象月|
|baseUpdatedAt|必須|取得時点のupdated_at|
|changedRows|必須|Frontendでdirtyになった変更行のみ。変更なし行は送信しない|

`changedRows` の日別入力項目は、始業、終業、休憩、勤務区分、作業内容、遅刻早退時間とする。これらすべてがブランクの場合はDELETE指定として扱う。

保存仕様:

- 入力形式エラーがある場合は保存しない。
- Excel VBAの全業務チェックは提出時に実施する。ただし保存できない形式不正は保存時に止める。
- `validated`、`submitted`、`approved`、`confirmed` は `unlock` なしに保存不可。
- `baseUpdatedAt` とDBの `updated_at` が一致しない場合は409相当の排他エラーを返す。
- Frontendは変更行のみ送信し、変更なし行は送信しない。
- Frontendは変更行の全入力項目がブランクの場合のみDELETE指定にする。
- Backendは `changedRows` をもとに、新規はINSERT、既存変更はUPDATE、全入力項目ブランクはDELETEを差分実施する。
- 保存成功時は最新の `updatedAt`、保存済み行、summary、validationResultsを返し、Frontendはdirty=falseにする。

## 検証

`POST /api/attendance/monthly/validate` は、提出前確認または画面上の検証に利用する。

処理:

1. 年月チェック。Excel E019/E020。
2. 休日カレンダー算出。Excel `set_calendar` 相当。
3. 通常勤務時間取得。
4. 入力形式チェック。
5. 勤務区分別チェック。Excel `check_input` 相当。
6. 深夜勤務計算。Excel `check_midnight_shift`、`calc_midnight_rest` 相当。
7. 月次集計。Excel D38:P39相当。
8. 完了表示、警告、印刷可否を算出。

## 提出

`POST /api/attendance/monthly/submit` は提出を行う。

処理:

1. `baseUpdatedAt` で排他確認する。
2. 入力形式チェックを実施する。
3. Excel VBA相当E001-E020を実施する。
4. E009は休日（土日・祝日等）に勤務区分「欠勤」を指定した場合に発生させる。VBA根拠はModule1 1060-1066。Excel `エラーメッセージ一覧` シートにE009定義が存在しないため、メッセージはWeb標準の「xx日は休日のため、欠勤を指定できません。」とする。
5. E010は欠勤以外を含む、休日に使用不可の勤務区分を指定した場合の汎用的な休日区分不整合として扱い、E009とは区別する。
6. E012はVBA上の有効判定未検出のため推測実装しない。
7. エラーがある場合、statusを変更せず `validationResults` を返す。
8. エラーがない場合、集計、深夜勤務、完了表示、印刷可否を確定し、status=`submitted`へ更新する。
9. 提出成功時、Frontendはdirty=falseにする。

Frontendでdirty=trueの場合は、提出APIの前に保存APIを実行し、保存成功後に提出する。

対象月変更時にdirty=trueの場合、Frontendは確認ダイアログを表示する。ボタンは「保存して変更」「キャンセル」のみとし、「保存して変更」では保存API成功後にだけ対象月を切り替える。保存API失敗時は対象月を変更しない。

## 検証結果形式

|項目|説明|
|---|---|
|code|E001-E020、または警告コード|
|severity|error/warning|
|date|対象日。月次または通常勤務時間エラーの場合は空も可|
|rowNo|対象日または画面行|
|field|対象項目|
|message|ExcelメッセージまたはWeb補助文言|

## 排他エラー

409相当の排他エラー時は以下を返す設計とする。

|項目|説明|
|---|---|
|latestHeader|最新の月次ヘッダ|
|latestRows|最新の対象月明細|
|conflictCells|最新データとの差分セル|
|baseUpdatedAt|送信側が保持していたupdated_at|
|latestUpdatedAt|DB最新updated_at|

Frontendは入力内容を保持し、最新データとの差分セルのみ黄色表示する。

## Service構成

|Service|責務|Excel対応|
|---|---|---|
|AttendanceMonthlyService|月次取得、保存、提出、編集再開|勤務実績シート全体|
|HolidayCalendarService|土日、祝日、振替休日、休日出勤日|`set_calendar`|
|AttendanceValidationService|E001-E020、勤務区分別チェック|`check_input`|
|WorkTimeCalculationService|実働、休憩、単位チェック|H:I、E003、E015|
|MidnightWorkService|深夜勤務時間、深夜休憩控除|`check_midnight_shift`、`calc_midnight_rest`|
|AttendanceAggregationService|月次集計|Module1 1500-1530|
|AttendanceAuthorizationService|本人、管理者、承認者権限|Web設計。推測を含む|

## 入力チェック配置

|タイミング|Frontend|Backend|
|---|---|---|
|入力時|形式補助、選択肢制御、エラー表示|なし|
|保存時|保存前の補助表示、変更行のみ送信、全入力項目ブランク行のDELETE指定|形式チェック、排他、状態確認、INSERT/UPDATE/DELETE|
|提出時|結果表示|入力形式、E001-E020、集計、状態遷移|

## エラー仕様

エラーコードはExcel MsgNo E001-E020を維持する。詳細は `docs/attendance_error_codes.md` を参照する。
