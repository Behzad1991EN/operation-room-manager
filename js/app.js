import { CONFIG, SHIFTS } from './config.js';
import { initialState, validateStoredState, context, currentRecord, fingerprint } from './state.js';
import { loadState, saveState } from './services/storage.js';
import { monthKey, monthLabel, previousMonth } from './services/calendar.js';
import { normalizeEmployees } from './models/employee.js';
import { importEmployees } from './import/employees.js';
import { validateSchedule } from './scheduler/validator.js';
import { scheduleCSV, printableHTML, download, escapeHTML as esc } from './export/schedule.js';
import { demoEmployees } from '../data/demo.js';
import * as views from './ui/views.js';

let state = initialState(), worker = null, timer = null, startedAt = 0, toastTimer = null, importPreview = [];
let storageEnabled = true;
const runtime = { status: 'READY', message: '', elapsedMs: 0, diagnostics: [], employeeId: null, scheduleView: matchMedia('(min-width: 768px)').matches ? 'matrix' : 'employee', storageError: '' };
const app = document.querySelector('#app'), modal = document.querySelector('#modal');
const pageNames = ['dashboard', 'employees', 'calendar', 'generate', 'schedule', 'reports', 'rules'];
const route = () => pageNames.includes(location.hash.slice(2)) ? location.hash.slice(2) : 'dashboard';
function notify(message) {
  document.querySelector('#notification').textContent = message;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { document.querySelector('#notification').textContent = ''; }, 7000);
}
function render(focus = false) {
  const page = route();
  document.title = `${page === 'dashboard' ? 'Dashboard' : page[0].toUpperCase() + page.slice(1)} | Operation Room Manager`;
  app.innerHTML = views.shell(state, page, (runtime.storageError ? `<div class="notice error" role="alert">${esc(runtime.storageError)}</div>` : '') + views[page](state, runtime));
  if (focus) document.querySelector('#main').focus({ preventScroll: true });
}
async function persist() {
  if (!storageEnabled) return;
  const indicator = () => document.querySelector('#save-indicator');
  if (indicator()) indicator().textContent = 'Saving…';
  try { await saveState(state); if (indicator()) indicator().textContent = 'Saved on this device'; }
  catch (error) { runtime.storageError = `Changes could not be saved: ${error.message}. Download a workspace backup now.`; render(); }
}
function stopWorker(cancelled = false) {
  worker?.terminate(); worker = null; clearInterval(timer); timer = null;
  if (cancelled) { runtime.status = 'CANCELLED'; runtime.message = 'Generation cancelled. Any previous validated schedule is retained.'; runtime.elapsedMs = performance.now() - startedAt; }
}
async function update(change, message) {
  const wasRunning = !!worker;
  if (wasRunning) stopWorker(true);
  change(); runtime.status = 'READY'; runtime.message = ''; runtime.diagnostics = []; runtime.elapsedMs = 0;
  render(); await persist();
  if (message) notify(message + (wasRunning ? ' Active generation was cancelled because its inputs changed.' : ''));
}
function openModal(title, body) {
  modal.innerHTML = `<div class="modal-head"><h2 id="modal-title">${title}</h2><button class="icon-button" data-action="close-modal" aria-label="Close dialog">×</button></div>${body}`;
  modal.showModal();
}
function formError(error) { const field = modal.querySelector('.form-error'); if (field) field.textContent = error.message; else notify(error.message); }
function employeeForm(employee = {}) {
  openModal(employee.id ? 'Edit employee' : 'Add employee', `<form id="employee-form"><input type="hidden" name="id" value="${esc(employee.id ?? '')}"><div class="form-grid"><label>Full name<input name="name" required maxlength="100" autocomplete="name" value="${esc(employee.name ?? '')}"></label><div class="form-grid two"><label>Years of service<input name="yearsOfService" type="number" step="0.1" min="0" max="80" required value="${employee.yearsOfService ?? ''}"></label><label>Productivity category<select name="productivityCategory"><option value="">Select category</option>${Object.keys(CONFIG.deductions).map(c => `<option ${employee.productivityCategory === c ? 'selected' : ''}>${c}</option>`).join('')}</select><span class="field-note">Use the employee-provided category. Not applied with radiation benefit.</span></label></div><label class="check-label"><input name="radiationBenefit" type="checkbox" ${employee.radiationBenefit ? 'checked' : ''}>Receives radiation benefit</label></div><div class="form-error" role="alert"></div><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary" type="submit">Save employee</button></div></form>`);
}
async function startGeneration() {
  const original = structuredClone(context(state));
  const key = monthKey(state.year, state.month);
  if (!state.employees.length || !state.holidayReviews[key]) return notify('Add employees and review official holidays first.');
  if (state.boundaryMode === 'continuous') {
    for (const employee of state.employees.filter(e => !e.radiationBenefit)) {
      const history = original.boundary.history[employee.id];
      if (!Array.isArray(history) || history.length !== CONFIG.maxOffDays || history.some(r => !Array.isArray(r) || r.length > 1 || r.some(s => !SHIFTS.includes(s)))) return notify(`Enter previous-month assignments for ${employee.name} first.`);
    }
  }
  const extended = document.querySelector('#long-search')?.checked;
  const payload = structuredClone(original);
  if (extended) payload.config.search = { ...CONFIG.search, feasibilitySeconds: 80, optimizationSeconds: 40 };
  stopWorker(); startedAt = performance.now(); runtime.status = 'GENERATING'; runtime.message = 'Starting the scheduling worker…'; runtime.elapsedMs = 0; runtime.diagnostics = [];
  render();
  timer = setInterval(() => {
    runtime.elapsedMs = performance.now() - startedAt;
    const element = document.querySelector('#elapsed-time');
    if (element) element.textContent = `${(runtime.elapsedMs / 1000).toFixed(1)} s`;
  }, 250);
  try {
    worker = new Worker(new URL('./workers/scheduler.worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = async ({ data }) => {
      if (data.type === 'PROGRESS') { runtime.message = data.message; render(); return; }
      runtime.elapsedMs = performance.now() - startedAt;
      stopWorker();
      if (data.type === 'SUCCESS') {
        const validation = validateSchedule(original, data.schedule);
        if (!validation.valid) { runtime.status = 'INVALID'; runtime.message = 'The independent validator rejected the result. It was not saved.'; runtime.diagnostics = validation.errors; }
        else {
          state.schedules[key] = { schedule: data.schedule, input: original, fingerprint: fingerprint(original), statistics: data.statistics, validation };
          runtime.status = 'VALID'; runtime.message = 'All hard constraints passed independent validation. Your schedule is ready.';
          await persist();
        }
      } else {
        runtime.status = data.type === 'INFEASIBLE' ? 'INFEASIBLE' : 'ERROR';
        runtime.message = data.message ?? 'No schedule satisfies all the hard constraints for these inputs.';
        runtime.diagnostics = data.diagnostics ?? [];
      }
      render(); notify(runtime.status === 'VALID' ? 'Schedule generated and independently validated.' : runtime.message);
    };
    worker.onerror = event => { stopWorker(); runtime.status = 'ERROR'; runtime.message = `Worker error: ${event.message || 'The local solver could not load.'}`; render(); };
    worker.postMessage({ type: 'GENERATE_SCHEDULE', payload });
  } catch (error) { stopWorker(); runtime.status = 'ERROR'; runtime.message = error.message; render(); }
}
function historyForm() {
  const people = state.employees.filter(e => !e.radiationBenefit), key = monthKey(state.year, state.month);
  openModal('Previous month’s final three days', `<p class="muted" style="font-size:.8rem">Enter actual assignments in chronological order. These are used for night-to-morning and consecutive-OFF checks.</p><form id="history-form"><div class="history-grid">${people.map(e => `<div class="history-person"><strong>${esc(e.name)}</strong><div class="form-grid">${[0, 1, 2].map(d => `<label>${['Third-last day', 'Second-last day', 'Last day'][d]}<select name="${e.id}_${d}" required><option value="">Select</option>${['OFF', ...SHIFTS].map(s => `<option value="${s}" ${state.histories[key]?.[e.id]?.[d] && (state.histories[key][e.id][d][0] ?? 'OFF') === s ? 'selected' : ''}>${s}</option>`).join('')}</select></label>`).join('')}</div></div>`).join('')}</div><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">Cancel</button><button class="btn primary">Save history</button></div></form>`);
}
function verifyBackup(raw) {
  const next = validateStoredState(raw);
  for (const [key, record] of Object.entries(next.schedules)) {
    if (!record.input || !record.statistics?.score || !Number.isFinite(record.statistics.score.total) || !Number.isFinite(record.statistics.elapsedMs) || record.fingerprint !== fingerprint(record.input) || !validateSchedule(record.input, record.schedule).valid) throw new Error(`Backup contains an invalid schedule for ${key}.`);
  }
  return next;
}
document.addEventListener('click', async event => {
  const target = event.target.closest('[data-action]'); if (!target) return;
  const action = target.dataset.action, id = target.dataset.id;
  try {
    if (action === 'menu') { const open = document.querySelector('#sidebar').classList.toggle('open'); target.setAttribute('aria-expanded', open); }
    else if (action === 'close-modal') modal.close();
    else if (action === 'add' || action === 'edit') employeeForm(state.employees.find(e => e.id === id));
    else if (action === 'delete') {
      const employee = state.employees.find(e => e.id === id);
      openModal('Delete employee?', `<p>Remove <strong>${esc(employee.name)}</strong> from this workspace? Current schedules will need regeneration.</p><div class="modal-actions"><button class="btn" data-action="close-modal">Keep employee</button><button class="btn danger" data-action="confirm-delete" data-id="${id}">Delete employee</button></div>`);
    } else if (action === 'confirm-delete') { modal.close(); await update(() => { state.employees = state.employees.filter(e => e.id !== id); }, 'Employee deleted.'); }
    else if (action === 'demo') { if (!state.employees.length) await update(() => { state.employees = structuredClone(demoEmployees); state.demo = true; }, 'Fictional demo employees loaded. Review official holidays next.'); }
    else if (action === 'clear-demo') openModal('Clear demo workspace?', '<p>This removes the demo employees and saved demo schedules. Your selected calendar remains.</p><div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn danger" data-action="confirm-clear-demo">Clear demo</button></div>');
    else if (action === 'confirm-clear-demo') { modal.close(); await update(() => { state.employees = []; state.schedules = {}; state.histories = {}; state.demo = false; }, 'Demo workspace cleared.'); }
    else if (action === 'holiday') {
      const key = monthKey(state.year, state.month), date = target.dataset.date;
      await update(() => { const dates = new Set(state.holidays[key] ?? []); dates.has(date) ? dates.delete(date) : dates.add(date); state.holidays[key] = [...dates].sort(); state.holidayReviews[key] = false; });
      document.querySelector(`[data-date="${date}"]`)?.focus();
    } else if (action === 'generate') await startGeneration();
    else if (action === 'cancel') { stopWorker(true); render(); }
    else if (action === 'view-employee' || action === 'view-matrix' || action === 'employee-detail') { runtime.scheduleView = action === 'view-matrix' ? 'matrix' : 'employee'; if (id) runtime.employeeId = id; render(); }
    else if (action === 'import') document.querySelector('#employee-file').click();
    else if (action === 'apply-import') {
      const mode = modal.querySelector('[name=import-mode]:checked').value;
      const combined = mode === 'replace' ? importPreview : [...state.employees, ...importPreview];
      const validated = normalizeEmployees(combined);
      modal.close(); await update(() => { state.employees = validated; state.demo = mode === 'replace' ? false : state.demo; }, `${importPreview.length} employees imported.`); importPreview = [];
    } else if (action === 'template') download('name,yearsOfService,radiationBenefit,productivityCategory\r\nExample employee,5,false,4-8\r\n', 'employee-template.csv', 'text/csv;charset=utf-8');
    else if (action === 'backup') download(JSON.stringify(state, null, 2), `operation-room-manager-backup-${monthKey(state.year, state.month)}.json`, 'application/json');
    else if (action === 'restore') document.querySelector('#backup-file').click();
    else if (action === 'confirm-restore') { const next = runtime.restorePreview; modal.close(); await update(() => { state = next; runtime.restorePreview = null; }, 'Workspace restored from backup.'); }
    else if (action === 'export' || action === 'print') {
      const record = currentRecord(state); if (!record) return notify('Generate a current validated schedule first.');
      const input = context(state), key = monthKey(state.year, state.month);
      const valid = validateSchedule(input, record.schedule); if (!valid.valid) throw new Error('Export blocked: the schedule did not pass validation.');
      if (action === 'export') download(scheduleCSV(input, record.schedule), `schedule-${key}.csv`, 'text/csv;charset=utf-8');
      else download(printableHTML(input, record.schedule, monthLabel(state.year, state.month)), `schedule-${key}-print.html`, 'text/html;charset=utf-8');
    } else if (action === 'history') historyForm();
    else if (action === 'use-previous') {
      const previous = previousMonth(state.year, state.month), previousKey = monthKey(previous.year, previous.month), record = state.schedules[previousKey];
      if (!record || !validateSchedule(record.input, record.schedule).valid) return notify('No validated schedule for the previous month is available. Enter its final assignments manually.');
      const history = {};
      for (const e of state.employees.filter(e => !e.radiationBenefit)) {
        if (!record.schedule.assignments[e.id]) return notify(`The previous schedule has no assignments for ${e.name}. Enter history manually.`);
        history[e.id] = record.schedule.assignments[e.id].slice(-CONFIG.maxOffDays);
        if (history[e.id].some(r => r.length > 1)) return notify(`Previous assignments for ${e.name} include multiple shifts. Review the employee’s radiation status and enter history manually.`);
      }
      await update(() => { state.histories[monthKey(state.year, state.month)] = history; }, 'Previous-month assignments loaded.');
    }
  } catch (error) { if (modal.open) formError(error); else notify(error.message); }
});
document.addEventListener('submit', async event => {
  event.preventDefault(); const form = event.target, data = new FormData(form);
  try {
    if (form.getAttribute('id') === 'employee-form') {
      const raw = Object.fromEntries(data); raw.radiationBenefit = data.has('radiationBenefit');
      const employee = normalizeEmployees([raw])[0];
      modal.close(); await update(() => { const index = state.employees.findIndex(e => e.id === employee.id); if (index >= 0) state.employees[index] = employee; else state.employees.push(employee); }, 'Employee saved.');
    } else if (form.getAttribute('id') === 'calendar-form') {
      const year = Number(data.get('year')), month = Number(data.get('month'));
      // Resolve before mutating so invalid values never enter state.
      context({ ...state, year, month });
      await update(() => { state.year = year; state.month = month; }, 'Planning month updated.');
    } else if (form.getAttribute('id') === 'history-form') {
      const history = {};
      for (const e of state.employees.filter(e => !e.radiationBenefit)) history[e.id] = [0, 1, 2].map(i => { const s = data.get(`${e.id}_${i}`); if (s === 'OFF') return []; if (!SHIFTS.includes(s)) throw new Error('Select every previous assignment.'); return [s]; });
      modal.close(); await update(() => { state.histories[monthKey(state.year, state.month)] = history; }, 'Previous-month history saved.');
    }
  } catch (error) { if (modal.open) formError(error); else notify(error.message); }
});
document.addEventListener('change', async event => {
  const target = event.target;
  if (target.id === 'holiday-review') await update(() => { state.holidayReviews[monthKey(state.year, state.month)] = target.checked; }, target.checked ? 'Official holiday review saved.' : 'Holiday review reopened.');
  else if (target.id === 'boundary-mode') await update(() => { state.boundaryMode = target.value; }, 'Validation scope changed. Regenerate to apply it.');
  else if (target.id === 'schedule-employee') { runtime.employeeId = target.value; render(); document.querySelector('#schedule-employee')?.focus(); }
  else if (target.id === 'employee-file' || target.id === 'backup-file') {
    const file = target.files[0]; if (!file) return;
    try {
      if (file.size > (target.id === 'employee-file' ? 2 : 20) * 1024 * 1024) throw new Error('File exceeds the supported import size.');
      const text = await file.text();
      if (target.id === 'employee-file') {
        importPreview = importEmployees(text, file.name);
        if (!importPreview.length) throw new Error('The import contains no employees.');
        openModal('Review employee import', `<p>${importPreview.length} valid employees parsed from <strong>${esc(file.name)}</strong>. Nothing has been changed yet.</p><ol class="import-preview">${importPreview.map(e => `<li>${esc(e.name)} · ${e.yearsOfService} years · ${e.radiationBenefit ? 'Radiation benefit' : esc(e.productivityCategory)}</li>`).join('')}</ol><label class="check-label"><input type="radio" name="import-mode" value="append" checked>Add to current employees</label><label class="check-label" style="margin-top:12px"><input type="radio" name="import-mode" value="replace">Replace current employees (${state.employees.length})</label><div class="form-error" role="alert"></div><div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="apply-import">Apply import</button></div>`);
      } else {
        runtime.restorePreview = verifyBackup(JSON.parse(text));
        openModal('Restore this workspace?', `<p>This replaces current browser data with the backup: <strong>${runtime.restorePreview.employees.length} employees</strong> and <strong>${Object.keys(runtime.restorePreview.schedules).length} saved schedules</strong>.</p><p>Download a backup of your current workspace first if you need to keep it.</p><div class="modal-actions"><button class="btn" data-action="close-modal">Cancel</button><button class="btn primary" data-action="confirm-restore">Restore workspace</button></div>`);
      }
    } catch (error) { openModal('Import could not be completed', `<p class="form-error" role="alert">${esc(error.message)}</p><p>No records were imported.</p><button class="btn" data-action="close-modal">Close</button>`); }
    finally { target.value = ''; }
  }
});
document.addEventListener('input', event => {
  if (event.target.id === 'employee-search') document.querySelectorAll('.employee-card').forEach(card => { card.hidden = !card.dataset.name.includes(event.target.value.toLowerCase()); });
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') { document.querySelector('#sidebar')?.classList.remove('open'); document.querySelector('[data-action=menu]')?.setAttribute('aria-expanded', 'false'); } });
window.addEventListener('hashchange', () => { render(true); window.scrollTo(0, 0); });
try {
  const stored = await loadState();
  if (stored) state = verifyBackup(stored);
} catch (error) {
  storageEnabled = false;
  runtime.storageError = `Saved workspace could not be opened: ${error.message}. This session will not overwrite stored data. Use a backup to preserve new work.`;
}
render();
