import type { Grade } from "./content.ts";
import { intervalLabel } from "./scheduler.ts";

const meanings: Record<Grade, string> = {
  Again: "Missed the answer",
  Hard: "Recalled with effort",
  Good: "Recalled correctly",
  Easy: "Recalled immediately",
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
