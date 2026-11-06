import assert from "node:assert/strict";
import { test } from "node:test";
import { recallCards } from "./cards.ts";
import { newStudy } from "./study.ts";
import { acknowledge, freshDraft, reconcile } from "./sync.ts";

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
