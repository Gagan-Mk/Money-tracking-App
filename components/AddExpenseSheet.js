'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

function todayISO() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export default function AddExpenseSheet({ people }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState(people[0]?.id || '');
  const [settled, setSettled] = useState(false);
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState('');

  function resetForm() {
    setName('');
    setAmount('');
    setPaidBy(people[0]?.id || '');
    setSettled(false);
    setDate(todayISO());
    setNote('');
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          amount,
          paid_by: paidBy,
          settled,
          expense_date: date,
          note,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Could not save that expense. Try again.');
        setSubmitting(false);
        return;
      }
      resetForm();
      setOpen(false);
      setSubmitting(false);
      if (pathname === '/') {
        router.refresh();
      } else {
        router.push('/');
      }
    } catch {
      setError('Could not reach the server. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Add expense"
        className="fixed bottom-24 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-harvest text-2xl font-semibold text-soil shadow-lg shadow-black/40 transition active:scale-95"
      >
        +
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50">
          <div className="max-h-[88vh] w-full max-w-md overflow-y-auto rounded-t-3xl border-t border-bark bg-soil p-6 pb-10">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-xl font-semibold text-parchment">
                Add expense
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-husk"
                aria-label="Close"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-husk">
                  Expense name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-bark bg-canopy px-4 py-3 text-parchment outline-none focus:border-harvest"
                  placeholder="Packaging boxes"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-husk">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-lg border border-bark bg-canopy px-4 py-3 text-parchment outline-none focus:border-harvest"
                  placeholder="0"
                  required
                />
              </div>

              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-husk">
                  Paid by
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {people.map((p) => (
                    <button
                      type="button"
                      key={p.id}
                      onClick={() => setPaidBy(p.id)}
                      className={`rounded-lg border px-3 py-3 text-sm transition ${
                        paidBy === p.id
                          ? 'border-harvest bg-harvest/15 text-harvest'
                          : 'border-bark bg-canopy text-parchment'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-husk">
                  Date
                </label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-lg border border-bark bg-canopy px-4 py-3 text-parchment outline-none focus:border-harvest"
                  required
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-bark bg-canopy px-4 py-3">
                <div>
                  <p className="text-sm text-parchment">Settled between us?</p>
                  <p className="text-xs text-husk">
                    On = already squared up. Off = counts toward dues.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettled((s) => !s)}
                  className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                    settled ? 'bg-harvest' : 'bg-bark'
                  }`}
                  aria-pressed={settled}
                >
                  <span
                    className={`absolute top-1 h-5 w-5 rounded-full bg-parchment transition ${
                      settled ? 'left-6' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              <div>
                <label className="mb-1 block font-mono text-xs uppercase tracking-wide text-husk">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-lg border border-bark bg-canopy px-4 py-3 text-parchment outline-none focus:border-harvest"
                  placeholder="For the fuel run"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-rust/15 px-3 py-2 text-sm text-rust">{error}</p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-harvest py-3 font-medium text-soil transition active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? 'Saving…' : 'Save expense'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
