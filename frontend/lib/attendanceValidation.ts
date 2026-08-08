import {
  createDefaultNormalWorkTimeSettings,
  type NormalWorkTimeSettings,
  type NumericValue,
  type TimeSetting,
} from "@/lib/normalWorkTimeSettings";

export type AttendanceWorkRowForNormalTimeCheck = {
  targetYear: number;
  targetMonth: number;
  attendanceDay: number;
  startTime: string;
  endTime: string;
  breakMinutes: string;
  workTypeCode: string;
};

export type NormalWorkTimeDiffError = {
  attendanceDay: number;
  field: "startTime" | "endTime" | "breakMinutes";
  message: string;
};

type NormalWorkTime = {
  startMinutes: number;
  endMinutes: number;
  breakMinutes: number;
};

function parseTimeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) return null;
  const [hour, minute] = value.split(":").map(Number);
  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return hour * 60 + minute;
}

function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function toInteger(value: NumericValue): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

function settingToNormalWorkTime(setting: TimeSetting): NormalWorkTime | null {
  const startHour = toInteger(setting.startHour);
  const startMinute = toInteger(setting.startMinute);
  const endHour = toInteger(setting.endHour);
  const endMinute = toInteger(setting.endMinute);
  const breakMinutes = toInteger(setting.breakMinutes);

  if (
    startHour === null ||
    startMinute === null ||
    endHour === null ||
    endMinute === null ||
    breakMinutes === null
  ) {
    return null;
  }

  return {
    startMinutes: startHour * 60 + startMinute,
    endMinutes: endHour * 60 + endMinute,
    breakMinutes,
  };
}

function getDayOfMonth(attendanceDay: number): number | null {
  const day = Number(attendanceDay);
  return Number.isInteger(day) && day >= 1 && day <= 31 ? day : null;
}

function isFutureDate(targetYear: number, targetMonth: number, attendanceDay: number): boolean {
  const today = new Date();
  const date = new Date(targetYear, targetMonth - 1, attendanceDay);
  return (
    date.getTime() >
    new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  );
}

function isWeekendDate(targetYear: number, targetMonth: number, attendanceDay: number): boolean {
  const day = new Date(targetYear, targetMonth - 1, attendanceDay).getDay();
  return day === 0 || day === 6;
}

function selectNormalWorkTime(
  attendanceDay: number,
  settings: NormalWorkTimeSettings,
): NormalWorkTime | null {
  const day = getDayOfMonth(attendanceDay);
  const untilApplyDay = toInteger(settings.until.applyDay);
  const fromApplyDay = toInteger(settings.from.applyDay);

  if (day === null || untilApplyDay === null || fromApplyDay === null) {
    return settingToNormalWorkTime(settings.until);
  }

  if (day <= untilApplyDay) {
    return settingToNormalWorkTime(settings.until);
  }

  if (day >= fromApplyDay) {
    return settingToNormalWorkTime(settings.from);
  }

  return settingToNormalWorkTime(settings.until);
}

export function validateNormalWorkTimeDifferences(
  rows: AttendanceWorkRowForNormalTimeCheck[],
  settings: NormalWorkTimeSettings = createDefaultNormalWorkTimeSettings(),
): NormalWorkTimeDiffError[] {
  const errors: NormalWorkTimeDiffError[] = [];

  rows.forEach((row) => {
    if (
      isFutureDate(row.targetYear, row.targetMonth, row.attendanceDay) ||
      isWeekendDate(row.targetYear, row.targetMonth, row.attendanceDay)
    ) {
      return;
    }
    if (row.workTypeCode.trim() !== "") return;

    const start = row.startTime.trim();
    const end = row.endTime.trim();
    const breakValue = row.breakMinutes.trim();
    if (start === "" || end === "" || breakValue === "") return;

    const actualStart = parseTimeToMinutes(start);
    const actualEnd = parseTimeToMinutes(end);
    const actualBreak = Number(breakValue);
    if (
      actualStart === null ||
      actualEnd === null ||
      actualEnd < actualStart ||
      Number.isNaN(actualBreak) ||
      actualBreak < 0 ||
      actualEnd - actualStart - actualBreak < 0
    ) {
      return;
    }

    const expected = selectNormalWorkTime(row.attendanceDay, settings);
    if (expected === null) return;

    if (actualStart !== expected.startMinutes) {
      errors.push({
        attendanceDay: row.attendanceDay,
        field: "startTime",
        message: `通常出勤時間設定の始業時刻(${formatMinutes(
          expected.startMinutes,
        )})と異なります`,
      });
    }

    if (actualEnd !== expected.endMinutes) {
      errors.push({
        attendanceDay: row.attendanceDay,
        field: "endTime",
        message: `通常出勤時間設定の終業時刻(${formatMinutes(
          expected.endMinutes,
        )})と異なります`,
      });
    }

    if (actualBreak !== expected.breakMinutes) {
      errors.push({
        attendanceDay: row.attendanceDay,
        field: "breakMinutes",
        message: `通常出勤時間設定の休憩時間(${expected.breakMinutes}分)と異なります`,
      });
    }
  });

  return errors;
}
