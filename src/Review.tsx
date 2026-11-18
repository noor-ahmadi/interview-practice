import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Architecture } from "./Architecture.tsx";
import { DiagramDialog, ExpandDiagramButton } from "./DiagramDialog.tsx";
import { RatingChoices } from "./RatingChoices.tsx";
import { RecallFeedback } from "./RecallFeedback.tsx";
import { AskClaude, learnerSection } from "./AskClaude.tsx";
import { cardContext } from "./claude.ts";
import { scenarioQuestions as questions } from "./scenario-content.ts";
import { recallCards } from "./cards.ts";
import {
  beginReview,
  dailyNewLimits,
  findItem,
  nextReview,
  openRating,
  queueFor,
  rateReview,
  ratingOptions,
  studyDay,
} from "./study.ts";
import type { Study } from "./study.ts";

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function queueSummary(due: number, unseen: number) {
  const parts = [
    due > 0 && count(due, "due review"),
    unseen > 0 && count(unseen, "new card"),
  ].filter(Boolean);
  return `${parts.join(" and ")} today.${due && unseen ? " Due reviews come first." : ""}`;
}

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
  const diagramDialog = useRef<HTMLDialogElement>(null);
  const diagramTrigger = useRef<HTMLButtonElement>(null);
  const [diagramOpen, setDiagramOpen] = useState(false);
  const session = study.reviewSession;
  const active = session && session.phase !== "complete" ? session : null;
  const item = active ? findItem(study, active.ids[active.index]!) : null;
  const scenario = item ? questions[item.id] : undefined;
  const revealed = active && active.phase !== "question";
  const frame =
    scenario && (revealed ? scenario.answerFrame : scenario.questionFrame);
  const diagramTitle = revealed
    ? "Reference architecture"
    : "The system so far";
  const selected =
    item && active?.phase === "rated"
      ? openRating(study, item.id, active.ratingId)
      : undefined;
  const overview = !active || !item;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!overview) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, [overview]);
  const queue = overview ? queueFor(study, now) : null;
  const today = studyDay(now, study.timeZone);
  const done = study.reviews.filter((r) => r.day === today).length;
  const nextDue = overview
    ? Object.values(study.schedules)
        .map((c) => c.dueAt)
        .sort()[0]
    : undefined;
  function focusQuestion() {
    requestAnimationFrame(() => {
      heading.current?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  return (
    <main className={overview ? "review-page" : "review-page in-review"}>
      {queue && (
        <>
          <header className="session-heading">
            <div>
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
              <dt>New today</dt>
              <dd>{queue.unseen.length}</dd>
            </div>
            <div>
              <dt>Reviews today</dt>
              <dd>{done}</dd>
            </div>
          </dl>
        </>
      )}
      {active && item ? (
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
            <h1
              ref={heading}
              tabIndex={-1}
              id="review-question"
              className="review-prompt"
            >
              {item.prompt}
            </h1>
            {scenario && (
              <div className="givens">
                <h2>For this question</h2>
                <ul>
                  {scenario.givens.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            )}
            <details className="notes" key={item.id}>
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
                    requestAnimationFrame(() => answerHeading.current?.focus());
                  }}
                >
                  Reveal answer <span aria-hidden="true">→</span>
                </button>
                <p>Answer out loud or in notes before revealing.</p>
              </div>
            )}
          </section>
          {scenario && frame && (
            <aside className="diagram-pane">
              <div className="diagram-header">
                <div>
                  <h2>{diagramTitle}</h2>
                  <p>
                    {revealed
                      ? "One reasonable design."
                      : "The established baseline for this question."}
                  </p>
                </div>
                <ExpandDiagramButton
                  onClick={(event) => {
                    diagramTrigger.current = event.currentTarget;
                    setDiagramOpen(true);
                    diagramDialog.current?.showModal();
                  }}
                />
              </div>
              <Architecture
                frame={frame}
                before={scenario.questionFrame}
                focus={
                  scenario.focus
                    ? {
                        ids: revealed
                          ? scenario.focus.answer
                          : scenario.focus.question,
                        label: scenario.focus.label,
                      }
                    : undefined
                }
              />
              <DiagramDialog
                dialog={diagramDialog}
                title={diagramTitle}
                frame={diagramOpen ? frame : undefined}
                before={scenario.questionFrame}
                onClose={() => {
                  setDiagramOpen(false);
                  diagramTrigger.current?.focus({ preventScroll: true });
                }}
              />
            </aside>
          )}
          {revealed && (
            <section
              className="recall-answer"
              aria-labelledby="recall-answer-heading"
            >
              <h2 id="recall-answer-heading" ref={answerHeading} tabIndex={-1}>
                Check your reasoning
              </h2>
              <RecallFeedback item={item} />
              <AskClaude
                key={item.id}
                what="this question"
                presets={[
                  "Why is the reference answer correct?",
                  "Check my notes against the rubric",
                  "Ask me a harder follow-up",
                ]}
                context={() =>
                  [
                    cardContext(item),
                    learnerSection("learner_notes", study.notes[item.id]),
                  ].join("\n\n")
                }
              />
              <RatingChoices
                options={ratingOptions(study, item.id, selected)}
                selected={selected?.grade}
                onRate={(grade) => {
                  const id = crypto.randomUUID();
                  const now = new Date();
                  setStudy((s) => rateReview(s, grade, now, id));
                }}
              />
              {active.phase === "rated" && (
                <div className="continue-action">
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
      ) : (
        queue && (
          <div className="review-overview">
            <section className="review-start" aria-labelledby="review-question">
              {session?.phase === "complete" && (
                <p className="section-label">Review complete</p>
              )}
              <h2 ref={heading} tabIndex={-1} id="review-question">
                {queue.ids.length
                  ? "Ready to review"
                  : "You’re caught up for now."}
              </h2>
              <p>
                {queue.ids.length
                  ? queueSummary(queue.due.length, queue.unseen.length)
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
                {study.newCardsPerDay ?? 5} new items per day · 90% recall
                target
              </p>
            </section>
            <aside className="review-method">
              <h3>Recall before you reveal.</h3>
              <p>
                Explain the mechanism and why it works before revealing.
                Compare your answer with the rubric, then rate that attempt.
                If you missed the central idea, choose Again and explain the
                correction in your own words.
              </p>
              <p>
                The library has {recallCards.length} original cards, split
                between system design and algorithm reasoning. Questions you
                rate in a scenario join the same queue independently.
              </p>
              <details className="review-settings">
                <summary>Review settings</summary>
                <label htmlFor="daily-new-limit">New cards per day</label>
                <select
                  id="daily-new-limit"
                  name="daily-new-limit"
                  value={study.newCardsPerDay ?? 5}
                  onChange={(event) => {
                    const newCardsPerDay = Number(event.target.value);
                    setStudy((value) => ({ ...value, newCardsPerDay }));
                  }}
                >
                  {dailyNewLimits.map((limit) => (
                    <option key={limit} value={limit}>
                      {limit === 0 ? "0 (due reviews only)" : limit}
                    </option>
                  ))}
                </select>
              </details>
              <details>
                <summary>Why this method?</summary>
                <p>
                  Retrieval practice and spaced study improve long-term
                  retention. FSRS estimates useful review intervals; a 90%
                  target is a scheduling setting, not a guarantee of your
                  performance. These studies support retrieval and spacing;
                  they do not validate this deck or predict interview results.
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
        )
      )}
    </main>
  );
}
