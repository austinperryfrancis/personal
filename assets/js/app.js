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
  const shelfStageHost = document.getElementById("site-stage");
  const bookStageFrame = bookView.querySelector(".book-stage");
  const contentPanel = document.getElementById("book-content");
  const viewIndex = document.getElementById("book-view-index");
  const viewKicker = document.getElementById("book-view-kicker");
  const viewTitle = document.getElementById("book-view-title");
  const viewSubtitle = document.getElementById("book-view-subtitle");
  const viewSignature = document.getElementById("book-view-signature");
  const leftSlot = bookView.querySelector('[data-slot="left"]');
  const rightSlot = bookView.querySelector('[data-slot="right"]');
  const siteTitle = document.getElementById("site-title")?.textContent?.trim() || "Austin Francis";
  const overlayStageHost = bookStageFrame ? document.createElement("div") : null;

  const bookButtons = renderShelfButtons(bookshelf, sections);
  const templates = collectTemplates(document);
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopMotionQuery = window.matchMedia("(min-width: 861px)");

  let activeSection = null;
  let lastTrigger = null;
  let hideTimer = 0;
  let isClosing = false;
  let motionToken = 0;
  let shelfStage = null;
  let bookStage = null;
  let stageSyncFrame = 0;

  const OPEN_EXTRACT_DURATION = 340;
  const OPEN_CARRY_DURATION = 300;
  const OPEN_FLOAT_DURATION = 560;
  const OPEN_TURN_DURATION = 520;
  const OPEN_FRONT_HOLD_DURATION = 150;
  const OPEN_COVER_DURATION = 860;
  const OPEN_READING_DURATION = 250;
  const CLOSE_EXTRACT_DURATION = 340;
  const CLOSE_CARRY_DURATION = 300;
  const CLOSE_COVER_DURATION = 560;
  const CLOSE_RETURN_DURATION = 720;
  const CLOSE_RESET_DURATION = 240;

  if (overlayStageHost) {
    overlayStageHost.className = "book-stage__viewport";
    bookStageFrame.replaceChildren(overlayStageHost);
  }

  if (THREE && shelfStageHost && overlayStageHost) {
    shelfStage = new BookStage(shelfStageHost, THREE, bookButtons, sectionMap, siteTitle);
    bookStage = new BookStage(
      overlayStageHost,
      THREE,
      bookButtons,
      sectionMap,
      siteTitle,
      { mode: "overlay" },
    );
    document.body.classList.add("has-shelf-stage");
  }

  syncStageClip();

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

    clearTimeout(hideTimer);

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

    syncStageClip();
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

    runOpenSequence(sectionId, trigger.getBoundingClientRect(), token);
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

    if (use3d && trigger && shelfStage && bookStage) {
      shelfStage.syncLayout();
      bookStage.resize();
      syncOverlayShelfPoses();
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
          setContentProgress(1 - mapRange(progress, 0, 0.2));
        },
      );

      if (!isCloseTokenCurrent(token)) {
        return;
      }

      await waitForPaint();

      if (!isCloseTokenCurrent(token)) {
        return;
      }
    } else {
      bookView.classList.remove("is-content-visible", "is-open", "is-simple");
      setContentProgress(0);
    }

    teardownOverlay(trigger);
  }

  async function runOpenSequence(sectionId, triggerRect, token) {
    if (!shelfStage || !bookStage) {
      bookView.classList.add("is-simple", "is-content-visible", "is-open");
      setContentProgress(1);
      closeButton?.focus();
      return;
    }

    await (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
    shelfStage.syncLayout();
    bookStage.resize();
    syncOverlayShelfPoses();
    bookStage.setActiveSection(sectionId);
    bookStage.setReadingMode(false);
    const shelfPose = bookStage.getShelfPose(sectionId) || bookStage.createShelfPose(triggerRect);
    const extractPose = bookStage.createExtractPose(shelfPose);
    const carryPose = bookStage.createCarryPose(shelfPose);
    const turnPose = bookStage.createTurnPose(shelfPose);
    const frontPose = bookStage.createFrontPose(shelfPose);
    const openPose = bookStage.createOpenPose(shelfPose);
    const readingPose = bookStage.createReadingPose(shelfPose);

    bookStage.setPose(shelfPose);
    setShelfVacancy(sectionId);
    setContentProgress(0);
    await waitForPaint();

    if (!isMotionCurrent(token, sectionId)) {
      return;
    }

    await bookStage.animateTimeline(
      [
        { pose: extractPose, duration: OPEN_EXTRACT_DURATION, easing: easeStandard },
        { pose: carryPose, duration: OPEN_CARRY_DURATION, easing: easeStandard },
        { pose: turnPose, duration: OPEN_TURN_DURATION, easing: easeStandard },
        { pose: frontPose, duration: OPEN_FLOAT_DURATION, easing: easeStandard },
        { pose: frontPose, duration: OPEN_FRONT_HOLD_DURATION, easing: easeStandard },
        { pose: openPose, duration: OPEN_COVER_DURATION, easing: easeStandard },
        { pose: readingPose, duration: OPEN_READING_DURATION, easing: easeStandard },
      ],
      token,
      motionTokenRef,
      ({ progress }) => {
        setContentProgress(mapRange(progress, 0.6, 0.9));
      },
    );

    if (isMotionCurrent(token, sectionId)) {
      setContentProgress(1);
      bookView.classList.add("is-content-visible", "is-open");
      closeButton?.focus();
    }
  }

  function motionTokenRef() {
    return motionToken;
  }

  function teardownOverlay(trigger) {
    bookStage?.clearActiveSection();
    bookView.classList.remove("is-content-visible", "is-open", "is-simple", "is-visible");
    bookView.setAttribute("aria-hidden", "true");

    if ("inert" in siteShell) {
      siteShell.inert = false;
    }

    document.body.classList.remove("view-open");
    siteShell.removeAttribute("aria-hidden");
    syncStageClip();
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
    shelfStage?.setVacant(sectionId);
    bookButtons.forEach((button) => {
      button.classList.toggle("book--vacant", button.dataset.section === sectionId);
    });
  }

  function shouldSimplifyMotion() {
    return !shouldUse3D() || reducedMotionQuery.matches || !desktopMotionQuery.matches;
  }

  function shouldUse3D() {
    return Boolean(shelfStage?.isReady && bookStage?.isReady);
  }

  function setContentProgress(progress) {
    const clamped = Math.max(0, Math.min(progress, 1));
    bookView.style.setProperty("--content-progress", clamped.toFixed(4));
    bookView.style.setProperty("--topline-progress", Math.min(clamped * 1.08, 1).toFixed(4));
  }

  function syncOverlayShelfPoses() {
    if (!shelfStage || !bookStage || bookView.hidden) {
      return;
    }

    sections.forEach((section) => {
      const pose = shelfStage.getShelfPose(section.id);

      if (pose) {
        bookStage.setShelfPose(section.id, pose);
      }
    });

    bookStage.setShelfOrder(shelfStage.getShelfOrder());
  }

  function syncStageClip() {
    if (!shelfStageHost) {
      return;
    }

    const rect = bookshelf.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const borderRadius = window.getComputedStyle(bookshelf).borderTopLeftRadius || "18px";

    shelfStageHost.style.setProperty("--shelf-clip-top", `${Math.max(0, rect.top)}px`);
    shelfStageHost.style.setProperty("--shelf-clip-right", `${Math.max(0, viewportWidth - rect.right)}px`);
    shelfStageHost.style.setProperty("--shelf-clip-bottom", `${Math.max(0, viewportHeight - rect.bottom)}px`);
    shelfStageHost.style.setProperty("--shelf-clip-left", `${Math.max(0, rect.left)}px`);
    shelfStageHost.style.setProperty("--shelf-clip-radius", borderRadius);
  }

  function syncStage() {
    shelfStage?.syncLayout();

    if (!bookView.hidden) {
      bookStage?.resize();
      syncOverlayShelfPoses();
    }

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
