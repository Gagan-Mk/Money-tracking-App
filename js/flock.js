import { requireSession, getData, logout, batches as batchesApi, mortality as mortalityApi } from './api.js?v=4';
import { fmtDay, esc } from './format.js?v=4';
import { activeBatch, deathsFor, todayStr } from './farm.js?v=4';
import { openForm } from './modal.js?v=4';

let DATA = null;
let viewedId = null;

const topEl = document.getElementById('flock-top');
const listEl = document.getElementById('mortality-list');

function render() {
  const batches = DATA.batches || [];
  if (batches.length && (!viewedId || !batches.find((b) => b.id === viewedId))) {
    viewedId = (activeBatch(batches) || batches[0]).id;
  }
  renderTop();
  renderLog();
}

function renderTop() {
  const batches = DATA.batches || [];
  if (batches.length === 0) {
    topEl.innerHTML = `<div class="rv-card rv-card-pad">
      <p class="rv-muted mb-3">No batches yet — create your first batch of hens.</p>
      <button class="btn rv-btn-primary rv-btn-sm" id="new-batch" type="button">+ New batch</button>
    </div>`;
    topEl.querySelector('#new-batch').onclick = () => openBatchForm(null);
    return;
  }

  const batch = batches.find((b) => b.id === viewedId);
  const deaths = deathsFor(batch.id, DATA.mortality);
  const count = batch.bird_count;
  const alive = count != null ? Math.max(0, count - deaths) : null;
  const rate = count ? Math.round((deaths / count) * 1000) / 10 : null;

  const selector =
    batches.length > 1
      ? `<select class="form-select rv-batch-select" id="batch-select" aria-label="Choose batch">
          ${batches
            .map(
              (b) =>
                `<option value="${esc(b.id)}" ${b.id === viewedId ? 'selected' : ''}>${esc(b.name)}${b.is_active ? ' · active' : ''}</option>`
            )
            .join('')}
        </select>`
      : '';

  topEl.innerHTML = `<div class="rv-card rv-card-pad">
    <div class="rv-section-head mb-3">
      <div class="d-flex align-items-center gap-2 flex-wrap">
        <h2 class="rv-card-title mb-0">${esc(batch.name)}</h2>
        ${batch.is_active ? '<span class="rv-pill rv-pill-settled">Active</span>' : ''}
      </div>
      ${selector}
    </div>
    <div class="rv-stat-grid">
      <div class="rv-stat"><span class="rv-stat-num rv-stat-bad">${deaths}</span><span class="rv-stat-label">died</span></div>
      ${alive != null ? `<div class="rv-stat"><span class="rv-stat-num">${alive}</span><span class="rv-stat-label">alive</span></div>` : ''}
      ${count != null ? `<div class="rv-stat"><span class="rv-stat-num">${count}</span><span class="rv-stat-label">started</span></div>` : ''}
      ${rate != null ? `<div class="rv-stat"><span class="rv-stat-num">${rate}%</span><span class="rv-stat-label">mortality</span></div>` : ''}
    </div>
    <p class="rv-muted rv-mt-note mb-3">${batch.started_on ? 'Started ' + esc(fmtDay(batch.started_on)) : 'No start date set'}</p>
    <div class="rv-row-actions">
      <button class="rv-chip" id="new-batch" type="button">+ New batch</button>
      <button class="rv-chip" id="edit-batch" type="button">Edit</button>
      ${!batch.is_active ? '<button class="rv-chip" id="activate-batch" type="button">Set active</button>' : ''}
      <button class="rv-chip rv-chip-danger" id="delete-batch" type="button">Delete</button>
    </div>
  </div>`;

  topEl.querySelector('#batch-select')?.addEventListener('change', (e) => {
    viewedId = e.target.value;
    render();
  });
  topEl.querySelector('#new-batch').onclick = () => openBatchForm(null);
  topEl.querySelector('#edit-batch').onclick = () => openBatchForm(batch);
  topEl.querySelector('#activate-batch')?.addEventListener('click', async () => {
    await batchesApi.update({ id: batch.id, is_active: true });
    await reload();
  });
  topEl.querySelector('#delete-batch').onclick = async () => {
    if (!confirm(`Delete batch "${batch.name}" and all its mortality records?`)) return;
    await batchesApi.remove(batch.id);
    viewedId = null;
    await reload();
  };
}

function renderLog() {
  const batches = DATA.batches || [];
  if (batches.length === 0) {
    listEl.innerHTML = '';
    return;
  }
  const rows = (DATA.mortality || [])
    .filter((m) => m.batch_id === viewedId)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  if (rows.length === 0) {
    listEl.innerHTML = `<div class="rv-card rv-card-pad rv-muted">No deaths logged for this batch.</div>`;
    return;
  }

  listEl.innerHTML =
    `<ul class="rv-card rv-list">` +
    rows
      .map(
        (m) => `
      <li class="rv-row-block">
        <div class="rv-row-line">
          <p class="rv-row-title mb-0">${m.count} ${Number(m.count) === 1 ? 'hen' : 'hens'} died</p>
          <span class="rv-num">${esc(fmtDay(m.event_date))}</span>
        </div>
        ${m.reason ? `<p class="rv-row-sub mb-0 mt-1"><span class="rv-tag rv-tag-bad">Mistake</span> ${esc(m.reason)}</p>` : ''}
        ${m.prevention ? `<p class="rv-row-sub mb-0 mt-1"><span class="rv-tag rv-tag-good">Avoid</span> ${esc(m.prevention)}</p>` : ''}
        ${m.note ? `<p class="rv-row-sub mb-0 mt-1">${esc(m.note)}</p>` : ''}
        <div class="rv-row-actions">
          <button class="rv-chip" data-edit="${esc(m.id)}" type="button">Edit</button>
          <button class="rv-chip rv-chip-danger" data-del="${esc(m.id)}" type="button">Delete</button>
        </div>
      </li>`
      )
      .join('') +
    `</ul>`;

  listEl.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => openDeathForm(rows.find((m) => m.id === b.dataset.edit));
  });
  listEl.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Delete this mortality record?')) return;
      await mortalityApi.remove(b.dataset.del);
      await reload();
    };
  });
}

function openBatchForm(batch) {
  openForm({
    title: batch ? 'Edit batch' : 'New batch',
    submitLabel: batch ? 'Save batch' : 'Create batch',
    fields: [
      { name: 'name', label: 'Batch name', value: batch?.name || '', required: true, placeholder: 'e.g. Second batch' },
      { name: 'started_on', label: 'Start date', type: 'date', value: batch?.started_on || todayStr() },
      { name: 'bird_count', label: 'Number of birds', type: 'number', min: 0, value: batch?.bird_count ?? '', placeholder: 'e.g. 50' },
    ],
    onSubmit: async (v) => {
      if (!v.name.trim()) throw new Error('Name is required.');
      if (batch) {
        await batchesApi.update({ id: batch.id, name: v.name, started_on: v.started_on, bird_count: v.bird_count });
      } else {
        const r = await batchesApi.create({ name: v.name, started_on: v.started_on, bird_count: v.bird_count });
        viewedId = (r.batch || r.row)?.id || null;
      }
      await reload();
    },
  });
}

function openDeathForm(m) {
  if (!viewedId) {
    alert('Create a batch first.');
    return;
  }
  openForm({
    title: m ? 'Edit mortality' : 'Log death',
    submitLabel: m ? 'Save' : 'Log death',
    fields: [
      { name: 'event_date', label: 'Date', type: 'date', value: m?.event_date || todayStr(), required: true },
      { name: 'count', label: 'How many died', type: 'number', min: 1, value: m?.count ?? '', required: true, placeholder: 'e.g. 2' },
      { name: 'reason', label: 'What mistake happened?', type: 'textarea', value: m?.reason || '', placeholder: 'e.g. heat lamp failed overnight' },
      { name: 'prevention', label: 'Next time, what to avoid', type: 'textarea', value: m?.prevention || '', placeholder: 'e.g. add a backup lamp + temperature alarm' },
      { name: 'note', label: 'Note (optional)', value: m?.note || '' },
    ],
    onSubmit: async (v) => {
      if (!v.count || Number(v.count) <= 0) throw new Error('Enter how many died.');
      const payload = {
        batch_id: viewedId,
        event_date: v.event_date,
        count: v.count,
        reason: v.reason,
        prevention: v.prevention,
        note: v.note,
      };
      if (m) await mortalityApi.update({ id: m.id, ...payload });
      else await mortalityApi.create(payload);
      await reload();
    },
  });
}

async function reload() {
  DATA = await getData(true);
  render();
}

(async function main() {
  await requireSession();
  document.getElementById('logout-btn')?.addEventListener('click', logout);
  document.getElementById('add-death')?.addEventListener('click', () => openDeathForm(null));
  try {
    DATA = await getData();
    render();
  } catch (err) {
    topEl.innerHTML = `<div class="rv-card rv-card-pad rv-error-text">${esc(err.message)}</div>`;
  }
})();
