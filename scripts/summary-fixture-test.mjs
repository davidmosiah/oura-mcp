import assert from 'node:assert/strict';
import { buildDailySummary, buildWeeklySummary } from '../dist/services/summary.js';
import { buildWellnessContext } from '../dist/services/context.js';

const today = new Date().toISOString().slice(0, 10);

const fakeClient = {
  async get(endpoint) {
    if (endpoint.includes('/daily_activity')) {
      return { data: [{ day: today, score: 82, steps: 9000, active_calories: 520, total_calories: 2400, equivalent_walking_distance: 7200 }] };
    }
    if (endpoint.includes('/daily_sleep')) {
      return { data: [{ day: today, score: 88 }] };
    }
    if (endpoint.includes('/daily_readiness')) {
      return { data: [{ day: today, score: 84, temperature_deviation: 0.1, contributors: { recovery_index: 90 } }] };
    }
    if (endpoint.includes('/usercollection/sleep')) {
      return { data: [{ day: today, total_sleep_duration: 25800, efficiency: 91, lowest_heart_rate: 58, average_hrv: 48.2 }] };
    }
    if (endpoint.includes('/daily_spo2')) {
      return { data: [{ day: today, spo2_percentage: 97.2 }] };
    }
    throw new Error(`unexpected endpoint ${endpoint}`);
  }
};

const daily = await buildDailySummary(fakeClient, { days: 7, timezone: 'UTC' });
assert.equal(daily.kind, 'daily_summary');
assert.equal(daily.scorecard.steps, 9000);
assert.equal(daily.scorecard.sleep_minutes, 430);
assert.equal(daily.scorecard.lowest_heart_rate, 58);
assert.equal(daily.scorecard.readiness_score, 84);
assert.ok(daily.diagnostic.action_candidates.length >= 2);

const weekly = await buildWeeklySummary(fakeClient, { days: 7, compare_days: 7, timezone: 'UTC' });
assert.equal(weekly.kind, 'weekly_summary');
assert.equal(weekly.scorecard.current.days, 7);
assert.equal(weekly.scorecard.current.avg_sleep_hours, 7.17);
assert.equal(weekly.scorecard.current.avg_readiness_score, 84);
assert.ok(weekly.diagnostic.bottlenecks.length >= 1);

const context = await buildWellnessContext(fakeClient, { days: 7, timezone: 'UTC' });
assert.equal(context.source, 'oura');
assert.equal(context.readiness_score, 84);
assert.equal(context.sleep_score, 88);
assert.equal(context.recent_training_load, 'normal');

console.log(JSON.stringify({ ok: true, daily: daily.kind, weekly: weekly.kind }, null, 2));
