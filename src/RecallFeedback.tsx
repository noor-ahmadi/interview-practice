import type { RecallCard, PrivateCard } from "./cards.ts";
import type { Question } from "./content.ts";

export function RecallFeedback({
  item,
}: {
  item: RecallCard | PrivateCard | Question;
}) {
  return (
    <>
      <p>{item.explanation}</p>
      {"rubric" in item && (
        <>
          <h3>Did you cover these?</h3>
          <ul className="recall-rubric">
            {item.rubric.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <details className="answer-details">
            <summary>Alternatives, pitfalls, and sources</summary>
            <h3>Other valid approaches</h3>
            <p>{item.alternatives}</p>
            <h3>Watch for</h3>
            <p>{item.pitfall}</p>
            <div className="sources">
              {item.sources.map((source) => (
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
          </details>
        </>
      )}
    </>
  );
}
