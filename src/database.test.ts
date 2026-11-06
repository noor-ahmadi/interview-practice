import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL policies isolate users and RPC writes are atomic, idempotent and versioned", async () => {
  const db = new PGlite();
  try {
    // Supabase supplies these roles and auth.uid(); fixtures model only that identity boundary.
    await db.exec(`create role anon; create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth, public to authenticated, anon;
      grant execute on function auth.uid() to authenticated, anon;
      insert into auth.users values ('00000000-0000-4000-8000-000000000001'), ('00000000-0000-4000-8000-000000000002');`);
    await db.exec(
      await readFile(
        new URL(
          "../supabase/migrations/202611060001_private_study.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      "set role authenticated; set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';",
    );
    const first = {
      schemaVersion: 1,
      schedules: { a: { dueAt: "tomorrow" } },
      reviews: [{ id: "a" }],
      notes: { a: "private note" },
    };
    const second = {
      ...first,
      reviews: [...first.reviews, { id: "b" }],
      notes: { a: "changed note" },
    };
    async function commit(request: number, version: number, payload = first) {
      return (
        await db.query<{ result: { status: string; version: number } }>(
          "select public.commit_study($1::uuid, $2, $3::jsonb) as result",
          [
            `00000000-0000-4000-8000-${String(request).padStart(12, "0")}`,
            version,
            JSON.stringify(payload),
          ],
        )
      ).rows[0]!.result;
    }
    assert.deepEqual(await commit(1, 0), { status: "saved", version: 1 });
    assert.deepEqual(await commit(1, 0), { status: "duplicate", version: 1 });
    await assert.rejects(commit(1, 0, second), /reused for different data/);
    assert.equal((await commit(2, 0, second)).status, "conflict");
    assert.deepEqual(await commit(3, 1, second), {
      status: "saved",
      version: 2,
    });
    // A second device using the same base version cannot overwrite the first.
    assert.equal((await commit(4, 1)).status, "conflict");
    assert.deepEqual(
      (
        await db.query<{ payload: unknown }>(
          "select payload from public.study_state",
        )
      ).rows[0]!.payload,
      second,
    );
    await assert.rejects(
      db.exec("update public.study_state set payload = '{}'::jsonb"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("select * from public.study_writes"),
      /permission denied/,
    );
    await db.exec(
      "set request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002'",
    );
    assert.equal(
      (await db.query("select * from public.study_state")).rows.length,
      0,
    );
    assert.deepEqual(await commit(1, 0), { status: "saved", version: 1 });
    assert.equal(
      (await db.query("select * from public.study_state")).rows.length,
      1,
    );
    await db.exec("set request.jwt.claim.sub = ''");
    await assert.rejects(commit(8, 0), /Authentication required/);
    await db.exec("set role anon");
    await assert.rejects(
      db.exec("select * from public.study_state"),
      /permission denied/,
    );
    await assert.rejects(commit(9, 0), /permission denied/);
  } finally {
    await db.close();
  }
});
