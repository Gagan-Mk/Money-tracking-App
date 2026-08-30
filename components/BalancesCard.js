function formatINR(n) {
  const abs = Math.abs(n);
  return abs.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export default function BalancesCard({ balances }) {
  const owed = balances.filter((b) => b.net > 0.5);
  const settled = balances.filter((b) => Math.abs(b.net) <= 0.5);

  return (
    <div className="rounded-2xl border border-bark bg-canopy p-5">
      <p className="font-mono text-xs uppercase tracking-[0.15em] text-husk">RV owes</p>

      {balances.every((b) => Math.abs(b.net) <= 0.5) ? (
        <p className="mt-3 text-sm text-husk">
          Everyone&apos;s square — no deferred dues right now.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {balances
            .slice()
            .sort((a, b) => b.net - a.net)
            .map((b) => (
              <li key={b.id} className="flex items-baseline justify-between">
                <span className="font-body text-base text-parchment">{b.name}</span>
                <span
                  className={`ledger-num font-mono text-lg ${
                    b.net > 0.5
                      ? 'text-harvest'
                      : b.net < -0.5
                      ? 'text-rust'
                      : 'text-husk'
                  }`}
                >
                  {b.net > 0.5 && `₹${formatINR(b.net)}`}
                  {b.net < -0.5 && `owes RV ₹${formatINR(b.net)}`}
                  {Math.abs(b.net) <= 0.5 && '—'}
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
