import fetch from 'node-fetch';

async function paidBatches(token) {
    const url = 'https://api.penpencil.co/v3/batches/my-batches?mode=1&amount=paid&page=1';
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error('paidBatches API error:', response.status);
            return { data: [], error: `API ${response.status}` };
        }
        const data = await response.json();
        if (!data || !data.data) return { data: [] };
        const extractedData = data.data.map(item => ({
            name: item.name,
            byName: item.byName,
            language: item.language,
            previewImage: item.previewImage ? item.previewImage.baseUrl + item.previewImage.key : '',
            slug: item.slug
        }));
        return { data: extractedData };
    } catch (error) {
        console.error('paidBatches error:', error.message);
        return { data: [], error: error.message };
    }
}

async function freeBatches(token) {
    const url = 'https://api.penpencil.co/v3/batches/my-batches?mode=1&amount=free&page=1';
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) {
            console.error('freeBatches API error:', response.status);
            return { data: [], error: `API ${response.status}` };
        }
        const data = await response.json();
        if (!data || !data.data) return { data: [] };
        const extractedData = data.data.map(item => ({
            name: item.name,
            byName: item.byName,
            language: item.language,
            previewImage: item.previewImage ? item.previewImage.baseUrl + item.previewImage.key : '',
            slug: item.slug
        }));
        return { data: extractedData };
    } catch (error) {
        console.error('freeBatches error:', error.message);
        return { data: [], error: error.message };
    }
}

async function specificeBatch(token, batchName) {
    const url = `https://api.penpencil.co/v3/batches/${batchName}/details`;
    const headers = { 'Authorization': `Bearer ${token}` };
    try {
        const response = await fetch(url, { headers });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const subjectData = data.data.subjects.map(item => ({
            subject: item.subject,
            imageId: item.imageId ? `${item.imageId.baseUrl}${item.imageId.key}` : "",
            slug: item.slug,
            tagCount: item.tagCount
        }));

        return {
            data: {
                _id: data.data._id,
                name: data.data.name,
                class: data.data.class,
                byName: data.data.byName,
                language: data.data.language,
                subjects: subjectData
            }
        };
    } catch (error) {
        console.error('specificeBatch error:', error.message);
    }
}

async function subjectListDetails(token, batchNameSlug, subjectSlug, page = 1) {
    let subjectListDetailsPage = 1;
    let wholeData = { success: true, data: [] };

    try {
        while (true) {
            const url = `https://api.penpencil.co/v2/batches/${batchNameSlug}/subject/${subjectSlug}/topics?page=${subjectListDetailsPage}`;
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch(url, { headers });
            if (!response.ok) break;
            const data = await response.json();
            if (!(data && data.data && data.data.length >= 1)) break;
            wholeData.data = wholeData.data.concat(data.data);
            subjectListDetailsPage++;
        }
        return wholeData;
    } catch (error) {
        console.error('subjectListDetails error:', error.message);
    }
}

async function videosBatch(token, batchNameSlug, subjectSlug, chapterSlug, page = 1, retryCount = 3) {
    let videosBatchPage = 1;
    const extractedData = [];
    try {
        while (true) {
            const url = `https://api.penpencil.co/v2/batches/${batchNameSlug}/subject/${subjectSlug}/contents?page=${videosBatchPage}&contentType=videos&tag=${chapterSlug}`;
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch(url, { headers });
            if (!response.ok) {
                const status = response.status;
                if (status === 429 && retryCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    return await videosBatch(token, batchNameSlug, subjectSlug, chapterSlug, page, retryCount - 1);
                } else {
                    throw new Error(`HTTP error! status: ${status}`);
                }
            }
            const data = await response.json();
            if (!(data && data.data && data.data.length >= 1)) break;
            data.data.forEach(item => {
                if (item.videoDetails) {
                    extractedData.push({
                        topic: item.topic,
                        date: item.date,
                        videoDetails: {
                            name: item.videoDetails.name || '',
                            image: item.videoDetails.image || '',
                            videoUrl: item.videoDetails.videoUrl || '',
                            embedCode: item.videoDetails.embedCode || '',
                            duration: item.videoDetails.duration || ''
                        }
                    });
                }
            });
            videosBatchPage++;
        }
        return { data: extractedData };
    } catch (error) {
        console.error('videosBatch error:', error.message);
        throw error;
    }
}

async function videoNotes(token, batchNameSlug, subjectSlug, chapterSlug, retryCount = 3) {
    let notesPage = 1;
    const extractedData = [];
    try {
        while (true) {
            const url = `https://api.penpencil.co/v2/batches/${batchNameSlug}/subject/${subjectSlug}/contents?page=${notesPage}&contentType=notes&tag=${chapterSlug}`;
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch(url, { headers });
            if (!response.ok) {
                const status = response.status;
                if (status === 429 && retryCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await videoNotes(token, batchNameSlug, subjectSlug, chapterSlug, retryCount - 1);
                } else {
                    throw new Error(`HTTP error! status: ${status}`);
                }
            }
            const data = await response.json();
            if (!(data && data.data && data.data.length > 0)) break;
            
            data.data.forEach(item => {
                if (item.homeworkIds && item.homeworkIds.length > 0) {
                    item.homeworkIds.forEach(homework => {
                        if (homework.attachmentIds && homework.attachmentIds.length > 0) {
                            extractedData.push({
                                topic: homework.topic || '',
                                note: homework.note || '',
                                pdfName: homework.attachmentIds[0].name || '',
                                pdfUrl: `${homework.attachmentIds[0].baseUrl}${homework.attachmentIds[0].key}`
                            });
                        }
                    });
                }
            });
            notesPage++;
        }
        return { data: extractedData };
    } catch (error) {
        console.error('videoNotes error:', error.message);
        throw error;
    }
}

async function dppQuestions(token, batchNameSlug, subjectSlug, chapterSlug, retryCount = 3) {
    let dppQuestionsPages = 1;
    const extractedData = [];
    try {
        while (true) {
            const url = `https://api.penpencil.co/v2/batches/${batchNameSlug}/subject/${subjectSlug}/contents?page=${dppQuestionsPages}&contentType=DppNotes&tag=${chapterSlug}`;
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch(url, { headers });
            if (!response.ok) {
                const status = response.status;
                if (status === 429 && retryCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await dppQuestions(token, batchNameSlug, subjectSlug, chapterSlug, retryCount - 1);
                } else {
                    throw new Error(`HTTP error! status: ${status}`);
                }
            }
            const data = await response.json();
            if (!(data && data.data && data.data.length > 0)) break;
            
            data.data.forEach(item => {
                if (item.homeworkIds && item.homeworkIds.length > 0) {
                    item.homeworkIds.forEach(homework => {
                        if (homework.attachmentIds && homework.attachmentIds.length > 0) {
                            extractedData.push({
                                topic: homework.topic || '',
                                note: homework.note || '',
                                pdfName: homework.attachmentIds[0].name || '',
                                pdfUrl: `${homework.attachmentIds[0].baseUrl}${homework.attachmentIds[0].key}`
                            });
                        }
                    });
                }
            });
            dppQuestionsPages++;
        }
        return { data: extractedData };
    } catch (error) {
        console.error('dppQuestions error:', error.message);
        throw error;
    }
}

async function dppVideos(token, batchNameSlug, subjectSlug, chapterSlug, retryCount = 3, targetContentType = 'DppVideos') {
    let dppVideosPage = 1;
    const extractedData = [];
    try {
        while (true) {
            const url = `https://api.penpencil.co/v2/batches/${batchNameSlug}/subject/${subjectSlug}/contents?page=${dppVideosPage}&contentType=${targetContentType}&tag=${chapterSlug}`;
            const headers = { 'Authorization': `Bearer ${token}` };
            const response = await fetch(url, { headers });
            if (!response.ok) {
                const status = response.status;
                if (status === 429 && retryCount > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await dppVideos(token, batchNameSlug, subjectSlug, chapterSlug, retryCount - 1);
                } else {
                    throw new Error(`HTTP error! status: ${status}`);
                }
            }
            const data = await response.json();
            if (!(data && data.data && data.data.length > 0)) break;
            
            if (dppVideosPage === 1) {
                console.log("\n=== FULL DPP VIDEOS RESPONSE ===");
                console.log(JSON.stringify(data.data[0] || {}, null, 2));
                console.log("\nAll items:");
                data.data.forEach(x => {
                    console.log(`- topic: ${x.topic}, type: ${x.type}, url: ${x.url ? 'present' : 'none'}, videoDetails: ${x.videoDetails ? 'present' : 'none'}, homeworkIds: ${x.homeworkIds?.length || 0}`);
                    if (x.url) console.log("   URL:", x.url);
                });
                console.log("================================\n");
            }
            
            data.data.forEach(item => {
                
                let standalonePushed = false;
                
                // Helper to resolve PW nested image objects safely
                const resolveImg = (img) => {
                    if (!img) return '';
                    if (typeof img === 'string') return img;
                    if (img.baseUrl && img.key) return img.baseUrl + img.key;
                    if (img.key) return img.key;
                    return '';
                };

                // 1. Check if item has homeworkIds (nested solutions)
                if (item.homeworkIds && item.homeworkIds.length > 0) {
                    item.homeworkIds.forEach(homework => {
                        let hwVideoUrl = '';
                        let hwImageObj = homework.image || homework.previewImage || homework.imageId || homework.thumbnail || item.image || item.previewImage || item.imageId || item.thumbnail;
                        let hwImage = resolveImg(hwImageObj);
                        let hwName = homework.name || homework.topic || homework.title || item.name || item.topic || item.title || 'DPP Solution Video';
                        let hwDuration = homework.duration || '';

                        if (homework.videoDetails) {
                            hwVideoUrl = homework.videoDetails.videoUrl || homework.videoDetails.embedCode || homework.url || (homework.videoId ? `https://cdn.pw.live/video/${homework.videoId}/master.m3u8` : '');
                            hwImage = resolveImg(homework.videoDetails.image) || hwImage;
                            hwName = homework.videoDetails.name || hwName;
                            hwDuration = homework.videoDetails.duration || hwDuration;
                        } else if (homework.videoId) {
                            hwVideoUrl = `https://cdn.pw.live/video/${homework.videoId}/master.m3u8`;
                        } else if (homework.url && !homework.url.match(/\.(jpg|jpeg|png|webp|svg|pdf)$/i)) {
                            // Only use homework.url if it doesn't look like a static image/pdf
                            hwVideoUrl = homework.url;
                        }

                        if ((hwVideoUrl || homework.videoDetails || homework.videoId) && hwVideoUrl) {
                            extractedData.push({
                                topic: item.topic || homework.topic || 'DPP Solution Video',
                                date: homework.date || item.date || '',
                                videoDetails: {
                                    name: hwName,
                                    image: hwImage,
                                    videoUrl: hwVideoUrl,
                                    embedCode: homework.videoDetails?.embedCode || '',
                                    duration: hwDuration
                                }
                            });
                            standalonePushed = true;
                        }
                    });
                }
                
                // 2. Check standalone item fields (if not fully covered by homeworkIds or if it's standalone)
                if (!standalonePushed) {
                    let itemVideoUrl = '';
                    let itemImageObj = item.image || item.previewImage || item.imageId || item.thumbnail;
                    let itemImage = resolveImg(itemImageObj);
                    let itemName = item.name || item.topic || item.title || 'DPP Solution Video';
                    let itemDuration = item.duration || '';

                    if (item.videoDetails) {
                        itemVideoUrl = item.videoDetails.videoUrl || item.videoDetails.embedCode || item.url || (item.videoId ? `https://cdn.pw.live/video/${item.videoId}/master.m3u8` : '');
                        itemImage = resolveImg(item.videoDetails.image) || itemImage;
                        itemName = item.videoDetails.name || itemName;
                        itemDuration = item.videoDetails.duration || itemDuration;
                    } else if (item.videoId) {
                        itemVideoUrl = `https://cdn.pw.live/video/${item.videoId}/master.m3u8`;
                    } else if (item.url && !item.url.match(/\.(jpg|jpeg|png|webp|svg|pdf)$/i)) {
                        itemVideoUrl = item.url;
                    }

                    // Push it even if videoUrl is missing, so user can see the item exists (debug/fallback)
                    if (itemVideoUrl) {
                        extractedData.push({
                            topic: item.topic || 'DPP Solution Video',
                            date: item.date || '',
                            videoDetails: {
                                name: itemName,
                                image: itemImage,
                                videoUrl: itemVideoUrl,
                                embedCode: item.videoDetails?.embedCode || '',
                                duration: itemDuration
                            }
                        });
                    }
                }
            });
            dppVideosPage++;
        }
        
        // If PW API returned nothing for DppVideos, fallback to DppNotes where they might have merged them
        if (extractedData.length === 0 && targetContentType === 'DppVideos') {
            console.log(`[Permanent Fix] No items found in DppVideos for ${chapterSlug}, checking DppNotes...`);
            return await dppVideos(token, batchNameSlug, subjectSlug, chapterSlug, retryCount, 'DppNotes');
        }

        return { data: extractedData };
    } catch (error) {
        console.error('dppVideos error:', error.message);
        throw error;
    }
}

export { paidBatches, freeBatches, specificeBatch, subjectListDetails, videosBatch, videoNotes, dppQuestions, dppVideos };
