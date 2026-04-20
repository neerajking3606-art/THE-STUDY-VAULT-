const video = document.getElementById('videoEl');
const dropOverlay = document.getElementById('dropOverlay');
const seekBar = document.getElementById('seekBar');
const seekFill = document.getElementById('seekFill');
const timeCurrent = document.getElementById('timeCurrent');
const timeDuration = document.getElementById('timeDuration');
const btnPlay = document.getElementById('btnPlay');
const playIcon = document.getElementById('playIcon');
const btnStop = document.getElementById('btnStop');
const btnMute = document.getElementById('btnMute');
const volIcon = document.getElementById('volIcon');
const volBar = document.getElementById('volBar');
const volFill = document.getElementById('volFill');
const btnSkipBack = document.getElementById('btnSkipBack');
const btnSkipFwd = document.getElementById('btnSkipFwd');
const btnLoop = document.getElementById('btnLoop');
const btnFs = document.getElementById('btnFs');
const btnOpen = document.getElementById('btnOpen');
const fileInput = document.getElementById('fileInput');
const speedSelect = document.getElementById('speedSelect');
const titleFile = document.getElementById('titleFile');
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const resInfo = document.getElementById('resInfo');
const loopInfo = document.getElementById('loopInfo');
const playerWrap = document.getElementById('playerWrap');

const messageOverlay = document.getElementById('messageOverlay');
const loader = document.getElementById('loader');
const errorBox = document.getElementById('errorBox');
const errorMsg = document.getElementById('errorMsg');
const errorDetail = document.getElementById('errorDetail');
const retryBtn = document.getElementById('retryBtn');

// Inline URL bar
const urlBarInput = document.getElementById('urlBarInput');
const urlBarGo = document.getElementById('urlBarGo');
const urlBarClear = document.getElementById('urlBarClear');

// URL Modal
const urlModal = document.getElementById('urlModal');
const urlInput = document.getElementById('urlInput');
const btnUrl = document.getElementById('btnUrl');
const urlCancel = document.getElementById('urlCancel');
const urlOk = document.getElementById('urlOk');

let hlsInstance = null;
let currentLoadedUrl = "";

// Icons
const PLAY_PATH = 'M8 5v14l11-7z';
const PAUSE_PATH = 'M6 19h4V5H6v14zm8-14v14h4V5h-4z';
const VOL_ON = 'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z';
const VOL_OFF = 'M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z';

function fmt(s) {
  s = Math.floor(s || 0);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return `${h > 0 ? h + ':' : ''}${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
}

function showLoader() {
    messageOverlay.classList.remove('hidden');
    loader.classList.remove('hidden');
    errorBox.classList.add('hidden');
}

function hideLoader() {
    messageOverlay.classList.add('hidden');
    loader.classList.add('hidden');
}

function handlePlaybackError(msg, detailCode) {
    hideLoader();
    messageOverlay.classList.remove('hidden');
    errorBox.classList.remove('hidden');
    errorMsg.textContent = msg;
    errorDetail.textContent = `Error Code: ${detailCode}`;
    
    statusDot.classList.remove('playing');
    statusText.textContent = 'Error';
    playIcon.innerHTML = `<path d="${PLAY_PATH}"/>`;
}

function cleanupPlayer() {
    if (!video.paused && video.readyState >= 2) {
        try { video.pause(); } catch(e){}
    }
    if (hlsInstance) {
        hlsInstance.destroy();
        hlsInstance = null;
    }
    video.removeAttribute('src');
    video.load();
    statusText.textContent = 'Stopped';
    statusDot.classList.remove('playing');
    playIcon.innerHTML = `<path d="${PLAY_PATH}"/>`;
    resInfo.textContent = '—';
}

function loadVideoMedia(url, titleStr) {
    if (!url) return;
    cleanupPlayer();
    showLoader();
    dropOverlay.classList.add('hidden');

    currentLoadedUrl = url;
    titleFile.textContent = titleStr || url.split('/').pop() || url;
    urlBarInput.value = url;
    
    statusText.textContent = 'Buffering...';

    if (url.includes('.m3u8')) {
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            hlsInstance = new Hls({ debug: false, enableWorker: true, maxMaxBufferLength: 30 });
            hlsInstance.loadSource(url);
            hlsInstance.attachMedia(video);
            
            hlsInstance.on(Hls.Events.MANIFEST_PARSED, function () {
                hideLoader();
                video.play().catch(e => console.log('Autoplay blocked:', e));
            });
            
            hlsInstance.on(Hls.Events.ERROR, function (event, data) {
                if (data.fatal) {
                    const code = data.response ? data.response.code : 0;
                    
                    if (code === 403 || code === 401) {
                        cleanupPlayer();
                        handlePlaybackError("Backend stream access denied.", "403");
                        return;
                    } else if (code === 502 || code === 503) {
                        cleanupPlayer();
                        handlePlaybackError("Playback authorization is unavailable for this source.", "502/503");
                        return;
                    } else if (code === 404) {
                        cleanupPlayer();
                        handlePlaybackError("Stream missing or backend route failed.", "404");
                        return;
                    } else if (code >= 500) {
                        cleanupPlayer();
                        handlePlaybackError("Internal Backend Error.", "500+");
                        return;
                    }

                    if (data.details === Hls.ErrorDetails.MANIFEST_LOAD_ERROR || data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                        cleanupPlayer();
                        handlePlaybackError("Backend returned an invalid HLS manifest.", "Manifest Parsing Failed");
                        return;
                    }

                    console.log("[PLAYER DEBUG] Attempting to recover minor network error...");
                    hlsInstance.startLoad();
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', function() {
                video.play().catch(e => console.log('Autoplay blocked', e));
                hideLoader();
            }, { once: true });
            video.addEventListener('error', () => handlePlaybackError("Failed to play HLS.", "Native Error"), { once: true });
        } else {
             cleanupPlayer();
             handlePlaybackError("HLS playback is not supported in this browser.", "Unsupported");
        }
    } else {
        video.src = url;
        video.addEventListener('loadedmetadata', function() {
             video.play().catch(e => console.log('Autoplay blocked', e));
             hideLoader();
        }, { once: true });
        video.addEventListener('error', () => handlePlaybackError("Browser failed to load media.", "Native Support Error"), { once: true });
    }
}

// Params load
function initPlayer() {
    const urlParams = new URLSearchParams(window.location.search);
    const rawUrl = urlParams.get('url') || urlParams.get('videoUrl');
    const titleParam = urlParams.get('title') || '';
    if (rawUrl) {
        loadVideoMedia(rawUrl, titleParam);
    }
}

retryBtn.addEventListener('click', () => {
    if (currentLoadedUrl) {
        loadVideoMedia(currentLoadedUrl, titleFile.textContent);
    }
});

function loadFile(file) {
  if (!file || !file.type.startsWith('video/')) return;
  const url = URL.createObjectURL(file);
  loadVideoMedia(url, file.name);
}

// Drop zone
dropOverlay.addEventListener('click', () => fileInput.click());

playerWrap.addEventListener('dragover', e => { e.preventDefault(); dropOverlay.classList.add('drag-over'); });
playerWrap.addEventListener('dragleave', () => dropOverlay.classList.remove('drag-over'));
playerWrap.addEventListener('drop', e => {
  e.preventDefault();
  dropOverlay.classList.remove('drag-over');
  loadFile(e.dataTransfer.files[0]);
});

// File input
btnOpen.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => loadFile(fileInput.files[0]));

// Play / Pause
btnPlay.addEventListener('click', () => video.paused ? video.play() : video.pause());

video.addEventListener('play', () => {
  playIcon.innerHTML = `<path d="${PAUSE_PATH}"/>`;
  statusDot.classList.add('playing');
  statusText.textContent = 'Playing';
});

video.addEventListener('pause', () => {
  playIcon.innerHTML = `<path d="${PLAY_PATH}"/>`;
  statusDot.classList.remove('playing');
  statusText.textContent = 'Paused';
});

video.addEventListener('ended', () => {
  statusDot.classList.remove('playing');
  statusText.textContent = 'Ended';
});

video.addEventListener('waiting', () => {
  statusText.textContent = 'Buffering...';
});
video.addEventListener('playing', () => {
  statusText.textContent = 'Playing';
  hideLoader();
});

// Stop
btnStop.addEventListener('click', () => {
  cleanupPlayer();
});

// Seek
video.addEventListener('timeupdate', () => {
  if (!video.duration || isNaN(video.duration)) return;
  const pct = video.currentTime / video.duration;
  seekFill.style.width = (pct * 100) + '%';
  seekBar.value = Math.round(pct * 1000);
  timeCurrent.textContent = fmt(video.currentTime);
});

video.addEventListener('loadedmetadata', () => {
  timeDuration.textContent = fmt(video.duration);
  resInfo.textContent = `${video.videoWidth}×${video.videoHeight}`;
});

seekBar.addEventListener('input', () => {
  if (video.duration) video.currentTime = (seekBar.value / 1000) * video.duration;
});

// Volume
volBar.addEventListener('input', () => {
  const v = volBar.value / 100;
  video.volume = v;
  video.muted = v === 0;
  volFill.style.width = volBar.value + '%';
  volIcon.innerHTML = v === 0 ? `<path d="${VOL_OFF}"/>` : `<path d="${VOL_ON}"/>`;
});

btnMute.addEventListener('click', () => {
  video.muted = !video.muted;
  volIcon.innerHTML = video.muted ? `<path d="${VOL_OFF}"/>` : `<path d="${VOL_ON}"/>`;
  volFill.style.width = video.muted ? '0%' : (video.volume * 100) + '%';
});

// Skip
btnSkipBack.addEventListener('click', () => video.currentTime = Math.max(0, video.currentTime - 10));
btnSkipFwd.addEventListener('click', () => video.currentTime = Math.min(video.duration || 0, video.currentTime + 10));

// Loop
let looping = false;
btnLoop.addEventListener('click', () => {
  looping = !looping;
  video.loop = looping;
  btnLoop.classList.toggle('active', looping);
  loopInfo.textContent = looping ? '↻ LOOP ON' : '';
});

// Speed
speedSelect.addEventListener('change', () => video.playbackRate = parseFloat(speedSelect.value));

// Fullscreen
btnFs.addEventListener('click', () => {
  if (!document.fullscreenElement) playerWrap.requestFullscreen();
  else document.exitFullscreen();
});
document.addEventListener('fullscreenchange', () => {
   if(document.fullscreenElement) {
       btnFs.classList.add('active');
   } else {
       btnFs.classList.remove('active');
   }
});

// Inline URL bar
function loadUrlInline() {
  const url = urlBarInput.value.trim();
  if (url) loadVideoMedia(url, url.split('/').pop());
}
urlBarGo.addEventListener('click', loadUrlInline);
urlBarInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadUrlInline(); });
urlBarClear.addEventListener('click', () => { urlBarInput.value = ''; urlBarInput.focus(); });

// URL modal
btnUrl.addEventListener('click', () => {
  urlModal.classList.add('show');
  urlInput.focus();
});
urlCancel.addEventListener('click', () => urlModal.classList.remove('show'));
urlModal.addEventListener('click', e => { if (e.target === urlModal) urlModal.classList.remove('show'); });

function loadUrl() {
  const url = urlInput.value.trim();
  if (url) {
      loadVideoMedia(url, url.split('/').pop());
      urlModal.classList.remove('show');
      urlInput.value = '';
  }
}
urlOk.addEventListener('click', loadUrl);
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadUrl(); });

// Keyboard shortcuts
document.addEventListener('keydown', e => {
  if (['INPUT','SELECT','TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); video.paused ? video.play() : video.pause(); }
  if (e.code === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 5);
  if (e.code === 'ArrowRight') video.currentTime = Math.min(video.duration||0, video.currentTime + 5);
  if (e.code === 'ArrowUp') { volBar.value = Math.min(100, +volBar.value + 5); volBar.dispatchEvent(new Event('input')); }
  if (e.code === 'ArrowDown') { volBar.value = Math.max(0, +volBar.value - 5); volBar.dispatchEvent(new Event('input')); }
  if (e.code === 'KeyF') btnFs.click();
  if (e.code === 'KeyM') btnMute.click();
});

initPlayer();
