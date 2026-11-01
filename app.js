const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const initializedDemoVideos = new WeakSet();

// WebKit can prefer the #main anchor over native scroll restoration on reload.
// Keep the current offset on this history entry, never as a site-wide preference.
addEventListener("pagehide", () => {
  if (location.hash && location.hash !== "#top" && document.documentElement.dataset.intro === "complete") {
    history.replaceState({...history.state, catalexMainScroll: scrollY}, "");
  }
});
const savedMainScroll = history.state?.catalexMainScroll;
if (performance.getEntriesByType("navigation")[0]?.type === "reload" && location.hash && location.hash !== "#top" && Number.isFinite(savedMainScroll)) {
  addEventListener("pageshow", async () => {
    // Restore after entry setup removes Welcome-only copy and fonts settle.
    await entranceReady;
    await document.fonts.ready;
    requestAnimationFrame(() => scrollTo({top:savedMainScroll, left:0, behavior:"instant"}));
  }, {once:true});
}

// #top (or the bare homepage) is Welcome; #main and section anchors are Main.
// Return in place so the visible content can slide away without a document reload.
document.querySelector(".site-header .brand")?.addEventListener("click", event => {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || document.documentElement.dataset.intro !== "complete") return;
  event.preventDefault();
  entranceModule.then(({returnToWelcome}) => returnToWelcome(reducedMotion, {focus:event.detail === 0}));
});
addEventListener("hashchange", () => {
  if ((!location.hash || location.hash === "#top") && document.documentElement.dataset.intro === "complete") {
    entranceModule.then(({returnToWelcome}) => returnToWelcome(reducedMotion, {pushHistory:false}));
  }
});
addEventListener("pageshow", event => {
  if (event.persisted && (!location.hash || location.hash === "#top") && document.documentElement.dataset.intro === "complete") {
    location.reload();
  }
});

const entranceModule = import("./typewriter.js");
const entranceReady = entranceModule
  .then(({setupTypewriterEntrance}) => setupTypewriterEntrance(reducedMotion))
  .catch(() => {
    // A missing Intro must leave the ordinary homepage usable.
    clearTimeout(window.catalexIntroFallback);
    document.documentElement.classList.remove("intro-pending","typewriter-pending","welcome-preview","welcome-returning");
    document.documentElement.dataset.intro = "complete";
    document.querySelector(".intro-scene")?.remove();
    if (window.catalexIntroScrollRestoration) history.scrollRestoration = window.catalexIntroScrollRestoration;
  });
setupDemoVideo(document.querySelector(".hero-demo-video"));
setupCarousel();
setupHighlightsOverlay();
setupWorkflowAnimation();
setupWelcomeReturnGesture();

function setupWelcomeReturnGesture() {
  const root = document.documentElement;
  const header = document.querySelector(".site-header");
  const hint = document.createElement("button");
  hint.type = "button";
  hint.className = "terminal-scroll main-return-scroll";
  hint.innerHTML = 'Keep scrolling to return<span aria-hidden="true"></span>';
  hint.hidden = true;
  document.body.append(hint);
  let amount = 0;
  let resetTimer;
  let shown = false;
  let readyAt = 0;
  let fade;

  function reset(immediate = false) {
    amount = 0;
    clearTimeout(resetTimer);
    if (immediate || reducedMotion.matches) {
      shown = false;
      fade?.cancel();
      hint.hidden = true;
      hint.style.setProperty("--scroll-progress", "0");
      return;
    }
    if (!shown) return;
    shown = false;
    const opacity = getComputedStyle(hint).opacity;
    fade?.cancel();
    fade = hint.animate([{opacity}, {opacity:0}], {duration:180, easing:"ease-out", fill:"both"});
    fade.finished.then(() => {
      if (!shown) hint.hidden = true;
    }).catch(() => {});
  }

  function returnHome(focus = false) {
    reset(true);
    entranceModule.then(({returnToWelcome}) => returnToWelcome(reducedMotion, {focus}));
  }

  function isNestedScroll(target) {
    for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
      if (el.matches('dialog, input, textarea, select, [contenteditable="true"]')) return true;
      if (el.scrollHeight > el.clientHeight && /auto|scroll/.test(getComputedStyle(el).overflowY)) return true;
    }
    return false;
  }

  addEventListener("wheel", event => {
    const now = performance.now();
    if (root.dataset.intro !== "complete" || scrollY > 2 || event.ctrlKey || event.metaKey ||
        document.querySelector("dialog[open]") || isNestedScroll(event.target)) {
      reset();
      return;
    }
    // Trackpads can begin with sideways/zero samples and interleave them with
    // vertical input. Ignore those samples without cancelling the prompt.
    if (event.deltaY === 0 || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
    if (event.deltaY > 0) {
      // Subpixel direction jitter should not erase an upward gesture.
      if (event.deltaY * unit <= 2) return;
      reset();
      return;
    }
    // Browser wheel events do not distinguish fingers from momentum. Do not
    // require an idle gap: a trackpad can keep streaming through the next swipe.
    // The reveal stage and subsequent distance threshold provide the boundary.
    event.preventDefault();
    clearTimeout(resetTimer);
    resetTimer = setTimeout(() => reset(), 3000);
    if (!shown) {
      const opacity = hint.hidden ? 0 : getComputedStyle(hint).opacity;
      fade?.cancel();
      shown = true;
      hint.style.setProperty("--return-top", `${header.getBoundingClientRect().bottom + 8}px`);
      hint.style.setProperty("--scroll-progress", "0");
      hint.hidden = false;
      const duration = reducedMotion.matches ? 0 : 180;
      readyAt = now + 180;
      fade = hint.animate([{opacity}, {opacity:1}], {duration, easing:"ease-out", fill:"both"});
      // Stage one only reveals the prompt. Count subsequent input once visible.
      return;
    }
    if (now < readyAt) return;
    amount += Math.min(80, -event.deltaY * unit);
    hint.style.setProperty("--scroll-progress", Math.min(1, amount / 260));
    if (amount >= 260) returnHome();
  }, {passive:false});
  hint.addEventListener("click", event => returnHome(event.detail === 0));
  addEventListener("scroll", () => { if (scrollY > 2) reset(); }, {passive:true});
  addEventListener("resize", () => reset(true));
  addEventListener("pagehide", () => reset(true));
  new MutationObserver(() => reset(true)).observe(root, {attributes:true, attributeFilter:["data-intro"]});
}

function setupWorkflowAnimation() {
  const figure = document.querySelector(".review-figure");
  if (!figure) return;
  const replay = figure.querySelector(".flow-replay");
  const paths = [...figure.querySelectorAll(".flow-lines path")];
  const details = [...figure.querySelectorAll(".flow-node, .flow-label, .flow-agent-step, .review-gate")];
  let animations = [];
  let run = 0;
  let inView = false;
  let restoreFocus = false;

  function prepare() {
    replay.hidden = true;
    for (const path of paths) {
      const length = path.getTotalLength();
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
    }
    for (const detail of details) detail.style.opacity = "0";
  }

  function finish() {
    run++;
    for (const animation of animations) animation.cancel();
    animations = [];
    for (const path of paths) {
      path.style.removeProperty("stroke-dasharray");
      path.style.removeProperty("stroke-dashoffset");
    }
    for (const detail of details) detail.style.removeProperty("opacity");
    figure.dataset.flowState = "complete";
    replay.hidden = reducedMotion.matches;
    if (restoreFocus && !replay.hidden) replay.focus({preventScroll: true});
    restoreFocus = false;
  }

  function play() {
    if (reducedMotion.matches) return finish();
    const currentRun = ++run;
    for (const animation of animations) animation.cancel();
    animations = [];
    restoreFocus = document.activeElement === replay;
    prepare();
    figure.dataset.flowState = "playing";
    const animate = (element, frames, delay, duration, easing = "linear") => {
      const animation = element.animate(frames, {delay, duration, easing, fill: "both"});
      animations.push(animation);
    };
    const motionCurve = "cubic-bezier(.4, 0, .2, 1)";
    const draw = (selector, stops) => {
      const path = figure.querySelector(selector);
      const length = path.getTotalLength();
      const duration = stops.at(-1)[0];
      animate(path, stops.map(([time, distance]) => ({
        offset: time / duration,
        strokeDashoffset: length - distance,
        easing: motionCurve,
      })), 0, duration);
    };
    const reveal = (selector, delay) => {
      for (const element of figure.querySelectorAll(selector)) {
        animate(element, [{opacity: 0}, {opacity: 1}], delay, 240, "ease-out");
      }
    };
    // Repeated distances create real pauses at the nodes. Each moving
    // segment accelerates and settles independently, keeping labels readable.
    const author = figure.querySelector(".author-line");
    draw(".author-line", [[0, 0], [300, 0], [650, 30], [1050, 30],
      [1950, 200], [2450, 200], [3200, author.getTotalLength()]]);
    reveal(".flow-start, .flow-project", 650);
    reveal(".flow-edit, .flow-author", 1950);
    const draft = figure.querySelector(".draft-line");
    const draftNodeDistance = draft.getTotalLength() - 118;
    draw(".draft-line", [[0, 0], [1050, 0], [2050, draftNodeDistance],
      [2650, draftNodeDistance], [3300, draft.getTotalLength()]]);
    reveal(".draft-node, .flow-agent-step", 2050);
    reveal(".review-gate", 3300);
    // Read the white approval card, confirm in green, then release the edits.
    animate(figure.querySelector(".review-gate"), [
      {backgroundColor: "#fff", borderColor: "#fff", color: "#18181b"},
      {backgroundColor: "#16804c", borderColor: "#16804c", color: "#fff"},
    ], 4200, 360, motionCurve);
    const accepted = figure.querySelector(".accepted-line");
    const acceptedNodeDistance = accepted.getTotalLength() - 58;
    draw(".accepted-line", [[0, 0], [4650, 0], [5500, acceptedNodeDistance],
      [5800, acceptedNodeDistance], [6200, accepted.getTotalLength()]]);
    reveal(".accepted-node, .flow-accepted", 5500);
    Promise.all(animations.map(animation => animation.finished)).then(() => {
      if (run === currentRun) finish();
    }, () => {});
    updatePlayback();
  }

  function updatePlayback() {
    const visible = inView && !document.hidden && document.documentElement.dataset.intro === "complete";
    if (figure.dataset.flowState === "pending" && visible) play();
    else if (figure.dataset.flowState === "playing") {
      for (const animation of animations) visible ? animation.play() : animation.pause();
    }
  }

  if (reducedMotion.matches || !("IntersectionObserver" in window)) {
    finish();
  } else {
    prepare();
    figure.dataset.flowState = "pending";
  }
  const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
    inView = entries[0].intersectionRatio >= .6;
    updatePlayback();
  }, {threshold: [0, .6]}) : null;
  observer?.observe(figure);
  new MutationObserver(updatePlayback).observe(document.documentElement, {attributes: true, attributeFilter: ["data-intro"]});
  document.addEventListener("visibilitychange", updatePlayback);
  reducedMotion.addEventListener("change", () => {
    if (reducedMotion.matches) finish();
    else replay.hidden = false;
  });
  replay.addEventListener("click", play);
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

// Both recordings keep a complete still until actual playback starts.
function setupDemoVideo(video) {
  if (!video || initializedDemoVideos.has(video)) return;
  initializedDemoVideos.add(video);
  const frame = video.closest(".hero-window, .card-visual");
  const dialog = video.closest("dialog");
  const connection = navigator.connection;
  let inView = false;
  let loaded = false;
  let failed = false;
  let loadTimer;
  const blockedReason = () => reducedMotion.matches ? "reduced-motion" : connection?.saveData ? "save-data" : !inView ? "offscreen" : document.hidden ? "hidden-tab" : document.documentElement.dataset.intro !== "complete" ? "welcome" : dialog ? (!dialog.open || frame.getAttribute("aria-hidden") === "true" ? "inactive" : null) : document.documentElement.classList.contains("highlights-open") ? "covered" : null;
  const eligible = () => !failed && !blockedReason();
  function fallback(reason = "load-error", detail = "") {
    frame.dataset.demoState = reason;
    if (detail) frame.dataset.demoError = detail;
    failed = true;
    clearTimeout(loadTimer);
    video.pause();
    frame.classList.remove("is-playing");
    video.removeAttribute("src");
    video.load();
  }
  function update() {
    if (!eligible()) {
      if (!failed) frame.dataset.demoState = blockedReason();
      video.pause();
      if (reducedMotion.matches || connection?.saveData) frame.classList.remove("is-playing");
      return;
    }
    if (!loaded) {
      loaded = true;
      video.muted = true;
      frame.dataset.demoState = "loading";
      video.preload = "auto";
      video.src = video.dataset.src;
      // Slow or unavailable video leaves a still, without a loading interface.
      loadTimer = setTimeout(() => fallback("load-timeout"), 5000);
    }
    video.play().catch(error => { if (error.name !== "AbortError") fallback(video.error || error.name === "NotSupportedError" ? "load-error" : "play-blocked", `${error.name}: ${error.message}`); });
  }
  video.addEventListener("playing", () => {
    if (!eligible()) { video.pause(); return; }
    clearTimeout(loadTimer);
    frame.dataset.demoState = "playing";
    frame.classList.add("is-playing");
  });
  video.addEventListener("loadeddata", () => { clearTimeout(loadTimer); update(); });
  video.addEventListener("error", () => { if (!failed) fallback("load-error", `${video.error?.code}: ${video.error?.message}`); });
  const threshold = .15;
  new IntersectionObserver(entries => {
    inView = entries[0].isIntersecting && entries[0].intersectionRatio >= threshold;
    update();
  }, {threshold}).observe(video);
  new MutationObserver(update).observe(document.documentElement, {attributes: true, attributeFilter: ["data-intro", "class"]});
  if (dialog) {
    new MutationObserver(update).observe(dialog, {attributes: true, attributeFilter: ["open"]});
    new MutationObserver(update).observe(frame, {attributes: true, attributeFilter: ["aria-hidden"]});
  }
  document.addEventListener("visibilitychange", update);
  reducedMotion.addEventListener("change", update);
  connection?.addEventListener?.("change", update);
  update();
}
