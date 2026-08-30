'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function ExpenseRowActions({ expense, people }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: expense.name,
    amount: String(expense.amount),
    paid_by: expense.paid_by,
    settled: !!expense.settled,
    expense_date: expense.expense_date,
    note: expense.note || '',
  });

  async function submitEdit() {
    setBusy(true);
    setError('');

    const res = await fetch('/api/expenses', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: expense.id, ...form, amount: Number(form.amount) }),
    });

    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error || 'Could not update this expense.');
      return;
    }

    setEditing(false);
    router.refresh();
  }

  async function handleDelete() {
    if (!window.confirm('Delete this expense?')) return;

    setBusy(true);
    setError('');

    const res = await fetch('/api/expenses', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: expense.id }),
    });

    const body = await res.json().catch(() => ({}));
    setBusy(false);

    if (!res.ok) {
      setError(body.error || 'Could not delete this expense.');
      return;
    }

    router.refresh();
  }

  return (
    <div className="mt-3 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          className="rounded-md border border-bark bg-canopy px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-parchment"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded-md border border-rust/50 bg-rust/10 px-2 py-1 text-[10px] font-mono uppercase tracking-wide text-rust disabled:opacity-60"
        >
          Delete
        </button>
      </div>

      {error && <p className="text-[10px] text-rust">{error}</p>}

      {editing && (
        <div className="mt-3 space-y-2 rounded-xl border border-bark bg-soil p-3">
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            className="w-full rounded-lg border border-bark bg-canopy px-2 py-2 text-sm text-parchment outline-none focus:border-harvest"
            placeholder="Expense name"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-full rounded-lg border border-bark bg-canopy px-2 py-2 text-sm text-parchment outline-none focus:border-harvest"
            />
            <input
              type="date"
              value={form.expense_date}
              onChange={(e) => setForm((f) => ({ ...f, expense_date: e.target.value }))}
              className="w-full rounded-lg border border-bark bg-canopy px-2 py-2 text-sm text-parchment outline-none focus:border-harvest"
            />
          </div>

          <select
            value={form.paid_by}
            onChange={(e) => setForm((f) => ({ ...f, paid_by: e.target.value }))}
            className="w-full rounded-lg border border-bark bg-canopy px-2 py-2 text-sm text-parchment outline-none focus:border-harvest"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="w-full rounded-lg border border-bark bg-canopy px-2 py-2 text-sm text-parchment outline-none focus:border-harvest"
            placeholder="Note"
          />

          <label className="flex items-center justify-between text-xs text-husk">
            <span>Settled</span>
            <input
              type="checkbox"
              checked={form.settled}
              onChange={(e) => setForm((f) => ({ ...f, settled: e.target.checked }))}
            />
          </label>

          <button
            type="button"
            onClick={submitEdit}
            disabled={busy}
            className="w-full rounded-lg bg-harvest px-3 py-2 text-sm font-medium text-soil disabled:opacity-60"
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      )}
    </div>
  );
}
