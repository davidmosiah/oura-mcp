import type { OuraClient } from "./oura-client.js";

const DAY_MS = 24 * 60 * 60 * 1000;

type UnknownRecord = Record<string, unknown>;

export interface SummaryOptions {
  days: number;
  compare_days?: number;
  timezone?: string;
}

function isObject(value: unknown): value is UnknownRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function firstData(value: unknown): UnknownRecord {
  if (Array.isArray(value)) return isObject(value[0]) ? value[0] : {};
  if (!isObject(value)) return {};
  if (Array.isArray(value.data)) return isObject(value.data[0]) ? value.data[0] : {};
  return value;
}

function num(record: UnknownRecord, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
}

function round(value?: number, digits = 1): number | undefined {
  if (value === undefined || !Number.isFinite(value)) return undefined;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function sum(values: Array<number | undefined>): number {
  return values.reduce<number>((total, value) => total + (typeof value === "number" && Number.isFinite(value) ? value : 0), 0);
}

function avg(values: Array<number | undefined>): number | undefined {
  const nums = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  return nums.length ? sum(nums) / nums.length : undefined;
}

function percentDelta(current?: number, previous?: number): number | undefined {
  if (current === undefined || previous === undefined || previous === 0) return undefined;
  return ((current - previous) / previous) * 100;
}

function dateString(daysAgo = 0): string {
  return new Date(Date.now() - daysAgo * DAY_MS).toISOString().slice(0, 10);
}

async function safeGet(client: Pick<OuraClient, "get">, endpoint: string, params?: Record<string, string>): Promise<unknown> {
  try {
    return await client.get(endpoint, params);
  } catch (error) {
    return { error: (error as Error).message, endpoint };
  }
}

async function dailyBundle(client: Pick<OuraClient, "get">, date: string) {
  const range = { start_date: date, end_date: date };
  const [activity, dailySleep, readiness, sleep, spo2] = await Promise.all([
    safeGet(client, "/usercollection/daily_activity", range),
    safeGet(client, "/usercollection/daily_sleep", range),
    safeGet(client, "/usercollection/daily_readiness", range),
    safeGet(client, "/usercollection/sleep", range),
    safeGet(client, "/usercollection/daily_spo2", range)
  ]);
  return { date, activity, dailySleep, readiness, sleep, spo2 };
}

function dailyStats(bundle: Awaited<ReturnType<typeof dailyBundle>>) {
  const activity = firstData(bundle.activity);
  const dailySleep = firstData(bundle.dailySleep);
  const readiness = firstData(bundle.readiness);
  const sleep = firstData(bundle.sleep);
  const spo2 = firstData(bundle.spo2);
  const totalSleepSeconds = num(sleep, ["total_sleep_duration", "time_in_bed"]);
  const activeCalories = num(activity, ["active_calories", "calories"]);
  const equivalentWalkingMeters = num(activity, ["equivalent_walking_distance"]);

  return {
    date: bundle.date,
    readiness_score: num(readiness, ["score"]),
    sleep_score: num(dailySleep, ["score"]),
    activity_score: num(activity, ["score"]),
    steps: num(activity, ["steps"]),
    active_calories: activeCalories,
    total_calories: num(activity, ["total_calories"]),
    distance_km: equivalentWalkingMeters === undefined ? undefined : round(equivalentWalkingMeters / 1000, 2),
    sleep_minutes: totalSleepSeconds === undefined ? undefined : round(totalSleepSeconds / 60, 0),
    sleep_efficiency: num(sleep, ["efficiency"]),
    average_heart_rate: num(sleep, ["average_heart_rate"]),
    lowest_heart_rate: num(sleep, ["lowest_heart_rate"]),
    hrv_rmssd: num(sleep, ["average_hrv"]),
    spo2_percentage: num(spo2, ["spo2_percentage"]),
    temperature_deviation: num(readiness, ["temperature_deviation"]),
    has_activity_error: isObject(bundle.activity) && typeof bundle.activity.error === "string",
    has_sleep_error: isObject(bundle.sleep) && typeof bundle.sleep.error === "string",
    has_readiness_error: isObject(bundle.readiness) && typeof bundle.readiness.error === "string",
    has_spo2_error: isObject(bundle.spo2) && typeof bundle.spo2.error === "string"
  };
}

function classifyReadiness(stats: ReturnType<typeof dailyStats>): string {
  const readiness = stats.readiness_score;
  const sleepScore = stats.sleep_score;
  const sleepHours = (stats.sleep_minutes ?? 0) / 60;
  if (readiness !== undefined && readiness >= 85) return "high_readiness";
  if (readiness !== undefined && readiness < 60) return "low_readiness";
  if (sleepScore !== undefined && sleepScore < 65) return "sleep_limited";
  if (sleepHours > 0 && sleepHours < 6) return "sleep_limited";
  if ((stats.activity_score ?? 0) >= 85 && (readiness ?? 100) < 70) return "load_recovery_mismatch";
  return "neutral";
}

function buildActions(stats: ReturnType<typeof dailyStats>, weekly?: ReturnType<typeof aggregateStats>): string[] {
  const actions: string[] = [];
  const state = classifyReadiness(stats);
  if (state === "low_readiness") actions.push("Keep intensity low today and prioritize recovery inputs before adding more training stress.");
  if (state === "sleep_limited") actions.push("Treat sleep as the main constraint: protect bedtime, light exposure and stimulant cutoff before optimizing workouts.");
  if (state === "load_recovery_mismatch") actions.push("Activity load looks high relative to recovery; use subjective soreness and schedule pressure before deciding on intensity.");
  if (state === "high_readiness") actions.push("If subjective energy agrees, this is a reasonable day for quality work or progressive aerobic volume.");
  if (state === "neutral") actions.push("Use Oura as a baseline check today: pair the scores with subjective energy, soreness and schedule pressure.");
  if ((stats.temperature_deviation ?? 0) > 0.5) actions.push("Watch temperature deviation as context only; illness symptoms should override training plans.");
  if (weekly?.avg_sleep_hours !== undefined && weekly.avg_sleep_hours < 6.5) actions.push("Weekly sleep average is below 6.5h; recovery improvements may beat training complexity.");
  actions.push("This is not medical advice; use Oura as trend context and escalate symptoms or abnormal vitals to a clinician.");
  return [...new Set(actions)];
}

function aggregateStats(days: ReturnType<typeof dailyStats>[]) {
  return {
    days: days.length,
    avg_readiness_score: round(avg(days.map((day) => day.readiness_score)), 1),
    avg_sleep_score: round(avg(days.map((day) => day.sleep_score)), 1),
    avg_activity_score: round(avg(days.map((day) => day.activity_score)), 1),
    total_steps: round(sum(days.map((day) => day.steps)), 0),
    avg_steps: round(avg(days.map((day) => day.steps)), 0),
    avg_active_calories: round(avg(days.map((day) => day.active_calories)), 0),
    avg_sleep_hours: round(avg(days.map((day) => day.sleep_minutes).map((minutes) => minutes === undefined ? undefined : minutes / 60)), 2),
    avg_lowest_heart_rate: round(avg(days.map((day) => day.lowest_heart_rate)), 0),
    avg_hrv_rmssd: round(avg(days.map((day) => day.hrv_rmssd)), 1),
    avg_spo2_percentage: round(avg(days.map((day) => day.spo2_percentage)), 1),
    days_with_readiness: days.filter((day) => day.readiness_score !== undefined).length,
    days_with_sleep: days.filter((day) => day.sleep_minutes !== undefined || day.sleep_score !== undefined).length,
    days_with_hrv: days.filter((day) => day.hrv_rmssd !== undefined).length
  };
}

export async function buildDailySummary(client: Pick<OuraClient, "get">, options: SummaryOptions) {
  const date = dateString(0);
  const bundle = await dailyBundle(client, date);
  const stats = dailyStats(bundle);
  const readiness = classifyReadiness(stats);

  return {
    kind: "daily_summary" as const,
    generated_at: new Date().toISOString(),
    window: { date, days: options.days, timezone: options.timezone ?? "UTC" },
    data_quality: {
      confidence: [stats.has_activity_error, stats.has_sleep_error, stats.has_readiness_error].filter(Boolean).length === 0 ? "high" : "partial",
      missing_or_failed: {
        activity: stats.has_activity_error,
        sleep: stats.has_sleep_error,
        readiness: stats.has_readiness_error,
        spo2: stats.has_spo2_error
      }
    },
    scorecard: stats,
    diagnostic: {
      readiness_context: readiness,
      primary_signal: readiness === "low_readiness" || readiness === "sleep_limited"
        ? "Recovery is the limiting context today; keep recommendations conservative."
        : "Use Oura readiness, sleep and activity together as context, not diagnosis.",
      action_candidates: buildActions(stats)
    },
    safety: {
      medical_advice: false,
      api_boundary: "Oura Cloud API exposes processed readiness, sleep, activity, workout, heart-rate and SpO2 data; this MCP does not expose raw sensor streams."
    }
  };
}

export async function buildWeeklySummary(client: Pick<OuraClient, "get">, options: SummaryOptions) {
  const days = Math.max(options.days, 7);
  const compareDays = options.compare_days ?? 7;
  const currentBundles = await Promise.all(Array.from({ length: days }, (_, index) => dailyBundle(client, dateString(index))));
  const current = currentBundles.map(dailyStats).reverse();
  const previous = compareDays > 0
    ? (await Promise.all(Array.from({ length: compareDays }, (_, index) => dailyBundle(client, dateString(days + index))))).map(dailyStats).reverse()
    : [];
  const currentStats = aggregateStats(current);
  const previousStats = previous.length ? aggregateStats(previous) : undefined;

  return {
    kind: "weekly_summary" as const,
    generated_at: new Date().toISOString(),
    window: { days, compare_days: compareDays, timezone: options.timezone ?? "UTC" },
    data_quality: {
      days_with_readiness: currentStats.days_with_readiness,
      days_with_sleep: currentStats.days_with_sleep,
      days_with_hrv: currentStats.days_with_hrv,
      confidence: currentStats.days_with_readiness >= 5 && currentStats.days_with_sleep >= 5 ? "high" : currentStats.days_with_sleep >= 3 ? "medium" : "low"
    },
    scorecard: {
      current: currentStats,
      previous: previousStats,
      delta: previousStats ? {
        readiness_pct: round(percentDelta(currentStats.avg_readiness_score, previousStats.avg_readiness_score), 1),
        sleep_score_pct: round(percentDelta(currentStats.avg_sleep_score, previousStats.avg_sleep_score), 1),
        steps_pct: round(percentDelta(currentStats.avg_steps, previousStats.avg_steps), 1),
        sleep_hours_pct: round(percentDelta(currentStats.avg_sleep_hours, previousStats.avg_sleep_hours), 1),
        hrv_pct: round(percentDelta(currentStats.avg_hrv_rmssd, previousStats.avg_hrv_rmssd), 1)
      } : undefined
    },
    diagnostic: {
      load_classification: classifyWeeklyLoad(currentStats),
      bottlenecks: inferBottlenecks(currentStats, previousStats),
      action_candidates: buildActions(current[current.length - 1] ?? current[0], currentStats),
      next_week_success_metrics: [
        "Keep sleep average above the user's sustainable baseline before increasing intensity.",
        "Track readiness score, sleep score and HRV together rather than optimizing one metric.",
        "Use HRV only when enough days are available; sparse HRV should be treated as low confidence.",
        "If symptoms, illness or abnormal vitals appear, seek clinical guidance instead of agent optimization."
      ]
    },
    safety: {
      medical_advice: false,
      raw_sensor_boundary: "Oura MCP exposes processed Cloud API data, not raw ring telemetry."
    }
  };
}

function classifyWeeklyLoad(stats: ReturnType<typeof aggregateStats>): string {
  const readiness = stats.avg_readiness_score ?? 100;
  const sleep = stats.avg_sleep_hours ?? 0;
  const activity = stats.avg_activity_score ?? 0;
  if (readiness < 65 && sleep < 6.5) return "low_readiness_low_sleep";
  if (activity >= 85 && readiness < 75) return "high_activity_lower_readiness";
  if (sleep < 6.5) return "sleep_limited";
  if (readiness >= 80 && sleep >= 7) return "good_recovery_base";
  return "neutral";
}

function inferBottlenecks(current: ReturnType<typeof aggregateStats>, previous?: ReturnType<typeof aggregateStats>): string[] {
  const bottlenecks: string[] = [];
  const sleepDelta = percentDelta(current.avg_sleep_hours, previous?.avg_sleep_hours);
  const readinessDelta = percentDelta(current.avg_readiness_score, previous?.avg_readiness_score);
  if ((current.avg_readiness_score ?? 100) < 65) bottlenecks.push("Average readiness is low; keep intensity recommendations conservative.");
  if ((current.avg_sleep_hours ?? 0) < 6.5) bottlenecks.push("Average sleep is below 6.5h; recovery may be the limiting factor.");
  if (readinessDelta !== undefined && readinessDelta < -10) bottlenecks.push("Readiness decreased materially versus the comparison window.");
  if (sleepDelta !== undefined && sleepDelta < -10) bottlenecks.push("Sleep duration decreased materially versus the comparison window.");
  if (current.days_with_hrv < 3) bottlenecks.push("HRV data is sparse; do not over-weight HRV conclusions.");
  if (!bottlenecks.length) bottlenecks.push("No obvious Oura-only bottleneck; combine trends with subjective energy, soreness and life stress.");
  return bottlenecks;
}

export function formatSummaryMarkdown(summary: Record<string, unknown>): string {
  const lines = [`# Oura ${summary.kind === "weekly_summary" ? "Weekly" : "Daily"} Summary`, ""];
  lines.push(`Generated: ${summary.generated_at}`);
  const diagnostic = summary.diagnostic as { primary_signal?: string; load_classification?: string; readiness_context?: string; action_candidates?: string[]; bottlenecks?: string[] } | undefined;
  if (diagnostic?.primary_signal) lines.push(`\n## Primary signal\n${diagnostic.primary_signal}`);
  if (diagnostic?.readiness_context) lines.push(`\n## Readiness context\n${diagnostic.readiness_context}`);
  if (diagnostic?.load_classification) lines.push(`\n## Load\n${diagnostic.load_classification}`);
  if (diagnostic?.bottlenecks?.length) {
    lines.push("\n## Bottlenecks");
    diagnostic.bottlenecks.forEach((item) => lines.push(`- ${item}`));
  }
  if (diagnostic?.action_candidates?.length) {
    lines.push("\n## Action candidates");
    diagnostic.action_candidates.forEach((item) => lines.push(`- ${item}`));
  }
  lines.push("\n## Structured data");
  lines.push("```json");
  lines.push(JSON.stringify(summary, null, 2));
  lines.push("```");
  return lines.join("\n");
}
