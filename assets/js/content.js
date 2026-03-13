import { libraryBookMap } from "./site-config.js";
import { escapeHtml } from "./utils.js";

export function renderShelfButtons(bookshelf, sections) {
  Array.from(bookshelf.querySelectorAll(".book--hit")).forEach((button) => button.remove());

  const buttons = sections.map((section) => createShelfButton(section));
  buttons.forEach((button) => {
    bookshelf.append(button);
  });

  return buttons;
}

export function populateBookView({ section, elements, siteTitle, bookStage }) {
  const book = libraryBookMap.get(section.id);

  if (!book) {
    elements.leftSlot.innerHTML = "";
    elements.rightSlot.innerHTML = "";
    return;
  }

  elements.viewIndex.textContent = section.viewIndex;
  elements.viewKicker.textContent = section.viewKicker;
  elements.viewTitle.textContent = section.viewTitle;
  elements.viewSubtitle.textContent = section.viewSubtitle;
  elements.viewSignature.textContent = siteTitle;
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

  const pageMap = new Map(book.pages.map((page) => [page.id, page]));
  const defaultPageId = pageMap.has(book.defaultPageId) ? book.defaultPageId : book.pages[0]?.id;
  let activePageId = defaultPageId;
  const panelId = `book-panel-${section.id}`;

  elements.leftSlot.innerHTML = buildTocPageHTML(book, defaultPageId, panelId);
  elements.rightSlot.id = panelId;
  elements.rightSlot.setAttribute("aria-live", "polite");

  const tocButtons = Array.from(elements.leftSlot.querySelectorAll("[data-page-id]"));

  const renderActivePage = (shouldResetScroll = true) => {
    const activePage = pageMap.get(activePageId) || book.pages[0];
    elements.rightSlot.innerHTML = buildPageHTML(activePage);

    if (shouldResetScroll) {
      elements.rightSlot.scrollTop = 0;
    }

    syncTocState(tocButtons, activePageId);
  };

  tocButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const nextPageId = button.dataset.pageId;

      if (!nextPageId || nextPageId === activePageId || !pageMap.has(nextPageId)) {
        return;
      }

      activePageId = nextPageId;
      renderActivePage();
    });
  });

  renderActivePage(false);
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

function buildTocPageHTML(book, activePageId, panelId) {
  const tocItems = book.pages.map((page, index) => [
    '<li class="toc-page__item">',
    `  <button class="toc-page__link" type="button" data-page-id="${escapeHtml(page.id)}" aria-controls="${escapeHtml(panelId)}" aria-current="${page.id === activePageId ? "page" : "false"}">`,
    `    <span class="toc-page__index">${String(index + 1).padStart(2, "0")}</span>`,
    `    <span class="toc-page__text">${escapeHtml(page.label)}</span>`,
    "  </button>",
    "</li>",
  ].join("")).join("");

  return [
    '<div class="toc-page">',
    '  <header class="spread__page-header spread__page-header--toc">',
    `    <p class="spread__page-kicker">${escapeHtml(book.viewKicker)}</p>`,
    `    <h2 class="spread__page-title">${escapeHtml(book.viewTitle)}</h2>`,
    `    <p class="spread__page-subtitle">${escapeHtml(book.viewSubtitle)}</p>`,
    "  </header>",
    `  <nav class="toc-page__nav" aria-label="${escapeHtml(book.viewTitle)} contents">`,
    '    <p class="toc-page__label">Contents</p>',
    `    <ol class="toc-page__list">${tocItems}</ol>`,
    "  </nav>",
    "</div>",
  ].join("");
}

function buildPageHTML(page) {
  return page.blocks.map((block) => renderBlock(block)).join("");
}

function renderBlock(block) {
  switch (block.type) {
    case "text":
      return renderTextBlock(block);
    case "profile":
      return renderProfileBlock(block);
    case "list":
      return renderListBlock(block);
    case "meta":
      return renderMetaBlock(block);
    case "callout":
      return renderCalloutBlock(block);
    case "cards":
      return renderCardsBlock(block);
    case "gallery":
      return renderGalleryBlock(block);
    default:
      return "";
  }
}

function renderTextBlock(block) {
  const header = renderBlockHeader(block);
  const paragraphs = (block.paragraphs || [])
    .map((paragraph) => `<p class="page-copy">${escapeHtml(paragraph)}</p>`)
    .join("");

  return `<section class="page-block">${header}${paragraphs}</section>`;
}

function renderProfileBlock(block) {
  return [
    '<section class="page-block">',
    '  <div class="profile-card">',
    `    <div class="profile-card__monogram" aria-hidden="true">${escapeHtml(block.monogram || "")}</div>`,
    '    <div class="profile-card__copy">',
    `      <p class="profile-card__name">${escapeHtml(block.name || "")}</p>`,
    `      <p class="profile-card__role">${escapeHtml(block.role || "")}</p>`,
    `      <p class="profile-card__meta">${escapeHtml(block.meta || "")}</p>`,
    "    </div>",
    "  </div>",
    "</section>",
  ].join("");
}

function renderListBlock(block) {
  const header = renderBlockHeader(block);

  if (block.style === "entries") {
    const items = (block.items || []).map((item) => [
      "<li>",
      `  <span class="entry-list__title">${escapeHtml(item.title || "")}</span>`,
      item.meta ? `  <span class="entry-list__meta">${escapeHtml(item.meta)}</span>` : "",
      "</li>",
    ].join("")).join("");

    return `<section class="page-block">${header}<ol class="entry-list">${items}</ol></section>`;
  }

  const tagName = block.style === "ordered" ? "ol" : "ul";
  const items = (block.items || [])
    .map((item) => `<li>${escapeHtml(typeof item === "string" ? item : item?.label || "")}</li>`)
    .join("");

  return `<section class="page-block">${header}<${tagName} class="page-list">${items}</${tagName}></section>`;
}

function renderMetaBlock(block) {
  const items = (block.items || []).map((item) => [
    '<div class="meta-grid__item">',
    `  <p class="meta-grid__label">${escapeHtml(item.label || "")}</p>`,
    `  <p class="meta-grid__value">${escapeHtml(item.value || "")}</p>`,
    "</div>",
  ].join("")).join("");

  return `<section class="meta-grid">${items}</section>`;
}

function renderCalloutBlock(block) {
  const link = block.link
    ? `<p class="callout__copy"><a class="inline-link" href="${escapeHtml(block.link.href || "#")}">${escapeHtml(block.link.label || "")}</a></p>`
    : "";

  return [
    '<section class="callout">',
    `  <p class="callout__label">${escapeHtml(block.label || "")}</p>`,
    block.text ? `  <p class="callout__copy">${escapeHtml(block.text)}</p>` : "",
    link,
    "</section>",
  ].join("");
}

function renderCardsBlock(block) {
  const header = block.kicker ? `<p class="page-kicker">${escapeHtml(block.kicker)}</p>` : "";
  const cards = (block.items || []).map((item) => [
    '<div class="project-card">',
    `  <p class="project-card__title">${escapeHtml(item.title || "")}</p>`,
    `  <p class="project-card__copy">${escapeHtml(item.copy || "")}</p>`,
    "</div>",
  ].join("")).join("");

  return `<section class="page-block">${header}${cards}</section>`;
}

function renderGalleryBlock(block) {
  const items = (block.items || []).map((item) => [
    `<div class="photo-tile${item.wide ? " photo-tile--wide" : ""}">`,
    `  <span class="photo-tile__caption">${escapeHtml(item.caption || "")}</span>`,
    "</div>",
  ].join("")).join("");

  return `<section class="photo-grid" aria-label="${escapeHtml(block.ariaLabel || "Gallery")}">${items}</section>`;
}

function renderBlockHeader(block) {
  const parts = [];

  if (block.kicker) {
    parts.push(`<p class="page-kicker">${escapeHtml(block.kicker)}</p>`);
  }

  if (block.title) {
    parts.push(`<h3 class="page-heading">${escapeHtml(block.title)}</h3>`);
  }

  return parts.join("");
}

function syncTocState(tocButtons, activePageId) {
  tocButtons.forEach((button) => {
    const isActive = button.dataset.pageId === activePageId;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-current", isActive ? "page" : "false");
  });
}
