const resultsEl = document.getElementById('results');
const searchEl = document.getElementById('search');
const statusEl = document.getElementById('search-status');

let debounceId = null;
let controller = null;
let currentResults = [];

function setStatus(message) {
	statusEl.textContent = message;
}

function setStatusLoading(isLoading) {
	statusEl.classList.toggle('loading', isLoading);
}

function clearResults() {
	currentResults = [];
	resultsEl.replaceChildren();
}

function createResultButton(item, index) {
	const button = document.createElement('button');
	button.type = 'button';
	button.className = 'result-item';
	button.dataset.index = String(index);
	button.setAttribute('role', 'listitem');
	button.textContent = `${item.trackName || 'Unknown Track'} - ${item.artistName || 'Unknown Artist'}`;
	return button;
}

async function runSearch(term) {
	if (controller) {
		controller.abort();
	}

	controller = new AbortController();
	setStatusLoading(true);
	setStatus('Searching...');

	try {
		const response = await fetch(
			`https://lrclib.net/api/search?q=${encodeURIComponent(term)}`,
			{
				signal: controller.signal,
			},
		);

		if (!response.ok) {
			throw new Error('Search request failed');
		}

		const data = await response.json();
		const validResults = (Array.isArray(data) ? data : [])
			.filter(
				(item) =>
					item &&
					item.instrumental === false &&
					typeof item.plainLyrics === 'string' &&
					item.plainLyrics.trim(),
			)
			.slice(0, 5);

		clearResults();

		if (validResults.length === 0) {
			setStatusLoading(false);
			setStatus('No results found.');
			return;
		}

		currentResults = validResults;
		const fragment = document.createDocumentFragment();
		validResults.forEach((item, index) => {
			fragment.appendChild(createResultButton(item, index));
		});
		resultsEl.appendChild(fragment);
		setStatusLoading(false);
		setStatus('');
	} catch (error) {
		if (error.name !== 'AbortError') {
			clearResults();
			setStatusLoading(false);
			setStatus('Something went wrong. Try again.');
		}
	}
}

searchEl.addEventListener('input', (event) => {
	const term = event.target.value.trim();
	clearTimeout(debounceId);

	if (term.length < 2) {
		setStatusLoading(false);
		clearResults();
		setStatus(term.length === 0 ? '' : 'Type at least 2 characters.');
		return;
	}

	debounceId = setTimeout(() => {
		runSearch(term);
	}, 300);
});

resultsEl.addEventListener('click', (event) => {
	const button = event.target.closest('.result-item');
	if (!button) {
		return;
	}

	const selectedIndex = Number.parseInt(button.dataset.index || '-1', 10);
	const selected = currentResults[selectedIndex];

	if (!selected) {
		setStatus('Could not load that selection. Please search again.');
		return;
	}

	const payload = {
		lyrics: selected.plainLyrics,
		trackName: selected.trackName || 'Unknown Track',
		artistName: selected.artistName || 'Unknown Artist',
	};

	localStorage.setItem('songInfo', JSON.stringify(payload));
	window.location.href = 'lyrics-selection.html';
});

setStatus('');
setStatusLoading(false);
