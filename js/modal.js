// A small reusable Bootstrap form modal. Describe fields declaratively and
// get the collected values on submit. Used by the Flock and Reminders pages.
import { esc } from './format.js?v=4';

let el = null;
let bs = null;

function ensure() {
  if (el) return;
  const wrap = document.createElement('div');
  wrap.innerHTML = `
  <div class="modal fade" id="rvFormModal" tabindex="-1" aria-hidden="true" aria-labelledby="rvFormTitle">
    <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
      <div class="modal-content rv-modal">
        <div class="modal-header">
          <h2 class="modal-title h5" id="rvFormTitle"></h2>
          <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <form id="rvForm" novalidate>
            <div id="rvFormFields"></div>
            <div id="rvFormError" class="rv-error mb-3" hidden></div>
            <button type="submit" id="rvFormSubmit" class="btn rv-btn-primary w-100">Save</button>
          </form>
        </div>
      </div>
    </div>
  </div>`.trim();
  el = wrap.firstElementChild;
  document.body.appendChild(el);
  bs = new window.bootstrap.Modal(el);
}

function fieldHTML(f) {
  const id = 'ff-' + f.name;
  const label = `<label class="rv-label" for="${id}">${esc(f.label)}</label>`;

  if (f.type === 'select') {
    const opts = (f.options || [])
      .map(
        (o) =>
          `<option value="${esc(o.value)}" ${String(o.value) === String(f.value ?? '') ? 'selected' : ''}>${esc(o.label)}</option>`
      )
      .join('');
    return `<div class="mb-3">${label}<select class="form-select" id="${id}" name="${f.name}">${opts}</select></div>`;
  }
  if (f.type === 'textarea') {
    return `<div class="mb-3">${label}<textarea class="form-control" id="${id}" name="${f.name}" rows="2" placeholder="${esc(f.placeholder || '')}">${esc(f.value ?? '')}</textarea></div>`;
  }
  if (f.type === 'checkbox') {
    return `<div class="form-check mb-3"><input class="form-check-input" type="checkbox" id="${id}" name="${f.name}" ${f.value ? 'checked' : ''}><label class="form-check-label rv-check-label" for="${id}">${esc(f.label)}</label></div>`;
  }

  const extra = [
    f.required ? 'required' : '',
    f.min != null ? `min="${esc(f.min)}"` : '',
    f.step != null ? `step="${esc(f.step)}"` : '',
    f.type === 'number' ? 'inputmode="decimal"' : '',
  ].join(' ');
  return `<div class="mb-3">${label}<input class="form-control" type="${f.type || 'text'}" id="${id}" name="${f.name}" value="${esc(f.value ?? '')}" placeholder="${esc(f.placeholder || '')}" ${extra}></div>`;
}

// openForm({ title, fields, submitLabel?, onSubmit }) → shows the modal.
// onSubmit(values) may be async; throw an Error to show its message inline.
export function openForm({ title, fields, submitLabel = 'Save', onSubmit }) {
  ensure();
  el.querySelector('#rvFormTitle').textContent = title;
  const submit = el.querySelector('#rvFormSubmit');
  submit.textContent = submitLabel;

  const err = el.querySelector('#rvFormError');
  err.hidden = true;
  err.textContent = '';

  const box = el.querySelector('#rvFormFields');
  box.innerHTML = fields.map(fieldHTML).join('');

  const form = el.querySelector('#rvForm');
  form.onsubmit = async (ev) => {
    ev.preventDefault();
    err.hidden = true;
    const values = {};
    for (const f of fields) {
      const inp = box.querySelector(`[name="${f.name}"]`);
      values[f.name] = f.type === 'checkbox' ? inp.checked : inp.value;
    }
    submit.disabled = true;
    const orig = submit.textContent;
    submit.textContent = 'Saving…';
    try {
      await onSubmit(values);
      bs.hide();
    } catch (e) {
      err.hidden = false;
      err.textContent = e.message || 'Could not save.';
    } finally {
      submit.disabled = false;
      submit.textContent = orig;
    }
  };

  bs.show();
}
