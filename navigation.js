// Keep the direct download label and installer current without rebuilding.
// The last published version stays visible when GitHub is unavailable.
async function updateDownloadVersion() {
  const targets = selector => [
    ...document.querySelectorAll(selector),
    ...(document.querySelector("#welcome-actions")?.content.querySelectorAll(selector) ?? []),
  ];
  if (!targets("[data-download-version], [data-download-asset]").length) return;
  try {
    const response = await fetch("https://api.github.com/repos/Catalex-app/Catalex/releases/latest", {
      signal: AbortSignal.timeout(5000),
      headers: {Accept: "application/vnd.github+json"},
    });
    if (!response.ok) return;
    const release = await response.json();
    if (release.draft || release.prerelease || !/^v\d+\.\d+\.\d+$/.test(release.tag_name)) return;
    const asset = release.assets?.find(asset => asset.state === "uploaded" && asset.size > 0 && /-arm64\.dmg$/.test(asset.name));
    if (!asset) return;
    targets("[data-download-version]").forEach(label => {
      label.textContent = `Download ${release.tag_name}`;
    });
    const url = asset.browser_download_url;
    if (typeof url === "string" && url.startsWith(`https://github.com/Catalex-app/Catalex/releases/download/${release.tag_name}/`)) {
      targets("[data-download-asset]").forEach(link => {
        link.href = url;
      });
    }
  } catch {
    // A rate limit, slow network, or offline visit keeps the bundled label usable.
  }
}
if (document.body.classList.contains("download-page")) updateDownloadVersion();

const navigation = document.querySelector('.mobile-navigation');
if (navigation) {
  document.addEventListener('pointerdown', event => {
    if (!navigation.contains(event.target)) navigation.open = false;
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && navigation.open) {
      navigation.open = false;
      navigation.querySelector('summary').focus();
    }
  });
  navigation.addEventListener('click', event => {
    if (event.target.closest('a')) navigation.open = false;
  });
  matchMedia('(max-width: 760px)').addEventListener('change', () => {
    navigation.open = false;
  });
}
