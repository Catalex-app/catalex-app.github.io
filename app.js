const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

if (new URLSearchParams(location.search).get("intro") === "typewriter") {
  import("./typewriter.js").then(({setupTypewriterEntrance}) => setupTypewriterEntrance(reducedMotion)).catch(setupHeroEntrance);
} else {
  setupHeroEntrance();
}
setupCarousel();
setupHighlightsOverlay();

function setupHeroEntrance() {
  const root = document.documentElement;
  const scene = document.querySelector(".intro-scene");
  const animations = [];
  const controller = new AbortController();
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(window.catalexIntroFallback);
    controller.abort();
    root.classList.remove("intro-pending");
    root.dataset.intro = "complete";
    if (window.catalexIntroScrollRestoration) {
      history.scrollRestoration = window.catalexIntroScrollRestoration;
    }
    scene?.remove();
    for (const animation of animations) animation.cancel();
  };
  if (!scene || !root.classList.contains("intro-pending") || reducedMotion.matches) {
    finish();
    return;
  }
  scrollTo({top: 0, left: 0, behavior: "instant"});

  const options = {signal: controller.signal};
  // Navigation and changes to the viewport always take precedence over the intro.
  document.addEventListener("keydown", finish, options);
  document.addEventListener("focusin", finish, options);
  scene.addEventListener("pointerdown", finish, options);
  for (const event of ["wheel", "touchstart", "resize", "pagehide", "hashchange"]) {
    addEventListener(event, finish, {...options, passive: true});
  }
  // Some browsers restore a refresh's old scroll position after parsing. Keep
  // the welcome at the top; deliberate wheel/touch/key input still skips it.
  const keepAtTop = () => {
    if (scrollY > 0) scrollTo({top: 0, left: 0, behavior: "instant"});
  };
  addEventListener("scroll", keepAtTop, {...options, passive: true});
  addEventListener("load", keepAtTop, options);
  document.addEventListener("visibilitychange", () => { if (document.hidden) finish(); }, options);
  reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) finish(); }, options);

  function animate(element, frames, timing) {
    const animation = element.animate(frames, {
      duration: 380, easing: "cubic-bezier(.22, 1, .36, 1)", fill: "both", ...timing,
    });
    // Cancellation is expected when a visitor skips, resizes, or navigates away.
    animation.finished.catch(() => {});
    animations.push(animation);
    return animation;
  }

  async function play() {
    await document.fonts.ready;
    if (finished || !root.classList.contains("intro-pending")) return finish();
    keepAtTop();
    root.dataset.intro = "forming";
    function type(selector, delay) {
      const element = scene.querySelector(selector);
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
      const nodes = [];
      while (walker.nextNode()) nodes.push(walker.currentNode);
      let index = 0;
      // Keep the final layout reserved, including the original subscript markup.
      // Discrete character reveals work with proportional text without clipping glyphs.
      for (const node of nodes) {
        const fragment = document.createDocumentFragment();
        for (const character of node.textContent) {
          const letter = document.createElement("span");
          letter.className = "intro-letter";
          letter.textContent = character;
          fragment.append(letter);
          animate(letter, [{opacity: 1}, {opacity: 1}], {
            delay: delay + index++ * 38, duration: 1, easing: "linear", fill: "forwards",
          });
        }
        node.replaceWith(fragment);
      }
      element.style.opacity = "1";
    }
    type(".reactant", 80);
    type(".operator", 600);
    type(".reactant:nth-child(3)", 700);
    type(".catalyst-brand > span", 1420);
    scene.querySelector(".catalyst-brand").style.opacity = "1";
    animate(scene.querySelector(".catalyst-cat"), [{opacity: 0}, {opacity: 1}], {
      delay: 1420, duration: 180,
    });
    animate(scene.querySelector(".reaction-shaft"), [
      {strokeDashoffset: "1"}, {strokeDashoffset: "0"},
    ], {delay: 1700, duration: 440, easing: "linear"});
    animate(scene.querySelector(".reaction-head"), [
      {strokeDashoffset: "1"}, {strokeDashoffset: "0"},
    ], {delay: 2140, duration: 160, easing: "linear"});
    type(".product", 2320);
    // Leave one short beat to read the completed equation before the handoff.
    await animate(scene, [{opacity: 1}, {opacity: 1}], {duration: 2820}).finished;
    if (finished || !root.classList.contains("intro-pending")) return finish();

    const header = document.querySelector(".site-header");
    const brand = header.querySelector(".brand");
    const source = scene.querySelector(".catalyst-brand");
    const from = source.getBoundingClientRect();
    const to = brand.getBoundingClientRect();
    source.style.visibility = "hidden";
    root.dataset.intro = "docking";
    // Move the real header mark from the equation's measured position to its home.
    const flight = animate(brand, [
      {opacity: 1, transform: `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.height / to.height})`},
      {opacity: 1, transform: "translate(0, 0) scale(1)"},
    ], {duration: 820, easing: "cubic-bezier(.65, 0, .2, 1)"});
    animate(scene, [{opacity: 1}, {opacity: 0}], {duration: 300});
    animate(header, [{borderColor: "transparent"}, {borderColor: "#e4e4e7"}], {duration: 500});
    for (const control of header.querySelectorAll(":scope > :not(.brand)")) {
      animate(control, [{opacity: 0}, {opacity: 1}], {delay: 180, duration: 500});
    }
    const content = animate(document.querySelector("#main"), [
      {opacity: 0, transform: "translateY(14px)"}, {opacity: 1, transform: "translateY(0)"},
    ], {delay: 420, duration: 620});
    await Promise.all([flight.finished, content.finished]);
    finish();
  }
  play().catch(finish);
}

function setupCarousel() {
	const track = document.querySelector(".highlight-track");
	const cards = [...track.querySelectorAll(".highlight-card")];
	const dots = document.querySelector(".carousel-dots");
	const nextButton = document.querySelector("#highlight-next");
	const previousButton = document.querySelector("#highlight-prev");
	let index = 0;
	function updateDots() {
		previousButton.disabled = index === 0;
		const last = index === cards.length - 1;
		nextButton.setAttribute("aria-label", last ? "Start over" : "Next highlight");
		nextButton.querySelector("span").textContent = last ? "Start over" : "Next";
		nextButton.querySelector("path").setAttribute("d", last
			? "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5"
			: "M5 12h14m-7-7 7 7-7 7");
		[...dots.children].forEach((dot, i) =>
			dot.setAttribute("aria-pressed", i === index),
		);
	}
	function goTo(next) {
		index = next < 0 ? 0 : next % cards.length;
		const padding = parseFloat(getComputedStyle(track).paddingLeft);
		track.scrollTo({
			left: cards[index].offsetLeft - track.offsetLeft - padding,
			behavior: reducedMotion.matches ? "instant" : "smooth",
		});
		updateDots();
	}
	cards.forEach((card, i) => {
		card.setAttribute("aria-roledescription", "slide");
		card.setAttribute("aria-label", `${i + 1} of ${cards.length}`);
		const dot = document.createElement("button");
		const mark = document.createElement("span");
		mark.setAttribute("aria-hidden", "true");
		dot.append(mark);
		dot.setAttribute(
			"aria-label",
			`Highlight ${i + 1}: ${card.querySelector("h3").textContent}`,
		);
		dot.addEventListener("click", () => goTo(i));
		dots.append(dot);
	});
	updateDots();
	document
		.querySelector("#highlight-prev")
		.addEventListener("click", () => goTo(index - 1));
	document
		.querySelector("#highlight-next")
		.addEventListener("click", () => goTo(index + 1));
	track.addEventListener("keydown", (event) => {
		if (["ArrowLeft", "ArrowRight"].includes(event.key)) {
			event.preventDefault();
			goTo(index + (event.key === "ArrowRight" ? 1 : -1));
		}
	});
	track.addEventListener(
		"scroll",
		() => {
			const padding = parseFloat(getComputedStyle(track).paddingLeft);
			const nearest = cards.reduce(
				(best, card, i) =>
					Math.abs(
						card.offsetLeft - track.offsetLeft - padding - track.scrollLeft,
					) <
					Math.abs(
						cards[best].offsetLeft -
							track.offsetLeft -
							padding -
							track.scrollLeft,
					)
						? i
						: best,
				0,
			);
			index = nearest;
			updateDots();
		},
		{ passive: true },
	);
}

function setupHighlightsOverlay() {
  const opener = document.querySelector(".highlights-view-link");
  let dialog;
  let closing = false;
  let overlayAnimation;
  let returnFocus;
  let cards;
  let updateCurrent;
  let wheelFrame = 0;
  let wheelTarget = 0;
  let wheelPosition = 0;

  function stopWheelScroll() {
    cancelAnimationFrame(wheelFrame);
    wheelFrame = 0;
  }

  function readingTop() {
    if (!matchMedia("(max-width: 820px)").matches) return 80;
    return 80 + dialog.querySelector(".highlights-menu").offsetHeight + dialog.querySelector(".highlights-stage").offsetHeight;
  }

  function updateReadingSpace() {
    const height = Math.max(0, innerHeight - readingTop());
    const track = dialog.querySelector(".highlight-track");
    track.style.paddingTop = `${Math.max(0, (height - cards[0].offsetHeight) / 2)}px`;
    track.style.paddingBottom = `${Math.max(0, (height - cards.at(-1).offsetHeight) / 2)}px`;
  }

  function jumpTo(index, behavior = "instant") {
    stopWheelScroll();
    updateReadingSpace();
    const rect = cards[index].getBoundingClientRect();
    const center = readingTop() + (innerHeight - readingTop()) / 2;
    dialog.scrollTo({top: dialog.scrollTop + rect.top + rect.height / 2 - center, behavior});
    updateCurrent();
  }

  function createOverlay() {
    dialog = document.createElement("dialog");
    dialog.className = "highlights-view";
    dialog.setAttribute("aria-labelledby", "highlights-overlay-title");
    dialog.innerHTML = `<div class="highlights-overlay-content">
      <div class="section-topline"><h2 id="highlights-overlay-title"></h2>
      <button type="button" class="button highlights-close" aria-label="Close" autofocus><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></div>
      <div class="highlights-detail-layout"><nav class="highlights-menu" aria-label="Highlight sections"><ol></ol></nav></div>
    </div>`;
    // The carousel remains in place; both views use the same source content.
    const track = document.querySelector(".highlight-track").cloneNode(true);
    for (const attr of ["role", "aria-roledescription", "aria-label", "tabindex"]) track.removeAttribute(attr);
    const menu = dialog.querySelector(".highlights-menu");
    const stage = document.createElement("div");
    stage.className = "highlights-stage";
    const visuals = [];
    cards = [...track.querySelectorAll(".highlight-card")];
    const links = cards.map((card, index) => {
      card.id = `highlight-${card.dataset.scene}`;
      card.removeAttribute("aria-label");
      card.removeAttribute("aria-roledescription");
      const oldHeading = card.querySelector("h3");
      const heading = document.createElement("h2");
      heading.id = `${card.id}-title`;
      heading.textContent = oldHeading.textContent;
      oldHeading.replaceWith(heading);
      card.setAttribute("aria-labelledby", heading.id);
      const visual = card.querySelector(".card-visual");
      visual.dataset.scene = card.dataset.scene;
      visual.setAttribute("aria-hidden", "true");
      visual.querySelector("img").loading = "eager";
      stage.append(visual);
      visuals.push(visual);
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${card.id}`;
      const label = document.createElement("span");
      label.textContent = {write: "Editor", git: "Git", agent: "Context", review: "Review", comments: "Comments", history: "Rewind"}[card.dataset.scene] || heading.textContent;
      const measure = label.cloneNode(true);
      measure.className = "menu-label-measure";
      measure.setAttribute("aria-hidden", "true");
      link.append(label, measure);
      link.addEventListener("click", event => {
        event.preventDefault();
        jumpTo(index, reducedMotion.matches ? "instant" : "smooth");
      });
      item.append(link);
      menu.querySelector("ol").append(item);
      return link;
    });
    dialog.querySelector(".highlights-detail-layout").append(stage, track);
    document.body.append(dialog);
    let queued = false;
    let activeIndex = -1;
    updateCurrent = () => {
      queued = false;
      const center = readingTop() + (innerHeight - readingTop()) / 2;
      let current = 0;
      let distance = Infinity;
      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const next = Math.abs(rect.top + rect.height / 2 - center);
        if (next < distance) { current = i; distance = next; }
      });
      if (dialog.scrollTop > 0 && dialog.scrollTop + dialog.clientHeight >= dialog.scrollHeight - 2) current = cards.length - 1;
      if (current === activeIndex) return;
      activeIndex = current;
      visuals.forEach((visual, i) => {
        visual.classList.toggle("is-active", i === current);
        visual.setAttribute("aria-hidden", String(i !== current));
        cards[i].classList.toggle("is-active", i === current);
      });
      links.forEach((link, i) => {
        if (i === current) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      if (menu.scrollWidth > menu.clientWidth) {
        const link = links[current];
        menu.scrollTo({left: link.offsetLeft - menu.offsetLeft - (menu.clientWidth - link.offsetWidth) / 2, behavior: "instant"});
      }
    };
    const scheduleUpdate = () => {
      if (dialog.open && !queued) { queued = true; requestAnimationFrame(updateCurrent); }
    };
    dialog.addEventListener("scroll", scheduleUpdate, {passive: true});
    // A lighter wheel response gives each description time to settle into focus.
    dialog.addEventListener("wheel", event => {
      if (event.ctrlKey || event.metaKey || event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      if (menu.contains(event.target) && (menu.scrollWidth > menu.clientWidth || menu.scrollHeight > menu.clientHeight)) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? dialog.clientHeight : 1;
      const delta = event.deltaY * unit * .55;
      if (reducedMotion.matches) {
        stopWheelScroll();
        dialog.scrollBy({top: delta, behavior: "instant"});
        return;
      }
      if (!wheelFrame) wheelTarget = wheelPosition = dialog.scrollTop;
      wheelTarget = Math.max(0, Math.min(dialog.scrollHeight - dialog.clientHeight, wheelTarget + delta));
      if (wheelFrame) return;
      let previous = performance.now();
      const step = now => {
        const remaining = wheelTarget - wheelPosition;
        if (Math.abs(remaining) <= 2) {
          dialog.scrollTop = wheelTarget;
          wheelFrame = 0;
          return;
        }
        wheelPosition += remaining * (1 - Math.exp(-(now - previous) / 75));
        dialog.scrollTop = wheelPosition;
        previous = now;
        wheelFrame = requestAnimationFrame(step);
      };
      wheelFrame = requestAnimationFrame(step);
    }, {passive: false});
    dialog.addEventListener("touchstart", stopWheelScroll, {passive: true});
    dialog.addEventListener("pointerdown", stopWheelScroll);
    dialog.addEventListener("keydown", stopWheelScroll);
    addEventListener("resize", () => {
      if (dialog.open) { updateReadingSpace(); scheduleUpdate(); }
    });
    dialog.querySelector(".highlights-close").addEventListener("click", closeOverlay);
    dialog.addEventListener("cancel", event => { event.preventDefault(); closeOverlay(); });
  }

  async function openOverlay(requestedScene) {
    if (!dialog) createOverlay();
    await document.fonts.ready;
    if (dialog.open) return;
    dialog.querySelector("#highlights-overlay-title").textContent = document.querySelector("#highlights-title").textContent;
    returnFocus = document.activeElement;
    document.documentElement.classList.add("highlights-open");
    dialog.style.opacity = reducedMotion.matches ? "1" : "0";
    dialog.showModal();
    const selected = [...document.querySelectorAll(".carousel-dots button")].findIndex(dot => dot.getAttribute("aria-pressed") === "true");
    const requested = cards.findIndex(card => card.dataset.scene === requestedScene);
    jumpTo(requested >= 0 ? requested : Math.max(0, selected));
    if (!reducedMotion.matches) {
      overlayAnimation = dialog.animate([{opacity: 0}, {opacity: 1}], {
        duration: 200, easing: "ease-out", fill: "both",
      });
    }
  }

  async function closeOverlay() {
    if (closing) return;
    closing = true;
    stopWheelScroll();
    const opacity = getComputedStyle(dialog).opacity;
    overlayAnimation?.cancel();
    dialog.style.opacity = opacity;
    if (!reducedMotion.matches) {
      overlayAnimation = dialog.animate([{opacity}, {opacity: 0}], {
        duration: 160, easing: "ease-out", fill: "both",
      });
      await overlayAnimation.finished;
    }
    // Keep the final transparent frame until the dialog has left the top layer.
    dialog.close();
    overlayAnimation?.cancel();
    overlayAnimation = undefined;
    dialog.style.removeProperty("opacity");
    document.documentElement.classList.remove("highlights-open");
    returnFocus?.focus({preventScroll: true});
    closing = false;
  }

  opener.addEventListener("click", () => openOverlay());
  // Existing preview links now open the overlay over the regular landing page.
  const url = new URL(location.href);
  if (url.searchParams.get("view") === "highlights") {
    const scene = url.hash.replace("#highlight-", "");
    url.searchParams.delete("view");
    url.hash = "highlights";
    history.replaceState(null, "", url);
    document.querySelector("#highlights").scrollIntoView({behavior: "instant"});
    opener.focus({preventScroll: true});
    openOverlay(scene);
  }
}

// Reveal the landing page in small groups, without changing its layout.
function setupScrollReveals() {
  if (reducedMotion.matches || !("IntersectionObserver" in window)) return;
  const groups = [
    ["#highlights .section-topline", 0],
    ["#highlights .highlight-track", 60],
    ["#highlights .carousel-controls", 0],
    [".agent-story", 0],
    [".agent-figures", 70],
    ["#research-title", 0],
    [".research-intro", 50],
    [".research-principles li", 0],
  ];
  const targets = new Map();
  const animations = new Map();
  function reveal(element, animate = true) {
    if (element.dataset.reveal !== "pending") return;
    element.dataset.reveal = "visible";
    if (!animate) return;
    const animation = element.animate([
      {opacity: 0, transform: "translateY(16px)"},
      {opacity: 1, transform: "translateY(0)"},
    ], {duration: 560, delay: targets.get(element), easing: "cubic-bezier(.22, 1, .36, 1)", fill: "backwards"});
    animations.set(element, animation);
    const cleanup = () => {
      if (animations.get(element) === animation) animations.delete(element);
    };
    animation.finished.then(cleanup, cleanup);
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const element = entry.target;
      if (entry.isIntersecting) {
        reveal(element);
      } else if (!element.contains(document.activeElement)) {
        // Reset only outside the viewport so visible content never disappears.
        animations.get(element)?.cancel();
        animations.delete(element);
        element.dataset.reveal = "pending";
      }
    }
  }, {threshold: 0});
  for (const [selector, delay] of groups) {
    document.querySelectorAll(selector).forEach((element, index) => {
      const rect = element.getBoundingClientRect();
      const visible = rect.top < innerHeight && rect.bottom > 0;
      element.dataset.reveal = visible ? "visible" : "pending";
      targets.set(element, selector === ".research-principles li" && innerWidth > 820 ? index % 2 * 60 : delay);
      observer.observe(element);
    });
  }
  document.addEventListener("focusin", event => {
    for (const element of targets.keys()) if (element.contains(event.target)) reveal(element, false);
  });
  reducedMotion.addEventListener("change", event => {
    if (!event.matches) return;
    observer.disconnect();
    for (const element of targets.keys()) reveal(element, false);
    for (const animation of animations.values()) animation.cancel();
  });
}
setupScrollReveals();
