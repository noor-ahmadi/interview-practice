import { recallCards } from "./cards.ts";
import type { PrivateCard } from "./cards.ts";
import { codingProblemIds } from "./coding-content.ts";
import { grades } from "./content.ts";
import {
  supportedRevisions,
  scenarioQuestions as questions,
  scenarioRevision,
} from "./scenario-content.ts";
import type { Grade } from "./content.ts";
import { initialPractice, rate, readPractice } from "./session.ts";
import type { SavedPractice, Session } from "./session.ts";
import { rollback, schedule, validSchedule } from "./scheduler.ts";
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
  ratingId?: string;
};
export const dailyNewLimits = [0, 5, 10, 15];
export type Study = {
  schemaVersion: 1;
  contentRevision: string;
  practice: SavedPractice;
  privateCards: PrivateCard[];
  schedules: Record<string, ScheduledCard>;
  reviews: ReviewEvent[];
  reviewSession: ReviewSession | null;
  drill?: { ids: string[]; index: number; revealed: boolean };
  codingDone?: number[];
  newCardsPerDay?: number;
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
    .slice(0, Math.max(0, (study.newCardsPerDay ?? 5) - introduced))
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

export function deletePrivateCard(study: Study, id: string): Study {
  if (!study.privateCards.some((card) => card.id === id)) return study;
  const { [id]: _schedule, ...schedules } = study.schedules;
  const { [id]: _note, ...notes } = study.notes;
  let reviewSession = study.reviewSession;
  const removed = reviewSession?.ids.indexOf(id) ?? -1;
  if (reviewSession && removed >= 0) {
    const { index } = reviewSession;
    const ids = reviewSession.ids.filter((item) => item !== id);
    if (!ids.length) reviewSession = null;
    else if (removed === index) {
      reviewSession = {
        ids,
        index: Math.min(index, ids.length - 1),
        phase: index === ids.length ? "complete" : "question",
      };
    } else {
      reviewSession = {
        ...reviewSession,
        ids,
        index: index - Number(removed < index),
      };
    }
  }
  return {
    ...study,
    privateCards: study.privateCards.filter((card) => card.id !== id),
    schedules,
    notes,
    reviewSession,
    reviews: study.reviews.filter((event) => event.itemId !== id),
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
    !eventId ||
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
  const itemId = before.path.at(-1)!;
  const previous =
    before.phase === "rated"
      ? openRating(study, itemId, before.ratingId)
      : undefined;
  const updated = previous
    ? amendRating(study, previous.id, grade)
    : recordRating(study, itemId, grade, now, eventId);
  if (updated === study) return study;
  return {
    ...updated,
    practice: {
      ...study.practice,
      session: { ...after, ratingId: previous?.id ?? eventId },
    },
  };
}

export function rateReview(
  study: Study,
  grade: Grade,
  now: Date,
  eventId: string,
): Study {
  const session = study.reviewSession;
  if (!session || !["feedback", "rated"].includes(session.phase)) return study;
  const itemId = session.ids[session.index]!;
  const previous =
    session.phase === "rated"
      ? openRating(study, itemId, session.ratingId)
      : undefined;
  const updated = previous
    ? amendRating(study, previous.id, grade)
    : recordRating(study, itemId, grade, now, eventId);
  if (updated === study) return study;
  return {
    ...updated,
    reviewSession: {
      ...session,
      phase: "rated",
      ratingId: previous?.id ?? eventId,
    },
  };
}

export function nextReview(study: Study): Study {
  const s = study.reviewSession;
  if (!s || s.phase !== "rated") return study;
  const { ratingId: _ratingId, ...finished } = s;
  return {
    ...study,
    reviewSession:
      s.index + 1 === s.ids.length
        ? { ...finished, phase: "complete" }
        : { ...finished, index: s.index + 1, phase: "question" },
  };
}

export function openRating(study: Study, itemId: string, ratingId?: string) {
  return ratingId !== undefined
    ? study.reviews.find(
        (event) => event.id === ratingId && event.itemId === itemId,
      )
    : undefined;
}

function amendRating(study: Study, eventId: string, grade: Grade): Study {
  const index = study.reviews.findIndex((event) => event.id === eventId);
  const event = study.reviews[index];
  if (!event || !grades.includes(grade) || event.grade === grade) return study;
  const current = study.schedules[event.itemId];
  if (!current) return study;
  const tail = study.reviews
    .slice(index)
    .filter((review) => review.itemId === event.itemId);
  // Rewind the item's later reviews and replay them at their original times.
  let card = tail.reduceRight(
    (card, review) => rollback(card, review.log),
    current,
  );
  const amended = new Map<string, ReviewEvent>();
  for (const review of tail) {
    const choice = review.id === eventId ? grade : review.grade;
    const result = schedule(card, event.itemId, choice, new Date(review.at));
    card = result.card;
    amended.set(review.id, { ...review, grade: choice, log: result.log });
  }
  return {
    ...study,
    schedules: { ...study.schedules, [event.itemId]: card },
    reviews: study.reviews.map((review) => amended.get(review.id) ?? review),
  };
}

export function ratingOptions(
  study: Study,
  itemId: string,
  review?: ReviewEvent,
) {
  const now = new Date();
  return grades.map((grade) => ({
    grade,
    dueAt: review
      ? amendRating(study, review.id, grade).schedules[itemId]!.dueAt
      : schedule(study.schedules[itemId], itemId, grade, now).card.dueAt,
  }));
}

export function readStudy(raw: string): Study | null {
  try {
    const s = JSON.parse(raw) as Study;
    if (
      !s ||
      s.schemaVersion !== 1 ||
      !supportedRevisions.includes(s.contentRevision)
    )
      return null;
    const practice = readPractice(JSON.stringify(s.practice));
    if (!practice) return null;
    const drill = s.drill;
    if (
      (s.newCardsPerDay !== undefined &&
        !dailyNewLimits.includes(s.newCardsPerDay)) ||
      (s.codingDone !== undefined &&
        (!Array.isArray(s.codingDone) ||
          s.codingDone.some((id) => !codingProblemIds.has(id)) ||
          new Set(s.codingDone).size !== s.codingDone.length)) ||
      (drill !== undefined &&
        (!drill ||
          !Array.isArray(drill.ids) ||
          new Set(drill.ids).size !== drill.ids.length ||
          drill.ids.some((id) => !recallCards.some((card) => card.id === id)) ||
          !Number.isInteger(drill.index) ||
          drill.index < 0 ||
          drill.index >= drill.ids.length ||
          typeof drill.revealed !== "boolean"))
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
          e.id.length > 0 &&
          findItem(s, e.itemId) &&
          s.schedules[e.itemId] &&
          grades.includes(e.grade) &&
          Number.isFinite(Date.parse(e.at)) &&
          typeof e.day === "string" &&
          typeof e.wasNew === "boolean" &&
          e.scheduler === "FSRS-6/ts-fsrs-6.0.0" &&
          e.log &&
          e.log.cardId === e.itemId &&
          e.log.rating === grades.indexOf(e.grade) + 1 &&
          e.log.reviewTime === e.at &&
          validSchedule({ ...e.log, reps: 0, lapses: 0 }),
      )
    )
      return null;
    if (new Set(s.reviews.map((e) => e.id)).size !== s.reviews.length)
      return null;
    const openSessions = [practice.session, ...practice.paused];
    const claimed = new Set<string>();
    for (const session of openSessions) {
      if (session.ratingId !== undefined) {
        const event = openRating(s, session.path.at(-1)!, session.ratingId);
        if (
          !event ||
          event.grade !== session.ratings[event.itemId] ||
          claimed.has(event.id)
        )
          return null;
        claimed.add(event.id);
      }
    }
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
        (r.ratingId !== undefined &&
          (typeof r.ratingId !== "string" ||
            r.phase !== "rated" ||
            claimed.has(r.ratingId) ||
            !openRating(s, r.ids[r.index]!, r.ratingId))) ||
        !r.ids
          .slice(0, r.index + (["rated", "complete"].includes(r.phase) ? 1 : 0))
          .every(
            (id) => s.schedules[id] && s.reviews.some((e) => e.itemId === id),
          ))
    )
      return null;

    // Earlier saves had only the selected grade. Bind an open legacy rating to
    // its latest matching event so future reviews cannot take its place.
    if (r?.ratingId) claimed.add(r.ratingId);
    const legacyEvent = (itemId: string, grade?: Grade) => {
      const event = s.reviews.findLast(
        (event) =>
          event.itemId === itemId &&
          !claimed.has(event.id) &&
          (grade === undefined || grade === event.grade),
      );
      if (event) claimed.add(event.id);
      return event?.id;
    };
    const bindLegacy = (session: Session): Session => {
      if (session.phase !== "rated" || session.ratingId) return session;
      const itemId = session.path.at(-1)!;
      const ratingId = legacyEvent(itemId, session.ratings[itemId]);
      return ratingId ? { ...session, ratingId } : session;
    };
    const dailyId =
      r?.phase === "rated" && !r.ratingId
        ? legacyEvent(r.ids[r.index]!)
        : undefined;
    return {
      ...s,
      contentRevision,
      practice: {
        ...practice,
        session: bindLegacy(practice.session),
        paused: practice.paused.map(bindLegacy),
      },
      reviewSession: r && dailyId ? { ...r, ratingId: dailyId } : r,
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
