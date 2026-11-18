import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { codingProblemIds } from "./coding-content.ts";

test("every coding problem has one Python solution that states its cost", () => {
  const dir = new URL("./solutions/", import.meta.url);
  const ids = readdirSync(dir).map((file) => Number(file.replace(/\.py$/, "")));
  assert.deepEqual(ids.sort((a, b) => a - b), [...codingProblemIds].sort((a, b) => a - b));
  for (const id of ids) {
    const code = readFileSync(new URL(`${id}.py`, dir), "utf8");
    assert.match(code, /^# (Time|Every operation|get and put|addNum|Each operation)/, `${id}.py`);
    assert.match(code, /^class \w+/m, `${id}.py`);
  }
});
