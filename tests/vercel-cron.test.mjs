import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('Vercel Hobby schedule runs only once each day', () => {
  const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
  const jobs = config.crons || [];
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].path, '/api/sdo-sync');
  const [minute, hour, dayOfMonth, month, dayOfWeek] = jobs[0].schedule.trim().split(/\s+/);
  assert.match(minute, /^(?:[0-5]?\d)$/);
  assert.match(hour, /^(?:[01]?\d|2[0-3])$/);
  assert.equal(dayOfMonth, '*');
  assert.equal(month, '*');
  assert.equal(dayOfWeek, '*');
  assert.equal(jobs[0].schedule, '0 11 * * *');
});
