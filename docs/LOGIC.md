# How Trust produces and protects every number

Four rules run through the whole system:

1. **AI reads, code counts.** The model only transcribes. Every total, average, trend and score is computed by plain, tested code.
2. **Every number has a source.** Each figure carries the ids of the lines behind it, and each line points to a region of its photo.
3. **Humans confirm uncertainty.** Nothing the AI was unsure about counts until the trader confirms it.
4. **The model is replaceable.** Reading goes through one function, so a fine-tuned model can be swapped in later.

## Discover

**Photos** are rotated upright, shrunk to 1800 px and re-encoded on the phone before upload, to save data. Each photo gets a 256-bit difference hash, a fingerprint of the page's shape, computed in the browser. The server also checks the file's bytes: only real JPEG, PNG, WebP or HEIC files are accepted, whatever the file name says.

**Mobile money messages** are read with fixed rules for MTN MoMo and Orange Money, in French and English (`core/discover/sms.ts`). The parser finds the amount, keeping it separate from fees and balances. It also finds the direction, date and time, transaction id, counterparty and phone. A message without a clear amount, direction or date is reported back to the trader with the reason. It is never guessed. Only messages with an unusual format are sent to the AI, and never messages without a date.

## Refine

The AI returns strict JSON, described by a JSON Schema sent with the request. That output is then validated again with zod (`core/refine/schema.ts`). The model is told to copy amounts as written and never do arithmetic. Code then applies these rules (`core/refine/validate.ts`):

- **Dates.** The date as written wins over the model's guess. Dates are read day first. A date written without a year takes the most recent year that is not in the future. Lines inherit the page's date heading.
- **Missing amounts.** When only a quantity and a unit price are written, code multiplies them and flags the line as calculated.
- **Arithmetic check.** If quantity times price does not match the written amount, the line is flagged.
- **Odd amounts.** Amounts that are not a multiple of 5 FCFA, or are above 5 million, are flagged.
- **Confidence.** Each flag lowers the line's confidence. Anything below 0.8 goes to the trader.
- **Written totals.** A daily total written by the trader is compared with the sum of the lines on that page.

A page cannot be confirmed while any line lacks a valid date or amount (`core/refine/flags.ts`). When the trader corrects a line, the AI's original reading is kept, so lenders can see what changed.

### Duplicates, in three layers

1. **Exact copies.** A photo with the same bytes is blocked. If it belongs to another business, the attempt is recorded as an integrity warning.
2. **Near copies.** A photo whose fingerprint differs by at most 14 of 256 bits is held back. The trader decides whether to keep it.
3. **Repeated content.** When at least 3 lines, covering 60% of the shorter page, repeat an earlier page, those lines are left out of the totals. The trader can declare the two pages different.

Mobile money duplicates are matched by transaction id, then by exact minute, then by identical text. Two genuine 2,000 FCFA payments on the same day are never merged.

## Organize

One function decides what counts (`core/organize/ledger.ts`). A line counts only when all of these hold:

- the trader confirmed it or added it
- it has a real date and a positive amount
- its page was not held back as a duplicate photo
- it does not repeat an earlier page

Every screen uses this function, so the numbers always agree.

Storage is a single JSON document with a folder of photos. Writes go through one queue and land atomically: the data is written to a temporary file, then renamed.

## Understand

`core/understand/profile.ts` computes:

- **Weeks.** Weeks run Monday to Sunday. A week with fewer than 6 days inside the record period counts as partial, and a week with no sales counts as a gap. Averages use full recorded weeks only.
- **Trend.** A least-squares slope over full weeks, expressed as change per 4 weeks. It needs at least 4 weeks. Growing means above +5%, declining means below −5%.
- **Consistency.** The coefficient of variation of weekly sales.
- **Items, weekdays and months.** Items are grouped by name, with quantities and units removed.

**Mobile money corroboration** (`corroborate.ts`) checks customer payments against the notebook in three passes:

1. **Exact.** A payment equals a single notebook line on the same day.
2. **Covered.** The rest of that day's recorded sales can absorb the payment.
3. **Near midnight.** A payment after 20:00 may be written on the next day's page, and one before 07:00 on the previous day's.

Deposits, meaning the trader's own cash-in, never count as sales.

**Evidence strength** (`strength.ts`) is not a credit score. It measures how well the numbers are backed:

| Component | Weight | Full marks when |
| --- | --- | --- |
| Coverage | 25 | 8 full weeks, with no gaps |
| Verification | 25 | Every line confirmed by the trader |
| Corroboration | 25 | Mobile money payments backed by notebook sales (needs at least 3 payments) |
| Consistency | 15 | Written daily totals match the lines. No totals at all scores half. |
| Integrity | 10 | No blocked duplicates, repeated lines, or reused photos |

## Questions

A lender's question is answered from an **evidence pack** (`ask.ts`). The pack holds the pre-computed totals and every counted line, each with a short citation code. The model must cite codes for every claim and never recommend a lending decision.

The answer is then audited:

- Citations that do not exist are removed.
- Any figure that cannot be traced to the pack, within 1%, is flagged to the reader.

## Privacy

A lender sees a profile only after the trader grants consent. Revoking consent kills the share code immediately. In the lender view, phone numbers are masked everywhere, including inside raw message text. Customer names are shortened to a first name and an initial (`core/privacy.ts`).
