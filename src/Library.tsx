import { useRef, useState } from "react";
import type { Dispatch, MouseEvent, SetStateAction } from "react";
import { recallCards } from "./cards.ts";
import type { RecallCard } from "./cards.ts";
import { codingProblemIds, codingTracks } from "./coding-content.ts";
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
  onScenario,
}: {
  study: Study;
  setStudy: SetStudy;
  onReview: (event: MouseEvent<HTMLAnchorElement>) => void;
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
            <details className="mock-outline">
              <summary>20-minute mock outline</summary>
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
          {recall.map((track, index) => (
            <details
              className="prep-track"
              key={track.name}
              open={index === 0 || !!topic || !!query.trim()}
            >
              <summary>
                <span>
                  {track.name}
                  <small>{track.topic}</small>
                </span>
                <span>{track.cards.length}</span>
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
          ))}
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
                        {problem.title} <span aria-hidden="true">↗</span>
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
