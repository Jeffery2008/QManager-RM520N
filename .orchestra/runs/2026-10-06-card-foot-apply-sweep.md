# Run: Card-Foot Apply sweep
status: active
lane: full
base: 57e84ea5 (rebased onto development 266d1b57 after the chips merge)   branch: worktree-card-foot-sweep @ .claude/worktrees/card-foot-sweep   opened: 2026-10-06   lead: Sonnet 5.5

## Request
"Card-Foot Apply sweep. CardFoot exists, but 23 SaveButton sites haven't moved to it. 5 use the stock CardFooter, 4 use a local footer div, and the rest are elsewhere. Start with the Save-adjacent variant="outline" buttons (7 files, e.g. "Restore all" in band-grid-card). They move to ghost or tonal-neutral in the same change. Watchdog's page-level save bar is now superseded, so /monitoring/watchdog is the biggest single move. Group it by route family: cellular locking cards, local-network, then monitoring." Then: "start the sweep".

## Decisions taken — do not re-ask
- 2026-10-06 Version rotated to v0.1.17-draft, committed as 57e84ea5 on development at the user's request so the parallel chips branch could merge. Release-note bullets describe the planned result and must be re-checked against what ships.
- 2026-10-06 Gate: scope = ALL 21 non-exempt sites (user chose it over the three-family option). Watchdog footer goes on the Ladder card. Exempt: automation-tiles per-row, custom-profile-form wizard.
- 2026-10-06 Peer session "Switch to SegmentedField migration" first asked to fold Switch -> SegmentedField into this run, then withdrew it: session 49fca9 does it after this branch is committed and the worktree is clean. NOT in scope; convert no Switch.
- House shape (W1/W2): footer secondary actions are text-only (glyphs dropped); Discard is ghost, always rendered, disabled when clean; previously-outline buttons -> tonal-neutral.
- Routing: recon by qm-scout x2; builds by ui-builder (pin, no model arg). Frontend only: no modem-investigator, no installer auditor.

## Plan
| id | task | class | seat | write set | state |
|---|---|---|---|---|---|
| R-A/R-B | census (locking+local-network / monitoring+rest) | list | qm-scout | .orchestra/scratch/cardfoot-recon-{A,B}.md | ACCEPTED |
| W1 | cellular locking cards -> CardFoot; outline -> tonal-neutral | build | ui-builder | components/cellular/{band,frequency,tower}-locking/** | ACCEPTED, committed 7400831c |
| W2 | ttl, mtu, custom-dns, ip-passthrough -> CardFoot | build | ui-builder | components/local-network/** except ethernet/ | ACCEPTED, committed 7b65d7e1 |
| W4 | system-settings (4 cards) -> CardFoot | build | ui-builder | components/system-settings/** except scheduled-operations-card.tsx | ACCEPTED, committed cf7541a8 |
| W3 | watchdog footer on Ladder card, delete save-bar; alerts card footer | build | ui-builder | components/monitoring/**, locales common.json | ACCEPTED, committed a2c0c782 |
| W5 | imei, backup-imei, apn, mbn, network-priority, cellular-settings shared save, sms-forwarding | build | ui-builder | components/cellular/settings/**, cellular/sms/forwarding/**, locales cellular.json | ACCEPTED, committed 17c75e92 |
| V | blind verifier over 266d1b57..HEAD | verify | qm-verifier | none | DISPATCHED |
| D | docs-writer: DESIGN.md Migration Deltas, docs/reference/{band-locking,connection-watchdog}.md, release notes recheck | docs | docs-writer | docs, RELEASE_NOTES.md | PENDING |

## Attempts   (append-only)
| task | # | seat | ticket rev | outcome | checks run | evidence path |
|---|---|---|---|---|---|---|
| W1 | 1 | ui-builder | r1 | DONE_WITH_CONCERNS (glyphs removed; stale band-locking.md:663) | tsc 0, eslint 0, i18n 0 err, build 0 | commit 7400831c |
| W2 | 1 | ui-builder | r1 | DONE (Discard 42px vs Save 36px mismatch to check) | same | commit 7b65d7e1 |
| W4 | 1 | ui-builder | r1 | DONE | same | commit cf7541a8 |
| W3 | 1 | ui-builder | r1 | DONE_WITH_CONCERNS (watchdog-foot.tsx new; docs lines stale) | tsc 0, eslint 0 (sim-swap-banner error pre-existing, untouched), i18n 0 err, build 0 | commit a2c0c782 |
| W5 | 1 | ui-builder | r1 | DONE_WITH_CONCERNS (Cellular Settings footer on Network card, 3/3 tie; Reset label long) | same | commit 17c75e92 |

## Findings that survive
- Recon: .orchestra/scratch/cardfoot-recon-A.md and -B.md (gitignored; absent in a fresh checkout). 23 `<SaveButton` sites at 26de49ab, census held.
- band-locking.md:663 still says "an outlined Restore all supported": docs ticket must fix it.
- frequency-locking CARD_SHELL lacks `@container/card` (pre-existing); CardFoot there gets side padding from CARD_PAD.
- A worktree dev server cannot render any page: no modem behind it, auth redirects to /login then /setup. Visual proof needs the device.

## Device state
No device touched. Frontend-only change.

## Handoff — NEXT ACTION
All five build waves committed (7400831c, 7b65d7e1, cf7541a8, a2c0c782, 17c75e92); gates green. V (blind qm-verifier, diff 266d1b57..HEAD) DISPATCHED — do not re-dispatch; after its verdict run D (docs-writer: Migration Deltas rows, band-locking.md:663, connection-watchdog.md:371/406/418 still describe save-bar.tsx, RELEASE_NOTES recheck: scope is now all 21 sites + Cellular Settings footer on Network card), then close-out. Open defects found, out of scope, offer as spawned tasks: alerts-settings-card handleSave/handleTest read hook.error after await (stale closure, toast rule); imei-settings-card handleCopy uses navigator.clipboard not copyText. Then close-out AskUserQuestion (merge / PR / discard). Visual proof is not possible in the worktree: ask the user to run the tarball on the device, or sign in to the Browser pane against a live device. Flag in the summary: footer secondary actions lost their glyphs (visible change). Leave the worktree clean after the final commit so session 49fca9 can continue from this branch.
