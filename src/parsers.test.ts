import { describe, expect, it } from 'vitest';
import { localWallTimeToUtc, makeFingerprint, normalizeType, parseCsv, toCsv } from './parsers';

describe('training import normalization', () => {
  it('maps common activity names to neutral types', () => {
    expect(normalizeType('Trail Run')).toBe('run');
    expect(normalizeType('Weight Training')).toBe('strength');
    expect(normalizeType('Kayak')).toBe('other');
  });

  it('interprets local wall time in the chosen IANA time zone', () => {
    expect(localWallTimeToUtc('2026-08-28 07:30', 'America/New_York')).toBe('2026-08-28T11:30:00.000Z');
    expect(localWallTimeToUtc('2026-08-28T07:30:00+02:00', 'UTC')).toBe('2026-08-28T05:30:00.000Z');
  });

  it.each([
    '2026-02-31 08:00',
    '2026-02-31T08:00:00Z',
    '2026-13-01 08:00',
    '2026-04-31 08:00',
    '2026-08-28 08:00 trailing'
  ])('rejects an impossible or contaminated CSV date: %s', (date) => {
    expect(() => parseCsv(`date,type,title,duration,distance\n${date},run,Impossible,30,5`, 'invalid.csv', 'UTC'))
      .toThrow(/not a valid calendar date|not a supported date/);
  });

  it('accepts leap day only in leap years and rejects nonexistent local DST times', () => {
    expect(localWallTimeToUtc('2028-02-29 08:00', 'UTC')).toBe('2028-02-29T08:00:00.000Z');
    expect(() => localWallTimeToUtc('2027-02-29 08:00', 'UTC')).toThrow(/not a valid calendar date/);
    expect(() => localWallTimeToUtc('2026-03-08 02:30', 'America/New_York')).toThrow(/does not exist/);
  });

  it('parses quoted CSV, preserves source links, and normalizes seconds/meters', () => {
    const csv = [
      'start_date,activity_type,activity_name,elapsed_time,distance_m,notes,source,url',
      '2026-08-28T06:00:00Z,Running,"Morning, easy",1800,5200,"Felt, smooth",Watch export,https://example.test/activity/1'
    ].join('\n');
    const [workout] = parseCsv(csv, 'watch.csv', 'UTC');
    expect(workout.title).toBe('Morning, easy');
    expect(workout.type).toBe('run');
    expect(workout.durationMinutes).toBe(30);
    expect(workout.distanceKm).toBe(5.2);
    expect(workout.sourceUrl).toBe('https://example.test/activity/1');
  });

  it('gives equivalent cross-source sessions the same duplicate fingerprint', () => {
    const base = { startedAt: '2026-08-28T06:01:00.000Z', type: 'run' as const, durationMinutes: 31, distanceKm: 5.02 };
    const close = { startedAt: '2026-08-28T06:02:00.000Z', type: 'run' as const, durationMinutes: 30, distanceKm: 5.04 };
    expect(makeFingerprint(base)).toBe(makeFingerprint(close));
  });

  it('exports a portable CSV with provenance', () => {
    const [workout] = parseCsv('date,type,duration,distance,source\n2026-08-28,Run,45,7.5,Watch', 'one.csv', 'UTC');
    const output = toCsv([workout]);
    expect(output).toContain('started_at,timezone,title');
    expect(output).toContain('"Watch"');
    expect(output).toContain('"7.50"');
  });

  it('explains malformed CSV rows', () => {
    expect(() => parseCsv('title,duration\nRun,30', 'broken.csv', 'UTC')).toThrow(/needs a date column/);
  });

  it.each([
    ['duration', '-30', /duration must be between 1 and 1440/],
    ['duration', '1441', /duration must be between 1 and 1440/],
    ['distance', '-5', /distance must be 0 or more/],
    ['load', '-50', /load must be between 0 and 10000/],
    ['load', '10001', /load must be between 0 and 10000/],
    ['distance', '5 laps', /distance “5 laps” is not a number/]
  ])('rejects invalid imported %s values instead of changing them', (field, value, message) => {
    expect(() => parseCsv(`date,type,title,duration,distance,load\n2026-08-28 08:00,run,Invalid,30,5,10`.replace(
      new RegExp(`(?<=${field === 'duration' ? 'Invalid,' : field === 'distance' ? 'Invalid,30,' : 'Invalid,30,5,'})[^,]+`), value
    ), 'invalid.csv', 'UTC')).toThrow(message);
  });

});
