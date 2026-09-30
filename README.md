# Trust

**Your notebook is your credit history.**

Trust turns the handwritten records of Cameroon's market traders into a business profile a lender can check line by line. A trader photographs notebook pages and receipts and pastes mobile money messages. The AI reads every line, and the trader confirms or corrects it. Plain code then computes sales, trends and an evidence strength score. Every number opens the exact page and line behind it, highlighted.

Trust is the evidence layer, not the lender. Nothing is shared without the trader's consent.

## Run it

You need Node.js 20.9 or newer.

```bash
npm install
npm run dev
```

Open http://localhost:3000. Four demo businesses load automatically: Estelle in Yaoundé, Joseph in Douala, Brenda in Bamenda and Aïcha in Garoua.

### Turn on AI reading

1. Create a free key in Google AI Studio.
2. Open `.env.local` and paste it after `GEMINI_API_KEY=`.
3. Restart `npm run dev`.

Without a key, everything works except reading new photos and asking questions. Photos are saved and can be read later. To try the full pipeline without a notebook, use **Try a practice page** on the Add records screen.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Unit tests for the core logic |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |

## How the code is organised

The code follows the four stages of the pipeline: **Discover, Refine, Organize, Understand**.

```
src/
  core/                 Pure TypeScript. No framework, fully unit-tested.
    discover/           Reading mobile money SMS with fixed rules
    refine/             AI output schemas, validation, flags, duplicate detection
    organize/           The single rule for which lines count
    understand/         Profile maths, mobile money corroboration, evidence strength, Q&A audit
    demo/               Deterministic demo businesses and notebook page layout
  server/               Storage, the Gemini client, the AI reader, and services
  app/                  Pages and API routes (Next.js App Router)
  components/           UI: primitives, evidence viewer, profile report, trader and lender screens
  lib/                  Formatting, English and French dictionaries, browser helpers
docs/                   Logic, design system and decision log
```

## Deploying

The app deploys to Vercel as a standard Next.js project. Add `GEMINI_API_KEY` in the Vercel project settings under Environment Variables.

On Vercel, data lives in the server's temporary folder. The demo businesses always load, but anything created on the hosted version can disappear when the server restarts. For real use, connect a hosted database by reimplementing the small interface in `src/server/store.ts`. See `docs/DECISIONS.md`.

## Read more

- [docs/LOGIC.md](docs/LOGIC.md): how every number is produced and protected
- [docs/DESIGN.md](docs/DESIGN.md): the design system
- [docs/DECISIONS.md](docs/DECISIONS.md): why things are the way they are
