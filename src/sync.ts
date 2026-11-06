import { newStudy, readStudy } from "./study.ts";
import type { Study } from "./study.ts";
import { readPractice, storageKey } from "./session.ts";
import type { PendingWrite, RemoteStudy } from "./cloud.ts";

export type Draft = {
  study: Study;
  baseVersion: number;
  dirty: boolean;
  pending: PendingWrite | null;
};
export const draftKey = (owner: string | null) =>
  `interview-practice:study:v1:${owner ?? "guest"}`;
export const freshDraft = (study = newStudy()): Draft => ({
  study,
  baseVersion: 0,
  dirty: true,
  pending: null,
});

export function loadDraft(owner: string | null): Draft {
  try {
    const raw = localStorage.getItem(draftKey(owner));
    if (raw) {
      const d = JSON.parse(raw) as Draft;
      const study = readStudy(JSON.stringify(d.study));
      if (
        study &&
        Number.isSafeInteger(d.baseVersion) &&
        d.baseVersion >= 0 &&
        typeof d.dirty === "boolean" &&
        (d.pending === null ||
          (d.pending &&
            typeof d.pending.id === "string" &&
            d.pending.expectedVersion === d.baseVersion &&
            readStudy(JSON.stringify(d.pending.study))))
      )
        return { ...d, study };
    }
    if (!owner)
      return freshDraft(
        newStudy(readPractice(localStorage.getItem(storageKey)) ?? undefined),
      );
  } catch {
    /* A blocked storage API still allows an in-memory guest session. */
  }
  return freshDraft();
}

// A clean device can follow the cloud. A diverged draft always needs a decision.
export function reconcile(
  draft: Draft,
  remote: RemoteStudy | null,
): { draft: Draft; conflict: RemoteStudy | null } {
  if (!remote) return { draft, conflict: null };
  if (remote.version === draft.baseVersion) return { draft, conflict: null };
  if (
    draft.pending &&
    remote.version === draft.pending.expectedVersion + 1 &&
    JSON.stringify(remote.study) === JSON.stringify(draft.pending.study)
  ) {
    return {
      draft: acknowledge(draft, draft.pending, remote.version),
      conflict: null,
    };
  }
  if (draft.dirty || draft.pending) return { draft, conflict: remote };
  return {
    draft: {
      study: remote.study,
      baseVersion: remote.version,
      dirty: false,
      pending: null,
    },
    conflict: null,
  };
}

export function acknowledge(
  draft: Draft,
  pending: PendingWrite,
  version: number,
): Draft {
  return {
    ...draft,
    baseVersion: version,
    pending: null,
    dirty: JSON.stringify(draft.study) !== JSON.stringify(pending.study),
  };
}
