<img src="assets/images/logo.png">

This is a little web app I threw together because I wanted to share songs on Telegram (now that stories are free, finally!).

You search for a song, pick your favorite lyric lines, and it spits out a lyric card image you can post anywhere. It’s nothing fancy, but it works!

## Screenshots

<div style="display: flex; gap: 12px;">
	<img src="assets/screenshots/breaking-the-habit.png" alt="Breaking The Habit - Linkin Park" width="220"/>
	<img src="assets/screenshots/infohazard.png" alt="Infohazard - ninajirachi" width="220"/>
	<img src="assets/screenshots/move-on.png" alt="Move On - Mike Posner" width="220"/>
</div>

## Some notes (aka excuses)

- I used two APIs for this (LRCLIB for lyrics, iTunes for artwork). Is it the best approach? Nope. But they were free, and this whole thing is a poor man’s solution. 😄
- This app also uses [html2canvas](https://html2canvas.hertzen.com/) to generate lyric card images from HTML elements.
- Safari on iOS doesn't support `CanvasRenderingContext2D.filter`, so the blurred background in the exported card would just... not blur. I used [context-filter-polyfill](https://github.com/davidenke/context-filter-polyfill) to fix that.

## Thanks

Shoutout to Claude Opus 4.6 and GPT-5.3 Codex for helping me build this thing. Couldn't have done it without you two. 🤖💖
