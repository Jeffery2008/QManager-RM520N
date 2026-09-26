---
name: qm-redesign-review
description: The single entry point for redesign, polish and repolish requests on a QManager page, card or widget. It produces a published visual Artifact that diagnoses first (a pinned screenshot with measured findings: dead bands, stretched controls, key-to-value distance, container count, duplicated messages, each tied to a file, a value and a rule), then shows a working mockup in the app's real OKLCH tokens and fonts (every real state, Wide/Phone, both themes), a before/after of one real component, a "What changes" table naming real files and shapes.ts constants, "Kept as is" and "Your call before build". Use it whenever the user says redesign, polish, repolish, re-author, critique, "apply the design language to X", "bring this page forward", "this page is on the old system", "make X look better", mentions awkward whitespace, uneven cards or a stretched or cramped layout, or asks for polishing ideas, even without the word "skill" and even if they mention /impeccable. It never edits repo code; the approved design is built as a normal Full-lane run under qm-orchestrate.
---

# QManager Redesign Review

This skill turns "this page looks rough" or "redesign X" into a published review page. The page
diagnoses first, with measurements, then proposes a working mockup of the fix. The user approves or
amends it, and only then does anything get built, as a Full-lane run under `qm-orchestrate`. It
replaces `docs/reference/redesign-proposal-playbook.md`, which now only points here.

**The diagnosis is the product.** The user asked for this shape after a Frequency Calculator review:
"I love this analyzation with whitespace and stuff before showing the recommended redesign." A
beautiful mock with a vague critique misses the point. A proposal has to be arguable from the code
and the pixels, not from taste: "this would look better" invites a debate nobody can win; "about
90px of nothing, because `FORM.NOTE` carries `mt-auto` in a column stretched to the 13rem readout"
settles it.

**This skill never edits repo source.** Everything it writes goes in the session scratchpad and the
Artifact. Worktrees, builders and commits belong to `qm-orchestrate`, after the gate.

## Where it sits in qm-orchestrate

The `qm-orchestrate` flag table routes "apply the design language to X" / "redesign X" here. This
skill *is* the recon and plan stages of that Full run, and its Artifact is what the gate approves.
Signal the stages with the usual headers: `**[qm-orchestrate · Full · recon]**` for steps 1–3,
`**[qm-orchestrate · Full · plan]**` for steps 4–5, `**[qm-orchestrate · Full · gate]**` for step 6.
Open the run ledger before the first dispatch, per `qm-orchestrate`. A UI bug fix, a copy change or
one added card is Lite work and does not come here.

## Files in this skill

| File | Read it when |
|---|---|
| `references/philosophy.md` | Every run, before critiquing. It holds the user's reasoning behind the Scanning Rules, the Full-Width Page Rule and convention over explanation. Argue from it. |
| `references/critique-checklist.md` | Step 3. The measured audit (A–P), how to read pixels off a screenshot, the code-provenance checks, and the finding format. |
| `references/artifact-spec.md` | Steps 4–5. Section anatomy, token and geometry fidelity, mock craft rules, data realism and the at-rest checklist. |
| `assets/template.html` | Step 5. Start every artifact from a copy. It has the tokens (light plus both dark blocks), doc chrome, pinned figure, demo bar, stage with Wide/Phone, theme toggle, mock primitives, the before/after pair and the change table. |
| `assets/exemplar-frequency-calculator.html` | Once per run, skimmed. The reference output, on this repo's Frequency Calculator: how findings cite constants, how a mock computes real data (3GPP EARFCN arithmetic), how states are named, what a before/after looks like. |
| `scripts/pin_grid.py` | Step 3. Overlays a labelled % grid on the screenshot, or zooms a region, so pins and gaps are measured, not guessed. |
| `scripts/finalize.py` | Step 5. Embeds the screenshot(s) as base64 data URIs and lints the page against the hard rules. Exits 1 if the page isn't ready. `--check` lints without writing. |

Paths below are relative to this skill's directory (`.claude/skills/qm-redesign-review/`) unless
they start with a repo path such as `components/`. The shell's working directory is the repo root,
so run the scripts as `python .claude/skills/qm-redesign-review/scripts/<name>.py …`. `pin_grid.py`
needs Pillow, which the Anaconda `python` on this machine has.

## Workflow

### 1. Load context

- **Design context.** Run the impeccable loader for the target route. Its output is large, so the
  harness saves it to a file. Read that file, don't scroll it:
  ```powershell
  & "C:/Users/RUS-LEGION5/.claude/plugins/cache/impeccable/impeccable/4.4.0/skills/impeccable/scripts/impeccable.cmd" context --target app/<route> 2>&1 | Select-Object -First 400
  ```
  If that path is gone (plugin updated), use the newest version under
  `C:/Users/RUS-LEGION5/.claude/plugins/cache/impeccable/impeccable/`, or invoke the
  `impeccable:impeccable` skill with a critique-only argument. Don't run it twice in one run.
- **Project canon.** `DESIGN.md` is 160 KB, so read only the parts you decide with:
  - Migration Deltas (what is tracked as not yet migrated) and the Overview
  - Layout, its Named Rules, The Scanning Rules and The Full-Width Page Rule
  - Components > Chips and tags, Cards / Containers, Tiles, Metric rows, Inputs / Fields, Icons,
    and its Named Rules
  - Components > Copy & Help (The No-Default-Tip Rule, `HintIcon`)
  - Typography > The Two-Voice Rule and The Machine-Voice Rule
  - Shapes and Elevation & Depth (radius scale, card sheen)

  And `PRODUCT.md` Principles 4, 7 and 8 plus the anti-references. Much of the app is
  pre-migration, so check what's actually enforced before calling something a regression.
- **The page's code.** Start at `app/<route>/page.tsx` and follow it to the components and the
  family's `shapes.ts` (`components/cellular/*/shapes.ts`, `components/dashboard/shapes.ts`, …).
  Read `shapes.ts` in full, JSDoc included: the comments carry the reasoning for every value and
  usually record the previous generation's mistakes. Note which constants are **shared** with
  sibling routes (`grep -rlw CONST components app`). Pull the copy from
  `public/locales/en/<ns>.json`.
- **Reference implementations.** `components/dashboard/**` and `components/cellular/radio/**` are the
  migrated surfaces; `components/ui/badge.tsx`, `components/ui/tag.tsx` and `lib/motion.ts` are the
  canon in its most compressed form.
- **Feature doc.** Open the doc the router (`docs/reference/README.md`) names for this surface. It
  holds invariants a layout change must not break (state honesty, apply pipelines, what's absent on
  a given modem).
- **Philosophy.** Read `references/philosophy.md`.

**Recon on a wide surface.** When the tree is too big to read inline, dispatch `qm-scout` tickets
(read-only, so two can run at once; announce the fan-out). Never `Explore`, `general-purpose`,
`Plan` or an `orchestra-*` agent: `qm-orchestrate` hard rail 1. Two briefs, verbatim dumps rather
than summaries:

- **Surface map:** route files and what each is, every component in the tree with line counts,
  the family `shapes.ts` in full, exported prop interfaces, hooks and the CGI each hits, the
  loading/empty/error states and which skeleton mirrors which shape, i18n leaf counts per subtree,
  the current layout as an indented tree with resolved class strings. Ask explicitly for **exports
  with no consumers** and **constants defined in more than one place**.
- **Canon extract:** the freshest completed design-migration commit and what it changed, the
  reference implementations above, `badge.tsx`/`tag.tsx`/`lib/motion.ts` complete, and one
  `shapes.ts` from a different family as the structural model.

### 2. Get visual truth

- **User screenshots.** They usually attach them. Attachments land in the session temp dir, the
  sibling of your scratchpad: `<scratchpad>/../images/N.png`. List that folder, view each image,
  and pick the one that shows the problem best (usually the widest, with a populated state).
- **No screenshot.** Capture the page in the Browser pane. `preview_start` with the
  `qmanager-dev-3010` config (`.claude/launch.json` of the main checkout) serves the main checkout,
  which is the right "before" for a review. Capture at 1440–1920 wide, plus 390 if the complaint
  involves phone, in the user's theme (dark unless their screenshots say otherwise). Pages that need
  live CGI data won't render useful states without the modem or a mock; prefer the user's
  screenshots, and say so if you had to work without one.
- Copy the chosen screenshot(s) into the scratchpad. The review works on copies.

### 3. Measure

Work through `references/critique-checklist.md`:

1. Run `python scripts/pin_grid.py <shot.png> <scratchpad>/grid.png`, and `--crop x0,y0,x1,y1` for
   small gaps. View the output.
2. For every candidate issue, get **a number** off the screenshot, **a cause** in code (file,
   constant, class or prop, quoted), **the rule** it breaks, and **a cost** to the visitor's hunt.
3. Run the code-provenance checks (section P): duplicate definitions, exports with no consumers,
   retired tokens, a floor where canon pins, a `Badge` doing a `Tag`'s job.
4. Keep the 4–7 findings that change the design, ordered by reading order so pins run top-left to
   bottom-right. Note pin coordinates as percentages of the image.

**Re-authoring or polish?** Decide before designing, from evidence, and say which in the h1:

1. The feature doc records the surface as built on a previous, superseded system.
2. A retired token is still consumed: it survives in `app/globals.css`, a handful of files read it,
   and `DESIGN.md` never mentions it.
3. An existing mock predates the confirmed direction (a `.dc.html` under `reimagine/` authored before
   the direction was set is content reference only, never a visual target).

Want more than one. If none holds, it is a polish pass: scope it down and say so. If the page is
already in good shape, keep the list short. Per the user, if the layout is fine, "don't re-think it
for the sake of it".

### 4. Design the fix

- **Start from a reframe.** Name the questions a visitor brings to the page and which one the
  current layout leaves unanswered. The Custom Profiles one was: the page is organised by object
  type ("here are profiles, here are scenarios"), which is a database view, whereas WiFiman and
  Firewalla organise by question. A reframe gives every later decision a reason; a list of tweaks makes each
  one a separate argument.
- **Fix causes, not symptoms.** Regroup, move floating elements onto an edge, pair short cards,
  recompose wide cards, delete duplicates. Padding is the last resort (philosophy §2).
- **Protect shared constants.** When a constant is shared with a sibling route, give the target page
  its **own** constant (`CALC_SPLIT` beside `HERO_SPLIT`) and say so in the table's lede.
- **Flag anything new.** New behaviour or content gets `new` in the table and a line under "Your
  call before build". Don't slip it in.
- **Name the veto-worthy calls.** One or two decisions where a reasonable person could go the other
  way, especially where an existing code decision is upheld or overturned. Quote that code.
- **Check glyph coverage** for every Material glyph you plan to use:
  `grep -c '"<glyph>"' app/fonts/MaterialSymbolsRounded-subset.json`. A missing glyph means
  `bun run icons:subset`, which needs network access; `bun run icons:check` is the gate. That goes
  under "Your call".
- **Recompose for both widths.** Design Wide *and* Phone on purpose; the user has sent back a mock
  whose phone view "looks rough".
- **Stay inside the fences.**
  - The Full-Width Page Rule: never `max-w` on the page; readability is capped inside a card.
  - The Card-Wrapped Surface Rule, and one inner container per card (One-Nest).
  - Copy within the Copy & Help budgets, no default `HintIcon` (No-Default-Tip), no em dashes or
    `·` glue (No-Dot-Separator).
  - Status is a filled `Badge` with a 12px glyph; identity is an outline `Tag` (Two-Form).
  - The Two-Voice Rule: Rethink Sans for the interface and every figure (`tabular-nums`), JetBrains
    Mono for opaque strings. The Machine-Voice tell: a quantity you read (EARFCN, PCI, band, RSRP)
    is Rethink `tabular-nums`; an opaque string you compare (IMEI, ICCID, IP, MAC, paths, raw AT)
    is mono.
  - The route's icon set only.
  - No capability the target modem lacks (`docs/reference/platform-matrix.md`).

### 5. Build the artifact

1. Call `Artifact` with `action: "quickstart"`, `intent: "other"` and `design_systems: false` (the
   app's own tokens are the design system here). Its page guidance stands in for loading
   `artifact-design`.
2. Copy `assets/template.html` to `<scratchpad>/<page>-review.src.html`. Before anything else,
   re-check the token blocks against `app/globals.css` (see the spec). Fill every double-underscore
   placeholder and author the parts marked `AUTHOR` per `references/artifact-spec.md`. The mock
   must work: real content, computed data, every state chip wired through one `render()`.
3. Embed the screenshot and lint:
   ```bash
   python .claude/skills/qm-redesign-review/scripts/finalize.py <scratchpad>/<page>-review.src.html <scratchpad>/<page>-review.html --shot "__SHOT__=<scratchpad>/<shot>.png"
   ```
   Fix every `FAIL` in the **source** and re-run. Treat `WARN`s on their merits.
4. **Take one look, at most.** A `file:///` URL outside the project opens as a static snapshot that
   page tools can't drive, so serve the scratchpad instead:
   - Start `python -m http.server 8765 --bind 127.0.0.1` in the scratchpad with `run_in_background`.
   - Open it with `preview_start({url: "http://127.0.0.1:8765/<page>-review.html"})`.
   - Take one screenshot at 1440 wide with a populated state.
   - Check phone with `resize_window` 390×844 and a JS probe:
     `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

   A hidden pane can return a stale screenshot, so trust a JS probe over a picture. Reset the
   viewport to `desktop` and stop the server. Fix anything broken, re-run `finalize.py`, publish.
   Don't enter a render loop.
5. Publish with `Artifact` (publish is the default): `file_path` the finalized `.html`, `icon`
   `layout`, `description` one sentence ("Annotated critique and a working before/after mockup of
   the QManager {Page} layout, with the scoped change list."). Keep the `.src.html`; a follow-up
   edits the source, re-runs `finalize.py` to the **same** output path, and republishes to the same
   URL.

### 6. Present it (the gate)

Short, because the artifact carries the detail. In this order:

1. **The reframe**, one or two sentences, and the link.
2. **The one or two decisions worth a veto**, saying whether each upholds or overturns existing code.
3. **The evidence**: three or four finding highlights, pointing at the full list in the artifact.
4. **Scope, both halves**: what changes, what is untouched (data model, CGI contract, pipelines),
   and what is deliberately untouched because it is already migrated. Name any real bug found out
   of scope and ask whether to fold it in.
5. **The gate.** The open "Your call" questions, asked with `AskUserQuestion`. Do not start building.

On approval (with amendments), the run continues as a normal Full-lane `qm-orchestrate` run,
frontend-only, usually built by `ui-builder` and checked by `qm-verifier`. The approved artifact is
the brief: hand the builders its URL, the change table and the relevant excerpt, never the whole
page. Amendments that change the design go back into the artifact first (republish), so the
approved page matches what gets built.

## Hard rules

- **Diagnosis before design.** Findings are measured, numbered and pinned. Each has a number, a
  cause quoted from a file, the rule, and a cost.
- **Declared equals shipped.** Tokens are copied verbatim from `app/globals.css` (`:root` into the
  artifact's `:root`, `.dark` into both dark blocks), and geometry is the shipped geometry.
- **Complete at rest.** It opens on a representative populated state, with no placeholders or empty
  sections, and every real state has a chip.
- **Both themes work.** Keep the three token blocks exactly as the template structures them.
- **No horizontal page scroll at 390px.** Only the change table's wrapper scrolls.
- **Mock copy obeys the Copy & Help budgets.** The doc chrome stays terse ("All that matters is the
  design").
- **No invented hardware claims.** Data is real or computed with the real formulas; samples are
  labelled as samples.
- **Single HTML file.** Screenshot as a data URI, fonts only from Google Fonts, under 16MB.
- **No repo edits, no commits, no device access.** Build only after approval, via `qm-orchestrate`.
