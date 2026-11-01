# Design and asset provenance

The website uses Catalex's cat artwork, neutral interface palette, and Geist
fonts. Its chemistry metaphor places Catalex above the reaction arrow as the
catalyst connecting human research and agent collaboration.

## Product media

The published screenshots and hero video were captured from Catalex's renderer
with synthetic papers, comments, agent responses, and review proposals. No live
agent account or personal project is used. The video illustrates the interaction;
it does not represent live agent response timing.

The hero recording is a silent 2160×1372 H.264 MP4 at 24 fps, with a JPEG poster.
The website serves only the media, not the capture renderer or PDF engine.
The introduction is a scripted LaTeX-to-result illustration, not a live compiler.

## Regenerating captures

Use a compatible Catalex checkout with its workspace dependencies installed:

```sh
node scripts/build-workspace-demo.mjs /path/to/Catalex
npm run dev
# In another terminal:
node scripts/capture-hero-demo.mjs
```

Chromium and FFmpeg are required. Other `scripts/capture-*.mjs` files capture
individual feature screenshots. `workspace-demo/` supplies browser fixtures;
native actions and live account flows are disabled in the capture adapter.

The generated `assets/workspace/` bundle, its dependency notices, and temporary
output are local-only and ignored by Git. It is excluded from `dist/` even when
present. Rebuilding the published site does not require an app checkout or this bundle.

## Artwork, fonts, and icons

- Cat artwork and app interface: Catalex; notice in `assets/licenses/Catalex.txt`.
- Geist and Geist Mono: local font files with OFL notices in `assets/fonts/`.
- Formula font: KaTeX Main; MIT notice in `assets/licenses/KaTeX.txt`.
- Interface icons: Lucide; notices in `assets/licenses/Lucide.txt` and
  `assets/lucide-license.txt`.
- Apple and filled GitHub marks: [Simple Icons](https://github.com/simple-icons/simple-icons),
  with the CC0 notice in `assets/simple-icons-license.txt`.

Interaction references include [Pi](https://pi.dev/) for the introductory reveal
and [Neovide](https://neovide.dev/configuration.html#cursor-animation) for cursor
motion. The website implements its own animation and uses Catalex artwork.
