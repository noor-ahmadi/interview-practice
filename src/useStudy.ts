import { useCallback, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { User } from "@supabase/supabase-js";
import { commitStudy, fetchStudy, supabase } from "./cloud.ts";
import type { RemoteStudy } from "./cloud.ts";
import {
  acknowledge,
  draftKey,
  freshDraft,
  loadDraft,
  reconcile,
} from "./sync.ts";
import type { Study } from "./study.ts";

export function useStudy() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!supabase);
  const [loading, setLoading] = useState(false);
  const [cloudReady, setCloudReady] = useState(false);
  const [loadedOwner, setLoadedOwner] = useState<string | null>(null);
  const [draft, setDraft] = useState(() => loadDraft(null));
  const [conflict, setConflict] = useState<RemoteStudy | null>(null);
  const [status, setStatus] = useState("Saved on this device");
  const [saveFailed, setSaveFailed] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [loadRetry, setLoadRetry] = useState(0);
  const owner = useRef<string | null>(null);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const live = useRef(draft);
  live.current = draft;
  owner.current = user?.id ?? null;
  const ready = authReady && !loading && loadedOwner === (user?.id ?? null);

  const setStudy: Dispatch<SetStateAction<Study>> = useCallback((action) => {
    setStatus(
      owner.current ? "Saved here · waiting to sync" : "Saved on this device",
    );
    setDraft((d) => ({
      ...d,
      dirty: true,
      study: typeof action === "function" ? action(d.study) : action,
    }));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!authReady) return;
    const id = user?.id ?? null;
    const epoch = ++generation.current;
    setConflict(null);
    setSyncError(null);
    inFlight.current = false;
    setCloudReady(false);
    const local = loadDraft(id);
    setDraft(local);
    if (!id) {
      setLoadedOwner(null);
      setLoading(false);
      setStatus("Saved on this device");
      return;
    }
    let cached = false;
    try {
      cached = !!localStorage.getItem(draftKey(id));
    } catch {
      /* Storage is optional. */
    }
    setLoading(true);
    setStatus("Loading your account…");
    fetchStudy()
      .then((remote) => {
        if (owner.current !== id || generation.current !== epoch) return;
        // A new account starts from this browser's guest work. Existing accounts never do.
        const candidate =
          !remote && !cached ? freshDraft(loadDraft(null).study) : local;
        // A cache-free device should load existing cloud work, rather than treat an empty default as a draft.
        const result =
          remote && !cached
            ? {
                draft: {
                  study: remote.study,
                  baseVersion: remote.version,
                  dirty: false,
                  pending: null,
                },
                conflict: null,
              }
            : reconcile(candidate, remote);
        setDraft(result.draft);
        setConflict(result.conflict);
        setStatus(
          result.conflict
            ? "Two devices have different changes"
            : "Account loaded",
        );
        setCloudReady(true);
      })
      .catch((error) => {
        if (owner.current === id && generation.current === epoch) {
          setStatus(error.message);
          setSyncError(error.message);
        }
      })
      .finally(() => {
        if (owner.current === id && generation.current === epoch) {
          setLoadedOwner(id);
          setLoading(false);
        }
      });
    // Account transitions load a separate cache; normal changes never re-run this load.
  }, [authReady, user?.id, loadRetry]);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(draftKey(owner.current), JSON.stringify(draft));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [draft, ready]);

  useEffect(() => {
    if (
      !user ||
      !ready ||
      !cloudReady ||
      conflict ||
      inFlight.current ||
      (!draft.dirty && !draft.pending)
    )
      return;
    const id = user.id;
    const epoch = generation.current;
    const timer = setTimeout(async () => {
      if (inFlight.current || owner.current !== id) return;
      inFlight.current = true;
      const pending = live.current.pending ?? {
        id: crypto.randomUUID(),
        expectedVersion: live.current.baseVersion,
        study: live.current.study,
      };
      const queued = { ...live.current, pending };
      // Persist the exact request before sending, including across lost responses and reloads.
      try {
        localStorage.setItem(draftKey(id), JSON.stringify(queued));
      } catch {
        setSaveFailed(true);
      }
      setDraft(queued);
      setStatus("Saving to your account…");
      setSyncError(null);
      try {
        const result = await commitStudy(pending);
        if (owner.current !== id || generation.current !== epoch) return;
        if (result.status === "conflict") {
          const remote = await fetchStudy();
          if (owner.current !== id || generation.current !== epoch) return;
          if (remote) setConflict(remote);
          setStatus("Two devices have different changes");
        } else {
          setDraft((d) => acknowledge(d, pending, result.version));
          setStatus("Saved across devices");
        }
      } catch (error) {
        if (owner.current === id && generation.current === epoch) {
          setStatus((error as Error).message);
          setSyncError((error as Error).message);
        }
      } finally {
        if (owner.current === id && generation.current === epoch)
          inFlight.current = false;
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [
    draft.study,
    draft.dirty,
    draft.pending,
    user,
    ready,
    cloudReady,
    conflict,
    retry,
  ]);

  const refresh = useCallback(() => {
    if (!user || !ready || inFlight.current || conflict) return;
    if (!cloudReady) {
      setLoadRetry((n) => n + 1);
      return;
    }
    if (live.current.dirty || live.current.pending) {
      setRetry((n) => n + 1);
      return;
    }
    const id = user.id;
    const epoch = generation.current;
    fetchStudy()
      .then((remote) => {
        if (owner.current !== id || generation.current !== epoch) return;
        const result = reconcile(live.current, remote);
        setDraft(result.draft);
        setConflict(result.conflict);
        setSyncError(null);
        setStatus(
          result.conflict
            ? "Two devices have different changes"
            : "Saved across devices",
        );
      })
      .catch(() => {
        if (owner.current !== id || generation.current !== epoch) return;
        const message = "Couldn’t refresh. Your saved draft is still here.";
        setStatus(message);
        setSyncError(message);
      });
  }, [user, ready, cloudReady, conflict]);

  useEffect(() => {
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
    };
  }, [refresh]);

  function resolveConflict(keepLocal: boolean) {
    if (!conflict) return;
    setDraft((d) => ({
      study: keepLocal ? d.study : conflict.study,
      baseVersion: conflict.version,
      dirty: keepLocal,
      pending: null,
    }));
    setConflict(null);
    setStatus(
      keepLocal ? "Saving your device’s draft…" : "Loaded the account copy",
    );
  }

  return {
    study: draft.study,
    setStudy,
    user,
    ready,
    status,
    saveFailed,
    syncError,
    conflict,
    resolveConflict,
    retrySync: refresh,
  };
}
