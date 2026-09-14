// Verifies the client-side port (js/balances.js) matches the original
// server math (lib/balances.js) on the same data, and checks known outputs.
// Run: npm test   (or: node test/balances.test.js)

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import * as client from '../js/balances.js';
import * as server from '../lib/balances.js';

const here = dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(readFileSync(join(here, '../js/mock-data.json'), 'utf8'));

let passed = 0;
function check(name, fn) {
  fn();
  passed++;
  console.log('  ✓ ' + name);
}

console.log('balances math');

check('client port equals server math (computeBalances)', () => {
  const c = client.computeBalances(data.expenses, data.people, data.splitVersions, data.repayments);
  const s = server.computeBalances(data.expenses, data.people, data.splitVersions, data.repayments);
  assert.deepEqual(c, s);
});

check('known net balances (35/35/30 split, VG funded)', () => {
  const byId = Object.fromEntries(
    client.computeBalances(data.expenses, data.people, data.splitVersions, data.repayments).map((b) => [b.id, b.net])
  );
  // Deferred: pkg 30000 (gagan), fuel 12000 (ankith), equip 50000 (VG), supplies 6000 (yashas) = 98000
  // owedShare: gagan/ankith 34300, yashas 29400, VG 0
  assert.equal(byId.p_gagan, -4300);
  assert.equal(byId.p_ankith, -22300);
  assert.equal(byId.p_yashas, -23400);
  assert.equal(byId.p_vg, 50000);
  const sum = Object.values(byId).reduce((a, b) => a + b, 0);
  assert.equal(Math.round(sum), 0, 'balances must net to zero');
});

check('settled expenses do not touch balances', () => {
  const withSettled = client.computeBalances(data.expenses, data.people, data.splitVersions, data.repayments);
  const deferredOnly = data.expenses.filter((e) => !e.settled);
  const withoutSettled = client.computeBalances(deferredOnly, data.people, data.splitVersions, data.repayments);
  assert.deepEqual(withSettled, withoutSettled);
});

check('monthTotal (Sep 2026) = 51000', () => {
  assert.equal(client.monthTotal(data.expenses, 2026, 9), 51000);
  assert.equal(client.monthTotal(data.expenses, 2026, 9), server.monthTotal(data.expenses, 2026, 9));
});

check('shareForDate excludes payer and matches the active split', () => {
  const rows = client.shareForDate(data.splitVersions, '2026-09-05', 30000, 'p_gagan');
  const map = Object.fromEntries(rows.map((r) => [r.person_id, r.share_amount]));
  assert.equal(rows.length, 2, 'payer excluded');
  assert.equal(map.p_ankith, 10500); // 35%
  assert.equal(map.p_yashas, 9000); // 30%
  assert.equal(map.p_gagan, undefined);
});

console.log(`\n${passed} checks passed.`);
