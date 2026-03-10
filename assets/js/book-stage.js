import { BOOK_DIMENSIONS, COVER_OPEN_ANGLE, SHELF_ROTATION, SHELF_SCALE_FACTOR } from "./book-constants.js";
import { tonePalettes } from "./tone-palettes.js";
import { createCoverTexture, createSpineTexture } from "./textures.js";
import { lerp } from "./utils.js";

export class BookStage {
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
    this.dimensions = { ...BOOK_DIMENSIONS };

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
      cover: COVER_OPEN_ANGLE,
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
    const openRatio = Math.min(Math.abs(cover) / Math.abs(COVER_OPEN_ANGLE), 1);
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
