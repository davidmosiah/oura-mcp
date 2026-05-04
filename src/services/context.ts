import type { OuraClient } from "./oura-client.js";
import { buildDailySummary, type SummaryOptions } from "./summary.js";

type ContextOptions = SummaryOptions & { soreness?: string[]; injury_flags?: string[]; notes?: string };
type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function num(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function loadFromActivity(activityScore?: number): "low" | "normal" | "high" | "unknown" {
  if (activityScore === undefined) return "unknown";
  if (activityScore >= 90) return "high";
  if (activityScore < 45) return "low";
  return "normal";
}

export async function buildWellnessContext(client: Pick<OuraClient, "get">, options: ContextOptions) {
  const summary = await buildDailySummary(client as OuraClient, options);
  const scorecard = record(summary.scorecard);
  const readiness = num(scorecard.readiness_score);
  const sleepScore = num(scorecard.sleep_score);
  const activityScore = num(scorecard.activity_score);
  const recentTrainingLoad = loadFromActivity(activityScore);

  return {
    source: "oura",
    generated_at: summary.generated_at,
    readiness_score: readiness,
    sleep_score: sleepScore,
    recent_training_load: recentTrainingLoad,
    soreness: options.soreness ?? [],
    injury_flags: options.injury_flags ?? [],
    notes: [options.notes].filter((note): note is string => Boolean(note)),
    data_quality: summary.data_quality,
    telegram_summary: [
      "Oura wellness context",
      readiness !== undefined ? `Readiness: ${readiness}` : undefined,
      sleepScore !== undefined ? `Sleep: ${sleepScore}` : undefined,
      `Load: ${recentTrainingLoad}`
    ].filter(Boolean).join(" | ")
  };
}

export function formatWellnessContextMarkdown(context: Record<string, unknown>): string {
  return ["# Oura Wellness Context", "", JSON.stringify(context, null, 2)].join("\n");
}
