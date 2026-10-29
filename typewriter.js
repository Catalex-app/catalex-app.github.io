// Optional printer opening: ?intro=typewriter. The standard entrance stays available.
export async function setupTypewriterEntrance(reducedMotion) {
  const root = document.documentElement;
  const scene = document.querySelector(".intro-scene");
  if (!scene || !root.classList.contains("intro-pending")) {
    scene?.remove();
    root.classList.remove("typewriter-pending");
    root.dataset.intro = "complete";
    return;
  }

  const controller = new AbortController();
  const options = {signal: controller.signal};
  const animations = new Set();
  const pageParts = [...document.querySelectorAll(".site-header, #main, .site-footer")];
  let playing = true;
  let entering = false;
  let focusOnEntry = false;
  let finished = false;
  let frameId = 0;
  let endScan;
  let printerX = 0;
  let printY = 0;
  let scrollAmount = 0;
  let touchY = null;

  function stopScan() {
    cancelAnimationFrame(frameId);
    frameId = 0;
    endScan?.(false);
    endScan = undefined;
  }
  function finish() {
    if (finished) return;
    finished = true;
    playing = false;
    stopScan();
    clearTimeout(window.catalexIntroFallback);
    controller.abort();
    for (const animation of animations) animation.cancel();
    for (const part of pageParts) part.inert = false;
    root.classList.remove("intro-pending", "typewriter-pending");
    root.dataset.intro = "complete";
    if (window.catalexIntroScrollRestoration) history.scrollRestoration = window.catalexIntroScrollRestoration;
    scene.remove();
    if (entering && focusOnEntry) document.querySelector(".site-header .brand").focus({preventScroll: true});
  }
  function animate(element, frames, timing) {
    const animation = element.animate(frames, {fill: "both", easing: "ease-out", ...timing});
    animations.add(animation);
    animation.finished.catch(() => {});
    return animation;
  }
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  clearTimeout(window.catalexIntroFallback);
  window.catalexIntroFallback = setTimeout(finish, 8000);

  try {
    scene.classList.add("typewriter-intro");
    scene.removeAttribute("aria-hidden");
    scene.setAttribute("role", "dialog");
    scene.setAttribute("aria-modal", "true");
    scene.setAttribute("aria-label", "Welcome to Catalex. Scroll down to learn more.");
    scene.tabIndex = -1;
    for (const part of pageParts) part.inert = true;
    scrollTo({top: 0, left: 0, behavior: "instant"});

    const reaction = scene.querySelector(".reaction");
    const stage = document.createElement("div");
    stage.className = "printer-stage";
    const rails = document.createElement("img");
    rails.className = "printer-rails";
    rails.src = new URL("./assets/typewriter-intro.svg", import.meta.url).href;
    rails.alt = "";
    const carriage = document.createElement("div");
    carriage.className = "printer-carriage";
    carriage.setAttribute("aria-hidden", "true");
    const beam = document.createElement("div");
    beam.className = "printer-beam";
    const head = document.createElement("img");
    head.src = new URL("./assets/typewriter-head.svg", import.meta.url).href;
    head.width = 220;
    head.height = 212;
    head.alt = "";
    carriage.append(beam, head);
    stage.append(reaction, rails, carriage);

    const night = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    night.classList.add("printer-night");
    night.setAttribute("aria-hidden", "true");
    night.innerHTML = `<defs>
      <filter id="printer-light-softness" x="-30%" y="-80%" width="160%" height="260%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="12"/></filter>
      <radialGradient id="printer-light-falloff" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="1">
        <stop offset="0" stop-color="#000000"/><stop offset=".12" stop-color="#080808"/>
        <stop offset=".3" stop-color="#292929"/><stop offset=".5" stop-color="#686868"/>
        <stop offset=".72" stop-color="#b6b6b6"/><stop offset=".9" stop-color="#ededed"/><stop offset="1" stop-color="#ffffff"/>
      </radialGradient>
      <mask id="printer-light-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
        <rect width="100%" height="100%" fill="white"/>
        <path class="printer-light-opening" fill="url(#printer-light-falloff)" filter="url(#printer-light-softness)"/>
        <rect class="printer-ambient-light" width="100%" height="100%" fill="black" opacity="0"/>
      </mask>
    </defs><rect width="100%" height="100%" fill="#101012" mask="url(#printer-light-mask)"/>`;
    const lightOpening = night.querySelector(".printer-light-opening");
    const lightFalloff = night.querySelector("#printer-light-falloff");
    const ambientLight = night.querySelector(".printer-ambient-light");
    const lampCover = document.createElement("div");
    lampCover.className = "printer-lamp-cover";
    lampCover.setAttribute("aria-hidden", "true");
    const actions = document.querySelector(".hero-actions").cloneNode(true);
    actions.className = "hero-actions printer-actions";
    actions.inert = true;
    const learnMore = document.createElement("button");
    learnMore.type = "button";
    learnMore.className = "printer-scroll";
    learnMore.append("Scroll down to learn more");
    const progress = document.createElement("span");
    progress.setAttribute("aria-hidden", "true");
    learnMore.append(progress);
    learnMore.disabled = true;
    scene.append(stage, night, lampCover, actions, learnMore);
    const paper = new Image();
    paper.src = new URL("./assets/typewriter-paper.svg", import.meta.url).href;
    root.dataset.intro = "dark";

    function movePrinter(x) {
      printerX = x;
      carriage.style.left = `${x}px`;
      scene.style.setProperty("--lamp-x", `${x}px`);
      // The entire lamp field travels with the nozzle without stretching.
      lightOpening.setAttribute("transform", `translate(${x} ${printY})`);
    }
    function revealTo(x) {
      const box = reaction.getBoundingClientRect();
      const revealed = Math.max(0, Math.min(100, (x - box.left) / box.width * 100));
      reaction.style.clipPath = `inset(-100px ${100 - revealed}% -24px -12px)`;
    }
    function parkedNozzleX() {
      return reaction.getBoundingClientRect().right + (innerWidth < 600 ? 10 : 20);
    }
    function measure() {
      const margin = innerWidth < 600 ? 14 : 32;
      const gap = innerWidth < 600 ? 10 : 20;
      const housingWidth = carriage.offsetWidth;
      // Reserve the right-hand parking bay before fitting the single-line formula.
      const available = Math.max(160, innerWidth - margin * 2 - housingWidth - gap);
      const scale = Math.min(1, available / reaction.offsetWidth);
      scene.style.setProperty("--formula-scale", scale);
      const groupWidth = reaction.offsetWidth * scale + gap + housingWidth;
      scene.style.setProperty("--formula-left", `${(innerWidth - groupWidth) / 2}px`);
      const box = reaction.getBoundingClientRect();
      printY = box.top + box.height / 2;
      carriage.style.top = `${printY}px`;
      // The SVG bearing sits at y=-47, above the nozzle's y=70.
      scene.style.setProperty("--track-y", `${printY - housingWidth * 117 / 220}px`);
      scene.style.setProperty("--lamp-y", `${printY}px`);
      scene.style.setProperty("--actions-y", `${printY + (innerHeight <= 540 ? 82 : 138)}px`);
      // At the final parking position, the faint end nearly reaches the viewport's left edge.
      const range = parkedNozzleX() - (innerWidth < 600 ? 12 : 24);
      const spread = Math.min(180, range * .24);
      const aperture = housingWidth * 41 / 220;
      lightOpening.setAttribute("d", `M0 ${-aperture} L${-range} ${-spread} L${-range} ${spread} L0 ${aperture}Z`);
      lightFalloff.setAttribute("r", range);
      scene.style.setProperty("--lamp-width", `${range}px`);
      scene.style.setProperty("--lamp-height", `${spread}px`);
      scene.style.setProperty("--lamp-aperture", `${aperture}px`);
      night.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    }
    function tween(duration, update) {
      stopScan();
      return new Promise(resolve => {
        endScan = resolve;
        let started;
        const tick = now => {
          if (!playing || finished) { endScan = undefined; resolve(false); return; }
          started ??= now;
          const fraction = Math.min(1, (now - started) / duration);
          update(fraction);
          if (fraction < 1) frameId = requestAnimationFrame(tick);
          else { frameId = 0; endScan = undefined; resolve(true); }
        };
        frameId = requestAnimationFrame(tick);
      });
    }
    function printPass() {
      const from = printerX;
      const to = parkedNozzleX();
      const acceleration = .2;
      const braking = .28;
      const distance = 1 - (acceleration + braking) / 2;
      // Integrate smooth velocity ramps: build momentum, cruise, then brake.
      // Position, velocity, and acceleration remain continuous at both joins.
      return tween(3200, fraction => {
        let progress;
        if (fraction < acceleration) {
          progress = (fraction - acceleration / Math.PI * Math.sin(Math.PI * fraction / acceleration)) / 2;
        } else if (fraction <= 1 - braking) {
          progress = fraction - acceleration / 2;
        } else {
          const elapsed = fraction - (1 - braking);
          progress = 1 - braking - acceleration / 2
            + (elapsed + braking / Math.PI * Math.sin(Math.PI * elapsed / braking)) / 2;
        }
        movePrinter(from + (to - from) * progress / distance);
        revealTo(printerX);
      });
    }
    function illuminatePage() {
      return tween(1100, fraction => {
        const eased = fraction * fraction * (3 - 2 * fraction);
        ambientLight.setAttribute("opacity", eased);
      });
    }
    function ready() {
      if (finished || entering) return;
      playing = false;
      stopScan();
      for (const animation of animations) animation.cancel();
      measure();
      reaction.style.clipPath = "none";
      movePrinter(parkedNozzleX());
      scene.classList.add("is-lamp-on", "is-lit", "is-ready");
      actions.inert = false;
      learnMore.disabled = false;
      root.dataset.intro = "ready";
    }
    async function enter(focusAfter = false) {
      if (root.dataset.intro !== "ready" || entering || finished) return;
      entering = true;
      focusOnEntry = focusAfter;
      root.dataset.intro = "docking";
      actions.inert = true;
      learnMore.disabled = true;
      if (reducedMotion.matches) return finish();
      const duration = 1050;
      const easing = "cubic-bezier(.65, 0, .2, 1)";
      for (const part of pageParts) {
        animate(part, [
          {opacity: 1, transform: "translateY(100svh)"},
          {opacity: 1, transform: "translateY(0)"},
        ], {duration, easing});
      }
      for (const child of document.querySelector(".site-header").children) {
        animate(child, [{opacity: 1}, {opacity: 1}], {duration});
      }
      await animate(scene, [
        {transform: "translateY(0)"}, {transform: "translateY(-100%)"},
      ], {duration, easing}).finished;
      finish();
    }
    function accumulate(delta, focusAfter = false) {
      if (root.dataset.intro !== "ready" || entering || !Number.isFinite(delta)) return;
      scrollAmount = Math.max(0, scrollAmount + delta);
      scene.style.setProperty("--scroll-progress", Math.min(1, scrollAmount / 260));
      if (scrollAmount >= 260) enter(focusAfter).catch(finish);
    }
    learnMore.addEventListener("click", event => enter(event.detail === 0).catch(finish), options);
    scene.addEventListener("wheel", event => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      accumulate(event.deltaY * unit);
    }, {...options, passive: false});
    scene.addEventListener("touchstart", event => {
      touchY = event.touches.length === 1 ? event.touches[0].clientY : null;
    }, {...options, passive: true});
    scene.addEventListener("touchmove", event => {
      if (touchY === null || event.touches.length !== 1) { touchY = null; return; }
      event.preventDefault();
      const y = event.touches[0].clientY;
      accumulate(touchY - y);
      touchY = y;
    }, {...options, passive: false});
    scene.addEventListener("touchend", () => { touchY = null; }, options);
    scene.addEventListener("touchcancel", () => { touchY = null; }, options);
    addEventListener("keydown", event => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest?.("a, button, input, textarea")) return;
      const steps = {ArrowDown: 70, ArrowUp: -70, PageDown: 260, " ": 260, End: 260};
      if (!(event.key in steps)) return;
      event.preventDefault();
      accumulate(steps[event.key], true);
    }, options);
    addEventListener("resize", ready, options);
    reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) ready(); }, options);
    addEventListener("pagehide", finish, options);
    addEventListener("hashchange", finish, options);
    const keepAtTop = () => { if (scrollY > 0) scrollTo({top: 0, left: 0, behavior: "instant"}); };
    addEventListener("scroll", keepAtTop, {...options, passive: true});
    addEventListener("load", keepAtTop, options);

    await Promise.all([document.fonts.ready, rails.decode(), head.decode(), paper.decode()]);
    if (finished) return;
    clearTimeout(window.catalexIntroFallback);
    keepAtTop();
    measure();
    if (reducedMotion.matches || !playing) return ready();
    const first = reaction.firstElementChild.getBoundingClientRect();
    // Research is already on the paper; the lamp reveals it before printing resumes.
    movePrinter(first.right);
    revealTo(first.right);
    await pause(320);
    if (!playing) return;
    root.dataset.intro = "illuminating";
    scene.classList.add("is-lamp-on");
    await animate(lampCover, [{opacity: 1}, {opacity: 0}], {duration: 450}).finished;
    if (!playing) return;
    await pause(280);
    if (!playing) return;
    root.dataset.intro = "printing";
    await printPass();
    if (!playing) return;
    reaction.style.clipPath = "none";
    await pause(180);
    if (!playing) return;
    root.dataset.intro = "lighting";
    scene.classList.add("is-brightening");
    await illuminatePage();
    if (!playing) return;
    ready();
  } catch {
    // Interrupted motion is expected when the viewport or motion preference changes.
    // A failed asset or initialization always reveals the usable main site.
    if (playing || entering) finish();
  }
}
