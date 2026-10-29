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
- `app.js`: welcome sequence, carousel, and expanded highlights interactions.
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

## Opening sequence

The homepage opens with the research/collaboration reaction typing onto a white
screen, including its subscripts and Catalex label. The arrow shaft draws first,
followed by its head. Its Catalex mark moves into the header as the navigation and page appear.
The equation then disappears; the hero has the existing copy on the left and
the original workspace capture on the right, without decorative backgrounds.
Narrow screens stack the copy and capture.

Refreshing the homepage replays the sequence, including after scrolling down.
Reduced motion, section links, and browser back/forward navigation skip it.
Keyboard, pointer, or scroll input can skip it immediately. The page remains
usable without JavaScript, with a timed fallback if the main script fails.
Playwright covers the intermediate and final states, replay, interruption,
reduced motion, and missing-script fallback.

### Printer opening trial

Open `http://127.0.0.1:4321/?intro=typewriter` for the optional printer-lit
landing screen. The entire viewport is paper. The original math font displays
Research_human + Collaboration_agent → Paper on one line, with Catalex above
the arrow. The formula scales to fit narrow screens without wrapping.

The opening starts in deep charcoal (#101012) with Research_human already printed and
the head positioned at its right edge. The left-facing lamp turns on while the
head stays still, revealing Research_human. The head then moves right and prints
only the rest of the equation, revealing ink directly behind its left edge.
The 3.2-second pass builds momentum gradually, cruises through the middle, and
brakes over a longer distance into the parking position. The head moves
continuously through the text without per-letter stops. A rounded black rail runs above the head, connected through
a vertical hanger to form a T-shaped assembly. The head only moves horizontally
and finishes in a reserved parking space to the right of the formula. The cone keeps a fixed size and angle as it moves, with radial distance falloff.
At the final parking position its faint end nearly reaches the left screen edge. The whole
paper surface then brightens. Beta,
GitHub, and the bottom scroll prompt are already drawn underneath the darkness;
the light reveals them without a separate opacity animation.

Downward scroll accumulates to 260 CSS pixels, then slides the landing screen up
to the existing homepage. Reverse input subtracts from the total; scrolling during
printing does not count. Wheel line/page modes and touch swipes are normalized.
The prompt can also be activated directly, and Page Down/Space work from the
landing screen. Download and GitHub remain normal links. Reduced motion shows
the completed light surface immediately and skips the slide. Refresh replays it.
The regular homepage remains available without the query parameter.

`typewriter.js` is loaded only for this trial. The full-surface texture, rounded
rail, and satin-metal printer head use original SVG artwork in
`assets/typewriter-{paper,intro,head}.svg`. No Platen assets are bundled.

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
