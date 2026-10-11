import { requireSession, getData, logout, reminders as remindersApi } from './api.js?v=4';
import { fmtDay, esc } from './format.js?v=4';
import { dueLabel, daysUntil, kindLabel, todayStr, REMINDER_KINDS } from './farm.js?v=4';
import { openForm } from './modal.js?v=4';

let DATA = null;
const todoEl = document.getElementById('todo-list');
const doneEl = document.getElementById('done-list');

function render() {
  const all = DATA.reminders || [];
  const todo = all.filter((r) => !r.done).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const done = all.filter((r) => r.done).sort((a, b) => b.due_date.localeCompare(a.due_date));

  todoEl.innerHTML = todo.length ? listHTML(todo) : emptyHTML('Nothing to do — add a reminder.');
  doneEl.innerHTML = done.length ? listHTML(done) : emptyHTML('Nothing done yet.');
  wire();
}

function listHTML(rows) {
  return `<ul class="rv-card rv-list">` + rows.map(rowHTML).join('') + `</ul>`;
}
function emptyHTML(msg) {
  return `<div class="rv-card rv-card-pad rv-muted">${esc(msg)}</div>`;
}

function rowHTML(r) {
  const overdue = !r.done && daysUntil(r.due_date) < 0;
  return `<li class="rv-row-block">
    <div class="rv-reminder-row">
      <input type="checkbox" class="form-check-input rv-done-check" data-done="${esc(r.id)}" ${r.done ? 'checked' : ''} aria-label="Mark done" />
      <div class="rv-reminder-main">
        <div class="rv-row-line">
          <p class="rv-row-title mb-0 ${r.done ? 'rv-strike' : ''}">${esc(r.title)}</p>
          <span class="rv-kind rv-kind-${esc(r.kind || 'reminder')}">${esc(kindLabel(r.kind))}</span>
        </div>
        <p class="rv-row-sub mb-0">${esc(fmtDay(r.due_date))} · <span class="${overdue ? 'rv-overdue' : ''}">${esc(dueLabel(r.due_date))}</span></p>
        ${r.note ? `<p class="rv-row-sub mb-0 mt-1">${esc(r.note)}</p>` : ''}
        <div class="rv-row-actions">
          <button class="rv-chip" data-edit="${esc(r.id)}" type="button">Edit</button>
          <button class="rv-chip rv-chip-danger" data-del="${esc(r.id)}" type="button">Delete</button>
        </div>
      </div>
    </div>
  </li>`;
}

function wire() {
  document.querySelectorAll('[data-done]').forEach((cb) => {
    cb.onchange = async () => {
      cb.disabled = true;
      try {
        await remindersApi.update({ id: cb.dataset.done, done: cb.checked });
        await reload();
      } catch (e) {
        cb.disabled = false;
        cb.checked = !cb.checked;
        alert(e.message || 'Could not update.');
      }
    };
  });
  document.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => openReminderForm((DATA.reminders || []).find((r) => r.id === b.dataset.edit));
  });
  document.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Delete this reminder?')) return;
      await remindersApi.remove(b.dataset.del);
      await reload();
    };
  });
}

function openReminderForm(r) {
  openForm({
    title: r ? 'Edit reminder' : 'New reminder',
    submitLabel: r ? 'Save' : 'Add',
    fields: [
      { name: 'title', label: 'What needs to be done', value: r?.title || '', required: true, placeholder: 'e.g. Newcastle (ND) vaccine' },
      { name: 'due_date', label: 'Date', type: 'date', value: r?.due_date || todayStr(), required: true },
      { name: 'kind', label: 'Type', type: 'select', value: r?.kind || 'reminder', options: REMINDER_KINDS },
      { name: 'note', label: 'Note (optional)', type: 'textarea', value: r?.note || '', placeholder: 'any details' },
    ],
    onSubmit: async (v) => {
      if (!v.title.trim()) throw new Error('Title is required.');
      if (!v.due_date) throw new Error('Date is required.');
      const payload = { title: v.title, due_date: v.due_date, kind: v.kind, note: v.note };
      if (r) await remindersApi.update({ id: r.id, ...payload });
      else await remindersApi.create(payload);
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
  document.getElementById('add-reminder')?.addEventListener('click', () => openReminderForm(null));
  try {
    DATA = await getData();
    render();
  } catch (err) {
    todoEl.innerHTML = `<div class="rv-card rv-card-pad rv-error-text">${esc(err.message)}</div>`;
  }
})();
