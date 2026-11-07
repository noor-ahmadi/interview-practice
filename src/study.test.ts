import assert from "node:assert/strict";
import { test } from "node:test";
import { recallCards } from "./cards.ts";
import { questions, rootQuestionId } from "./content.ts";
import { reveal } from "./session.ts";
import { schedule } from "./scheduler.ts";
import {
  backup,
  beginReview,
  newStudy,
  nextReview,
  queueFor,
  rateReview,
  rateScenario,
  readBackup,
  readStudy,
  recordRating,
  studyDay,
} from "./study.ts";

const now = new Date("2026-11-05T12:00:00Z");

test("FSRS uses the 90 percent preset, learning steps and all four ratings", () => {
  const again = schedule(undefined, "card", "Again", now);
  const good = schedule(undefined, "card", "Good", now);
  const easy = schedule(undefined, "card", "Easy", now);
  assert.equal(again.card.dueAt, "2026-11-05T12:01:00.000Z");
  assert.equal(good.card.dueAt, "2026-11-05T12:10:00.000Z");
  assert.equal(easy.card.dueAt, "2026-11-13T12:00:00.000Z");
  assert.equal(
    schedule(undefined, "card", "Hard", now).card.dueAt,
    "2026-11-05T12:05:30.000Z",
  );
  const graduated = schedule(
    good.card,
    "card",
    "Good",
    new Date(good.card.dueAt),
  );
  assert.equal(graduated.card.state, 2);
  assert.equal(good.card.reps, 1);
  assert.equal(graduated.card.reps, 2);
  assert.equal(graduated.log.cardId, "card");
  assert.equal(graduated.log.stability, good.card.stability);
});

test("rating a scenario schedules only that question and a duplicate cannot count twice", () => {
  let s = newStudy();
  assert.equal(rateScenario(s, "Good", now, "event"), s);
  s = {
    ...s,
    practice: { ...s.practice, session: reveal(s.practice.session) },
  };
  s = rateScenario(s, "Good", now, "event");
  assert.deepEqual(Object.keys(s.schedules), [rootQuestionId]);
  assert.equal(s.reviews.length, 1);
  for (const child of questions[rootQuestionId]!.children)
    assert.equal(s.schedules[child], undefined);
  assert.equal(rateScenario(s, "Good", now, "second-tap"), s);
  assert.equal(recordRating(s, rootQuestionId, "Good", now, "event"), s);
  const changed = rateScenario(
    s,
    "Easy",
    new Date(now.getTime() + 2000),
    "edit",
  );
  assert.equal(changed.reviews.length, 1);
  assert.equal(changed.reviews[0]!.id, "event");
  assert.equal(changed.reviews[0]!.at, now.toISOString());
  assert.equal(changed.practice.session.ratings[rootQuestionId], "Easy");
  assert.deepEqual(
    changed.schedules[rootQuestionId],
    schedule(undefined, rootQuestionId, "Easy", now).card,
  );
  assert.deepEqual(readBackup(backup(changed)), changed);
});

test("daily selection is due-first, capped at five new items, and independent of session restarts", () => {
  let s = newStudy();
  assert.equal(queueFor(s, now).unseen.length, 5);
  assert.ok(queueFor(s, now).ids.every((id) => id.startsWith("recall-")));
  for (let i = 0; i < 5; i++)
    s = recordRating(s, recallCards[i]!.id, "Easy", now, `event-${i}`);
  assert.equal(queueFor(s, now).unseen.length, 0);
  assert.equal(queueFor(s, new Date("2026-11-06T12:00:00Z")).unseen.length, 5);
  const overdue = new Date("2026-11-14T12:00:00Z");
  assert.deepEqual(
    queueFor(s, overdue).ids.slice(0, 5).sort(),
    recallCards
      .slice(0, 5)
      .map((c) => c.id)
      .sort(),
  );
});

test("review resumes the selected queue and phase without rerolling", () => {
  let s = beginReview(newStudy(), now);
  const ids = s.reviewSession!.ids;
  assert.equal(rateReview(s, "Good", now, "premature"), s);
  assert.equal(nextReview(s), s);
  s = { ...s, reviewSession: { ...s.reviewSession!, phase: "feedback" } };
  s = rateReview(s, "Again", now, "first");
  assert.deepEqual(readStudy(JSON.stringify(s)), s);
  assert.deepEqual(
    beginReview(s, new Date("2026-11-06T12:00:00Z")).reviewSession!.ids,
    ids,
  );
  assert.equal(rateReview(s, "Again", now, "repeat-tap"), s);
  const legacy = structuredClone(s);
  delete legacy.reviewSession!.ratingId;
  s = readStudy(JSON.stringify(legacy))!;
  s = rateReview(s, "Good", now, "edit");
  assert.deepEqual(
    s.reviews.map(({ id, grade }) => ({ id, grade })),
    [{ id: "first", grade: "Good" }],
  );
  assert.deepEqual(
    s.schedules[ids[0]!],
    schedule(undefined, ids[0]!, "Good", now).card,
  );
  s = nextReview(s);
  assert.equal(s.reviewSession!.index, 1);
  assert.equal(s.reviewSession!.phase, "question");
  assert.equal(s.reviews.length, 1);
});

test("changing an open scenario rating replays later reviews of the same question", () => {
  const id = rootQuestionId;
  const introduced = recordRating(newStudy(), id, "Good", now, "introduced");
  const next = new Date(introduced.schedules[id]!.dueAt);
  const graduated = recordRating(introduced, id, "Good", next, "graduated");
  const due = new Date(graduated.schedules[id]!.dueAt);
  const feedback = {
    ...graduated,
    practice: {
      ...graduated.practice,
      session: reveal(graduated.practice.session),
    },
  };
  let s = rateScenario(feedback, "Again", due, "scenario");
  assert.equal(s.schedules[id]!.lapses, 1);
  const later = new Date(s.schedules[id]!.dueAt);
  s = beginReview(s, later);
  assert.equal(s.reviewSession!.ids[0], id);
  s = { ...s, reviewSession: { ...s.reviewSession!, phase: "feedback" } };
  s = rateReview(s, "Good", later, "daily");
  s = rateScenario(s, "Easy", later, "edit");
  const expected = schedule(graduated.schedules[id], id, "Easy", due);
  assert.deepEqual(
    s.schedules[id],
    schedule(expected.card, id, "Good", later).card,
  );
  assert.deepEqual(
    s.reviews.slice(-2).map(({ id, grade }) => ({ id, grade })),
    [
      { id: "scenario", grade: "Easy" },
      { id: "daily", grade: "Good" },
    ],
  );
  assert.deepEqual(readBackup(backup(s)), s);
});

test("private cards and scheduled reviews round-trip through a versioned backup", () => {
  let s = newStudy();
  const id = "private:00000000-0000-4000-8000-000000000001";
  s.privateCards.push({
    id,
    title: "My invariant",
    prompt: "Why is it safe?",
    explanation: "Because the invariant is preserved.",
    topic: "Algorithms",
    updatedAt: now.toISOString(),
  });
  s.notes[id] = "<script>plain text only</script>";
  s = recordRating(s, id, "Good", now, "private-review");
  assert.deepEqual(readBackup(backup(s)), s);
  assert.equal(readBackup(JSON.stringify(s)), null);
  assert.equal(
    readBackup(backup(s).replace('"version": 1', '"version": 99')),
    null,
  );
  assert.equal(
    readStudy(JSON.stringify({ ...s, contentRevision: "future" })),
    null,
  );
  assert.equal(
    readStudy(
      JSON.stringify({
        ...s,
        privateCards: [...s.privateCards, s.privateCards[0]],
      }),
    ),
    null,
  );
  const broken = structuredClone(s);
  broken.schedules[id]!.stability = -1;
  assert.equal(readStudy(JSON.stringify(broken)), null);
});

test("saved review sessions cannot reference an unseen scenario or invalid position", () => {
  const s = newStudy();
  s.reviewSession = {
    ids: [questions[rootQuestionId]!.children[0]!],
    index: 0,
    phase: "question",
  };
  assert.equal(readStudy(JSON.stringify(s)), null);
  s.reviewSession = { ids: [recallCards[0]!.id], index: 2, phase: "rated" };
  assert.equal(readStudy(JSON.stringify(s)), null);
  assert.equal(readStudy('{"schemaVersion":1}'), null);
  s.reviewSession = { ids: [recallCards[0]!.id], index: 0, phase: "rated" };
  assert.equal(readStudy(JSON.stringify(s)), null);
});

test("the daily limit follows the saved timezone across local clock boundaries", () => {
  assert.equal(
    studyDay(new Date("2026-11-06T02:00:00Z"), "America/New_York"),
    "2026-11-05",
  );
  assert.equal(
    studyDay(new Date("2026-11-06T02:00:00Z"), "Asia/Tokyo"),
    "2026-11-06",
  );
});

test("the launch recall library has sixty complete original items with unique IDs", () => {
  assert.equal(recallCards.length, 60);
  assert.equal(new Set(recallCards.map((c) => c.id)).size, 60);
  for (const topic of ["Algorithms", "System design"])
    assert.equal(recallCards.filter((c) => c.topic === topic).length, 30);
  for (const c of recallCards) {
    assert.ok(
      c.prompt && c.explanation && c.alternatives && c.pitfall && c.difficulty,
    );
    assert.ok(c.rubric.length >= 3 && c.sources.length > 0);
    assert.ok(c.sources.every((s) => new URL(s.url).protocol === "https:"));
  }
});

test("all sixty recall items can enter scheduled review without exceeding daily new-item limits", () => {
  let study = newStudy();
  study.timeZone = "UTC";
  for (let day = 0; day < 12; day++) {
    const at = new Date(now.getTime() + day * 86400000);
    const newIds = queueFor(study, at).unseen;
    assert.equal(newIds.length, 5);
    for (const id of newIds)
      study = recordRating(study, id, "Easy", at, `launch-${id}`);
    assert.equal(queueFor(study, at).unseen.length, 0);
  }
  assert.deepEqual(
    Object.keys(study.schedules).sort(),
    recallCards.map((c) => c.id).sort(),
  );
  assert.equal(study.reviews.length, 60);
  assert.deepEqual(readBackup(backup(study)), study);
});
