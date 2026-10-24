# Catalex website

A small, static product website for Catalex. HTML, CSS, and JavaScript with
actual app screenshots and a standalone highlights carousel. Local fonts, the existing
cat artwork, neutral surfaces, and the app’s own controls. No analytics or live
agent connection.

## Local development

Node.js 22 or newer:

```sh
npm install
npm run dev
```

Open `http://127.0.0.1:4321`. Refresh after source edits.

```sh
npm run build
npm run preview
```

The build checks local asset references and section anchors, then copies only
public site files into `dist/`. Internal content briefs are not published.

## Verification

```sh
npx playwright install chromium
npm run build
npm test
```

Playwright tests the built site under `/catalex.github.io/`, including local assets and anchors,
carousel looping, keyboard operation, mobile widths, and
reduced motion. Tests use ports 4322 and 4323 (built site and development-server checks). `npm run dev` uses 4321 by default.

## Content and source

- `index.html`: short copy and semantic page structure.
- `styles.css`: responsive styles and adapted app design details.
- `app.js`: carousel and placeholder action interactions.
- `workspace-demo/`: thin fixture adapter around the actual Catalex renderer.
- `assets/workspace/`: local screenshot-capture bundle; excluded from the published build.
- `assets/`: cat artwork, local fonts, licenses, and actual app screenshots.
- [Content handoff](docs/website/README.md): the original story and copy briefs.
- [Design provenance](docs/design-provenance.md): what was reused and captured.
- [Initial app/hosting review](docs/reviews/issue-311-website-brief.md).

The local capture workspace supports editing, source/PDF selection, comments, and draft
review using the actual app components. It is no longer embedded or linked on the website. It uses browser fixture data, a precompiled
PDF, and no live agent or filesystem. Reloading resets the sample. See the design
provenance document for renderer rebuilding, screenshot capture, and dependency
license details.

## Publishing later

The repository remains private during development. Nothing deploys on push.
When ready, configure Settings → Pages → GitHub Actions and manually run the
“Publish website” workflow. It tests the built site before deploying only `dist/`.
The workflow has not been run as part of local development.

Because this repository belongs to `RicercarG`, its default project URL would be
`https://ricercarg.github.io/catalex.github.io/`. Naming the repository
`catalex.github.io` alone does not create a domain at that address. Use a custom
domain if desired; the site uses relative asset links for either deployment.

Add Download or Source actions only after their public destinations are ready.
Do not expose links to private releases as public downloads.

## Standalone highlights

The page now ends after “Highlights at a glance” and the footer. Eight cards cover
the editor, project Git, agent context, review, inline comments, compiling, skills,
and Git history. Cards have no links. The interactive tour and lower copy sections
were removed; philosophy content is reserved for a later pass. The renderer stays
available locally for capturing authentic app visuals but is excluded from `dist/`.
