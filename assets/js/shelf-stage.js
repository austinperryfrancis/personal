import { BOOK_DIMENSIONS, SHELF_ROTATION, SHELF_SCALE_FACTOR } from "./book-constants.js";
import { tonePalettes } from "./tone-palettes.js";
import { createCoverTexture, createSpineTexture } from "./textures.js";

export class ShelfStage {
  constructor(host, three, buttons, sectionMap, siteTitle) {
    this.host = host;
    this.THREE = three;
    this.buttons = buttons;
    this.sectionMap = sectionMap;
    this.siteTitle = siteTitle;
    this.entries = new Map();
    this.dimensions = { ...BOOK_DIMENSIONS };
    this.isReady = false;

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
    this.isReady = true;
  }

  createEntry(button) {
    const T = this.THREE;
    const section = this.sectionMap.get(button.dataset.section);
    const tone = section?.tone || "tone-charcoal";
    const palette = tonePalettes[tone] || tonePalettes["tone-charcoal"];
    const metadata = {
      tone,
      kicker: section?.viewKicker || button.dataset.section || "Section",
      title: section?.shelfTitle || "Book",
      subtitle: "",
      signature: this.siteTitle,
    };

    const { width, height, depth, coverThickness } = this.dimensions;
    const pageWidth = width - 0.24;
    const pageHeight = height - 0.22;
    const group = new T.Group();
    const bookGroup = new T.Group();
    group.add(bookGroup);

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
    bookGroup.add(backCover);

    const spine = new T.Mesh(
      new T.BoxGeometry(coverThickness, height, depth),
      coverMaterial.clone(),
    );
    spine.position.set(-width / 2 + coverThickness / 2, 0, 0);
    bookGroup.add(spine);

    const pageBlock = new T.Mesh(
      new T.BoxGeometry(pageWidth, pageHeight, this.dimensions.pageThickness),
      new T.MeshStandardMaterial({ color: palette.page, roughness: 0.94 }),
    );
    pageBlock.position.set(0.06, 0, -0.02);
    bookGroup.add(pageBlock);

    const frontCover = new T.Mesh(
      new T.BoxGeometry(width, height, coverThickness),
      coverMaterial.clone(),
    );
    frontCover.position.set(0, 0, depth / 2 - coverThickness / 2);
    bookGroup.add(frontCover);

    const frontArtwork = new T.Mesh(
      new T.PlaneGeometry(width * 0.985, height * 0.985),
      new T.MeshBasicMaterial({
        map: createCoverTexture(this.THREE, this.renderer, palette, metadata),
        transparent: true,
        side: T.DoubleSide,
      }),
    );
    frontArtwork.position.set(0, 0, depth / 2 + 0.008);
    bookGroup.add(frontArtwork);

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
    bookGroup.add(spineArtwork);

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

    return { group, bookGroup, button, materials };
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
    this.syncLayout();
  }

  syncLayout() {
    const rect = this.host.getBoundingClientRect();

    if (!rect.width || !rect.height) {
      return;
    }

    this.layoutBooks();
    this.render();
  }

  layoutBooks() {
    const rect = this.host.getBoundingClientRect();
    const viewHeight = 2 * Math.tan(this.THREE.MathUtils.degToRad(this.camera.fov / 2)) * this.camera.position.z;
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
        entry.group.visible = true;
        return;
      }

      entry.group.visible = true;
      this.setEntryOpacity(entry, 1);
    });
    this.render();
  }

  getEntryProjection(sectionId) {
    const entry = this.entries.get(sectionId);
    const hostRect = this.host.getBoundingClientRect();

    if (!entry || !hostRect.width || !hostRect.height) {
      return null;
    }

    this.camera.updateProjectionMatrix();
    this.camera.updateMatrixWorld();
    this.root.updateWorldMatrix(true, true);
    entry.bookGroup.updateWorldMatrix(true, true);

    const center = this.projectPoint(new this.THREE.Vector3(0, 0, 0), entry.bookGroup, hostRect);
    const top = this.projectPoint(
      new this.THREE.Vector3(0, this.dimensions.height / 2, 0),
      entry.bookGroup,
      hostRect,
    );
    const bottom = this.projectPoint(
      new this.THREE.Vector3(0, -this.dimensions.height / 2, 0),
      entry.bookGroup,
      hostRect,
    );
    const left = this.projectPoint(
      new this.THREE.Vector3(-this.dimensions.width / 2, 0, 0),
      entry.bookGroup,
      hostRect,
    );
    const right = this.projectPoint(
      new this.THREE.Vector3(this.dimensions.width / 2, 0, 0),
      entry.bookGroup,
      hostRect,
    );

    return {
      centerX: center.x,
      centerY: center.y,
      height: Math.abs(bottom.y - top.y),
      width: Math.abs(right.x - left.x),
      rotation: { ...SHELF_ROTATION },
      scale: entry.group.scale.x,
    };
  }

  projectPoint(localPoint, parent, hostRect) {
    const point = localPoint.clone().applyMatrix4(parent.matrixWorld);
    point.project(this.camera);

    return {
      x: hostRect.left + ((point.x + 1) * 0.5) * hostRect.width,
      y: hostRect.top + ((1 - point.y) * 0.5) * hostRect.height,
    };
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
