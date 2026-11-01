import {escapeHtml, renderMarkdown} from './markdown.mjs';

export const repository = 'Catalex-app/Catalex';
export function repositoryUrls(ref = 'main') {
  return {
    raw: `https://raw.githubusercontent.com/${repository}/${encodeURIComponent(ref)}/`,
    github: `https://github.com/${repository}/blob/${encodeURIComponent(ref)}/`,
  };
}

function relativeDirectory(from, to) {
  const a = from.split('/'), b = to.split('/');
  while (a.length && b.length && a[0] === b[0]) { a.shift(); b.shift(); }
  return [...a.map(() => '..'), ...b].join('/') || '.';
}

// Used for both the bundled HTML and its optional browser refresh.
export function renderRepositoryMarkdown(markdown, config) {
  if (!/^# .+/m.test(markdown)) throw new Error('Missing Markdown title');
  const {raw, github} = repositoryUrls(config.ref);
  if (['docs/README.md', 'docs/development/README.md'].includes(config.file)) {
    markdown = markdown.replace(/^# [^\n]+$/m, '# Overview');
  }
  return renderMarkdown(markdown, (href, image) => {
    if (href.startsWith('#') || /^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) return href;
    const target = new URL(href, `https://repository.invalid/${config.file}`);
    const file = target.pathname.slice(1);
    const route = config.routes?.[file];
    if (route && !image) {
      return `${relativeDirectory(config.directory, route)}/${target.search}${target.hash}`;
    }
    return `${image ? raw : github}${file}${target.search}${target.hash}`;
  }, heading => {
    const label = heading.tokens.length === 1 ? heading.tokens[0].text : heading.text;
    return config.kind === 'changelog' && heading.depth === 2 && /^\[?unreleased\]?$/i.test(label.trim());
  });
}

export function versionNavigation(headings) {
  return headings.filter(heading => heading.depth === 2).map(({id, text}) =>
    `<a href="#${escapeHtml(id)}">${escapeHtml(text.replace(/^\[([^\]]+)\]/, '$1'))}</a>`).join('\n');
}

export function contentMarkup(body, config) {
  return `<div class="docs-content" data-repository-page="${escapeHtml(JSON.stringify(config))}">${body}</div>`;
}
