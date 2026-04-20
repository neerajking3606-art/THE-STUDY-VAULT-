import puppeteer from 'puppeteer';

(async () => {
    console.log("Launching Puppeteer...");
    const browser = await puppeteer.launch({ 
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox'] 
    });
    
    const page = await browser.newPage();
    let streamRequests = 0;
    
    // Intercept network requests to verify proxy is used
    await page.setRequestInterception(true);
    page.on('request', (request) => {
        const url = request.url();
        if (url.includes('cdn.pw.live')) {
            console.error(`[FAIL] Browser directly requested: ${url}`);
        }
        if (url.includes('/stream?url=')) {
            streamRequests++;
        }
        request.continue();
    });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log("Navigating to test video player...");
    
    // We will use a known valid test stream that plays correctly
    // The play route allows us to bypass the PW parentId lookup if we give parentId and childId.
    const testUrl = "http://localhost:5000/player?url=https%3A%2F%2Ftest-streams.mux.dev%2Fx36xhzz%2Fx36xhzz.m3u8&token=testToken&childId=123&parentId=456";
    
    await page.goto(testUrl, { waitUntil: 'networkidle2' });
    
    console.log("Waiting for video player to initialize...");
    
    // Wait for the video element and ensure it's not paused and time is moving
    await page.waitForSelector('video');
    
    // Auto-play might be blocked, so we trigger a click on the play button
    try {
        await page.click('#play-pause-btn'); 
    } catch(e) {}

    await new Promise(r => setTimeout(r, 4000)); // wait for streams to buffer

    const videoState = await page.evaluate(() => {
        const video = document.querySelector('video');
        return {
            currentTime: video.currentTime,
            duration: video.duration,
            paused: video.paused,
            src: video.src,
            networkState: video.networkState
        };
    });

    console.log("\n====== FINAL BROWSER VERIFICATION ======");
    console.log(`Stream Proxy Requests Logged: ${streamRequests}`);
    console.log(`Video Current Time: ${videoState.currentTime}`);
    console.log(`Video Duration: ${videoState.duration}`);
    console.log(`Video is paused: ${videoState.paused}`);
    console.log(`Video Network State: ${videoState.networkState} (4=empty, 3=no_source, 2=loading, 1=idle)`);
    
    if (streamRequests > 0 && videoState.currentTime > 0) {
        console.log("[SUCCESS] Playback via /stream was fully verified!");
    } else {
        console.log("[FAILED] Video did not start playing. Something went wrong.");
    }
    
    await browser.close();
})();
