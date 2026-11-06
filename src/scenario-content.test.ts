import assert from "node:assert/strict";
import { test } from "node:test";
import { rootQuestionId } from "./content.ts";
import {
  scenarioQuestions as questions,
  scenarioRevision,
  scenarioVariants,
} from "./scenario-content.ts";
import {
  advance,
  currentQuestion,
  initialPractice,
  newSession,
  questionWeight,
  rate,
  readPractice,
  restart,
  reveal,
} from "./session.ts";
import type { SavedPractice, Session } from "./session.ts";
import { schedule } from "./scheduler.ts";

function finish(practice: SavedPractice, random = () => 0): SavedPractice {
  while (practice.session.phase !== "complete") {
    practice = advance(
      { ...practice, session: rate(reveal(practice.session), "Good") },
      random,
    );
  }
  return practice;
}

test("both authored variants have nine coherent, fully reachable questions", () => {
  const visited = new Set<string>();
  for (const variant of scenarioVariants) {
    const before = visited.size;
    function visit(id: string) {
      assert.ok(!visited.has(id), `Duplicate or cyclic question: ${id}`);
      visited.add(id);
      const q = questions[id]!;
      assert.equal(q.id, id);
      assert.ok(
        q.title &&
          q.prompt &&
          q.explanation &&
          q.alternatives &&
          q.pitfall &&
          q.difficulty,
      );
      assert.ok(
        q.givens.length >= 3 && q.rubric.length >= 3 && q.sources.length > 0,
      );
      assert.ok(q.children.length === 0 || q.children.length >= 2);
      assert.ok(q.sources.every((s) => new URL(s.url).protocol === "https:"));
      for (const [phase, frame] of [
        ["question", q.questionFrame],
        ["answer", q.answerFrame],
      ] as const) {
        const ids = new Set(frame.components.map((c) => c.id));
        assert.equal(ids.size, frame.components.length);
        for (const c of frame.components)
          assert.ok(Number.isFinite(c.x) && Number.isFinite(c.y));
        const edges = new Set<string>();
        for (const e of frame.connections) {
          assert.ok(ids.has(e.from) && ids.has(e.to) && e.label);
          assert.ok(!edges.has(`${e.from}-${e.to}`));
          edges.add(`${e.from}-${e.to}`);
          for (const p of e.via ?? [])
            assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
          if (e.labelAt)
            assert.ok(
              Number.isFinite(e.labelAt.x) && Number.isFinite(e.labelAt.y),
            );
        }
        assert.ok(q.focus && q.focus.label);
        const focus = q.focus[phase];
        assert.ok(
          focus.length >= 2 &&
            focus.length <= 4 &&
            new Set(focus).size === focus.length,
        );
        assert.ok(
          focus.every((id) => ids.has(id)),
          `${q.id} ${phase} focus leaks a component`,
        );
      }
      for (const old of q.questionFrame.components) {
        const next = q.answerFrame.components.find((c) => c.id === old.id)!;
        assert.ok(next, `${q.id} unexpectedly removes ${old.id}`);
        assert.deepEqual([next.x, next.y], [old.x, old.y]);
      }
      for (const child of q.children) {
        assert.deepEqual(
          questions[child]!.questionFrame,
          q.answerFrame,
          `${child} changes the baseline`,
        );
        visit(child);
      }
    }
    visit(variant.root);
    assert.equal(visited.size - before, 9);
  }
  assert.equal(visited.size, 18);
  assert.equal(visited.size, Object.keys(questions).length);
});

test("weighted draws favor unseen, due and weak valid follow-ups", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  const [seen, unseen, weak] = questions[rootQuestionId]!.children;
  const seenCard = schedule(undefined, seen!, "Easy", now).card;
  const weakCard = schedule(
    undefined,
    weak!,
    "Again",
    new Date(now.getTime() - 86400000),
  ).card;
  const selection = {
    now,
    schedules: { [seen!]: seenCard, [weak!]: weakCard },
    lastGrades: { [weak!]: "Again" as const },
  };
  assert.ok(
    questionWeight(unseen!, selection) > questionWeight(seen!, selection),
  );
  assert.ok(
    questionWeight(weak!, selection) > questionWeight(unseen!, selection),
  );
  assert.ok(
    questionWeight(weak!, selection) >
      questionWeight(weak!, { ...selection, lastGrades: {} }),
  );
  const practice = initialPractice();
  practice.session = rate(reveal(practice.session), "Good");
  const counts: Record<string, number> = {};
  for (let i = 0; i < 1000; i++) {
    const next = advance(practice, { ...selection, random: () => i / 1000 });
    const id = currentQuestion(next.session).id;
    assert.ok(questions[rootQuestionId]!.children.includes(id));
    counts[id] = (counts[id] ?? 0) + 1;
    assert.deepEqual(Object.keys(next.session.ratings), [rootQuestionId]);
  }
  assert.ok(
    counts[weak!]! > counts[unseen!]! && counts[unseen!]! > counts[seen!]!,
  );
  for (const draw of [NaN, -1, 1, Infinity]) {
    assert.ok(
      questions[rootQuestionId]!.children.includes(
        currentQuestion(advance(practice, () => draw).session).id,
      ),
    );
  }
});

test("repeat sessions alternate starting variants and avoid the previous path for each", () => {
  let practice = initialPractice();
  const lastPaths = new Map<string, string[]>();
  let lastRoot = "";
  for (let i = 0; i < 8; i++) {
    if (i) practice = restart(practice, { random: () => 0 });
    assert.equal(practice.session.revision, scenarioRevision);
    const root = practice.session.path[0]!;
    assert.notEqual(root, lastRoot);
    const previous = lastPaths.get(root);
    practice = finish(practice);
    if (previous) assert.notDeepEqual(practice.session.path, previous);
    lastPaths.set(root, practice.session.path);
    lastRoot = root;
    assert.equal(practice.history.length, i + 1);
    assert.deepEqual(readPractice(JSON.stringify(practice)), practice);
  }
});

test("deeper alternatives avoid a previous continuation while keeping its assumptions", () => {
  const previous = finish(initialPractice()); // lunch rush, then menu cache
  assert.equal(previous.session.path.at(-1), "delivery-menu-cache");
  const resumed = {
    ...previous,
    session: {
      ...newSession(),
      path: [rootQuestionId, "delivery-lunch-rush"],
      phase: "rated" as const,
      ratings: {
        [rootQuestionId]: "Good" as const,
        "delivery-lunch-rush": "Hard" as const,
      },
    },
  };
  const next = advance(resumed, () => 0);
  assert.equal(currentQuestion(next.session).id, "delivery-receipt-queue");
  assert.deepEqual(
    currentQuestion(next.session).questionFrame,
    questions["delivery-lunch-rush"]!.answerFrame,
  );
  assert.deepEqual(readPractice(JSON.stringify(next)), next);
});

test("a four-question session resumes every phase and never rerolls a selected question", () => {
  let practice = {
    ...initialPractice(),
    session: newSession("delivery-preorder-start"),
  };
  for (const id of [
    "delivery-preorder-start",
    "delivery-inventory-race",
    "delivery-hold-expiry",
    "delivery-expiry-retry",
  ]) {
    assert.equal(currentQuestion(practice.session).id, id);
    practice.session.notes[id] = `Reasoning for ${id}`;
    const steps: ((s: Session) => Session)[] = [
      (s) => s,
      reveal,
      (s) => rate(s, "Hard"),
    ];
    for (const transform of steps) {
      practice.session = transform(practice.session);
      const loaded = readPractice(JSON.stringify(practice))!;
      assert.deepEqual(loaded, practice);
      assert.deepEqual(loaded.session.path, practice.session.path);
    }
    practice = advance(practice, () => 0);
  }
  assert.equal(practice.session.phase, "complete");
  assert.equal(Object.keys(practice.session.ratings).length, 4);
  assert.equal(practice.history.length, 1);
  assert.equal(advance(practice), practice);
});

test("revision checks reject future content and paths from a different tree", () => {
  const initial = initialPractice();
  for (const session of [
    { ...newSession(), revision: "future" },
    {
      ...newSession(),
      path: [rootQuestionId, "delivery-inventory-race"],
      ratings: { [rootQuestionId]: "Good" },
    },
    {
      ...newSession(),
      revision: "2026-11-05.1",
      path: [rootQuestionId, "delivery-lunch-rush", "delivery-menu-cache"],
      ratings: { [rootQuestionId]: "Good", "delivery-lunch-rush": "Good" },
    },
  ])
    assert.equal(readPractice(JSON.stringify({ ...initial, session })), null);
});
