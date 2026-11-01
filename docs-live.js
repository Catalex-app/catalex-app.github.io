import {renderRepositoryMarkdown, repositoryUrls, versionNavigation} from './assets/content/repository-markdown.mjs';

const content = document.querySelector('[data-repository-page]');
if (content) refresh(content);

async function refresh(content) {
  content.dataset.refresh = 'loading';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const cancel = () => controller.abort();
  addEventListener('pagehide', cancel, {once:true});
  try {
    const config = JSON.parse(content.dataset.repositoryPage);
    const response = await fetch(`${repositoryUrls(config.ref).raw}${config.file}`, {
      signal:controller.signal, credentials:'omit', cache:'no-cache',
    });
    if (!response.ok) throw new Error('Markdown unavailable');
    const markdown = await response.text();
    if (markdown.length > 1_000_000) throw new Error('Unexpected Markdown size');
    const {body, headings} = renderRepositoryMarkdown(markdown, config);
    const replacement = document.createElement('template');
    replacement.innerHTML = body;
    const title = replacement.content.querySelector('h1')?.textContent;
    if (!title) throw new Error('Missing rendered title');
    if (replacement.innerHTML !== content.innerHTML) {
      // Do not replace a link under keyboard focus or text being selected.
      const selection = getSelection();
      if (content.contains(document.activeElement) || (selection && !selection.isCollapsed &&
          (content.contains(selection.anchorNode) || content.contains(selection.focusNode)))) {
        content.dataset.refresh = 'deferred';
        return;
      }
      const y = scrollY;
      const readingTop = (document.querySelector('.site-header')?.getBoundingClientRect().bottom ?? 0) + 8;
      const visibleHeadings = [...content.querySelectorAll('h1,h2,h3')];
      const anchor = visibleHeadings.find(heading => {
        const top = heading.getBoundingClientRect().top;
        return top >= readingTop && top < innerHeight;
      }) ?? visibleHeadings.reverse().find(heading => heading.getBoundingClientRect().top < 0);
      const anchorTop = anchor?.getBoundingClientRect().top;
      content.replaceChildren(replacement.content);
      if (config.kind === 'changelog') {
        document.querySelector('.docs-sidebar nav').innerHTML = versionNavigation(headings);
      } else {
        document.querySelector('.docs-sidebar [aria-current="page"]').textContent = title;
        document.title = `${title} — Catalex`;
      }
      // Preserve the reader's position when content above it changes.
      const destination = anchor && document.getElementById(anchor.id);
      const top = destination ? y + destination.getBoundingClientRect().top - anchorTop : y;
      scrollTo({top, behavior:'instant'});
    }
    content.dataset.refresh = 'fresh';
  } catch {
    // Network, parsing or unsafe-link failures retain the complete bundled page.
    content.dataset.refresh = 'fallback';
  } finally {
    clearTimeout(timeout);
    removeEventListener('pagehide', cancel);
  }
}
