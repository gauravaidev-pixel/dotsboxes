/**
 * MusicEngine — background music for local games against the computer.
 *
 * Plays the bundled track `static/audio/lofi_night_loop.mp3`
 * on a loop through a single HTMLAudioElement, with a short fade in and
 * fade out so starting/stopping never clicks. The public API is the same
 * as before (play / stop / isPlaying), so nothing in main.js has to change.
 *
 * Usage: MusicEngine.play() / MusicEngine.stop() / MusicEngine.isPlaying()
 */
window.MusicEngine = (function () {
  const TRACK_URL = '/static/audio/lofi_night_loop.mp3';
  const TARGET_VOLUME = 0.55;
  const FADE_IN_MS = 1200;
  const FADE_OUT_MS = 600;
  const FADE_STEP_MS = 40;

  let audio = null;
  let playing = false;
  let fadeTimer = null;

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio(TRACK_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    // If the element errors (file missing, decode failure) just drop the
    // playing flag so the button label can fall back to "Play Music".
    audio.addEventListener('error', () => { playing = false; });
    return audio;
  }

  function clearFade() {
    if (fadeTimer) { clearInterval(fadeTimer); fadeTimer = null; }
  }

  function fadeTo(target, durationMs) {
    clearFade();
    const start = audio.volume;
    const steps = Math.max(1, Math.round(durationMs / FADE_STEP_MS));
    let step = 0;
    fadeTimer = setInterval(() => {
      step++;
      const t = Math.min(1, step / steps);
      audio.volume = Math.max(0, Math.min(1, start + (target - start) * t));
      if (t >= 1) clearFade();
    }, FADE_STEP_MS);
  }

  function play() {
    const el = ensureAudio();
    if (playing) return;
    playing = true;
    el.currentTime = 0;
    el.volume = 0;
    const started = el.play();
    if (started && typeof started.catch === 'function') {
      // Autoplay policy: the button click satisfies the gesture, but if the
      // browser still refuses, keep our state honest.
      started.catch(() => { playing = false; });
    }
    fadeTo(TARGET_VOLUME, FADE_IN_MS);
  }

  function stop() {
    if (!playing) return;
    playing = false;
    if (!audio) return;
    fadeTo(0, FADE_OUT_MS);
    setTimeout(() => {
      if (playing) return;      // play() was called again during the fade
      audio.pause();
      audio.currentTime = 0;
    }, FADE_OUT_MS + 60);
  }

  function isPlaying() {
    return playing;
  }

  return { play, stop, isPlaying };
})();
