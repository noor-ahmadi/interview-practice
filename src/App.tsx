import { useEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Scenario } from "./Scenario.tsx";
import { Review } from "./Review.tsx";
import { Library } from "./Library.tsx";
import { PrivateCards } from "./PrivateCards.tsx";
import { useStudy } from "./useStudy.ts";
import { backup, rateScenario, readBackup } from "./study.ts";
import type { Study } from "./study.ts";
import { supabase } from "./cloud.ts";
import { switchFamily } from "./session.ts";

type View = "scenario" | "review" | "library" | "cards";

function currentView(): View {
  const requested = new URLSearchParams(location.search).get("view");
  return requested === "review" ||
    requested === "cards" ||
    requested === "library"
    ? requested
    : "scenario";
}

export function App() {
  const store = useStudy();
  const { study, setStudy, user, ready, status, saveFailed, conflict } = store;
  const lastGrades = useMemo(
    () => Object.fromEntries(study.reviews.map((r) => [r.itemId, r.grade])),
    [study.reviews],
  );
  const [view, setView] = useState<View>(currentView);
  const [accountError, setAccountError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [restore, setRestore] = useState<Study | null>(null);
  const [restoreError, setRestoreError] = useState("");
  const [undo, setUndo] = useState<Study | null>(null);
  const accountDialog = useRef<HTMLDialogElement>(null);
  const dataDialog = useRef<HTMLDialogElement>(null);
  const optionsTrigger = useRef<HTMLButtonElement>(null);
  const optionsPanel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onBack = () => setView(currentView());
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, []);

  useEffect(() => {
    setRestore(null);
    setUndo(null);
    setRestoreError("");
    setAccountError("");
    setAuthBusy(false);
    dataDialog.current?.close();
    accountDialog.current?.close();
  }, [user?.id]);

  function navigate(next: View) {
    if (next === view) return;
    setView(next);
    history.pushState(null, "", `${location.pathname}?view=${next}`);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("main h1")?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  function followMode(event: MouseEvent<HTMLAnchorElement>, next: View) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    optionsPanel.current?.hidePopover();
    navigate(next);
  }

  function download(value: Study = study) {
    if (!ready) return;
    const url = URL.createObjectURL(
      new Blob([backup(value)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `interview-practice-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <>
      <a
        className="skip-link"
        href={
          view === "scenario"
            ? "#question"
            : view === "review"
              ? "#review-question"
              : view === "library"
                ? "#library-heading"
                : "#private-heading"
        }
      >
        {view === "scenario" || view === "review"
          ? "Skip to the question"
          : "Skip to content"}
      </a>
      <div className="workspace-bar">
        <nav aria-label="Study modes">
          {(
            [
              ["scenario", "Scenarios"],
              ["review", "Review"],
              ["library", "Library"],
            ] as const
          ).map(([id, label]) => (
            <a
              className="mode-button"
              key={id}
              href={`?view=${id}`}
              aria-label={id === "review" ? "Daily review" : undefined}
              aria-current={view === id ? "page" : undefined}
              onClick={(event) => followMode(event, id)}
            >
              {label}
            </a>
          ))}
        </nav>
        <button
          className="options-trigger"
          type="button"
          ref={optionsTrigger}
          popoverTarget="workspace-options"
          aria-label="More options"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="currentColor"
            aria-hidden="true"
          >
            <circle cx="5" cy="12" r="1.65" />
            <circle cx="12" cy="12" r="1.65" />
            <circle cx="19" cy="12" r="1.65" />
          </svg>
        </button>
        <div
          id="workspace-options"
          className="workspace-options"
          ref={optionsPanel}
          popover="auto"
          role="group"
          aria-label="Study options"
        >
          <button
            type="button"
            onClick={() => {
              optionsPanel.current?.hidePopover();
              accountDialog.current?.showModal();
            }}
          >
            {user ? "Account" : "Sign in"}
          </button>
          <a
            href="?view=cards"
            aria-current={view === "cards" ? "page" : undefined}
            onClick={(event) => followMode(event, "cards")}
          >
            Private cards
          </a>
          <button
            type="button"
            disabled={!ready}
            onClick={() => {
              optionsPanel.current?.hidePopover();
              dataDialog.current?.showModal();
            }}
          >
            Backup
          </button>
        </div>
      </div>
      {!ready ? (
        <main>
          <p className="loading-message" role="status">
            Loading your saved practice…
          </p>
        </main>
      ) : (
        <>
          {saveFailed && view !== "scenario" && (
            <p className="workspace-notice" role="alert">
              Browser storage is unavailable. Keep this tab open and download a
              backup before leaving.
            </p>
          )}
          {store.syncError && !conflict && (
            <div className="workspace-notice" role="alert">
              <p>{store.syncError}</p>
              <button className="text-button" onClick={store.retrySync}>
                Retry sync
              </button>
            </div>
          )}
          {conflict && (
            <section
              className="conflict-notice"
              aria-labelledby="conflict-title"
            >
              <h2 id="conflict-title">
                Another device saved different changes.
              </h2>
              <p>
                Your draft is still here. Download it before choosing which copy
                to continue.
              </p>
              <div className="form-actions">
                <button className="secondary-button" onClick={() => download()}>
                  Download this draft
                </button>
                <button
                  className="secondary-button"
                  onClick={() => store.resolveConflict(false)}
                >
                  Use account copy
                </button>
                <button
                  className="secondary-button"
                  onClick={() => store.resolveConflict(true)}
                >
                  Keep this device’s copy
                </button>
              </div>
            </section>
          )}
          {view === "scenario" ? (
            <Scenario
              key={user?.id ?? "guest"}
              study={study}
              setPractice={(action) =>
                setStudy((s) => ({
                  ...s,
                  practice:
                    typeof action === "function" ? action(s.practice) : action,
                }))
              }
              onRate={(grade) => {
                const id = crypto.randomUUID();
                const now = new Date();
                setStudy((s) => rateScenario(s, grade, now, id));
              }}
              lastGrades={lastGrades}
              saveFailed={saveFailed}
              saveStatus={status}
            />
          ) : view === "review" ? (
            <Review
              study={study}
              setStudy={setStudy}
              saveStatus={saveFailed ? "Couldn’t save on this device" : status}
            />
          ) : view === "library" ? (
            <Library
              key={user?.id ?? "guest"}
              study={study}
              setStudy={setStudy}
              onReview={(event) => followMode(event, "review")}
              onScenario={(family) => {
                setStudy((value) => ({
                  ...value,
                  practice: switchFamily(value.practice, family, {
                    schedules: value.schedules,
                    lastGrades,
                  }),
                }));
                navigate("scenario");
              }}
            />
          ) : (
            <PrivateCards
              key={user?.id ?? "guest"}
              study={study}
              setStudy={setStudy}
              owner={user?.id ?? "guest"}
            />
          )}
        </>
      )}
      <dialog
        ref={accountDialog}
        aria-labelledby="account-heading"
        onClose={() => optionsTrigger.current?.focus({ preventScroll: true })}
        onClick={(e) => {
          if (e.target === e.currentTarget) accountDialog.current?.close();
        }}
      >
        <div className="dialog-content">
          <div className="dialog-heading">
            <h2 id="account-heading">
              {user ? "Your account" : "Continue across devices"}
            </h2>
            <button
              className="text-button"
              onClick={() => accountDialog.current?.close()}
            >
              Close
            </button>
          </div>
          {user ? (
            <>
              <p className="account-email">{user.email}</p>
              <p>
                Your cards, notes, review history, and position are private to
                this account.
              </p>
              <p className="account-status" role="status">
                {status}
              </p>
              <div className="form-actions">
                <button className="secondary-button" onClick={store.retrySync}>
                  Sync now
                </button>
                <button
                  className="text-button"
                  disabled={authBusy}
                  onClick={async () => {
                    setAuthBusy(true);
                    const result = await supabase!.auth.signOut({
                      scope: "local",
                    });
                    setAuthBusy(false);
                    if (result.error)
                      setAccountError("Couldn’t sign out. Please retry.");
                    else {
                      accountDialog.current?.close();
                      setUndo(null);
                      setRestore(null);
                    }
                  }}
                >
                  Sign out of this device
                </button>
              </div>
              <p className="small-note">
                Signing out returns to this browser’s separate guest workspace.
                Unsynced account drafts stay here for your next sign-in.
              </p>
            </>
          ) : (
            <>
              <p>
                Sign in with Google to save privately and pick up on another
                device. You can keep using guest practice without an account.
              </p>
              {supabase ? (
                <button
                  className="primary-button"
                  disabled={authBusy}
                  onClick={async () => {
                    setAuthBusy(true);
                    setAccountError("");
                    const { error } = await supabase!.auth.signInWithOAuth({
                      provider: "google",
                      options: {
                        redirectTo: `${location.origin}${location.pathname}?view=${view}`,
                      },
                    });
                    if (error) {
                      setAccountError(
                        "Couldn’t start Google sign-in. Your guest work is still saved here.",
                      );
                      setAuthBusy(false);
                    }
                  }}
                >
                  Continue with Google <span aria-hidden="true">↗</span>
                </button>
              ) : (
                <p className="account-status">
                  Account sync is being configured for this build. Guest
                  practice and backups are available now.
                </p>
              )}
              <p className="small-note">
                A new account starts with this device’s guest practice. Existing
                accounts load their own saved work.
              </p>
            </>
          )}
          {accountError && (
            <p className="form-message" role="alert">
              {accountError}
            </p>
          )}
        </div>
      </dialog>
      <dialog
        ref={dataDialog}
        aria-labelledby="backup-heading"
        onClose={() => {
          setRestore(null);
          setRestoreError("");
          optionsTrigger.current?.focus({ preventScroll: true });
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) dataDialog.current?.close();
        }}
      >
        <div className="dialog-content">
          <div className="dialog-heading">
            <h2 id="backup-heading">Your practice, in a file</h2>
            <button
              className="text-button"
              onClick={() => dataDialog.current?.close()}
            >
              Close
            </button>
          </div>
          <p>
            Export your notes, private cards, review history, schedules, and
            session position, settings, and coding progress as versioned JSON.
            Keep the file private.
          </p>
          <button className="primary-button" onClick={() => download()}>
            Download backup
          </button>
          <div className="restore-section">
            <label htmlFor="backup-file">Restore a backup</label>
            <input
              id="backup-file"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                setRestore(null);
                setRestoreError("");
                const file = e.target.files?.[0];
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setRestoreError("Choose a backup smaller than 5 MB.");
                  return;
                }
                try {
                  const restored = readBackup(await file.text());
                  if (restored) setRestore(restored);
                  else
                    setRestoreError(
                      "This file is not a compatible Interview Practice backup. Nothing was changed.",
                    );
                } catch {
                  setRestoreError(
                    "Couldn’t read that file. Nothing was changed.",
                  );
                }
              }}
            />
            {restore && (
              <div className="restore-preview">
                <p>
                  {restore.privateCards.length} private cards ·{" "}
                  {restore.reviews.length} reviews ·{" "}
                  {restore.codingDone?.length ?? 0} coding problems practiced ·{" "}
                  {restore.practice.history.length} completed scenarios ·{" "}
                  {restore.practice.paused.length +
                    (restore.practice.session.phase === "complete"
                      ? 0
                      : 1)}{" "}
                  sessions in progress
                </p>
                <p>
                  This replaces your current workspace. Download the current
                  backup first; you can also undo this restore until you leave
                  the page.
                </p>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setUndo(study);
                    setStudy(restore);
                    setRestore(null);
                    setRestoreError(
                      "Backup restored. Your schedules and session position are ready.",
                    );
                  }}
                >
                  Restore this backup
                </button>
              </div>
            )}
            {undo && (
              <button
                className="text-button"
                onClick={() => {
                  setStudy(undo);
                  setUndo(null);
                  setRestoreError(
                    "Restored the workspace from before your import.",
                  );
                }}
              >
                Undo last restore
              </button>
            )}
            {restoreError && (
              <p className="form-message" role="status">
                {restoreError}
              </p>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
