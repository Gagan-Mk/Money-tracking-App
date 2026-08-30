'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export default function LedgerFilters({ people }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key, value) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`/ledger?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      <select
        value={searchParams.get('paid_by') || ''}
        onChange={(e) => setParam('paid_by', e.target.value)}
        className="rounded-lg border border-bark bg-canopy px-3 py-2 text-sm text-parchment"
      >
        <option value="">Anyone paid</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      <select
        value={searchParams.get('settled') || ''}
        onChange={(e) => setParam('settled', e.target.value)}
        className="rounded-lg border border-bark bg-canopy px-3 py-2 text-sm text-parchment"
      >
        <option value="">Settled + Deferred</option>
        <option value="false">Deferred only</option>
        <option value="true">Settled only</option>
      </select>

      <input
        type="month"
        value={searchParams.get('month') || ''}
        onChange={(e) => setParam('month', e.target.value)}
        className="rounded-lg border border-bark bg-canopy px-3 py-2 text-sm text-parchment"
      />
    </div>
  );
}
