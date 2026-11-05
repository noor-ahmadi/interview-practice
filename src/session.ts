import { grades, questions, rootQuestionId } from "./content.ts";
import type { Grade } from "./content.ts";

// Keep the existing key so earlier saves can migrate in place.
export const storageKey = "interview-practice:v1";
export type Session = {
  path: string[];
  phase: "question" | "feedback" | "rated" | "complete";
  notes: Record<string, string>;
  ratings: Record<string, Grade>;
};
export type SavedPractice = {
  version: 2;
  session: Session;
  lastFollowup: string | null;
  history: Session[];
};

export function newSession(): Session {
  return { path: [rootQuestionId], phase: "question", notes: {}, ratings: {} };
}

export function initialPractice(): SavedPractice {
  return { version: 2, session: newSession(), lastFollowup: null, history: [] };
}

export function restart(practice: SavedPractice): SavedPractice {
  if (practice.session.phase !== "complete") return practice;
  return {
    ...practice,
    session: newSession(),
  };
}

export function currentQuestion(session: Session) {
  return questions[session.path.at(-1)!]!;
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
  random = Math.random,
): SavedPractice {
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
  const alternatives = children.filter((id) => id !== practice.lastFollowup);
  const pool = alternatives.length ? alternatives : children;
  const next =
    pool[Math.floor(Math.min(Math.max(random(), 0), 0.999999) * pool.length)]!;
  return {
    ...practice,
    lastFollowup: next,
    session: { ...session, path: [...session.path, next], phase: "question" },
  };
}

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== "object") return false;
  const session = value as Session;
  if (
    !Array.isArray(session.path) ||
    session.path[0] !== rootQuestionId ||
    session.path.length > Object.keys(questions).length
  )
    return false;
  if (!["question", "feedback", "rated", "complete"].includes(session.phase))
    return false;
  if (
    !session.notes ||
    Array.isArray(session.notes) ||
    typeof session.notes !== "object" ||
    !session.ratings ||
    Array.isArray(session.ratings) ||
    typeof session.ratings !== "object"
  )
    return false;
  for (let i = 0; i < session.path.length; i++) {
    const id = session.path[i];
    if (typeof id !== "string" || !Object.hasOwn(questions, id)) return false;
    if (i > 0 && !questions[session.path[i - 1]]!.children.includes(id))
      return false;
    if (i < session.path.length - 1 && !grades.includes(session.ratings[id]))
      return false;
  }
  const visited = new Set(session.path);
  if (
    Object.entries(session.notes).some(
      ([id, note]) =>
        !visited.has(id) || typeof note !== "string" || note.length > 10000,
    )
  )
    return false;
  if (
    Object.entries(session.ratings).some(
      ([id, grade]) => !visited.has(id) || !grades.includes(grade as Grade),
    )
  )
    return false;
  const last = currentQuestion(session);
  if (
    ["rated", "complete"].includes(session.phase) &&
    !grades.includes(session.ratings[last.id])
  )
    return false;
  if (
    ["question", "feedback"].includes(session.phase) &&
    session.ratings[last.id]
  )
    return false;
  if (session.phase === "complete" && last.children.length) return false;
  return true;
}

// Validate active and completed paths before showing any saved question or answer.
export function readPractice(raw: string | null): SavedPractice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || ![1, 2].includes(value.version) || !isSession(value.session))
      return null;
    if (
      value.lastFollowup !== null &&
      !questions[rootQuestionId]!.children.includes(value.lastFollowup)
    )
      return null;
    const history =
      value.version === 1
        ? value.session.phase === "complete"
          ? [value.session]
          : []
        : value.history;
    if (
      !Array.isArray(history) ||
      !history.every(
        (session) => isSession(session) && session.phase === "complete",
      )
    )
      return null;
    return {
      version: 2,
      session: value.session,
      lastFollowup: value.lastFollowup,
      history,
    };
  } catch {
    return null;
  }
}
