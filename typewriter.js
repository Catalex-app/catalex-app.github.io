const welcomeTemplate = document.querySelector(".intro-scene")?.cloneNode(true);

export function returnToWelcome(reducedMotion, {pushHistory = true, focus = false} = {}) {
  const root = document.documentElement;
  if (root.dataset.intro !== "complete" || !welcomeTemplate) return;
  if (pushHistory) {
    history.replaceState({...history.state, catalexMainScroll:scrollY}, "");
    const url = new URL(location.href);
    url.searchParams.delete("playIntro");
    url.searchParams.delete("intro");
    url.hash = "top";
    history.pushState({catalexIntroReplayed:history.state?.catalexIntroReplayed}, "", url);
  }
  document.body.prepend(welcomeTemplate.cloneNode(true));
  root.classList.add("intro-pending", "typewriter-pending", "welcome-preview", "welcome-returning");
  root.dataset.intro = "returning";
  window.catalexIntroScrollRestoration = history.scrollRestoration;
  history.scrollRestoration = "manual";
  return setupTypewriterEntrance(reducedMotion, {focus});
}

// Entry policy is decided before paint; replay is a one-time URL command.
export async function setupTypewriterEntrance(reducedMotion, returnOptions = null) {
  const root = document.documentElement;
  const scene = document.querySelector(".intro-scene");
  if (!scene || !root.classList.contains("intro-pending")) {
    scene?.remove();
    const caption = document.querySelector(".hero-caption");
    if (caption?.children.length > 1) caption.firstElementChild.remove();
    root.classList.remove("typewriter-pending");
    root.dataset.intro = "complete";
    return;
  }

  const controller = new AbortController();
  const entry = returnOptions ? {play:false, automatic:false} : window.catalexIntroEntry ?? {play:false, automatic:false};
  if (entry.automatic) {
    // Mark the first visit at the start, so interruption or refresh never loops Intro.
    try { localStorage.setItem("catalex.introSeen", "1"); }
    catch { try { sessionStorage.setItem("catalex.introSeen", "1"); } catch {} }
  }
  const options = {signal: controller.signal};
  const animations = new Set();
  const header = document.querySelector(".site-header");
  const headerActions = header.querySelector(".header-actions");
  const replayIntro = header.querySelector(".header-replay");
  const pageParts = [...document.querySelectorAll("#main, .site-footer")];
  let playing = true;
  let entering = false;
  let focusOnEntry = false;
  let finished = false;
  let returning = Boolean(returnOptions);
  let returnStarted = false;
  const returnMotions = [];
  let settleReturn = () => {};
  let scrollAmount = 0;
  let touchY = null;
  let cameraFrame = 0;
  let cancelCursorFlight = () => {};
  let stopViewMotion = () => {};
  let caption = null;
  let landActions = () => {};
  let landWordmark = () => {};

  function finish() {
    if (finished) return;
    finished = true;
    playing = false;
    cancelAnimationFrame(cameraFrame);
    cancelCursorFlight();
    stopViewMotion();
    clearTimeout(window.catalexIntroFallback);
    controller.abort();
    for (const animation of animations) animation.cancel();
    landActions();
    landWordmark();
    header.inert = false;
    headerActions.inert = false;
    for (const part of pageParts) part.inert = false;
    root.classList.remove("intro-pending", "typewriter-pending", "welcome-preview", "welcome-returning");
    root.dataset.intro = "complete";
    if (entering) {
      const url = new URL(location.href);
      url.searchParams.delete("playIntro");
      url.searchParams.delete("intro");
      url.hash = "main";
      history.pushState(history.state, "", url);
    }
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
  const introSpeed = 1.25;
  const introPause = ms => pause(ms / introSpeed);
  const introAnimate = (element, frames, timing) => animate(element, frames, {
    ...timing,
    duration: timing.duration / introSpeed,
    delay: (timing.delay ?? 0) / introSpeed,
  });
  const blinkDuration = 620;
  const blinkFrames = [
    {opacity:1, offset:0}, {opacity:1, offset:.49},
    {opacity:0, offset:.5}, {opacity:0, offset:.99}, {opacity:1, offset:1},
  ];
  clearTimeout(window.catalexIntroFallback);
  window.catalexIntroFallback = setTimeout(finish, 8000);

  try {
    scene.classList.add("typewriter-intro", "terminal-intro");
    scene.removeAttribute("aria-hidden");
    scene.setAttribute("role", "dialog");
    scene.setAttribute("aria-modal", "true");
    scene.setAttribute("aria-label", "Welcome to Catalex. Scroll down to learn more.");
    scene.tabIndex = -1;
    for (const part of pageParts) part.inert = true;
    header.inert = true;
    headerActions.inert = true;
    if (!returning) scrollTo({top: 0, left: 0, behavior: "instant"});

    const reaction = scene.querySelector(".reaction");
    // Trim the artwork’s outer whitespace so its visible height aligns with the name.
    reaction.querySelector(".catalyst-cat").src = new URL("./assets/cat-leaf-mark.svg", import.meta.url).href;
    const captionHome = document.querySelector(".hero-caption");
    caption = captionHome.cloneNode(false);
    caption.classList.add("terminal-caption");
    caption.append(document.createElement("span"));
    caption.firstElementChild.textContent = "A LaTeX workspace for you and your agent.";
    if (captionHome.children.length > 1) captionHome.firstElementChild.remove();
    const description = document.createElement("div");
    description.className = "welcome-description";
    description.append(caption);
    const result = document.createElement("div");
    result.className = "terminal-result";
    result.setAttribute("aria-hidden", "true");
    const formulaFrame = document.createElement("div");
    formulaFrame.className = "terminal-formula";
    formulaFrame.append(reaction);
    const actions = document.querySelector("#welcome-actions").content.firstElementChild.cloneNode(true);
    actions.className = "hero-actions terminal-actions";
    actions.inert = true;
    const learnMore = document.createElement("button");
    learnMore.type = "button";
    learnMore.className = "terminal-scroll";
    learnMore.append("Scroll down to learn more");
    const progress = document.createElement("span");
    progress.setAttribute("aria-hidden", "true");
    learnMore.append(progress);
    learnMore.disabled = true;
    result.append(formulaFrame, description, actions, learnMore);

    const terminal = document.createElement("div");
    terminal.className = "terminal-view";
    terminal.setAttribute("aria-label", "LaTeX source");
    const track = document.createElement("pre");
    track.className = "terminal-track";
    const sourceText = document.createElement("span");
    sourceText.className = "terminal-text";
    const cursor = document.createElement("span");
    cursor.className = "terminal-cursor";
    cursor.setAttribute("aria-hidden", "true");
    track.append(sourceText, cursor);
    terminal.append(track);
    const compileButton = document.createElement("button");
    compileButton.type = "button";
    compileButton.className = "terminal-compile";
    compileButton.textContent = "Compile";
    compileButton.hidden = true;
    scene.append(terminal, result, compileButton);
    const latex = String.raw`\[
\text{Research}_{\text{human}}
+ \text{Collaboration}_{\text{agent}}
\xrightarrow{\text{Catalex}} \text{Paper}
\]`;
    const tokens = latex.match(/\\[a-zA-Z]+|\\[^a-zA-Z]|[{}]|[_^+]|[^\\{}_^+]+/g) ?? [];
    function highlightedToken(token) {
      const span = document.createElement("span");
      span.className = /^\\[a-zA-Z]/.test(token) ? "latex-command"
        : token.startsWith("\\") ? "latex-delimiter"
        : /^[{}]$/.test(token) ? "latex-brace"
        : /^[_^+]$/.test(token) ? "latex-operator" : "latex-text";
      return span;
    }
    const codePanel = document.createElement("pre");
    codePanel.className = "welcome-code";
    codePanel.id = "welcome-source";
    codePanel.setAttribute("aria-label", "LaTeX source");
    const codeText = document.createElement("code");
    for (const token of tokens) {
      const span = highlightedToken(token);
      span.textContent = token;
      codeText.append(span);
    }
    codePanel.append(codeText);
    formulaFrame.id = "welcome-preview";
    const viewControls = document.createElement("div");
    viewControls.className = "segmented welcome-views";
    viewControls.setAttribute("role", "group");
    viewControls.setAttribute("aria-label", "Formula view");
    viewControls.inert = true;
    const viewOptions = [
      {value:"code", label:"Code", name:"Code only", icon:'<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>'},
      {value:"split", label:"Split", name:"Split view", icon:'<path d="M8 19H5c-1 0-2-1-2-2V7c0-1 1-2 2-2h3"/><path d="M16 5h3c1 0 2 1 2 2v10c0 1-1 2-2 2h-3"/><line x1="12" x2="12" y1="4" y2="20"/>'},
      {value:"preview", label:"Preview", name:"Preview only", icon:'<path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z"/><path d="M14 2v5h5"/><text x="12" y="17.2" text-anchor="middle" font-size="5" font-weight="700" fill="currentColor" stroke="none">PDF</text>'},
    ];
    let viewMode = "preview";
    let viewRevision = 0;
    const viewMotions = new Set();
    stopViewMotion = () => {
      viewRevision++;
      for (const motion of viewMotions) motion.cancel();
      viewMotions.clear();
      codeText.style.width = "";
    };
    for (const option of viewOptions) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.view = option.value;
      button.setAttribute("aria-label", option.name);
      button.title = option.label;
      button.setAttribute("aria-controls", option.value === "split" ? "welcome-source welcome-preview" : option.value === "code" ? "welcome-source" : "welcome-preview");
      button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${option.value === "preview" ? 1.8 : 2}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${option.icon}</svg>`;
      button.addEventListener("click", () => changeView(option.value), options);
      viewControls.append(button);
    }
    viewControls.addEventListener("keydown", event => {
      const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
      if (!keys.includes(event.key)) return;
      event.preventDefault();
      const index = viewOptions.findIndex(option => option.value === viewMode);
      const next = event.key === "Home" ? 0 : event.key === "End" ? 2 : (index+(event.key === "ArrowRight" ? 1 : 2))%3;
      changeView(viewOptions[next].value);
      viewControls.children[next].focus({preventScroll:true});
    }, options);
    result.prepend(viewControls, codePanel);
    function applyView() {
      scene.dataset.view = viewMode;
      for (const button of viewControls.children) {
        const selected = button.dataset.view === viewMode;
        button.setAttribute("aria-pressed", String(selected));
        button.tabIndex = selected ? 0 : -1;
      }
      for (const [pane,visible] of [[codePanel,viewMode!=="preview"],[formulaFrame,viewMode!=="code"]]) {
        pane.style.visibility = visible ? "" : "hidden";
        pane.inert = !visible;
        if (visible) pane.removeAttribute("aria-hidden");
        else pane.setAttribute("aria-hidden", "true");
      }
    }
    applyView();
    root.dataset.intro = "preparing";
    const camera = {x:0, y:0, vx:0, vy:0, zoom:1, vz:0};
    const lineCount = (latex.match(/\n/g) ?? []).length;
    let zoomLevel = 0;
    let finalZoom = 1;
    let targetZoom = 1;
    let overview = false;
    let tempo = 1;
    let impactAt = -Infinity;
    let impactStrength = 0;
    let compilePoint = {x:0, y:0, width:0, height:0};
    let compiling = false;
    let focusActionAfterCompile = false;
    function paintCamera() {
      const pixels = devicePixelRatio || 1;
      // Align glyphs to physical pixels instead of continually resampling their edges.
      track.style.transform = `translate(${Math.round(camera.x*pixels)/pixels}px, ${Math.round(camera.y*pixels)/pixels}px) scale(${camera.zoom})`;
      // Brief line-break impact, separate from cursor framing so it never drifts.
      const age = (performance.now()-impactAt)/1000*introSpeed;
      const envelope = age < .42 ? Math.exp(-age*13)*(1-age/.42) : 0;
      if (envelope > .001) {
        const x = Math.round(Math.sin(age*70)*impactStrength*envelope*pixels)/pixels;
        const y = Math.round(-Math.cos(age*55)*impactStrength*.65*envelope*pixels)/pixels;
        const tilt = Math.sin(age*58)*.3*envelope;
        terminal.style.transform = `translate(${x}px, ${y}px) rotate(${tilt}deg)`;
      } else terminal.style.transform = "none";
    }
    function settleAxis(position, velocity, target, dt) {
      // Analytic critically damped spring: weight without bounce or frame-rate dependence.
      const frequency = 15 * Math.sqrt(tempo);
      const error = position - target;
      const step = (velocity + frequency * error) * dt;
      const decay = Math.exp(-frequency * dt);
      return [target + (error + step) * decay, (velocity - frequency * step) * decay];
    }
    function startCamera() {
      camera.x = innerWidth / 2 - cursor.offsetLeft - cursor.offsetWidth / 2;
      camera.y = innerHeight / 2 - cursor.offsetTop - cursor.offsetHeight / 2;
      paintCamera();
      let targetX = camera.x;
      let targetY = camera.y;
      let line = cursor.offsetTop;
      let previous;
      const frame = now => {
        if (!playing || finished) return;
        const dt = Math.min(.032, previous === undefined ? 1/60 : (now - previous)/1000)*introSpeed;
        previous = now;
        const cursorX = cursor.offsetLeft + cursor.offsetWidth / 2;
        const cursorY = cursor.offsetTop + cursor.offsetHeight / 2;
        const oldZoom = camera.zoom;
        [camera.zoom, camera.vz] = settleAxis(camera.zoom, camera.vz, targetZoom, dt);
        if (Math.abs(camera.zoom-targetZoom)<.00005 && Math.abs(camera.vz)<.001) { camera.zoom=targetZoom; camera.vz=0; }
        // Zoom around the cursor, preserving the current framing while scale changes.
        const dx = cursorX * (oldZoom-camera.zoom);
        const dy = cursorY * (oldZoom-camera.zoom);
        camera.x += dx; targetX += dx;
        camera.y += dy; targetY += dy;
        const localX = cursorX * camera.zoom;
        const localY = cursorY * camera.zoom;
        if (overview) {
          targetX = innerWidth / 2 - track.offsetWidth * camera.zoom / 2;
          targetY = compilePoint.y - compilePoint.height/2 - 32 - track.offsetHeight * camera.zoom;
        } else if (cursor.offsetTop !== line) {
          line = cursor.offsetTop;
          targetX = innerWidth * .3 - localX;
          targetY = innerHeight / 2 - localY;
        } else if (camera.x + localX > innerWidth * .72) {
          targetX = innerWidth * .46 - localX;
        } else if (camera.x + localX < innerWidth * .2) {
          targetX = innerWidth * .3 - localX;
        }
        // Hold the frame while the cursor has room, then reframe with weight.
        [camera.x, camera.vx] = settleAxis(camera.x, camera.vx, targetX, dt);
        [camera.y, camera.vy] = settleAxis(camera.y, camera.vy, targetY, dt);
        if (Math.abs(camera.x-targetX)<.2 && Math.abs(camera.vx)<1) { camera.x=targetX; camera.vx=0; }
        if (Math.abs(camera.y-targetY)<.2 && Math.abs(camera.vy)<1) { camera.y=targetY; camera.vy=0; }
        // A new line can return a long way left. Keep its cursor in frame while settling.
        if (!overview) {
          const safeX = Math.max(innerWidth * .12, Math.min(innerWidth * .88, camera.x + localX));
          if (safeX !== camera.x + localX) { camera.x = safeX - localX; camera.vx = 0; }
          const safeY = Math.max(innerHeight * .15, Math.min(innerHeight * .85, camera.y + localY));
          if (safeY !== camera.y + localY) { camera.y = safeY - localY; camera.vy = 0; }
        }
        paintCamera();
        cameraFrame = requestAnimationFrame(frame);
      };
      cameraFrame = requestAnimationFrame(frame);
    }
    function measure() {
      // Mirror the Welcome cat's inset and anchor replay's expansion on its left edge.
      header.style.setProperty("--header-brand-width", `${header.querySelector(".catalex-mark").getBoundingClientRect().width}px`);
      // Measure the incoming screen in its final coordinate space, not above the viewport.
      if (returning) scene.style.transform = "none";
      const short = innerHeight < 450;
      const compact = innerHeight < 700;
      const stageWidth = Math.min(1200, header.getBoundingClientRect().width);
      const sideBySide = innerWidth >= 700;
      const horizontal = viewMode === "split" && sideBySide;
      const columnWidth = (stageWidth-32)/2;
      const brand = reaction.querySelector(".catalyst-brand");
      formulaFrame.style.top = "0px";
      function formulaLayout(width) {
        const scale = width/reaction.offsetWidth;
        scene.style.setProperty("--formula-scale",scale);
        const above = Math.max(0,reaction.getBoundingClientRect().top-brand.getBoundingClientRect().top);
        return {scale,above,width:reaction.offsetWidth*scale,height:above+reaction.offsetHeight*scale};
      }
      function codeLayout(width,font) {
        Object.assign(codePanel.style,{width:`${width}px`,fontSize:`${font}px`,height:"auto"});
        return {width,font,height:codePanel.offsetHeight};
      }
      const fullFormula = formulaLayout(stageWidth);
      const splitFormula = sideBySide ? formulaLayout(columnWidth) : fullFormula;
      const smallCodeFont = short || innerWidth < 360 ? 12 : innerWidth < 600 ? 14 : null;
      const fullCode = codeLayout(stageWidth,smallCodeFont ?? 20);
      const splitCode = codeLayout(sideBySide ? columnWidth : fullCode.width,smallCodeFont ?? 18);
      const splitGap = short ? 16 : compact ? 20 : 36;
      // Reserve the tallest layout once, so controls and actions stay anchored in every mode.
      const splitHeight = sideBySide ? Math.max(splitCode.height,splitFormula.height) : splitCode.height+splitGap+splitFormula.height;
      const stageHeight = Math.max(fullCode.height,fullFormula.height,splitHeight);
      const selectedFormula = viewMode === "split" ? splitFormula : fullFormula;
      const selectedCode = viewMode === "split" ? splitCode : fullCode;
      const {scale,above,height:formulaHeight} = selectedFormula;
      const {width:codeWidth,height:codeHeight,font:codeFont} = selectedCode;
      scene.style.setProperty("--formula-scale",scale);
      Object.assign(formulaFrame.style,{width:`${selectedFormula.width}px`,height:`${reaction.offsetHeight*scale}px`});
      Object.assign(codePanel.style,{width:`${codeWidth}px`,fontSize:`${codeFont}px`,height:`${codeHeight}px`});
      const controlsGap = short ? 16 : compact ? innerWidth < 360 ? 24 : 28 : 48;
      const actionsGap = short ? 16 : compact ? innerWidth < 360 ? 24 : 32 : 60;
      const descriptionGap = short ? 10 : compact ? 12 : 16;
      const height = viewControls.offsetHeight+controlsGap+stageHeight+actionsGap+description.offsetHeight+descriptionGap+actions.offsetHeight;
      const groupTop = Math.min((innerHeight-height)/2,learnMore.getBoundingClientRect().top-(short ? 12 : 24)-height);
      viewControls.style.top = `${groupTop}px`;
      const stageTop = groupTop+viewControls.offsetHeight+controlsGap;
      const codeLeft = horizontal ? (innerWidth-stageWidth)/2 : (innerWidth-codeWidth)/2;
      Object.assign(codePanel.style,{left:`${codeLeft}px`,top:`${stageTop+(viewMode === "split" && !horizontal ? (stageHeight-splitHeight)/2 : (stageHeight-codeHeight)/2)}px`});
      const formulaX = horizontal ? (innerWidth-stageWidth)/2+columnWidth+32+columnWidth/2 : innerWidth/2;
      const formulaY = viewMode === "split" && !horizontal ? stageTop+(stageHeight-splitHeight)/2+codeHeight+splitGap+above : stageTop+(stageHeight-formulaHeight)/2+above;
      Object.assign(formulaFrame.style,{left:`${formulaX}px`,top:`${formulaY}px`});
      const descriptionTop = stageTop+stageHeight+actionsGap;
      description.style.top = `${descriptionTop}px`;
      scene.style.setProperty("--actions-y", `${descriptionTop+description.offsetHeight+descriptionGap}px`);
      // Compile, cursor landing, and reveal all follow the final Welcome brand position.
      const box = brand.getBoundingClientRect();
      compilePoint = {x:box.left+box.width/2,y:box.top+box.height/2,width:Math.max(112,box.width),height:Math.max(44,box.height+12)};
      Object.assign(compileButton.style,{left:`${compilePoint.x}px`,top:`${compilePoint.y}px`,width:`${compilePoint.width}px`,height:`${compilePoint.height}px`});
      finalZoom = parseFloat(getComputedStyle(reaction.querySelector(".reactant")).fontSize)*scale/parseFloat(getComputedStyle(track).fontSize);
      if (returning) scene.style.removeProperty("transform");
    }
    function changeView(nextMode) {
      if (nextMode === viewMode || root.dataset.intro !== "ready" || entering || finished) return;
      const previousMode = viewMode;
      const elements = [viewControls,formulaFrame,codePanel,description,actions];
      const before = elements.map(element => ({box:element.getBoundingClientRect(),opacity:getComputedStyle(element).opacity}));
      const oldScale = getComputedStyle(reaction).transform;
      const oldCodeFont = getComputedStyle(codePanel).fontSize;
      const oldPadding = getComputedStyle(codePanel).padding;
      const oldBorder = getComputedStyle(codePanel).borderTopWidth;
      const hadCode = getComputedStyle(codePanel).visibility === "visible";
      const hadPreview = getComputedStyle(formulaFrame).visibility === "visible";
      const oldPreviewAbove = Math.max(0,before[1].box.top-reaction.querySelector(".catalyst-brand").getBoundingClientRect().top);
      stopViewMotion();
      const revision = viewRevision;
      viewMode = nextMode;
      measure();
      applyView();
      if (reducedMotion.matches) return;
      const after = elements.map(element=>element.getBoundingClientRect());
      const finalCodeFont = codePanel.style.fontSize;
      const finalPadding = getComputedStyle(codePanel).padding;
      const finalScale = getComputedStyle(reaction).transform;
      const horizontal = innerWidth >= 700;
      const collapsing = box => horizontal
        ? {left:box.right,top:box.top+box.height/2,width:0,height:0}
        : {left:box.left+box.width/2,top:box.bottom,width:0,height:0};
      const paneFrames = elements.map((element,i)=>({from:before[i].box,to:after[i]}));
      if (!hadCode && viewMode === "split") {
        const box = after[2];
        paneFrames[2].from = {left:box.left,top:box.top,width:horizontal ? 0 : box.width,height:horizontal ? box.height : 0};
      } else if (!hadCode) paneFrames[2].from = before[1].box;
      if (viewMode === "preview") {
        const box = before[2].box;
        paneFrames[2].to = previousMode === "split"
          ? {left:box.left,top:box.top,width:horizontal ? 0 : box.width,height:horizontal ? box.height : 0}
          : after[1];
      }
      if (!hadPreview) paneFrames[1].from = viewMode === "split" ? collapsing(after[1]) : after[1];
      if (viewMode === "code" && previousMode === "split") paneFrames[1].to = collapsing(before[1].box);
      // Direct switches keep the same left-source / right-preview relationship as Split.
      // The growing pane pushes the other to a collapsed edge instead of covering it.
      if (previousMode !== "split" && viewMode !== "split") {
        const gap = horizontal ? 32 : innerHeight < 450 ? 16 : innerHeight < 700 ? 20 : 36;
        if (viewMode === "code") {
          if (!hadCode) paneFrames[2].from = horizontal
            ? {left:before[1].box.left-gap,top:after[2].top,width:0,height:after[2].height}
            : {left:after[2].left,top:before[1].box.top-oldPreviewAbove-gap,width:after[2].width,height:0};
          paneFrames[1].to = horizontal
            ? {left:after[2].right+gap,top:after[2].top+after[2].height/2,width:0,height:0}
            : {left:innerWidth/2,top:after[2].bottom+gap,width:0,height:0};
        } else {
          const above = Math.max(0,after[1].top-reaction.querySelector(".catalyst-brand").getBoundingClientRect().top);
          paneFrames[2].to = horizontal
            ? {left:after[1].left-gap,top:before[2].box.top,width:0,height:before[2].box.height}
            : {left:before[2].box.left,top:after[1].top-above-gap,width:before[2].box.width,height:0};
          if (!hadPreview) paneFrames[1].from = horizontal
            ? {left:before[2].box.right+gap,top:after[1].top+after[1].height/2,width:0,height:0}
            : {left:innerWidth/2,top:before[2].box.bottom+gap,width:0,height:0};
        }
      }
      const duration = 460;
      const started = document.timeline.currentTime;
      const morph = (element,frames,timing={}) => {
        const motion = animate(element,frames,{duration,easing:"cubic-bezier(.2,.8,.2,1)",...timing});
        if (started !== null) motion.startTime = started;
        viewMotions.add(motion);
        return motion;
      };
      // Freeze the source line width while its pane opens; do not rewrap each frame.
      const textWidth = viewMode === "preview" ? before[2].box.width : after[2].width;
      const padding = parseFloat(getComputedStyle(codePanel).paddingLeft)*2+2;
      codeText.style.width = `${Math.max(0,textWidth-padding)}px`;
      for (const [index,element] of elements.entries()) {
        const {from,to} = paneFrames[index];
        const centered = element !== codePanel;
        morph(element,[
          {left:`${from.left+(centered ? from.width/2 : 0)}px`,top:`${from.top}px`,width:`${from.width}px`,height:`${from.height}px`},
          {left:`${to.left+(centered ? to.width/2 : 0)}px`,top:`${to.top}px`,width:`${to.width}px`,height:`${to.height}px`},
        ]);
      }
      morph(reaction,[{transform:hadPreview ? oldScale : "scale(.001)"},{transform:viewMode === "code" ? "scale(.001)" : finalScale}]);
      formulaFrame.style.visibility = "";
      morph(formulaFrame,[{opacity:hadPreview ? before[1].opacity : 0},{opacity:viewMode === "code" ? 0 : 1}],{duration:280});
      codePanel.style.visibility = "";
      morph(codePanel,[{fontSize:oldCodeFont},{fontSize:finalCodeFont}]);
      morph(codePanel,[
        {padding:!hadCode ? "0px" : oldPadding,borderWidth:!hadCode ? "0px" : oldBorder},
        {padding:viewMode === "preview" ? "0px" : finalPadding,borderWidth:viewMode === "preview" ? "0px" : "1px"},
      ]);
      morph(codePanel,[{opacity:hadCode ? before[2].opacity : 1},{opacity:viewMode === "preview" ? 0 : 1}]);
      Promise.all([...viewMotions].map(motion=>motion.finished.catch(()=>{}))).then(()=>{
        if (revision !== viewRevision || finished || entering) return;
        for (const motion of viewMotions) motion.cancel();
        viewMotions.clear();
        codeText.style.width = "";
        measure();
        applyView();
      });
    }
    function ready() {
      if (finished || entering) return;
      if (returning && returnStarted) settleReturn();
      playing = false;
      cancelAnimationFrame(cameraFrame);
      cancelCursorFlight();
      stopViewMotion();
      for (const animation of animations) animation.cancel();
      terminal.hidden = true;
      cursor.hidden = true;
      compileButton.hidden = true;
      result.style.clipPath = "none";
      result.removeAttribute("aria-hidden");
      scene.classList.add("is-revealing", "is-ready");
      measure();
      applyView();
      viewControls.inert = false;
      actions.inert = false;
      learnMore.disabled = false;
      root.dataset.intro = "ready";
      header.inert = false;
      replayIntro.inert = false;
      scene.removeAttribute("aria-modal");
      scene.removeAttribute("role");
      if (returning) {
        returnStarted = true;
        root.dataset.intro = "returning";
        header.inert = true;
        settleReturn = () => {
          if (!returning) return;
          returning = false;
          root.classList.remove("welcome-returning");
          for (const motion of returnMotions) motion.cancel();
          scrollTo({top:0,left:0,behavior:"instant"});
          root.dataset.intro = "ready";
          header.inert = false;
          if (returnOptions.focus) header.querySelector(".brand").focus({preventScroll:true});
        };
        if (reducedMotion.matches) return settleReturn();
        const slide = (element, frames, duration = 600) => {
          const motion = animate(element, frames, {duration,easing:"cubic-bezier(.22,.75,.25,1)"});
          returnMotions.push(motion);
          return motion;
        };
        for (const part of pageParts) {
          slide(part, [{transform:"translateY(0)",opacity:1}, {transform:"translateY(100svh)",opacity:0}]);
        }
        slide(header, [
          {borderColor:getComputedStyle(header).getPropertyValue("--border").trim(),boxShadow:getComputedStyle(header).getPropertyValue("--header-shadow").trim()},
          {borderColor:"transparent",boxShadow:"0 8px 24px -8px rgb(0 0 0 / 0)"},
        ]);
        slide(header.querySelector(".catalex-mark > span"), [{opacity:1},{opacity:0}], 240);
        slide(header.querySelector(".brand img"), [{left:"0px"},{left:"calc(100% - 32px)"}]);
        slide(headerActions, [{opacity:1},{opacity:0}], 240);
        slide(replayIntro, [{opacity:0},{opacity:1}]);
        slide(scene, [{transform:"translateY(-100svh)",opacity:0},{transform:"translateY(0)",opacity:1}])
          .finished.then(settleReturn).catch(() => {});
      }
      if (focusActionAfterCompile) actions.querySelector("a").focus({preventScroll:true});
    }
    let compilePress = null;
    let compilePressMotion = null;
    let compileInput = null;
    function pressCompile() {
      if (!playing || finished || compiling || !["compile-ready","compile-pressed"].includes(root.dataset.intro)) return false;
      if (compilePress) return true;
      cancelAnimationFrame(cameraFrame);
      root.dataset.intro = "compile-pressed";
      compileButton.classList.add("is-pressed");
      const ring = cursor.getBoundingClientRect();
      compilePress = {at:performance.now(),ring};
      compilePressMotion = introAnimate(cursor, [
        {left:`${ring.left}px`,top:`${ring.top}px`,width:`${ring.width}px`,height:`${ring.height}px`,borderRadius:"15px"},
        {left:`${ring.left+4}px`,top:`${ring.top+4}px`,width:`${ring.width-8}px`,height:`${ring.height-8}px`,borderRadius:"11px"},
      ], {duration:100,easing:"cubic-bezier(.2,0,.2,1)"});
      return true;
    }
    function cancelCompilePress() {
      if (compiling || !compilePress) return;
      compilePressMotion?.cancel();
      compilePress = null;
      compileInput = null;
      compileButton.classList.remove("is-pressed");
      if (playing && !finished) root.dataset.intro = "compile-ready";
    }
    async function compile() {
      if (!pressCompile()) return;
      compiling = true;
      compileButton.disabled = true;
      // Complete the downstroke and a short hold before releasing an automatic tap.
      // A real pointer/key hold has already spent this time before activation.
      await pause(Math.max(0,180/introSpeed-(performance.now()-compilePress.at)));
      if (!playing || finished) return;
      const ring = compilePress.ring;
      const pressedRing = cursor.getBoundingClientRect();
      compileButton.classList.remove("is-pressed");
      compileInput = null;
      const started = document.timeline.currentTime;
      const transition = (element, frames, timing) => {
        const motion = introAnimate(element, frames, timing);
        if (started !== null) motion.startTime = started;
        return motion;
      };
      // Release starts the handoff directly, without returning to an idle Compile.
      transition(cursor, [
        {left:`${pressedRing.left}px`,top:`${pressedRing.top}px`,width:`${pressedRing.width}px`,height:`${pressedRing.height}px`,borderRadius:"11px"},
        {left:`${ring.left}px`,top:`${ring.top}px`,width:`${ring.width}px`,height:`${ring.height}px`,borderRadius:"15px"},
      ], {duration:140,easing:"cubic-bezier(.2,.8,.2,1)"});
      const x = compilePoint.x;
      const y = compilePoint.y;
      const radius = Math.hypot(Math.max(x,innerWidth-x), Math.max(y,innerHeight-y)) + 2;
      for (const child of reaction.querySelector(".catalyst-brand").children) {
        transition(child, [{opacity:0}, {opacity:1}], {duration:180,easing:"ease-out"});
      }
      transition(compileButton, [{opacity:1}, {opacity:0}], {duration:120,easing:"ease-out"});
      transition(cursor, [{opacity:1}, {opacity:0}], {duration:150,easing:"ease-out"});
      const reveal = transition(result, [
        {clipPath:`circle(${compilePoint.height/2}px at ${x}px ${y}px)`},
        {clipPath:`circle(${radius}px at ${x}px ${y}px)`},
      ], {duration:1250,easing:"cubic-bezier(.22,.35,.25,1)"});
      // Use the very same expanding circle, in header-local coordinates.
      // Navigation is already in place behind the reveal, rather than appearing afterward.
      const headerBox = header.getBoundingClientRect();
      transition(header, [
        {clipPath:`circle(${compilePoint.height/2}px at ${x-headerBox.left}px ${y-headerBox.top}px)`},
        {clipPath:`circle(${radius}px at ${x-headerBox.left}px ${y-headerBox.top}px)`},
      ], {duration:1250,easing:"cubic-bezier(.22,.35,.25,1)"});
      root.dataset.intro = "revealing";
      result.removeAttribute("aria-hidden");
      scene.classList.add("is-revealing");
      await introPause(180);
      if (!playing || finished) return;
      compileButton.hidden = true;
      cursor.hidden = true;
      await reveal.finished.catch(() => {});
      if (playing && !finished) ready();
    }
    compileButton.addEventListener("pointerdown", event=>{
      if (event.button === 0 && pressCompile()) compileInput = "pointer";
    }, options);
    for (const event of ["pointercancel","pointerleave"]) {
      compileButton.addEventListener(event, ()=>{ if (compileInput === "pointer") cancelCompilePress(); }, options);
    }
    compileButton.addEventListener("keydown", event=>{
      if (!["Enter"," "].includes(event.key)) return;
      event.preventDefault();
      if (!event.repeat && pressCompile()) compileInput = event.key;
    }, options);
    compileButton.addEventListener("keyup", event=>{
      if (event.key !== compileInput) return;
      event.preventDefault();
      focusActionAfterCompile = true;
      compile().catch(finish);
    }, options);
    compileButton.addEventListener("blur", cancelCompilePress, options);
    compileButton.addEventListener("click", event=>{
      focusActionAfterCompile = event.isTrusted && event.detail === 0;
      compile().catch(finish);
    }, options);
    async function enter(focusAfter = false) {
      if (root.dataset.intro !== "ready" || entering || finished) return;
      stopViewMotion();
      measure();
      applyView();
      viewControls.inert = true;
      entering = true;
      focusOnEntry = focusAfter;
      const headerCat = header.querySelector(".brand img");
      const headerCatFrom = getComputedStyle(headerCat).left;
      root.dataset.intro = "docking";
      actions.inert = true;
      learnMore.disabled = true;
      const duration = 1050;
      const easing = "cubic-bezier(.65, 0, .2, 1)";
      const wordmark = reaction.querySelector(".catalex-mark > span");
      const wordmarkTarget = header.querySelector(".catalex-mark > span");
      const wordmarkFrom = wordmark.getBoundingClientRect();
      const wordmarkTo = wordmarkTarget.getBoundingClientRect();
      const wordmarkStyle = getComputedStyle(wordmarkTarget);
      const wordmarkVisible = getComputedStyle(formulaFrame).visibility !== "hidden";
      landWordmark = () => {
        wordmark.removeAttribute("class");
        wordmark.removeAttribute("style");
        wordmark.removeAttribute("aria-hidden");
        wordmarkTarget.replaceWith(wordmark);
        landWordmark = () => {};
      };
      // Measure both buttons before moving either, so their flex layout cannot shift.
      const transfers = [...actions.children].map((button, index) => {
        const target = headerActions.children[index];
        const style = getComputedStyle(button);
        const targetStyle = getComputedStyle(target);
        const appearance = s => ({backgroundColor:s.backgroundColor, borderColor:s.borderColor, borderRadius:s.borderRadius, color:s.color});
        return {button, target, from:button.getBoundingClientRect(), to:target.getBoundingClientRect(),
          start:{...appearance(style), borderColor:style.backgroundColor}, end:appearance(targetStyle), font:style.font, gap:style.gap,
          iconSize:button.querySelector("svg").getBoundingClientRect().width,
          targetIconSize:target.querySelector("svg").getBoundingClientRect().width,
          targetFont:targetStyle.font, targetGap:targetStyle.gap};
      });
      landActions = () => {
        for (const {button, target} of transfers) {
          button.className = target.className;
          button.replaceChildren(...target.childNodes);
          button.removeAttribute("style");
          button.removeAttribute("aria-hidden");
          button.inert = false;
          for (const name of ["aria-label", "title"]) {
            if (target.hasAttribute(name)) button.setAttribute(name, target.getAttribute(name));
          }
          target.replaceWith(button);
        }
        landActions = () => {};
      };
      if (reducedMotion.matches) return finish();
      const headerStyle = getComputedStyle(header);
      animate(header, [
        {borderColor:"transparent", boxShadow:"0 8px 24px -8px rgb(0 0 0 / 0)"},
        {borderColor:headerStyle.getPropertyValue("--border").trim(), boxShadow:headerStyle.getPropertyValue("--header-shadow").trim()},
      ], {duration,easing});
      replayIntro.inert = true;
      animate(replayIntro, [{opacity:1}, {opacity:0}], {duration:180,easing:"ease-in"});
      // Slide the cat left within its reserved brand slot while the name joins it.
      // Navigation stays fixed because the brand's layout width never changes.
      animate(headerCat, [{left:headerCatFrom}, {left:"0px"}], {duration,easing});
      // Keep the name's space in the centered formula group so its cat cannot recenter.
      const wordmarkSpace = wordmark.cloneNode(true);
      wordmarkSpace.style.visibility = "hidden";
      wordmarkSpace.setAttribute("aria-hidden", "true");
      wordmark.replaceWith(wordmarkSpace);
      Object.assign(wordmark.style, {font:wordmarkStyle.font, letterSpacing:wordmarkStyle.letterSpacing, color:wordmarkStyle.color});
      wordmark.className = "wordmark-flight";
      wordmark.setAttribute("aria-hidden", "true");
      document.body.append(wordmark);
      const wordmarkMotion = animate(wordmark, [
        {opacity:wordmarkVisible ? 1 : 0, transform:wordmarkVisible
          ? `translate(${wordmarkFrom.left}px, ${wordmarkFrom.top}px) scale(${wordmarkFrom.width/wordmarkTo.width}, ${wordmarkFrom.height/wordmarkTo.height})`
          : `translate(${wordmarkTo.left}px, ${wordmarkTo.top}px)`},
        {opacity:1, transform:`translate(${wordmarkTo.left}px, ${wordmarkTo.top}px) scale(1)`},
      ], {duration,easing});
      const flights = transfers.map(({button,target,from,to,start,end,font,gap,iconSize,targetIconSize,targetFont,targetGap}) => {
        const original = document.createElement("span");
        original.className = "action-flight-content";
        original.style.font = font;
        original.style.gap = gap;
        original.append(...button.childNodes);
        original.querySelector("svg").style.width = `${iconSize}px`;
        original.querySelector("svg").style.height = `${iconSize}px`;
        const destination = document.createElement("span");
        destination.className = "action-flight-content";
        destination.style.font = targetFont;
        destination.style.gap = targetGap;
        destination.append(...[...target.childNodes].map(node => node.cloneNode(true)));
        destination.querySelector("svg").style.width = `${targetIconSize}px`;
        destination.querySelector("svg").style.height = `${targetIconSize}px`;
        button.className = "button action-flight";
        button.inert = true;
        button.setAttribute("aria-hidden", "true");
        button.append(original, destination);
        document.body.append(button);
        animate(original, [{opacity:1}, {opacity:0}], {duration:duration*.15, delay:duration*.1, easing:"ease-in-out"});
        animate(destination, [{opacity:0}, {opacity:1}], {duration:duration*.15, delay:duration*.27, easing:"ease-in-out"});
        return animate(button, [
          {...start, transform:`translate(${from.left}px, ${from.top}px)`, width:`${from.width}px`, height:`${from.height}px`},
          {...end, transform:`translate(${to.left}px, ${to.top}px)`, width:`${to.width}px`, height:`${to.height}px`},
        ], {duration,easing});
      });
      for (const part of pageParts) {
        animate(part, [
          {opacity: 1, transform: "translateY(100svh)"},
          {opacity: 1, transform: "translateY(0)"},
        ], {duration, easing});
      }
      const pageMotion = animate(scene, [
        {transform: "translateY(0)"}, {transform: "translateY(-100%)"},
      ], {duration, easing});
      await Promise.all([pageMotion.finished,wordmarkMotion.finished,...flights.map(motion => motion.finished)]);
      finish();
    }
    function accumulate(delta, focusAfter = false) {
      if (root.dataset.intro !== "ready" || entering || !Number.isFinite(delta)) return;
      scrollAmount = Math.max(0, scrollAmount + delta);
      scene.style.setProperty("--scroll-progress", Math.min(1, scrollAmount / 260));
      if (scrollAmount >= 260) enter(focusAfter).catch(finish);
    }
    learnMore.addEventListener("click", event => enter(event.detail === 0).catch(finish), options);
    replayIntro.addEventListener("click", event => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      finish();
      // Replay in this document without navigating away from Welcome.
      // It remains one-time and does not change the saved first-visit flag.
      const url = new URL(location.href);
      url.searchParams.delete("playIntro");
      url.searchParams.delete("intro");
      history.replaceState({...history.state, catalexIntroReplayed:true}, "", url);
      window.catalexIntroEntry = {play:true, automatic:false};
      window.catalexIntroScrollRestoration = history.scrollRestoration;
      history.scrollRestoration = "manual";
      document.body.prepend(welcomeTemplate.cloneNode(true));
      root.classList.add("intro-pending", "typewriter-pending");
      if (reducedMotion.matches) root.classList.add("welcome-preview");
      setupTypewriterEntrance(reducedMotion).catch(finish);
    }, options);
    header.querySelector(".brand").addEventListener("click", event => {
      // Already on Welcome. Main's normal #top link returns here through the router.
      event.preventDefault();
    }, options);
    const onWelcomeWheel = event => {
      if (event.ctrlKey) return;
      event.preventDefault();
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
      accumulate(event.deltaY * unit);
    };
    scene.addEventListener("wheel", onWelcomeWheel, {...options, passive: false});
    header.addEventListener("wheel", onWelcomeWheel, {...options, passive: false});
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
    addEventListener("resize", () => entering ? finish() : ready(), options);
    reducedMotion.addEventListener("change", () => { if (reducedMotion.matches) entering ? finish() : ready(); }, options);
    addEventListener("pagehide", finish, options);
    addEventListener("hashchange", finish, options);
    const keepAtTop = () => { if (!returning && scrollY > 0) scrollTo({top: 0, left: 0, behavior: "instant"}); };
    addEventListener("scroll", keepAtTop, {...options, passive: true});
    addEventListener("load", keepAtTop, options);

    await document.fonts.ready;
    if (finished) return;
    clearTimeout(window.catalexIntroFallback);
    keepAtTop();
    measure();
    const skipIntro = !entry.play;
    if (skipIntro || reducedMotion.matches || !playing) return ready();
    startCamera();
    root.dataset.intro = "blinking";
    await introAnimate(cursor, blinkFrames, {duration:blinkDuration, iterations:2, easing:"linear"}).finished;
    if (!playing) return;
    root.dataset.intro = "typing";
    for (const token of tokens) {
      const span = highlightedToken(token);
      const text = document.createTextNode("");
      span.append(text);
      sourceText.append(span);
      for (const character of token) {
        if (!playing || finished) return;
        text.appendData(character);
        if (character === "\n") {
          targetZoom = Math.pow(finalZoom, ++zoomLevel / lineCount);
          tempo = Math.pow(1.25, zoomLevel);
          impactAt = performance.now();
          impactStrength = (3.5 + zoomLevel*1.4) * Math.min(1, Math.max(.65, innerWidth/900));
        }
        const duration = character === "\n" ? 600 : character === " " ? 85 : character === "}" ? 70 : character === "\\" ? 60 : 48;
        await introPause(duration / tempo);
      }
    }
    if (!playing) return;
    await introPause(220 / tempo);
    if (!playing) return;
    overview = true;
    targetZoom = finalZoom;
    root.dataset.intro = "settling";
    await introPause(400);
    if (!playing) return;
    camera.zoom = finalZoom;
    tempo = 1;
    impactAt = -Infinity;
    paintCamera();
    cancelAnimationFrame(cameraFrame);
    const from = cursor.getBoundingClientRect();
    const width = compilePoint.width + 16;
    const height = compilePoint.height + 16;
    const left = compilePoint.x - width/2;
    const top = compilePoint.y - height/2;
    for (const animation of cursor.getAnimations()) animation.cancel();
    // Neovide-style smear: leading corners arrive first; the back catches up.
    cursor.classList.add("terminal-cursor-flight");
    Object.assign(cursor.style, {left:"0px", top:"0px", width:`${innerWidth}px`, height:`${innerHeight}px`, borderWidth:"0px", backgroundColor:"transparent"});
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.classList.add("terminal-cursor-smear");
    svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    const shape = document.createElementNS(svg.namespaceURI, "path");
    shape.setAttribute("fill", "#ededed");
    shape.setAttribute("fill-rule", "evenodd");
    svg.append(shape);
    cursor.append(svg);
    scene.append(cursor);
    root.dataset.intro = "cursor-jump";
    compileButton.hidden = false;
    compileButton.style.visibility = "hidden";
    compileButton.disabled = true;
    const start = [[from.left,from.top],[from.right,from.top],[from.right,from.bottom],[from.left,from.bottom]];
    const target = [[left,top],[left+width,top],[left+width,top+height],[left,top+height]];
    const dx = compilePoint.x-from.left-from.width/2;
    const dy = compilePoint.y-from.top-from.height/2;
    const extent = Math.max(1, Math.abs(dx)*width/2+Math.abs(dy)*height/2);
    const rates = target.map(([x,y])=>18+16*(1+((x-compilePoint.x)*dx+(y-compilePoint.y)*dy)/extent));
    function unit(from, to) {
      const length = Math.hypot(to[0]-from[0],to[1]-from[1]) || 1;
      return [(to[0]-from[0])/length,(to[1]-from[1])/length];
    }
    function roundedPolygon(points, radius) {
      return points.map((point,i)=>{
        const previous=points[(i+3)%4], next=points[(i+1)%4];
        const r=Math.min(radius,Math.hypot(point[0]-previous[0],point[1]-previous[1])/2,Math.hypot(point[0]-next[0],point[1]-next[1])/2);
        const incoming=unit(point,previous), outgoing=unit(point,next);
        return `${i ? "L" : "M"}${point[0]+incoming[0]*r} ${point[1]+incoming[1]*r} Q${point[0]} ${point[1]} ${point[0]+outgoing[0]*r} ${point[1]+outgoing[1]*r}`;
      }).join(" ")+" Z";
    }
    await new Promise(resolve=>{
      let frame=0;
      const began=performance.now();
      cancelCursorFlight=()=>{ cancelAnimationFrame(frame); resolve(); };
      const draw=now=>{
        if (!playing || finished) return cancelCursorFlight();
        const elapsed=Math.max(0,(now-began)/1000)*introSpeed;
        const points=target.map((end,i)=>{
          const step=rates[i]*elapsed;
          const progress=1-(1+step)*Math.exp(-step);
          return end.map((value,axis)=>start[i][axis]+(value-start[i][axis])*progress);
        });
        const opening=Math.min(1,Math.max(0,(elapsed-.12)/.2));
        const hollow=opening*opening*(3-2*opening);
        if (hollow>.9) compileButton.style.visibility = "visible";
        const shade=Math.round(237+18*Math.min(1,elapsed/.35));
        shape.setAttribute("fill", `rgb(${shade},${shade},${shade})`);
        const center=[0,1].map(axis=>points.reduce((sum,point)=>sum+point[axis],0)/4);
        const inner=points.map((point,i)=>{
          const a=unit(point,points[(i+3)%4]),b=unit(point,points[(i+1)%4]);
          return point.map((value,axis)=>center[axis]+(value+2*(a[axis]+b[axis])-center[axis])*hollow);
        });
        const radius=15*Math.min(1,elapsed/.35);
        shape.setAttribute("d", roundedPolygon(points,radius)+" "+roundedPolygon(inner,Math.max(0,radius-2)*hollow));
        if (elapsed>=.54) { cancelCursorFlight=()=>{}; resolve(); }
        else frame=requestAnimationFrame(draw);
      };
      draw(began);
    });
    if (!playing || finished) return;
    svg.remove();
    Object.assign(cursor.style, {left:`${left}px`, top:`${top}px`, width:`${width}px`, height:`${height}px`, borderWidth:"", borderRadius:"15px", backgroundColor:"transparent"});
    root.dataset.intro = "compile-ready";
    compileButton.disabled = false;
    compileButton.focus({preventScroll:true});
    compileButton.classList.add("is-focused");
    await introPause(600);
    if (playing && !finished && !compiling && root.dataset.intro === "compile-ready") compileButton.click();
  } catch {
    // Interrupted motion is expected when the viewport or motion preference changes.
    // A failed asset or initialization always reveals the usable main site.
    if (playing || entering) finish();
  }
}
