# Catalex website

A static product website for [Catalex](https://github.com/Catalex-app/Catalex),
with a terminal-style introduction, an interactive source/split/preview example,
app screenshots, a recorded agent demo, documentation, and a changelog.
HTML, CSS, and JavaScript; local fonts and media; no analytics or live agent connection.

## Development

Use Node.js 22 or newer:

```sh
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4321`. The initial build fetches the public documentation
and changelog. Refresh after source edits; rebuild when their Markdown changes.
Use `npm run preview` to serve only the generated `dist/` directory.

## Verification

```sh
npx playwright install chromium webkit
npm run test:docs
npm run build
npm test
```

Browser checks cover desktop and mobile layouts, navigation, the introduction,
scroll transitions, reduced motion, media playback, and documentation links.
They test the production build under `/catalex.github.io/` on port 4322 and the
source preview on port 4323. The development server uses port 4321.

## Project layout

- `index.html`, `styles.css`, `app.js`, `typewriter.js`: homepage and interactions.
- `download/index.html`: download page linking to public GitHub Releases.
- `scripts/site-header.mjs`: the shared navigation header.
- `scripts/build-docs.mjs`, `scripts/build-changelog.mjs`, `scripts/markdown.mjs`:
  canonical Markdown import and rendering.
- `docs.css`: documentation and changelog presentation.
- `assets/`: published screenshots, video, artwork, fonts, and license notices.
- `workspace-demo/` and `scripts/capture-*.mjs`: synthetic fixtures and local
  capture tools for regenerating product media.
- [Design provenance](docs/design-provenance.md): asset origins and capture instructions.

The build publishes an explicit set of website files. Internal notes, capture
source, task configuration, and the generated `assets/workspace/` renderer are
not included. The renderer bundle is also ignored by Git; regenerate it locally
when capturing new media.

## Documentation and changelog

The source of truth is [Catalex-app/Catalex](https://github.com/Catalex-app/Catalex):

- `docs/navigation.json` defines the User guide and Development groups.
- The referenced Markdown pages are rendered under `/docs/`.
- Root `CHANGELOG.md` is rendered under `/changelog/`, with version anchors.
  The Unreleased section is omitted. All versioned entries remain visible,
  regardless of whether a build succeeded.

The default revision is `main`. Set `CATALEX_DOCS_REF` to a branch, tag, or commit
to build from a particular revision. The public sources are fetched at build
time; readers do not need GitHub API requests or JavaScript to read them.
Missing sources fail the build rather than publishing empty pages. Relative
links are resolved to website documentation routes or the canonical repository.

For a preview of unpublished documentation changes in a local app checkout:

```sh
CATALEX_DOCS_DIR=/absolute/path/to/Catalex/docs npm run build
npm run dev
```

With that override, the changelog is read from `../CHANGELOG.md` alongside the
docs directory. `CATALEX_CHANGELOG_FILE` can override the changelog separately.
Leave both unset for normal public GitHub builds. The already-running development
server serves newly generated pages immediately after a browser refresh.

## Homepage behavior

The first visit plays the silent introduction once per browser storage profile.
Later visits open Welcome; Replay intro plays it again without resetting that flag.
`?playIntro=0#top` skips it for local visual work, and `?playIntro=1` requests a replay.

Welcome has source, split, and preview modes. Scrolling down enters `#main`;
refreshing Main preserves that screen and its scroll position. The cat slides
left while the formula wordmark and download/GitHub buttons join the shared header.
Clicking Catalex returns to Welcome. At Main's top, upward scrolling reveals a
return indicator; continued scrolling fills it. Partial progress expires after
three seconds of inactivity. Reduced motion skips the animated transitions.

The main demo is a silent, scripted recording of the app using synthetic data.
It loops while visible, and its still frame remains available when loading or
playback fails, Save Data is enabled, or reduced motion is requested. The first
highlight uses a screenshot. The review diagram plays once and has a replay button.

## Publishing

Publishing is manual; pushing does not deploy the site. Configure the repository's
**Settings → Pages → GitHub Actions**, then run **Publish website**. The workflow
fetches the chosen documentation revision, builds, tests, and deploys only `dist/`.
Push changes to canonical documentation before running the website workflow.

Without a custom domain, the project repository `Catalex-app/catalex.github.io`
uses `https://catalex-app.github.io/catalex.github.io/`. Its name does not assign
`https://catalex.github.io/`. Relative routes work at the domain root or project path.

Keep local `.env` files, signing credentials, task routing, and generated capture
output untracked. Example environment files may be committed without secrets.
Ignoring a file does not erase earlier commits; review repository history before
changing visibility. Website source changes must be committed and pushed before
running the publishing workflow.
