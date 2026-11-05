import { useEffect, useRef, useState } from "react";
import { Architecture } from "./Architecture.tsx";
import { grades, questions } from "./content.ts";
import {
  advance,
  currentQuestion,
  initialPractice,
  newSession,
  rate,
  readPractice,
  reveal,
  storageKey,
} from "./session.ts";
import type { SavedPractice } from "./session.ts";

function loadPractice() {
  try {
    return readPractice(localStorage.getItem(storageKey)) ?? initialPractice();
  } catch {
    return initialPractice();
  }
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      aria-hidden="true"
    >
      <path d="M5 12h14m-6-6 6 6-6 6" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

export function App() {
  const [practice, setPractice] = useState<SavedPractice>(loadPractice);
  const [saveFailed, setSaveFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [notesOpen, setNotesOpen] = useState(
    () => !!practice.session.notes[currentQuestion(practice.session).id],
  );
  const aboutDialog = useRef<HTMLDialogElement>(null);
  const diagramDialog = useRef<HTMLDialogElement>(null);
  const aboutTrigger = useRef<HTMLButtonElement>(null);
  const diagramTrigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const diagramHeading = useRef<HTMLHeadingElement>(null);
  const { session } = practice;
  const question = currentQuestion(session);
  const revealed = session.phase !== "question";
  const frame = revealed ? question.answerFrame : question.questionFrame;

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(practice));
      setSaveFailed(false);
    } catch {
      setSaveFailed(true);
    }
  }, [practice]);

  function continuePractice() {
    setPractice((value) => advance(value));
    setNotesOpen(false);
    requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  function revealAnswer() {
    setPractice((value) => ({ ...value, session: reveal(value.session) }));
    requestAnimationFrame(() => diagramHeading.current?.focus());
  }

  return (
    <>
      <a className="skip-link" href="#question">
        Skip to the question
      </a>
      <header className="app-header">
        <a className="brand" href="/" aria-label="Interview Practice home">
          <img src="/favicon.svg" width="30" height="30" alt="" />
          <span>Interview Practice</span>
        </a>
        <div className="header-actions">
          <span className="save-status" role="status">
            {saveFailed
              ? "Couldn’t save on this device"
              : "Saved on this device"}
          </span>
          <button
            ref={aboutTrigger}
            className="text-button"
            onClick={() => aboutDialog.current?.showModal()}
          >
            About this build
          </button>
        </div>
      </header>

      <main>
        <div className="session-heading">
          <div>
            <p className="section-label">System design practice</p>
            <h1>Food delivery</h1>
            <p className="scenario-subtitle">
              A hypothetical DoorDash-style service. Start small and reason
              through what changes.
            </p>
          </div>
          <span className="question-count">Question {session.path.length}</span>
        </div>

        {saveFailed && (
          <p className="storage-error" role="alert">
            Browser storage is unavailable. You can keep practicing, but this
            session will be lost when you leave.
          </p>
        )}

        {session.phase === "complete" ? (
          <section className="completion" aria-labelledby="complete-heading">
            <div className="completion-mark" aria-hidden="true">
              <Check />
            </div>
            <h2 id="complete-heading" tabIndex={-1} ref={heading}>
              Session complete.
            </h2>
            <p>
              You worked through {session.path.length} questions. Another
              session takes a different follow-up from the same starting
              problem.
            </p>
            <ol className="completed-questions">
              {session.path.map((id) => (
                <li key={id}>
                  <span>{questions[id]!.title}</span>
                  <span className="rating-label">{session.ratings[id]}</span>
                </li>
              ))}
            </ol>
            <button
              className="primary-button"
              onClick={() => {
                setPractice((value) => ({ ...value, session: newSession() }));
                requestAnimationFrame(() => heading.current?.focus());
              }}
            >
              Practice another path <Arrow />
            </button>
            <p className="small-note">
              This first build saves locally. Scheduling and account sync come
              in later iterations.
            </p>
          </section>
        ) : (
          <>
            <div className="study-layout">
              <section className="question-pane" aria-labelledby="question">
                <h2 id="question" tabIndex={-1} ref={heading}>
                  {question.title}
                </h2>
                <p className="prompt">{question.prompt}</p>
                <div className="givens">
                  <h3>For this question</h3>
                  <ul>
                    {question.givens.map((given) => (
                      <li key={given}>{given}</li>
                    ))}
                  </ul>
                </div>
                <details
                  className="notes"
                  key={question.id}
                  open={notesOpen}
                  onToggle={(event) => setNotesOpen(event.currentTarget.open)}
                >
                  <summary>
                    Your thinking <span>Optional notes</span>
                  </summary>
                  <label className="sr-only" htmlFor="answer-notes">
                    Your answer notes
                  </label>
                  <textarea
                    id="answer-notes"
                    name="answer-notes"
                    rows={5}
                    maxLength={10000}
                    placeholder="Sketch your reasoning in a few bullets…"
                    value={session.notes[question.id] ?? ""}
                    onChange={(event) => {
                      const note = event.target.value;
                      setPractice((value) => ({
                        ...value,
                        session: {
                          ...value.session,
                          notes: {
                            ...value.session.notes,
                            [question.id]: note,
                          },
                        },
                      }));
                    }}
                  />
                  <p className="small-note">
                    You can also answer out loud. Notes stay in this browser.
                  </p>
                </details>
                {!revealed && (
                  <div className="question-action">
                    <button className="primary-button" onClick={revealAnswer}>
                      Reveal answer <Arrow />
                    </button>
                    <p>Try an answer before you look.</p>
                  </div>
                )}
              </section>

              <aside className="diagram-pane" aria-labelledby="diagram-heading">
                <div className="diagram-header">
                  <div>
                    <h3 id="diagram-heading" tabIndex={-1} ref={diagramHeading}>
                      {revealed
                        ? "Reference architecture"
                        : "The system so far"}
                    </h3>
                    <p>
                      {revealed
                        ? "One reasonable design. New or changed components are highlighted."
                        : "Only the givens and the design you’ve already seen."}
                    </p>
                  </div>
                  <button
                ref={diagramTrigger}
                    className="icon-button"
                    aria-label="Expand architecture diagram"
                    onClick={() => {
                      setZoom(1);
                      diagramDialog.current?.showModal();
                    }}
                  >
                    <svg
                      width="19"
                      height="19"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      aria-hidden="true"
                    >
                      <path d="M9 4H4v5m11-5h5v5M4 15v5h5m11-5v5h-5M4 4l6 6m10-6-6 6M4 20l6-6m10 6-6-6" />
                    </svg>
                  </button>
                </div>
                <Architecture frame={frame} before={question.questionFrame} />
                {!revealed && !frame.connections.length && (
                  <p className="diagram-empty">
                    The architecture starts with your answer.
                  </p>
                )}
                <p className="diagram-caption">
                  {revealed
                    ? "This is an illustrative design, not DoorDash’s production architecture."
                    : "The next change stays hidden until you’re asked about it."}
                </p>
              </aside>
            </div>

            {revealed && (
              <section className="feedback" aria-labelledby="feedback-heading">
                <div className="feedback-main">
                  <h2 id="feedback-heading">A way to think about it</h2>
                  <p>{question.explanation}</p>
                  <h3>Other valid approaches</h3>
                  <p>{question.alternatives}</p>
                  <div className="pitfall">
                    <h3>Watch for</h3>
                    <p>{question.pitfall}</p>
                  </div>
                  <div className="sources">
                    <h3>Read the source</h3>
                    {question.sources.map((source) => (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        key={source.url}
                      >
                        {source.label} <span aria-hidden="true">↗</span>
                      </a>
                    ))}
                  </div>
                </div>
                <div className="rubric-pane">
                  <h3>Did your answer cover these?</h3>
                  <ul className="rubric-list">
                    {question.rubric.map((point) => (
                      <li key={point}>
                        <span aria-hidden="true">
                          <Check />
                        </span>
                        {point}
                      </li>
                    ))}
                  </ul>
                  <fieldset className="rating">
                    <legend>How did it go?</legend>
                    <div className="grade-buttons">
                      {grades.map((grade) => (
                        <button
                          key={grade}
                          aria-pressed={session.ratings[question.id] === grade}
                          disabled={session.phase === "rated"}
                          onClick={() =>
                            setPractice((value) => ({
                              ...value,
                              session: rate(value.session, grade),
                            }))
                          }
                        >
                          {grade}
                        </button>
                      ))}
                    </div>
                    <p className="small-note">
                      Again: missed it. Hard: correct with effort. Good: solid
                      recall. Easy: immediate recall.
                    </p>
                  </fieldset>
                  {session.phase === "rated" && (
                    <div className="continue-action">
                      <button
                        className="primary-button"
                        onClick={continuePractice}
                      >
                        {question.children.length
                          ? "Continue"
                          : "Finish session"}{" "}
                        <Arrow />
                      </button>
                      {question.children.length > 0 && (
                        <p className="small-note">
                          The next question continues from this reference
                          design.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </section>
            )}

            <nav className="journey" aria-label="Revealed session path">
              <span>Your path</span>
              <ol>
                {session.path.map((id, index) => (
                  <li
                    key={id}
                    aria-current={id === question.id ? "step" : undefined}
                  >
                    <span className="path-number">{index + 1}</span>
                    <span>{questions[id]!.title}</span>
                    {session.ratings[id] && (
                      <span className="rating-label">
                        {session.ratings[id]}
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </nav>
          </>
        )}
      </main>
      <footer className="app-footer">
        <p>Practice the decisions behind the diagram.</p>
        <span>Local preview · One scenario</span>
      </footer>

      <dialog
        ref={aboutDialog}
      onClose={() => aboutTrigger.current?.focus({ preventScroll: true })}
        aria-labelledby="about-heading"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            aboutDialog.current?.close();
        }}
      >
        <div className="dialog-content">
          <div className="dialog-heading">
            <h2 id="about-heading">A first working slice</h2>
            <button
              className="text-button"
              onClick={() => aboutDialog.current?.close()}
            >
              Close
            </button>
          </div>
          <p>
            Practice a small food-delivery system, then take one of three
            follow-ups. Answers and architecture changes stay hidden until you
            reveal them.
          </p>
          <p>
            This build saves your notes, self-ratings, and current question on
            this device. It does not yet provide spaced scheduling, accounts, or
            sync.
          </p>
          <p>
            The questions are original, hypothetical exercises with linked
            technical references. No cloud resources are created by practicing.
          </p>
        </div>
      </dialog>
      <dialog
        className="diagram-dialog"
        ref={diagramDialog}
      onClose={() => diagramTrigger.current?.focus({ preventScroll: true })}
        aria-labelledby="expanded-heading"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            diagramDialog.current?.close();
        }}
      >
        <div className="dialog-content">
          <div className="dialog-heading">
            <h2 id="expanded-heading">
              {revealed ? "Reference architecture" : "The system so far"}
            </h2>
            <button
              className="text-button"
              onClick={() => diagramDialog.current?.close()}
            >
              Close
            </button>
          </div>
          <div className="zoom-controls">
            <button
              className="icon-button"
              aria-label="Zoom out"
              disabled={zoom <= 0.75}
              onClick={() => setZoom((value) => Math.max(0.75, value - 0.25))}
            >
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button
              className="icon-button"
              aria-label="Zoom in"
              disabled={zoom >= 2}
              onClick={() => setZoom((value) => Math.min(2, value + 0.25))}
            >
              +
            </button>
            <button className="text-button" onClick={() => setZoom(1)}>
              Reset
            </button>
          </div>
          <div className="expanded-viewport">
            <div style={{ width: `${zoom * 100}%` }}>
              <Architecture frame={frame} before={question.questionFrame} />
            </div>
          </div>
          <ul className="component-list">
            {frame.components.map((component) => (
              <li key={component.id}>
                <strong>{component.name}</strong>
                <span>{component.purpose}</span>
              </li>
            ))}
          </ul>
        </div>
      </dialog>
    </>
  );
}
