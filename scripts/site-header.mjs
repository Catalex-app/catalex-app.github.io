// Shared server-rendered header for the homepage, downloads, docs, and changelog.
export function renderSiteHeader({page = "home", prefix = "./"} = {}) {
  const replay = `<a class="button header-replay" href="${prefix}?playIntro=1" aria-label="Replay intro"><span aria-hidden="true">Replay intro</span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg></a>`;
  const download = `<a class="button solid header-download" href="${prefix}download/"><svg class="download-apple" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><use href="${prefix}assets/apple.svg#apple"/></svg><span>Beta download</span></a>`;
  return `<header class="site-header"><a class="brand" href="${page === "home" ? "#top" : prefix}" aria-label="Catalex"><span class="catalex-mark"><img src="${prefix}assets/cat-leaf-mark.svg" width="32" height="18" alt=""/><span>Catalex</span></span></a>
${page === "home" ? replay : ""}
<nav class="header-nav" aria-label="Main navigation"><a class="header-docs" href="${prefix}docs/"${page === "docs" ? ' aria-current="page"' : ""}>Documentation</a><a class="header-changelog" href="${prefix}changelog/"${page === "changelog" ? ' aria-current="page"' : ""}>Changelog</a></nav>
<div class="header-actions">${page === "download" ? "" : download}
<a class="button header-github" href="https://github.com/Catalex-app/Catalex" aria-label="GitHub" title="GitHub"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2"/></svg></a></div></header>`;
}

export function renderPageHeader(html, page) {
  return html.replace("<!-- site-header -->", renderSiteHeader({page, prefix:page === "home" ? "./" : "../"}));
}
