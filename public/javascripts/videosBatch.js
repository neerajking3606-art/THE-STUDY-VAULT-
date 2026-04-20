function extractVideoId(url) {
    if (!url) return '';
    try {
        // 1. Look for typical MongoDB ObjectId (24 hex characters)
        const hexMatch = url.match(/[0-9a-f]{24}/i);
        if (hexMatch) return hexMatch[0];
        
        // 2. Look for standard UUIDs
        const uuidMatch = url.match(/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/);
        if (uuidMatch) return uuidMatch[0];

        // 3. Look at path segments right before /master.mpd or /hls/
        try {
            const urlObj = new URL(url);
            const pathParts = urlObj.pathname.split('/').filter(p => p.length > 0);
            for (let i = 0; i < pathParts.length; i++) {
                if (pathParts[i] === 'master.mpd' || pathParts[i] === 'hls' || pathParts[i] === 'master.m3u8') {
                    if (i > 0) return pathParts[i - 1];
                }
            }
        } catch (err) {} // Ignore if it's not a parsable full URL

        // 4. Fallback to /video/ or /download/ generic splits
        const parts = url.split('/');
        for (let i = 0; i < parts.length; i++) {
            if ((parts[i] === 'video' || parts[i] === 'download') && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        return '';
    } catch (e) {
        return '';
    }
}

function sendVideoUrl(videoUrlRaw, title = '') {
    console.log("RAW videoUrlRaw =", videoUrlRaw);

    let childId = extractVideoId(videoUrlRaw);
    console.log("EXTRACTED childId =", childId);

    let encodedUrl;
    if (childId) {
        // Base64 encode the raw URL so the backend knows the exact Cloudfront domain
        const b64Src = videoUrlRaw ? btoa(videoUrlRaw) : '';
        encodedUrl = encodeURIComponent(`/download/${childId}/master.m3u8?src=${b64Src}`);
    } else {
        console.warn("Could not extract video ID. Falling back to raw URL.");
        if(!videoUrlRaw) return;
        encodedUrl = encodeURIComponent(videoUrlRaw);
    }

    let encodedTitle = encodeURIComponent(title || "Topic");
    const playerUrl = `/player?url=${encodedUrl}&title=${encodedTitle}`;
    
    console.log("[PLAYER ROUTING] ->", playerUrl);
    window.location.href = playerUrl;
}

function freeVideoUrl(videoUrl) {
    if (videoUrl) {
        window.open(videoUrl, '_blank');
    }
}

function handleVideoClick(element) {
    const videoUrl = element.getAttribute('data-video-url');
    const hasUrl = element.getAttribute('data-has-url') === 'true';
    const title = element.getAttribute('data-title');
    if (hasUrl) {
        sendVideoUrl(videoUrl, title);
    } else {
        freeVideoUrl(videoUrl);
    }
}

function handlePlayButtonClick(event, element) {
    event.stopPropagation();
    const videoUrl = element.getAttribute('data-video-url');
    const title = element.getAttribute('data-title');
    sendVideoUrl(videoUrl, title);
}

function handleDownloadButtonClick(event, element) {
    event.stopPropagation();
    const videoId = element.getAttribute('data-video-id');
    copyDownloadLink(videoId);
}

function downloadPdf(event, url, filename) {
    if(event) event.stopPropagation();
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.target = '_blank';
    anchor.click();
}

function copyDownloadLink(videoId) {
    if(!videoId) {
        showToast('No valid video ID found to copy.');
        return;
    }
    const link = `https://studywithme-alpha.vercel.app/download/${videoId}/master.m3u8`;
    navigator.clipboard.writeText(link).then(() => {
        showToast('1DM download link copied!');
    }).catch(() => {
        const input = document.createElement('input');
        input.value = link;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        showToast('1DM download link copied!');
    });
}

function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

function buildVideoCard(video, batchSlug) {
    const hasUrl = !!video.videoDetails.videoUrl;
    const videoUrl = hasUrl ? video.videoDetails.videoUrl : video.videoDetails.embedCode;
    const videoId = hasUrl ? extractVideoId(video.videoDetails.videoUrl) : null;
    const title = video.videoDetails.name.length > 70
        ? video.videoDetails.name.slice(0, 70) + '…'
        : video.videoDetails.name;

    const safeTitle = title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    return `
        <div class="card-3d video-card"
            data-video-url="${videoUrl || ''}"
            data-has-url="${hasUrl}"
            data-title="${safeTitle}"
            onclick="handleVideoClick(this)">
            <div class="video-thumb-wrap">
                <img class="video-thumb" src="${video.videoDetails.image}" alt="Thumbnail" loading="lazy">
                <div class="play-overlay">
                    <div class="play-btn-circle"><i class="ri-play-fill"></i></div>
                </div>
                <div class="duration-badge"><i class="ri-time-line"></i> ${video.videoDetails.duration || ''}</div>
            </div>
            <div class="video-info">
                <div class="video-date"><i class="ri-calendar-line"></i> ${video.date || ''}</div>
                <p class="video-title">${safeTitle}</p>
                ${hasUrl ? `
                <div class="video-actions">
                    <div class="action-btn vlc-btn" data-video-url="${videoUrl}" data-title="${safeTitle}" onclick="handlePlayButtonClick(event, this)">
                        <i class="ri-play-circle-line"></i> Play
                    </div>
                    <div class="action-btn dl-btn" data-video-id="${videoId || ''}" onclick="handleDownloadButtonClick(event, this)">
                        <i class="ri-download-2-line"></i> 1DM
                    </div>
                </div>` : ''}
            </div>
        </div>`;
}

function buildPdfCard(pdf) {
    const safeTitle = (pdf.topic || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return `
        <div class="card-3d pdf-card" onclick="downloadPdf(event, '${pdf.pdfUrl}', '${pdf.pdfName}')">
            <div class="pdf-icon"><i class="ri-file-pdf-2-fill"></i></div>
            <div class="pdf-info">
                <div class="pdf-title">${safeTitle.length > 70 ? safeTitle.slice(0,70)+'…' : safeTitle}</div>
                <div class="pdf-meta">${pdf.pdfName}</div>
            </div>
            <i class="ri-download-2-line pdf-dl"></i>
        </div>`;
}

document.addEventListener('DOMContentLoaded', function () {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', async function () {
            tabBtns.forEach(b => b.classList.remove('active'));
            this.classList.add('active');

            document.querySelectorAll('#content > div').forEach(d => d.style.display = 'none');

            const tabId = this.id;
            const contentEl = document.getElementById(`${tabId}-content`);
            if (!contentEl) return;

            contentEl.style.display = 'block';

            const container = contentEl.querySelector('.cards-grid, .pdf-grid');
            if (!container || container.dataset.loaded) return;

            const batchNameSlug = contentEl.getAttribute('batchNameSlug');
            const subjectSlug = contentEl.getAttribute('subjectSlug');
            const chapterSlug = contentEl.getAttribute('chapterSlug');

            container.innerHTML = '<div style="grid-column:1/-1;"><div class="spinner"></div></div>';

            const url = `/batches/${batchNameSlug}/subject/${subjectSlug}/contents/${chapterSlug}/${tabId}`;

            try {
                const response = await fetch(url);
                const data = await response.json();

                if (tabId === 'lectures' || tabId === 'dppVideos') {
                    if (data.data && data.data.length > 0) {
                        container.innerHTML = data.data.map(vid => buildVideoCard(vid, batchNameSlug)).join('');
                        if (window._init3DTilt) window._init3DTilt();
                    } else {
                        container.innerHTML = `<div class="empty-content"><i class="ri-video-off-line"></i><p>No content yet</p></div>`;
                    }
                } else {
                    if (data.data && data.data.length > 0) {
                        container.innerHTML = data.data.map(buildPdfCard).join('');
                        if (window._init3DTilt) window._init3DTilt();
                    } else {
                        container.innerHTML = `<div class="empty-content"><i class="ri-file-unknow-line"></i><p>No content yet</p></div>`;
                    }
                }
                container.dataset.loaded = '1';
            } catch (err) {
                console.error(err);
                container.innerHTML = `<div class="empty-content"><i class="ri-error-warning-line"></i><p>Failed to load content</p></div>`;
            }
        });
    });
});
