import { describe, it, expect } from 'vitest';
import { DEFAULTS, type Settings } from '../lib/settings';
import { computeLate, dayInfo, monthSummary, yearSummary, type Days, type DayRec } from '../lib/rules';
import { isoAt, parseDmy } from '../lib/time';
import { shortName, renameFirst } from '../lib/names';

const s: Settings = { ...DEFAULTS, goLive: '2026-11-16' };
const hybrid = { id: 1, type: 'hybrid' as const };
const part = { id: 2, type: 'part' as const };
const TODAY = '2026-11-30';

function checkIn(k: string, hm: string, mode: DayRec['mode'] = 'office', p = hybrid): DayRec {
  const at = isoAt(k, hm);
  return { date: k, mode, checkInAt: at, eod: 'done', ...computeLate(s, p, k, mode, at) };
}

describe('late marks (R2-R4)', () => {
  it('AC3: 10:16 on an office day is a late mark; 10:15 is not', () => {
    expect(computeLate(s, hybrid, '2026-11-17', 'office', isoAt('2026-11-17', '10:16')).lateStatus).toBe('late');
    expect(computeLate(s, hybrid, '2026-11-17', 'office', isoAt('2026-11-17', '10:15')).lateStatus).toBe('none');
  });
  it('AC3: the 3rd late mark in a month costs half a day of casual leave', () => {
    const days: Days = {};
    for (const k of ['2026-11-17', '2026-11-18', '2026-11-19']) days[k] = checkIn(k, '10:20');
    // fill other working days with on-time check-ins so they are not absent
    for (let d = 16; d <= 30; d++) { const k = `2026-11-${d}`; if (!days[k]) days[k] = checkIn(k, '09:50'); }
    const ms = monthSummary(s, hybrid, days, '2026-11', TODAY);
    expect(ms.lateMarks).toBe(3);
    expect(ms.halfDays).toBe(1);
    const y = yearSummary(s, hybrid, days, TODAY);
    expect(y.cl.bal).toBe(7.5);
  });
  it('AC4: 11:01 is severe and costs half a day on its own', () => {
    const days: Days = {};
    for (let d = 16; d <= 30; d++) { const k = `2026-11-${d}`; days[k] = checkIn(k, d === 17 ? '11:01' : '09:50'); }
    const ms = monthSummary(s, hybrid, days, '2026-11', TODAY);
    expect(ms.severe).toBe(1);
    expect(ms.halfDays).toBe(1);
  });
  it('part-time and meeting days are exempt', () => {
    expect(computeLate(s, part, '2026-11-17', 'office', isoAt('2026-11-17', '12:00')).lateStatus).toBe('exempt');
    expect(computeLate(s, hybrid, '2026-11-17', 'meeting', isoAt('2026-11-17', '12:00')).lateStatus).toBe('exempt');
  });
  it('stored late status wins over current settings (rule changes do not rewrite history)', () => {
    const rec = checkIn('2026-11-17', '10:20');
    const looser = { ...s, graceMin: 30 };
    expect(dayInfo(looser, hybrid, '2026-11-17', rec, TODAY).late).toBe(true);
  });
});

describe('absence (R7, R13)', () => {
  it('AC5: a working day with no check-in or leave is absent and costs 1 casual day', () => {
    const days: Days = {};
    for (let d = 16; d <= 30; d++) { const k = `2026-11-${d}`; if (d !== 18) days[k] = checkIn(k, '09:50'); }
    expect(dayInfo(s, hybrid, '2026-11-18', undefined, TODAY).label).toBe('Absent');
    expect(yearSummary(s, hybrid, days, TODAY).cl.bal).toBe(7);
  });
  it('nothing counts before go-live', () => {
    expect(dayInfo(s, hybrid, '2026-11-13', undefined, TODAY).absent).toBe(0);
  });
  it('weekends are not absent', () => {
    expect(dayInfo(s, hybrid, '2026-11-21', undefined, TODAY).absent).toBe(0);
  });
  it('rejected leave does not cover the day', () => {
    const rec: DayRec = { date: '2026-11-18', leave: { half: false, kind: 'casual', appliedAt: isoAt('2026-11-10', '10:00'), status: 'rejected', source: 'employee' } };
    expect(dayInfo(s, hybrid, '2026-11-18', rec, TODAY).label).toBe('Absent');
  });
  it('planned leave applied the day before is planned; same day is unplanned', () => {
    const lv = (applied: string) => ({ date: '2026-11-18', leave: { half: false, kind: 'casual' as const, appliedAt: isoAt(applied, '09:00'), status: 'approved' as const, source: 'employee' as const } });
    expect(dayInfo(s, hybrid, '2026-11-18', lv('2026-11-17'), TODAY).unplanned).toBe(false);
    expect(dayInfo(s, hybrid, '2026-11-18', lv('2026-11-18'), TODAY).unplanned).toBe(true);
  });
});

describe('dates and names', () => {
  it('AC8: 31-02-2001 is rejected, 05-04-2001 parses', () => {
    expect(parseDmy('31-02-2001')).toBeNull();
    expect(parseDmy('05-04-2001')).toBe('2001-04-05');
  });
  it('AC11 / NAME-1: display names keep titles', () => {
    expect(shortName('Krishna Rakesh Mehta')).toBe('Krishna');
    expect(shortName('Dr. Krish Mehta')).toBe('Dr. Krish');
    expect(shortName('CA Suketu Shah')).toBe('CA Suketu');
  });
  it('NAME-4: renaming keeps the surname', () => {
    expect(renameFirst('Dr. Krish Mehta', 'Krishna')).toBe('Krishna Mehta');
    expect(renameFirst('Krish Mehta', 'Krishna')).toBe('Krishna Mehta');
  });
});
