import type Anthropic from "@anthropic-ai/sdk";
import type { DiagramFrame, Question } from "./content.ts";
import type { PrivateCard, RecallCard } from "./cards.ts";
import { shortAnswers } from "./short-answers.ts";

// The learner asked for a low-cost model; Haiku is the current cheapest tier.
export const claudeModel = "claude-haiku-5-5";
export const keyStorage = "interview-practice:anthropic-key";

export function readKey() {
  try {
    return localStorage.getItem(keyStorage) ?? "";
  } catch {
    return "";
  }
}

export function writeKey(key: string) {
  try {
    if (key) localStorage.setItem(keyStorage, key);
    else localStorage.removeItem(keyStorage);
    return true;
  } catch {
    return false;
  }
}

// The SDK loads only when someone uses Ask Claude, so it stays out of the main bundle.
let sdk: typeof Anthropic | undefined;
async function load() {
  sdk ??= (await import("@anthropic-ai/sdk")).default;
  return sdk;
}

// The key stays in this browser and goes only to api.anthropic.com.
async function client(apiKey: string) {
  const Sdk = await load();
  return new Sdk({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

export async function checkKey(apiKey: string) {
  await (await client(apiKey)).models.retrieve(claudeModel);
}

export function isAbort(error: unknown) {
  return !!sdk && error instanceof sdk.APIUserAbortError;
}

export const coachPrompt = `You are a concise interview coach inside a practice app for software engineering interviews. The learner has already revealed the reference answer and now wants it explained or wants their own answer checked.

- The reference is one valid answer, not the only one. If the learner's answer is a valid alternative, say so plainly.
- When checking the learner's answer, say what is right, then what is missing or wrong and why, pointing at the specific step, line, or claim.
- When explaining the reference, give the core reason it works and the condition that would make it wrong.
- Do not invent facts about specific products, prices, or companies. Say when a point depends on an assumption.
- Keep it under about 250 words unless the learner asks for more. Write plain text with short paragraphs or "-" bullets, no headings or tables.`;

function section(name: string, text: string | undefined) {
  return text?.trim() ? `<${name}>\n${text.trim()}\n</${name}>` : "";
}

export function describeFrame(frame: DiagramFrame) {
  const names = new Map(frame.components.map((c) => [c.id, c.name]));
  return [
    ...frame.components.map((c) => `- ${c.name}: ${c.purpose}`),
    ...frame.connections.map(
      (e) => `- ${names.get(e.from)} -> ${names.get(e.to)}: ${e.label}`,
    ),
  ].join("\n");
}

export function cardContext(item: RecallCard | PrivateCard | Question) {
  const isScenario = "answerFrame" in item;
  return [
    section("question", item.prompt),
    "givens" in item ? section("givens", item.givens.join("\n")) : "",
    "rubric" in item ? section("rubric", item.rubric.join("\n")) : "",
    section("short_answer", shortAnswers[item.id]),
    section("reference_answer", item.explanation),
    "alternatives" in item ? section("other_valid_approaches", item.alternatives) : "",
    "pitfall" in item ? section("common_mistake", item.pitfall) : "",
    isScenario
      ? section("reference_architecture", describeFrame(item.answerFrame))
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type ClaudeTurn = { role: "user" | "assistant"; text: string };

export function friendlyError(error: unknown) {
  const Anthropic = sdk;
  if (!Anthropic) return "Couldn’t load Ask Claude. Check your connection and try again.";
  if (error instanceof Anthropic.AuthenticationError)
    return "Anthropic rejected this API key. Check it in Ask Claude settings.";
  if (error instanceof Anthropic.PermissionDeniedError)
    return "This API key isn’t allowed to use Claude Haiku 5.5.";
  if (error instanceof Anthropic.RateLimitError)
    return "Rate limited or out of credit. Wait a moment, or check your Anthropic billing.";
  if (error instanceof Anthropic.BadRequestError)
    return `Anthropic couldn’t accept the request: ${error.message}`;
  if (error instanceof Anthropic.APIConnectionError)
    return "Couldn’t reach Anthropic. Check your connection and try again.";
  if (error instanceof Anthropic.APIError)
    return `Anthropic returned an error (${error.status ?? "unknown"}). Try again.`;
  return "Something went wrong. Try again.";
}

// Streams one answer. Earlier turns go first so follow-up questions keep context.
export async function askStream(
  apiKey: string,
  context: string,
  turns: ClaudeTurn[],
) {
  const [first, ...rest] = turns;
  return (await client(apiKey)).messages.stream({
    model: claudeModel,
    max_tokens: 16000,
    output_config: { effort: "low" },
    system: coachPrompt,
    messages: [
      {
        role: "user",
        content: `${context}\n\n<learner_request>\n${first!.text}\n</learner_request>`,
      },
      ...rest.map((turn) => ({ role: turn.role, content: turn.text })),
    ],
  });
}
