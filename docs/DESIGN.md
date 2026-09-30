# Design system

Trust has to look trustworthy, work on a cheap Android phone on slow data, and feel calm to a loan officer at a desk.

## Signature

One idea runs through the product: **the highlighter.** Any number can be traced to a line on a page. That line is marked with a yellow highlighter stroke that sweeps across it, the way a person marks a notebook. The logo is the same idea: a page of three lines with the middle one highlighted.

## Tokens

All colours are CSS variables in `src/app/globals.css`, with a separate dark palette. Components never use raw colours.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | #f6f3ec | #0c110f | Warm paper background |
| `--surface` | #ffffff | #131a17 | Cards |
| `--ink` | #15201a | #e8eee8 | Text |
| `--brand` | #0e6b4f | #3dbb8a | Trust green: actions, confirmed |
| `--marker` | yellow at 58% | yellow at 46% | Evidence highlight |
| `--good`, `--warn`, `--danger` | | | Status. Always shown with an icon and words. |
| `--chart-1`, `--chart-2` | #0b7d57, #6a5acd | #2e9e72, #8b7fe0 | Charts, validated for colour-blind readers |

## Type

- **Instrument Serif** for page titles and names.
- **Geist** for everything else, including every number.
- **Kalam** for handwriting on notebook pages.

Tabular figures are used only where numbers line up in columns.

## Motion

Motion is short, eased, and never needed for understanding. Durations are 180 to 640 ms, using a single ease-out curve. Everything respects the system's reduced-motion setting. The animation library loads its small feature set lazily.

## Charts

Charts follow the data-visualisation rules:

- one series per chart, and no dual axes
- bars at most 24 px wide, rounded only at the top
- hairline grids
- one direct label, on the best week
- a tooltip on hover and keyboard focus
- a table view with every value

The two-colour mobile money bar was checked with a colour-blindness validator in both themes.

## Layout

- **Phones first.** The trader's screens are designed for a 360 px phone. Actions sit at the bottom within thumb reach, and evidence opens as a bottom sheet you can drag down to close.
- **Lenders on a desk.** On desktop, the lender report uses two columns, with the evidence strength card and questions pinned on the right. Evidence opens as a side panel.
- **Print.** Printing produces a clean report without controls.
