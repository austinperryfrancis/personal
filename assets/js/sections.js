import { libraryBooks } from "./site-config.js";

export const sections = libraryBooks.map((book) => ({
  id: book.id,
  tone: book.tone,
  shelfTitle: book.shelfTitle,
  viewIndex: book.viewIndex,
  viewKicker: book.viewKicker,
  viewTitle: book.viewTitle,
  viewSubtitle: book.viewSubtitle,
  widthRem: book.widthRem,
  heightRem: book.heightRem,
}));

export const sectionMap = new Map(sections.map((section) => [section.id, section]));
