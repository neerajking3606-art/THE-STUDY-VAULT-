import mongoose from 'mongoose';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URL).then(async () => {
    console.log("Connected to DB");
    const { Batch } = await import('./models/batches.js');
    
    // Find any batch that has a video URL
    // We'll just look through the DB
    const batch = await Batch.findOne({ "subjects.chapters.videoDetails.videoUrl": { $exists: true, $ne: null } });
    if (!batch) {
        console.log("No batch with videoUrl found");
        process.exit(0);
    }
    
    let videoUrl = null;
    outerloop:
    for (const sub of batch.subjects) {
        for (const chap of sub.chapters) {
            if (chap.videoDetails && chap.videoDetails.videoUrl) {
                videoUrl = chap.videoDetails.videoUrl;
                break outerloop;
            }
        }
    }
    
    console.log("Found video URL in DB:", videoUrl);
    
    // Now extract childId
    let childId = null;
    const match = videoUrl.match(/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}|[0-9a-fA-F]{24})/);
    if (match) childId = match[1];
    else {
        const parts = videoUrl.split('/');
        childId = parts[parts.length - 2];
    }
    
    const canonical = `https://cdn.pw.live/video/${childId}/master.m3u8`;
    console.log("Testing canonical URL:", canonical);
    
    try {
        const res = await fetch(canonical, {
            headers: {
                "Origin": "http://localhost:5000",
                "Referer": "http://localhost:5000/"
            }
        });
        
        console.log("Status:", res.status);
        console.log("CORS Header Access-Control-Allow-Origin:", res.headers.get("access-control-allow-origin"));
        
        const text = await res.text();
        console.log("Response body snippet:", text.substring(0, 100));
    } catch (e) {
         console.error("Fetch error:", e);
    }
    process.exit(0);
});
