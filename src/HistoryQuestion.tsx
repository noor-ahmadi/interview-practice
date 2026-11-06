import { useState } from "react";
import type { Grade, Question } from "./content.ts";

export function HistoryQuestion({
  question,
  notes,
  rating,
  onDiagram,
}: {
  question: Question;
  notes?: string;
  rating?: Grade;
  onDiagram: (question: Question, trigger: HTMLButtonElement) => void;
}) {
  const [answerOpen, setAnswerOpen] = useState(false);

  return (
    <article className="past-question">
      <div className="past-question-heading">
        <h3>{question.title}</h3>
        <span className="rating-label">{rating}</span>
      </div>
      <p>{question.prompt}</p>
      <ul className="past-givens">
        {question.givens.map((given) => (
          <li key={given}>{given}</li>
        ))}
      </ul>
      {notes ? (
        <div className="past-notes">
          <h4>Your notes</h4>
          <p>{notes}</p>
        </div>
      ) : (
        <p className="small-note">No written notes for this question.</p>
      )}
      <details
        className="past-answer"
        onToggle={(event) => setAnswerOpen(event.currentTarget.open)}
      >
        <summary>Review reference answer</summary>
        {answerOpen && (
          <>
            <p>{question.explanation}</p>
            <ul>
              {question.rubric.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            <button
              className="text-button"
              onClick={(event) => onDiagram(question, event.currentTarget)}
            >
              View reference diagram
            </button>
            <h4>Other valid approaches</h4>
            <p>{question.alternatives}</p>
            <h4>Watch for</h4>
            <p>{question.pitfall}</p>
            <div className="sources">
              <h4>Read the source</h4>
              {question.sources.map((source) => (
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
          </>
        )}
      </details>
    </article>
  );
}
