export function wait(duration) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, duration);
  });
}

export function easeStandard(value) {
  return 1 - Math.pow(1 - value, 3);
}

export function easeReturn(value) {
  return 1 - Math.pow(1 - value, 2.4);
}

export function easeDock(value) {
  return 1 - Math.pow(1 - value, 3.4);
}

export function lerp(start, end, progress) {
  return start + (end - start) * progress;
}

export function wrapText(context, text, maxWidth) {
  const words = String(text || "").split(" ");
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

export function rgbaFromHex(hex, alpha) {
  const normalized = hex.replace("#", "");
  const value = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const red = parseInt(value.slice(0, 2), 16);
  const green = parseInt(value.slice(2, 4), 16);
  const blue = parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
