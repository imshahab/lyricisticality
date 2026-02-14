const FALLBACK_COVER = "assets/images/default-cover.svg";
const COVER_STORAGE_KEY = "coverArtUrl";

const imgEl = document.querySelector("#album-art");
const bgBlurEl = document.querySelector("#bg-blur");
const trackNameEl = document.querySelector(".track-name");
const trackArtistEl = document.querySelector(".track-artist");
const lyricsEl = document.querySelector(".lyrics");
const saveImageBtn = document.querySelector("#save-image-btn");
const statusEl = document.querySelector("#card-status");
const captureRoot = document.querySelector("#capture-root");
const loadingOverlayEl = document.querySelector("#page-loading");
const loadingPillEl = loadingOverlayEl?.querySelector(".loading-pill") || null;
const pageContentEl = document.querySelector("#card-page-content");

init();

function setStatus(message) {
  statusEl.textContent = message;
}

function setStatusLoading(isLoading) {
  statusEl.classList.toggle("loading", isLoading);
}

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

function showLoadingOverlay(message, isDownloading = false) {
  if (!loadingOverlayEl) {
    return;
  }

  loadingOverlayEl.hidden = false;
  loadingOverlayEl.classList.toggle("is-downloading", isDownloading);

  if (loadingPillEl && typeof message === "string" && message.trim()) {
    loadingPillEl.textContent = message;
  }
}

function hideLoadingOverlay() {
  if (!loadingOverlayEl) {
    return;
  }

  loadingOverlayEl.classList.remove("is-downloading");
  loadingOverlayEl.hidden = true;

  if (loadingPillEl) {
    loadingPillEl.textContent = "Loading lyric card...";
  }
}

function setCaptureBlurVisible(isVisible) {
  if (!bgBlurEl) {
    return;
  }

  bgBlurEl.style.display = isVisible ? "block" : "none";
}

function waitForNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
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
    setStatus("No song selected. Redirecting to search.");
    setStatusLoading(false);
    saveImageBtn.disabled = true;
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
    setStatus("No lyrics selected. Redirecting to selection.");
    setStatusLoading(false);
    saveImageBtn.disabled = true;
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

  setStatusLoading(true);
  setStatus("Loading artwork...");

  const coverArtUrl = await resolveCoverArt(trackName, artistName);
  imgEl.src = coverArtUrl;
  bgBlurEl.style.backgroundImage = `url(${coverArtUrl})`;
  document.documentElement.style.setProperty(
    "--cover-art-url",
    `url("${coverArtUrl}")`,
  );

  await waitForAssets();
  showPage();
  setStatusLoading(false);
  setStatus("Ready to save.");

  saveImageBtn.addEventListener("click", () =>
    saveCardImage(trackName, artistName),
  );
}

async function saveCardImage(trackName, artistName) {
  if (!window.htmlToImage || typeof window.htmlToImage.toPng !== "function") {
    setStatusLoading(false);
    setStatus("Image export library failed to load. Refresh and try again.");
    return;
  }

  saveImageBtn.disabled = true;
  saveImageBtn.classList.add("loading");
  saveImageBtn.textContent = "Preparing";
  setStatusLoading(true);
  setStatus("Preparing image...");
  showLoadingOverlay("Downloading image...", true);

  try {
    setCaptureBlurVisible(true);
    await waitForNextFrame();
    await waitForAssets();

    const dataUrl = await window.htmlToImage.toPng(captureRoot, {
      cacheBust: true,
      pixelRatio: Math.max(2, window.devicePixelRatio || 2),
    });

    const blob = await (await fetch(dataUrl)).blob();
    const safeTrack = trackName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const safeArtist = artistName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const fileName = `${safeTrack || "track"}-${safeArtist || "artist"}.png`;

    downloadBlob(blob, fileName, dataUrl);
    setStatusLoading(false);
    setStatus("Image saved.");
  } catch {
    setStatusLoading(false);
    setStatus("Could not save image on this browser.");
  } finally {
    setCaptureBlurVisible(false);
    hideLoadingOverlay();
    saveImageBtn.disabled = false;
    saveImageBtn.classList.remove("loading");
    saveImageBtn.textContent = "Save image";
  }
}

function downloadBlob(blob, fileName, dataUrl) {
  const link = document.createElement("a");
  const blobUrl = URL.createObjectURL(blob);
  link.href = blobUrl;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(blobUrl);

  if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
    window.open(dataUrl, "_blank");
  }
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
