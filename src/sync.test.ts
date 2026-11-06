import assert from "node:assert/strict";
import { test } from "node:test";
import { recallCards } from "./cards.ts";
import {
  backup,
  contentRevision,
  newStudy,
  readBackup,
  readStudy,
  recordRating,
} from "./study.ts";
import { foodRevision, legacyRevision } from "./scenario-content.ts";
import {
  acknowledge,
  draftKey,
  freshDraft,
  loadDraft,
  reconcile,
} from "./sync.ts";

test("cloud reconciliation preserves divergent drafts and safely acknowledges a lost response", () => {
  const original = newStudy();
  const changed = structuredClone(original);
  changed.notes[recallCards[0]!.id] = "An unsynced note";
  const pending = { id: "write-1", expectedVersion: 2, study: original };
  const draft = { study: changed, baseVersion: 2, dirty: true, pending };
  const conflict = reconcile(draft, { version: 4, study: original });
  assert.equal(conflict.draft, draft);
  assert.equal(conflict.conflict!.version, 4);
  const recovered = reconcile(draft, { version: 3, study: original });
  assert.equal(recovered.conflict, null);
  assert.equal(recovered.draft.pending, null);
  assert.equal(recovered.draft.dirty, true);
  assert.deepEqual(recovered.draft.study, changed);
  const clean = acknowledge({ ...draft, study: original }, pending, 3);
  assert.equal(clean.dirty, false);
  assert.deepEqual(
    reconcile(clean, { version: 4, study: changed }).draft.study,
    changed,
  );
  assert.equal(reconcile(freshDraft(), null).conflict, null);
});

test("old study backups migrate without losing their active tree or independent schedules", () => {
  const original = recordRating(
    newStudy(),
    recallCards[0]!.id,
    "Good",
    new Date("2026-11-05T12:00:00Z"),
    "legacy-review",
  );
  original.notes[recallCards[0]!.id] = "Keep this note.";
  original.privateCards.push({
    id: "private:00000000-0000-4000-8000-000000000001",
    title: "My question",
    prompt: "Why?",
    explanation: "Because.",
    topic: "Algorithms",
    updatedAt: "2026-11-05T12:00:00Z",
  });
  original.reviewSession = {
    ids: [recallCards[0]!.id],
    index: 0,
    phase: "question",
  };
  const old = legacyStudy(original);
  old.practice.session = {
    path: ["delivery-small-start", "delivery-menu-photos"],
    phase: "feedback",
    notes: { "delivery-menu-photos": "Still thinking." },
    ratings: { "delivery-small-start": "Good" },
  };
  const migrated = readStudy(JSON.stringify(old))!;
  assert.equal(migrated.contentRevision, contentRevision);
  assert.equal(migrated.practice.version, 4);
  assert.equal(migrated.practice.session.revision, legacyRevision);
  assert.equal(migrated.practice.session.phase, "feedback");
  assert.deepEqual(migrated.schedules, original.schedules);
  assert.deepEqual(migrated.reviews, original.reviews);
  assert.deepEqual(migrated.privateCards, original.privateCards);
  assert.deepEqual(migrated.reviewSession, original.reviewSession);
  assert.deepEqual(migrated.notes, original.notes);
  assert.deepEqual(readBackup(backup(old)), migrated);
  assert.deepEqual(readBackup(backup(migrated)), migrated);
});

function legacyStudy(study = newStudy()) {
  const old = JSON.parse(JSON.stringify(study));
  old.contentRevision = legacyRevision;
  old.practice.version = 2;
  delete old.practice.session.revision;
  return old;
}

test("a pending v3 food-library write remains identical while its acknowledged view migrates", () => {
  const old = JSON.parse(JSON.stringify(newStudy()));
  old.contentRevision = foodRevision;
  old.practice.version = 3;
  old.practice.session.revision = foodRevision;
  old.practice.session.notes["delivery-small-start"] =
    "Saved before the family picker.";
  delete old.practice.paused;
  const raw = JSON.stringify(old);
  const migrated = readStudy(raw)!;
  const pending = { id: "food-library-write", expectedVersion: 4, study: old };
  const result = reconcile(
    { study: migrated, baseVersion: 4, dirty: true, pending },
    { study: migrated, version: 5 },
  );
  assert.equal(result.conflict, null);
  assert.equal(result.draft.dirty, false);
  assert.equal(result.draft.pending, null);
  assert.equal(result.draft.study.practice.session.revision, foodRevision);
  assert.deepEqual(result.draft.study.practice.paused, []);
  assert.equal(JSON.stringify(pending.study), raw);
});

test("migration preserves the exact pending request and recognizes a committed old snapshot", () => {
  const old = legacyStudy();
  old.practice.session.notes["delivery-small-start"] = "Before the upgrade.";
  const pending = { id: "old-write", expectedVersion: 7, study: old };
  const cached = { study: old, baseVersion: 7, dirty: true, pending };
  const values = new Map([[draftKey("fixture-owner"), JSON.stringify(cached)]]);
  // A local storage double tests cache loading without an account or network.
  const descriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { getItem: (key: string) => values.get(key) ?? null },
  });
  try {
    const draft = loadDraft("fixture-owner");
    assert.equal(draft.study.contentRevision, contentRevision);
    assert.equal(draft.study.practice.session.revision, legacyRevision);
    assert.equal(JSON.stringify(draft.pending), JSON.stringify(pending));
    // JSONB changes object key order at every depth, while retaining array order.
    const migratedRemote = readStudy(
      JSON.stringify(old, (_key, value) =>
        value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([a], [b]) => b.localeCompare(a)),
            )
          : value,
      ),
    )!;
    const result = reconcile(draft, { study: migratedRemote, version: 8 });
    assert.equal(result.conflict, null);
    assert.equal(result.draft.dirty, false);
    assert.equal(result.draft.pending, null);
    assert.equal(result.draft.baseVersion, 8);
    assert.equal(acknowledge(draft, pending, 8).dirty, false);
    draft.study.practice.session.notes["delivery-small-start"] =
      "New work while retrying.";
    const newer = reconcile(draft, { study: migratedRemote, version: 8 });
    assert.equal(newer.conflict, null);
    assert.equal(newer.draft.dirty, true);
    assert.equal(
      newer.draft.study.practice.session.notes["delivery-small-start"],
      "New work while retrying.",
    );
    assert.equal(JSON.stringify(draft.pending), JSON.stringify(pending));
  } finally {
    if (descriptor)
      Object.defineProperty(globalThis, "localStorage", descriptor);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
