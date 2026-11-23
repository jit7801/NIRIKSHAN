import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeCSVField, generateCSVContent } from '../csvExport.js';

test('escapeCSVField correctly handles null and undefined', () => {
  assert.equal(escapeCSVField(null), '""');
  assert.equal(escapeCSVField(undefined), '""');
});

test('escapeCSVField handles numbers and booleans', () => {
  assert.equal(escapeCSVField(42), '42');
  assert.equal(escapeCSVField(0), '0');
  assert.equal(escapeCSVField(1234.56), '1234.56');
  assert.equal(escapeCSVField(NaN), '""');
  assert.equal(escapeCSVField(true), 'true');
  assert.equal(escapeCSVField(false), 'false');
});

test('escapeCSVField escapes double quotes per RFC 4180', () => {
  assert.equal(escapeCSVField('Road "Phase 1" Work'), '"Road ""Phase 1"" Work"');
  assert.equal(escapeCSVField('"Quote at start"'), '"""Quote at start"""');
});

test('escapeCSVField preserves special characters like # and commas', () => {
  assert.equal(escapeCSVField('Ward #4 Community Hall'), '"Ward #4 Community Hall"');
  assert.equal(escapeCSVField('Jaipur, Rajasthan'), '"Jaipur, Rajasthan"');
});

test('escapeCSVField preserves newlines', () => {
  assert.equal(escapeCSVField('Line 1\nLine 2'), '"Line 1\nLine 2"');
});

test('generateCSVContent prepends UTF-8 BOM and joins with CRLF', () => {
  const headers = ['Work ID', 'Work Title', 'Cost (INR)'];
  const rows = [
    ['MPLAD-01', 'CC Road #5, Ward 10', 500000],
    ['MPLAD-02', 'Community Hall "Kalyan"', 1200000]
  ];

  const csv = generateCSVContent(headers, rows);

  // Check UTF-8 BOM
  assert.ok(csv.startsWith('\uFEFF'), 'CSV must start with UTF-8 BOM (\\uFEFF)');

  // Verify CRLF delimiter
  assert.ok(csv.includes('\r\n'), 'CSV lines must be delimited by \\r\\n');

  // Verify rows exist and special characters are preserved
  assert.ok(csv.includes('"CC Road #5, Ward 10"'), 'Hash and comma must be preserved');
  assert.ok(csv.includes('"Community Hall ""Kalyan"""'), 'Double quotes must be escaped');
  assert.ok(csv.includes('500000'), 'Numbers must be unquoted numbers');
});
