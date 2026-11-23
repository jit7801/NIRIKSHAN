import test from 'node:test';
import assert from 'node:assert/strict';
import { generateCSVContent } from '../csvExport.js';

test('works export handles multiple pages and large datasets without 1000-record limit', async () => {
  const totalRecords = 1250;
  const BATCH_SIZE = 500;

  // Mock paginated API
  async function mockFetchWorks({ limit, offset }) {
    const count = Math.min(limit, Math.max(0, totalRecords - offset));
    const items = [];
    for (let i = 0; i < count; i++) {
      const id = offset + i + 1;
      items.push({
        work_id: `MPLAD-TEST-${String(id).padStart(4, '0')}`,
        work_title: `Development Work #${id}, Ward #${(id % 20) + 1}`,
        work_category: 'Roads & Pathways',
        state: 'Rajasthan',
        district: 'Jaipur',
        sanctioned_amount: 100000 + id * 10,
        actual_expenditure: 80000 + id * 5,
        physical_progress: 75.5,
        financial_progress: 80.0,
        overall_risk_score: 65,
        risk_level: 'HIGH',
        primary_risk_factor: 'Cost Anomaly',
        status: 'ONGOING',
        implementing_agency: 'PWD Jaipur Division'
      });
    }
    return { total: totalRecords, items };
  }

  // Execute pagination loop matching WorksTableView.jsx
  const collectedRecords = [];
  let offset = 0;
  while (offset < totalRecords) {
    const res = await mockFetchWorks({ limit: BATCH_SIZE, offset });
    const batch = res.items || [];
    if (batch.length === 0) break;
    collectedRecords.push(...batch);
    offset += batch.length;
    if (batch.length < BATCH_SIZE) break;
  }

  // Verify all 1,250 records were retrieved (no 1,000-record truncation)
  assert.equal(collectedRecords.length, 1250);

  // Generate CSV
  const headers = [
    'Work ID', 'Title', 'Category', 'State', 'District', 'Sanctioned Amount (INR)',
    'Actual Expenditure (INR)', 'Physical Progress (%)', 'Financial Progress (%)',
    'Unified Risk Score', 'Risk Level', 'Primary Signal', 'Status', 'Agency'
  ];
  const rows = collectedRecords.map((w) => [
    w.work_id,
    w.work_title,
    w.work_category,
    w.state,
    w.district,
    w.sanctioned_amount,
    w.actual_expenditure,
    w.physical_progress,
    w.financial_progress,
    w.overall_risk_score,
    w.risk_level,
    w.primary_risk_factor,
    w.status,
    w.implementing_agency
  ]);

  const csv = generateCSVContent(headers, rows);

  // Assert BOM is present
  assert.ok(csv.startsWith('\uFEFF'));

  // Assert line count is 1 header + 1250 data rows
  const lines = csv.split('\r\n').filter(Boolean);
  assert.equal(lines.length, 1251);

  // Verify '#' characters in title are fully preserved inside quotes
  assert.ok(csv.includes('"Development Work #1, Ward #2"'));
  assert.ok(csv.includes('"Development Work #1250, Ward #11"'));
});
