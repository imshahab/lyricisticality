const FALLBACK_COVER = "assets/images/default-cover.svg";
const COVER_STORAGE_KEY = "coverArtUrl";

const imgEl = document.querySelector("#album-art");
const trackNameEl = document.querySelector(".track-name");
const trackArtistEl = document.querySelector(".track-artist");
const lyricsEl = document.querySelector(".lyrics");
const loadingOverlayEl = document.querySelector("#page-loading");
const loadingPillEl = loadingOverlayEl?.querySelector(".loading-pill") || null;
const pageContentEl = document.querySelector("#card-page-content");

init();

function parseJsonStorage(key, fallbackValue) {
  const raw = localStorage.getItem(key);
  if (!raw) {
    return fallbackValue;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return fallbackValue;
  }
}

function showPage() {
  if (loadingOverlayEl) {
    loadingOverlayEl.hidden = true;
  }
  pageContentEl.classList.remove("is-hidden");
}

function showLoadingOverlay(message) {
  if (!loadingOverlayEl) {
    return;
  }

  loadingOverlayEl.hidden = false;

  if (loadingPillEl && typeof message === "string" && message.trim()) {
    loadingPillEl.textContent = message;
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlayEl) {
    return;
  }

  loadingOverlayEl.hidden = true;

  if (loadingPillEl) {
    loadingPillEl.textContent = "Loading lyric card...";
  }
}

async function fetchJsonWithTimeout(url, timeoutMs = 7000) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error("Request failed");
    }
    return await response.json();
  } finally {
    clearTimeout(timerId);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    if (!src) {
      reject(new Error("Missing image source"));
      return;
    }

    const probe = new Image();
    probe.crossOrigin = "anonymous";
    probe.onload = () => resolve(src);
    probe.onerror = () => reject(new Error("Image failed to load"));
    probe.src = src;
  });
}

async function getCoverArtUrl(trackName, artistName) {
  const data = await fetchJsonWithTimeout(
    `https://itunes.apple.com/search?term=${encodeURIComponent(`${trackName} ${artistName}`)}&entity=song&limit=1`,
  );

  if (data && Array.isArray(data.results) && data.results[0]?.artworkUrl100) {
    return data.results[0].artworkUrl100;
  }

  return "";
}

async function resolveCoverArt(trackName, artistName) {
  const prefetchedUrl = localStorage.getItem(COVER_STORAGE_KEY) || "";
  if (prefetchedUrl) {
    try {
      await loadImage(prefetchedUrl);
      return prefetchedUrl;
    } catch {
      localStorage.removeItem(COVER_STORAGE_KEY);
    }
  }

  try {
    const fetchedUrl = await getCoverArtUrl(trackName, artistName);
    if (!fetchedUrl) {
      return FALLBACK_COVER;
    }

    await loadImage(fetchedUrl);
    localStorage.setItem(COVER_STORAGE_KEY, fetchedUrl);
    return fetchedUrl;
  } catch {
    return FALLBACK_COVER;
  }
}

async function init() {
  const songInfo = parseJsonStorage("songInfo", null);
  const selectedLyrics = parseJsonStorage("selectedLyrics", []);

  if (
    !songInfo ||
    typeof songInfo.trackName !== "string" ||
    typeof songInfo.artistName !== "string"
  ) {
    showPage();
    setTimeout(() => {
      window.location.href = "index.html";
    }, 900);
    return;
  }

  const trackName = songInfo.trackName || "Unknown Track";
  const artistName = songInfo.artistName || "Unknown Artist";

  const lyricLines = (Array.isArray(selectedLyrics) ? selectedLyrics : [])
    .filter((line) => typeof line === "string")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lyricLines.length === 0) {
    showPage();
    setTimeout(() => {
      window.location.href = "lyrics-selection.html";
    }, 900);
    return;
  }

  trackNameEl.textContent = trackName;
  trackArtistEl.textContent = artistName;

  const fragment = document.createDocumentFragment();
  lyricLines.forEach((line) => {
    const p = document.createElement("p");
    p.textContent = line;
    fragment.appendChild(p);
  });
  lyricsEl.appendChild(fragment);

  showLoadingOverlay("Loading artwork...");

  const coverArtUrl = await resolveCoverArt(trackName, artistName);
  imgEl.src = coverArtUrl;
  document.documentElement.style.setProperty(
    "--cover-art-url",
    `url("${coverArtUrl}")`,
  );

  await waitForAssets();
  hideLoadingOverlay();
  showPage();
}

async function waitForAssets() {
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  if (imgEl.complete && imgEl.naturalWidth > 0) {
    return;
  }

  await new Promise((resolve) => {
    imgEl.addEventListener("load", resolve, { once: true });
    imgEl.addEventListener("error", resolve, { once: true });
  });
}
