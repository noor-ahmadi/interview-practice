import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Architecture } from "./Architecture.tsx";
import { DiagramDialog, ExpandDiagramButton } from "./DiagramDialog.tsx";
import { HistoryQuestion } from "./HistoryQuestion.tsx";
import { RatingChoices } from "./RatingChoices.tsx";
import {
  advance,
  currentQuestion,
  currentVariant,
  getQuestion,
  restart,
  reveal,
  switchFamily,
} from "./session.ts";
import { scenarioFamilies } from "./scenario-content.ts";
import type { Family } from "./scenario-content.ts";
import type { SavedPractice } from "./session.ts";
import type { Grade, Question } from "./content.ts";
import { openRating, ratingOptions } from "./study.ts";
import type { Study } from "./study.ts";
import { Arrow, Check } from "./icons.tsx";
import { Timer } from "./Timer.tsx";
import { AskClaude, learnerSection } from "./AskClaude.tsx";
import { cardContext } from "./claude.ts";

export function Scenario({
  study,
  setPractice,
  onRate,
  lastGrades,
  saveFailed,
  saveStatus,
}: {
  study: Study;
  setPractice: Dispatch<SetStateAction<SavedPractice>>;
  onRate: (grade: Grade) => void;
  lastGrades: Record<string, Grade>;
  saveFailed: boolean;
  saveStatus: string;
}) {
  const { practice, schedules } = study;
  const [historyOpen, setHistoryOpen] = useState(false);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [pastDiagram, setPastDiagram] = useState<Question | null>(null);
  const [notesOpen, setNotesOpen] = useState(
    () => !!practice.session.notes[currentQuestion(practice.session).id],
  );
  const diagramDialog = useRef<HTMLDialogElement>(null);
  const historyDialog = useRef<HTMLDialogElement>(null);
  const diagramTrigger = useRef<HTMLButtonElement>(null);
  const historyTrigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const diagramHeading = useRef<HTMLHeadingElement>(null);
  const { session } = practice;
  const question = currentQuestion(session);
  const selected =
    session.phase === "rated"
      ? openRating(study, question.id, session.ratingId)
      : undefined;
  const variant = currentVariant(session);
  const family = scenarioFamilies.find((f) => f.id === variant.family)!;
  const revealed = session.phase !== "question";
  const frame = revealed ? question.answerFrame : question.questionFrame;
  const expandedFrame = pastDiagram?.answerFrame ?? frame;
  const expandedBefore = pastDiagram?.questionFrame ?? question.questionFrame;

  function openDiagram(past: Question | null, trigger: HTMLButtonElement) {
    diagramTrigger.current = trigger;
    setPastDiagram(past);
    setDiagramOpen(true);
    diagramDialog.current?.showModal();
  }

  useEffect(() => {
    setNotesOpen(!!session.notes[question.id]);
  }, [question.id]);

  function continuePractice() {
    setPractice((value) => advance(value, { schedules, lastGrades }));
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
      <main>
        <header className="session-heading">
          <div>
            <div className="family-heading">
              <h1 className="sr-only" tabIndex={-1}>
                {family.name}
              </h1>
              <label className="sr-only" htmlFor="scenario-family">
                Scenario family
              </label>
              <select
                id="scenario-family"
                className="family-select"
                value={family.id}
                onChange={(event) => {
                  const next = event.target.value as Family;
                  setPractice((value) =>
                    switchFamily(value, next, { schedules, lastGrades }),
                  );
                  requestAnimationFrame(() => {
                    heading.current?.focus();
                    window.scrollTo({ top: 0, behavior: "instant" });
                  });
                }}
              >
                {scenarioFamilies.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <p className="scenario-subtitle">{variant.description}</p>
          </div>
          <div className="header-actions">
            <span className="question-count">
              Question {session.path.length}
            </span>
            <span className="save-status" role="status">
              {saveFailed ? "Couldn’t save on this device" : saveStatus}
            </span>
            {session.phase !== "complete" && (
              <Timer
                key={session.path[0]}
                minutes={20}
                label="Scenario time remaining"
                deadline={session.deadline}
                onToggle={(deadline) =>
                  setPractice((value) => ({
                    ...value,
                    session: { ...value.session, deadline },
                  }))
                }
              />
            )}
            <button
              ref={historyTrigger}
              className="text-button"
              onClick={() => {
                setHistoryOpen(true);
                historyDialog.current?.showModal();
              }}
            >
              History
              {practice.history.length > 0
                ? ` (${practice.history.length})`
                : ""}
            </button>
          </div>
        </header>

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
              session changes the starting conditions and takes another valid
              path through the scenario.
            </p>
            <ol className="completed-questions">
              {session.path.map((id) => (
                <li key={id}>
                  <span>{getQuestion(session, id).title}</span>
                  <span className="rating-label">{session.ratings[id]}</span>
                </li>
              ))}
            </ol>
            <button
              className="primary-button"
              onClick={() => {
                setPractice((value) =>
                  restart(value, { schedules, lastGrades }),
                );
                setNotesOpen(false);
                requestAnimationFrame(() => heading.current?.focus());
              }}
            >
              Practice another path <Arrow />
            </button>
            <p className="small-note">
              Your notes and ratings are saved in History.
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
                    You can also answer out loud. Notes save as you go.
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
                  <ExpandDiagramButton
                    onClick={(event) => openDiagram(null, event.currentTarget)}
                  />
                </div>
                <Architecture
                  frame={frame}
                  before={question.questionFrame}
                  focus={
                    question.focus
                      ? {
                          ids: revealed
                            ? question.focus.answer
                            : question.focus.question,
                          label: question.focus.label,
                        }
                      : undefined
                  }
                />
                {!revealed && !frame.connections.length && (
                  <p className="diagram-empty">
                    The architecture starts with your answer.
                  </p>
                )}
                <p className="diagram-caption">
                  {revealed
                    ? "A hypothetical reference design, not a company's production architecture."
                    : "The next change stays hidden until you’re asked about it."}
                </p>
              </aside>
            </div>

            {revealed && (
              <section className="feedback" aria-labelledby="feedback-heading">
                <div className="rubric-pane">
                  <h2>Did your answer cover these?</h2>
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
                </div>
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
                <div className="rating-pane">
                  <RatingChoices
                    options={ratingOptions(study, question.id, selected)}
                    selected={session.ratings[question.id]}
                    onRate={onRate}
                  />
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
            {revealed && (
              <AskClaude
                key={question.id}
                what="this question"
                presets={[
                  "Why does the reference design fit these givens?",
                  "Check my notes against the rubric",
                  "What breaks first if the load grows 10 times?",
                ]}
                context={() =>
                  [
                    cardContext(question),
                    learnerSection(
                      "learner_notes",
                      practice.session.notes[question.id],
                    ),
                  ].join("\n\n")
                }
              />
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
                    <span>{getQuestion(session, id).title}</span>
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

      <dialog
        className="history-dialog"
        ref={historyDialog}
        onClose={() => {
          setHistoryOpen(false);
          historyTrigger.current?.focus({ preventScroll: true });
        }}
        aria-labelledby="history-heading"
        onClick={(event) => {
          if (event.target === event.currentTarget)
            historyDialog.current?.close();
        }}
      >
        <div className="dialog-content">
          <div className="dialog-heading">
            <h2 id="history-heading">Past sessions</h2>
            <button
              className="text-button"
              onClick={() => historyDialog.current?.close()}
            >
              Close
            </button>
          </div>
          {historyOpen &&
            (practice.history.length === 0 ? (
              <p>
                Completed sessions appear here. Your current notes are saved as
                you go.
              </p>
            ) : (
              <div className="history-sessions">
                {practice.history.toReversed().map((past, index) => (
                  <details
                    className="past-session"
                    key={practice.history.length - index}
                    open={index === 0}
                  >
                    <summary>
                      Session {practice.history.length - index}
                      <span>{past.path.length} questions</span>
                    </summary>
                    {past.path.map((id) => (
                      <HistoryQuestion
                        key={id}
                        question={getQuestion(past, id)}
                        notes={past.notes[id]}
                        rating={past.ratings[id]}
                        onDiagram={openDiagram}
                      />
                    ))}
                  </details>
                ))}
              </div>
            ))}
        </div>
      </dialog>
      <DiagramDialog
        dialog={diagramDialog}
        title={
          pastDiagram
            ? "Saved reference architecture"
            : revealed
              ? "Reference architecture"
              : "The system so far"
        }
        caption={pastDiagram?.title}
        frame={diagramOpen ? expandedFrame : undefined}
        before={expandedBefore}
        onClose={() => {
          setDiagramOpen(false);
          setPastDiagram(null);
          diagramTrigger.current?.focus({ preventScroll: true });
        }}
      />
    </>
  );
}
