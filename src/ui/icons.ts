/**
 * Font Awesome 5 Free glyphs (fonts in `src/fonts/`, families mapped by the
 * `.fas` / `.far` / `.fab` classes in `app.css`).
 */
export const icons = {
  // chrome
  menu: "\uf0c9", // bars
  compose: "\uf044", // edit (pen in square)
  newChatBubble: "\uf075", // comment
  ellipsis: "\uf141", // ellipsis-h
  close: "\uf00d", // times
  search: "\uf002",
  chevronRight: "\uf054",

  // composer
  plus: "\uf067",
  mic: "\uf130",
  arrowUp: "\uf062",
  arrowDown: "\uf063",

  // empty-state suggestions
  image: "\uf03e", // image (far)
  pencil: "\uf303", // pencil-alt
  globe: "\uf0ac",

  // drawer
  images: "\uf302", // images (far)
  library: "\uf02d", // book
  projects: "\uf07b", // folder
  remote: "\uf109", // laptop
  scheduled: "\uf017", // clock (far)
  gear: "\uf013",

  // plus menu
  camera: "\uf030",
  paperclip: "\uf0c6",
  plug: "\uf1e6",
  brain: "\uf5dc",

  // context menu
  share: "\uf14d", // share-square
  pin: "\uf08d", // thumbtack
  archive: "\uf187",
  trash: "\uf2ed", // trash-alt (far)

  // settings
  smile: "\uf118", // far
  memory: "\uf518", // book-open
  envelope: "\uf0e0",
  phone: "\uf095",
  creditCard: "\uf09d", // credit-card
  refresh: "\uf2f1", // sync-alt
  appearance: "\uf185", // sun
  sparkle: "\u2726", // four-pointed star (text glyph, not FA)
} as const;
