// Core ledger math.
//
// Model:
// - Every expense has a payer (one of the 3 founders, or Vyuh Gravity).
// - Every expense has a `settled` flag:
//     settled = true  -> already squared up between the founders in person,
//                         doesn't touch anyone's owed balance.
//     settled = false -> deferred, accumulates into the "RV owes X" balance.
// - The 3-way founder split is NOT stored per expense. It's a backend-only
//   config (split_versions + split_shares) with an effective start_date.
//   Each deferred expense looks up whichever split version was active on
//   its own expense_date, so changing the split later never touches the
//   math for past expenses.
// - A founder's owed balance = (total they personally paid on deferred
//   expenses) - (their split share across ALL deferred expenses, using
//   the split version active on each expense's date).
// - Vyuh Gravity has no split share (it's a funding entity, not a
//   cost-bearing founder) — RV simply owes it back whatever it paid.
//
// This always nets to zero across everyone: money doesn't appear or
// disappear, it just tells you who fronted more than their share.

/**
 * @param {Array} expenses - rows from `expenses`, each with
 *   { id, amount, paid_by, settled, expense_date }
 * @param {Array} people - rows from `people`, each with { id, name, can_login }
 * @param {Array} splitVersions - rows from `split_versions`, each with
 *   { id, start_date, shares: [{ person_id, percentage }] }
 *   `shares` must already be attached (see lib/splits.js).
 * @param {Array} repayments - rows from `repayments`, each with
 *   { amount, repaid_by, funded_by }
 */
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
    if (!version) continue; // no split config covering this date yet

    for (const share of version.shares) {
      const portion = (Number(expense.amount) * Number(share.percentage)) / 100;
      owedShare[share.person_id] = (owedShare[share.person_id] || 0) + portion;
    }
  }

  const balances = people.map((p) => ({
    id: p.id,
    name: p.name,
    paid: round2(paid[p.id] || 0),
    owedShare: round2(owedShare[p.id] || 0),
    // Positive = RV owes this person. Negative = this person owes RV.
    net: round2((paid[p.id] || 0) - (owedShare[p.id] || 0)),
  }));

  return balances;
}

function findApplicableVersion(sortedVersions, expenseDate) {
  let applicable = null;
  for (const v of sortedVersions) {
    if (new Date(v.start_date) <= new Date(expenseDate)) {
      applicable = v;
    } else {
      break;
    }
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

function round2(n) {
  return Math.round(n * 100) / 100;
}
