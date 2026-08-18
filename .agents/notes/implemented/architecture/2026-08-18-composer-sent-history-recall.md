# Agent Note: Composer sent-message history recall (terminal-style ↑/↓)

Status: implemented

## Problem

Users expect the composer input box to recall previously sent messages with the ↑/↓ arrow keys, terminal-style: pressing ↑ in a fresh draft fills the newest sent message, further ↑ walks older, and ↓ walks forward again to the draft. Without it, re-sending a similar message means retyping or copying it from the transcript.

The naive reading — "↑/↓ unconditionally move the draft through a stack of sent messages" — breaks the input's existing contracts. The arrow keys are also multi-line caret navigation, the input runs through an IME that must stay untouched mid-composition, and the machine's self-managed undo log must not treat history browsing as an edit transaction (undo would otherwise resurrect a browsed draft as if it were typing).

## Decision

The composer keeps a per-session sent-message history in the input machine and browses it with ↑/↓ under a strict first-line / last-line gate.

### State

Four new `InputState` members, published by the machine like the rest of the state:

- `history: readonly string[]` — plain-text projection of sent messages, newest last, bounded by `HISTORY_LIMIT` (50). Consecutive duplicates collapse; blank/whitespace-only sends never record.
- `historyIndex: number` — browsing cursor: `-1` is normal draft mode, else an index into `history`.
- `historyDraft: string` — the draft saved when browsing began, restored past the newest entry.
- `historyDraftOccurrences` (machine-internal, not published) — the occurrence table saved with `historyDraft`, so returning to the draft also restores its reference chips.

### Events and machine behavior

Two new events, `history-prev` (↑) and `history-next` (↓), both no-ops unless the phase is `plain`:

- `history-prev` with `historyIndex === -1` enters browsing: saves `historyDraft` + `historyDraftOccurrences`, clears the live occurrences, and adopts the newest entry. Subsequent ↑ steps older; at the oldest entry it stops.
- `history-next` with `historyIndex === -1` is a no-op (nothing to step out of). Otherwise it steps newer; past the newest entry it restores `historyDraft` with its occurrences and returns to `historyIndex === -1`.
- `send-committed` records `projectClipboard(state)` into `history` before clearing the draft, exactly like the ordinary-send commit: no undo unit is pushed and the undo log is cut, so sent content is never resurrectable. Blank and duplicate sends skip the push; the stack trims to `HISTORY_LIMIT` by dropping the oldest.
- A user `draft-changed` while browsing drops the cursor back to `-1` (the saved `historyDraft` is kept; only the cursor is reset), so typing from a recalled entry behaves like normal editing.

### Keyboard arbitration (InputBar)

The keydown handler keeps the existing `keyboard.arbitrate('up'|'down', composing)` first: an open menu consumes the arrows for menu navigation. Only a `'pass'` outcome with no IME composition reaches history recall, and only when the caret is on the first line (↑) or the last line (↓) of the draft — `draft.slice(0, caret)` / `draft.slice(caret)` containing no newline. This protects multi-line caret movement: a caret mid-draft still moves by line, and only a caret that cannot move further in that direction recalls history. On a successful recall the handler `preventDefault`s and parks the caret at the end of the recalled draft. `historyPrev()` / `historyNext()` on `ComposerKeyboard` return whether the cursor actually moved, which is what tells the caller to prevent defaults.

## Implementation notes

- **Recording uses the clipboard projection**: `onSendCommitted` calls `projectClipboard(this.state)` so a draft holding U+FFFC placeholders records the same plain text the persistence mirror and clipboard write — chips never leak into history, and recalling reproduces a sendable draft.
- **Navigation adopts without `pushTxn`**: ↑/↓ call `adopt()` directly, so no undo unit is recorded and the undo log is untouched. Combined with the commit-time log cut, undo can never walk through browsed drafts or resurrect sent content.
- **Occurrence freezing is immutable-array compatible**: entering browsing snapshots `occurrences` into `historyDraftOccurrences` and clears the live table; restoring reassigns the snapshot. The occurrence reconciliation already treats the table as immutable (`[...]` + map), so a saved snapshot is safe to hold and reinstall.
- **Phase guard**: only `plain` responds, so ↑/↓ never interrupt `adjudicating` / `claimed` / `submitting`.
- **IME**: `composing` (including the legacy `keyCode === 229` signal) excludes the whole arrow-recall branch, as it does for space/enter.

## Testing

The machine behavior is covered by pure-JS event-sequence tests in `packages/client/ui-conversation/tests/input-machine.client.spec.ts` (no React): empty-history no-ops; send recording including the chip projection, consecutive-duplicate collapse, and blank-send skip; ↑ entering browsing and saving the draft; repeated ↑ stopping at the oldest entry; ↓ stepping forward; ↓ past the newest restoring `historyDraft` with its occurrences; a user edit while browsing dropping the cursor; the `HISTORY_LIMIT` eviction; and the phase guard (`claimed` / `adjudicating` / `submitting` reject both events).

## Alternatives considered

- **Respond to ↑/↓ unconditionally**: rejected — the arrows are native multi-line caret movement; recalling on every arrow press would make it impossible to move the caret by line inside a long draft. The first-line / last-line gate keeps caret semantics intact and only recalls where the arrow has nowhere to move.
- **Record history navigation in the undo log**: rejected — browsing is not an edit; an undo unit would let Ctrl/Cmd-Z resurrect a recalled draft as if it were typed, and the commit-time log cut exists precisely to make sent content non-resurrectable. Navigation adopts the draft without a transaction instead.
- **A larger or unbounded history**: rejected — `HISTORY_LIMIT` (50) bounds the per-session memory and matches the recall use case (recent sends); the stack trims oldest-first and never grows unboundedly.
- **Recall on any phase**: rejected — `plain` only, so a pending command claim, adjudication, or in-flight submit is never displaced by navigation.

## Consequences

- Terminal-style recall works without new UI: the ↑/↓ keys already reach the machine through `ComposerKeyboard`, and the first-line / last-line gate preserves multi-line caret movement, so no caret or IME behavior regressed.
- Recalled drafts are plain text by construction (the clipboard projection is recorded), so a recalled entry is always a sendable message even when the original held reference chips — chips degrade to text in history, matching the existing refresh/chip semantics.
- Browsing never touches the undo log: undo stays a pure editing history, and the commit-time log cut still guarantees sent content is never resurrectable.
- Per-session memory cost is bounded at `HISTORY_LIMIT` entries of plain text; the machine already holds the draft and occurrence table, so the added state is minimal.
- Arrow recall only fires from a `'pass'` arbitration, so a menu that wants ↑/↓ for navigation keeps them; the menu remains authoritative over the arrows while open.
