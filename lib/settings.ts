export type Settings = {
  officeStart: string; graceMin: number; latesPerHalfDay: number; severeLateMin: number;
  planBy: string; eodBy: string; officeDaysPerWeek: number; weeklyHours: number;
  casualLeave: number; earnedLeave: number; dailyMaxHours: number; weeklyMaxHours: number;
  leaveYearStartMonth: number; goLive: string; lateAppliesToWfh: boolean;
  workdays: number[];
  /** 'YYYY-MM-DD Name' */
  holidays: string[];
  /** 'YYYY-MM-DD' */
  gamesdays: string[];
  reminders: { email: boolean; push: boolean };
};

export const DEFAULTS: Settings = {
  officeStart: '10:00', graceMin: 15, latesPerHalfDay: 3, severeLateMin: 60,
  planBy: '11:00', eodBy: '19:00', officeDaysPerWeek: 3, weeklyHours: 40,
  casualLeave: 8, earnedLeave: 18, dailyMaxHours: 9, weeklyMaxHours: 48,
  leaveYearStartMonth: 4, goLive: '2026-11-16', lateAppliesToWfh: true,
  workdays: [1, 2, 3, 4, 5], holidays: [], gamesdays: [],
  reminders: { email: true, push: true },
};

export const withDefaults = (v: Partial<Settings> | null | undefined): Settings => ({ ...DEFAULTS, ...(v || {}) });
