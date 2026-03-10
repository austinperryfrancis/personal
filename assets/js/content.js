import { escapeHtml } from "./utils.js";

export function renderShelfButtons(bookshelf, sections) {
  Array.from(bookshelf.querySelectorAll(".book--hit")).forEach((button) => button.remove());

  const buttons = sections.map((section) => createShelfButton(section));
  buttons.forEach((button) => {
    bookshelf.append(button);
  });

  return buttons;
}

export function collectTemplates(root = document) {
  return new Map(
    Array.from(root.querySelectorAll("template[data-section]")).map((template) => [
      template.dataset.section,
      template,
    ]),
  );
}

export function populateBookView({ template, section, elements, siteTitle, bookStage }) {
  const fragment = template.content.cloneNode(true);
  const leftPage = fragment.querySelector('[data-page="left"]');
  const rightPage = fragment.querySelector('[data-page="right"]');

  elements.viewIndex.textContent = section.viewIndex;
  elements.viewKicker.textContent = section.viewKicker;
  elements.viewTitle.textContent = section.viewTitle;
  elements.viewSubtitle.textContent = section.viewSubtitle;
  elements.viewSignature.textContent = siteTitle;

  elements.leftSlot.innerHTML = buildPageHeaderHTML({
    kicker: section.viewKicker,
    title: section.viewTitle,
    subtitle: section.viewSubtitle,
    signature: siteTitle,
  });

  const rightSections = [leftPage?.innerHTML, rightPage?.innerHTML]
    .filter(Boolean)
    .map((html, index) => `<section class="spread__section" data-section-index="${index}">${html}</section>`)
    .join("");

  elements.rightSlot.innerHTML = rightSections;
  elements.contentPanel.dataset.tone = section.tone;

  if (bookStage) {
    bookStage.setMetadata({
      tone: section.tone,
      kicker: section.viewKicker,
      title: section.shelfTitle,
      subtitle: section.viewSubtitle,
      signature: siteTitle,
    });
  }
}

export function syncTriggerState(bookButtons, activeTrigger) {
  bookButtons.forEach((button) => {
    const isActive = button === activeTrigger;
    button.classList.toggle("book--active", isActive);
    button.setAttribute("aria-expanded", String(isActive));
  });
}

export function trapFocus(container, event) {
  const focusableElements = Array.from(
    container.querySelectorAll(
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

function createShelfButton(section) {
  const button = document.createElement("button");
  button.className = `book book--hit ${section.tone}`;
  button.type = "button";
  button.role = "listitem";
  button.dataset.section = section.id;
  button.setAttribute("aria-controls", "book-view");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-haspopup", "dialog");
  button.style.setProperty("--book-width", `${section.widthRem}rem`);
  button.style.setProperty("--book-height", `${section.heightRem}rem`);

  button.append(
    createSpan("book__band book__band--top", "", true),
    createSpan("book__band book__band--mid", "", true),
    createSpan("book__title", section.shelfTitle),
  );

  return button;
}

function createSpan(className, textContent, ariaHidden = false) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = textContent;

  if (ariaHidden) {
    span.setAttribute("aria-hidden", "true");
  }

  return span;
}

function buildPageHeaderHTML({ kicker, title, subtitle, signature }) {
  return [
    '<header class="spread__page-header">',
    `  <p class="spread__page-kicker">${escapeHtml(kicker)}</p>`,
    `  <h2 class="spread__page-title">${escapeHtml(title)}</h2>`,
    `  <p class="spread__page-subtitle">${escapeHtml(subtitle)}</p>`,
    `  <p class="spread__page-signature">${escapeHtml(signature)}</p>`,
    "</header>",
  ].join("");
}
