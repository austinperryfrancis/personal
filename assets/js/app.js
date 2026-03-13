import { BookStage } from "./book-stage.js";
import { renderShelfButtons, collectTemplates, populateBookView, syncTriggerState, trapFocus } from "./content.js";
import { sectionMap, sections } from "./sections.js";
import { easeDock, easeStandard } from "./utils.js";

let THREE = null;

try {
  THREE = await import("three");
} catch (error) {
  console.warn("Three.js could not be loaded. Falling back to the static content transition.", error);
}

const siteShell = document.querySelector(".site-shell");
const bookView = document.getElementById("book-view");
const bookshelf = document.querySelector(".bookshelf");

if (!siteShell || !bookView || !bookshelf) {
  console.warn("Required site elements are missing. Interactive bookshelf setup was skipped.");
} else {
  const closeButton = bookView.querySelector(".book-view__close");
  const existingShelfStageHost = document.getElementById("site-stage");
  const stageHost = existingShelfStageHost || document.createElement("div");
  const contentPanel = document.getElementById("book-content");
  const viewIndex = document.getElementById("book-view-index");
  const viewKicker = document.getElementById("book-view-kicker");
  const viewTitle = document.getElementById("book-view-title");
  const viewSubtitle = document.getElementById("book-view-subtitle");
  const viewSignature = document.getElementById("book-view-signature");
  const leftSlot = bookView.querySelector('[data-slot="left"]');
  const rightSlot = bookView.querySelector('[data-slot="right"]');
  const siteTitle = document.getElementById("site-title")?.textContent?.trim() || "Austin Francis";

  if (!existingShelfStageHost) {
    stageHost.id = "site-stage";
    stageHost.className = "site-stage bookshelf__stage";
    stageHost.setAttribute("aria-hidden", "true");
    bookshelf.prepend(stageHost);
  } else if (stageHost.parentElement !== bookshelf) {
    bookshelf.prepend(stageHost);
  }

  const bookButtons = renderShelfButtons(bookshelf, sections);
  const templates = collectTemplates(document);
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopMotionQuery = window.matchMedia("(min-width: 861px)");
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(() => {
      syncStage();
    })
    : null;

  let activeSection = null;
  let lastTrigger = null;
  let isClosing = false;
  let motionToken = 0;
  let bookStage = null;
  let stageClipProgress = 0;
  let latestShelfClip = null;
  let stageSyncFrame = 0;

  const OPEN_EXTRACT_DURATION = 340;
  const OPEN_CARRY_DURATION = 300;
  const OPEN_TURN_DURATION = 520;
  const OPEN_FRONT_HOLD_DURATION = 150;
  const OPEN_COVER_DURATION = 860;
  const OPEN_READING_DURATION = 250;
  const CLOSE_EXTRACT_DURATION = 340;
  const CLOSE_CARRY_DURATION = 300;
  const CLOSE_COVER_DURATION = 560;
  const CLOSE_RETURN_DURATION = 720;
  const CLOSE_RESET_DURATION = 240;

  if (THREE && stageHost) {
    bookStage = new BookStage(stageHost, THREE, bookButtons, sectionMap, siteTitle);
    document.body.classList.add("has-shelf-stage");
  }

  syncStage();
  setStageClipProgress(0);
  resizeObserver?.observe(bookshelf);

  window.addEventListener("resize", () => {
    syncStage();
  });
  window.addEventListener("scroll", scheduleStageSync, { passive: true });

  bookButtons.forEach((button) => {
    button.addEventListener("click", () => openSection(button.dataset.section, button));
  });

  bookView.querySelectorAll("[data-close]").forEach((element) => {
    element.addEventListener("click", closeSection);
  });

  document.addEventListener("keydown", (event) => {
    if (!activeSection) {
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      closeSection();
      return;
    }

    if (event.key === "Tab") {
      trapFocus(bookView, event);
    }
  });

  function openSection(sectionId, trigger) {
    const template = templates.get(sectionId);
    const section = sectionMap.get(sectionId);

    if (!template || !section || isClosing || activeSection === sectionId) {
      return;
    }

    const token = ++motionToken;
    activeSection = sectionId;
    lastTrigger = trigger;

    populateBookView({
      template,
      section,
      elements: {
        contentPanel,
        leftSlot,
        rightSlot,
        viewIndex,
        viewKicker,
        viewSignature,
        viewSubtitle,
        viewTitle,
      },
      siteTitle,
      bookStage,
    });
    syncTriggerState(bookButtons, trigger);

    if ("inert" in siteShell) {
      siteShell.inert = true;
    }

    syncStage();
    setStageClipProgress(0);
    siteShell.setAttribute("aria-hidden", "true");
    document.body.classList.add("view-open");
    bookView.hidden = false;
    bookView.setAttribute("aria-hidden", "false");
    bookView.classList.remove("is-content-visible", "is-open", "is-simple");
    bookView.classList.add("is-visible");
    setContentProgress(0);

    if (shouldSimplifyMotion()) {
      setShelfVacancy(sectionId);
      bookView.classList.add("is-simple", "is-content-visible", "is-open");
      setContentProgress(1);
      closeButton?.focus();
      return;
    }

    runOpenSequence(sectionId, token);
  }

  async function closeSection() {
    if (!activeSection || isClosing) {
      return;
    }

    const token = ++motionToken;
    const sectionId = activeSection;
    const trigger = lastTrigger;
    const use3d = shouldUse3D();

    isClosing = true;
    activeSection = null;

    bookButtons.forEach((button) => {
      button.classList.remove("book--active");
      button.setAttribute("aria-expanded", "false");
    });

    if (use3d && trigger && bookStage) {
      bookStage.resize();
      const shelfPose = bookStage.getShelfPose(sectionId) || bookStage.createShelfPose(trigger.getBoundingClientRect());
      const extractPose = bookStage.createExtractPose(shelfPose);
      const carryPose = bookStage.createCarryPose(shelfPose);
      const turnPose = bookStage.createTurnPose(shelfPose);
      const frontPose = bookStage.createFrontPose(shelfPose);
      const openPose = bookStage.createOpenPose(shelfPose);

      if (!isCloseTokenCurrent(token)) {
        return;
      }

      bookView.classList.remove("is-content-visible", "is-open");
      await bookStage.animateTimeline(
        [
          { pose: openPose, duration: CLOSE_RESET_DURATION, easing: easeStandard },
          { pose: frontPose, duration: CLOSE_COVER_DURATION, easing: easeStandard },
          { pose: turnPose, duration: CLOSE_COVER_DURATION * 0.95, easing: easeStandard },
          { pose: carryPose, duration: CLOSE_CARRY_DURATION, easing: easeStandard },
          { pose: extractPose, duration: CLOSE_EXTRACT_DURATION, easing: easeStandard },
          { pose: shelfPose, duration: CLOSE_RETURN_DURATION, easing: easeDock },
        ],
        token,
        motionTokenRef,
        ({ progress }) => {
          setStageClipProgress(1 - easeOutCubic(mapRange(progress, 0.78, 1)));
          setContentProgress(1 - mapRange(progress, 0, 0.2));
        },
      );

      if (!isCloseTokenCurrent(token)) {
        return;
      }
    } else {
      bookView.classList.remove("is-content-visible", "is-open", "is-simple");
      setContentProgress(0);
    }

    teardownOverlay(trigger);
  }

  async function runOpenSequence(sectionId, token) {
    if (!bookStage) {
      bookView.classList.add("is-simple", "is-content-visible", "is-open");
      setContentProgress(1);
      closeButton?.focus();
      return;
    }

    await (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
    syncStage();
    bookStage.resize();
    bookStage.setActiveSection(sectionId);
    bookStage.setReadingMode(false);
    const shelfPose = bookStage.getShelfPose(sectionId) || bookStage.createShelfPose();
    const extractPose = bookStage.createExtractPose(shelfPose);
    const carryPose = bookStage.createCarryPose(shelfPose);
    const turnPose = bookStage.createTurnPose(shelfPose);
    const frontPose = bookStage.createFrontPose(shelfPose);
    const openPose = bookStage.createOpenPose(shelfPose);
    const readingPose = bookStage.createReadingPose(shelfPose);
    bookStage.setPose(shelfPose);
    setContentProgress(0);
    setStageClipProgress(0);
    await waitForPaint();

    if (!isMotionCurrent(token, sectionId)) {
      bookStage.clearActiveSection();
      return;
    }

    await bookStage.animateTimeline(
      [
        { pose: extractPose, duration: OPEN_EXTRACT_DURATION, easing: easeStandard },
        { pose: carryPose, duration: OPEN_CARRY_DURATION, easing: easeStandard },
        { pose: turnPose, duration: OPEN_TURN_DURATION, easing: easeStandard },
        { pose: frontPose, duration: OPEN_FRONT_HOLD_DURATION, easing: easeStandard },
        { pose: openPose, duration: OPEN_COVER_DURATION, easing: easeStandard },
        { pose: readingPose, duration: OPEN_READING_DURATION, easing: easeStandard },
      ],
      token,
      motionTokenRef,
      ({ progress }) => {
        setStageClipProgress(easeOutCubic(mapRange(progress, 0, 0.22)));
        setContentProgress(mapRange(progress, 0.52, 0.88));
      },
    );

    if (!isMotionCurrent(token, sectionId)) {
      return;
    }

    setContentProgress(1);
    bookView.classList.add("is-content-visible", "is-open");
    closeButton?.focus();
  }

  function motionTokenRef() {
    return motionToken;
  }

  function teardownOverlay(trigger) {
    bookStage?.clearActiveSection();
    setStageClipProgress(0);
    bookView.classList.remove("is-content-visible", "is-open", "is-simple", "is-visible");
    bookView.setAttribute("aria-hidden", "true");

    if ("inert" in siteShell) {
      siteShell.inert = false;
    }

    document.body.classList.remove("view-open");
    siteShell.removeAttribute("aria-hidden");
    syncStage();
    bookView.hidden = true;
    setContentProgress(0);
    leftSlot.replaceChildren();
    rightSlot.replaceChildren();
    isClosing = false;
    setShelfVacancy(null);

    if (trigger) {
      trigger.focus();
    }
  }

  function setShelfVacancy(sectionId) {
    bookStage?.setVacant(sectionId);
    bookButtons.forEach((button) => {
      button.classList.toggle("book--vacant", button.dataset.section === sectionId);
    });
  }

  function shouldSimplifyMotion() {
    return !shouldUse3D() || reducedMotionQuery.matches || !desktopMotionQuery.matches;
  }

  function shouldUse3D() {
    return Boolean(bookStage?.isReady);
  }

  function setContentProgress(progress) {
    const clamped = Math.max(0, Math.min(progress, 1));
    bookView.style.setProperty("--content-progress", clamped.toFixed(4));
    bookView.style.setProperty("--topline-progress", Math.min(clamped * 1.08, 1).toFixed(4));
  }

  function syncStageClip() {
    const rect = bookshelf.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const borderRadius = window.getComputedStyle(bookshelf).borderTopLeftRadius || "18px";
    const parsedRadius = Number.parseFloat(borderRadius);

    latestShelfClip = {
      top: Math.max(0, rect.top),
      right: Math.max(0, viewportWidth - rect.right),
      bottom: Math.max(0, viewportHeight - rect.bottom),
      left: Math.max(0, rect.left),
      radius: Number.isFinite(parsedRadius) ? parsedRadius : 18,
    };
    applyStageClip();
  }

  function setStageClipProgress(progress) {
    stageClipProgress = Math.max(0, Math.min(progress, 1));
    applyStageClip();
  }

  function applyStageClip() {
    if (!stageHost || !latestShelfClip) {
      return;
    }

    const progress = stageClipProgress;
    const top = latestShelfClip.top * (1 - progress);
    const right = latestShelfClip.right * (1 - progress);
    const bottom = latestShelfClip.bottom * (1 - progress);
    const left = latestShelfClip.left * (1 - progress);
    const radius = latestShelfClip.radius * (1 - progress);

    stageHost.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px round ${radius}px)`;
  }

  function syncStage() {
    bookStage?.resize();
    syncStageClip();
  }

  function scheduleStageSync() {
    if (stageSyncFrame) {
      return;
    }

    stageSyncFrame = window.requestAnimationFrame(() => {
      stageSyncFrame = 0;
      syncStage();
    });
  }

  function mapRange(value, start, end) {
    if (value <= start) {
      return 0;
    }

    if (value >= end) {
      return 1;
    }

    return (value - start) / (end - start);
  }

  function easeOutCubic(value) {
    const clamped = Math.max(0, Math.min(value, 1));
    return 1 - ((1 - clamped) ** 3);
  }

  function waitForPaint() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(resolve);
      });
    });
  }

  function isMotionCurrent(token, sectionId) {
    return motionToken === token && activeSection === sectionId && !isClosing;
  }

  function isCloseTokenCurrent(token) {
    return motionToken === token && isClosing;
  }
}
