# Run: Button and field primitives to pill
status: active
lane: full
base: 62287c50   branch: (none yet: review stage)   opened: 2026-10-06   lead: Opus 5.5

## Request
"Button and field primitives. `button.tsx` is still `rounded-md` and 36px, while the canon says pill. `input`, `select` and `textarea` have the same gap. Fixing the primitives would remove the per-family `PILL_ACTION` constants (25 files) and the field overrides. This is the largest and riskiest change because it touches every route. It needs a visual review pass first, through `qm-redesign-review`." + "Lets properly plan out and implement these changes."

## Decisions taken — do not re-ask
- Recon + plan run under qm-redesign-review; build only after the Artifact gate.
- 2026-10-06 GATE (user, all as recommended): field corner = 10px rounded-field (not pill); add Button size="action" (42px, px-5, 600) and delete PILL_ACTION/PILL_ACTION_PLAIN; monitoring page actions 36->42 via size="action"; 44px coarse-pointer floor in the primitive on default + icon sizes. Bare fields growing 36->42 and losing the hairline follows from the field change (presented in the artifact, not objected to).
- Artifact (the brief): https://claude.ai/artifact/Du1ZetgEBj4hbRqDgvgKbq
- Main checkout had 6 uncommitted files (since committed by that session as of f135bd25) from a parallel session (radio/page-header.tsx, cellular-information-card.tsx, sms/message-dialog.tsx, at-terminal/transcript-row.tsx, ui/copyable-command.tsx, docs/reference/toast-confirmation.md). Do not touch or stage them.

## Plan
| id | task | class | seat | write set | state |
|---|---|---|---|---|---|
| R-A | call-site census (constants, inline overrides, sizes) | list | qm-scout | scratchpad/recon-census.md | ACCEPTED |
| R-B | canon extract (DESIGN/PRODUCT/globals/the101) | list | qm-scout | scratchpad/recon-canon.md | ACCEPTED |
| G | redesign-review Artifact + gate | judgment | conductor | scratchpad only | AT GATE: https://claude.ai/artifact/Du1ZetgEBj4hbRqDgvgKbq |
| W0 | primitives: button (pill base, size=action, coarse floor), input/select/textarea/input-group (42px, rounded-field, no border, fill, host prop) | build | ui-builder | components/ui/** | PENDING (gate) |
| W1-W3 | call-site sweep by family: cellular / local-network+monitoring / system-settings+rest | build | ui-builder | components/<family>/** | PENDING (gate) |
| V, D | qm-verifier; docs-writer (DESIGN.md deltas+Buttons+Inputs, ip-passthrough/ethernet/tower-locking select-height notes) | | | | PENDING |

## Attempts   (append-only)
| task | # | seat | ticket rev | outcome | checks run | evidence path |
|---|---|---|---|---|---|---|

## Findings that survive
- QManager-the101 button.tsx is rounded-pill but kept h-9; its input/select/textarea stay rounded-md.
- Local PILL_ACTION = "h-[2.625rem] gap-2 rounded-pill px-5 text-sm font-semibold" (42px, semibold).
- Canon: button pill at every size, default stays 36px, PILL_ACTION separate 42px recipe (DESIGN.md:203, :705). Fields are 10px rounded-field, 42px, no rest border (DESIGN.md:210, :782), NOT pill.
- PILL_ACTION defined in 24 files (16 identical); monitoring 5 families use a 36px/500 variant. 190/237 Buttons take a constant.
- BUG: TTL + MTU SaveButtons have no className -> 36px rounded-md beside 42px pill DISCARD (ttl-settings-card.tsx:531).
- Fields: pill in 8 families, 10px in 4, bare 8.4px+border in dialogs/onboarding. 15 dark:bg-*! markers, 9 h-[2.625rem]!, 13 data-[size=default]:h- overrides.
- Dev-server screenshots stay blank (hidden pane freezes entrance motion); DOM probes work.

## Device state
Not touched. Frontend-only run.

## Handoff — NEXT ACTION
At the gate. Review Artifact published (source: session scratchpad primitives-review.src.html). Waiting on 5 calls: field corner 10px vs pill; size="action" in primitive; monitoring 36->42; coarse 44px floor in primitive; bare fields grow 36->42. After answers: record them in Decisions, create worktree off development, W0 primitives first, then the three family waves.
