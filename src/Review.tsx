import { useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Architecture } from "./Architecture.tsx";
import { grades, questions } from "./content.ts";
import { recallCards } from "./cards.ts";
import {
  beginReview,
  findItem,
  nextReview,
  queueFor,
  rateReview,
  studyDay,
} from "./study.ts";
import type { Study } from "./study.ts";
import { intervalLabel, schedule } from "./scheduler.ts";

export function Review({
  study,
  setStudy,
  saveStatus,
}: {
  study: Study;
  setStudy: Dispatch<SetStateAction<Study>>;
  saveStatus: string;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const answerHeading = useRef<HTMLHeadingElement>(null);
  const session = study.reviewSession;
  const active = session && session.phase !== "complete" ? session : null;
  const item = active ? findItem(study, active.ids[active.index]!) : null;
  const scenario = item ? questions[item.id] : undefined;
  const revealed = active && active.phase !== "question";
  const queue = queueFor(study);
  const today = studyDay(new Date(), study.timeZone);
  const done = study.reviews.filter((r) => r.day === today).length;
  const nextDue = Object.values(study.schedules)
    .map((c) => c.dueAt)
    .sort()[0];
  function focusQuestion() {
    requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  return (
    <>
      <main className="review-page">
        <header className="session-heading">
          <div>
            <p className="section-label">
              Interview Practice / Spaced repetition
            </p>
            <h1 tabIndex={-1}>Daily review</h1>
            <p className="scenario-subtitle">
              A little retrieval, every day. Aim for about ten minutes.
            </p>
          </div>
          <span className="save-status" role="status">
            {saveStatus}
          </span>
        </header>
        <dl className="review-stats" aria-label="Today’s review counts">
          <div>
            <dt>Due now</dt>
            <dd>{queue.due.length}</dd>
          </div>
          <div>
            <dt>New available today</dt>
            <dd>{queue.unseen.length}</dd>
          </div>
          <div>
            <dt>Reviews today</dt>
            <dd>{done}</dd>
          </div>
        </dl>
        {active && item ? (
          <>
            <div className={`recall-layout${scenario ? " has-diagram" : ""}`}>
              <section
                className="recall-question"
                aria-labelledby="review-question"
              >
                <p className="section-label">
                  {scenario
                    ? "System design scenario"
                    : "topic" in item
                      ? item.topic
                      : "Private card"}{" "}
                  · {active.index + 1} of {active.ids.length}
                </p>
                <h2 ref={heading} tabIndex={-1} id="review-question">
                  {item.title}
                </h2>
                <p className="prompt">{item.prompt}</p>
                {scenario && (
                  <div className="givens">
                    <h3>For this question</h3>
                    <ul>
                      {scenario.givens.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <details className="notes">
                  <summary>
                    Your thinking <span>Optional notes</span>
                  </summary>
                  <label className="sr-only" htmlFor="review-notes">
                    Your review notes
                  </label>
                  <textarea
                    id="review-notes"
                    maxLength={10000}
                    value={study.notes[item.id] ?? ""}
                    onChange={(e) => {
                      const text = e.target.value;
                      setStudy((s) => ({
                        ...s,
                        notes: { ...s.notes, [item.id]: text },
                      }));
                    }}
                  />
                </details>
                {!revealed && (
                  <div className="question-action">
                    <button
                      className="primary-button"
                      onClick={() => {
                        setStudy((s) =>
                          s.reviewSession?.phase === "question"
                            ? {
                                ...s,
                                reviewSession: {
                                  ...s.reviewSession,
                                  phase: "feedback",
                                },
                              }
                            : s,
                        );
                        requestAnimationFrame(() =>
                          answerHeading.current?.focus(),
                        );
                      }}
                    >
                      Reveal answer <span aria-hidden="true">→</span>
                    </button>
                    <p>Answer out loud or in your head. Typing is optional.</p>
                  </div>
                )}
              </section>
              {scenario && (
                <aside className="diagram-pane">
                  <div className="diagram-header">
                    <div>
                      <h3>
                        {revealed
                          ? "Reference architecture"
                          : "The system so far"}
                      </h3>
                      <p>
                        {revealed
                          ? "One reasonable design."
                          : "The established baseline for this question."}
                      </p>
                    </div>
                  </div>
                  <Architecture
                    frame={
                      revealed ? scenario.answerFrame : scenario.questionFrame
                    }
                    before={scenario.questionFrame}
                  />
                </aside>
              )}
              {revealed && (
                <section
                  className="recall-answer"
                  aria-labelledby="recall-answer-heading"
                >
                  <h2
                    id="recall-answer-heading"
                    ref={answerHeading}
                    tabIndex={-1}
                  >
                    Check your reasoning
                  </h2>
                  <p>{item.explanation}</p>
                  {"rubric" in item && (
                    <>
                      <h3>Did you cover these?</h3>
                      <ul className="recall-rubric">
                        {item.rubric.map((p) => (
                          <li key={p}>{p}</li>
                        ))}
                      </ul>
                      <h3>Other valid approaches</h3>
                      <p>{item.alternatives}</p>
                      <h3>Watch for</h3>
                      <p>{item.pitfall}</p>
                      <div className="sources">
                        {item.sources.map((s) => (
                          <a
                            key={s.url}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.label} <span aria-hidden="true">↗</span>
                          </a>
                        ))}
                      </div>
                    </>
                  )}
                  <fieldset className="rating">
                    <legend>How did it go?</legend>
                    <div className="grade-buttons">
                      {grades.map((grade) => (
                        <button
                          key={grade}
                          aria-label={grade}
                          disabled={active.phase === "rated"}
                          onClick={() => {
                            const id = crypto.randomUUID();
                            const now = new Date();
                            setStudy((s) => rateReview(s, grade, now, id));
                          }}
                        >
                          {grade}
                          <span className="grade-interval">
                            {active.phase === "rated"
                              ? ""
                              : intervalLabel(
                                  schedule(
                                    study.schedules[item.id],
                                    item.id,
                                    grade,
                                    new Date(),
                                  ).card.dueAt,
                                )}
                          </span>
                        </button>
                      ))}
                    </div>
                    <p className="small-note">
                      Again: missed it. Hard: correct with effort. Good: solid
                      recall. Easy: immediate recall.
                    </p>
                  </fieldset>
                  {active.phase === "rated" && (
                    <div className="continue-action">
                      <p className="small-note">
                        Next review:{" "}
                        {new Date(
                          study.schedules[item.id]!.dueAt,
                        ).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                      <button
                        className="primary-button"
                        onClick={() => {
                          setStudy(nextReview);
                          focusQuestion();
                        }}
                      >
                        {active.index + 1 === active.ids.length
                          ? "Finish review"
                          : "Next question"}{" "}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  )}
                </section>
              )}
            </div>
          </>
        ) : (
          <div className="review-overview">
            <section className="review-start" aria-labelledby="review-question">
              <p className="section-label">
                {session?.phase === "complete"
                  ? "Review complete"
                  : "Your next few minutes"}
              </p>
              <h2 ref={heading} tabIndex={-1} id="review-question">
                {queue.ids.length
                  ? "Make it stick."
                  : "You’re caught up for now."}
              </h2>
              <p>
                {queue.ids.length
                  ? `${queue.due.length} due ${queue.due.length === 1 ? "question" : "questions"} and ${queue.unseen.length} new ${queue.unseen.length === 1 ? "card" : "cards"}. Due questions come first.`
                  : nextDue
                    ? `The next review is ${new Date(nextDue).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`
                    : "You can start a scenario or add a private card."}
              </p>
              {queue.ids.length > 0 && (
                <button
                  className="primary-button"
                  onClick={() => {
                    setStudy((s) => beginReview(s));
                    focusQuestion();
                  }}
                >
                  Start review <span aria-hidden="true">→</span>
                </button>
              )}
              <p className="small-note">
                Five new items per day · 90% recall target · no streak to
                protect
              </p>
            </section>
            <aside className="review-method">
              <h3>Recall before you reveal.</h3>
              <p>
                Try the explanation yourself, compare it with the reference,
                then rate how well you remembered. The next interval follows
                your rating.
              </p>
              <p>
                The library starts with {recallCards.length} original cards,
                split between system design and algorithm reasoning. Questions
                you rate in a scenario join the same queue independently.
              </p>
              <details>
                <summary>Why this method?</summary>
                <p>
                  Retrieval practice and spaced study improve long-term
                  retention. FSRS estimates useful review intervals; a 90%
                  target is a scheduling setting, not a guarantee of your
                  performance.
                </p>
                <div className="sources">
                  <a
                    href="https://doi.org/10.1126/science.1152408"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Karpicke & Roediger, 2008
                  </a>
                  <a
                    href="https://doi.org/10.1037/0033-2909.132.3.354"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Cepeda et al., 2006
                  </a>
                  <a
                    href="https://open-spaced-repetition.github.io/ts-fsrs/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    FSRS scheduler
                  </a>
                </div>
              </details>
            </aside>
          </div>
        )}
      </main>
      <footer className="app-footer">
        <p>Practice the decisions behind the diagram.</p>
        <span>FSRS-6 · 90% recall target</span>
      </footer>
    </>
  );
}
