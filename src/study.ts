import { recallCards } from "./cards.ts";
import type { PrivateCard } from "./cards.ts";
import { grades } from "./content.ts";
import {
  legacyRevision,
  scenarioQuestions as questions,
  scenarioRevision,
} from "./scenario-content.ts";
import type { Grade } from "./content.ts";
import { initialPractice, rate, readPractice } from "./session.ts";
import type { SavedPractice } from "./session.ts";
import { schedule, validSchedule } from "./scheduler.ts";
import type { ScheduledCard } from "./scheduler.ts";

export const contentRevision = scenarioRevision;
export type ReviewEvent = {
  id: string;
  itemId: string;
  grade: Grade;
  at: string;
  day: string;
  wasNew: boolean;
  scheduler: "FSRS-6/ts-fsrs-6.0.0";
  log: ReturnType<typeof schedule>["log"];
};
export type ReviewSession = {
  ids: string[];
  index: number;
  phase: "question" | "feedback" | "rated" | "complete";
};
export type Study = {
  schemaVersion: 1;
  contentRevision: string;
  practice: SavedPractice;
  privateCards: PrivateCard[];
  schedules: Record<string, ScheduledCard>;
  reviews: ReviewEvent[];
  reviewSession: ReviewSession | null;
  notes: Record<string, string>;
  timeZone: string;
};

export function newStudy(practice = initialPractice()): Study {
  return {
    schemaVersion: 1,
    contentRevision,
    practice,
    privateCards: [],
    schedules: {},
    reviews: [],
    reviewSession: null,
    notes: {},
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
}

export function studyDay(now: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function findItem(study: Study, id: string) {
  return (
    recallCards.find((c) => c.id === id) ??
    study.privateCards.find((c) => c.id === id) ??
    (Object.hasOwn(questions, id) ? questions[id] : undefined)
  );
}

export function queueFor(study: Study, now = new Date()) {
  const due = Object.entries(study.schedules)
    .filter(
      ([id, card]) =>
        findItem(study, id) && Date.parse(card.dueAt) <= now.getTime(),
    )
    .sort(
      ([a, x], [b, y]) =>
        Date.parse(x.dueAt) - Date.parse(y.dueAt) || a.localeCompare(b),
    )
    .map(([id]) => id);
  const today = studyDay(now, study.timeZone);
  const introduced = new Set(
    study.reviews
      .filter((e) => e.wasNew && e.day === today)
      .map((e) => e.itemId),
  ).size;
  const unseen = [...recallCards, ...study.privateCards]
    .filter((c) => !study.schedules[c.id])
    .slice(0, Math.max(0, 5 - introduced))
    .map((c) => c.id);
  return { due, unseen, ids: [...due, ...unseen], introduced };
}

export function beginReview(study: Study, now = new Date()): Study {
  if (study.reviewSession && study.reviewSession.phase !== "complete")
    return study;
  const { ids } = queueFor(study, now);
  return {
    ...study,
    reviewSession: ids.length ? { ids, index: 0, phase: "question" } : null,
  };
}

export function recordRating(
  study: Study,
  itemId: string,
  grade: Grade,
  now: Date,
  eventId: string,
): Study {
  if (
    !findItem(study, itemId) ||
    !grades.includes(grade) ||
    study.reviews.some((e) => e.id === eventId)
  )
    return study;
  const result = schedule(study.schedules[itemId], itemId, grade, now);
  const event: ReviewEvent = {
    id: eventId,
    itemId,
    grade,
    at: now.toISOString(),
    day: studyDay(now, study.timeZone),
    wasNew: !study.schedules[itemId],
    scheduler: "FSRS-6/ts-fsrs-6.0.0",
    log: result.log,
  };
  return {
    ...study,
    schedules: { ...study.schedules, [itemId]: result.card },
    reviews: [...study.reviews, event],
  };
}

export function rateScenario(
  study: Study,
  grade: Grade,
  now: Date,
  eventId: string,
): Study {
  const before = study.practice.session;
  const after = rate(before, grade);
  if (after === before) return study;
  return {
    ...recordRating(study, before.path.at(-1)!, grade, now, eventId),
    practice: { ...study.practice, session: after },
  };
}

export function rateReview(
  study: Study,
  grade: Grade,
  now: Date,
  eventId: string,
): Study {
  const session = study.reviewSession;
  if (!session || session.phase !== "feedback") return study;
  return {
    ...recordRating(study, session.ids[session.index]!, grade, now, eventId),
    reviewSession: { ...session, phase: "rated" },
  };
}

export function nextReview(study: Study): Study {
  const s = study.reviewSession;
  if (!s || s.phase !== "rated") return study;
  return {
    ...study,
    reviewSession:
      s.index + 1 === s.ids.length
        ? { ...s, phase: "complete" }
        : { ...s, index: s.index + 1, phase: "question" },
  };
}

export function readStudy(raw: string): Study | null {
  try {
    const s = JSON.parse(raw) as Study;
    if (
      !s ||
      s.schemaVersion !== 1 ||
      (s.contentRevision !== legacyRevision &&
        s.contentRevision !== contentRevision) ||
      !readPractice(JSON.stringify(s.practice))
    )
      return null;
    // Validate every restored field before it can enter the rendered UI or scheduler.
    if (
      !Array.isArray(s.privateCards) ||
      s.privateCards.length > 2000 ||
      !s.privateCards.every(
        (c) =>
          c &&
          typeof c.id === "string" &&
          /^private:[0-9a-f-]{36}$/.test(c.id) &&
          typeof c.title === "string" &&
          c.title.length > 0 &&
          c.title.length <= 160 &&
          typeof c.prompt === "string" &&
          c.prompt.length > 0 &&
          c.prompt.length <= 10000 &&
          typeof c.explanation === "string" &&
          c.explanation.length > 0 &&
          c.explanation.length <= 20000 &&
          ["System design", "Algorithms"].includes(c.topic) &&
          Number.isFinite(Date.parse(c.updatedAt)),
      )
    )
      return null;
    if (new Set(s.privateCards.map((c) => c.id)).size !== s.privateCards.length)
      return null;
    if (
      !s.schedules ||
      Array.isArray(s.schedules) ||
      typeof s.schedules !== "object" ||
      !Object.entries(s.schedules).every(
        ([id, card]) =>
          findItem(s, id) && validSchedule(card) && card.cardId === id,
      )
    )
      return null;
    if (
      !Array.isArray(s.reviews) ||
      !s.reviews.every(
        (e) =>
          e &&
          typeof e.id === "string" &&
          findItem(s, e.itemId) &&
          grades.includes(e.grade) &&
          Number.isFinite(Date.parse(e.at)) &&
          typeof e.day === "string" &&
          typeof e.wasNew === "boolean" &&
          e.scheduler === "FSRS-6/ts-fsrs-6.0.0" &&
          e.log &&
          e.log.cardId === e.itemId &&
          e.log.rating === grades.indexOf(e.grade) + 1 &&
          e.log.reviewTime === e.at,
      )
    )
      return null;
    if (new Set(s.reviews.map((e) => e.id)).size !== s.reviews.length)
      return null;
    if (
      !s.notes ||
      Array.isArray(s.notes) ||
      typeof s.notes !== "object" ||
      !Object.entries(s.notes).every(
        ([id, note]) =>
          findItem(s, id) && typeof note === "string" && note.length <= 10000,
      )
    )
      return null;
    studyDay(new Date(), s.timeZone);
    if (typeof s.timeZone !== "string") return null;
    const r = s.reviewSession;
    if (
      r !== null &&
      (!r ||
        !Array.isArray(r.ids) ||
        !r.ids.length ||
        new Set(r.ids).size !== r.ids.length ||
        !r.ids.every(
          (id) => findItem(s, id) && (!questions[id] || s.schedules[id]),
        ) ||
        !Number.isInteger(r.index) ||
        r.index < 0 ||
        r.index >= r.ids.length ||
        !["question", "feedback", "rated", "complete"].includes(r.phase) ||
        (r.phase === "complete" && r.index !== r.ids.length - 1) ||
        !r.ids
          .slice(0, r.index + (["rated", "complete"].includes(r.phase) ? 1 : 0))
          .every(
            (id) => s.schedules[id] && s.reviews.some((e) => e.itemId === id),
          ))
    )
      return null;
    return {
      ...s,
      contentRevision,
      practice: readPractice(JSON.stringify(s.practice))!,
    };
  } catch {
    return null;
  }
}

export function backup(study: Study) {
  return JSON.stringify(
    {
      format: "interview-practice-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      study,
    },
    null,
    2,
  );
}

export function readBackup(raw: string): Study | null {
  try {
    const b = JSON.parse(raw);
    return b.format === "interview-practice-backup" && b.version === 1
      ? readStudy(JSON.stringify(b.study))
      : null;
  } catch {
    return null;
  }
}
