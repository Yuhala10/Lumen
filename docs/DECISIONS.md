# Decision log

Each decision, with its reason. Newest last.

**2026-09-30: Build Trust only.** The wider Lumen vision, an Africa-wide intelligence graph, was too broad for a one-week build. Trust proves the core: evidence from messy real-world records that a lender can rely on.

**Trust is the evidence layer, not the lender.** Lending needs capital, licences and risk appetite. Trust sells verified profiles to lenders and microfinance institutions, who bring the money.

**Cameroon first.** The build targets FCFA amounts, French and English, MTN MoMo and Orange Money, and day-first dates. The interface is bilingual and follows the browser's language, with a switch in the header.

**Use an existing model, not a trained one, for now.** Training a model that understands handwriting is out of reach for a zero budget and one week. The Gemini free tier reads well. Every confirmed photo becomes training data for a specialised model later, and the reader is a single swappable function.

**Call Gemini over plain HTTPS, not the SDK.** This means one less package to download on a slow connection, and full control over retries, fallback and time limits.

**Rules first for mobile money.** SMS templates are fixed, and rules never hallucinate. The AI only sees messages the rules could not place.

**Evidence strength, not a credit score.** Trust describes how well the numbers are proven. The lender decides. The question box is told never to recommend a lending decision.

**Consent before anything.** Profiles are private until the trader shares a code. Revoking kills the code. The lender view masks phone numbers.

**Local JSON storage behind a small interface.** It needs zero accounts and zero cost, and it works offline. Writes are atomic and serialised. On Vercel it falls back to the temporary folder, which suits a demo but is not durable. **Next step:** implement `readDb`, `mutate` and the three upload functions against a hosted database, such as Supabase's free tier with Postgres and storage.

**No UI component or icon libraries.** Primitives and about 50 icons are hand-built. That keeps downloads small and gives full control over the look.

**Next.js 16, TypeScript, Tailwind CSS 4, Motion and zod.** These are the only runtime dependencies besides React.

**The core has no framework.** `src/core` is plain TypeScript, tested with Node's built-in test runner. The logic can move to a mobile app, a worker or another server unchanged.
