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
        } catch (err) {}

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

function handleVideoClick(element) {
    const videoUrlRaw = element.getAttribute('data-video-url');
    if(!videoUrlRaw) return;
    
    const isEmbed = !element.hasAttribute('data-is-video') || element.getAttribute('data-is-video') === 'false';
    const title = element.getAttribute('data-title');

    if (isEmbed) {
        window.location.href = videoUrlRaw;
    } else {
        console.log("RAW videoUrlRaw =", videoUrlRaw);
        let childId = extractVideoId(videoUrlRaw);
        console.log("EXTRACTED childId =", childId);

        let encodedUrl;
        if (childId) {
            encodedUrl = encodeURIComponent(`/download/${childId}/master.m3u8`);
        } else {
            console.warn("Could not extract video ID. Falling back to raw URL.");
            encodedUrl = encodeURIComponent(videoUrlRaw);
        }

        let encodedTitle = encodeURIComponent(title || "Saved Video");
        const playerUrl = `/player?url=${encodedUrl}&title=${encodedTitle}`;
        
        console.log("[PLAYER ROUTING] ->", playerUrl);
        window.location.href = playerUrl;
    }
}

function handleDownloadButtonClick(event, element) {
    event.stopPropagation();
    const videoId = element.getAttribute('data-video-id');
    copyDownloadLink(videoId);
}

function downloadPdf(url, filename) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
}

function playVideoOnVlc(button, videoId) {
    const qualityOptions = `
        <a href="/redirect-to-vlc?v=${videoId}&quality=240" target="_blank">240p</a>
        <a href="/redirect-to-vlc?v=${videoId}&quality=360" target="_blank">360p</a>
        <a href="/redirect-to-vlc?v=${videoId}&quality=480" target="_blank">480p</a>
        <a href="/redirect-to-vlc?v=${videoId}&quality=720" target="_blank">720p</a>
    `;
    button.innerHTML = qualityOptions;
}

function copyDownloadLink(videoId) {
    if(!videoId) {
        alert("No valid video ID found to copy.");
        return;
    }
    const dashboardLink = `https://studywithme-alpha.vercel.app/download/${videoId}/master.m3u8`;
    const tempInput = document.createElement('input');
    tempInput.value = dashboardLink;
    document.body.appendChild(tempInput);
    tempInput.select();
    tempInput.setSelectionRange(0, 99999);
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    alert("1dm download link copied to your clipboard ✅✅")
}

document.addEventListener('DOMContentLoaded', async function () {
    const buttons = document.querySelectorAll('.list button');

    buttons.forEach(button => {
        button.addEventListener('click', async function () {
            buttons.forEach(btn => {
                btn.classList.remove('active');
                btn.classList.add('inactive');
            });
            this.classList.remove('inactive');
            this.classList.add('active');

            const contentParagraphs = document.querySelectorAll('#content div');
            contentParagraphs.forEach(paragraph => {
                paragraph.style.display = 'none';
            });

            const buttonId = this.id;
            const contentId = `${buttonId}-content`;
            const contentElement = document.getElementById(contentId);
            if (contentElement) {
                const batchNameSlug = contentElement.getAttribute("batchNameSlug")
                const subjectSlug = contentElement.getAttribute("subjectSlug")
                const chapterSlug = contentElement.getAttribute("chapterSlug")
                contentElement.style.display = 'block';
                const contentElementContainer = document.querySelector(`#${contentId} .container`);
                const url = `/saved/batches/${batchNameSlug}/subject/${subjectSlug}/contents/${chapterSlug}/${buttonId}`;
                try {
                    const response = await fetch(url);
                    if (buttonId === "lectures" || buttonId === "dppVideos") {
                        const videosBatch = await response.json();
                        let videos = buttonId === "lectures" ? videosBatch.videosSch : videosBatch.dppVideosSch
                        if (videos.length > 0) {
                            videos.forEach(video => {
                                const hasUrl = !!video.videoDetails.videoUrl;
                                const videoUrl = hasUrl ? video.videoDetails.videoUrl : video.videoDetails.embedCode;
                                const videoId = hasUrl ? extractVideoId(video.videoDetails.videoUrl) : null;
                                const title = video.videoDetails.name;
                                const safeTitle = title.replace(/"/g, '&quot;').replace(/'/g, '&#39;');

                                contentElementContainer.innerHTML += `
                    <div class="video-card" 
                        data-video-url="${videoUrl || ''}" 
                        data-is-video="${hasUrl}" 
                        data-title="${safeTitle}" 
                        onclick="handleVideoClick(this)">
                        <div class="thumbnail-container">
                            <img class="thumbnail" src="${video.videoDetails.image}" alt="Thumbnail">
                            <img class="play-icon" src="/images/blue-play-icon.svg" alt="Play icon">
                        </div>
                        <div class="info">
                            <div class="info__time">
                                <div class="date">${video.date}</div>
                                <div class="duration">
                                    <img class="clock-icon" src="/images/clock.svg" alt="Clock">
                                    <span>${video.videoDetails.duration}</span>
                                </div>
                            </div>
                            <p class="title">${title.split(' ').length > 10 ? title.split(' ').slice(0, 10).join(' ') + ' ...' : title}</p>
                        </div>
                            ${hasUrl ? `
                            <div class="download" data-video-id="${videoId || ''}" onclick="handleDownloadButtonClick(event, this)">
                                <button>1dm Download Link</button>
                            </div>` : ''}
                    </div>`;

                            });
                        } else {
                            contentElementContainer.innerHTML = `<img src="/images/coming-soon.png" alt="">`
                        }
                    }
                    else if (buttonId === 'notes' || buttonId === 'dpp') {
                        const videoNotes = await response.json();
                        let videos = buttonId === "notes" ? videoNotes.notesSch : videoNotes.dppSch
                        if (videos.length > 0) {
                            videos.forEach(pdf => {
                                contentElementContainer.innerHTML += `
                                    <div class="container" onclick="downloadPdf('${pdf.pdfUrl}', '${pdf.pdfName}')">
                                        <div class="card__pdf">
                                            <div class="content__pdf">
                                                <p class="attachment-text">${pdf.topic.split(' ').length > 10 ? pdf.topic.split(' ').slice(0, 10).join(' ') + ' ...' : pdf.topic}</p>
                                            </div>
                                            <div class="play-div">
                                                <i class="ri-file-pdf-2-fill"></i>
                                                <i class="ri-download-fill"></i>
                                            </div>
                                        </div>
                                    </div>
                            `;
                            });
                        } else {
                            contentElementContainer.innerHTML = `<img src="/images/coming-soon.png" alt="">`
                        }
                    }
                } catch (error) {
                    console.error('Error fetching data:', error);
                }

            }
        });
    });
});
