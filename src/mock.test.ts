import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryMock, mockSections, startMock, validMockState } from "./mock.ts";
import type { MockAttempt } from "./mock.ts";
import { backup, newStudy, readBackup, readStudy } from "./study.ts";

const now = new Date("2026-11-17T15:00:00Z");
const id = "11111111-2222-4333-8444-555555555555";

function debriefed(): MockAttempt {
  return {
    ...startMock(deliveryMock, id, now, true),
    phase: "debrief",
    asked: ["scale", "correctness"],
    answers: { requirements: "Browse, order, pay, track.", change: "Reserve slots." },
    marks: { requirements: "covered", estimates: "missed" },
    correction: "Say when the order is acknowledged.",
    finishedAt: now.toISOString(),
  };
}

test("the mock content covers every debrief criterion with sources", () => {
  for (const section of mockSections) {
    const criterion = deliveryMock.criteria[section];
    assert.ok(deliveryMock.prompts[section].title);
    assert.ok(criterion.covers.length >= 3 && criterion.reference && criterion.omission);
    assert.ok(criterion.sources.every((s) => new URL(s.url).protocol === "https:"));
  }
  const ids = deliveryMock.clarifications.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("a started mock is valid, survives backup, and keeps its timer", () => {
  const attempt = startMock(deliveryMock, id, now, true);
  assert.equal(attempt.deadline, now.getTime() + 40 * 60_000);
  assert.equal(attempt.phase, "design");
  const study = { ...newStudy(), mock: { current: attempt, history: [] } };
  assert.deepEqual(readBackup(backup(study))?.mock, study.mock);
  const saved = { ...debriefed(), savedAt: now.toISOString() };
  const later = { ...newStudy(), mock: { current: null, history: [saved] } };
  assert.deepEqual(readStudy(JSON.stringify(later))?.mock, later.mock);
});

test("invalid or leaked mock states are rejected before use", () => {
  const design = startMock(deliveryMock, id, now, false);
  const invalid: unknown[] = [
    { current: { ...design, asked: ["unknown"] }, history: [] },
    { current: { ...design, asked: ["scale", "scale"] }, history: [] },
    { current: { ...design, answers: { change: "early" } }, history: [] },
    { current: { ...design, marks: { requirements: "covered" } }, history: [] },
    { current: { ...design, answers: { notes: "x" } }, history: [] },
    { current: { ...design, mockId: "missing" }, history: [] },
    { current: { ...debriefed(), finishedAt: undefined }, history: [] },
    { current: null, history: [debriefed()] },
    { current: { ...design, answers: { api: "x".repeat(10001) } }, history: [] },
    {
      current: debriefed(),
      history: [{ ...debriefed(), savedAt: now.toISOString() }],
    },
  ];
  for (const state of invalid) {
    assert.equal(validMockState(state), false, JSON.stringify(state).slice(0, 120));
    assert.equal(readStudy(JSON.stringify({ ...newStudy(), mock: state })), null);
  }
  assert.equal(validMockState({ current: debriefed(), history: [] }), true);
});
