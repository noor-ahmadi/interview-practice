import {
  grades,
  questions as legacyQuestions,
  rootQuestionId,
} from "./content.ts";
import type { Grade } from "./content.ts";
import {
  legacyRevision,
  questionsForRevision,
  scenarioQuestions,
  scenarioRevision,
  scenarioVariants,
  supportedRevisions,
} from "./scenario-content.ts";
import type { Family, ScenarioRevision } from "./scenario-content.ts";
import type { ScheduledCard } from "./scheduler.ts";

// Keep the existing key so earlier saves can migrate in place.
export const storageKey = "interview-practice:v1";
export type Session = {
  revision: ScenarioRevision;
  path: string[];
  phase: "question" | "feedback" | "rated" | "complete";
  notes: Record<string, string>;
  ratings: Record<string, Grade>;
};
export type SavedPractice = {
  version: 4;
  session: Session;
  lastFollowup: string | null;
  history: Session[];
  paused: Session[];
};
export type Selection = {
  random?: () => number;
  now?: Date;
  schedules?: Record<string, ScheduledCard>;
  lastGrades?: Record<string, Grade>;
};

export function newSession(
  root: string = rootQuestionId,
  revision: ScenarioRevision = scenarioRevision,
): Session {
  return { revision, path: [root], phase: "question", notes: {}, ratings: {} };
}

export function initialPractice(): SavedPractice {
  return {
    version: 4,
    session: newSession(),
    lastFollowup: null,
    history: [],
    paused: [],
  };
}

export function getQuestion(session: Session, id: string) {
  return questionsForRevision(session.revision)[id]!;
}
export function currentQuestion(session: Session) {
  return getQuestion(session, session.path.at(-1)!);
}
export function currentVariant(session: Session) {
  return scenarioVariants.find((v) => v.root === session.path[0])!;
}

export function questionWeight(
  id: string,
  { schedules = {}, lastGrades = {}, now = new Date() }: Selection,
): number {
  const card = schedules[id];
  if (!card) return 5;
  const overdue = Math.max(
    0,
    (now.getTime() - Date.parse(card.dueAt)) / 86400000,
  );
  const due =
    Date.parse(card.dueAt) <= now.getTime() ? 4 + Math.min(overdue, 7) : 1;
  const weak =
    lastGrades[id] === "Again" ? 3 : lastGrades[id] === "Hard" ? 2 : 1;
  return due * weak * (1 + card.difficulty / 10);
}

function choose(ids: string[], selection: Selection): string {
  const weights = ids.map((id) => questionWeight(id, selection));
  const draw = (selection.random ?? Math.random)();
  const unit = Number.isFinite(draw)
    ? Math.min(Math.max(draw, 0), 0.999999999)
    : 0;
  let cursor = unit * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < ids.length; i++) {
    cursor -= weights[i]!;
    if (cursor < 0) return ids[i]!;
  }
  return ids.at(-1)!;
}

export function restart(
  practice: SavedPractice,
  selection: Selection = {},
): SavedPractice {
  if (practice.session.phase !== "complete") return practice;
  const roots = scenarioVariants
    .filter((v) => v.family === currentVariant(practice.session).family)
    .map((v) => v.root);
  const alternatives = roots.filter((id) => id !== practice.session.path[0]);
  return {
    ...practice,
    session: newSession(
      choose(alternatives.length ? alternatives : roots, selection),
    ),
  };
}

export function switchFamily(
  practice: SavedPractice,
  family: Family,
  selection: Selection = {},
): SavedPractice {
  if (currentVariant(practice.session).family === family) return practice;
  const saved = practice.paused.find(
    (s) => currentVariant(s).family === family,
  );
  const paused = practice.paused.filter((s) => s !== saved);
  if (practice.session.phase !== "complete") paused.push(practice.session);
  const previous = practice.history.findLast(
    (s) => currentVariant(s).family === family,
  );
  const roots = scenarioVariants
    .filter((v) => v.family === family)
    .map((v) => v.root);
  const alternatives = roots.filter((id) => id !== previous?.path[0]);
  return {
    ...practice,
    paused,
    session:
      saved ??
      newSession(choose(alternatives.length ? alternatives : roots, selection)),
  };
}

export function reveal(session: Session): Session {
  return session.phase === "question"
    ? { ...session, phase: "feedback" }
    : session;
}

export function rate(session: Session, grade: Grade): Session {
  if (session.phase !== "feedback" || !grades.includes(grade)) return session;
  return {
    ...session,
    phase: "rated",
    ratings: { ...session.ratings, [currentQuestion(session).id]: grade },
  };
}

export function advance(
  practice: SavedPractice,
  options: Selection | (() => number) = {},
): SavedPractice {
  const selection =
    typeof options === "function" ? { random: options } : options;
  const { session } = practice;
  if (session.phase !== "rated") return practice;
  const children = currentQuestion(session).children;
  if (!children.length) {
    const completed: Session = { ...session, phase: "complete" };
    return {
      ...practice,
      session: completed,
      history: [...practice.history, completed],
    };
  }
  const previous = practice.history.findLast(
    (s) => s.path[0] === session.path[0],
  );
  const followsPrevious =
    previous && session.path.every((id, i) => previous.path[i] === id);
  const previousNext = followsPrevious
    ? previous.path[session.path.length]
    : session.path.length === 1
      ? practice.lastFollowup
      : null;
  const alternatives = children.filter((id) => id !== previousNext);
  const next = choose(alternatives.length ? alternatives : children, selection);
  return {
    ...practice,
    lastFollowup: next,
    session: { ...session, path: [...session.path, next], phase: "question" },
  };
}

function parseSession(value: unknown, legacy: boolean): Session | null {
  if (!value || typeof value !== "object") return null;
  const s = value as Session;
  const revision = legacy ? legacyRevision : s.revision;
  if (!supportedRevisions.includes(revision)) return null;
  const bank = questionsForRevision(revision);
  const roots: string[] =
    revision === legacyRevision
      ? [rootQuestionId]
      : scenarioVariants
          .filter((v) => Object.hasOwn(bank, v.root))
          .map((v) => v.root);
  if (
    !Array.isArray(s.path) ||
    !roots.includes(s.path[0]!) ||
    s.path.length > Object.keys(bank).length
  )
    return null;
  if (!["question", "feedback", "rated", "complete"].includes(s.phase))
    return null;
  if (
    !s.notes ||
    Array.isArray(s.notes) ||
    typeof s.notes !== "object" ||
    !s.ratings ||
    Array.isArray(s.ratings) ||
    typeof s.ratings !== "object"
  )
    return null;
  for (let i = 0; i < s.path.length; i++) {
    const id = s.path[i]!;
    if (typeof id !== "string" || !Object.hasOwn(bank, id)) return null;
    if (i > 0 && !bank[s.path[i - 1]!]!.children.includes(id)) return null;
    if (i < s.path.length - 1 && !grades.includes(s.ratings[id]!)) return null;
  }
  const visited = new Set(s.path);
  if (
    Object.entries(s.notes).some(
      ([id, text]) =>
        !visited.has(id) || typeof text !== "string" || text.length > 10000,
    )
  )
    return null;
  if (
    Object.entries(s.ratings).some(
      ([id, grade]) => !visited.has(id) || !grades.includes(grade),
    )
  )
    return null;
  const last = bank[s.path.at(-1)!]!;
  if (
    ["rated", "complete"].includes(s.phase) &&
    !grades.includes(s.ratings[last.id]!)
  )
    return null;
  if (["question", "feedback"].includes(s.phase) && s.ratings[last.id])
    return null;
  if (s.phase === "complete" && last.children.length) return null;
  return {
    revision,
    path: s.path,
    phase: s.phase,
    notes: s.notes,
    ratings: s.ratings,
  };
}

// Old sessions retain their original tree; adding follow-ups never reopens an old completion.
export function readPractice(raw: string | null): SavedPractice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || ![1, 2, 3, 4].includes(value.version)) return null;
    const session = parseSession(value.session, value.version < 3);
    if (!session) return null;
    const bank = value.version < 3 ? legacyQuestions : scenarioQuestions;
    if (
      value.lastFollowup !== null &&
      (typeof value.lastFollowup !== "string" ||
        !Object.hasOwn(bank, value.lastFollowup) ||
        scenarioVariants.some((v) => v.root === value.lastFollowup))
    )
      return null;
    const oldHistory =
      value.version === 1
        ? session.phase === "complete"
          ? [session]
          : []
        : value.history;
    if (!Array.isArray(oldHistory)) return null;
    const history: Session[] = [];
    for (const rawSession of oldHistory) {
      const past = parseSession(rawSession, value.version < 3);
      if (!past || past.phase !== "complete") return null;
      history.push(past);
    }
    const paused: Session[] = [];
    const families = new Set([currentVariant(session).family]);
    if (value.version === 4) {
      if (!Array.isArray(value.paused)) return null;
      for (const rawSession of value.paused) {
        const saved = parseSession(rawSession, false);
        if (
          !saved ||
          saved.phase === "complete" ||
          families.has(currentVariant(saved).family)
        )
          return null;
        families.add(currentVariant(saved).family);
        paused.push(saved);
      }
    }
    return {
      version: 4,
      session,
      lastFollowup: value.lastFollowup,
      history,
      paused,
    };
  } catch {
    return null;
  }
}
