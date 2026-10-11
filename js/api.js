// Central data layer. One /api/data fetch feeds every page; the result is
// cached in memory and sessionStorage so tab switches need no network.
// Append ?mock=1 to any page to render from js/mock-data.json with no backend
// (used for local preview / responsive checks without the live database).

const MOCK = new URLSearchParams(location.search).has('mock');
const CACHE_KEY = 'rv_data_v2';
let _cache = null;

function mockParam() {
  return MOCK ? '?mock=1' : '';
}

export async function requireSession() {
  if (MOCK) return { name: 'Demo', isAdmin: true };
  try {
    const res = await fetch('/api/session', { credentials: 'same-origin' });
    if (!res.ok) return redirectToLogin();
    return res.json();
  } catch {
    return redirectToLogin();
  }
}

export async function getData(force = false) {
  if (_cache && !force) return _cache;

  if (!force && !MOCK) {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) {
      try {
        _cache = JSON.parse(stored);
        return _cache;
      } catch {
        /* fall through to network */
      }
    }
  }

  if (MOCK) {
    // Load the fixture once; keep local mock mutations across force-refreshes
    // (in real mode `force` re-fetches the updated row from /api/data).
    if (!_cache) _cache = await (await fetch('js/mock-data.json')).json();
    return _cache;
  }

  const res = await fetch('/api/data', { credentials: 'same-origin' });
  if (res.status === 401) {
    redirectToLogin();
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || 'Could not load data.');
  }
  _cache = await res.json();
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(_cache));
  } catch {
    /* storage may be unavailable (private mode) — memory cache still works */
  }
  return _cache;
}

export function invalidate() {
  _cache = null;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

export function peopleMap(data) {
  return new Map((data.people || []).map((p) => [p.id, p]));
}

export async function createExpense(payload) {
  if (MOCK) return mockCreate(payload);
  return mutate('POST', payload);
}
export async function updateExpense(payload) {
  if (MOCK) return mockUpdate(payload);
  return mutate('PATCH', payload);
}
export async function deleteExpense(id) {
  if (MOCK) return mockDelete(id);
  return mutate('DELETE', { id });
}

// Generic CRUD for the flock tables (batches / mortality / reminders).
export const batches = crud('/api/batches', 'batches');
export const mortality = crud('/api/mortality', 'mortality');
export const reminders = crud('/api/reminders', 'reminders');

function crud(url, key) {
  return {
    create: (body) => (MOCK ? mockWrite(key, 'POST', body) : mutateAt(url, 'POST', body)),
    update: (body) => (MOCK ? mockWrite(key, 'PATCH', body) : mutateAt(url, 'PATCH', body)),
    remove: (id) => (MOCK ? mockWrite(key, 'DELETE', { id }) : mutateAt(url, 'DELETE', { id })),
  };
}

async function mutateAt(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  invalidate();
  return data;
}

export async function logout() {
  if (!MOCK) {
    try {
      await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
    } catch {
      /* ignore */
    }
  }
  invalidate();
  location.href = 'login.html' + mockParam();
}

async function mutate(method, body) {
  const res = await fetch('/api/expenses', {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed.');
  invalidate();
  return data;
}

function redirectToLogin() {
  location.href = 'login.html' + mockParam();
  return null;
}

// ---- Mock-mode simulation (local preview only) ----
function uid() {
  return 'mock-' + Math.random().toString(36).slice(2, 10);
}
function mockCreate(payload) {
  const id = uid();
  _cache.expenses.unshift({
    id,
    name: payload.name.trim(),
    amount: Number(payload.amount),
    paid_by: payload.paid_by,
    settled: !!payload.settled,
    expense_date: payload.expense_date,
    note: payload.note ? payload.note.trim() : null,
    created_at: new Date().toISOString(),
  });
  if (payload.settled && Array.isArray(payload.repayments)) {
    for (const r of payload.repayments) {
      if (!r.repaid_by || !r.amount) continue;
      _cache.repayments.unshift({
        id: uid(),
        expense_id: id,
        amount: Number(r.amount),
        repayment_date: r.repayment_date,
        repaid_by: r.repaid_by,
        funded_by: r.funded_by || null,
        note: null,
      });
    }
  }
  return Promise.resolve({ expense: { id } });
}
function mockUpdate(payload) {
  const e = _cache.expenses.find((x) => x.id === payload.id);
  if (e) {
    Object.assign(e, {
      name: payload.name.trim(),
      amount: Number(payload.amount),
      paid_by: payload.paid_by,
      settled: !!payload.settled,
      expense_date: payload.expense_date,
      note: payload.note ? payload.note.trim() : null,
    });
  }
  return Promise.resolve({ expense: e });
}
function mockDelete(id) {
  _cache.expenses = _cache.expenses.filter((x) => x.id !== id);
  _cache.repayments = _cache.repayments.filter((r) => r.expense_id !== id);
  return Promise.resolve({ ok: true });
}
function mockNormalize(body) {
  const b = { ...body };
  if (b.count != null && b.count !== '') b.count = Number(b.count);
  if (b.bird_count === '') b.bird_count = null;
  else if (b.bird_count != null) b.bird_count = Number(b.bird_count);
  if (b.done != null) b.done = !!b.done;
  return b;
}
function mockWrite(key, method, body) {
  const arr = (_cache[key] = _cache[key] || []);
  if (method === 'POST') {
    const row = { id: uid(), created_at: new Date().toISOString(), ...mockNormalize(body) };
    if (key === 'batches' && row.is_active !== false) {
      arr.forEach((b) => (b.is_active = false));
      row.is_active = true;
    }
    arr.unshift(row);
    return Promise.resolve({ row });
  }
  if (method === 'PATCH') {
    const row = arr.find((x) => x.id === body.id);
    if (row) {
      if (key === 'batches' && body.is_active === true) {
        arr.forEach((b) => {
          if (b.id !== body.id) b.is_active = false;
        });
      }
      Object.assign(row, mockNormalize(body));
    }
    return Promise.resolve({ row });
  }
  _cache[key] = arr.filter((x) => x.id !== body.id);
  if (key === 'batches') _cache.mortality = (_cache.mortality || []).filter((m) => m.batch_id !== body.id);
  return Promise.resolve({ ok: true });
}
