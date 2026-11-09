# Interview Practice

A free practice app for system design and algorithms. Start with the [prep library](https://interview-practice-6u5.pages.dev/?view=library) for 72 recall cards by topic and a 42-problem LeetCode checklist. The 90 branching system-design questions cover food delivery, chat, URL shortening, news feeds, and file sync. Diagrams grow after each reveal, and the optional timer lets you run a 20-minute mock round.

Daily review uses FSRS with five new cards by default and a 90% recall target. Try it as a guest or sign in with Google to sync progress, notes, and private cards. The options menu has JSON backup and restore.

With Node 24 and pnpm, run `pnpm install` and `pnpm dev`. For local account sync, apply the Supabase migrations and set the public client variables in `.env.example`. Run `pnpm test`, `pnpm build`, and `pnpm test:e2e` to check changes.
