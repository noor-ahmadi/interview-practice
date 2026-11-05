import { grades, questions, rootQuestionId } from "./content.ts";
import type { Grade } from "./content.ts";

export const storageKey = "interview-practice:v1";
export type Session = {
  path: string[];
  phase: "question" | "feedback" | "rated" | "complete";
  notes: Record<string, string>;
  ratings: Record<string, Grade>;
};
export type SavedPractice = {
  version: 1;
  session: Session;
  lastFollowup: string | null;
};

export function newSession(): Session {
  return { path: [rootQuestionId], phase: "question", notes: {}, ratings: {} };
}

export function initialPractice(): SavedPractice {
  return { version: 1, session: newSession(), lastFollowup: null };
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
  if (!children.length)
    return { ...practice, session: { ...session, phase: "complete" } };
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

// Reject incompatible or malformed saves rather than resuming an invalid path or revealing feedback early.
export function readPractice(raw: string | null): SavedPractice | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    const session = value?.session;
    if (
      value.version !== 1 ||
      !session ||
      !Array.isArray(session.path) ||
      session.path[0] !== rootQuestionId ||
      session.path.length > Object.keys(questions).length
    )
      return null;
    if (!["question", "feedback", "rated", "complete"].includes(session.phase))
      return null;
    if (
      !session.notes ||
      Array.isArray(session.notes) ||
      typeof session.notes !== "object" ||
      !session.ratings ||
      Array.isArray(session.ratings) ||
      typeof session.ratings !== "object"
    )
      return null;
    for (let i = 0; i < session.path.length; i++) {
      const id = session.path[i];
      if (typeof id !== "string" || !Object.hasOwn(questions, id)) return null;
      if (i > 0 && !questions[session.path[i - 1]]!.children.includes(id))
        return null;
      if (i < session.path.length - 1 && !grades.includes(session.ratings[id]))
        return null;
    }
    const visited = new Set(session.path);
    if (
      Object.entries(session.notes).some(
        ([id, note]) =>
          !visited.has(id) || typeof note !== "string" || note.length > 10000,
      )
    )
      return null;
    if (
      Object.entries(session.ratings).some(
        ([id, grade]) => !visited.has(id) || !grades.includes(grade as Grade),
      )
    )
      return null;
    const last = currentQuestion(session);
    if (
      ["rated", "complete"].includes(session.phase) &&
      !grades.includes(session.ratings[last.id])
    )
      return null;
    if (
      ["question", "feedback"].includes(session.phase) &&
      session.ratings[last.id]
    )
      return null;
    if (session.phase === "complete" && last.children.length) return null;
    if (
      value.lastFollowup !== null &&
      !questions[rootQuestionId]!.children.includes(value.lastFollowup)
    )
      return null;
    return value as SavedPractice;
  } catch {
    return null;
  }
}
