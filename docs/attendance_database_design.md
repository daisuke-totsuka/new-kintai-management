# 勤務実績DB設計

## 位置づけ

本資料は勤務実績機能のDB設計を整理する。テーブル名・カラム名はWeb設計上の論理名であり、Excelから直接取得できないため推測を含む。本更新は設計書のみであり、DB変更、マイグレーション、ソースコード変更は行わない。

Excelのセル配置、入力規則、VBA判定をDBへ正規化して保持する方針を示す。

## 設計方針

|方針|内容|
|---|---|
|保存単位|月単位。月次ヘッダと日別明細で保持する|
|日別行|対象月の日数のみ保持・表示する|
|通常勤務時間|勤務実績画面では参照のみ。別テーブル・別画面で管理する|
|通常勤務|勤務区分ブランクで表現する。通常勤務用のコード値は保持しない|
|作業内容|Excel K:P結合セル相当を1項目で保持する|
|排他制御|月次ヘッダの `updated_at` による楽観的排他制御|
|dirty管理|Frontendで管理し、変更行のみAPI送信する|
|差分保存|Backendが新規INSERT、既存変更UPDATE、全入力項目ブランクDELETEを差分実施する|
|業務判定|Backend Serviceを正とし、検証結果を保持する|

## テーブル一覧

|テーブル|用途|Excel対応|
|---|---|---|
|attendance_monthly_headers|月次ヘッダ、状態、排他制御|勤務実績（月間）!A1:Q3、A40、Cells(3,17)|
|attendance_daily_records|日別勤務実績|勤務実績（月間）!A7:S37|
|attendance_summaries|月次集計|勤務実績（月間）!B38:P39|
|attendance_validation_results|検証結果、エラー、警告|エラーメッセージ一覧、VBA MsgBox|
|work_type_masters|勤務区分マスタ|勤務実績（月間）!X44:X56|
|holiday_masters|固定祝日、変動祝日|祝日表、データ|
|workday_override_masters|休日出勤日、振替休日等|祝日表|
|normal_work_time_settings|通常勤務時間|勤務実績（月間）!A43:G44|

## attendance_monthly_headers

|カラム|型|必須|説明|
|---|---|---|---|
|id|uuid|必須|月次ヘッダID。推測|
|user_id|uuid/string|必須|対象ユーザー|
|employee_no|string|必須|社員番号。祝日表!C2相当|
|employee_name|string|必須|氏名。祝日表!D2相当|
|workplace|string|任意|作業場所。祝日表!F2相当|
|department|string|任意|所属。祝日表!L2相当|
|year|integer|必須|対象年。E019対象|
|month|integer|必須|対象月。E020対象|
|status|enum|必須|draft/validated/submitted/approved/confirmed|
|completion_label|string|任意|完了、完了*、警告|
|printable|boolean|必須|Excel A40空相当|
|submitted_at|timestamp|任意|提出日時|
|approved_at|timestamp|任意|承認日時。承認ワークフローは推測|
|confirmed_at|timestamp|任意|確定日時。承認ワークフローは推測|
|created_at|timestamp|必須|作成日時|
|updated_at|timestamp|必須|楽観的排他制御に使用|

一意制約は `user_id, year, month` とする設計が妥当だが、DB実装未確認のため推測とする。

## attendance_daily_records

|カラム|型|必須|説明|Excel対応|
|---|---|---|---|---|
|id|uuid|必須|日別ID。推測|なし|
|monthly_header_id|uuid|必須|月次ヘッダID|なし|
|work_date|date|必須|出勤日|A7:A37|
|day_of_week|string|必須|曜日|B7:B37|
|holiday_flag|integer|必須|休日フラグ。set_calendar相当|データ!G2:G32|
|start_time|time|任意|始業|C7:D37|
|end_time|time|任意|終業|E7:F37|
|break_minutes|integer|任意|休憩分|G7:G37|
|actual_minutes|integer|任意|実働分。Backend算出|H7:I37|
|work_type_code|string|任意|勤務区分。ブランクは通常勤務|J7:J37|
|work_content|string|任意|作業内容1項目|K7:P37|
|late_early_hours|decimal|任意|遅刻早退時間。0.5単位|Q7:Q37|
|midnight_minutes|integer|任意|深夜勤務分。Backend算出|R7:S37|
|warning_flag|boolean|必須|業務警告の有無|Cells(3,20)相当|
|created_at|timestamp|必須|作成日時|なし|
|updated_at|timestamp|必須|行更新日時。月次排他はヘッダupdated_atを正とする|なし|

対象月の日数のみを保存対象とする。存在しない日付行への入力はUI上表示せず、BackendではE002相当の防御チェックを行う。

## attendance_summaries

|カラム|型|説明|Excel対応|
|---|---|---|---|
|monthly_header_id|uuid|月次ヘッダID|なし|
|total_work_days|decimal|総勤務日数|D38|
|normal_work_days|decimal|通常出勤|H38|
|holiday_work_days|decimal|休日出勤|L38|
|absence_days|decimal|欠勤日数|P38|
|paid_leave_days|decimal|有給日数|P39|
|total_actual_minutes|integer|総実働時間|D39:F39|
|late_early_hours|decimal|遅刻早退合計|J39:L39|
|midnight_minutes|integer|深夜勤務合計|R:S相当|

集計値はBackendで算出する。保存済み値として保持するか都度算出するかは実装設計の推測を含む。

## attendance_validation_results

|カラム|型|説明|
|---|---|---|
|id|uuid|検証結果ID。推測|
|monthly_header_id|uuid|月次ヘッダID|
|work_date|date|対象日。月次エラーの場合は空|
|field|string|対象項目|
|code|string|E001-E020、警告コード|
|severity|enum|error/warning|
|message|string|表示メッセージ|
|created_at|timestamp|作成日時|

提出不可時はこの結果をFrontendがエラー一覧とセル強調に使用する。

## work_type_masters

Excel `勤務実績（月間）!X44:X56` を正とする。

|コード/表示名|説明|
|---|---|
|休出|休日出勤|
|有休|有給休暇|
|前休|午前半休|
|後休|午後半休|
|特休|特別休暇|
|振休|振替休日|
|振予|振休取得予定|
|欠勤|欠勤|
|遅刻|遅刻|
|早退|早退|
|遅延|遅延|
|ｼﾌﾄ|シフト|
|休業|休業|

ブランクは通常勤務として扱う。勤務区分マスタには通常勤務用のコード値を追加しない。

## normal_work_time_settings

|カラム|型|説明|Excel対応|
|---|---|---|---|
|id|uuid|通常勤務時間設定ID。推測|なし|
|user_id|uuid/string|対象ユーザー|なし|
|effective_from_day|integer|適用開始日|A43:B44|
|effective_to_day|integer|適用終了日|A43:B44|
|start_time|time|通常始業|C43:D44|
|end_time|time|通常終業|E43:F44|
|break_minutes|integer|通常休憩|G43:G44|
|updated_at|timestamp|更新日時|なし|

勤務実績画面では参照のみで、編集は通常勤務時間設定画面で行う。

## 差分保存

|操作|Backend処理|
|---|---|
|新規行|INSERT|
|既存行変更|UPDATE|
|入力内容削除|変更行の全入力項目がブランクの場合のみDELETE|

DELETE判定の対象入力項目は、始業、終業、休憩、勤務区分、作業内容、遅刻早退時間とする。出勤日、曜日、休日区分、実働、深夜勤務、集計値はDELETE判定に含めない。

Frontendはdirty=trueになった変更行のみ送信し、変更なし行は送信しない。Backendは月次ヘッダの `updated_at` を確認し、差分保存後にヘッダ `updated_at` を更新する。

## 排他制御

- 保存・提出時に `baseUpdatedAt` と `attendance_monthly_headers.updated_at` を比較する。
- 不一致の場合は保存・提出を行わない。
- 入力内容は保持し、最新データとの差分セルのみ黄色表示する。
- 再編集可能状態を維持する。
