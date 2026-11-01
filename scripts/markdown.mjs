import { Marked } from "marked";

export const escapeHtml = value => String(value).replace(/[&<>"']/g, character =>
  ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"})[character]);

// Shared rendering for repository documentation and the changelog.
export function renderMarkdown(markdown, rewrite, omitSection = () => false) {
  const counts = new Map();
  const headings = [];
  const parser = new Marked({
    gfm: true,
    hooks: {
      processAllTokens(tokens) {
        let omittedDepth = null;
        const visible = tokens.filter(token => {
          if (token.type === "heading") {
            if (omittedDepth !== null && token.depth <= omittedDepth) omittedDepth = null;
            if (omitSection(token)) omittedDepth = token.depth;
          }
          return omittedDepth === null;
        });
        // Retain reference-style link definitions collected by the lexer.
        return Object.assign(visible, {links:tokens.links});
      },
    },
    walkTokens(token) {
      if (token.type === "link" || token.type === "image") {
        const url = new URL(token.href, "https://docs.invalid/");
        if (!["https:", "http:", "mailto:"].includes(url.protocol))
          throw new Error(`Unsupported Markdown link: ${token.href}`);
        token.href = rewrite(token.href, token.type === "image");
      }
    },
    renderer: {
      html({text}) { return escapeHtml(text); },
      heading({tokens, depth, text}) {
        const base = text.toLowerCase().replace(/[^\w\s-]/g, "").replace(/\s/g, "-");
        const count = counts.get(base) || 0;
        counts.set(base, count + 1);
        const id = count ? `${base}-${count}` : base;
        headings.push({id, depth, text});
        return `<h${depth} id="${escapeHtml(id)}">${this.parser.parseInline(tokens)}</h${depth}>\n`;
      },
    },
  });
  return {body:parser.parse(markdown), headings};
}
