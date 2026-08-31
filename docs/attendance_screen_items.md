# 勤務実績画面項目定義

## 位置づけ

本資料は勤務実績画面の画面項目、ボタン、状態別制御を定義する。正本は `docs/9999_勤務表yyyymm（名前）_xxxxx.xlsm`、`docs/attendance_excel_analysis.md`、`docs/attendance_vba_analysis.md` とする。

DB項目はWeb設計上の論理名であり、Excelから直接取得できない項目は推測を含む。Excelセル対応を業務仕様の正とする。本更新は設計書のみであり、実装、DB変更、API変更は行わない。

## 画面構成

|領域|内容|Excel対応|Web仕様|
|---|---|---|---|
|ヘッダ|画面名、ステータス、操作ボタン|勤務実績（月間）!A1:Q3、Cells(3,17)|月次勤務表の状態と操作を固定表示する|
|社員情報|社員番号、氏名、作業場所、所属|祝日表!C2:F2、L2、勤務実績（月間）!A3:I3、Q1|認証ユーザーまたは参照対象ユーザーの情報を表示する|
|対象年月|対象年、対象月|祝日表!A2:B2、勤務実績（月間）!B1:D1|年月選択で月次データを取得する。対象月変更時にdirty=trueなら確認ダイアログを表示する|
|通常勤務時間|始業、終業、休憩、適用日|勤務実績（月間）!A43:G44|勤務実績画面では参照のみ。編集は通常勤務時間設定画面で行う|
|勤務実績一覧|対象月の日別勤務実績|勤務実績（月間）!A7:S37|対象月の日数のみ表示する。2月30日など存在しない日は表示しない|
|集計欄|総勤務日数、通常出勤、休日出勤、欠勤、有休、総実働、遅刻早退、深夜|勤務実績（月間）!B38:P39、R:S|Backend集計結果を表示する|
|エラー一覧|E001-E020、警告、対象セル|エラーメッセージ一覧、VBA MsgBox|提出不可時は一覧表示し、対象セルを強調する|
|ボタン|保存、提出、編集再開、印刷、合計印刷|各ボタン割当マクロ|API実行と状態遷移を行う|

## 画面項目

|画面項目名|DB項目|入力形式|初期値|編集可否|必須条件|入力チェック|Excelセル対応|
|---|---|---|---|---|---|---|---|
|対象年|attendance_monthly_headers.year|数値、1-3000|現在年または選択年|draftのみ可|必須|E019。保存時・提出時にBackend再検証|祝日表!A2、勤務実績（月間）!B1|
|対象月|attendance_monthly_headers.month|数値、1-12|現在月または選択月|draftのみ可|必須|E020。保存時・提出時にBackend再検証|祝日表!B2、勤務実績（月間）!D1|
|社員番号|attendance_monthly_headers.employee_no|文字列|認証ユーザー情報|不可|必須|認証情報とDB整合をBackendで確認。詳細は未解析|祝日表!C2、勤務実績（月間）!A3|
|氏名|attendance_monthly_headers.employee_name|文字列|認証ユーザー情報|不可|必須|認証情報とDB整合をBackendで確認。詳細は未解析|祝日表!D2、勤務実績（月間）!D3|
|作業場所|attendance_monthly_headers.workplace|文字列|ユーザー所属情報|不可|任意|未解析|祝日表!F2、勤務実績（月間）!I3|
|所属|attendance_monthly_headers.department|選択値/文字列|ユーザー所属情報|不可|任意|所属マスタとの整合は未解析|祝日表!L2、勤務実績（月間）!Q1|
|ステータス|attendance_monthly_headers.status|draft/validated/submitted/approved/confirmed|draft|不可|必須|状態遷移をBackendで制御|Cells(3,17)、A40相当|
|完了表示|attendance_monthly_headers.completion_label|完了/完了*/警告|空|不可|提出時に算出|Excel VBA相当をBackendで算出|Cells(3,17)|
|印刷可否|attendance_monthly_headers.printable|boolean|false|不可|検証時に算出|A40空相当をBackendで算出|勤務実績（月間）!A40|
|通常勤務時間 適用日|normal_work_time_settings.effective_from_day/effective_to_day|日付範囲|通常勤務時間設定の値|不可|必須|E001の対象。編集は別画面|勤務実績（月間）!A43:B44|
|通常勤務時間 始業|normal_work_time_settings.start_time|HH:mm|通常勤務時間設定の値|不可|必須|E001、E004の基準値。E012はVBA上の有効判定未検出|勤務実績（月間）!C43:D44|
|通常勤務時間 終業|normal_work_time_settings.end_time|HH:mm|通常勤務時間設定の値|不可|必須|E001、E005の基準値。E012はVBA上の有効判定未検出|勤務実績（月間）!E43:F44|
|通常勤務時間 休憩|normal_work_time_settings.break_minutes|分、0以上整数|通常勤務時間設定の値|不可|必須|E001、E015の基準値|勤務実績（月間）!G43:G44|
|出勤日|attendance_daily_records.work_date|date|対象年月の日付|不可|必須|対象月の日数のみ生成。E002はBackend防御|勤務実績（月間）!A7:A37|
|曜日|attendance_daily_records.day_of_week|文字列|カレンダーから算出|不可|必須|休日フラグと整合|勤務実績（月間）!B7:B37|
|休日区分|attendance_daily_records.holiday_flag|0/1/2/3/4|HolidayCalendarService算出|不可|必須|set_calendar相当|データ!G2:G32|
|始業|attendance_daily_records.start_time|HH:mm|空|draftのみ可|勤務区分別|入力時形式、保存時形式、提出時E004/E007|勤務実績（月間）!C7:D37|
|終業|attendance_daily_records.end_time|HH:mm|空|draftのみ可|勤務区分別|入力時形式、保存時形式、提出時E005/E007|勤務実績（月間）!E7:F37|
|休憩|attendance_daily_records.break_minutes|分、0以上整数|空|draftのみ可|勤務時間入力時|入力時形式、保存時形式、提出時E015|勤務実績（月間）!G7:G37|
|実働|attendance_daily_records.actual_minutes|分|Backend算出|不可|勤務時間入力時|E003。5分単位エラー、15分単位警告|勤務実績（月間）!H7:I37|
|勤務区分|attendance_daily_records.work_type_code|選択値。ブランクは通常勤務|ブランク|draftのみ可|勤務区分別。土日祝日は勤務時間だけ入力されていてもブランク可|非ブランク時はE018、E010、区分別チェック|勤務実績（月間）!J7:J37、X44:X56|
|作業内容|attendance_daily_records.work_content|テキスト1項目|空|draftのみ可|勤務区分別|E006。最大文字数はDB設計依存のため推測|勤務実績（月間）!K7:P37|
|遅刻早退時間|attendance_daily_records.late_early_hours|0.5単位の小数時間|空|draftのみ可|遅刻/早退時|E016、E017、E004、E005|勤務実績（月間）!Q7:Q37|
|深夜勤務時間|attendance_daily_records.midnight_minutes|分|Backend算出|不可|該当時自動|check_midnight_shift相当|勤務実績（月間）!R7:S37|
|業務警告|attendance_daily_records.warning_flag|boolean|false|不可|該当時自動|15分単位警告、振休警告|Cells(3,20)、Cells(3,17)|
|総勤務日数|attendance_summaries.total_work_days|数値|Backend算出|不可|検証時/提出時|Module1 1512-1520相当|勤務実績（月間）!D38|
|通常出勤|attendance_summaries.normal_work_days|数値|Backend算出|不可|検証時/提出時|Module1 1522-1530相当|勤務実績（月間）!H38|
|休日出勤|attendance_summaries.holiday_work_days|数値|Backend算出|不可|検証時/提出時|Module1 1500-1503相当|勤務実績（月間）!L38|
|欠勤日数|attendance_summaries.absence_days|数値|Backend算出|不可|検証時/提出時|Module1 1503-1505相当|勤務実績（月間）!P38|
|有給日数|attendance_summaries.paid_leave_days|数値|Backend算出|不可|検証時/提出時|Module1 1505-1506相当|勤務実績（月間）!P39|
|総実働時間|attendance_summaries.total_actual_minutes|分|Backend算出|不可|検証時/提出時|H:I列合計相当|勤務実績（月間）!D39:F39|
|遅刻早退合計|attendance_summaries.late_early_hours|0.5単位|Backend算出|不可|検証時/提出時|Q列合計相当|勤務実績（月間）!J39:L39|
|エラー一覧|attendance_validation_results.*|一覧|空|不可|提出不可時|E001-E020、警告|エラーメッセージ一覧、VBA MsgBox|

## ボタン

|ボタン|表示条件|押下条件|処理|API|
|---|---|---|---|---|
|保存|status=draft|dirty=true、入力形式エラーなし、updated_at一致|月単位で保存する。Frontendは変更行のみ送信する。変更行の全入力項目がブランクならDELETE指定し、Backendは新規INSERT、既存UPDATE、全入力項目ブランクDELETEを差分実施する。保存成功メッセージを表示しdirty=false|POST `/api/attendance/monthly`|
|提出|status=draftまたはvalidated|入力形式エラーなし。dirty=trueの場合は保存成功後|Backendで入力形式とExcel VBA相当E001-E020を実施する。エラー時は提出せず、エラー一覧とセル強調を返す。成功時はstatus=submitted、dirty=false|POST `/api/attendance/monthly/submit`|
|編集再開|status=validatedまたはsubmitted。approved/confirmedは原則非表示|権限があり、確定済みでない|再編集可能な状態へ戻す。入力内容は保持する。approved/confirmedの扱いは承認ワークフロー未確定のため推測|POST `/api/attendance/monthly/unlock`|
|印刷|printable=true、かつstatus=validated/submitted/approved/confirmed|入力エラーなし。最新データ取得済み|月報印刷レイアウトでブラウザ印刷する|APIなし。必要に応じてGET `/api/attendance/monthly`|
|合計印刷|printable=true、かつstatus=validated/submitted/approved/confirmed|入力エラーなし。最新データ取得済み|合計欄のみの印刷レイアウトでブラウザ印刷する|APIなし。必要に応じてGET `/api/attendance/monthly`|

## 状態別制御

|状態|編集可否|ボタン表示|入力可否|
|---|---|---|---|
|draft|可|保存、提出|可。通常勤務時間は参照のみ|
|validated|不可|提出、編集再開、印刷、合計印刷|不可。編集再開後に可|
|submitted|不可|編集再開、印刷、合計印刷|不可。編集再開後に可|
|approved|不可|印刷、合計印刷|不可|
|confirmed|不可|印刷、合計印刷|不可|

## 対象月変更時の保存

- dirty=falseならそのまま対象月を切り替える。
- dirty=trueなら確認ダイアログを表示する。
- 確認ダイアログのボタンは「保存して変更」「キャンセル」の2つのみとする。
- 「保存して変更」押下時は変更前の対象月を保存する。
- 保存に成功した場合のみ対象月を切り替え、dirty=falseにする。
- 保存に失敗した場合は対象月を切り替えず、エラー一覧または保存エラーを表示する。
- 「キャンセル」押下時は対象月を切り替えず、入力内容を保持する。

## 日別レコード削除

- Frontendは変更行のみ送信し、変更なし行は送信しない。
- 変更行について、始業、終業、休憩、勤務区分、作業内容、遅刻早退時間のすべてがブランクになった場合のみDELETE指定とする。
- 一部項目だけがブランクの場合はDELETEではなくUPDATEとして扱う。
- Backendは新規行をINSERT、既存行変更をUPDATE、全入力項目ブランク指定をDELETEとして処理する。

## 排他制御

- `updated_at` による楽観的排他制御を行う。
- 排他エラー時は入力内容を保持する。
- 最新データを取得する。
- 最新データとの差分セルのみ黄色表示する。
- 差分確認後、再編集可能にする。
