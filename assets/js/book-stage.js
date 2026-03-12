import { BOOK_DIMENSIONS, COVER_OPEN_ANGLE, SHELF_ROTATION, SHELF_SCALE_FACTOR } from "./book-constants.js";
import { tonePalettes } from "./tone-palettes.js";
import { createCoverTexture, createSpineTexture } from "./textures.js";
import { lerp } from "./utils.js";
import { OBB } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/math/OBB.js";

const DEFAULT_POSE = {
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

export class BookStage {
  constructor(host, three, buttons = [], sectionMap = new Map(), siteTitle = "Austin Francis", options = {}) {
    this.host = host;
    this.THREE = three;
    this.buttons = buttons;
    this.sectionMap = sectionMap;
    this.siteTitle = siteTitle;
    this.mode = options.mode || "shelf";
    this.dimensions = { ...BOOK_DIMENSIONS };
    this.entries = new Map();
    this.shelfOrder = [];
    this.pose = { ...DEFAULT_POSE };
    this.activeEntry = null;
    this.pendingMetadata = null;
    this.isReady = false;

    this.setup();
  }

  setup() {
    const T = this.THREE;

    this.scene = new T.Scene();
    this.camera = new T.PerspectiveCamera(32, 1, 0.1, 100);
    this.raycaster = new T.Raycaster();
    this.pointer = new T.Vector2();
    this.camera.position.set(0, 0.55, 12.6);
    this.camera.lookAt(0, 0.25, 0);

    this.renderer = new T.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.className = "site-stage__canvas";
    this.host.replaceChildren(this.renderer.domElement);

    const ambient = new T.HemisphereLight(0xf7f0e6, 0x4c4032, 1.9);
    const key = new T.DirectionalLight(0xffffff, 2.5);
    const fill = new T.DirectionalLight(0xf5ead6, 1.35);
    const rim = new T.DirectionalLight(0xe6d3b2, 0.8);

    key.position.set(4.8, 5.6, 7.2);
    fill.position.set(-5.5, 2.4, 5.4);
    rim.position.set(1.4, 4.6, -3.2);

    this.scene.add(ambient, key, fill, rim);

    this.root = new T.Group();
    this.scene.add(this.root);

    this.buttons.forEach((button) => {
      const section = this.sectionMap.get(button.dataset.section);
      const entry = this.createEntry(button, section);
      this.entries.set(section?.id || button.dataset.section, entry);
      this.root.add(entry.root);
    });

    if (this.mode === "overlay") {
      this.entries.forEach((entry) => {
        entry.root.visible = false;
      });
    }

    this.resize();
    this.render();
    this.isReady = true;
  }

  createEntry(button, section) {
    const metadata = {
      tone: section?.tone || "tone-charcoal",
      kicker: section?.viewKicker || button.dataset.section || "Section",
      title: section?.shelfTitle || "Book",
      subtitle: section?.viewSubtitle || "",
      signature: this.siteTitle,
    };
    const actor = this.createActor(metadata);

    return {
      ...actor,
      id: section?.id || button.dataset.section,
      button,
      section,
      isVacant: false,
      metadata: { ...metadata },
      shelfMetadata: { ...metadata },
      shelfPose: {
        ...DEFAULT_POSE,
        rx: SHELF_ROTATION.rx,
        ry: SHELF_ROTATION.ry,
        rz: SHELF_ROTATION.rz,
        shadow: 0.72,
      },
    };
  }

  createActor(metadata) {
    const T = this.THREE;
    const root = new T.Group();
    const shadow = this.createShadow();
    root.add(shadow);

    const bookPivot = new T.Group();
    root.add(bookPivot);

    const model = this.createBookModel();
    bookPivot.add(model.group);

    const actor = {
      root,
      shadow,
      bookPivot,
      model,
      solidMaterials: [
        model.backCover.material,
        model.spine.material,
        ...model.frontCover.material,
        model.frontArtwork.material,
        model.spineArtwork.material,
        model.pageBlock.material,
      ],
      pageMaterials: model.pageStack.children.map((mesh) => mesh.material),
      pose: { ...DEFAULT_POSE },
      metadata,
      coverBaseColor: null,
      pageColor: null,
      innerCoverColor: null,
      collisionBox: new OBB(),
    };

    this.applyMetadata(actor, metadata);
    this.setActorAnimationMode(actor, false);
    this.applyPoseToActor(actor, actor.pose, false);
    return actor;
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
      new T.BoxGeometry(width - 0.24, height - 0.22, pageThickness),
      pageMaterial,
    );
    pageBlock.position.set(0.06, 0, -0.02);
    group.add(pageBlock);

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
    leftPage.position.set(-pageWidth * 0.24, 0, 0.02);
    spread.add(leftPage);

    const rightPage = new T.Mesh(
      new T.BoxGeometry(pageWidth * 0.49, pageHeight * 0.98, 0.04),
      paperMaterial.clone(),
    );
    rightPage.position.set(pageWidth * 0.25, 0, 0.02);
    spread.add(rightPage);

    const gutter = new T.Mesh(
      new T.BoxGeometry(0.04, pageHeight * 0.95, 0.06),
      new T.MeshStandardMaterial({ color: 0xe4d8c5, roughness: 0.9, transparent: true, opacity: 0 }),
    );
    gutter.position.set(-pageWidth * 0.01, 0, 0.03);
    spread.add(gutter);

    return spread;
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

  applyMetadata(actor, metadata) {
    const palette = tonePalettes[metadata.tone] || tonePalettes["tone-charcoal"];
    actor.metadata = metadata;
    actor.coverBaseColor = new this.THREE.Color(palette.base);
    actor.pageColor = new this.THREE.Color(palette.page);
    actor.innerCoverColor = new this.THREE.Color("#ded2bf");

    actor.model.backCover.material.color.set(palette.base);
    actor.model.spine.material.color.set(palette.base);
    actor.model.frontCover.material.forEach((material, index) => {
      material.color.set(index === 5 ? "#ded2bf" : palette.base);
    });
    actor.model.frontArtwork.material.map?.dispose?.();
    actor.model.spineArtwork.material.map?.dispose?.();

    actor.model.frontArtwork.material.map = createCoverTexture(this.THREE, this.renderer, palette, metadata);
    actor.model.frontArtwork.material.needsUpdate = true;
    actor.model.spineArtwork.material.map = createSpineTexture(this.THREE, this.renderer, palette, metadata);
    actor.model.spineArtwork.material.needsUpdate = true;

    actor.model.pageBlock.material.color.set(palette.page);
    actor.model.pageStack.children.forEach((mesh) => {
      if (mesh.material?.color) {
        mesh.material.color.set(palette.page);
      }
    });
  }

  setMetadata(metadata) {
    this.pendingMetadata = metadata;

    if (this.activeEntry) {
      this.applyMetadata(this.activeEntry, metadata);
      this.render();
    }
  }

  setActiveSection(sectionId) {
    const entry = this.entries.get(sectionId);

    if (!entry) {
      return;
    }

    this.activeEntry = entry;
    this.activeEntry.root.visible = true;
    this.activeEntry.root.renderOrder = 0;
    this.setActorAnimationMode(this.activeEntry, true);

    if (this.pendingMetadata) {
      this.applyMetadata(this.activeEntry, this.pendingMetadata);
    }

    this.pose = { ...entry.shelfPose };
    this.applyPoseToActor(entry, this.pose);
  }

  clearActiveSection() {
    if (!this.activeEntry) {
      return;
    }

    const resolvedEntry = this.activeEntry;
    this.activeEntry.root.renderOrder = 0;
    this.activeEntry.pose = { ...this.activeEntry.shelfPose };
    this.setActorAnimationMode(this.activeEntry, false);
    this.applyMetadata(this.activeEntry, this.activeEntry.shelfMetadata);
    this.applyPoseToActor(this.activeEntry, this.activeEntry.pose);
    this.activeEntry = null;
    this.pose = { ...DEFAULT_POSE };
    this.pendingMetadata = null;
    resolvedEntry.root.visible = this.mode === "overlay"
      ? false
      : resolvedEntry.isInViewport && !resolvedEntry.isVacant;
    this.render();
  }

  setReadingMode(active) {
    if (!this.activeEntry) {
      return;
    }

    this.pose = {
      ...this.pose,
      reading: active ? 1 : 0,
    };
    this.applyPose();
  }

  resize() {
    const rect = this.host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    this.camera.aspect = rect.width / rect.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(rect.width, rect.height, false);

    if (this.mode !== "overlay") {
      this.syncLayout();
    }

    this.render();
  }

  syncLayout() {
    if (this.mode === "overlay") {
      return;
    }

    const rect = this.host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    this.layoutBooks();
    this.syncHitTargets();
  }

  layoutBooks() {
    const rect = this.host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    const viewHeight = 2 * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const unitsPerPixel = viewHeight / rect.height;
    const packedEntries = Array.from(this.entries.values())
      .map((entry) => {
        const buttonRect = this.getButtonLayoutRect(entry.button);
        const centerY = buttonRect.top + buttonRect.height / 2 - rect.top;
        const y = (0.5 - centerY / rect.height) * viewHeight;
        const scale = Math.max(
          0.13,
          ((buttonRect.height * unitsPerPixel) / this.dimensions.height) * SHELF_SCALE_FACTOR,
        );
        const shelfPose = {
          ...DEFAULT_POSE,
          x: 0,
          y,
          z: -0.2,
          scale,
          rx: SHELF_ROTATION.rx,
          ry: SHELF_ROTATION.ry,
          rz: SHELF_ROTATION.rz,
          shadow: 0.72,
        };
        const packedWidth = (this.getPoseExtentAlongAxis(shelfPose, "x") * 2) + (unitsPerPixel * 0.28);

        return {
          entry,
          buttonRect,
          y,
          scale,
          packedWidth,
        };
      })
      .sort((left, right) => left.buttonRect.left - right.buttonRect.left);

    const shelfGap = 0;
    const shelfDepth = -0.2;

    let totalWidth = 0;
    packedEntries.forEach((item, index) => {
      totalWidth += item.packedWidth;
      if (index < packedEntries.length - 1) {
        totalWidth += shelfGap;
      }
    });

    let cursor = -totalWidth / 2;

    packedEntries.forEach((item, index) => {
      const x = cursor + item.packedWidth / 2;
      item.entry.shelfPose = {
        x,
        y: item.y,
        z: shelfDepth,
        scale: item.scale,
        rx: SHELF_ROTATION.rx,
        ry: SHELF_ROTATION.ry,
        rz: SHELF_ROTATION.rz,
        cover: 0,
        shadow: 0.72,
        reading: 0,
      };

      if (this.activeEntry !== item.entry) {
        item.entry.pose = { ...item.entry.shelfPose };
        this.applyPoseToActor(item.entry, item.entry.pose, false);
      }

      this.updateActorCollisionBox(item.entry, item.entry.shelfPose);

      cursor += item.packedWidth;
      if (index < packedEntries.length - 1) {
        cursor += shelfGap;
      }
    });

    this.shelfOrder = packedEntries.map((item) => item.entry.id);

    this.entries.forEach((entry) => {
      const buttonRect = this.getButtonLayoutRect(entry.button);
      const isVisible = !(buttonRect.left + buttonRect.width < rect.left || buttonRect.left > rect.right);
      entry.isInViewport = isVisible;
      entry.root.visible = isVisible && !entry.isVacant;
    });
  }

  getButtonLayoutRect(button) {
    const shelfRect = button.parentElement?.getBoundingClientRect();

    if (!shelfRect) {
      return button.getBoundingClientRect();
    }

    const left = shelfRect.left + button.offsetLeft;
    const top = shelfRect.top + button.offsetTop;
    const width = button.offsetWidth;
    const height = button.offsetHeight;

    return {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
    };
  }

  getShelfPose(sectionId) {
    const entry = this.entries.get(sectionId);
    return entry?.shelfPose ? { ...entry.shelfPose } : null;
  }

  setShelfPose(sectionId, pose) {
    const entry = this.entries.get(sectionId);

    if (!entry || !pose) {
      return;
    }

    entry.shelfPose = {
      ...DEFAULT_POSE,
      ...entry.shelfPose,
      ...pose,
    };
    this.updateActorCollisionBox(entry, entry.shelfPose);

    if (this.activeEntry !== entry) {
      entry.pose = { ...entry.shelfPose };
      this.applyPoseToActor(entry, entry.pose, false);
    }
  }

  setShelfOrder(order) {
    if (!Array.isArray(order)) {
      return;
    }

    this.shelfOrder = [...order];
  }

  getShelfOrder() {
    return [...this.shelfOrder];
  }

  isEntryVisible(sectionId) {
    const entry = this.entries.get(sectionId);
    return Boolean(entry?.isInViewport && !entry?.isVacant);
  }

  setEntryVisible(sectionId, visible) {
    const entry = this.entries.get(sectionId);

    if (!entry) {
      return;
    }

    entry.isInViewport = visible;
    entry.root.visible = Boolean(visible) && !entry.isVacant;
  }

  setVacant(sectionId) {
    this.entries.forEach((entry, key) => {
      entry.isVacant = Boolean(sectionId && key === sectionId);
      entry.root.visible = entry.isInViewport && !entry.isVacant;
    });

    this.render();
  }

  createShelfPose(fallbackRect) {
    if (this.activeEntry?.shelfPose) {
      return { ...this.activeEntry.shelfPose };
    }

    if (fallbackRect) {
      return this.projectTriggerRect(fallbackRect);
    }

    return {
      ...DEFAULT_POSE,
      rx: SHELF_ROTATION.rx,
      ry: SHELF_ROTATION.ry,
      rz: SHELF_ROTATION.rz,
      shadow: 0.72,
    };
  }

  getPoseExtentAlongZ(pose) {
    return this.getPoseExtentAlongAxis(pose, "z");
  }

  getPoseExtentAlongAxis(pose, axis) {
    const T = this.THREE;
    const { width, height, depth } = this.dimensions;
    const rotation = new T.Euler(pose.rx, pose.ry, pose.rz);
    const matrix = new T.Matrix4().makeRotationFromEuler(rotation);
    const elements = matrix.elements;
    const halfWidth = (width * pose.scale) / 2;
    const halfHeight = (height * pose.scale) / 2;
    const halfDepth = (depth * pose.scale) / 2;
    const axisIndices = axis === "x"
      ? [0, 4, 8]
      : axis === "y"
        ? [1, 5, 9]
        : [2, 6, 10];

    return (
      Math.abs(elements[axisIndices[0]]) * halfWidth
      + Math.abs(elements[axisIndices[1]]) * halfHeight
      + Math.abs(elements[axisIndices[2]]) * halfDepth
    );
  }

  getShelfFrontPlane() {
    let frontPlane = -Infinity;

    this.entries.forEach((entry) => {
      if (entry === this.activeEntry) {
        return;
      }

      const pose = entry.shelfPose;
      frontPlane = Math.max(frontPlane, pose.z + this.getPoseExtentAlongZ(pose));
    });

    return Number.isFinite(frontPlane) ? frontPlane : 0;
  }

  getImmediateNeighbors() {
    if (!this.activeEntry) {
      return [];
    }

    const activeIndex = this.shelfOrder.indexOf(this.activeEntry.id);

    if (activeIndex === -1) {
      return [];
    }

    return [
      this.entries.get(this.shelfOrder[activeIndex - 1]),
      this.entries.get(this.shelfOrder[activeIndex + 1]),
    ].filter(Boolean);
  }

  updateActorCollisionBox(actor, pose) {
    const T = this.THREE;
    const rotation = new T.Euler(pose.rx, pose.ry, pose.rz);
    const rotationMatrix = new T.Matrix4().makeRotationFromEuler(rotation);
    actor.collisionBox.center.set(pose.x, pose.y, pose.z);
    actor.collisionBox.halfSize.set(
      (this.dimensions.width * pose.scale) / 2,
      (this.dimensions.height * pose.scale) / 2,
      (this.dimensions.depth * pose.scale) / 2,
    );
    actor.collisionBox.rotation.setFromMatrix4(rotationMatrix);
    return actor.collisionBox;
  }

  findClearanceZ(shelfPose) {
    if (!this.activeEntry) {
      return this.getShelfFrontPlane() + this.getPoseExtentAlongZ(shelfPose) + 0.18;
    }

    const activePose = {
      ...shelfPose,
      x: shelfPose.x,
      y: shelfPose.y,
      scale: shelfPose.scale,
      rx: shelfPose.rx,
      ry: shelfPose.ry,
      rz: shelfPose.rz,
    };
    const neighbors = this.getImmediateNeighbors();
    const step = 0.04;
    const maxSteps = 180;
    let candidateZ = shelfPose.z;
    let steps = 0;

    while (steps < maxSteps) {
      activePose.z = candidateZ;
      const activeBox = this.updateActorCollisionBox(this.activeEntry, activePose);
      const isClear = neighbors.every((neighbor) => {
        this.updateActorCollisionBox(neighbor, neighbor.shelfPose);
        return !activeBox.intersectsOBB(neighbor.collisionBox, 0.001);
      });

      if (isClear) {
        return candidateZ + 0.08;
      }

      candidateZ += step;
      steps += 1;
    }

    return candidateZ;
  }

  getShelfExtractionZ(shelfPose) {
    return Math.max(shelfPose.z, this.findClearanceZ(shelfPose));
  }

  pickSectionAt(clientX, clientY) {
    const rect = this.host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return null;
    }

    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    const visibleEntries = Array.from(this.entries.values())
      .filter((entry) => entry.isInViewport && entry.hitBounds)
      .map((entry) => ({
        entry,
        bounds: entry.hitBounds,
        centerX: entry.hitBounds.left + (entry.hitBounds.width / 2),
      }))
      .sort((left, right) => left.centerX - right.centerX);

    if (visibleEntries.length === 0) {
      return null;
    }

    const candidates = visibleEntries.filter(({ bounds }) => (
      localY >= bounds.top && localY <= bounds.top + bounds.height
    ));

    if (candidates.length === 0) {
      return null;
    }

    const midpoints = candidates.map((candidate, index) => {
      const previous = candidates[index - 1];
      const next = candidates[index + 1];
      return {
        candidate,
        leftEdge: previous ? (previous.centerX + candidate.centerX) / 2 : -Infinity,
        rightEdge: next ? (candidate.centerX + next.centerX) / 2 : Infinity,
      };
    });

    const match = midpoints.find(({ leftEdge, rightEdge }) => localX >= leftEdge && localX < rightEdge);

    if (match) {
      return match.candidate.entry.id;
    }

    let closest = candidates[0];
    let closestDistance = Math.abs(localX - closest.centerX);

    candidates.slice(1).forEach((candidate) => {
      const distance = Math.abs(localX - candidate.centerX);

      if (distance < closestDistance) {
        closest = candidate;
        closestDistance = distance;
      }
    });

    return closest.entry.id;
  }

  syncHitTargets() {
    const hostRect = this.host.getBoundingClientRect();
    const shelfRect = this.buttons[0]?.parentElement?.getBoundingClientRect();

    this.entries.forEach((entry) => {
      const baseWidth = entry.button.offsetWidth;
      const baseHeight = entry.button.offsetHeight;

      if (!entry.isInViewport || !baseWidth || !baseHeight || !shelfRect) {
        entry.hitBounds = null;
        entry.button.style.setProperty("--hit-x", "0px");
        entry.button.style.setProperty("--hit-y", "0px");
        entry.button.style.setProperty("--hit-scale-x", "1");
        entry.button.style.setProperty("--hit-scale-y", "1");
        return;
      }

      const bounds = this.measureProjectedBounds(entry, entry.shelfPose);

      if (!bounds) {
        entry.hitBounds = null;
        entry.button.style.setProperty("--hit-x", "0px");
        entry.button.style.setProperty("--hit-y", "0px");
        entry.button.style.setProperty("--hit-scale-x", "1");
        entry.button.style.setProperty("--hit-scale-y", "1");
        return;
      }

      const hitPaddingX = 6;
      const hitPaddingY = 8;
      const left = bounds.left - hitPaddingX;
      const top = bounds.top - hitPaddingY;
      const width = bounds.width + (hitPaddingX * 2);
      const height = bounds.height + (hitPaddingY * 2);
      const baseLeft = (shelfRect.left - hostRect.left) + entry.button.offsetLeft;
      const baseTop = (shelfRect.top - hostRect.top) + entry.button.offsetTop;
      entry.hitBounds = {
        left,
        top,
        width,
        height,
      };

      entry.button.style.setProperty("--hit-x", `${left - baseLeft}px`);
      entry.button.style.setProperty("--hit-y", `${top - baseTop}px`);
      entry.button.style.setProperty("--hit-scale-x", `${width / baseWidth}`);
      entry.button.style.setProperty("--hit-scale-y", `${height / baseHeight}`);
    });
  }

  measureProjectedBounds(entry, pose) {
    const T = this.THREE;
    const rect = this.host.getBoundingClientRect();
    const previousPose = { ...entry.pose };
    const previousVisibility = entry.root.visible;

    this.applyPoseToActor(entry, pose, false);
    entry.root.visible = true;
    entry.root.updateWorldMatrix(true, true);

    const bounds = new T.Box3().setFromObject(entry.model.group);

    if (bounds.isEmpty()) {
      entry.root.visible = previousVisibility;
      this.applyPoseToActor(entry, previousPose, false);
      return null;
    }

    const corners = [
      new T.Vector3(bounds.min.x, bounds.min.y, bounds.min.z),
      new T.Vector3(bounds.min.x, bounds.min.y, bounds.max.z),
      new T.Vector3(bounds.min.x, bounds.max.y, bounds.min.z),
      new T.Vector3(bounds.min.x, bounds.max.y, bounds.max.z),
      new T.Vector3(bounds.max.x, bounds.min.y, bounds.min.z),
      new T.Vector3(bounds.max.x, bounds.min.y, bounds.max.z),
      new T.Vector3(bounds.max.x, bounds.max.y, bounds.min.z),
      new T.Vector3(bounds.max.x, bounds.max.y, bounds.max.z),
    ];

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    corners.forEach((corner) => {
      const projected = corner.clone().project(this.camera);
      const x = ((projected.x + 1) / 2) * rect.width;
      const y = ((1 - projected.y) / 2) * rect.height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    });

    entry.root.visible = previousVisibility;
    this.applyPoseToActor(entry, previousPose, false);

    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }

    return {
      left: Math.floor(minX),
      top: Math.floor(minY),
      width: Math.max(1, Math.ceil(maxX - minX)),
      height: Math.max(1, Math.ceil(maxY - minY)),
    };
  }

  getHeroZ(shelfPose) {
    return Math.max(this.getShelfExtractionZ(shelfPose) + 0.12, 2.48);
  }

  getCarryZ(shelfPose) {
    const extractionZ = this.getShelfExtractionZ(shelfPose);
    const heroZ = this.getHeroZ(shelfPose);
    return Math.max(extractionZ + 0.96, heroZ - 0.78);
  }

  createFloatPose(shelfPose) {
    return {
      x: 0,
      y: 0.22,
      z: 2.08,
      scale: 0.92,
      rx: -0.03,
      ry: 0,
      rz: 0.01,
      cover: 0,
      shadow: 1.02,
      reading: 0,
    };
  }

  createExtractPose(shelfPose) {
    return {
      x: shelfPose.x,
      y: shelfPose.y,
      z: this.getShelfExtractionZ(shelfPose),
      scale: shelfPose.scale,
      rx: shelfPose.rx,
      ry: shelfPose.ry,
      rz: shelfPose.rz,
      cover: 0,
      shadow: 0.9,
      reading: 0,
    };
  }

  createCarryPose(shelfPose) {
    return {
      x: shelfPose.x,
      y: shelfPose.y,
      z: Math.max(this.getCarryZ(shelfPose), this.getHeroZ(shelfPose) - 0.64),
      scale: shelfPose.scale,
      rx: shelfPose.rx,
      ry: shelfPose.ry,
      rz: shelfPose.rz,
      cover: 0,
      shadow: 0.96,
      reading: 0,
    };
  }

  createTurnPose(shelfPose) {
    return {
      x: shelfPose.x,
      y: shelfPose.y,
      z: Math.max(this.getCarryZ(shelfPose) + 0.12, this.getHeroZ(shelfPose) - 0.26),
      scale: shelfPose.scale,
      rx: -0.02,
      ry: 0.28,
      rz: 0,
      cover: 0,
      shadow: 0.96,
      reading: 0,
    };
  }

  createFrontPose(shelfPose) {
    const heroZ = shelfPose ? this.getHeroZ(shelfPose) : 2.48;
    return {
      x: 0,
      y: 0.24,
      z: heroZ,
      scale: 0.96,
      rx: -0.05,
      ry: 0,
      rz: 0,
      cover: 0,
      shadow: 1.08,
      reading: 0,
    };
  }

  createOpenPose(shelfPose) {
    const heroZ = shelfPose ? this.getHeroZ(shelfPose) : 2.54;
    return {
      x: 0,
      y: 0.02,
      z: heroZ + 0.08,
      scale: 1.08,
      rx: -0.01,
      ry: 0,
      rz: 0.01,
      cover: COVER_OPEN_ANGLE,
      shadow: 1.08,
      reading: 0,
    };
  }

  createSpinePose(shelfPose) {
    return {
      ...this.createExtractPose(shelfPose),
      cover: 0,
      shadow: 0.94,
      reading: 0,
    };
  }

  createReadingPose(shelfPose) {
    return {
      ...this.createOpenPose(shelfPose),
      reading: 1,
    };
  }

  projectTriggerRect(viewportRect) {
    const rect = this.host.getBoundingClientRect();
    const viewHeight = 2 * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
    const viewWidth = viewHeight * this.camera.aspect;
    const centerX = viewportRect.left + viewportRect.width / 2 - rect.left;
    const centerY = viewportRect.top + viewportRect.height / 2 - rect.top;
    const x = (centerX / rect.width - 0.5) * viewWidth;
    const y = (0.5 - centerY / rect.height) * viewHeight;
    const unitsPerPixel = viewHeight / rect.height;
    const scale = Math.max(0.13, (viewportRect.height * unitsPerPixel) / this.dimensions.height);

    return {
      ...DEFAULT_POSE,
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

  setPose(nextPose) {
    this.pose = { ...nextPose };
    this.applyPose();
  }

  setActorAnimationMode(actor, animated) {
    actor.solidMaterials.forEach((material) => {
      material.transparent = animated;
      material.opacity = 1;
      material.depthWrite = true;
      material.needsUpdate = true;
    });

    actor.pageMaterials.forEach((material) => {
      material.transparent = true;
      material.depthWrite = true;
      material.needsUpdate = true;
    });

    actor.shadow.material.transparent = true;
    actor.shadow.material.depthWrite = false;
    actor.shadow.material.needsUpdate = true;
  }

  interpolatePose(startPose, targetPose, easedProgress) {
    const nextPose = {};

    Object.keys(startPose).forEach((key) => {
      nextPose[key] = lerp(startPose[key], targetPose[key], easedProgress);
    });

    return nextPose;
  }

  interpolateTimelinePose(previousPose, startPose, targetPose, nextPose, progress) {
    const nextState = {};

    Object.keys(startPose).forEach((key) => {
      nextState[key] = this.interpolateSmoothValue(
        previousPose[key],
        startPose[key],
        targetPose[key],
        nextPose[key],
        progress,
      );
    });

    return nextState;
  }

  interpolateSmoothValue(previousValue, startValue, targetValue, nextValue, progress) {
    const tangentScale = 0.28;
    const progressSquared = progress * progress;
    const progressCubed = progressSquared * progress;
    const m1 = (targetValue - previousValue) * tangentScale;
    const m2 = (nextValue - startValue) * tangentScale;
    const interpolated = (
      ((2 * progressCubed) - (3 * progressSquared) + 1) * startValue
      + (progressCubed - (2 * progressSquared) + progress) * m1
      + ((-2 * progressCubed) + (3 * progressSquared)) * targetValue
      + (progressCubed - progressSquared) * m2
    );
    const lowerBound = Math.min(startValue, targetValue);
    const upperBound = Math.max(startValue, targetValue);

    return Math.min(upperBound, Math.max(lowerBound, interpolated));
  }

  async animateTimeline(segments, token, tokenReader, onUpdate = () => {}) {
    if (!this.activeEntry) {
      return false;
    }

    const normalizedSegments = [];

    segments
      .filter((segment) => segment?.pose && segment.duration > 0)
      .forEach((segment, index) => {
        normalizedSegments.push({
          ...segment,
          easing: segment.easing || ((value) => value),
          from: index === 0 ? { ...this.pose } : { ...normalizedSegments[index - 1].pose },
        });
      });

    if (normalizedSegments.length === 0) {
      onUpdate({ progress: 1, segmentIndex: -1, segmentProgress: 1, segmentEased: 1 });
      return true;
    }

    const keyPoses = [{ ...this.pose }, ...normalizedSegments.map((segment) => ({ ...segment.pose }))];
    const totalDuration = normalizedSegments.reduce((sum, segment) => sum + segment.duration, 0);

    return new Promise((resolve) => {
      const startedAt = performance.now();

      const tick = (now) => {
        if (tokenReader() !== token) {
          resolve(false);
          return;
        }

        const elapsed = Math.min(totalDuration, now - startedAt);
        let traversed = 0;
        let activeIndex = 0;

        while (
          activeIndex < normalizedSegments.length - 1
          && elapsed > traversed + normalizedSegments[activeIndex].duration
        ) {
          traversed += normalizedSegments[activeIndex].duration;
          activeIndex += 1;
        }

        const activeSegment = normalizedSegments[activeIndex];
        const segmentElapsed = Math.min(activeSegment.duration, Math.max(0, elapsed - traversed));
        const segmentProgress = activeSegment.duration
          ? segmentElapsed / activeSegment.duration
          : 1;
        const useSegmentEasing = activeIndex === normalizedSegments.length - 1;
        const previousPose = keyPoses[Math.max(0, activeIndex - 1)];
        const startPose = keyPoses[activeIndex];
        const targetPose = keyPoses[activeIndex + 1];
        const nextPose = keyPoses[Math.min(keyPoses.length - 1, activeIndex + 2)];
        const segmentEased = useSegmentEasing ? activeSegment.easing(segmentProgress) : segmentProgress;

        this.setPose(
          this.interpolateTimelinePose(
            previousPose,
            startPose,
            targetPose,
            nextPose,
            segmentEased,
          ),
        );

        onUpdate({
          progress: totalDuration ? elapsed / totalDuration : 1,
          segmentIndex: activeIndex,
          segmentProgress,
          segmentEased,
        });

        if (elapsed < totalDuration) {
          window.requestAnimationFrame(tick);
          return;
        }

        this.setPose(activeSegment.pose);
        onUpdate({
          progress: 1,
          segmentIndex: normalizedSegments.length - 1,
          segmentProgress: 1,
          segmentEased: 1,
        });
        resolve(true);
      };

      window.requestAnimationFrame(tick);
    });
  }

  applyPose() {
    if (!this.activeEntry) {
      return;
    }

    this.activeEntry.pose = { ...this.pose };
    this.applyPoseToActor(this.activeEntry, this.pose);
  }

  applyPoseToActor(actor, pose, shouldRender = true) {
    const { x, y, z, scale, rx, ry, rz, cover, shadow, reading } = pose;
    const openRatio = Math.min(Math.abs(cover) / Math.abs(COVER_OPEN_ANGLE), 1);
    const readingRatio = Math.min(Math.max(reading, 0), 1);
    const modelFade = 1 - readingRatio;
    const pageBlend = Math.min(openRatio * 0.88 + readingRatio, 1);
    const shadowOpacity = this.getShadowOpacity(actor, pose, shadow, readingRatio);

    actor.root.position.set(x, y, z);
    actor.bookPivot.rotation.set(rx, ry, rz);
    actor.bookPivot.scale.setScalar(scale);
    actor.model.coverPivot.rotation.y = cover;
    actor.shadow.material.opacity = shadowOpacity;
    actor.shadow.visible = shadowOpacity > 0.001;
    actor.shadow.scale.set(1.1 * shadow, 0.92 * shadow, 1);

    if (actor.coverBaseColor && actor.pageColor && actor.innerCoverColor) {
      actor.model.backCover.material.color.lerpColors(actor.coverBaseColor, actor.pageColor, pageBlend);
      actor.model.spine.material.color.lerpColors(actor.coverBaseColor, actor.pageColor, pageBlend);
      actor.model.frontCover.material.forEach((material, index) => {
        if (index === 5) {
          material.color.lerpColors(actor.innerCoverColor, actor.pageColor, Math.min(openRatio * 0.5 + readingRatio, 1));
          return;
        }
        material.color.lerpColors(actor.coverBaseColor, actor.pageColor, pageBlend);
      });
    }

    actor.model.backCover.material.opacity = modelFade * 0.98;
    actor.model.spine.material.opacity = modelFade * 0.9;
    actor.model.frontCover.material.forEach((material, index) => {
      material.opacity = index === 5 ? modelFade * 0.96 : modelFade;
    });
    actor.model.frontArtwork.material.opacity = modelFade;
    actor.model.spineArtwork.material.opacity = modelFade;
    actor.model.pageBlock.material.opacity = lerp(1, 0, Math.max(openRatio, readingRatio));
    actor.model.pageBlock.scale.set(lerp(1, 0.88, openRatio), 1, 1);
    actor.model.pageStack.position.x = lerp(0.02, 0, openRatio);
    actor.model.pageStack.position.z = lerp(0.08, 0.1, openRatio);
    actor.model.pageStack.scale.set(lerp(0.98, 1.02, openRatio), 1, 1);
    actor.model.pageStack.children.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.opacity = lerp(openRatio, 0, readingRatio);
      }
    });

    const solidNeedsTransparency = modelFade < 0.999;
    const pageBlockNeedsTransparency = actor.model.pageBlock.material.opacity < 0.999;
    const pageStackNeedsTransparency = readingRatio > 0.001 || openRatio > 0.001;

    actor.solidMaterials.forEach((material) => {
      if (material.transparent !== solidNeedsTransparency) {
        material.transparent = solidNeedsTransparency;
        material.needsUpdate = true;
      }
    });

    if (actor.model.pageBlock.material.transparent !== pageBlockNeedsTransparency) {
      actor.model.pageBlock.material.transparent = pageBlockNeedsTransparency;
      actor.model.pageBlock.material.needsUpdate = true;
    }

    actor.model.pageStack.children.forEach((mesh) => {
      if (mesh.material && mesh.material.transparent !== pageStackNeedsTransparency) {
        mesh.material.transparent = pageStackNeedsTransparency;
        mesh.material.needsUpdate = true;
      }
    });

    if (shouldRender) {
      this.render();
    }
  }

  getShadowOpacity(actor, pose, shadow, readingRatio) {
    const baseOpacity = 0.22 * shadow * (1 - readingRatio);

    if (this.mode !== "overlay") {
      return baseOpacity;
    }

    if (actor !== this.activeEntry || !actor.shelfPose) {
      return 0;
    }

    const fadeStart = this.createTurnPose(actor.shelfPose).z;
    const fadeEnd = this.createFrontPose(actor.shelfPose).z;

    if (fadeEnd <= fadeStart) {
      return baseOpacity;
    }

    const progress = Math.max(0, Math.min((pose.z - fadeStart) / (fadeEnd - fadeStart), 1));
    return baseOpacity * progress;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }
}
