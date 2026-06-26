export type ApplyType = "until" | "from";
export type NumericValue = number | "";

export type TimeSetting = {
  applyType: ApplyType;
  applyDay: NumericValue;
  startHour: NumericValue;
  startMinute: NumericValue;
  endHour: NumericValue;
  endMinute: NumericValue;
  breakMinutes: NumericValue;
};

export type SettingId = "until" | "from";
export type NumericField = Exclude<keyof TimeSetting, "applyType">;
export type NormalWorkTimeSettings = Record<SettingId, TimeSetting>;

export function createDefaultNormalWorkTimeSettings(): NormalWorkTimeSettings {
  return {
    until: {
      applyType: "until",
      applyDay: "",
      startHour: 9,
      startMinute: 0,
      endHour: 18,
      endMinute: 0,
      breakMinutes: 60,
    },
    from: {
      applyType: "from",
      applyDay: "",
      startHour: 10,
      startMinute: 0,
      endHour: 19,
      endMinute: 0,
      breakMinutes: 60,
    },
  };
}

export function cloneNormalWorkTimeSettings(
  settings: NormalWorkTimeSettings,
): NormalWorkTimeSettings {
  return {
    until: { ...settings.until },
    from: { ...settings.from },
  };
}
