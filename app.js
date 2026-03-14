const elements = {
  currentGrid: document.querySelector("#current-grid"),
  yearGroups: document.querySelector("#year-groups"),
  searchInput: document.querySelector("#search-input"),
  clearCacheButton: document.querySelector("#clear-cache-button"),
  statusText: document.querySelector("#status-text"),
  totalBooks: document.querySelector("#total-books"),
  currentBooks: document.querySelector("#current-books"),
  finishedBooks: document.querySelector("#finished-books"),
  cardTemplate: document.querySelector("#book-card-template"),
};

const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1/volumes";
const CACHE_PREFIX = "reading-shelf:v2:";
const GOOGLE_BOOKS_API_KEY = window.READING_SHELF_CONFIG?.googleBooksApiKey?.trim() || "";
const BLACK_LIBRARY_OVERRIDES = [
  {
    title: "All is Dust",
    author: "John French",
    blackLibraryLink: "https://www.blacklibrary.com/series/Series-Chaos-Space-Marines/all-is-dust-ebook.html",
    blackLibraryLabel: "Black Library",
    cover: "https://www.blacklibrary.com/Images/Product/DefaultBL/large/15-all-is-dust.jpg",
    description: "A Thousand Sons short story. To their foes, Thousand Sons are automata, deadly walking armoured suits who feel no pain or fear. But what is it like to live inside that armour, a spirit divorced from flesh?",
    categories: ["Warhammer 40,000", "Short story"],
    publisher: "Black Library",
    metadataStatus: "loaded",
  },
  {
    title: "The Solar War",
    author: "John French",
    blackLibraryLink: "https://www.blacklibrary.com/authors/john-french/the-solar-war-ebook-2019.html",
    blackLibraryLabel: "Black Library",
    cover: "https://www.blacklibrary.com/Images/Product/DefaultBL/large/BLPROCESSED-The-Solar-War-cover.jpg",
    description: "Siege of Terra Book 1. After years of devastating war, Horus and his forces have arrived at Terra. But before they can set foot on the Throneworld, they must first break the defences of the Sol System.",
    categories: ["The Horus Heresy", "Siege of Terra"],
    publisher: "Black Library",
    metadataStatus: "loaded",
  },
  {
    title: "The First Wall",
    author: "Gav Thorpe",
    blackLibraryLink: "https://www.blacklibrary.com/the-horus-heresy/hh-sot/the-first-wall-ebook-2020.html",
    blackLibraryLabel: "Black Library",
    cover: "https://www.blacklibrary.com/Images/Product/DefaultBL/large/BLPROCESSED-The-First-Wall-Cover.jpg",
    description: "Siege of Terra Book 3. The outer defences have fallen, but the walls of the Imperial Palace stand. To break them, the Traitors need their most devastating weapons, and so the Lion's Gate Spaceport must be theirs.",
    categories: ["The Horus Heresy", "Siege of Terra"],
    publisher: "Black Library",
    metadataStatus: "loaded",
  },
  {
    title: "Mortis",
    author: "John French",
    blackLibraryLink: "https://www.blacklibrary.com/all-products/siege-of-terra-mortis-ebook-2021.html",
    blackLibraryLabel: "Black Library",
    cover: "https://www.blacklibrary.com/Images/Product/DefaultBL/large/BLPROCESSED-Mortis-cover-2021.jpg",
    description: "Siege of Terra Book 5. The Imperial forces are on the back foot once more as Horus commands the Titans of the Legio Mortis to breach the walls of the Imperial Palace.",
    categories: ["The Horus Heresy", "Siege of Terra"],
    publisher: "Black Library",
    metadataStatus: "loaded",
  },
  {
    title: "Warhawk",
    author: "Chris Wraight",
    blackLibraryLink: "https://www.blacklibrary.com/all-products/warhawk-ebook-2021.html",
    blackLibraryLabel: "Black Library",
    cover: "https://www.blacklibrary.com/Images/Product/DefaultBL/large/BLPROCESSED-Warhawk-Cover-2021.jpg",
    description: "Siege of Terra Book 6. With the Lion's Gate space port taken by the enemy, Jaghatai Khan of the White Scars prepares a brazen gambit against the Death Guard.",
    categories: ["The Horus Heresy", "Siege of Terra"],
    publisher: "Black Library",
    metadataStatus: "loaded",
  },
  {
    title: "Echoes of Eternity",
    author: "Aaron Dembski-Bowden",
    blackLibraryLink: "https://www.blacklibrary.com/authors/aaron-dembski-bowden/ebook-echoes-of-eternity-eng-2022.html",
    blackLibraryLabel: "Black Library",
    cover: "https://www.blacklibrary.com/Images/Product/DefaultBL/large/BLPROCESSED-Echoes-of-Eternity-Cover-2022.jpg",
    description: "Siege of Terra Book 7. With the walls of the Imperial Palace in ruins and the end in sight, Sanguinius prepares one final stand at the Delphic Battlement.",
    categories: ["The Horus Heresy", "Siege of Terra"],
    publisher: "Black Library",
    metadataStatus: "loaded",
  },
  {
    title: "Era of Ruin",
    author: "Dan Abnett",
    blackLibraryLink: "https://www.blacklibrary.com/all-products/ebook-siege-of-terra-era-of-ruin-eng-2025.html",
    blackLibraryLabel: "Black Library",
    cover: "https://www.blacklibrary.com/Images/Product/DefaultBL/large/BLPROCESSED-6063018100736-Era-of-Ruin-eBook-Cover-2025.jpg",
    description: "A Siege of Terra anthology. Horus is dead and his Heresy is over, but for those left behind a new era of ruin is dawning across the Imperium.",
    categories: ["The Horus Heresy", "Anthology"],
    publisher: "Black Library",
    metadataStatus: "loaded",
  },
];

let appState = {
  books: [],
  current: [],
  finishedByYear: new Map(),
  query: "",
};

bootstrap();

async function bootstrap() {
  try {
    const markdown = await loadReadme();
    const parsed = parseReadingLog(markdown);
    const allBooks = [...parsed.current, ...parsed.finished];

    updateStats(parsed);
    setStatus(`Loaded ${allBooks.length} books from README. Searching the web for metadata...`);

    const enrichedBooks = await enrichBooks(allBooks);
    appState = {
      books: enrichedBooks,
      current: enrichedBooks.filter((book) => book.state === "Currently reading"),
      finishedByYear: groupFinishedByYear(enrichedBooks.filter((book) => book.state === "Finished")),
      query: "",
    };

    render();
    setStatus("Shelf ready. Covers and descriptions are pulled live from Google Books.");
  } catch (error) {
    console.error(error);
    setStatus("Could not load README.md. Serve this folder with a local web server instead of opening the HTML file directly.");
    elements.currentGrid.innerHTML = `<div class="empty-state">README.md could not be read from this page. Run a static server in this folder and refresh.</div>`;
  }
}

async function loadReadme() {
  const response = await fetch("./README.md", { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Failed to load README.md: ${response.status}`);
  }
  return response.text();
}

function parseReadingLog(markdown) {
  const lines = markdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const current = [];
  const finished = [];
  let section = "";
  let currentYear = "";

  for (const line of lines) {
    if (/^\*\*Currently reading\*\*/i.test(line)) {
      section = "current";
      continue;
    }

    const finishedMatch = line.match(/^\*\*Finished books (\d{4})\*\*/i);
    if (finishedMatch) {
      section = "finished";
      currentYear = finishedMatch[1];
      continue;
    }

    if (line.startsWith("#") || line.startsWith("This is a list")) {
      continue;
    }

    if (section === "current") {
      const parsedBook = parseBookLine(line);
      if (parsedBook) {
        current.push({
          ...parsedBook,
          id: buildBookId(parsedBook.title, parsedBook.author),
          state: "Currently reading",
          finishedOn: "",
          year: "",
        });
      }
      continue;
    }

    if (section === "finished") {
      const finishedBook = parseFinishedBookLine(line, currentYear);
      if (finishedBook) {
        finished.push({
          ...finishedBook,
          id: buildBookId(finishedBook.title, finishedBook.author),
          state: "Finished",
        });
      }
    }
  }

  return { current, finished };
}

function parseBookLine(line) {
  const parts = line.split(" - ").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  return {
    title: parts[0],
    author: parts.slice(1).join(" - "),
  };
}

function parseFinishedBookLine(line, fallbackYear) {
  const match = line.match(/^(\d{4}-\d{2}-\d{2}):\s+(.+?)\s+-\s+(.+)$/);
  if (!match) {
    return null;
  }
  return {
    finishedOn: match[1],
    title: match[2].trim(),
    author: match[3].trim(),
    year: match[1].slice(0, 4) || fallbackYear,
  };
}

function buildBookId(title, author) {
  return `${title}__${author}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function enrichBooks(books) {
  return runWithConcurrency(books, 4, enrichBook);
}

async function enrichBook(book) {
  const cacheKey = `${CACHE_PREFIX}${book.id}`;
  const blackLibrary = getBlackLibraryOverride(book);
  const cached = safeReadCache(cacheKey);
  if (cached) {
    return mergeBookMetadata(book, cached, blackLibrary);
  }

  try {
    const query = `intitle:"${book.title}" inauthor:"${book.author}"`;
    const response = await fetch(buildVolumesUrl(query));
    if (!response.ok) {
      return mergeBookMetadata(book, applyFallbackMetadata(book), blackLibrary);
    }

    const payload = await response.json();
    const bestMatch = findBestMatch(book, payload.items || []);
    const metadata = bestMatch ? mapGoogleBook(bestMatch) : applyFallbackMetadata(book);

    const mergedMetadata = mergeBookMetadata(book, metadata, blackLibrary);
    localStorage.setItem(cacheKey, JSON.stringify(mergedMetadata));
    return mergedMetadata;
  } catch (error) {
    console.warn("Could not load or cache book metadata", error);
    return mergeBookMetadata(book, applyFallbackMetadata(book), blackLibrary);
  }
}

function findBestMatch(book, items) {
  const normalizedTitle = normalize(book.title);
  const normalizedAuthor = normalize(book.author);

  return items.find((item) => {
    const info = item.volumeInfo || {};
    const itemTitle = normalize(info.title || "");
    const itemAuthors = normalize((info.authors || []).join(" "));
    return itemTitle.includes(normalizedTitle) && itemAuthors.includes(normalizedAuthor);
  }) || items[0];
}

function mapGoogleBook(item) {
  const info = item.volumeInfo || {};
  const imageLinks = info.imageLinks || {};
  return {
    description: stripHtml(info.description || "No description found for this title yet."),
    publishedDate: info.publishedDate || "",
    categories: info.categories || [],
    pageCount: info.pageCount || "",
    publisher: info.publisher || "",
    infoLink: info.infoLink || item.selfLink || "",
    previewLink: info.previewLink || "",
    cover: imageLinks.thumbnail?.replace("http://", "https://") || imageLinks.smallThumbnail?.replace("http://", "https://") || "",
    blackLibraryLink: "",
    blackLibraryLabel: "",
    metadataStatus: "loaded",
  };
}

function applyFallbackMetadata(book) {
  return {
    description: `${book.title} by ${book.author}.`,
    publishedDate: "",
    categories: [],
    pageCount: "",
    publisher: "",
    infoLink: "",
    previewLink: "",
    cover: "",
    blackLibraryLink: "",
    blackLibraryLabel: "",
    metadataStatus: "fallback",
  };
}

function groupFinishedByYear(finishedBooks) {
  const grouped = new Map();
  const sorted = [...finishedBooks].sort((a, b) => b.finishedOn.localeCompare(a.finishedOn));

  for (const book of sorted) {
    if (!grouped.has(book.year)) {
      grouped.set(book.year, []);
    }
    grouped.get(book.year).push(book);
  }

  return new Map([...grouped.entries()].sort((a, b) => Number(b[0]) - Number(a[0])));
}

function render() {
  const query = normalize(appState.query);
  const currentBooks = filterBooks(appState.current, query);
  const finishedGroups = new Map(
    [...appState.finishedByYear.entries()]
      .map(([year, books]) => [year, filterBooks(books, query)])
      .filter(([, books]) => books.length > 0)
  );

  renderCurrent(currentBooks);
  renderFinished(finishedGroups);
}

function renderCurrent(books) {
  elements.currentGrid.replaceChildren();

  if (!books.length) {
    elements.currentGrid.innerHTML = `<div class="empty-state">No currently-reading books match this filter.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const book of books) {
    fragment.append(createBookCard(book));
  }
  elements.currentGrid.append(fragment);
}

function renderFinished(groups) {
  elements.yearGroups.replaceChildren();

  if (!groups.size) {
    elements.yearGroups.innerHTML = `<div class="empty-state">No finished books match this filter.</div>`;
    return;
  }

  for (const [year, books] of groups.entries()) {
    const wrapper = document.createElement("section");
    wrapper.className = "year-group";

    const header = document.createElement("div");
    header.className = "year-group-header";
    header.innerHTML = `<h3>${year}</h3><span class="year-total">${books.length} book${books.length === 1 ? "" : "s"}</span>`;

    const grid = document.createElement("div");
    grid.className = "book-grid";
    books.forEach((book) => grid.append(createBookCard(book)));

    wrapper.append(header, grid);
    elements.yearGroups.append(wrapper);
  }
}

function createBookCard(book) {
  const fragment = elements.cardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".book-card");
  const cover = fragment.querySelector(".cover");
  const fallback = fragment.querySelector(".cover-fallback");
  const state = fragment.querySelector(".reading-state");
  const finishDate = fragment.querySelector(".finish-date");
  const title = fragment.querySelector(".book-title");
  const author = fragment.querySelector(".book-author");
  const meta = fragment.querySelector(".book-meta");
  const description = fragment.querySelector(".book-description");
  const links = fragment.querySelector(".book-links");

  card.tabIndex = 0;
  card.setAttribute("aria-label", `${book.title} by ${book.author}`);
  title.textContent = book.title;
  author.textContent = book.author;
  state.textContent = book.state;
  finishDate.textContent = book.finishedOn ? formatDate(book.finishedOn) : "";
  meta.textContent = buildMetaLine(book);
  description.textContent = truncate(book.description, 220);
  fallback.textContent = buildMonogram(book.title);

  if (book.cover) {
    cover.src = book.cover;
    cover.alt = `Cover of ${book.title}`;
    cover.addEventListener("load", () => cover.classList.add("is-loaded"), { once: true });
  } else {
    cover.remove();
  }

  appendLink(links, book.infoLink, "Google Books");
  appendLink(links, book.previewLink, "Preview");
  appendLink(links, book.blackLibraryLink, book.blackLibraryLabel || "Black Library");

  card.dataset.search = normalize([
    book.title,
    book.author,
    book.description,
    ...(book.categories || []),
    book.publisher || "",
  ].join(" "));

  return fragment;
}

function buildMetaLine(book) {
  const parts = [];
  if (book.publishedDate) parts.push(`Published ${book.publishedDate}`);
  if (book.pageCount) parts.push(`${book.pageCount} pages`);
  if (book.categories?.length) parts.push(book.categories.slice(0, 2).join(", "));
  if (book.publisher) parts.push(book.publisher);
  if (parts.length) {
    return parts.join(" | ");
  }

  return book.metadataStatus === "fallback"
    ? "No extra metadata was found for this title."
    : "Loading metadata...";
}

function appendLink(container, href, label) {
  if (!href) return;
  const link = document.createElement("a");
  link.href = href;
  link.target = "_blank";
  link.rel = "noreferrer";
  link.textContent = label;
  link.addEventListener("click", () => {
    window.setTimeout(() => {
      if (document.activeElement instanceof HTMLElement) {
        document.activeElement.blur();
      }
    }, 0);
  });
  container.append(link);
}

function filterBooks(books, query) {
  if (!query) return books;
  return books.filter((book) => normalize([
    book.title,
    book.author,
    book.description,
    ...(book.categories || []),
    book.publisher || "",
  ].join(" ")).includes(query));
}

function updateStats(parsed) {
  elements.totalBooks.textContent = parsed.current.length + parsed.finished.length;
  elements.currentBooks.textContent = parsed.current.length;
  elements.finishedBooks.textContent = parsed.finished.length;
}

function setStatus(message) {
  elements.statusText.textContent = message;
}

function normalize(value) {
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function stripHtml(value) {
  const container = document.createElement("div");
  container.innerHTML = value;
  return container.textContent.trim();
}

function truncate(text, maxLength) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trimEnd()}...`;
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function buildMonogram(title) {
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let index = 0;

  async function runWorker() {
    while (index < items.length) {
      const currentIndex = index++;
      results[currentIndex] = await worker(items[currentIndex]);
      renderProgress(currentIndex + 1, items.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runWorker));
  return results;
}

function renderProgress(done, total) {
  setStatus(`Loaded ${done} of ${total} books from the web...`);
}

elements.searchInput.addEventListener("input", (event) => {
  appState.query = event.target.value;
  render();
});

elements.clearCacheButton.addEventListener("click", async () => {
  elements.clearCacheButton.disabled = true;
  clearMetadataCache();
  setStatus("Metadata cache cleared. Reloading book data...");

  try {
    await bootstrap();
  } finally {
    elements.clearCacheButton.disabled = false;
  }
});

window.addEventListener("pageshow", resetActiveCardFocus);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    resetActiveCardFocus();
  }
});

function safeReadCache(cacheKey) {
  try {
    const cached = localStorage.getItem(cacheKey);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.warn("Could not read cached metadata", error);
    return null;
  }
}

function buildVolumesUrl(query) {
  const url = new URL(GOOGLE_BOOKS_BASE);
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "3");

  if (GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", GOOGLE_BOOKS_API_KEY);
  }

  return url.toString();
}

function getBlackLibraryOverride(book) {
  return BLACK_LIBRARY_OVERRIDES.find((entry) =>
    normalize(entry.title) === normalize(book.title) &&
    normalize(entry.author) === normalize(book.author)
  ) || null;
}

function mergeBookMetadata(book, primary, secondary) {
  if (!secondary) {
    return { ...book, ...primary };
  }

  const fallbackDescription = `${book.title} by ${book.author}.`;
  return {
    ...book,
    ...secondary,
    ...primary,
    description: pickMetadataValue(primary.description, secondary.description, fallbackDescription),
    publishedDate: pickMetadataValue(primary.publishedDate, secondary.publishedDate, ""),
    categories: primary.categories?.length ? primary.categories : (secondary.categories || []),
    pageCount: pickMetadataValue(primary.pageCount, secondary.pageCount, ""),
    publisher: pickMetadataValue(primary.publisher, secondary.publisher, ""),
    infoLink: pickMetadataValue(primary.infoLink, secondary.infoLink, ""),
    previewLink: pickMetadataValue(primary.previewLink, secondary.previewLink, ""),
    cover: pickMetadataValue(primary.cover, secondary.cover, ""),
    blackLibraryLink: pickMetadataValue(primary.blackLibraryLink, secondary.blackLibraryLink, ""),
    blackLibraryLabel: pickMetadataValue(primary.blackLibraryLabel, secondary.blackLibraryLabel, ""),
    metadataStatus: primary.metadataStatus === "loaded" ? "loaded" : secondary.metadataStatus,
  };
}

function pickMetadataValue(primary, secondary, emptyValue) {
  if (primary !== undefined && primary !== null && primary !== emptyValue) {
    return primary;
  }

  if (secondary !== undefined && secondary !== null && secondary !== emptyValue) {
    return secondary;
  }

  return emptyValue;
}

function clearMetadataCache() {
  const keysToRemove = [];

  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

function resetActiveCardFocus() {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement)) {
    return;
  }

  if (activeElement.classList.contains("book-card")) {
    activeElement.blur();
    return;
  }

  if (activeElement.closest(".book-card")) {
    activeElement.blur();
  }
}
