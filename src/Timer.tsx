import { useEffect, useState } from "react";

export function Timer({
  deadline,
  minutes,
  label,
  onToggle,
}: {
  deadline?: number;
  minutes: number;
  label: string;
  onToggle: (deadline?: number) => void;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!deadline) return;
    const time = Date.now();
    setNow(time);
    if (deadline <= time) return;
    const interval = window.setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= deadline) window.clearInterval(interval);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [deadline]);
  const seconds = deadline
    ? Math.max(0, Math.ceil((deadline - now) / 1000))
    : 0;
  return (
    <div className="scenario-timer">
      {deadline !== undefined && (
        <span role="timer" aria-label={label}>
          {seconds
            ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
            : "Time’s up"}
        </span>
      )}
      <button
        type="button"
        className="text-button"
        onClick={() => {
          const time = Date.now();
          setNow(time);
          onToggle(deadline ? undefined : time + minutes * 60 * 1000);
        }}
      >
        {deadline ? "End timer" : `${minutes} min timer`}
      </button>
    </div>
  );
}
