import { rgbaFromHex, wrapText } from "./utils.js";

export function createCoverTexture(three, renderer, palette, metadata) {
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
  const subtitleLines = wrapText(context, metadata.subtitle, 760);
  context.fillStyle = rgbaFromHex(palette.title, 0.82);
  subtitleLines.forEach((line, index) => {
    context.fillText(line, 112, 902 + index * 52);
  });

  const texture = new three.CanvasTexture(canvas);
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);
  return texture;
}

export function createSpineTexture(three, renderer, palette, metadata) {
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
