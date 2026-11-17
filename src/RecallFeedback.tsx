import type { RecallCard, PrivateCard } from "./cards.ts";
import type { Question } from "./content.ts";
import { Check } from "./icons.tsx";

export function RecallFeedback({
  item,
}: {
  item: RecallCard | PrivateCard | Question;
}) {
  return (
    <>
      {"rubric" in item && (
        <>
          <p className="small-note">
            Compare your unaided answer. Equivalent correct approaches count.
          </p>
          <ul className="rubric-list recall-rubric">
            {item.rubric.map((point) => (
              <li key={point}>
                <span aria-hidden="true">
                  <Check />
                </span>
                {point}
              </li>
            ))}
          </ul>
        </>
      )}
      <p>{item.explanation}</p>
      {"rubric" in item && (
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
      )}
    </>
  );
}
