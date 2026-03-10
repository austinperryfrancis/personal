import { BookStage } from "./book-stage.js";
import { renderShelfButtons, collectTemplates, populateBookView, syncTriggerState, trapFocus } from "./content.js";
import { sectionMap, sections } from "./sections.js";
import { ShelfStage } from "./shelf-stage.js";
import { easeDock, easeStandard, wait } from "./utils.js";

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
  const shelfStageHost = document.getElementById("shelf-stage");
  const stageHost = document.getElementById("book-stage");
  const contentPanel = document.getElementById("book-content");
  const viewIndex = document.getElementById("book-view-index");
  const viewKicker = document.getElementById("book-view-kicker");
  const viewTitle = document.getElementById("book-view-title");
  const viewSubtitle = document.getElementById("book-view-subtitle");
  const viewSignature = document.getElementById("book-view-signature");
  const leftSlot = bookView.querySelector('[data-slot="left"]');
  const rightSlot = bookView.querySelector('[data-slot="right"]');
  const siteTitle = document.getElementById("site-title")?.textContent?.trim() || "Austin Francis";

  const bookButtons = renderShelfButtons(bookshelf, sections);
  const templates = collectTemplates(document);
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const desktopMotionQuery = window.matchMedia("(min-width: 861px)");

  let activeSection = null;
  let lastTrigger = null;
  let hideTimer = 0;
  let isClosing = false;
  let motionToken = 0;
  let bookStage = null;
  let shelfStage = null;

  const OPEN_FLOAT_DURATION = 690;
  const OPEN_TURN_DURATION = 660;
  const OPEN_COVER_DURATION = 860;
  const CLOSE_COVER_DURATION = 620;
  const CLOSE_RETURN_DURATION = 760;

  if (THREE && stageHost) {
    bookStage = new BookStage(stageHost, THREE);
  }

  if (THREE && shelfStageHost) {
    shelfStage = new ShelfStage(shelfStageHost, THREE, bookButtons, sectionMap, siteTitle);
    document.body.classList.add("has-shelf-stage");
  }

  window.addEventListener("resize", () => {
    shelfStage?.resize();

    if (bookStage && !bookView.hidden) {
      bookStage.resize();
    }
  });

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

    siteShell.setAttribute("aria-hidden", "true");
    document.body.classList.add("view-open");
    bookView.hidden = false;
    bookView.setAttribute("aria-hidden", "false");
    bookView.classList.remove("is-content-visible", "is-simple");
    bookView.classList.add("is-visible");

    if (shouldSimplifyMotion()) {
      setShelfVacancy(sectionId);
      bookView.classList.add("is-simple", "is-content-visible");
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

    if (use3d && trigger && bookStage) {
      const triggerRect = trigger.getBoundingClientRect();
      const shelfPose = bookStage.createShelfPose(triggerRect);
      const spinePose = bookStage.createSpinePose(shelfPose);
      const frontPose = bookStage.createFrontPose();
      const openPose = bookStage.createOpenPose();

      bookView.classList.remove("is-content-visible");
      await wait(40);

      if (!isCloseTokenCurrent(token)) {
        return;
      }

      await bookStage.animateTo(openPose, 260, easeStandard, token, motionTokenRef);

      if (!isCloseTokenCurrent(token)) {
        return;
      }

      await bookStage.animateTo(frontPose, CLOSE_COVER_DURATION, easeStandard, token, motionTokenRef);

      if (!isCloseTokenCurrent(token)) {
        return;
      }

      await bookStage.animateTo(spinePose, CLOSE_COVER_DURATION * 0.9, easeStandard, token, motionTokenRef);

      if (!isCloseTokenCurrent(token)) {
        return;
      }

      await bookStage.animateTo(shelfPose, CLOSE_RETURN_DURATION, easeDock, token, motionTokenRef);

      if (!isCloseTokenCurrent(token)) {
        return;
      }
    } else {
      bookView.classList.remove("is-content-visible", "is-simple");
    }

    teardownOverlay(trigger);
  }

  async function runOpenSequence(sectionId, triggerRect, token) {
    if (!bookStage) {
      bookView.classList.add("is-simple", "is-content-visible");
      closeButton?.focus();
      return;
    }

    await (document.fonts?.ready ?? Promise.resolve()).catch(() => undefined);
    bookStage.resize();
    bookStage.setReadingMode(false);
    const shelfPose = bookStage.createShelfPose(triggerRect);
    const floatPose = bookStage.createFloatPose(shelfPose);
    const frontPose = bookStage.createFrontPose();
    const openPose = bookStage.createOpenPose();

    bookStage.setPose(shelfPose);
    setShelfVacancy(sectionId);

    await bookStage.animateTo(floatPose, OPEN_FLOAT_DURATION, easeStandard, token, motionTokenRef);

    if (!isMotionCurrent(token, sectionId)) {
      return;
    }

    await bookStage.animateTo(frontPose, OPEN_TURN_DURATION, easeStandard, token, motionTokenRef);

    if (!isMotionCurrent(token, sectionId)) {
      return;
    }

    await wait(80);

    if (!isMotionCurrent(token, sectionId)) {
      return;
    }

    await bookStage.animateTo(openPose, OPEN_COVER_DURATION, easeStandard, token, motionTokenRef);

    if (!isMotionCurrent(token, sectionId)) {
      return;
    }

    bookView.classList.add("is-content-visible");
    await bookStage.animateTo(bookStage.createReadingPose(), 260, easeStandard, token, motionTokenRef);

    if (isMotionCurrent(token, sectionId)) {
      bookView.classList.add("is-content-visible");
      closeButton?.focus();
    }
  }

  function motionTokenRef() {
    return motionToken;
  }

  function teardownOverlay(trigger) {
    bookView.classList.remove("is-content-visible", "is-simple", "is-visible");
    bookView.setAttribute("aria-hidden", "true");

    if ("inert" in siteShell) {
      siteShell.inert = false;
    }

    document.body.classList.remove("view-open");
    siteShell.removeAttribute("aria-hidden");

    hideTimer = window.setTimeout(() => {
      bookView.hidden = true;
      leftSlot.replaceChildren();
      rightSlot.replaceChildren();
      isClosing = false;
      setShelfVacancy(null);

      if (trigger) {
        trigger.focus();
      }
    }, 40);
  }

  function setShelfVacancy(sectionId) {
    bookButtons.forEach((button) => {
      button.classList.toggle("book--vacant", button.dataset.section === sectionId);
    });

    shelfStage?.setVacant(sectionId);
  }

  function shouldSimplifyMotion() {
    return !shouldUse3D() || reducedMotionQuery.matches || !desktopMotionQuery.matches;
  }

  function shouldUse3D() {
    return Boolean(bookStage && bookStage.isReady);
  }

  function isMotionCurrent(token, sectionId) {
    return motionToken === token && activeSection === sectionId && !isClosing;
  }

  function isCloseTokenCurrent(token) {
    return motionToken === token && isClosing;
  }
}
