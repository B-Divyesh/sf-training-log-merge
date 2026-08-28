import type { ImportCandidate, Workout, WorkoutType } from './types';

const TYPE_MAP: Record<string, WorkoutType> = {
  run: 'run', running: 'run', trailrun: 'run', ride: 'ride', cycling: 'ride', bike: 'ride',
  strength: 'strength', weighttraining: 'strength', workout: 'strength', walk: 'walk', walking: 'walk',
  mobility: 'mobility', yoga: 'mobility'
};

export function normalizeType(value = ''): WorkoutType {
  const key = value.toLowerCase().replace(/[^a-z]/g, '');
  return TYPE_MAP[key] ?? 'other';
}

export function makeFingerprint(workout: Pick<Workout, 'startedAt' | 'type' | 'durationMinutes' | 'distanceKm'>): string {
  const fiveMinute = Math.round(new Date(workout.startedAt).getTime() / 300_000);
  const duration = Math.round(workout.durationMinutes / 5);
  const distance = Math.round((workout.distanceKm ?? 0) * 10);
  return `${fiveMinute}:${workout.type}:${duration}:${distance}`;
}

function splitCsvLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) { cells.push(cell.trim()); cell = ''; }
    else cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function findValue(row: Record<string, string>, aliases: string[]): string {
  for (const alias of aliases) if (row[alias] !== undefined) return row[alias];
  return '';
}

export function localWallTimeToUtc(value: string, timezone: string): string {
  const clean = value.trim().replace(' ', 'T');
  if (/([zZ]|[+-]\d\d:?\d\d)$/.test(clean)) {
    const parsed = new Date(clean);
    if (Number.isNaN(parsed.getTime())) throw new Error(`“${value}” is not a valid date and time.`);
    return parsed.toISOString();
  }
  const parts = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})(?:T(\d{1,2}):?(\d{2})?(?::?(\d{2}))?)?/);
  if (!parts) throw new Error(`“${value}” is not a supported date. Use YYYY-MM-DD HH:mm.`);
  const intended = Date.UTC(+parts[1], +parts[2] - 1, +parts[3], +(parts[4] ?? 0), +(parts[5] ?? 0), +(parts[6] ?? 0));
  let guess = intended;
  for (let i = 0; i < 2; i += 1) {
    const values = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
    }).formatToParts(new Date(guess)).filter((p) => p.type !== 'literal').map((p) => [p.type, +p.value]));
    const represented = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
    guess += intended - represented;
  }
  return new Date(guess).toISOString();
}

function numeric(value: string): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value.replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function parseCsv(text: string, fileName: string, timezone: string): ImportCandidate[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error(`${fileName} has no workout rows.`);
  const first = lines[0];
  const delimiter = first.includes('\t') ? '\t' : (first.split(';').length > first.split(',').length ? ';' : ',');
  const headers = splitCsvLine(first, delimiter).map((h) => h.toLowerCase().trim().replace(/[\s_-]+/g, ''));
  const dateAliases = ['startdate', 'startedat', 'date', 'datetime', 'starttime', 'activitydate'];
  if (!headers.some((h) => dateAliases.includes(h))) throw new Error(`${fileName} needs a date column (date, start_date, or started_at).`);

  return lines.slice(1).map((line, index) => {
    const values = splitCsvLine(line, delimiter);
    const row = Object.fromEntries(headers.map((header, i) => [header, values[i] ?? '']));
    const dateRaw = findValue(row, dateAliases);
    const durationRaw = findValue(row, ['durationminutes', 'durationmin', 'duration', 'elapsedtime', 'movingtime', 'seconds']);
    const durationValue = numeric(durationRaw) ?? 0;
    const durationHeader = headers.find((h) => ['durationminutes', 'durationmin', 'duration', 'elapsedtime', 'movingtime', 'seconds'].includes(h)) ?? '';
    const durationMinutes = /seconds|elapsedtime|movingtime/.test(durationHeader) ? durationValue / 60 : durationValue;
    const distanceRaw = findValue(row, ['distancekm', 'kilometers', 'distance', 'distancem', 'meters']);
    const distanceHeader = headers.find((h) => ['distancekm', 'kilometers', 'distance', 'distancem', 'meters'].includes(h)) ?? '';
    const rawDistance = numeric(distanceRaw);
    const distanceKm = rawDistance === undefined ? undefined : (/distancem|meters/.test(distanceHeader) ? rawDistance / 1000 : rawDistance);
    const startedAt = localWallTimeToUtc(dateRaw, timezone);
    const type = normalizeType(findValue(row, ['activitytype', 'sport', 'type', 'category']));
    const workout: ImportCandidate = {
      id: crypto.randomUUID(), startedAt, timezone,
      title: findValue(row, ['activityname', 'name', 'title', 'workout']) || `${type === 'other' ? 'Workout' : type[0].toUpperCase() + type.slice(1)}`,
      type, durationMinutes: Math.max(0, durationMinutes), distanceKm,
      load: numeric(findValue(row, ['load', 'sessionload', 'rpe'])),
      notes: findValue(row, ['notes', 'description', 'comment']),
      source: findValue(row, ['source', 'app']) || fileName.replace(/\.csv$/i, ''),
      sourceId: findValue(row, ['activityid', 'sourceid', 'id']) || undefined,
      sourceUrl: findValue(row, ['activityurl', 'sourceurl', 'url', 'link']) || undefined,
      importedAt: new Date().toISOString(), fingerprint: '', fileName
    };
    workout.fingerprint = makeFingerprint(workout);
    if (!workout.durationMinutes && workout.distanceKm === undefined) throw new Error(`${fileName}, row ${index + 2}: add duration or distance.`);
    return workout;
  });
}

function haversine(a: [number, number], b: [number, number]): number {
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function parseGpx(text: string, fileName: string, timezone: string): ImportCandidate[] {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error(`${fileName} is not valid GPX XML.`);
  const tracks = [...xml.querySelectorAll('trk')];
  if (!tracks.length) throw new Error(`${fileName} has no tracks.`);
  return tracks.map((track, index) => {
    const points = [...track.querySelectorAll('trkpt')];
    const timed = points.map((point) => ({
      pos: [Number(point.getAttribute('lat')), Number(point.getAttribute('lon'))] as [number, number],
      time: point.querySelector('time')?.textContent ?? ''
    })).filter((point) => point.pos.every(Number.isFinite));
    if (!timed.length) throw new Error(`${fileName}, track ${index + 1} has no usable points.`);
    const firstTime = timed.find((point) => point.time)?.time;
    const lastTime = [...timed].reverse().find((point) => point.time)?.time;
    const startedAt = firstTime ? localWallTimeToUtc(firstTime, timezone) : new Date().toISOString();
    const durationMinutes = firstTime && lastTime ? Math.max(0, (new Date(lastTime).getTime() - new Date(firstTime).getTime()) / 60_000) : 0;
    const distanceKm = timed.slice(1).reduce((sum, point, i) => sum + haversine(timed[i].pos, point.pos), 0);
    const workout: ImportCandidate = {
      id: crypto.randomUUID(), startedAt, timezone,
      title: track.querySelector('name')?.textContent?.trim() || fileName.replace(/\.gpx$/i, ''),
      type: normalizeType(track.querySelector('type')?.textContent ?? 'run'),
      durationMinutes, distanceKm, notes: '', source: fileName.replace(/\.gpx$/i, ''),
      importedAt: new Date().toISOString(), fingerprint: '', fileName
    };
    workout.fingerprint = makeFingerprint(workout);
    return workout;
  });
}

export async function parseFiles(files: File[], timezone: string): Promise<{ workouts: ImportCandidate[]; errors: string[] }> {
  const workouts: ImportCandidate[] = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const text = await file.text();
      workouts.push(...(file.name.toLowerCase().endsWith('.gpx') ? parseGpx(text, file.name, timezone) : parseCsv(text, file.name, timezone)));
    } catch (error) { errors.push(error instanceof Error ? error.message : `Could not read ${file.name}.`); }
  }
  return { workouts, errors };
}

export function toCsv(workouts: Workout[]): string {
  const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
  const headers = ['started_at', 'timezone', 'title', 'type', 'duration_minutes', 'distance_km', 'load', 'notes', 'source', 'source_id', 'source_url'];
  const rows = workouts.map((w) => [w.startedAt, w.timezone, w.title, w.type, w.durationMinutes.toFixed(1), w.distanceKm?.toFixed(2) ?? '', w.load ?? '', w.notes, w.source, w.sourceId ?? '', w.sourceUrl ?? ''].map(escape).join(','));
  return [headers.join(','), ...rows].join('\n');
}
