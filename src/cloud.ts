import { createClient } from "@supabase/supabase-js";
import type { Study } from "./study.ts";
import { readStudy } from "./study.ts";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase = url && key ? createClient(url, key) : null;

export type RemoteStudy = { study: Study; version: number };
export type PendingWrite = {
  id: string;
  expectedVersion: number;
  study: Study;
};
export type CommitResult =
  | { status: "saved" | "duplicate"; version: number }
  | { status: "conflict"; version: number; payload: unknown };

export async function fetchStudy(): Promise<RemoteStudy | null> {
  if (!supabase) throw new Error("Account sync is not configured.");
  const { data, error } = await supabase
    .from("study_state")
    .select("payload, version")
    .maybeSingle();
  if (error)
    throw new Error(
      "Couldn’t load your saved practice. Your draft is still on this device.",
    );
  if (!data) return null;
  const study = readStudy(JSON.stringify(data.payload));
  if (!study)
    throw new Error(
      "This saved practice needs a different content version. Your draft is still on this device.",
    );
  return { study, version: data.version };
}

export async function commitStudy(write: PendingWrite): Promise<CommitResult> {
  if (!supabase) throw new Error("Account sync is not configured.");
  const { data, error } = await supabase.rpc("commit_study", {
    p_request_id: write.id,
    p_expected_version: write.expectedVersion,
    p_payload: write.study,
  });
  if (
    error ||
    !data ||
    !["saved", "duplicate", "conflict"].includes(data.status) ||
    !Number.isSafeInteger(data.version)
  )
    throw new Error(
      "Couldn’t sync. Your draft is saved on this device. Retry when connected.",
    );
  return data as CommitResult;
}
