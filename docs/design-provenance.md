# Website design and app reuse

Revised 2026-10-23 for issue #311 following the first visual review.

## Page design

The page uses neutral white, zinc text, and gray surfaces. Color belongs to the
actual product: the orange research mark, yellow human comments, purple agent
comments, and solid green/red review actions. There are no uppercase eyebrow
labels above headings.

The headline is “A catalyst for your next paper.” in the regular Geist font,
with natural wrapping and relaxed spacing,
without a reveal animation or a small label above it. The full workspace screenshot sits directly below the hero actions, without a
separate heading. Appearance controls remain with the interactive workspace. Copy uses short, friendly instructions inspired by the app onboarding,
rather than paired advertising slogans.

The Apple iPhone Duo page was used as an information-structure reference:
<https://www.apple.com/iphone-duo/>. The relevant patterns are a visual highlight
carousel and one shared product view with several guided stops. No Apple assets
or page code are included.

## Actual renderer components

The interactive tour now bundles the real Catalex React renderer. The earlier
handwritten HTML/CSS miniatures have been removed.

| Surface | Original app source under `apps/desktop/src/renderer/` |
| --- | --- |
| Workspace and pane animation | `components/workspace/workspace-layout.tsx`, `workspace-panel.tsx`, `use-workspace-layout-animation.ts` |
| Source editor, PDF | `components/workspace/editor/latex-editor.tsx`, `components/workspace/preview/pdf-viewer.tsx` |
| Agent drawer and context | `components/agent-chat/agent-chat-drawer.tsx`, `context-badge-list.tsx`, `chat-composer.tsx` |
| Inline comments | `components/workspace/editor/inline-comments.ts` and associated components |
| Change review | `components/workspace/editor/agent-file-review.tsx` and review stores |
| Themes and controls | `styles/globals.css`, `styles/ui-themes.css`, `components/ui/` |
| Onboarding heading reference | `components/onboarding.tsx`, `components/onboarding-title.tsx` |

`workspace-demo/main.tsx` is a thin browser adapter around `WorkspaceLayout`.
It initializes the existing comment-workspace or file-review fixture, supplies
a precompiled sample PDF and SyncTeX map, and receives same-origin messages for
theme and tour navigation. It uses the real editor selection and drawer methods.
The review stop switches to the app's in-memory draft-review fixture; other stops
share one mounted editor. Switching into or out of Review resets the sample.

The build script exposes fixture initializers through a Vite transform without
editing app sources. It also makes cat/favicon URLs relative and shortens the
sample conversation. All native bridges use browser fixtures. Account and live
agent actions are blocked. There is no Electron host connection.

## Build and capture

Normal site builds copy the checked-in bundle in `assets/workspace/`; they do not
require the private app repository. To update the renderer, install the app's
workspace dependencies and run:

```sh
node scripts/build-workspace-demo.mjs /path/to/Catalex
npm run dev
# In another terminal:
node scripts/capture-workspace.mjs
npm run build
npm test
```

The source app's installed dependency versions are used for the renderer build.
`assets/workspace/provenance.json` records its version and generation time.
The app bundle is about 16 MB uncompressed, mostly the real PDF engine. It loads
only after choosing a tour stop or pressing “Try the workspace.” The static page,
fonts, and screenshot carousel do not load React or the PDF engine.

Workspace and highlight images are captures of this exact public browser bundle.
The two comment cards are direct element captures, not recreated graphics.
`assets/cat-leaf.svg` and `favicon.png` are exact app assets.

## Boundaries and licenses

The sample editor, PDF selection, comments, and review decisions are interactive.
Changes affect browser sample data only. The PDF is precompiled; the Recompile
button reloads that fixture, so edited source will not produce a new PDF here.
There is no live agent, Git remote, local filesystem access, or real checkpoint
recovery. The page states these preview limits beside the workspace.

The cat/app MIT notice is in `assets/licenses/Catalex.txt`. Font OFL notices remain
in `assets/fonts/`. The renderer's bundled package names, versions, license
identifiers, and available license texts are generated into
`assets/workspace/third-party-notices.txt`; these include MuPDF's
`AGPL-3.0-or-later` license. The static website and renderer have distinct dependency
surfaces; the app renderer's dependency licenses still apply to its distribution.

## Landing reaction notation

The landing equation reads `Research_human + Collaboration_agent → Paper` with
human and agent typeset as subscripts. The cat and Catalex sit above the reaction
arrow, following catalyst placement in chemical notation. The icons have been
replaced by written terms. The equation uses the app's KaTeX Main font, served
locally with its MIT notice in `assets/licenses/KaTeX.txt`; the rest of the page
keeps Geist. The cat retains its non-clickable hover motion and reduced-motion
support. There is no caption below the arrow.

## Hero actions and workspace overview

The provided Zen Browser screenshot informed the order: short supporting copy,
large primary action, secondary GitHub action, then the full app screenshot.
Catalex keeps its existing white/neutral palette and typography. Beta and GitHub
links are local placeholders; clicking them only displays a short status message.
The subscription wording follows the app onboarding’s existing-subscription
Claude/Codex setup. There is no published download destination yet.


## Agent philosophy section

“Your agent. Your way.” follows the six highlights. It uses the site's Geist
font, neutral surfaces, violet agent color, and solid red/green review colors.
One responsive HTML/SVG illustration shows a single agent draft step using
project context and MCP tools, followed by author review. Fixed-size HTML nodes
remain circular as the SVG paths resize. The separate-folder diagram was removed.
The diagram is not an interactive app preview; review decisions are labels, not buttons.

The copy distinguishes native agent integrations from Catalex's contribution:
project context, MCP tools and built-in skills, and private temporary worktrees.
Project instruction names are `AGENTS.md` and `CLAUDE.md`. The workflow allows
continued author edits and surfaces overlaps for review; it does not promise
that every conflict is automatically resolved or describe worktrees as a
security sandbox.

Implementation references in the app: `backend/src/codex.rs`, `claude.rs`,
`workspace_mcp.rs`, `agent_workspace.rs`, `agent_workspace_git.rs`, and renderer
`stores/agent-chat-store.ts`. Public website output still excludes the local
`assets/workspace/` screenshot fixture bundle.
