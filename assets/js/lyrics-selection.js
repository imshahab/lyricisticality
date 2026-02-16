const maxSelection = 5;
const lyricSelectEl = document.getElementById("lyric-select");
const generateBtn = document.getElementById("generate");
const songMetaEl = document.getElementById("song-meta");
const statusEl = document.getElementById("selection-status");
const errorEl = document.getElementById("selection-error");
const backSelectionBtn = document.getElementById("back-selection");
const COVER_STORAGE_KEY = "coverArtUrl";
let checkboxes = [];

if (backSelectionBtn) {
  backSelectionBtn.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

function setStatus(message) {
  statusEl.textContent = message;
}

function setStatusLoading(isLoading) {
  statusEl.classList.toggle("loading", isLoading);
}

function setError(message) {
  errorEl.hidden = !message;
  errorEl.textContent = message;
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

async function getCoverArtUrl(trackName, artistName) {
  const data = await fetchJsonWithTimeout(
    `https://itunes.apple.com/search?term=${encodeURIComponent(`${trackName} ${artistName}`)}&entity=song&limit=1`,
  );

  if (data && Array.isArray(data.results) && data.results[0]?.artworkUrl100) {
    return data.results[0].artworkUrl100;
  }

  return "";
}

function getSongInfo() {
  const raw = localStorage.getItem("songInfo");
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.lyrics !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

const songInfo = getSongInfo();

if (!songInfo) {
  setError("No selected song found. Redirecting to search.");
  setStatusLoading(false);
  generateBtn.disabled = true;
  setTimeout(() => {
    window.location.href = "index.html";
  }, 900);
} else {
  songMetaEl.textContent = `${songInfo.trackName || "Unknown Track"} — ${songInfo.artistName || "Unknown Artist"}`;

  const lyrics = songInfo.lyrics
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const fragment = document.createDocumentFragment();

  lyrics.forEach((line, index) => {
    const row = document.createElement("label");
    row.className = "lyric-option";
    row.htmlFor = `line-${index}`;

    const input = document.createElement("input");
    input.type = "checkbox";
    input.className = "lyric-line";
    input.id = `line-${index}`;
    input.name = `line-${index}`;
    input.value = line;

    const text = document.createElement("span");
    text.className = "lyric-text";
    text.textContent = line;

    row.appendChild(input);
    row.appendChild(text);
    fragment.appendChild(row);
  });

  lyricSelectEl.appendChild(fragment);

  checkboxes = Array.from(lyricSelectEl.querySelectorAll(".lyric-line"));

  function updateSelectionLimit() {
    const selectedCount = checkboxes.filter(
      (checkbox) => checkbox.checked,
    ).length;

    if (selectedCount >= maxSelection) {
      checkboxes.forEach((checkbox) => {
        if (!checkbox.checked) {
          checkbox.disabled = true;
        }
      });
    } else {
      checkboxes.forEach((checkbox) => {
        checkbox.disabled = false;
      });
    }

    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest(".lyric-option");
      if (!row) {
        return;
      }

      row.classList.toggle("is-selected", checkbox.checked);
      row.classList.toggle(
        "is-disabled",
        checkbox.disabled && !checkbox.checked,
      );
    });

    setStatus(`Selected ${selectedCount}/${maxSelection} lines.`);
  }

  checkboxes.forEach((checkbox) => {
    checkbox.addEventListener("change", updateSelectionLimit);
  });

  generateBtn.addEventListener("click", async () => {
    const selectedLyrics = checkboxes
      .filter((checkbox) => checkbox.checked)
      .map((checkbox) => checkbox.value);

    if (selectedLyrics.length === 0) {
      setError("Please select at least one lyric line.");
      return;
    }

    setError("");
    generateBtn.disabled = true;
    generateBtn.classList.add("loading");
    setStatusLoading(true);
    setStatus("Preparing lyric card...");

    localStorage.setItem("selectedLyrics", JSON.stringify(selectedLyrics));

    const trackName = songInfo.trackName || "Unknown Track";
    const artistName = songInfo.artistName || "Unknown Artist";

    try {
      const coverArtUrl = await getCoverArtUrl(trackName, artistName);
      if (coverArtUrl) {
        localStorage.setItem(COVER_STORAGE_KEY, coverArtUrl);
      } else {
        localStorage.removeItem(COVER_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(COVER_STORAGE_KEY);
    }

    window.location.href = "lyric-card.html";
  });

  updateSelectionLimit();
}
