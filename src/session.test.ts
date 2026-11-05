import assert from "node:assert/strict";
import { test } from "node:test";
import { grades, questions, rootQuestionId } from "./content.ts";
import {
  advance,
  currentQuestion,
  initialPractice,
  newSession,
  rate,
  readPractice,
  reveal,
} from "./session.ts";

test("an answer must be revealed and rated before advancing", () => {
  const practice = initialPractice();
  assert.equal(rate(practice.session, "Good"), practice.session);
  assert.equal(advance(practice), practice);
  const feedback = reveal(practice.session);
  assert.equal(advance({ ...practice, session: feedback }).session, feedback);
  const rated = rate(feedback, "Good");
  assert.equal(rated.ratings[rootQuestionId], "Good");
  assert.equal(rate(rated, "Again"), rated);
  assert.equal(reveal(rated), rated);
  assert.equal(
    advance({ ...practice, session: rated }, () => 0).session.phase,
    "question",
  );
});

test("all follow-ups can be selected without exposing siblings in the path", () => {
  const initial = initialPractice();
  const practice = {
    ...initial,
    session: rate(reveal(initial.session), "Hard"),
  };
  const selected = new Set<string>();
  for (const value of [0, 0.4, 0.99]) {
    const next = advance(practice, () => value);
    assert.equal(next.session.path.length, 2);
    assert.equal(next.session.phase, "question");
    assert.deepEqual(Object.keys(next.session.ratings), [rootQuestionId]);
    selected.add(currentQuestion(next.session).id);
  }
  assert.deepEqual([...selected], questions[rootQuestionId]!.children);
});

test("a new session avoids the last follow-up when alternatives exist", () => {
  let practice = initialPractice();
  let previous: string | null = null;
  for (let i = 0; i < 12; i++) {
    practice.session = rate(reveal(newSession()), "Good");
    practice = advance(practice, () => (i % 2 ? 0.99 : 0));
    assert.notEqual(currentQuestion(practice.session).id, previous);
    previous = currentQuestion(practice.session).id;
  }
});

test("completion preserves notes and independent self-ratings", () => {
  let practice = initialPractice();
  practice.session = rate(reveal(practice.session), "Easy");
  practice = advance(practice, () => 0.5);
  const id = currentQuestion(practice.session).id;
  practice.session.notes[id] = "Use durable object storage.";
  practice.session = rate(reveal(practice.session), "Again");
  practice = advance(practice);
  assert.equal(practice.session.phase, "complete");
  assert.equal(practice.session.notes[id], "Use durable object storage.");
  assert.deepEqual(practice.session.ratings, {
    [rootQuestionId]: "Easy",
    [id]: "Again",
  });
});

test("save round-trips keep the exact question, notes, and reveal phase", () => {
  for (const phase of ["question", "feedback", "rated", "complete"] as const) {
    let practice = initialPractice();
    practice.session = rate(reveal(practice.session), "Good");
    practice = advance(practice, () => 0.5);
    practice.session.notes[currentQuestion(practice.session).id] =
      "My reasoning";
    if (phase !== "question") practice.session = reveal(practice.session);
    if (phase === "rated" || phase === "complete")
      practice.session = rate(practice.session, "Hard");
    if (phase === "complete") practice = advance(practice);
    assert.deepEqual(readPractice(JSON.stringify(practice)), practice);
  }
});

test("malformed, incompatible, and impossible saves are rejected", () => {
  for (const raw of [null, "", "{", "null", "{}", '{"version":2}'])
    assert.equal(readPractice(raw), null);
  const invalid = [
    { ...initialPractice(), session: { ...newSession(), path: ["__proto__"] } },
    {
      ...initialPractice(),
      session: { ...newSession(), path: [rootQuestionId, "missing"] },
    },
    { ...initialPractice(), session: { ...newSession(), phase: "complete" } },
    { ...initialPractice(), session: { ...newSession(), phase: "rated" } },
    {
      ...initialPractice(),
      session: { ...newSession(), ratings: { [rootQuestionId]: "Good" } },
    },
    {
      ...initialPractice(),
      session: { ...newSession(), notes: { "delivery-menu-photos": "unseen" } },
    },
    {
      ...initialPractice(),
      session: {
        ...newSession(),
        notes: { [rootQuestionId]: "a".repeat(10001) },
      },
    },
  ];
  for (const value of invalid)
    assert.equal(readPractice(JSON.stringify(value)), null);
});

test("content has a reachable tree and coherent frames without sibling changes", () => {
  const visited = new Set<string>();
  function visit(id: string) {
    assert.ok(!visited.has(id), `Repeated node ${id}`);
    visited.add(id);
    const question = questions[id]!;
    assert.equal(question.id, id);
    assert.ok(question.children.length === 0 || question.children.length >= 2);
    assert.ok(question.rubric.length >= 3);
    for (const source of question.sources)
      assert.equal(new URL(source.url).protocol, "https:");
    for (const frame of [question.questionFrame, question.answerFrame]) {
      const ids = new Set(frame.components.map((component) => component.id));
      assert.equal(ids.size, frame.components.length);
      for (const edge of frame.connections)
        assert.ok(ids.has(edge.from) && ids.has(edge.to));
    }
    for (const component of question.questionFrame.components) {
      const updated = question.answerFrame.components.find(
        (item) => item.id === component.id,
      )!;
      assert.deepEqual([updated.x, updated.y], [component.x, component.y]);
    }
    for (const child of question.children) {
      assert.deepEqual(questions[child]!.questionFrame, question.answerFrame);
      visit(child);
    }
  }
  visit(rootQuestionId);
  assert.equal(visited.size, Object.keys(questions).length);
  assert.equal(grades.length, 4);
});
