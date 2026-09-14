# Mochi Board — design

## Architecture

One Node HTTP server handles a fixed static asset allowlist and JSON API. A small store owns loading, schema validation, a serialized mutation queue and atomic temporary-file replacement. Each transaction validates a complete candidate before publishing it; rejected input must not change live memory or disk. Keep the old snapshot if writing fails. Task command validation and snapshot import share field rules. JSON import is data only: no shell, path resolution or prototype merging.

The browser loads one board snapshot, renders using DOM text nodes and updates after successful API calls. It owns filters and dialog state; the server owns data validity. One pending mutation disables the submitting button and uses a visible error region. No optimistic deletion that can hide failed writes. Serve no external fonts, trackers or CDN dependencies.

## Interface contracts

Use the exact routes, status codes and data shape in spec-v1.md/current approved version. Tests exercise the launched process through HTTP rather than private handler functions. Internal file splits are implementation choices; avoid a framework or generic plugin architecture for this small example.

Startup emits `{"event":"listening","url":"http://127.0.0.1:<port>"}`. SIGTERM/SIGINT stops accepting requests and lets in-flight writes settle. Test processes use temporary files outside the source tree; normal user data lives in `.data/`, which must be ignored by Git.

## Visual direction

Subject: a person's everyday task board. Single job: capture a task, move it forward, and keep a visible record. Signature: small handmade mochi faces marking the three stages, with a dotted progress trail in the header. The rest of the page stays quiet and practical.

Tokens: paper blue `#F3F7FF`, ink `#273854`, coral `#ED7664`, honey `#F1C665`, lilac `#D6CFF3`, mint `#BEE3D0`; white cards; muted ink `#5A6981`; dark focus ring. Contrast must remain readable; pastel colors are fills, not body text. Display: `ui-rounded, "Hiragino Maru Gothic ProN", "Trebuchet MS", sans-serif` at 34px/700; body: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif` at 15px; small utility labels at 12px/600.

Desktop: 216px side rail with a compact mochi mark, Board/Recent activity anchors and a local-save note. Main area has a friendly header, a single toolbar and three equal columns; recent activity is a compact section below. Main maximum width 1280px. Cards use 16px radius and a thin blue-grey border, restrained shadow, a colored priority chip and two or three clear actions. No giant statistics grid, gradients, sales-page hero or fake team avatars.

Mobile at 390px: collapse rail into a small top bar, wrap toolbar cleanly and stack columns. Dialog fits the viewport, content scrolls inside when needed. Motion is at most 120ms ease for hover/focus and is removed under prefers-reduced-motion.

```
[ mochi / Board ]  My board                 [ + Add task ]
[ Board        ]  a little progress trail
[ Activity     ]  [Search tasks........] [Priority] [Import] [Export]
[ saved locally]  [ To do      ] [ In progress ] [ Done      ]
                  [ task card ] [ task card   ] [ task card ]
                  Recent activity — concrete actions and times
```

Dialogs use native dialog or an equivalently complete accessible pattern: labelled heading, visible labels, validation feedback, Escape, focus containment and focus restoration. A status select gives keyboard users the same movement capability as pointer users. No drag-only interaction.

## Review concerns

Review storage atomicity/concurrent updates, untrusted JSON and DOM rendering, current-state error recovery, and usability. Do not add auth/cloud sync, enforce exact JSON serialization order or silently narrow field limits. The requirement describes a localhost single-user tool, so documented limits are assessed against that scope.

## Traceability and required review evidence

| Contract | Owner | Required evidence |
| --- | --- | --- |
| Create/read, validation, persistence | M1 | Frozen M1 HTTP tests; independent supplemental default port/data and parseable invalid persisted-state checks; source/runtime shutdown review |
| Update/delete, history, request/static boundary | M2 | Frozen M2 HTTP tests and independent source review |
| Accessible responsive board | M3 | Syntax Gate plus mandatory independent candidate-bound browser review and screenshots: create/edit/status/delete, keyboard Escape and focus restoration, combined filters, injection-safe text, failure recovery and 390px overflow |
| Atomic snapshots | M4 | Frozen M4/aggregate HTTP tests; browser import/export; supplemental import 415/413/foreign-Origin checks |
| Complete current app | M5 | All HTTP checks, current browser evidence, independent architecture/security/NFR review, unchanged dirty sentinel and verification-only claim |

The coordinator must not ingest a passing M3 review without the listed actual browser evidence. The review receipt binds the candidate and the report hash; this is a host evidence contract, not an automated interpretation of screenshots. Version 2 must demonstrate a notes-only, case-insensitive search match. At activation, public revise records new authority, preserves v1 evidence, and requires fresh M1/M2/M3/M4/M5 results. M5 declares only the runtime evidence path because task schema requires a nonempty allowed-path list; application edits are outside its path set and release admission independently requires a verification-only candidate.
