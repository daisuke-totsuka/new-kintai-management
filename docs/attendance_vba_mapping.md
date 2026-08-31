# 勤務実績VBA-Web対応表

## 位置づけ

本資料はExcel VBA `Module1` の処理とWeb機能の対応を整理する。Excel VBAの業務判定はBackendへ集約し、Frontendは入力支援、画面表示、セル強調、印刷表示を担当する。

本更新は設計書のみであり、実装、DB変更、API変更は行わない。

## 対応表

|VBA処理名|VBA概要|対象画面|対象API|対象Service|Frontend|Backend|入力時|保存時|提出時|画面表示|実装予定|
|---|---|---|---|---|---|---|---|---|---|---|---|
|`set_calendar`|土日、祝日、振替休日、休日出勤日を設定し、入力範囲を解除|勤務実績画面、休日設定画面|GET `/api/attendance/holidays`、GET `/api/attendance/monthly`|HolidayCalendarService|対象月の日数、休日色、休日表示|休日フラグ0-4を算出|なし|なし|休日判定を再実施|対象月の日数のみ表示|Excel完全踏襲。ただし入力範囲解除はWeb状態制御へ改善|
|`set_unlock`|入力範囲の再編集ロック解除|勤務実績画面|POST `/api/attendance/monthly/unlock`|AttendanceMonthlyService、AttendanceAuthorizationService|編集再開ボタン、入力活性制御|状態と権限を確認してdraftへ戻す|なし|なし|なし|状態に応じてボタン表示|改善|
|`check_input`|入力チェック、勤務区分別判定、休憩判定、集計、完了表示|勤務実績画面|POST `/api/attendance/monthly/validate`、POST `/api/attendance/monthly/submit`|AttendanceValidationService、WorkTimeCalculationService、AttendanceAggregationService|入力支援、エラー一覧、セル強調|E001-E020、集計、完了/完了*/警告の正本。ただしE012はVBA上の有効判定未検出|一部補助|形式防御のみ|VBA有効判定を実施。E012は推測実装しない|検証結果表示|Excel完全踏襲。MsgBoxは一覧表示へ改善|
|`print_monthly`|月報印刷。A40が空の場合のみ印刷|勤務実績画面|APIなし。必要に応じてGET `/api/attendance/monthly`|AttendancePrintPolicyService|ブラウザ印刷、印刷ボタン|printableを算出|なし|なし|なし|printableに応じて表示|改善|
|`print_total_only`|合計のみ印刷。一時コピー領域を使用|勤務実績画面|APIなし。必要に応じてGET `/api/attendance/monthly`|AttendancePrintPolicyService|合計印刷用レイアウト|printableを算出|なし|なし|なし|printableに応じて表示|改善。Excelの一時コピーは不要|
|`print_weekly1-6`|週報印刷。現ブックに対象シート未検出|対象外|なし|なし|なし|なし|なし|なし|なし|なし|不要|
|`print_carfare`|交通費印刷。参照シートは現ブックで未検出|対象外|なし|なし|なし|なし|なし|なし|なし|なし|不要|
|`print_carfare_only`|交通費合計のみ印刷|対象外|なし|なし|なし|なし|なし|なし|なし|なし|不要|
|`set_pass`|経費請求シートの運賃種類を定期に設定|対象外|なし|なし|なし|なし|なし|なし|なし|なし|不要|
|`set_round_trip`|経費請求シートの運賃種類を往復に設定|対象外|なし|なし|なし|なし|なし|なし|なし|なし|不要|
|`set_oneway`|経費請求シートの運賃種類を片道に設定|対象外|なし|なし|なし|なし|なし|なし|なし|なし|不要|
|`print_all`|複数帳票の一括印刷|対象外|なし|なし|なし|なし|なし|なし|なし|なし|不要|
|`KinmuKubunListSet`|勤務区分入力規則を再設定|勤務実績画面、勤務区分マスタ|GET `/api/attendance/work-types`|WorkTypeService|勤務区分セレクト。通常勤務はブランク表示|勤務区分マスタを返す。通常勤務用コード値は返さない|非ブランク時の選択肢制御|E018形式防御|E018再検証|選択肢表示|Excel完全踏襲。Excel入力規則はマスタAPIへ改善|
|`check_midnight_shift`|深夜勤務時間計算|勤務実績画面|POST `/api/attendance/monthly/validate`、POST `/api/attendance/monthly/submit`|MidnightWorkService|深夜時間表示、完了*表示|22:00-翌5:00と休憩控除を算出|なし|なし|実施|検証結果表示|Excel完全踏襲|
|`calc_midnight_rest`|深夜時間帯と休憩時間の重複計算|勤務実績画面|POST `/api/attendance/monthly/validate`、POST `/api/attendance/monthly/submit`|MidnightWorkService|なし|深夜休憩控除を算出|なし|なし|実施|検証結果表示|Excel完全踏襲|

## 実装しないもの

週報、交通費、業務請求明細、経費請求シート向けマクロは、現ブックに対象シートが未検出または勤務実績（月間）移植外であるため、今回の勤務実績機能では不要とする。推測で有効機能として扱わない。

## Web固有仕様

|仕様|VBA対応|Webでの扱い|
|---|---|---|
|対象月変更確認|VBAにdirty管理やWeb画面上の対象月変更確認は存在しない|dirty=trueなら確認ダイアログを表示する。ボタンは「保存して変更」「キャンセル」の2つのみ|
|日別レコード削除|Excelはセル入力でありDELETE相当の永続化操作は存在しない|Frontendは変更行のみ送信し、全入力項目ブランク行のみDELETE指定する。Backendは新規INSERT、既存UPDATE、全入力項目ブランクDELETEを行う|
|土日祝日の勤務区分|VBAの勤務区分ブランク分岐では土日祝日の勤務時間入力時も勤務区分自体を必須にしていない|勤務時間だけ入力されていても勤務区分ブランクで登録可能とする|
