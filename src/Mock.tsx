import { useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { Arrow, Check } from "./icons.tsx";
import { Timer } from "./Timer.tsx";
import { AskClaude, learnerSection } from "./AskClaude.tsx";
import {
  deliveryMock,
  mockMarks,
  mockSections,
  mocks,
  startMock,
} from "./mock.ts";
import type { MockAttempt, MockMark, MockState } from "./mock.ts";
import type { Study } from "./study.ts";

const markLabels: Record<MockMark, string> = {
  covered: "Covered",
  partial: "Partly",
  missed: "Missed",
};

function focus(id: string) {
  requestAnimationFrame(() => {
    const element = document.getElementById(id);
    element?.focus();
    element?.scrollIntoView({ block: "start" });
  });
}

function markSummary(attempt: MockAttempt) {
  const counts = mockMarks
    .map((mark) => [
      mark,
      Object.values(attempt.marks).filter((m) => m === mark).length,
    ] as const)
    .filter(([, n]) => n > 0)
    .map(([mark, n]) => `${n} ${markLabels[mark].toLowerCase()}`);
  return counts.length ? counts.join(" · ") : "Not marked";
}

function Notes({ text }: { text?: string }) {
  return text?.trim() ? (
    <p className="mock-own">{text}</p>
  ) : (
    <p className="mock-own empty">No notes written.</p>
  );
}

function PastAttempt({ attempt }: { attempt: MockAttempt }) {
  const mock = mocks[attempt.mockId]!;
  const date = new Date(attempt.savedAt ?? attempt.startedAt).toLocaleString(
    undefined,
    { dateStyle: "medium", timeStyle: "short" },
  );
  return (
    <details className="past-session mock-past">
      <summary>
        {date}
        <span>{markSummary(attempt)}</span>
      </summary>
      {attempt.correction.trim() && (
        <p className="mock-correction">
          <strong>Practise next:</strong> {attempt.correction}
        </p>
      )}
      {mockSections.map((section) => (
        <div className="mock-past-section" key={section}>
          <h4>
            {mock.prompts[section].title}
            {attempt.marks[section] && (
              <span className="rating-label">
                {markLabels[attempt.marks[section]!]}
              </span>
            )}
          </h4>
          <Notes text={attempt.answers[section]} />
        </div>
      ))}
      <div className="mock-past-section">
        <h4>{mock.change.title}</h4>
        <Notes text={attempt.answers.change} />
      </div>
    </details>
  );
}

export function MockInterview({
  study,
  setStudy,
  saveStatus,
}: {
  study: Study;
  setStudy: Dispatch<SetStateAction<Study>>;
  saveStatus: string;
}) {
  const state: MockState = study.mock ?? { current: null, history: [] };
  const attempt = state.current;
  const mock = attempt ? mocks[attempt.mockId]! : deliveryMock;
  const [timed, setTimed] = useState(true);
  const [saved, setSaved] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  function update(change: (attempt: MockAttempt) => MockAttempt) {
    setStudy((value) =>
      value.mock?.current
        ? {
            ...value,
            mock: { ...value.mock, current: change(value.mock.current) },
          }
        : value,
    );
  }

  function write(key: keyof MockAttempt["answers"], text: string) {
    update((a) => ({ ...a, answers: { ...a.answers, [key]: text } }));
  }

  return (
    <main className="mock-page">
      <header className="session-heading">
        <div>
          <h1 id="mock-heading" tabIndex={-1} ref={heading}>
            Mock interview
          </h1>
          <p className="scenario-subtitle">
            {mock.title} · {mock.minutes} minutes · debrief at the end
          </p>
        </div>
        <div className="header-actions">
          <span className="save-status" role="status">
            {saveStatus}
          </span>
          {attempt && attempt.phase !== "debrief" && (
            <Timer
              minutes={mock.minutes}
              label="Mock time remaining"
              deadline={attempt.deadline}
              onToggle={(deadline) => update((a) => ({ ...a, deadline }))}
            />
          )}
        </div>
      </header>

      {!attempt ? (
        <div className="mock-start">
          <section className="mock-card" aria-labelledby="mock-how">
            <h2 id="mock-how">How it works</h2>
            <ol>
              <li>Read a short brief and ask the interviewer questions.</li>
              <li>
                Draft each part of your design. Notes are optional and save as
                you go, so you can also answer out loud.
              </li>
              <li>
                When your design holds together, reveal one change to the
                requirements and explain what it changes.
              </li>
              <li>
                Finish to compare each part with a reference design and mark
                your own coverage.
              </li>
            </ol>
            <p className="small-note">
              Nothing from the reference appears until you finish. It is one
              valid design for a hypothetical service; equivalent approaches
              count. Your marks are self-reported, not a prediction of an
              interview result.
            </p>
            {saved && (
              <p className="form-message" role="status">
                Attempt saved to your history.
              </p>
            )}
            <label className="prep-check mock-timed">
              <input
                type="checkbox"
                checked={timed}
                onChange={(event) => setTimed(event.target.checked)}
              />
              Start a {mock.minutes}-minute timer
            </label>
            <button
              className="primary-button"
              onClick={() => {
                const next = startMock(
                  deliveryMock,
                  crypto.randomUUID(),
                  new Date(),
                  timed,
                );
                setSaved(false);
                setStudy((value) => ({
                  ...value,
                  mock: {
                    history: value.mock?.history ?? [],
                    current: value.mock?.current ?? next,
                  },
                }));
                focus("mock-brief-heading");
              }}
            >
              Start the mock <Arrow />
            </button>
          </section>
          {state.history.length > 0 && (
            <section className="mock-history" aria-labelledby="mock-history">
              <h2 id="mock-history">Past attempts</h2>
              {state.history.toReversed().map((past) => (
                <PastAttempt key={past.id} attempt={past} />
              ))}
            </section>
          )}
        </div>
      ) : attempt.phase !== "debrief" ? (
        <div className="mock-work">
          <section className="mock-card" aria-labelledby="mock-brief-heading">
            <h2 id="mock-brief-heading" tabIndex={-1}>
              The brief
            </h2>
            {mock.brief.map((paragraph) => (
              <p className="mock-brief" key={paragraph}>
                {paragraph}
              </p>
            ))}
          </section>

          <section aria-labelledby="mock-ask">
            <h2 id="mock-ask">Ask the interviewer</h2>
            <p className="small-note">
              Ask what you would ask in the room. Questions you skip show up
              in the debrief.
            </p>
            <ul className="mock-questions">
              {mock.clarifications.map((item) =>
                attempt.asked.includes(item.id) ? (
                  <li key={item.id} className="asked">
                    <strong>{item.question}</strong>
                    <p>{item.answer}</p>
                  </li>
                ) : (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() =>
                        update((a) =>
                          a.asked.includes(item.id)
                            ? a
                            : { ...a, asked: [...a.asked, item.id] },
                        )
                      }
                    >
                      {item.question}
                      <span aria-hidden="true">Ask</span>
                    </button>
                  </li>
                ),
              )}
            </ul>
          </section>

          <section aria-labelledby="mock-design">
            <h2 id="mock-design">Your design</h2>
            {mockSections.map((section) => (
              <div className="mock-field" key={section}>
                <label htmlFor={`mock-${section}`}>
                  {mock.prompts[section].title}
                </label>
                <p className="small-note" id={`mock-${section}-hint`}>
                  {mock.prompts[section].hint}
                </p>
                <textarea
                  id={`mock-${section}`}
                  name={`mock-${section}`}
                  rows={4}
                  maxLength={10000}
                  aria-describedby={`mock-${section}-hint`}
                  value={attempt.answers[section] ?? ""}
                  onChange={(event) => write(section, event.target.value)}
                />
              </div>
            ))}
          </section>

          {attempt.phase === "design" ? (
            <div className="question-action">
              <button
                className="secondary-button"
                onClick={() => {
                  update((a) =>
                    a.phase === "design" ? { ...a, phase: "change" } : a,
                  );
                  focus("mock-change-heading");
                }}
              >
                Reveal the follow-up <Arrow />
              </button>
              <p>Do this when your design holds together.</p>
            </div>
          ) : (
            <section
              className="mock-card mock-change"
              aria-labelledby="mock-change-heading"
            >
              <p className="section-label">Follow-up</p>
              <h2 id="mock-change-heading" tabIndex={-1}>
                {mock.change.title}
              </h2>
              <p className="mock-brief">{mock.change.text}</p>
              <div className="mock-field">
                <label htmlFor="mock-change">{mock.change.question}</label>
                <textarea
                  id="mock-change"
                  name="mock-change"
                  rows={5}
                  maxLength={10000}
                  value={attempt.answers.change ?? ""}
                  onChange={(event) => write("change", event.target.value)}
                />
              </div>
              <button
                className="primary-button"
                onClick={() => {
                  update((a) =>
                    a.phase === "change"
                      ? {
                          ...a,
                          phase: "debrief",
                          finishedAt: new Date().toISOString(),
                        }
                      : a,
                  );
                  focus("mock-debrief-heading");
                }}
              >
                Finish and open the debrief <Arrow />
              </button>
            </section>
          )}
          <button
            type="button"
            className="text-button mock-discard"
            onClick={() => {
              if (
                window.confirm(
                  "Discard this attempt? Your notes for it will be deleted.",
                )
              ) {
                setStudy((value) =>
                  value.mock ? { ...value, mock: { ...value.mock, current: null } } : value,
                );
                focus("mock-heading");
              }
            }}
          >
            Discard this attempt
          </button>
        </div>
      ) : (
        <div className="mock-work">
          <section aria-labelledby="mock-debrief-heading">
            <h2 id="mock-debrief-heading" tabIndex={-1}>
              Debrief
            </h2>
            <p className="mock-lede">
              Compare each part with the reference, then mark how well your
              answer covered it. A different design that meets the same
              requirements counts.
            </p>
          </section>
          {mockSections.map((section) => {
            const criterion = mock.criteria[section];
            const unasked = mock.clarifications.filter(
              (c) => !attempt.asked.includes(c.id),
            );
            return (
              <section
                className="mock-card mock-criterion"
                key={section}
                aria-labelledby={`debrief-${section}`}
              >
                <h3 id={`debrief-${section}`}>{mock.prompts[section].title}</h3>
                <div className="mock-compare">
                  <div>
                    <h4>Your notes</h4>
                    <Notes text={attempt.answers[section]} />
                    {section === "tradeoffs" && (
                      <>
                        <h4>Your answer to the follow-up</h4>
                        <Notes text={attempt.answers.change} />
                      </>
                    )}
                    {section === "requirements" && unasked.length > 0 && (
                      <>
                        <h4>Questions you didn’t ask</h4>
                        <ul className="mock-unasked">
                          {unasked.map((c) => (
                            <li key={c.id}>
                              <strong>{c.question}</strong> {c.answer}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                  </div>
                  <div>
                    <h4>A strong answer covers</h4>
                    <ul className="rubric-list recall-rubric">
                      {criterion.covers.map((point) => (
                        <li key={point}>
                          <span aria-hidden="true">
                            <Check />
                          </span>
                          {point}
                        </li>
                      ))}
                    </ul>
                    <p className="mock-reference">{criterion.reference}</p>
                    <div className="pitfall">
                      <h4>Often missed</h4>
                      <p>{criterion.omission}</p>
                    </div>
                    <div className="sources">
                      {criterion.sources.map((source) => (
                        <a
                          key={source.url}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {source.label} <span aria-hidden="true">↗</span>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
                <fieldset className="mock-mark">
                  <legend>How well did your answer cover this?</legend>
                  <div>
                    {mockMarks.map((mark) => (
                      <label key={mark}>
                        <input
                          type="radio"
                          name={`mark-${section}`}
                          value={mark}
                          checked={attempt.marks[section] === mark}
                          onChange={() =>
                            update((a) => ({
                              ...a,
                              marks: { ...a.marks, [section]: mark },
                            }))
                          }
                        />
                        {markLabels[mark]}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>
            );
          })}
          <AskClaude
            key={attempt.id}
            what="this mock"
            presets={[
              "Review my design against the debrief",
              "Which gap matters most, and how do I fix it?",
              "How would you answer the lunch promotion follow-up?",
            ]}
            context={() =>
              [
                `<brief>\n${mock.brief.join("\n")}\n</brief>`,
                `<interviewer_answers>\n${mock.clarifications
                  .map((c) => `- ${c.question} ${c.answer}`)
                  .join("\n")}\n</interviewer_answers>`,
                `<requirement_change>\n${mock.change.text}\n${mock.change.question}\n</requirement_change>`,
                ...mockSections.map((section) =>
                  [
                    `<criterion name="${mock.prompts[section].title}">`,
                    `Reference covers:\n${mock.criteria[section].covers.join("\n")}`,
                    `Reference: ${mock.criteria[section].reference}`,
                    learnerSection("learner_notes", attempt.answers[section]),
                    attempt.marks[section]
                      ? `Learner self-mark: ${attempt.marks[section]}`
                      : "",
                    "</criterion>",
                  ]
                    .filter(Boolean)
                    .join("\n"),
                ),
                learnerSection("learner_change_answer", attempt.answers.change),
              ].join("\n\n")
            }
          />
          <section className="mock-card" aria-labelledby="mock-next">
            <h3 id="mock-next">What to practise next</h3>
            <p className="small-note">
              {markSummary(attempt)}. Name one concrete gap, such as “state
              when the order is acknowledged”, and open the matching recall
              cards before your next attempt.
            </p>
            <label className="sr-only" htmlFor="mock-correction">
              One thing to practise next
            </label>
            <textarea
              id="mock-correction"
              name="mock-correction"
              rows={3}
              maxLength={2000}
              value={attempt.correction}
              onChange={(event) =>
                update((a) => ({ ...a, correction: event.target.value }))
              }
            />
            <button
              className="primary-button"
              onClick={() => {
                setStudy((value) => {
                  const current = value.mock?.current;
                  if (!current || current.phase !== "debrief") return value;
                  return {
                    ...value,
                    mock: {
                      current: null,
                      history: [
                        ...value.mock!.history,
                        { ...current, savedAt: new Date().toISOString() },
                      ].slice(-50),
                    },
                  };
                });
                setSaved(true);
                requestAnimationFrame(() => {
                  heading.current?.focus();
                  window.scrollTo({ top: 0, behavior: "instant" });
                });
              }}
            >
              Save to history <Arrow />
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
