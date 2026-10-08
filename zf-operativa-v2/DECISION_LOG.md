# Decision log

## 2026-10-08 – isolated local pilot

- V2 uses its own `zf.v2.pilot.*` browser-storage keys and no longer reads or migrates legacy shift keys.
- Reset removes only V2 pilot storage, then restores the local starter roster and department setup.
- Problem solvers persist locally with the pilot and stay separate from department operators.

## 2026-10-08 – safe department dialogs

- Browser prompt and confirm windows were replaced by an accessible in-app dialog matching the visual system.
- Removing a department migrates current, home and starting assignments to Nezařazení, preventing return-to-start from recreating a removed department.
- Destructive actions use a distinct red treatment while ordinary confirmations retain the green operational accent.

## 2026-10-08 – configurable department workspace

- Departments are locally configurable: add, rename, reorder, hide and remove. Removing a department moves active operators to Nezařazení after confirmation.
- Transport and HOVS/ML are protected from removal; problem solvers remain outside department cards and notifications.
- A renamed department updates current, starting and home assignments plus background movement records, so no operator is lost.
- Occupied departments remain visible even when hidden in configuration, preventing a hidden state from concealing active operators.

## 2026-10-08 – roster, duplicates, problem solvers

- Roster names are normalized by whitespace and diacritics and duplicate entries are ignored before OCR.
- Shift creation and manual additions deduplicate names again as a final data-safety boundary.
- Problem solvers are stored separately from operators, never assigned to a department, and contribute only to Transport/HOVS-ML summary totals.
- Review completion has an explicit confirmation action so resolved OCR cases do not keep producing local review notices.
- Full test execution is environment-limited when native Canvas build scripts are disabled; changed domain tests, typecheck, and production build remain available.

## 2026-10-08 – compact operating interface

- The initial screen now prioritizes one action: load a photo and begin a shift.
- Persistent roster and problem solver maintenance remain available but are collapsed until needed.
- Repeated status blocks were reduced to a compact summary strip and active-shift totals use compact cards instead of a large dashboard.
- The layout takes inspiration from the reference application's command bar and quick totals without copying its dense multi-column people board.

## 2026-10-08 – manual shift board first

- The primary route starts a clean manual shift; OCR is an optional import instead of the first task.
- The live board uses a command bar, compact totals, an add-person control, search, and department cards.
- Empty manual shifts do not show an OCR review notification.
- The mobile layout collapses controls into a single-column workflow and keeps each department card readable.

## 2026-10-08 – permanent roster by team and shift

- The permanent roster persists locally and deduplicates names independently of formatting and diacritics.
- Each employee belongs to one permanent team and one A/B/C shift roster.
- Transport and VNA remain visually and operationally separate in the roster panel.
- Existing local roster records without a shift are migrated to shift A.

## 2026-10-08 – multi-page UI and bulk operator management

- Směna, Stálý stav, Historie and Import are separate UI sections so the operating board remains focused.
- Dragging an operator moves the selected group when the dragged operator is selected; otherwise only that operator moves.
- Bulk moves require confirmation, support select-all per department, return-to-start, and one-step undo.
- Figma now contains a separate ZF Design System page with editable typography styles and reusable navigation, button, operator-card and department-drop-target components.
- Movement history is intentionally hidden from normal navigation and retained only as background data for undo, audit and future reporting.
