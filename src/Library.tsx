import { Fragment, useRef, useState } from "react";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { recallCards } from "./cards.ts";
import type { RecallCard } from "./cards.ts";
import { codingProblemIds, codingTracks } from "./coding-content.ts";
import { codingSolutions } from "./coding-solutions.ts";
import { RecallFeedback } from "./RecallFeedback.tsx";
import { recallTracks } from "./recall-tracks.ts";
import { scenarioFamilies, scenarioQuestions } from "./scenario-content.ts";
import type { Family } from "./scenario-content.ts";
import { queueFor } from "./study.ts";
import type { Study } from "./study.ts";

const panels = [
  { id: "plan", label: "Plan" },
  { id: "recall", label: "Recall cards" },
  { id: "coding", label: "Coding practice" },
] as const;
type Panel = (typeof panels)[number]["id"];
type SetStudy = Dispatch<SetStateAction<Study>>;

function count(n: number, word: string) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const designFocus: Record<Family, string> = {
  delivery: "Capacity, stock, and order retries",
  chat: "Live delivery, catch-up, and access",
  shortener: "Redirects, caches, and event counts",
  feed: "Fan-out, rankings, and visibility",
  files: "Versioning, offline edits, and recovery",
};

function Drill({
  drill,
  item,
  notes,
  setStudy,
  onExit,
}: {
  drill: NonNullable<Study["drill"]>;
  item: RecallCard;
  notes: string;
  setStudy: SetStudy;
  onExit: (finished: boolean) => void;
}) {
  const question = useRef<HTMLHeadingElement>(null);
  const answer = useRef<HTMLHeadingElement>(null);
  const last = drill.index === drill.ids.length - 1;
  return (
    <main className="in-review">
      <div className="recall-layout">
        <section className="recall-question" aria-labelledby="library-heading">
          <div className="drill-bar">
            <p>
              {item.topic} · {drill.index + 1} of {drill.ids.length}
            </p>
            <button
              type="button"
              className="text-button"
              onClick={() => onExit(false)}
            >
              Back to topics
            </button>
          </div>
          <h1
            ref={question}
            tabIndex={-1}
            id="library-heading"
            className="review-prompt"
          >
            {item.prompt}
          </h1>
          <details className="notes" key={item.id}>
            <summary>
              Your thinking <span>Optional notes</span>
            </summary>
            <label htmlFor="drill-notes" className="sr-only">
              Your drill notes
            </label>
            <textarea
              id="drill-notes"
              name="drill-notes"
              maxLength={10000}
              value={notes}
              onChange={(event) => {
                const text = event.target.value;
                setStudy((value) => ({
                  ...value,
                  notes: { ...value.notes, [item.id]: text },
                }));
              }}
            />
          </details>
          {!drill.revealed && (
            <div className="question-action">
              <button
                className="primary-button"
                onClick={() => {
                  setStudy((value) =>
                    value.drill
                      ? { ...value, drill: { ...value.drill, revealed: true } }
                      : value,
                  );
                  requestAnimationFrame(() => answer.current?.focus());
                }}
              >
                Reveal answer <span aria-hidden="true">→</span>
              </button>
              <p>Answer out loud or in notes before revealing.</p>
            </div>
          )}
        </section>
        {drill.revealed && (
          <section className="recall-answer" aria-labelledby="drill-answer">
            <h2 ref={answer} tabIndex={-1} id="drill-answer">
              Check your reasoning
            </h2>
            <RecallFeedback item={item} />
            <div className="continue-action">
              <button
                className="primary-button"
                onClick={() => {
                  setStudy((value) => {
                    const saved = value.drill;
                    if (!saved?.revealed) return value;
                    return {
                      ...value,
                      drill:
                        saved.index + 1 < saved.ids.length
                          ? {
                              ...saved,
                              index: saved.index + 1,
                              revealed: false,
                            }
                          : undefined,
                    };
                  });
                  if (last) onExit(true);
                  else
                    requestAnimationFrame(() => {
                      question.current?.focus();
                      window.scrollTo({ top: 0, behavior: "instant" });
                    });
                }}
              >
                {last ? "Finish drill" : "Next card"}{" "}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

export function Library({
  study,
  setStudy,
  onReview,
  onMock,
  onScenario,
}: {
  study: Study;
  setStudy: SetStudy;
  onReview: (event: MouseEvent<HTMLAnchorElement>) => void;
  onMock: (event: MouseEvent<HTMLAnchorElement>) => void;
  onScenario: (family: Family) => void;
}) {
  const [panel, setPanel] = useState<Panel>("plan");
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("");
  const [hidePracticed, setHidePracticed] = useState(false);
  const [showDrill, setShowDrill] = useState(!!study.drill);
  const [drillComplete, setDrillComplete] = useState(false);
  const drill = study.drill;
  const drillCard =
    drill && recallCards.find((item) => item.id === drill.ids[drill.index]);
  const done = new Set(study.codingDone);

  function focusPage() {
    requestAnimationFrame(() => {
      document.getElementById("library-heading")?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }

  function choose(next: Panel) {
    if (next === panel) return;
    setPanel(next);
    setQuery("");
    setTopic("");
    setDrillComplete(false);
    requestAnimationFrame(() =>
      document
        .getElementById(
          next === "plan" ? "prep-plan-title" : "prep-catalog-title",
        )
        ?.focus(),
    );
  }

  function startDrill(cards: RecallCard[]) {
    setStudy((value) =>
      value.drill
        ? value
        : {
            ...value,
            drill: {
              ids: cards.map((card) => card.id),
              index: 0,
              revealed: false,
            },
          },
    );
    setShowDrill(true);
    focusPage();
  }

  if (showDrill && drill && drillCard) {
    return (
      <Drill
        drill={drill}
        item={drillCard}
        notes={study.notes[drillCard.id] ?? ""}
        setStudy={setStudy}
        onExit={(finished) => {
          setPanel("recall");
          setShowDrill(false);
          setDrillComplete(finished);
          focusPage();
        }}
      />
    );
  }

  const queue = panel === "plan" ? queueFor(study) : null;
  const words = query.trim().toLowerCase().split(/\s+/);
  const matches = (...text: string[]) =>
    words.every((word) => text.join(" ").toLowerCase().includes(word));
  const recall =
    panel === "recall"
      ? recallTracks
          .filter((track) => !topic || track.name === topic)
          .map((track) => ({
            ...track,
            cards: track.cards.filter((card) =>
              matches(track.name, track.topic, card.title, card.prompt),
            ),
          }))
          .filter((track) => track.cards.length)
      : [];
  const coding =
    panel === "coding"
      ? codingTracks
          .filter((track) => !topic || track.name === topic)
          .map((track) => ({
            ...track,
            problems: track.problems.filter(
              (problem) =>
                (!hidePracticed || !done.has(problem.id)) &&
                matches(track.name, problem.title, String(problem.id)),
            ),
          }))
          .filter((track) => track.problems.length)
      : [];
  const results =
    recall.reduce((count, track) => count + track.cards.length, 0) +
    coding.reduce((count, track) => count + track.problems.length, 0);

  return (
    <main className="library-page">
      <header className="library-heading">
        <h1 id="library-heading" tabIndex={-1}>
          Prep library
        </h1>
        <p>
          Review what you know, solve a coding problem, or talk through a system
          design.
        </p>
      </header>
      <div className="library-tabs" role="group" aria-label="Library sections">
        {panels.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className="mode-button"
            aria-pressed={panel === id}
            onClick={() => choose(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {drill && (
        <div className="drill-resume">
          <p>
            Recall drill · {drill.index + 1} of {drill.ids.length}
          </p>
          <button
            className="secondary-button"
            onClick={() => {
              setShowDrill(true);
              focusPage();
            }}
          >
            Resume drill
          </button>
          <button
            className="text-button"
            onClick={() => {
              setStudy((value) => ({ ...value, drill: undefined }));
              focusPage();
            }}
          >
            End drill
          </button>
        </div>
      )}
      {queue ? (
        <div className="prep-plan">
          <section aria-labelledby="prep-plan-title">
            <h2 id="prep-plan-title" tabIndex={-1}>
              Study plan
            </h2>
            <ol className="prep-steps">
              <li>
                <div>
                  <h3>Review what’s due</h3>
                  <p>
                    Recall the answer first, then rate how well you remembered
                    it.
                  </p>
                  <p className="prep-count">
                    {queue.due.length} due · {queue.unseen.length} new available
                  </p>
                </div>
                <a
                  className="secondary-button"
                  href="?view=review"
                  onClick={onReview}
                >
                  {study.reviewSession &&
                  study.reviewSession.phase !== "complete"
                    ? "Resume review"
                    : "Daily review"}
                  <span aria-hidden="true">→</span>
                </a>
              </li>
              <li>
                <div>
                  <h3>Practice a coding pattern</h3>
                  <p>
                    Solve a problem, explain the invariant and complexity, then
                    test an edge case.
                  </p>
                  <p className="prep-count">
                    {done.size} of {codingProblemIds.size} practiced
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => choose("coding")}
                >
                  Browse problems <span aria-hidden="true">→</span>
                </button>
              </li>
              <li>
                <div>
                  <h3>Revisit a recall topic</h3>
                  <p>
                    Pick a weak area and answer a few cards at your own pace.
                  </p>
                  <p className="prep-count">
                    {
                      recallCards.filter((card) => study.schedules[card.id])
                        .length
                    }{" "}
                    of {recallCards.length} cards rated
                  </p>
                </div>
                <button
                  className="secondary-button"
                  onClick={() => choose("recall")}
                >
                  Browse topics <span aria-hidden="true">→</span>
                </button>
              </li>
            </ol>
          </section>
          <section className="prep-design" aria-labelledby="prep-design-title">
            <h2 id="prep-design-title">System design rounds</h2>
            <p>
              State the constraints, estimate the load, and defend your first
              design. Follow-ups vary from round to round.
            </p>
            <p className="prep-count">
              {Object.keys(scenarioQuestions).length} questions ·{" "}
              {study.practice.history.length} rounds completed
            </p>
            <ul className="prep-families">
              {scenarioFamilies.map((family) => (
                <li key={family.id}>
                  <button onClick={() => onScenario(family.id)}>
                    <span>
                      <strong>{family.name}</strong>
                      <small>{designFocus[family.id]}</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="mock-entry">
              <span>
                <strong>Timed mock: food delivery</strong>
                <small>
                  Blank brief, one late change, and a debrief by criterion
                </small>
              </span>
              <a className="secondary-button" href="?view=mock" onClick={onMock}>
                {study.mock?.current ? "Resume mock" : "Start mock"}
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <details className="mock-outline">
              <summary>20-minute guided practice</summary>
              <p>
                These branches train individual decisions. They supply a
                baseline and feedback between questions, so they are not a
                complete interview simulation.
              </p>
              <ol>
                <li>
                  Spend 3 minutes clarifying requirements and the main workload.
                </li>
                <li>
                  Spend 6 minutes on the API, data model, and request flow.
                </li>
                <li>
                  Spend 8 minutes on follow-ups about scale, failures, or
                  correctness.
                </li>
                <li>
                  Use the last 3 minutes to explain a trade-off and compare with
                  the rubric.
                </li>
              </ol>
            </details>
            <details className="mock-outline">
              <summary>Practice a complete design without hints</summary>
              <p>
                Start on blank paper with a prompt such as “Design an order
                and delivery tracking service.” Keep the cards and diagrams
                closed until you finish. Use the following 40-minute outline
                as a practice plan, not an employer scoring rubric.
              </p>
              <ol>
                <li>
                  <strong>Scope, 5 minutes.</strong> Identify users and the two
                  or three essential actions. Ask about scale, latency,
                  freshness, durability, and what is out of scope. State your
                  assumptions when no interviewer is available.
                </li>
                <li>
                  <strong>Estimate, 5 minutes.</strong> Calculate average and
                  peak requests per second, bytes per write, and retained data.
                  For example, 1 million daily users × 10 reads / 86,400 is
                  about 116 reads/s on average; a stated 10× peak assumption
                  gives about 1,160 reads/s. These are workload estimates, not
                  server counts or benchmark results.
                </li>
                <li>
                  <strong>Design, 10 minutes.</strong> Define example API
                  requests and responses, entity keys, and indexes for the
                  actual queries. Trace a write and a read through the simplest
                  architecture. Say when a write is acknowledged and which
                  component owns the durable truth.
                </li>
                <li>
                  <strong>Challenge it, 15 minutes.</strong> Change one
                  assumption: 10× peak load, a hot customer, a timeout after a
                  commit, or a failed region. Trace a concrete failure and
                  recovery. Explain the correctness boundary, bottleneck,
                  operational cost, and a credible alternative to your choice.
                </li>
                <li>
                  <strong>Review, 5 minutes.</strong> Summarize the trade-offs,
                  permission checks, recovery limits, and metrics you would
                  watch. Then open the relevant cards to find missing reasoning.
                  Repeat later with a different workload and constraints.
                </li>
              </ol>
              <p>
                A useful self-check: can you walk through one request, explain
                what happens when each dependency fails, and defend why the
                design meets the requirements? A memorized diagram is not
                enough. Ask a practice partner to challenge your assumptions
                when possible.
              </p>
              <div className="sources">
                <a
                  href="https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Microsoft: technical interview expectations
                </a>
              </div>
            </details>
          </section>
        </div>
      ) : (
        <section className="prep-catalog" aria-labelledby="prep-catalog-title">
          <h2 id="prep-catalog-title" tabIndex={-1}>
            {panel === "recall" ? "Recall by topic" : "Coding checklist"}
          </h2>
          <p>
            {panel === "recall"
              ? "Drill cards on demand. Daily reviews handle spaced scheduling."
              : "Solve on LeetCode or in your editor, then use the reasoning check and mark the problem practiced."}
          </p>
          {panel === "coding" && (
            <details className="mock-outline coding-outline">
              <summary>Practice a 45-minute coding round</summary>
              <p>
                Pick an unpracticed problem, start a timer, and talk the whole
                time as if someone is listening. Treat the times as a practice
                plan, not an employer’s rubric.
              </p>
              <ol>
                <li>
                  <strong>Clarify, 5 minutes.</strong> Restate the problem. Ask
                  about input size, value ranges, duplicates, empty input, and
                  the exact output. Work one small example by hand.
                </li>
                <li>
                  <strong>Plan, 8 minutes.</strong> Say the brute-force approach
                  and its cost first. Then explain the better approach, the
                  invariant it keeps, and its time and space complexity before
                  writing code.
                </li>
                <li>
                  <strong>Code, 20 minutes.</strong> Write small, named pieces
                  and say what each one does. If time runs short, stub a helper
                  and say what it would return.
                </li>
                <li>
                  <strong>Test, 8 minutes.</strong> Trace one normal input
                  through your actual code. Then check boundaries, invalid
                  input, a very large input, and ties. Fix bugs out loud.
                </li>
                <li>
                  <strong>Wrap up, 4 minutes.</strong> Restate the complexity
                  and name one trade-off or improvement you would make next.
                </li>
              </ol>
              <p>
                Afterward, open the reasoning check and note anything you missed
                before marking the problem practiced.
              </p>
              <div className="sources">
                <a
                  href="https://careers.microsoft.com/v2/global/en/hiring-tips/technical-interviewing.html"
                  target="_blank"
                  rel="noreferrer"
                >
                  Microsoft: technical interview expectations{" "}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </details>
          )}
          <div className="prep-filters">
            <label>
              {panel === "recall" ? "Search cards" : "Search problems"}
              <input
                type="search"
                name="prep-search"
                autoComplete="off"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              {panel === "recall" ? "Recall topic" : "Coding pattern"}
              <select
                name="prep-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              >
                <option value="">
                  {panel === "recall" ? "All topics" : "All patterns"}
                </option>
                {(panel === "recall" ? recallTracks : codingTracks).map(
                  (track) => (
                    <option key={track.name}>{track.name}</option>
                  ),
                )}
              </select>
            </label>
            {panel === "coding" && (
              <label className="prep-check">
                <input
                  id="hide-practiced"
                  type="checkbox"
                  checked={hidePracticed}
                  onChange={(event) => setHidePracticed(event.target.checked)}
                />
                Hide practiced
              </label>
            )}
          </div>
          <p className="prep-count prep-results" role="status">
            {drillComplete && "Drill complete. "}
            {results === 0
              ? "No results. Try another search or filter."
              : `${results} ${panel === "recall" ? (results === 1 ? "card" : "cards") : results === 1 ? "problem" : "problems"}`}
            {panel === "coding" &&
              ` · ${done.size} of ${codingProblemIds.size} practiced`}
          </p>
          {recall.map((track, index) => {
            const rated = track.cards.filter(
              (card) => study.schedules[card.id],
            ).length;
            return (
              <Fragment key={track.name}>
                {recall[index - 1]?.topic !== track.topic && (
                  <h3 className="prep-group">{track.topic}</h3>
                )}
                <details
                  className="prep-track"
                  open={index === 0 || !!topic || !!query.trim()}
                >
                  <summary>
                    <span>{track.name}</span>
                    <span>
                      {rated
                        ? `${rated} of ${track.cards.length} rated`
                        : count(track.cards.length, "card")}
                    </span>
                  </summary>
              <div className="prep-track-actions">
                <button
                  className="secondary-button"
                  disabled={!!drill}
                  onClick={() => startDrill(track.cards)}
                >
                  Drill these cards
                </button>
              </div>
              <ul className="prep-items">
                {track.cards.map((card) => (
                  <li className="prep-card" key={card.id}>
                    <div>
                      <strong>{card.title}</strong>
                      <small>{card.difficulty}</small>
                    </div>
                    <button
                      className="text-button"
                      disabled={!!drill}
                      aria-label={`Practice ${card.title}`}
                      onClick={() => startDrill([card])}
                    >
                      Practice <span aria-hidden="true">→</span>
                    </button>
                  </li>
                ))}
              </ul>
                </details>
              </Fragment>
            );
          })}
          {coding.map((track, index) => (
            <details
              className="prep-track"
              key={track.name}
              open={index === 0 || !!topic || !!query.trim()}
            >
              <summary>
                <span>{track.name}</span>
                <span>{track.problems.length}</span>
              </summary>
              <ul className="prep-items">
                {track.problems.map((problem) => (
                  <li className="prep-problem" key={problem.id}>
                    <div className="problem-heading">
                      <a href={problem.url} target="_blank" rel="noreferrer">
                        <span className="problem-id">{problem.id}</span>{" "}
                        <span className="problem-title">{problem.title}</span>{" "}
                        <span aria-hidden="true">↗</span>
                        <span className="sr-only">
                          {" "}
                          on LeetCode, opens in a new tab
                        </span>
                      </a>
                      <label className="prep-check">
                        <input
                          type="checkbox"
                          checked={done.has(problem.id)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setStudy((value) => ({
                              ...value,
                              codingDone: checked
                                ? [
                                    ...new Set([
                                      ...(value.codingDone ?? []),
                                      problem.id,
                                    ]),
                                  ].sort((a, b) => a - b)
                                : (value.codingDone ?? []).filter(
                                    (id) => id !== problem.id,
                                  ),
                            }));
                            if (checked && hidePracticed)
                              requestAnimationFrame(() =>
                                document
                                  .getElementById("hide-practiced")
                                  ?.focus(),
                              );
                          }}
                        />
                        Practiced
                        <span className="sr-only"> {problem.title}</span>
                      </label>
                    </div>
                    <details className="problem-checkpoint">
                      <summary>Reasoning check</summary>
                      <p>{problem.checkpoint}</p>
                    </details>
                    {codingSolutions[problem.id] && (
                      <details className="problem-checkpoint problem-solution">
                        <summary>Reference solution in Python</summary>
                        <p className="small-note">
                          One clean approach, tested against known cases. Try
                          the problem first; equivalent solutions count.
                        </p>
                        <pre tabIndex={0} aria-label={`Python solution for ${problem.title}`}>
                          <code>{codingSolutions[problem.id]}</code>
                        </pre>
                        <button
                          type="button"
                          className="text-button"
                          onClick={(event) => {
                            const button = event.currentTarget;
                            navigator.clipboard
                              ?.writeText(codingSolutions[problem.id]!)
                              .then(() => {
                                button.textContent = "Copied";
                              })
                              .catch(() => {
                                button.textContent = "Copy failed";
                              });
                          }}
                        >
                          Copy code
                        </button>
                      </details>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </section>
      )}
    </main>
  );
}
