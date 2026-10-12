# Run: Sites "Now" live mode + Dota 2 mark
status: active
lane: full
base: a8249a38   branch: development (worktree after gate)   opened: 2026-10-12   lead: opus

## Request
"yes go ahead, include the Dota 2 icon" — on: a default "Now" tab on the Sites card that, while open and visible, refreshes about every 2 s; leaving it returns to the normal cadence. Live checks connect-only every 2 s plus a full HTTPS check every 30 s (as proposed before measurement).

## Decisions taken — do not re-ask
- "Now" is the first and default range tab; shows the latest value per site, no live chart.
- Live samples never enter raw/rollups/history; normal interval_sec sweeps keep feeding history.
- Leasing: the page's `?range=now` GET renews a lease; the daemon goes live only while the lease is < ~10 s old.
- Dota 2: add `SiDota2` row to SITE_MARKS (dota2.com favicon is 16 px, rejected by FAVICON_MIN_PX).
- GATE 2026-10-12: "2 s HTTP, no HTTPS (Recommended)" — live probe = HTTP HEAD on port 80 every ~2 s, NO 30 s HTTPS check (~25 MB/h, ~+25% CPU, measured).
- DEVICE 2026-10-12: user chose "Yes, deploy and restart" — deploy qmanager_sites + sites.sh to RM520N-GL, restart qmanager-sites.service; new version stays installed.
- Worktree: .claude/worktrees/wt+sites-now-live, branch worktree-wt+sites-now-live, BASE a8249a38.

## Plan
| id | task | class | seat | write set | state |
|---|---|---|---|---|---|
| T1 | daemon live loop + CGI range=now/lease | build | cgi-endpoint-builder | scripts/usr/bin/qmanager_sites, scripts/www/cgi-bin/quecmanager/monitoring/sites.sh | DISPATCHED |
| T2 | "Now" tab, 2 s visible-only polling, Dota 2 mark, i18n | build | ui-builder | types/sites.ts, hooks/use-sites.ts, components/monitoring/latency-monitoring/**, public/locales/** | DISPATCHED |
| T3 | docs rows | docs | docs-writer | docs/reference/sites-monitor.md, latency-monitor.md | PENDING |

## Attempts   (append-only)
| task | # | seat | ticket rev | outcome | checks run | evidence path |
|---|---|---|---|---|---|---|

## Findings that survive
- RM520N-GL bash is 3.2.57: NO `EPOCHREALTIME`, NO `declare -A`; `date +%s%N` prints a literal `%N`. ms timing must come from curl `-w`.
- Device curl 8.12 protocols: file ftp ftps http https ipfs ipns ws wss — no telnet, no --connect-only.
- Measured per-site cost on rmnet_data0 (13 sites, 2 rounds): HTTPS HEAD ~8.8 KB; HTTP HEAD port 80 (`--resolve` to cached IP) ~1.1 KB, all 13 rc 0; plain HTTP to :443 ~0.8 KB but rc 52/56/1 mixed.
- CPU: single core; 13 parallel port-80 HEADs every ~2 s raised total CPU 29% → 54% (~+25 points) while running.
- `/tmp/qmanager_sites*` is not referenced by install/uninstall (tmpfs).

## Device state
RM520N-GL (61368cd2) reachable; RG501Q-EU unreachable 2026-10-12. Only read-only probes run from /tmp, self-deleted. Nothing deployed.

- T1 DONE_WITH_CONCERNS (proof: .orchestra/scratch/sites-now-live-proof2.txt, -proof3-cgi.txt). Ticks 1.7–2.5 s apart, stop ~11 s after last lease. Conductor fixed concern 1 inline in sites.sh: lease renewed only while enabled; save enabled=false removes the lease.

## Handoff — NEXT ACTION
Gate with the user: measured costs (2 s ≈ 25 MB/h + 25% CPU; 30 s HTTPS check adds ~14 MB/h). After approval: EnterWorktree from development, dispatch T1 then T2 (disjoint write sets, may run in parallel).
