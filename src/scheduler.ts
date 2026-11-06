import { DefaultScheduler, Rating } from "ts-fsrs";
import type { DefaultSchedulerCard } from "ts-fsrs";
import type { Grade } from "./content.ts";

// Pin the model as well as the package so a library update cannot reinterpret saves.
export const scheduler = await DefaultScheduler({
  version: "FSRS-6",
  desiredRetention: 0.9,
  enableFuzz: false,
  learningSteps: ["1m", "10m"],
  relearningSteps: ["10m"],
});

export type ScheduledCard = Omit<
  DefaultSchedulerCard<"FSRS-6">,
  "dueAt" | "lastReviewAt"
> & {
  dueAt: string;
  lastReviewAt: string | null;
};

function hydrate(card: ScheduledCard): DefaultSchedulerCard<"FSRS-6"> {
  return {
    ...card,
    dueAt: new Date(card.dueAt),
    lastReviewAt: card.lastReviewAt ? new Date(card.lastReviewAt) : null,
  };
}

export function schedule(
  card: ScheduledCard | undefined,
  id: string,
  grade: Grade,
  now: Date,
) {
  const before = card
    ? hydrate(card)
    : { ...scheduler.newCard({ now }), cardId: id };
  const result = scheduler.review({ card: before, grade: Rating[grade], now });
  return {
    card: {
      ...result.card,
      dueAt: result.card.dueAt.toISOString(),
      lastReviewAt: result.card.lastReviewAt?.toISOString() ?? null,
    } satisfies ScheduledCard,
    log: {
      ...result.revlog,
      dueAt: result.revlog.dueAt.toISOString(),
      lastReviewAt: result.revlog.lastReviewAt?.toISOString() ?? null,
      reviewTime: now.toISOString(),
    },
  };
}

export function intervalLabel(dueAt: string, now = new Date()): string {
  const minutes = Math.max(
    1,
    Math.round((Date.parse(dueAt) - now.getTime()) / 60000),
  );
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} hr`;
  return `${Math.round(minutes / 1440)} days`;
}

export function validSchedule(value: unknown): value is ScheduledCard {
  if (!value || typeof value !== "object") return false;
  const c = value as ScheduledCard;
  return (
    typeof c.cardId === "string" &&
    Number.isFinite(Date.parse(c.dueAt)) &&
    (c.lastReviewAt === null || Number.isFinite(Date.parse(c.lastReviewAt))) &&
    [0, 1, 2, 3].includes(c.state) &&
    ["new", "learning", "review", "relearning"].includes(c.scheduleStatus) &&
    [
      c.stability,
      c.difficulty,
      c.reps,
      c.lapses,
      c.scheduledDays,
      c.learningStep,
    ].every((n) => typeof n === "number" && Number.isFinite(n) && n >= 0) &&
    c.difficulty <= 10 &&
    [c.reps, c.lapses, c.learningStep].every(Number.isInteger)
  );
}
