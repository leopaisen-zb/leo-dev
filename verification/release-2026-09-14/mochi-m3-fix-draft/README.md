# M3 repair draft

This is a draft only. The active Mochi fixture was not modified.

## Source identity before drafting

| File | SHA-256 |
| --- | --- |
| `public/app.js` | `0bf50f57f84e5315071b3a5a4e43ff4d5cb53c7725b2d94ab348e95f86bc8dac` |
| `public/index.html` | `e39a0a27b8c3f3fbb33c78c02883019f0c3b6e71d102e63f4f0b4053053cfe42` |
| `public/styles.css` | `ac9fc97174b5a653ff7c1bb945721211c207cff222b9cc7bc69153b505254a0f` |

## Draft identity

| File | SHA-256 |
| --- | --- |
| `public/app.js` | `c5618a520c78c4cc98d87c98b3a1cad36a9a8b2783dd6a8458f3d2d702df877e` |
| `public/index.html` | `c6c11a2e16e0ec142cc88abf93caad24c2b2f5742b33d01ee48a47930eb5420f` |
| `public/styles.css` | `ac9fc97174b5a653ff7c1bb945721211c207cff222b9cc7bc69153b505254a0f` |

`m3-repair.patch` is a unified patch for the frozen source identity. `patch --dry-run -p1 -d /private/tmp/leo-dev-mochi-OjZ5Xy < m3-repair.patch` succeeded against that source.

## Proposed changes

- Keep keyboard focus inside either native dialog on Tab and Shift+Tab. The handler is inactive while a dialog is closed, so Escape and normal page navigation remain native.
- Restore focus only to connected, enabled controls. Confirmed deletion uses Add task as its live logical target because the originating card control has been removed.
- Add a delete-modal error region and keep delete errors in that modal.
- Treat successful POST, PATCH, and DELETE responses as committed before attempting activity refresh. Update the local task state, render, close the relevant dialog, announce success once, and then refresh activity. A failed activity refresh shows a separate recoverable message and never leaves a create form ready to duplicate an already committed request.

Actual mutation failures still keep the editor values and form error visible. The draft preserves text-node rendering, combined notes/title search, priority filtering, current visual styles, and disabled Import/Export controls.

## Checks run

- `/Users/leo/.nvm/versions/node/v22.22.2/bin/node --check public/app.js` — passed on the draft.
- `patch --dry-run` applicability check — passed.

No server, browser, API, or independent acceptance check was run for this draft. The exact browser review matrix must run after a valid claim applies the patch.
