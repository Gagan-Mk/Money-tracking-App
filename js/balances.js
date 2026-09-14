// Client-side port of the server ledger math (was lib/balances.js).
//
// Model:
// - Every expense has a payer and a `settled` flag.
//     settled = true  -> already squared up in person, doesn't touch balances.
//     settled = false -> deferred, accumulates into the "RV owes X" balance.
// - The 3-way founder split lives only in the DB (split_versions + split_shares),
//   effective-dated. Each deferred expense uses whichever version was active on
//   its own expense_date, so changing the split later never touches past months.
// - A person's owed balance = (total they personally paid on deferred expenses,
//   plus any repayment amounts they funded) - (their split share across all
//   deferred expenses). Vyuh Gravity has no split share.
// - Positive net = RV owes this person. Negative = this person owes RV.

export function computeBalances(expenses, people, splitVersions, repayments = []) {
  const sortedVersions = [...splitVersions].sort(
    (a, b) => new Date(a.start_date) - new Date(b.start_date)
  );

  const paid = Object.fromEntries(people.map((p) => [p.id, 0]));
  const owedShare = Object.fromEntries(people.map((p) => [p.id, 0]));

  for (const repayment of repayments || []) {
    if (repayment.funded_by) {
      paid[repayment.funded_by] = (paid[repayment.funded_by] || 0) + Number(repayment.amount);
    }
  }

  const deferred = expenses.filter((e) => !e.settled);

  for (const expense of deferred) {
    paid[expense.paid_by] = (paid[expense.paid_by] || 0) + Number(expense.amount);

    const version = findApplicableVersion(sortedVersions, expense.expense_date);
    if (!version) continue;

    for (const share of version.shares) {
      const portion = (Number(expense.amount) * Number(share.percentage)) / 100;
      owedShare[share.person_id] = (owedShare[share.person_id] || 0) + portion;
    }
  }

  return people.map((p) => ({
    id: p.id,
    name: p.name,
    paid: round2(paid[p.id] || 0),
    owedShare: round2(owedShare[p.id] || 0),
    net: round2((paid[p.id] || 0) - (owedShare[p.id] || 0)),
  }));
}

function findApplicableVersion(sortedVersions, expenseDate) {
  let applicable = null;
  for (const v of sortedVersions) {
    if (new Date(v.start_date) <= new Date(expenseDate)) applicable = v;
    else break;
  }
  return applicable;
}

export function monthTotal(expenses, year, month) {
  // month is 1-indexed (1 = January)
  return round2(
    expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getFullYear() === year && d.getMonth() + 1 === month;
      })
      .reduce((sum, e) => sum + Number(e.amount), 0)
  );
}

// Per-founder settlement shares for an amount on a given date — the client-side
// equivalent of the old /api/split-preview endpoint. Returns rows for the split
// version active on `date`, optionally excluding one payer.
export function shareForDate(splitVersions, date, amount, excludePersonId = null) {
  const version = [...splitVersions]
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))
    .reverse()
    .find((v) => new Date(v.start_date) <= new Date(date));
  if (!version) return [];

  return version.shares
    .filter((s) => s.person_id !== excludePersonId)
    .map((s) => ({
      person_id: s.person_id,
      name: s.name || null,
      percentage: Number(s.percentage),
      share_amount: (Number(amount) * Number(s.percentage)) / 100,
    }));
}

function round2(n) {
  return Math.round(n * 100) / 100;
}
