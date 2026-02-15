const FALLBACK_COVER = 'assets/images/default-cover.svg';
const COVER_STORAGE_KEY = 'coverArtUrl';

const imgEl = document.querySelector('#album-art');
const trackNameEl = document.querySelector('.track-name');
const trackArtistEl = document.querySelector('.track-artist');
const lyricsEl = document.querySelector('.lyrics');
const loadingOverlayEl = document.querySelector('#page-loading');
const loadingPillEl = loadingOverlayEl?.querySelector('.loading-pill') || null;
const pageContentEl = document.querySelector('#card-page-content');
const cardEl = document.querySelector('.card');
const downloadCardBtn = document.querySelector('#download-card');
const backCardBtn = document.querySelector('#back-card');

const PHONE_EXPORT_WIDTH = 390;
const PHONE_EXPORT_HEIGHT = 844;
const PHONE_EXPORT_SCALE = 3;

init();
bindDownload();
bindBack();

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
	pageContentEl.classList.remove('is-hidden');
}

function showLoadingOverlay(message) {
	if (!loadingOverlayEl) {
		return;
	}

	loadingOverlayEl.hidden = false;

	if (loadingPillEl && typeof message === 'string' && message.trim()) {
		loadingPillEl.textContent = message;
	}
}

function hideLoadingOverlay() {
	if (!loadingOverlayEl) {
		return;
	}

	loadingOverlayEl.hidden = true;

	if (loadingPillEl) {
		loadingPillEl.textContent = 'Loading lyric card...';
	}
}

function bindDownload() {
	if (!downloadCardBtn) {
		return;
	}

	downloadCardBtn.addEventListener('click', handleDownloadCard);
}

function setDownloadButtonLoading(isLoading) {
	if (!downloadCardBtn) {
		return;
	}

	downloadCardBtn.disabled = isLoading;
	downloadCardBtn.classList.toggle('loading', isLoading);
	downloadCardBtn.textContent = isLoading
		? 'Preparing image'
		: 'Download image';
}

function bindBack() {
	if (!backCardBtn) {
		return;
	}

	backCardBtn.addEventListener('click', () => {
		window.location.href = 'lyrics-selection.html';
	});
}

async function waitForImagesInNode(root) {
	const imageElements = Array.from(root.querySelectorAll('img'));

	await Promise.all(
		imageElements.map((imageElement) => {
			if (imageElement.complete && imageElement.naturalWidth > 0) {
				return Promise.resolve();
			}

			return new Promise((resolve) => {
				imageElement.addEventListener('load', resolve, { once: true });
				imageElement.addEventListener('error', resolve, { once: true });
			});
		}),
	);
}

function drawImageCover(ctx, image, targetWidth, targetHeight, overscan = 1) {
	const imageRatio = image.naturalWidth / image.naturalHeight;
	const targetRatio = targetWidth / targetHeight;

	let drawWidth;
	let drawHeight;

	if (imageRatio > targetRatio) {
		drawHeight = targetHeight * overscan;
		drawWidth = drawHeight * imageRatio;
	} else {
		drawWidth = targetWidth * overscan;
		drawHeight = drawWidth / imageRatio;
	}

	const drawX = (targetWidth - drawWidth) / 2;
	const drawY = (targetHeight - drawHeight) / 2;
	ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function loadImageElement(src) {
	return new Promise((resolve, reject) => {
		const probe = new Image();
		probe.crossOrigin = 'anonymous';
		probe.onload = () => resolve(probe);
		probe.onerror = () => reject(new Error('Image failed to load'));
		probe.src = src;
	});
}

async function generateBlurredBackgroundDataUrl(sourceUrl, width, height) {
	const image = await loadImageElement(sourceUrl);
	const multiplier = 2;
	const canvas = document.createElement('canvas');
	canvas.width = width * multiplier;
	canvas.height = height * multiplier;

	const ctx = canvas.getContext('2d');
	if (!ctx) {
		throw new Error('Canvas context unavailable');
	}

	ctx.filter = `blur(${36 * multiplier}px) saturate(1.3)`;
	drawImageCover(ctx, image, canvas.width, canvas.height, 1.14);
	ctx.filter = 'none';

	return canvas.toDataURL('image/png');
}

async function createPreparedExportStage() {
	const stage = document.createElement('div');
	stage.className = 'export-stage';

	const frame = document.createElement('div');
	frame.className = 'export-phone-frame';
	frame.style.width = `${PHONE_EXPORT_WIDTH}px`;
	frame.style.height = `${PHONE_EXPORT_HEIGHT}px`;

	const bgLayer = document.createElement('div');
	bgLayer.className = 'export-phone-bg';

	const overlayLayer = document.createElement('div');
	overlayLayer.className = 'export-phone-overlay';

	const cardClone = cardEl.cloneNode(true);
	const albumArtClone = cardClone.querySelector('#album-art');
	if (albumArtClone) {
		albumArtClone.removeAttribute('id');
	}

	frame.append(bgLayer, overlayLayer, cardClone);
	stage.appendChild(frame);
	document.body.appendChild(stage);

	try {
		const sourceUrl = imgEl.currentSrc || imgEl.src || FALLBACK_COVER;
		const blurredDataUrl = await generateBlurredBackgroundDataUrl(
			sourceUrl,
			PHONE_EXPORT_WIDTH,
			PHONE_EXPORT_HEIGHT,
		);

		bgLayer.style.backgroundImage = `url("${blurredDataUrl}")`;
		bgLayer.classList.add('is-preblurred');
	} catch {}

	return stage;
}

function downloadCanvas(canvas, filename) {
	const link = document.createElement('a');
	link.href = canvas.toDataURL('image/png');
	link.download = filename;
	link.click();
}

async function handleDownloadCard() {
	if (!cardEl || typeof window.html2canvas !== 'function') {
		return;
	}

	setDownloadButtonLoading(true);
	showLoadingOverlay('Preparing your image...');

	let exportStage;

	try {
		await waitForAssets();

		exportStage = await createPreparedExportStage();
		await waitForImagesInNode(exportStage);

		const exportCanvas = await window.html2canvas(
			exportStage.firstElementChild,
			{
				backgroundColor: null,
				useCORS: true,
				allowTaint: false,
				scale: PHONE_EXPORT_SCALE,
				width: PHONE_EXPORT_WIDTH,
				height: PHONE_EXPORT_HEIGHT,
			},
		);

		const safeTrackName = (trackNameEl.textContent || 'lyric-card')
			.trim()
			.replace(/[^a-z0-9\-\s]/gi, '')
			.replace(/\s+/g, '-')
			.toLowerCase();

		downloadCanvas(exportCanvas, `${safeTrackName || 'lyric-card'}.png`);
	} catch {
	} finally {
		if (exportStage) {
			exportStage.remove();
		}

		hideLoadingOverlay();
		setDownloadButtonLoading(false);
	}
}

async function fetchJsonWithTimeout(url, timeoutMs = 7000) {
	const controller = new AbortController();
	const timerId = setTimeout(() => controller.abort(), timeoutMs);

	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			throw new Error('Request failed');
		}
		return await response.json();
	} finally {
		clearTimeout(timerId);
	}
}

function loadImage(src) {
	return new Promise((resolve, reject) => {
		if (!src) {
			reject(new Error('Missing image source'));
			return;
		}

		const probe = new Image();
		probe.crossOrigin = 'anonymous';
		probe.onload = () => resolve(src);
		probe.onerror = () => reject(new Error('Image failed to load'));
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

	return '';
}

async function resolveCoverArt(trackName, artistName) {
	const prefetchedUrl = localStorage.getItem(COVER_STORAGE_KEY) || '';
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
	const songInfo = parseJsonStorage('songInfo', null);
	const selectedLyrics = parseJsonStorage('selectedLyrics', []);

	if (
		!songInfo ||
		typeof songInfo.trackName !== 'string' ||
		typeof songInfo.artistName !== 'string'
	) {
		showPage();
		setTimeout(() => {
			window.location.href = 'index.html';
		}, 900);
		return;
	}

	const trackName = songInfo.trackName || 'Unknown Track';
	const artistName = songInfo.artistName || 'Unknown Artist';

	const lyricLines = (Array.isArray(selectedLyrics) ? selectedLyrics : [])
		.filter((line) => typeof line === 'string')
		.map((line) => line.trim())
		.filter(Boolean);

	if (lyricLines.length === 0) {
		showPage();
		setTimeout(() => {
			window.location.href = 'lyrics-selection.html';
		}, 900);
		return;
	}

	trackNameEl.textContent = trackName;
	trackArtistEl.textContent = artistName;

	const fragment = document.createDocumentFragment();
	lyricLines.forEach((line) => {
		const p = document.createElement('p');
		p.textContent = line;
		fragment.appendChild(p);
	});
	lyricsEl.appendChild(fragment);

	showLoadingOverlay('Loading artwork...');

	const coverArtUrl = await resolveCoverArt(trackName, artistName);
	imgEl.src = coverArtUrl;
	document.documentElement.style.setProperty(
		'--cover-art-url',
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
		imgEl.addEventListener('load', resolve, { once: true });
		imgEl.addEventListener('error', resolve, { once: true });
	});
}
