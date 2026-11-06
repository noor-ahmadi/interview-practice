import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Study } from "./study.ts";
import type { PrivateCard } from "./cards.ts";

type Form = {
  id: string | null;
  title: string;
  prompt: string;
  explanation: string;
  topic: PrivateCard["topic"];
};
const empty: Form = {
  id: null,
  title: "",
  prompt: "",
  explanation: "",
  topic: "System design",
};

export function PrivateCards({
  study,
  setStudy,
  owner,
}: {
  study: Study;
  setStudy: Dispatch<SetStateAction<Study>>;
  owner: string;
}) {
  const key = `interview-practice:editor:${owner}`;
  const [form, setForm] = useState<Form>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(key) ?? "null");
      if (
        saved &&
        [saved.title, saved.prompt, saved.explanation].every(
          (v) => typeof v === "string",
        ) &&
        ["System design", "Algorithms"].includes(saved.topic) &&
        (saved.id === null || study.privateCards.some((c) => c.id === saved.id))
      )
        return saved;
    } catch {
      /* Start a clean form when storage is unavailable. */
    }
    return empty;
  });
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(form));
    } catch {
      setMessage(
        "Couldn’t preserve this unfinished draft. Keep this tab open until you save.",
      );
    }
  }, [form, key]);

  function edit(card: PrivateCard) {
    setForm(card);
    setMessage("");
    requestAnimationFrame(() => {
      document.getElementById("card-title")?.focus();
      window.scrollTo({ top: 0, behavior: "instant" });
    });
  }
  return (
    <>
      <main>
        <header className="session-heading">
          <div>
            <p className="section-label">Interview Practice / Your library</p>
            <h1 id="private-heading" tabIndex={-1}>
              Private cards
            </h1>
            <p className="scenario-subtitle">
              Add a question you want to remember. Keep one idea per card.
            </p>
          </div>
          <span className="question-count">
            {study.privateCards.length} private{" "}
            {study.privateCards.length === 1 ? "card" : "cards"}
          </span>
        </header>
        <div className="editor-layout">
          <form
            className="card-editor"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.id && study.privateCards.length >= 2000) {
                setMessage(
                  "This workspace has reached its 2,000-card limit. Edit an existing card instead.",
                );
                return;
              }
              const now = new Date().toISOString();
              const card: PrivateCard = {
                id: form.id ?? `private:${crypto.randomUUID()}`,
                title: form.title.trim(),
                prompt: form.prompt.trim(),
                explanation: form.explanation.trim(),
                topic: form.topic,
                updatedAt: now,
              };
              if (!card.title || !card.prompt || !card.explanation) {
                setMessage(
                  "Fill in the title, question, and reference answer.",
                );
                return;
              }
              setStudy((s) => ({
                ...s,
                privateCards: s.privateCards.some((c) => c.id === card.id)
                  ? s.privateCards.map((c) => (c.id === card.id ? card : c))
                  : [...s.privateCards, card],
              }));
              setForm(empty);
              setMessage("Card saved. It can join your next daily queue.");
            }}
          >
            <h2>{form.id ? "Edit card" : "New card"}</h2>
            <label htmlFor="card-title">Title</label>
            <input
              id="card-title"
              name="title"
              autoComplete="off"
              required
              maxLength={160}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <label htmlFor="card-topic">Topic</label>
            <select
              id="card-topic"
              name="topic"
              value={form.topic}
              onChange={(e) =>
                setForm({ ...form, topic: e.target.value as Form["topic"] })
              }
            >
              <option>System design</option>
              <option>Algorithms</option>
            </select>
            <label htmlFor="card-question">Question</label>
            <textarea
              id="card-question"
              name="question"
              autoComplete="off"
              required
              maxLength={10000}
              value={form.prompt}
              onChange={(e) => setForm({ ...form, prompt: e.target.value })}
            />
            <label htmlFor="card-answer">Reference answer</label>
            <textarea
              id="card-answer"
              name="answer"
              autoComplete="off"
              required
              maxLength={20000}
              value={form.explanation}
              onChange={(e) =>
                setForm({ ...form, explanation: e.target.value })
              }
            />
            <p className="small-note">
              Include the reasoning and a common mistake. Editing preserves the
              card’s review schedule.
            </p>
            <div className="form-actions">
              <button className="primary-button" type="submit">
                Save private card
              </button>
              {form.id && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setForm(empty);
                    setMessage("");
                  }}
                >
                  New card
                </button>
              )}
            </div>
            <p className="form-message" role="status">
              {message}
            </p>
          </form>
          <section
            className="private-library"
            aria-labelledby="private-list-heading"
          >
            <h2 id="private-list-heading">Your cards</h2>
            <p className="small-note">
              Visible only in your own workspace. Sign in to save across
              devices.
            </p>
            {!study.privateCards.length ? (
              <p className="empty-library">
                No private cards yet. Your first card starts here.
              </p>
            ) : (
              <ul>
                {study.privateCards.map((card) => (
                  <li key={card.id}>
                    <div>
                      <h3>{card.title}</h3>
                      <p>
                        {card.topic} ·{" "}
                        {study.schedules[card.id] ? "In review" : "New"}
                      </p>
                    </div>
                    <button
                      className="text-button"
                      aria-label={`Edit ${card.title}`}
                      onClick={() => edit(card)}
                    >
                      Edit
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
      <footer className="app-footer">
        <p>Small questions. Clear reasoning.</p>
        <span>Unfinished drafts stay on this device</span>
      </footer>
    </>
  );
}
