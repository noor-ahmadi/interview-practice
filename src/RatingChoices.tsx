import type { Grade } from "./content.ts";
import { intervalLabel } from "./scheduler.ts";

const meanings: Record<Grade, string> = {
  Again: "Missed a core point or needed the answer",
  Hard: "Correct without hints, but difficult",
  Good: "Correct without hints, with reasonable effort",
  Easy: "Correct without hints, with little effort",
};

export function RatingChoices({
  options,
  selected,
  onRate,
}: {
  options: { grade: Grade; dueAt: string }[];
  selected?: Grade;
  onRate: (grade: Grade) => void;
}) {
  const now = new Date();
  return (
    <fieldset className="rating">
      <legend>How did it go?</legend>
      <p className="small-note">
        Again: missed a core idea or needed a hint. Hard: correct but difficult.
        Rate your recall, not how familiar the revealed answer feels.
      </p>
      <div className="grade-buttons">
        {options.map(({ grade, dueAt }) => {
          const due = Date.parse(dueAt) <= now.getTime();
          const interval = due ? "Due now" : intervalLabel(dueAt, now);
          return (
            <button
              key={grade}
              type="button"
              aria-label={grade}
              aria-description={`${meanings[grade]}. ${due ? "Next review is due." : `Next review in ${interval}.`}`}
              aria-pressed={selected === grade}
              onClick={() => onRate(grade)}
            >
              {grade}
              <span className="grade-interval" aria-hidden="true">
                {interval}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
