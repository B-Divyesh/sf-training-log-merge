import './styles.css';
import { deleteWorkout, getWorkouts, replaceAllWorkouts, saveWorkouts } from './db';
import { localWallTimeToUtc, makeFingerprint, parseFiles, toCsv } from './parsers';
import { cachedUnlocked, captureLicenseFromUrl, checkoutUrl, licenseToken, storeLicense, verifyLicense } from './license';
import type { ImportCandidate, Workout, WorkoutType } from './types';

const app = document.querySelector<HTMLDivElement>('#app')!;
if (!app) throw new Error('App root missing');

const icons: Record<string, string> = {
  import: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 16v4h16v-4"/></svg>',
  plus: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  prev: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14 6-6 6 6 6"/></svg>',
  next: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m10 6 6 6-6 6"/></svg>',
  export: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 4v12m0 0-4-4m4 4 4-4M5 19h14"/></svg>',
  lock: '<svg aria-hidden="true" viewBox="0 0 24 24"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>'
};

let workouts: Workout[] = [];
let preview: ImportCandidate[] = [];
let importErrors: string[] = [];
let timezone = localStorage.getItem('tlm:timezone') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
let weekStart = startOfWeek(new Date(), timezone);
let typeFilter = 'all';
let sourceFilter = 'all';
let unlocked = cachedUnlocked();
let deletedForUndo: Workout | null = null;
let undoTimer = 0;

function html(value: unknown): string {
  return String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char);
}

function dateKey(date: Date, zone: string): string {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function moveDateKey(key: string, days: number): string {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function startOfWeek(date: Date, zone: string): string {
  const key = dateKey(date, zone);
  const day = new Date(`${key}T12:00:00Z`).getUTCDay();
  return moveDateKey(key, day === 0 ? -6 : 1 - day);
}

function formatDay(key: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('en', { timeZone: 'UTC', ...options }).format(new Date(`${key}T12:00:00Z`));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('en', { timeZone: timezone, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}

function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return remaining ? `${hours} hr ${remaining} min` : `${hours} hr`;
}

function currentWeekWorkouts(): Workout[] {
  const end = moveDateKey(weekStart, 7);
  return workouts.filter((workout) => {
    const key = dateKey(new Date(workout.startedAt), timezone);
    return key >= weekStart && key < end && (typeFilter === 'all' || workout.type === typeFilter) && (sourceFilter === 'all' || workout.source === sourceFilter);
  });
}

function typeLabel(type: WorkoutType): string {
  return ({ run: 'Run', ride: 'Ride', strength: 'Strength', walk: 'Walk', mobility: 'Mobility', other: 'Other' })[type];
}

function initialTemplate(): string {
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="Training Log Merge home"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span><span>Training Log<br><b>Merge</b></span></a>
      <nav aria-label="Utility navigation">
        <span class="status-chip" id="networkStatus"><span></span>Local only</span>
        <button class="text-button" id="settingsButton" type="button">Settings</button>
        <button class="text-button field-kit" id="unlockButton" type="button" aria-label="Open field kit">${icons.lock}<span>Field kit</span></button>
      </nav>
    </header>
    <main id="main">
      <section class="hero" aria-labelledby="pageTitle">
        <picture class="hero-art">
          <source type="image/webp" srcset="/assets/trail-ledger-768.webp 768w, /assets/trail-ledger-1536.webp 1536w" sizes="(max-width: 700px) 100vw, 1180px">
          <img src="/assets/trail-ledger-1536.webp" width="1536" height="1024" alt="Illustrated field map where separate running routes and strength marks converge into one weekly ledger" fetchpriority="high" decoding="async">
        </picture>
        <div class="hero-copy">
          <p class="eyebrow">Private weekly field log · ${html(timezone)}</p>
          <h1 id="pageTitle">Your training week,<br><em>on one map.</em></h1>
          <p>Bring CSV and GPX exports together with strength sessions. Review the week without sending it anywhere.</p>
          <div class="hero-actions">
            <button class="button primary" id="importButton" type="button">${icons.import}<span>Import workouts</span></button>
            <button class="button secondary" id="manualButton" type="button">${icons.plus}<span>Add strength</span></button>
          </div>
          <p class="privacy-note"><span aria-hidden="true">●</span> Processed and stored on this device</p>
        </div>
      </section>

      <section class="ledger" aria-labelledby="weekHeading">
        <div class="week-toolbar">
          <div>
            <p class="kicker">Map sheet <span id="sheetNumber"></span></p>
            <h2 id="weekHeading"></h2>
            <p class="zone-note">Shown in <span id="zoneLabel">${html(timezone)}</span></p>
          </div>
          <div class="week-controls" aria-label="Choose week">
            <button class="icon-button" id="previousWeek" type="button" aria-label="Previous week">${icons.prev}</button>
            <button class="today-button" id="thisWeek" type="button">This week</button>
            <button class="icon-button" id="nextWeek" type="button" aria-label="Next week">${icons.next}</button>
          </div>
        </div>
        <div class="metrics" id="metrics" aria-label="Week summary"></div>
        <div class="filter-row">
          <label>Session type<select id="typeFilter"><option value="all">All types</option><option value="run">Run</option><option value="ride">Ride</option><option value="strength">Strength</option><option value="walk">Walk</option><option value="mobility">Mobility</option><option value="other">Other</option></select></label>
          <label>Source<select id="sourceFilter"><option value="all">All sources</option></select></label>
          <button class="button quiet" id="exportCsv" type="button">${icons.export}<span>Export all CSV</span></button>
        </div>
        <div id="timeline" class="timeline"></div>
      </section>

      <section class="fieldkit-strip" aria-labelledby="fieldkitTitle">
        <div><p class="kicker">Optional paid field kit</p><h2 id="fieldkitTitle">Keep the core free. Back up the whole map.</h2><p>JSON backup and restore for <strong>$19 once</strong>. Imports, edits, weekly review, and CSV export stay free.</p></div>
        <button class="button secondary" id="fieldkitStripButton" type="button">${icons.lock}<span>${unlocked ? 'Open field kit' : 'See the field kit'}</span></button>
      </section>
    </main>
    <footer><div><span class="footer-mark">TLM / 26</span><p>A source-neutral training ledger. No coaching, rankings, health claims, accounts, analytics, or cloud sync.</p></div><nav aria-label="Legal"><a href="/privacy/">Privacy</a><a href="/terms/">Terms</a><span>AI-generated map artwork</span></nav></footer>

    <dialog id="importDialog" aria-labelledby="importTitle">
      <form method="dialog" class="dialog-shell" id="importForm">
        <div class="dialog-heading"><div><p class="kicker">Add source tracks</p><h2 id="importTitle">Import workouts</h2></div><button class="close-button" value="cancel" aria-label="Close import dialog">×</button></div>
        <p>Choose one or more simple CSV or GPX exports. Dates without an offset use <strong>${html(timezone)}</strong>. Files never leave this device.</p>
        <label class="drop-field" for="workoutFiles">${icons.import}<strong>Choose CSV or GPX files</strong><span>Multiple files are welcome · up to 10 MB each</span><input id="workoutFiles" type="file" accept=".csv,.gpx,text/csv,application/gpx+xml" multiple></label>
        <div id="importPreview" aria-live="polite"></div>
        <div class="dialog-actions"><button class="button quiet" value="cancel">Cancel</button><button class="button primary" id="commitImport" type="button" disabled>Import new sessions</button></div>
      </form>
    </dialog>

    <dialog id="workoutDialog" aria-labelledby="workoutDialogTitle">
      <form class="dialog-shell" id="workoutForm">
        <div class="dialog-heading"><div><p class="kicker" id="workoutKicker">Manual trail mark</p><h2 id="workoutDialogTitle">Add strength session</h2></div><button class="close-button" type="button" data-close="workoutDialog" aria-label="Close session dialog">×</button></div>
        <input type="hidden" name="id"><input type="hidden" name="type" value="strength">
        <div class="form-grid">
          <label class="span-2">Session label<input name="title" required maxlength="80" autocomplete="off"></label>
          <label>Date<input name="date" type="date" required></label><label>Start time<input name="time" type="time" required></label>
          <label>Duration (minutes)<input name="duration" type="number" min="1" max="1440" required inputmode="decimal"></label>
          <label>Session load <span class="optional">optional</span><input name="load" type="number" min="0" max="10000" inputmode="decimal" aria-describedby="loadHint"></label>
          <p class="form-hint span-2" id="loadHint">Use your own consistent scale. We don’t interpret it.</p>
          <label class="span-2">Notes <span class="optional">optional</span><textarea name="notes" rows="3" maxlength="500"></textarea></label>
        </div>
        <div class="dialog-actions"><button class="button danger hidden" id="deleteWorkout" type="button">Delete session</button><span class="action-spacer"></span><button class="button quiet" type="button" data-close="workoutDialog">Cancel</button><button class="button primary" type="submit">Save session</button></div>
      </form>
    </dialog>

    <dialog id="settingsDialog" aria-labelledby="settingsTitle"><form class="dialog-shell" id="settingsForm">
      <div class="dialog-heading"><div><p class="kicker">Local display</p><h2 id="settingsTitle">Settings</h2></div><button class="close-button" type="button" data-close="settingsDialog" aria-label="Close settings">×</button></div>
      <label>Review time zone<input name="timezone" value="${html(timezone)}" required aria-describedby="zoneHint"></label><p class="form-hint" id="zoneHint">Use an IANA zone such as Europe/London or America/New_York. It controls week boundaries and imports without an offset.</p>
      <div class="dialog-actions"><button class="button quiet" type="button" data-close="settingsDialog">Cancel</button><button class="button primary" type="submit">Save settings</button></div>
    </form></dialog>

    <dialog id="unlockDialog" aria-labelledby="unlockTitle"><div class="dialog-shell">
      <div class="dialog-heading"><div><p class="kicker">One-time purchase</p><h2 id="unlockTitle">Field kit</h2></div><button class="close-button" type="button" data-close="unlockDialog" aria-label="Close field kit">×</button></div>
      <div id="licenseState"></div>
      <ul class="feature-list"><li><span>01</span>Versioned JSON backup of every session</li><li><span>02</span>Restore or move your ledger between devices</li><li><span>03</span>Support a private, source-neutral utility</li></ul>
      <p>Pay <strong>$19 once</strong>. Sociobot/Dodo is the merchant of record and handles refunds; a refunded license is revoked. No subscription.</p>
      <div class="paid-actions" id="paidActions"></div>
      <hr><form id="licenseForm"><label>Have a license?<input name="license" value="${html(licenseToken())}" autocomplete="off" spellcheck="false" placeholder="Paste license token"></label><button class="button quiet" type="submit">Verify license</button></form>
      <p class="legal-small">Purchase and verification contact the Sociobot billing service. See <a href="/privacy/">privacy</a> and <a href="/terms/">terms</a>.</p>
    </div></dialog>
    <label class="visually-hidden" for="restoreJson">Choose a Training Log Merge JSON backup</label><input class="visually-hidden" id="restoreJson" type="file" accept="application/json,.json">
    <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
    <div class="update-toast" id="updateToast" hidden><span>A fresh map sheet is ready.</span><button type="button" id="updateButton">Update app</button></div>`;
}

function renderLedger(): void {
  const visible = currentWeekWorkouts();
  const weekEnd = moveDateKey(weekStart, 6);
  const heading = `${formatDay(weekStart, { month: 'short', day: 'numeric' })} – ${formatDay(weekEnd, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  document.querySelector('#weekHeading')!.textContent = heading;
  document.querySelector('#sheetNumber')!.textContent = weekStart.replaceAll('-', '·');
  const duration = visible.reduce((sum, w) => sum + w.durationMinutes, 0);
  const distance = visible.reduce((sum, w) => sum + (w.distanceKm ?? 0), 0);
  const load = visible.reduce((sum, w) => sum + (w.load ?? 0), 0);
  document.querySelector('#metrics')!.innerHTML = `
    <div><strong>${visible.length}</strong><span>session${visible.length === 1 ? '' : 's'}</span></div>
    <div><strong>${formatDuration(duration)}</strong><span>time logged</span></div>
    <div><strong>${distance.toFixed(1)} <small>km</small></strong><span>distance</span></div>
    <div><strong>${load || '—'}</strong><span>noted load</span></div>`;
  const sourceSelect = document.querySelector<HTMLSelectElement>('#sourceFilter')!;
  const sources = [...new Set(workouts.map((w) => w.source))].sort();
  sourceSelect.innerHTML = '<option value="all">All sources</option>' + sources.map((source) => `<option value="${html(source)}" ${source === sourceFilter ? 'selected' : ''}>${html(source)}</option>`).join('');

  const timeline = document.querySelector<HTMLDivElement>('#timeline')!;
  if (!visible.length) {
    timeline.innerHTML = `<div class="empty-state"><div class="empty-contours" aria-hidden="true"><i></i><i></i><i></i></div><p class="kicker">No marks on this sheet</p><h3>${workouts.length ? 'This week is clear.' : 'Plot your first training week.'}</h3><p>${workouts.length ? 'Move to another week, change a filter, or add a session.' : 'Import a CSV or GPX export, then add strength work alongside it.'}</p><div><button class="button primary" type="button" data-open-import>${icons.import}<span>Import workouts</span></button><button class="button quiet" type="button" data-open-manual>${icons.plus}<span>Add strength</span></button></div></div>`;
  } else {
    const days = [...new Set(visible.map((w) => dateKey(new Date(w.startedAt), timezone)))];
    timeline.innerHTML = days.map((day) => {
      const sessions = visible.filter((w) => dateKey(new Date(w.startedAt), timezone) === day);
      return `<section class="day-group" aria-labelledby="day-${day}"><div class="day-label"><span>${formatDay(day, { weekday: 'short' })}</span><strong id="day-${day}">${formatDay(day, { day: '2-digit' })}</strong></div><ol>${sessions.map(sessionHtml).join('')}</ol></section>`;
    }).join('');
  }
  timeline.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach((button) => button.addEventListener('click', () => openEdit(button.dataset.edit!)));
  timeline.querySelectorAll<HTMLButtonElement>('[data-open-import]').forEach((button) => button.addEventListener('click', openImport));
  timeline.querySelectorAll<HTMLButtonElement>('[data-open-manual]').forEach((button) => button.addEventListener('click', openManual));
}

function sessionHtml(workout: Workout): string {
  let sourceUrl = '';
  try { const candidate = new URL(workout.sourceUrl ?? ''); if (['http:', 'https:'].includes(candidate.protocol)) sourceUrl = candidate.href; } catch { /* Render unsafe or malformed links as text. */ }
  const source = sourceUrl ? `<a href="${html(sourceUrl)}" target="_blank" rel="noopener noreferrer" aria-label="Open source record for ${html(workout.title)}">${html(workout.source)} ↗</a>` : html(workout.source);
  return `<li class="session type-${workout.type}"><span class="trail-dot" aria-hidden="true"></span><button class="session-main" type="button" data-edit="${html(workout.id)}" aria-label="Edit ${html(workout.title)}">
    <span class="session-top"><span class="type-stamp">${typeLabel(workout.type)}</span><time datetime="${html(workout.startedAt)}">${formatTime(workout.startedAt)}</time></span>
    <strong>${html(workout.title)}</strong><span class="session-meta">${formatDuration(workout.durationMinutes)}${workout.distanceKm !== undefined ? ` · ${workout.distanceKm.toFixed(2)} km` : ''}${workout.load !== undefined ? ` · Load ${workout.load}` : ''}</span>${workout.notes ? `<span class="session-notes">${html(workout.notes)}</span>` : ''}
  </button><span class="source-stamp">${source}</span></li>`;
}

function showToast(message: string, action?: string): void {
  const toast = document.querySelector<HTMLDivElement>('#toast')!;
  toast.innerHTML = `${html(message)}${action ? ` <button type="button" id="toastAction">${html(action)}</button>` : ''}`;
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, action ? 8000 : 4000);
}

function openDialog(id: string): void { document.querySelector<HTMLDialogElement>(`#${id}`)!.showModal(); }
function closeDialog(id: string): void { document.querySelector<HTMLDialogElement>(`#${id}`)!.close(); }

function openImport(): void {
  preview = []; importErrors = []; renderImportPreview();
  (document.querySelector<HTMLInputElement>('#workoutFiles')!).value = '';
  openDialog('importDialog');
}

function openManual(): void {
  const form = document.querySelector<HTMLFormElement>('#workoutForm')!;
  form.reset();
  const now = new Date();
  (form.elements.namedItem('id') as HTMLInputElement).value = '';
  (form.elements.namedItem('type') as HTMLInputElement).value = 'strength';
  (form.elements.namedItem('title') as HTMLInputElement).value = 'Strength training';
  (form.elements.namedItem('date') as HTMLInputElement).value = dateKey(now, timezone);
  (form.elements.namedItem('time') as HTMLInputElement).value = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(now);
  document.querySelector('#workoutKicker')!.textContent = 'Manual trail mark';
  document.querySelector('#workoutDialogTitle')!.textContent = 'Add strength session';
  document.querySelector('#deleteWorkout')!.classList.add('hidden');
  openDialog('workoutDialog');
}

function openEdit(id: string): void {
  const workout = workouts.find((item) => item.id === id);
  if (!workout) return;
  const form = document.querySelector<HTMLFormElement>('#workoutForm')!;
  (form.elements.namedItem('id') as HTMLInputElement).value = workout.id;
  (form.elements.namedItem('type') as HTMLInputElement).value = workout.type;
  (form.elements.namedItem('title') as HTMLInputElement).value = workout.title;
  (form.elements.namedItem('date') as HTMLInputElement).value = dateKey(new Date(workout.startedAt), timezone);
  (form.elements.namedItem('time') as HTMLInputElement).value = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(workout.startedAt));
  (form.elements.namedItem('duration') as HTMLInputElement).value = String(Math.round(workout.durationMinutes));
  (form.elements.namedItem('load') as HTMLInputElement).value = workout.load?.toString() ?? '';
  (form.elements.namedItem('notes') as HTMLTextAreaElement).value = workout.notes;
  document.querySelector('#workoutKicker')!.textContent = `${workout.source} · ${typeLabel(workout.type)}`;
  document.querySelector('#workoutDialogTitle')!.textContent = 'Edit session';
  document.querySelector('#deleteWorkout')!.classList.remove('hidden');
  openDialog('workoutDialog');
}

function renderImportPreview(): void {
  const node = document.querySelector<HTMLDivElement>('#importPreview')!;
  const fresh = preview.filter((item) => !item.duplicate);
  node.innerHTML = `${importErrors.length ? `<div class="error-box"><strong>Some files need attention</strong><ul>${importErrors.map((error) => `<li>${html(error)}</li>`).join('')}</ul></div>` : ''}
    ${preview.length ? `<div class="preview-summary"><strong>${fresh.length} new session${fresh.length === 1 ? '' : 's'}</strong><span>${preview.length - fresh.length} duplicate${preview.length - fresh.length === 1 ? '' : 's'} will be skipped</span></div><ol class="preview-list">${preview.map((item) => `<li class="${item.duplicate ? 'duplicate' : ''}"><span><strong>${html(item.title)}</strong><small>${html(item.fileName)} · ${new Date(item.startedAt).toLocaleDateString()}</small></span><em>${item.duplicate ? 'Already logged' : formatDuration(item.durationMinutes)}</em></li>`).join('')}</ol>` : ''}`;
  const commit = document.querySelector<HTMLButtonElement>('#commitImport')!;
  commit.disabled = !fresh.length;
  commit.textContent = fresh.length ? `Import ${fresh.length} new session${fresh.length === 1 ? '' : 's'}` : 'Import new sessions';
}

function download(name: string, content: string, type: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = Object.assign(document.createElement('a'), { href: url, download: name });
  anchor.click();
  URL.revokeObjectURL(url);
}

function renderLicenseState(message = ''): void {
  const state = document.querySelector<HTMLDivElement>('#licenseState')!;
  const actions = document.querySelector<HTMLDivElement>('#paidActions')!;
  state.innerHTML = message ? `<p class="license-notice">${html(message)}</p>` : (unlocked ? '<p class="license-ok"><span>✓</span> Field kit unlocked on this device</p>' : '');
  actions.innerHTML = unlocked ? `<button class="button primary" id="backupJson" type="button">Back up JSON</button><button class="button quiet" id="restoreButton" type="button">Restore JSON</button>` : `<a class="button primary" href="${checkoutUrl}">Buy field kit · $19</a>`;
  document.querySelector('#backupJson')?.addEventListener('click', () => download(`training-log-backup-${dateKey(new Date(), timezone)}.json`, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), timezone, workouts }, null, 2), 'application/json'));
  document.querySelector('#restoreButton')?.addEventListener('click', () => document.querySelector<HTMLInputElement>('#restoreJson')!.click());
}

async function init(): Promise<void> {
  const captured = captureLicenseFromUrl();
  if (captured) unlocked = true;
  app.innerHTML = initialTemplate();
  try { workouts = await getWorkouts(); }
  catch (error) { showToast(error instanceof Error ? error.message : 'Could not open your local ledger.'); }
  bindEvents(); renderLedger(); renderLicenseState(captured ? 'License received. Verifying quietly…' : '');
  verifyLicense().then((result) => {
    unlocked = result.valid;
    renderLicenseState(result.reason && !['ok', 'missing', 'offline'].includes(result.reason) ? 'License no longer active. You can keep using every free feature.' : '');
  });
  registerServiceWorker(); updateNetworkStatus();
  const action = new URL(location.href).searchParams.get('action');
  if (action === 'manual') openManual();
  if (action === 'import') openImport();
}

function bindEvents(): void {
  document.querySelector('#importButton')!.addEventListener('click', openImport);
  document.querySelector('#manualButton')!.addEventListener('click', openManual);
  document.querySelector('#settingsButton')!.addEventListener('click', () => openDialog('settingsDialog'));
  ['unlockButton', 'fieldkitStripButton'].forEach((id) => document.querySelector(`#${id}`)!.addEventListener('click', () => { renderLicenseState(); openDialog('unlockDialog'); }));
  document.querySelectorAll<HTMLElement>('[data-close]').forEach((button) => button.addEventListener('click', () => closeDialog(button.dataset.close!)));
  document.querySelector('#previousWeek')!.addEventListener('click', () => { weekStart = moveDateKey(weekStart, -7); renderLedger(); });
  document.querySelector('#nextWeek')!.addEventListener('click', () => { weekStart = moveDateKey(weekStart, 7); renderLedger(); });
  document.querySelector('#thisWeek')!.addEventListener('click', () => { weekStart = startOfWeek(new Date(), timezone); renderLedger(); });
  document.querySelector<HTMLSelectElement>('#typeFilter')!.addEventListener('change', (event) => { typeFilter = (event.target as HTMLSelectElement).value; renderLedger(); });
  document.querySelector<HTMLSelectElement>('#sourceFilter')!.addEventListener('change', (event) => { sourceFilter = (event.target as HTMLSelectElement).value; renderLedger(); });
  document.querySelector('#exportCsv')!.addEventListener('click', () => { download(`training-log-${dateKey(new Date(), timezone)}.csv`, toCsv(workouts), 'text/csv;charset=utf-8'); showToast(`Exported ${workouts.length} sessions.`); });
  document.querySelector<HTMLInputElement>('#workoutFiles')!.addEventListener('change', async (event) => {
    const input = event.target as HTMLInputElement;
    document.querySelector<HTMLDivElement>('#importPreview')!.innerHTML = '<p class="loading-note">Reading and reconciling files…</p>';
    const oversized = [...(input.files ?? [])].filter((file) => file.size > 10_000_000);
    if (oversized.length) { importErrors = oversized.map((file) => `${file.name} is larger than 10 MB.`); renderImportPreview(); return; }
    const parsed = await parseFiles([...(input.files ?? [])], timezone);
    const seen = new Set(workouts.map((w) => w.fingerprint));
    preview = parsed.workouts.map((item) => { const duplicate = seen.has(item.fingerprint); seen.add(item.fingerprint); return { ...item, duplicate }; });
    importErrors = parsed.errors; renderImportPreview();
  });
  document.querySelector('#commitImport')!.addEventListener('click', async () => {
    const fresh = preview.filter((item) => !item.duplicate).map(({ duplicate: _duplicate, fileName: _fileName, ...item }) => item);
    await saveWorkouts(fresh); workouts = await getWorkouts(); closeDialog('importDialog'); renderLedger(); showToast(`Added ${fresh.length} session${fresh.length === 1 ? '' : 's'}; duplicates were skipped.`);
  });
  document.querySelector<HTMLFormElement>('#workoutForm')!.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const id = String(values.get('id') || crypto.randomUUID());
    const existing = workouts.find((w) => w.id === id);
    const startedAt = localWallTimeToUtc(`${values.get('date')}T${values.get('time')}`, timezone);
    const workout: Workout = {
      id, startedAt, timezone, title: String(values.get('title')), type: String(values.get('type')) as WorkoutType,
      durationMinutes: Number(values.get('duration')), load: values.get('load') ? Number(values.get('load')) : undefined,
      distanceKm: existing?.distanceKm, notes: String(values.get('notes') ?? ''), source: existing?.source ?? 'Manual',
      sourceId: existing?.sourceId, sourceUrl: existing?.sourceUrl, importedAt: existing?.importedAt ?? new Date().toISOString(), fingerprint: ''
    };
    workout.fingerprint = makeFingerprint(workout);
    await saveWorkouts([workout]); workouts = await getWorkouts(); closeDialog('workoutDialog'); weekStart = startOfWeek(new Date(workout.startedAt), timezone); renderLedger(); showToast(existing ? 'Session updated.' : 'Strength session added.');
  });
  document.querySelector('#deleteWorkout')!.addEventListener('click', async () => {
    const id = (document.querySelector<HTMLFormElement>('#workoutForm')!.elements.namedItem('id') as HTMLInputElement).value;
    const workout = workouts.find((w) => w.id === id);
    if (!workout || !confirm(`Delete “${workout.title}”? You can undo this for a few seconds.`)) return;
    await deleteWorkout(id); deletedForUndo = workout; workouts = await getWorkouts(); closeDialog('workoutDialog'); renderLedger();
    window.clearTimeout(undoTimer); showToast('Session deleted.', 'Undo');
    document.querySelector('#toastAction')?.addEventListener('click', async () => { if (!deletedForUndo) return; await saveWorkouts([deletedForUndo]); deletedForUndo = null; workouts = await getWorkouts(); renderLedger(); showToast('Session restored.'); });
    undoTimer = window.setTimeout(() => { deletedForUndo = null; }, 8000);
  });
  document.querySelector<HTMLFormElement>('#settingsForm')!.addEventListener('submit', (event) => {
    event.preventDefault(); const form = event.currentTarget as HTMLFormElement; const value = String(new FormData(form).get('timezone')).trim();
    try { new Intl.DateTimeFormat('en', { timeZone: value }).format(); }
    catch { (form.elements.namedItem('timezone') as HTMLInputElement).setCustomValidity('Enter a valid IANA time zone.'); form.reportValidity(); return; }
    timezone = value; localStorage.setItem('tlm:timezone', timezone); weekStart = startOfWeek(new Date(), timezone); closeDialog('settingsDialog');
    document.querySelector('#zoneLabel')!.textContent = timezone; renderLedger(); showToast(`Week boundaries now use ${timezone}. Reload to update the import explanation.`);
  });
  document.querySelector<HTMLInputElement>('#settingsForm input')!.addEventListener('input', (event) => (event.target as HTMLInputElement).setCustomValidity(''));
  document.querySelector<HTMLFormElement>('#licenseForm')!.addEventListener('submit', async (event) => {
    event.preventDefault(); const token = String(new FormData(event.currentTarget as HTMLFormElement).get('license') ?? '').trim();
    if (!token) { renderLicenseState('Paste your license token first.'); return; }
    storeLicense(token); renderLicenseState('Verifying license…'); const result = await verifyLicense(true); unlocked = result.valid;
    renderLicenseState(result.valid ? 'License verified. Your field kit is ready.' : result.reason === 'offline' ? 'Could not reach verification. Your free ledger remains available.' : 'That license could not be verified. Check the token and try again.');
  });
  document.querySelector<HTMLInputElement>('#restoreJson')!.addEventListener('change', async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0]; if (!file || !unlocked) return;
    try {
      const parsed = JSON.parse(await file.text()) as { workouts?: Workout[]; timezone?: string };
      if (!Array.isArray(parsed.workouts) || !parsed.workouts.every((w) => w.id && w.startedAt && w.fingerprint)) throw new Error('This is not a Training Log Merge backup.');
      if (!confirm(`Replace this device’s ${workouts.length} sessions with ${parsed.workouts.length} sessions from the backup?`)) return;
      await replaceAllWorkouts(parsed.workouts); workouts = await getWorkouts(); if (parsed.timezone) { timezone = parsed.timezone; localStorage.setItem('tlm:timezone', timezone); }
      closeDialog('unlockDialog'); renderLedger(); showToast(`Restored ${workouts.length} sessions.`);
    } catch (error) { renderLicenseState(error instanceof Error ? error.message : 'Could not restore that file.'); }
  });
  window.addEventListener('online', updateNetworkStatus); window.addEventListener('offline', updateNetworkStatus);
}

function updateNetworkStatus(): void {
  const node = document.querySelector('#networkStatus'); if (!node) return;
  node.classList.toggle('offline', !navigator.onLine); node.lastChild!.textContent = navigator.onLine ? 'Local only' : 'Offline · ready';
}

function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').then((registration) => {
    let updateAccepted = false;
    const showUpdate = () => { document.querySelector<HTMLElement>('#updateToast')!.hidden = false; };
    if (registration.waiting) showUpdate();
    registration.addEventListener('updatefound', () => registration.installing?.addEventListener('statechange', () => { if (registration.waiting && navigator.serviceWorker.controller) showUpdate(); }));
    document.querySelector('#updateButton')!.addEventListener('click', () => { updateAccepted = true; registration.waiting?.postMessage({ type: 'SKIP_WAITING' }); });
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (updateAccepted) location.reload(); });
  }).catch(() => { /* The free app still works if service workers are unavailable. */ });
}

init();
