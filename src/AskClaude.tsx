import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import { askStream, friendlyError, isAbort } from "./claude.ts";
import type { ClaudeTurn } from "./claude.ts";

export const ClaudeSettings = createContext<{
  apiKey: string;
  openSettings: () => void;
}>({ apiKey: "", openSettings: () => {} });

// Learner text the model should see as the learner's own answer.
export function learnerSection(name: string, text: string | undefined) {
  return text?.trim()
    ? `<${name}>\n${text.trim()}\n</${name}>`
    : `<${name}>\n(The learner wrote nothing here.)\n</${name}>`;
}

export function AskClaude({
  context,
  presets,
  what,
}: {
  context: () => string;
  presets: string[];
  what: string;
}) {
  const { apiKey, openSettings } = useContext(ClaudeSettings);
  const id = useId();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<ClaudeTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [partial, setPartial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stream = useRef<Awaited<ReturnType<typeof askStream>> | null>(null);
  const latest = useRef("");

  useEffect(() => () => stream.current?.abort(), []);

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy) return;
    const asked: ClaudeTurn[] = [...turns, { role: "user", text }];
    setTurns(asked);
    setDraft("");
    setError("");
    setPartial("");
    latest.current = "";
    setBusy(true);
    try {
      const current = await askStream(apiKey, context(), asked);
      stream.current = current;
      current.on("text", (_delta, snapshot) => {
        latest.current = snapshot;
        setPartial(snapshot);
      });
      const message = await current.finalMessage();
      let reply = message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("")
        .trim();
      if (message.stop_reason === "refusal")
        reply ||= "Claude declined to answer this question.";
      else if (message.stop_reason === "max_tokens")
        reply += "\n\n(The answer stopped at the length limit.)";
      setTurns([...asked, { role: "assistant", text: reply || "(No answer.)" }]);
    } catch (problem) {
      if (isAbort(problem) && latest.current) {
        setTurns([
          ...asked,
          { role: "assistant", text: `${latest.current.trim()}\n\n(Stopped.)` },
        ]);
      } else {
        // Drop the unanswered question and give it back for a retry.
        setTurns(turns);
        setDraft(text);
        if (!isAbort(problem))
          setError(friendlyError(problem));
      }
    } finally {
      stream.current = null;
      setBusy(false);
      setPartial("");
    }
  }

  if (!open)
    return (
      <div className="ask-claude">
        <button
          type="button"
          className="secondary-button"
          onClick={() => setOpen(true)}
        >
          Ask Claude about {what}
        </button>
      </div>
    );

  return (
    <section className="ask-claude open" aria-labelledby={`${id}-heading`}>
      <div className="ask-head">
        <h3 id={`${id}-heading`}>Ask Claude</h3>
        <span>Claude Haiku 5.5 · your API key</span>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            stream.current?.abort();
            setOpen(false);
          }}
        >
          Close
        </button>
      </div>
      {!apiKey ? (
        <div className="ask-setup">
          <p>
            Ask Claude uses your own Anthropic API key. It is stored only in
            this browser.
          </p>
          <button type="button" className="primary-button" onClick={openSettings}>
            Add an API key
          </button>
        </div>
      ) : (
        <>
          <div className="ask-presets" role="group" aria-label="Suggested questions">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                disabled={busy}
                onClick={() => ask(preset)}
              >
                {preset}
              </button>
            ))}
          </div>
          {(turns.length > 0 || busy) && (
            <div className="ask-thread" aria-live="polite" aria-busy={busy}>
              {turns.map((turn, index) => (
                <p key={index} className={`ask-turn ${turn.role}`}>
                  <span className="sr-only">
                    {turn.role === "user" ? "You asked: " : "Claude: "}
                  </span>
                  {turn.text}
                </p>
              ))}
              {busy && (
                <p className="ask-turn assistant">{partial || "Thinking…"}</p>
              )}
            </div>
          )}
          {error && (
            <p className="form-message" role="alert">
              {error}
            </p>
          )}
          <form
            className="ask-form"
            onSubmit={(event) => {
              event.preventDefault();
              ask(draft);
            }}
          >
            <label htmlFor={`${id}-question`}>
              {turns.length ? "Ask a follow-up" : "Or ask your own question"}
            </label>
            <textarea
              id={`${id}-question`}
              rows={2}
              maxLength={2000}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  ask(draft);
                }
              }}
            />
            <div className="form-actions">
              {busy ? (
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => stream.current?.abort()}
                >
                  Stop
                </button>
              ) : (
                <button
                  type="submit"
                  className="secondary-button"
                  disabled={!draft.trim()}
                >
                  Ask
                </button>
              )}
            </div>
          </form>
          <p className="small-note">
            Sends {what}, its reference answer, and what you wrote for it to
            Anthropic. Answers can be wrong; check them against the sources.
          </p>
        </>
      )}
    </section>
  );
}
