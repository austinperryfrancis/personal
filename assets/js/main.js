let THREE = null;

try {
  THREE = await import("three");
} catch (error) {
  console.warn("Three.js could not be loaded. Falling back to the static content transition.", error);
}

const siteShell = document.querySelector(".site-shell");
const bookView = document.getElementById("book-view");
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
const bookButtons = Array.from(document.querySelectorAll(".book[data-section]"));
const templates = new Map(
  Array.from(document.querySelectorAll("template[data-section]")).map((template) => [
    template.dataset.section,
    template,
  ]),
);

const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
const desktopMotionQuery = window.matchMedia("(min-width: 861px)");
const siteTitle = document.getElementById("site-title")?.textContent?.trim() || "Austin Francis";

const tonePalettes = {
  "tone-navy": {
    base: "#253650",
    mid: "#3e5776",
    dark: "#162133",
    title: "#f2e7d2",
    rule: "rgba(239, 223, 192, 0.72)",
    page: "#f2eadb",
  },
  "tone-oxblood": {
    base: "#5a232b",
    mid: "#8e525a",
    dark: "#321116",
    title: "#f1e1d6",
    rule: "rgba(231, 199, 183, 0.68)",
    page: "#f1e6da",
  },
  "tone-green": {
    base: "#314336",
    mid: "#5f725d",
    dark: "#1f2b22",
    title: "#efe6cf",
    rule: "rgba(227, 216, 182, 0.66)",
    page: "#efe8da",
  },
  "tone-brown": {
    base: "#5d402a",
    mid: "#8b6848",
    dark: "#372315",
    title: "#f2e4cf",
    rule: "rgba(232, 205, 170, 0.7)",
    page: "#f3eadb",
  },
  "tone-sand": {
    base: "#8f734f",
    mid: "#b79b73",
    dark: "#684d31",
    title: "#221a14",
    rule: "rgba(90, 69, 45, 0.28)",
    page: "#f5eddc",
  },
  "tone-charcoal": {
    base: "#363636",
    mid: "#5d5a58",
    dark: "#1e1e1f",
    title: "#f1ebdf",
    rule: "rgba(221, 214, 201, 0.56)",
    page: "#f0e8db",
  },
};

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
const SHELF_ROTATION = {
  rx: 0.012,
  ry: 1.556,
  rz: 0,
};
const SHELF_SCALE_FACTOR = 0.96;

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
    trapFocus(event);
  }
});

function openSection(sectionId, trigger) {
  const template = templates.get(sectionId);

  if (!template || isClosing || activeSection === sectionId) {
    return;
  }

  clearTimeout(hideTimer);

  const token = ++motionToken;
  activeSection = sectionId;
  lastTrigger = trigger;

  populateBookView(template, trigger);
  syncTriggerState(trigger);

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
    closeButton.focus();
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
    await wait(40, token);

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
    closeButton.focus();
    return;
  }

  await document.fonts.ready.catch(() => undefined);
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

  await wait(80, token);

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
    closeButton.focus();
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

function populateBookView(template, trigger) {
  const fragment = template.content.cloneNode(true);
  const leftPage = fragment.querySelector('[data-page="left"]');
  const rightPage = fragment.querySelector('[data-page="right"]');
  const toneClass = Array.from(trigger.classList).find((className) => className.startsWith("tone-")) || "tone-charcoal";

  viewIndex.textContent = template.dataset.index || "Section";
  viewKicker.textContent = template.dataset.kicker || "Section";
  viewTitle.textContent = template.dataset.title || trigger.querySelector(".book__title")?.textContent?.trim() || "";
  viewSubtitle.textContent = template.dataset.subtitle || "";
  viewSignature.textContent = siteTitle;

  const pageHeader = [
    '<header class="spread__page-header">',
    `  <p class="spread__page-kicker">${escapeHtml(viewKicker.textContent)}</p>`,
    `  <h2 class="spread__page-title">${escapeHtml(viewTitle.textContent)}</h2>`,
    `  <p class="spread__page-subtitle">${escapeHtml(viewSubtitle.textContent)}</p>`,
    `  <p class="spread__page-signature">${escapeHtml(viewSignature.textContent)}</p>`,
    "</header>",
  ].join("");

  leftSlot.innerHTML = pageHeader;

  const rightSections = [leftPage?.innerHTML, rightPage?.innerHTML]
    .filter(Boolean)
    .map((html, index) => `<section class="spread__section" data-section-index="${index}">${html}</section>`)
    .join("");

  rightSlot.innerHTML = rightSections;

  contentPanel.dataset.tone = toneClass;

  if (bookStage) {
    bookStage.setMetadata({
      tone: toneClass,
      kicker: viewKicker.textContent,
      title: viewTitle.textContent,
      subtitle: viewSubtitle.textContent,
      author: trigger.querySelector(".book__author")?.textContent?.trim() || siteTitle,
      signature: siteTitle,
    });
  }
}

function syncTriggerState(activeTrigger) {
  bookButtons.forEach((button) => {
    const isActive = button === activeTrigger;
    button.classList.toggle("book--active", isActive);
    button.setAttribute("aria-expanded", String(isActive));
  });
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

function trapFocus(event) {
  const focusableElements = Array.from(
    bookView.querySelectorAll(
      'button:not([disabled]), [href]:not([aria-disabled="true"]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((element) => !element.hidden);

  if (focusableElements.length === 0) {
    return;
  }

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  if (event.shiftKey && document.activeElement === firstElement) {
    event.preventDefault();
    lastElement.focus();
  } else if (!event.shiftKey && document.activeElement === lastElement) {
    event.preventDefault();
    firstElement.focus();
  }
}

function wait(duration, token) {
  return new Promise((resolve) => {
    window.setTimeout(() => {
      resolve(token === undefined || token === motionToken);
    }, duration);
  });
}

function easeStandard(value) {
  return 1 - Math.pow(1 - value, 3);
}

function easeReturn(value) {
  return 1 - Math.pow(1 - value, 2.4);
}

function easeDock(value) {
  return 1 - Math.pow(1 - value, 3.4);
}

function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

class BookStage {
  constructor(host, three) {
    this.host = host;
    this.THREE = three;
    this.isReady = false;
    this.pose = {
      x: 0,
      y: 0,
      z: 0,
      scale: 1,
      rx: 0,
      ry: 0,
      rz: 0,
      cover: 0,
      shadow: 1,
      reading: 0,
    };

    this.dimensions = {
      width: 3.05,
      height: 4.85,
      depth: 0.82,
      coverThickness: 0.1,
      pageThickness: 0.62,
    };

    this.setup();
  }

  setup() {
    const T = this.THREE;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0.55, 12.6);
    this.camera.lookAt(0, 0.25, 0);

    this.renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.host.replaceChildren(this.renderer.domElement);

    const ambient = new T.HemisphereLight(0xf7f0e6, 0x4c4032, 1.9);
    const key = new T.DirectionalLight(0xffffff, 2.5);
    const fill = new T.DirectionalLight(0xf5ead6, 1.35);
    const rim = new T.DirectionalLight(0xe6d3b2, 0.8);

    key.position.set(4.8, 5.6, 7.2);
    fill.position.set(-5.5, 2.4, 5.4);
    rim.position.set(1.4, 4.6, -3.2);

    this.scene.add(ambient, key, fill, rim);

    this.bookRoot = new T.Group();
    this.scene.add(this.bookRoot);

    this.shadow = this.createShadow();
    this.bookRoot.add(this.shadow);

    this.bookPivot = new T.Group();
    this.bookRoot.add(this.bookPivot);

    this.model = this.createBookModel();
    this.bookPivot.add(this.model.group);

    this.resize();
    this.render();
    this.isReady = true;
  }

  createBookModel() {
    const T = this.THREE;
    const { width, height, depth, coverThickness, pageThickness } = this.dimensions;
    const pageWidth = width - 0.24;
    const pageHeight = height - 0.22;

    const group = new T.Group();

    const coverMaterial = new T.MeshPhysicalMaterial({
      color: 0x253650,
      roughness: 0.78,
      metalness: 0.02,
      clearcoat: 0.06,
      clearcoatRoughness: 0.88,
      transparent: true,
      opacity: 1,
    });

    const coverInnerMaterial = coverMaterial.clone();
    coverInnerMaterial.color.set("#d9ceb7");
    coverInnerMaterial.roughness = 0.9;

    const pageMaterial = new T.MeshStandardMaterial({
      color: 0xf0e7d8,
      roughness: 0.93,
      metalness: 0,
      transparent: true,
      opacity: 1,
    });

    const backCover = new T.Mesh(
      new T.BoxGeometry(width, height, coverThickness),
      coverMaterial.clone(),
    );
    backCover.position.z = -depth / 2 + coverThickness / 2;
    group.add(backCover);

    const spine = new T.Mesh(
      new T.BoxGeometry(coverThickness, height, depth),
      coverMaterial.clone(),
    );
    spine.position.set(-width / 2 + coverThickness / 2, 0, 0);
    group.add(spine);

    const pageBlock = new T.Mesh(
      new T.BoxGeometry(pageWidth, pageHeight, pageThickness),
      pageMaterial,
    );
    pageBlock.position.set(0.06, 0, -0.02);
    group.add(pageBlock);

    const foreEdge = new T.Mesh(
      new T.PlaneGeometry(pageHeight * 0.2, pageHeight * 0.95),
      new T.MeshBasicMaterial({ transparent: true, opacity: 0 }),
    );
    foreEdge.visible = false;
    group.add(foreEdge);

    const coverPivot = new T.Group();
    coverPivot.position.set(-width / 2, 0, 0);
    group.add(coverPivot);

    const frontCover = new T.Mesh(
      new T.BoxGeometry(width, height, coverThickness),
      [
        coverMaterial.clone(),
        coverMaterial.clone(),
        coverMaterial.clone(),
        coverMaterial.clone(),
        coverMaterial.clone(),
        coverInnerMaterial,
      ],
    );
    frontCover.position.set(width / 2, 0, depth / 2 - coverThickness / 2);
    coverPivot.add(frontCover);

    const frontArtwork = new T.Mesh(
      new T.PlaneGeometry(width * 0.985, height * 0.985),
      new T.MeshBasicMaterial({ transparent: true, side: T.DoubleSide }),
    );
    frontArtwork.position.set(width / 2, 0, depth / 2 + 0.008);
    coverPivot.add(frontArtwork);

    const spineArtwork = new T.Mesh(
      new T.PlaneGeometry(depth * 0.98, height * 0.96),
      new T.MeshBasicMaterial({ transparent: true, side: T.DoubleSide }),
    );
    spineArtwork.rotation.y = -Math.PI / 2;
    spineArtwork.position.set(-width / 2 - 0.008, 0, 0);
    group.add(spineArtwork);

    const pageStack = this.createPageSpread(pageWidth, pageHeight);
    pageStack.position.set(0.02, 0, 0.08);
    group.add(pageStack);

    return {
      group,
      backCover,
      spine,
      pageBlock,
      frontCover,
      coverPivot,
      frontArtwork,
      spineArtwork,
      pageStack,
      coverMaterial,
    };
  }

  createPageSpread(pageWidth, pageHeight) {
    const T = this.THREE;
    const spread = new T.Group();
    const paperMaterial = new T.MeshStandardMaterial({
      color: 0xf6efe0,
      roughness: 0.96,
      metalness: 0,
      transparent: true,
      opacity: 0,
    });

    const leftPage = new T.Mesh(
      new T.BoxGeometry(pageWidth * 0.49, pageHeight * 0.98, 0.04),
      paperMaterial,
    );
    leftPage.position.set(-pageWidth * 0.24, 0, depthOffset(0.02));
    spread.add(leftPage);

    const rightPage = new T.Mesh(
      new T.BoxGeometry(pageWidth * 0.49, pageHeight * 0.98, 0.04),
      paperMaterial.clone(),
    );
    rightPage.position.set(pageWidth * 0.25, 0, depthOffset(0.02));
    spread.add(rightPage);

    const gutter = new T.Mesh(
      new T.BoxGeometry(0.04, pageHeight * 0.95, 0.06),
      new T.MeshStandardMaterial({ color: 0xe4d8c5, roughness: 0.9, transparent: true, opacity: 0 }),
    );
    gutter.position.set(-pageWidth * 0.01, 0, 0.03);
    spread.add(gutter);

    spread.visible = true;
    return spread;

    function depthOffset(value) {
      return value;
    }
  }

  createShadow() {
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(128, 128, 22, 128, 128, 112);
    gradient.addColorStop(0, "rgba(17, 12, 9, 0.42)");
    gradient.addColorStop(1, "rgba(17, 12, 9, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const texture = new T.CanvasTexture(canvas);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(6.2, 3.5),
      new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.32,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.set(0, -this.dimensions.height / 2 - 0.54, 0.16);
    return shadow;
  }

  setMetadata(metadata) {
    this.metadata = metadata;
    this.updateMaterials();
  }

  setReadingMode(active) {
    this.pose = {
      ...this.pose,
      reading: active ? 1 : 0,
    };
    this.applyPose();
  }

  updateMaterials() {
    if (!this.metadata) {
      return;
    }

    const palette = tonePalettes[this.metadata.tone] || tonePalettes["tone-charcoal"];
    this.currentPalette = palette;
    this.coverBaseColor = new this.THREE.Color(palette.base);
    this.pageColor = new this.THREE.Color(palette.page);
    this.innerCoverColor = new this.THREE.Color("#ded2bf");

    this.model.backCover.material.color.set(palette.base);
    this.model.spine.material.color.set(palette.base);
    this.model.frontCover.material.forEach((material, index) => {
      if (index === 5) {
        material.color.set("#ded2bf");
        return;
      }
      material.color.set(palette.base);
    });
    this.model.frontArtwork.material.map?.dispose?.();
    this.model.spineArtwork.material.map?.dispose?.();

    const coverTexture = createCoverTexture(this.THREE, this.renderer, palette, this.metadata);
    const spineTexture = createSpineTexture(this.THREE, this.renderer, palette, this.metadata);

    this.model.frontArtwork.material.map = coverTexture;
    this.model.frontArtwork.material.needsUpdate = true;
    this.model.spineArtwork.material.map = spineTexture;
    this.model.spineArtwork.material.needsUpdate = true;

    this.model.pageBlock.material.color.set(palette.page);
    this.model.pageStack.children.forEach((mesh) => {
      if (mesh.material?.color) {
        mesh.material.color.set(palette.page);
      }
    });
    this.render();
  }

  resize() {
    const rect = this.host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);
    this.render();
  }

  createShelfPose(triggerRect) {
    const { x, y, scale } = this.projectTrigger(triggerRect);
    return {
      x,
      y,
      z: 0,
      scale: scale * SHELF_SCALE_FACTOR,
      rx: SHELF_ROTATION.rx,
      ry: SHELF_ROTATION.ry,
      rz: SHELF_ROTATION.rz,
      cover: 0,
      shadow: 0.72,
      reading: 0,
    };
  }

  createFloatPose(shelfPose) {
    return {
      x: lerp(shelfPose.x, 0.34, 0.52),
      y: lerp(shelfPose.y, 0.42, 0.52),
      z: 0.48,
      scale: lerp(shelfPose.scale, 0.78, 0.58),
      rx: 0.04,
      ry: 1.16,
      rz: 0.04,
      cover: 0,
      shadow: 0.96,
      reading: 0,
    };
  }

  createFrontPose() {
    return {
      x: 0,
      y: 0.24,
      z: 1.1,
      scale: 0.98,
      rx: -0.05,
      ry: 0,
      rz: 0,
      cover: 0,
      shadow: 1.08,
      reading: 0,
    };
  }

  createOpenPose() {
    return {
      x: 0,
      y: 0.02,
      z: 1.95,
      scale: 1.18,
      rx: -0.01,
      ry: 0,
      rz: 0.01,
      cover: -3.11,
      shadow: 1.08,
      reading: 0,
    };
  }

  createSpinePose(shelfPose) {
    return {
      x: lerp(shelfPose.x, 0.28, 0.56),
      y: lerp(shelfPose.y, 0.36, 0.56),
      z: 0.42,
      scale: lerp(shelfPose.scale, 0.82, 0.54),
      rx: 0.02,
      ry: 1.4,
      rz: 0.02,
      cover: 0,
      shadow: 0.94,
      reading: 0,
    };
  }

  createReadingPose() {
    return {
      ...this.createOpenPose(),
      reading: 1,
    };
  }

  projectTrigger(triggerRect) {
    const rect = this.host.getBoundingClientRect();
    const viewHeight = 2 * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const viewWidth = viewHeight * this.camera.aspect;
    const centerX = triggerRect.left + triggerRect.width / 2 - rect.left;
    const centerY = triggerRect.top + triggerRect.height / 2 - rect.top;
    const x = (centerX / rect.width - 0.5) * viewWidth;
    const y = (0.5 - centerY / rect.height) * viewHeight;
    const unitsPerPixel = viewHeight / rect.height;
    const scale = Math.max(0.13, (triggerRect.height * unitsPerPixel) / this.dimensions.height);

    return { x, y, scale };
  }

  setPose(nextPose) {
    this.pose = { ...nextPose };
    this.applyPose();
  }

  async animateTo(targetPose, duration, easing, token, tokenReader) {
    const startPose = { ...this.pose };
    const keys = Object.keys(startPose);

    return new Promise((resolve) => {
      const startedAt = performance.now();

      const tick = (now) => {
        if (tokenReader() !== token) {
          resolve(false);
          return;
        }

        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = easing(progress);
        const nextPose = {};

        keys.forEach((key) => {
          nextPose[key] = lerp(startPose[key], targetPose[key], eased);
        });

        this.setPose(nextPose);

        if (progress < 1) {
          window.requestAnimationFrame(tick);
          return;
        }

        resolve(true);
      };

      window.requestAnimationFrame(tick);
    });
  }

  applyPose() {
    const { x, y, z, scale, rx, ry, rz, cover, shadow, reading } = this.pose;
    const openRatio = Math.min(Math.abs(cover) / 3.11, 1);
    const readingRatio = Math.min(Math.max(reading, 0), 1);
    const modelFade = 1 - readingRatio;
    const pageBlend = Math.min(openRatio * 0.88 + readingRatio, 1);

    this.bookRoot.position.set(x, y, z);
    this.bookPivot.rotation.set(rx, ry, rz);
    this.bookPivot.scale.setScalar(scale);
    this.model.coverPivot.rotation.y = cover;
    this.shadow.material.opacity = 0.22 * shadow * (1 - readingRatio);
    this.shadow.scale.set(1.1 * shadow, 0.92 * shadow, 1);

    if (this.coverBaseColor && this.pageColor && this.innerCoverColor) {
      this.model.backCover.material.color.lerpColors(this.coverBaseColor, this.pageColor, pageBlend);
      this.model.spine.material.color.lerpColors(this.coverBaseColor, this.pageColor, pageBlend);
      this.model.frontCover.material.forEach((material, index) => {
        if (index === 5) {
          material.color.lerpColors(this.innerCoverColor, this.pageColor, Math.min(openRatio * 0.5 + readingRatio, 1));
          return;
        }
        material.color.lerpColors(this.coverBaseColor, this.pageColor, pageBlend);
      });
    }

    this.model.backCover.material.opacity = modelFade * 0.98;
    this.model.spine.material.opacity = modelFade * 0.9;
    this.model.frontCover.material.forEach((material, index) => {
      material.opacity = index === 5 ? modelFade * 0.96 : modelFade;
    });
    this.model.frontArtwork.material.opacity = modelFade;
    this.model.spineArtwork.material.opacity = modelFade;
    this.model.pageBlock.material.opacity = lerp(1, 0, Math.max(openRatio, readingRatio));
    this.model.pageBlock.scale.set(lerp(1, 0.88, openRatio), 1, 1);
    this.model.pageStack.position.x = lerp(0.02, 0, openRatio);
    this.model.pageStack.position.z = lerp(0.08, 0.1, openRatio);
    this.model.pageStack.scale.set(lerp(0.98, 1.02, openRatio), 1, 1);
    this.model.pageStack.children.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.opacity = lerp(openRatio, 0, readingRatio);
      }
    });
    this.render();
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

class ShelfStage {
  constructor(host, three, buttons) {
    this.host = host;
    this.THREE = three;
    this.buttons = buttons;
    this.entries = new Map();
    this.dimensions = {
      width: 3.05,
      height: 4.85,
      depth: 0.82,
      coverThickness: 0.1,
      pageThickness: 0.62,
    };

    this.setup();
  }

  setup() {
    const T = this.THREE;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(22, 1, 0.1, 100);
    this.camera.position.set(0, 0.16, 20.4);
    this.camera.lookAt(0, 0.14, 0);

    this.renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setClearColor(0x000000, 0);
    this.host.replaceChildren(this.renderer.domElement);

    const ambient = new T.HemisphereLight(0xf4ede1, 0x413326, 1.7);
    const key = new T.DirectionalLight(0xffffff, 2.1);
    const fill = new T.DirectionalLight(0xe9d8bd, 0.95);

    key.position.set(6.8, 8.2, 7.8);
    fill.position.set(-5.2, 2.1, 5.5);

    this.scene.add(ambient, key, fill);

    this.root = new T.Group();
    this.scene.add(this.root);

    this.buttons.forEach((button) => {
      const entry = this.createEntry(button);
      this.entries.set(button.dataset.section, entry);
      this.root.add(entry.group);
    });

    this.resize();
    this.render();
  }

  createEntry(button) {
    const T = this.THREE;
    const tone = Array.from(button.classList).find((className) => className.startsWith("tone-")) || "tone-charcoal";
    const palette = tonePalettes[tone] || tonePalettes["tone-charcoal"];
    const metadata = {
      tone,
      kicker: button.dataset.section || "Section",
      title: button.querySelector(".book__title")?.textContent?.trim() || "Book",
      subtitle: "",
      author: button.querySelector(".book__author")?.textContent?.trim() || siteTitle,
      signature: siteTitle,
    };

    const { width, height, depth, coverThickness, pageThickness } = this.dimensions;
    const pageWidth = width - 0.24;
    const pageHeight = height - 0.22;
    const group = new T.Group();

    const coverMaterial = new T.MeshPhysicalMaterial({
      color: palette.base,
      roughness: 0.82,
      metalness: 0.02,
      clearcoat: 0.04,
      clearcoatRoughness: 0.9,
    });

    const backCover = new T.Mesh(
      new T.BoxGeometry(width, height, coverThickness),
      coverMaterial.clone(),
    );
    backCover.position.z = -depth / 2 + coverThickness / 2;
    group.add(backCover);

    const spine = new T.Mesh(
      new T.BoxGeometry(coverThickness, height, depth),
      coverMaterial.clone(),
    );
    spine.position.set(-width / 2 + coverThickness / 2, 0, 0);
    group.add(spine);

    const pageBlock = new T.Mesh(
      new T.BoxGeometry(pageWidth, pageHeight, pageThickness),
      new T.MeshStandardMaterial({ color: palette.page, roughness: 0.94 }),
    );
    pageBlock.position.set(0.06, 0, -0.02);
    group.add(pageBlock);

    const frontCover = new T.Mesh(
      new T.BoxGeometry(width, height, coverThickness),
      coverMaterial.clone(),
    );
    frontCover.position.set(0, 0, depth / 2 - coverThickness / 2);
    group.add(frontCover);

    const frontArtwork = new T.Mesh(
      new T.PlaneGeometry(width * 0.985, height * 0.985),
      new T.MeshBasicMaterial({
        map: createCoverTexture(this.THREE, this.renderer, palette, metadata),
        transparent: true,
        side: T.DoubleSide,
      }),
    );
    frontArtwork.position.set(0, 0, depth / 2 + 0.008);
    group.add(frontArtwork);

    const spineArtwork = new T.Mesh(
      new T.PlaneGeometry(depth * 0.98, height * 0.96),
      new T.MeshBasicMaterial({
        map: createSpineTexture(this.THREE, this.renderer, palette, metadata),
        transparent: true,
        side: T.DoubleSide,
      }),
    );
    spineArtwork.rotation.y = -Math.PI / 2;
    spineArtwork.position.set(-width / 2 - 0.008, 0, 0);
    group.add(spineArtwork);

    const shadow = this.createShadow();
    shadow.position.set(0, -height / 2 - 0.46, 0.1);
    group.add(shadow);

    group.rotation.set(SHELF_ROTATION.rx, SHELF_ROTATION.ry, SHELF_ROTATION.rz);

    const materials = [
      backCover.material,
      spine.material,
      pageBlock.material,
      frontCover.material,
      frontArtwork.material,
      spineArtwork.material,
      shadow.material,
    ];

    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = 1;
      material.needsUpdate = true;
    });

    return { group, button, materials };
  }

  createShadow() {
    const T = this.THREE;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(128, 128, 22, 128, 128, 112);
    gradient.addColorStop(0, "rgba(17, 12, 9, 0.32)");
    gradient.addColorStop(1, "rgba(17, 12, 9, 0)");
    context.fillStyle = gradient;
    context.fillRect(0, 0, 256, 256);

    const texture = new T.CanvasTexture(canvas);
    const shadow = new T.Mesh(
      new T.PlaneGeometry(4.3, 2.1),
      new T.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.22,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    return shadow;
  }

  resize() {
    const rect = this.host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);
    this.layoutBooks();
    this.render();
  }

  layoutBooks() {
    const rect = this.host.getBoundingClientRect();
    const viewHeight = 2 * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const viewWidth = viewHeight * this.camera.aspect;
    const unitsPerPixel = viewHeight / rect.height;
    const packedEntries = Array.from(this.entries.values())
      .map((entry) => {
        const buttonRect = entry.button.getBoundingClientRect();
        const centerY = buttonRect.top + buttonRect.height / 2 - rect.top;
        const y = (0.5 - centerY / rect.height) * viewHeight;
        const scale = Math.max(0.13, ((buttonRect.height * unitsPerPixel) / this.dimensions.height) * SHELF_SCALE_FACTOR);
        const packedWidth = buttonRect.width * unitsPerPixel * 0.84;

        return {
          entry,
          buttonRect,
          y,
          scale,
          packedWidth,
        };
      })
      .sort((left, right) => left.buttonRect.left - right.buttonRect.left);

    let totalWidth = 0;
    packedEntries.forEach((item, index) => {
      totalWidth += item.packedWidth;
      if (index < packedEntries.length - 1) {
        totalWidth += unitsPerPixel * 1.2;
      }
    });

    let cursor = -totalWidth / 2;

    packedEntries.forEach((item, index) => {
      const x = cursor + item.packedWidth / 2;
      item.entry.group.position.set(x, item.y, 0);
      item.entry.group.scale.setScalar(item.scale);
      cursor += item.packedWidth;
      if (index < packedEntries.length - 1) {
        cursor += unitsPerPixel * 1.2;
      }
    });

    this.entries.forEach((entry) => {
      const buttonRect = entry.button.getBoundingClientRect();
      if (buttonRect.left + buttonRect.width < rect.left || buttonRect.left > rect.right) {
        entry.group.visible = false;
        return;
      }
      entry.group.visible = true;
    });
  }

  setVacant(sectionId) {
    this.entries.forEach((entry, key) => {
      if (sectionId && key === sectionId) {
        this.setEntryOpacity(entry, 0);
        entry.group.visible = false;
        return;
      }

      entry.group.visible = true;
      this.setEntryOpacity(entry, 1);
    });
    this.render();
  }

  setEntryOpacity(entry, opacity) {
    entry.materials.forEach((material, index) => {
      const targetOpacity = index === entry.materials.length - 1 ? opacity * 0.22 : opacity;
      material.opacity = targetOpacity;
      material.needsUpdate = true;
    });
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      return;
    }
    line = candidate;
  });

  if (line) {
    lines.push(line);
  }

  return lines.slice(0, 4);
}

function rgbaFromHex(hex, alpha) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createCoverTexture(three, renderer, palette, metadata) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, palette.mid);
  gradient.addColorStop(0.45, palette.base);
  gradient.addColorStop(1, palette.dark);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 900; index += 1) {
    const alpha = index % 2 === 0 ? 0.025 : 0.018;
    context.fillStyle = `rgba(255,255,255,${alpha})`;
    context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 18, Math.random() * 18);
    context.fillStyle = `rgba(0,0,0,${alpha * 0.82})`;
    context.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 20, Math.random() * 20);
  }

  context.strokeStyle = palette.rule;
  context.lineWidth = 3;
  context.strokeRect(74, 78, canvas.width - 148, canvas.height - 156);

  context.fillStyle = palette.rule;
  context.font = '500 38px "Instrument Sans", sans-serif';
  context.fillText(metadata.kicker.toUpperCase(), 112, 144);

  context.fillStyle = palette.title;
  context.font = '600 124px "Newsreader", serif';
  context.fillText(metadata.title, 112, 770);

  context.font = '500 30px "Instrument Sans", sans-serif';
  const subtitleLines = wrapText(context, metadata.subtitle, 112, 902, 760, 44);
  context.fillStyle = rgbaFromHex(palette.title, 0.82);
  subtitleLines.forEach((line, index) => {
    context.fillText(line, 112, 902 + index * 52);
  });

  const texture = new three.CanvasTexture(canvas);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  return texture;
}

function createSpineTexture(three, renderer, palette, metadata) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 1536;
  const context = canvas.getContext("2d");

  const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, palette.mid);
  gradient.addColorStop(0.48, palette.base);
  gradient.addColorStop(1, palette.dark);
  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.strokeStyle = palette.rule;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(72, 118);
  context.lineTo(canvas.width - 72, 118);
  context.moveTo(72, 1350);
  context.lineTo(canvas.width - 72, 1350);
  context.stroke();

  const titleCenterX = canvas.width / 2;
  const titleCenterY = 744;
  const maxTitleLength = 980;
  let titleSize = 134;

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = palette.title;

  while (titleSize > 82) {
    context.font = `600 ${titleSize}px "Newsreader", serif`;
    if (context.measureText(metadata.title).width <= maxTitleLength) {
      break;
    }
    titleSize -= 6;
  }

  context.save();
  context.translate(titleCenterX, titleCenterY);
  context.rotate(-Math.PI / 2);
  context.fillText(metadata.title, 0, 0);
  context.restore();

  const texture = new three.CanvasTexture(canvas);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  return texture;
}

if (THREE && stageHost) {
  bookStage = new BookStage(stageHost, THREE);
}

if (THREE && shelfStageHost) {
  shelfStage = new ShelfStage(shelfStageHost, THREE, bookButtons);
  document.body.classList.add("has-shelf-stage");
}
