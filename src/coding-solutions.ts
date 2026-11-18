// Python reference solutions, one file per LeetCode problem number.
// scripts/check_solutions.py runs each one against known cases in CI.
const files = import.meta.glob("./solutions/*.py", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export const codingSolutions: Record<number, string> = Object.fromEntries(
  Object.entries(files).map(([path, code]) => [
    Number(/(\d+)\.py$/.exec(path)![1]),
    code,
  ]),
);
