import { request } from 'express';
import fetch from 'node-fetch';
import { DOMParser } from 'xmldom';
import { Token } from '../models/batches.js'

import CryptoJS from 'crypto-js'

const verifyToken = async (token) => {
    try {
        const response = await fetch('https://api.penpencil.co/v3/oauth/verify-token', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'randomId': 'ae9e92ac-b162-4089-9830-1236bddf9761'
            }
        });
        const data = await response.json();
        return data.data.isVerified;
    } catch (error) {
        return false;
    }
};

const refreshToken = async () => {
    try {
        const db = await Token.findOne();
        const response = await fetch('https://api.penpencil.co/v3/oauth/refresh-token', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${db.access_token}`,
                'randomId': 'ae9e92ac-b162-4089-9830-1236bddf9761',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "refresh_token": db.refresh_token,
                "client_id": "system-admin"
            })
        });
        const data = await response.json();
        await Token.findOneAndUpdate({},
            {
                access_token: data.data.access_token,
                refresh_token: data.data.refresh_token
            },
            { new: true, upsert: true }
        );

        console.log("Token Updated");
        return data.data.access_token;
    } catch (error) {
        console.log(error.message);
        return null;
    }
};

const getToken = async () => {
    try {
        let db = await Token.findOne();
        if(!db) return null;
        return db.access_token;
    } catch(e) {
        return null;
    }
};

const decryptCookieValue =  (encryptedValue) => {
    const videoEncryptionKey = CryptoJS.enc.Utf8.parse("pw3c199c2911cb437a907b1k0907c17n");
    const initialisationVector = CryptoJS.enc.Utf8.parse("5184781c32kkc4e8");
    const encryptedData = CryptoJS.enc.Base64.parse(encryptedValue);
    const decrypted = CryptoJS.AES.decrypt({ ciphertext: encryptedData }, videoEncryptionKey, {
        iv: initialisationVector,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7
    });
    return decrypted.toString(CryptoJS.enc.Utf8);
};

function getQueryParams(data) {
    const params = {};
    const queryString = data.startsWith('?') ? data.slice(1) : data; // Remove the leading '?'
    const pairs = queryString.split('&');

    pairs.forEach(pair => {
        const [key, value] = pair.split('=');
        if (key && value) {
            params[decodeURIComponent(key)] = decodeURIComponent(value);
        }
    });

    return params;
}

const getHeaders = async (mpdUrl, userToken) => {
    try {
        let token = userToken || await getToken();

        if(!token) {
            console.error("[HLS-CONTROLLER] Token lookup result: Invalid or null token.");
            const err = new Error("Could not get valid auth token.");
            err.statusCode = 502; // Bad Gateway / Upstream auth failure
            throw err;
        }

        console.log(`[HLS-CONTROLLER] getting headers for url: ${mpdUrl}`);
        console.log(`[HLS-CONTROLLER] Using Token of length: ${token ? token.length : 0}`);
        if(token && token.length < 50) {
             console.log(`[HLS-CONTROLLER] Token looks weird: ${token}`);
        }
        
        const payload = JSON.stringify({ 'url': mpdUrl });
        console.log(`[HLS-CONTROLLER] Payload to send-analytics-data: ${payload}`);

        const response = await fetch('https://api.penpencil.co/v3/files/send-analytics-data', {
            method: 'POST',
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 24_6 like Mac OS X) AppleWebKit/605.5.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
                'Content-Type': 'application/json',
                'client-type': 'WEB',
                'Authorization': `Bearer ${token}`
            },
            body: payload
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[HLS-CONTROLLER] send-analytics-data failed: Status ${response.status}. Body: ${errText}`);
            const err = new Error(`send-analytics-data fetch error! Status: ${response.status}`);
            err.statusCode = response.status === 403 || response.status === 401 ? 502 : response.status;
            throw err;
        }

        const data = await response.json();
        if (!data || !data.data) {
             const err = new Error(`send-analytics-data returned unexpected payload: ${JSON.stringify(data)}`);
             err.statusCode = 502;
             throw err;
        }
        
        const extractedParams = getQueryParams(data.data);

        const cloudFrontPolicy = decryptCookieValue(extractedParams['Policy']);
        const cloudFrontKeyPairId = decryptCookieValue(extractedParams['Key-Pair-Id']);
        const cloudFrontSignature = decryptCookieValue(extractedParams['Signature']);

        return {
            'Cookie': `CloudFront-Policy=${cloudFrontPolicy}; CloudFront-Key-Pair-Id=${cloudFrontKeyPairId}; CloudFront-Signature=${cloudFrontSignature}`,
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0',
            'Accept': '*/*',
        };
    } catch (err) {
        console.error(`[HLS-CONTROLLER] Error in getHeaders:`, err.stack);
        throw err;
    }
};



const convertMPDToHLS = async (mpdId, quality, type) => {
    try {
        let mainUrl = `https://sec1.pw.live/${mpdId}/hls/${quality}`;
        let mpdUrl2 = `https://sec1.pw.live/${mpdId}/hls/${quality}/main.m3u8`;

        const headers = await getHeaders(mpdUrl2);
        if(!headers) return null;
        
        const response = await fetch(mpdUrl2, { method: 'GET', headers });
        if (!response.ok) {
            const err = new Error(`HTTP error! Status: ${response.status}`);
            err.statusCode = response.status;
            throw err;
        }
        let main_data2 = await response.text();

        const pattern = /(\d{3,4}\.ts)/g;
        let replacement = '';
        if (type === "download") {
            replacement = `${mainUrl}/$1?Policy=${headers['Cookie'].match(/CloudFront-Policy=([^;]+)/)[1]}&Key-Pair-Id=${headers['Cookie'].match(/CloudFront-Key-Pair-Id=([^;]+)/)[1]}&Signature=${headers['Cookie'].match(/CloudFront-Signature=([^;]+)/)[1]}`;
        } else {
            replacement = `/dash/${mpdId}/hls/${quality}/$1?Policy=${headers['Cookie'].match(/CloudFront-Policy=([^;]+)/)[1]}&Key-Pair-Id=${headers['Cookie'].match(/CloudFront-Key-Pair-Id=([^;]+)/)[1]}&Signature=${headers['Cookie'].match(/CloudFront-Signature=([^;]+)/)[1]}`;
        }
        
        let newText = main_data2
            .replace(pattern, replacement)
            .replace(/https:\/\/api\.penpencil\.(xyz|co)\/v1\/videos\//g, `/`);

        return newText;
    } catch (error) {
        console.error("[HLS-CONTROLLER] Error converting MPD to HLS:", error);
        return null;
    }
};

const multiQualityHLS = async (mpdId, type, userToken, originalMpdUrl = null) => {
    try {
        console.log(`[HLS-CONTROLLER] Generating multi-quality HLS for videoId: ${mpdId}`);
        let mpdUrl = originalMpdUrl || `https://d1d34p8vz63oiq.cloudfront.net/${mpdId}/master.mpd`;
        console.log(`[HLS-CONTROLLER] Upstream master MPD URL (originalMpdUrl=${!!originalMpdUrl}): ${mpdUrl}`);

        const headers = await getHeaders(mpdUrl, userToken);
        if(!headers) {
             throw new Error("Could not authorize mpd headers.");
        }

        console.log(`[HLS-CONTROLLER] Fetching upstream MPD...`);
        const response = await fetch(mpdUrl, { method: 'GET', headers });
        console.log(`[HLS-CONTROLLER] Upstream response status: ${response.status} ${response.statusText}`);
        
        if(!response.ok) {
             const err = new Error(`Upstream master.mpd fetch failed with status ${response.status}`);
             err.statusCode = response.status;
             throw err;
        }
        
        const xmlText = await response.text();
        if(!xmlText.includes('<MPD')) {
             const err = new Error(`MPD source does not seem valid. Preview: ${xmlText.substring(0, 100)}`);
             err.statusCode = 502; // Invalid response from upstream
             throw err;
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        const adaptationSets = xmlDoc.getElementsByTagName("AdaptationSet");

        let hlsPlaylist = "#EXTM3U\n";
        hlsPlaylist += "#EXT-X-VERSION:3\n";

        for (let i = 0; i < adaptationSets.length; i++) {
            const adaptationSet = adaptationSets[i];
            const representations = adaptationSet.getElementsByTagName("Representation");

            for (let j = 0; j < representations.length; j++) {
                const representation = representations[j];
                const width = representation.getAttribute("width");
                const height = representation.getAttribute("height");
                const bandwidth = representation.getAttribute("bandwidth");

                const quality = height;
                if (!quality) continue;

                hlsPlaylist += `#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${width}x${height}\n`;
                if(type === 'play'){
                    hlsPlaylist += `/hls?v=${mpdId}&quality=${quality}&type=play\n`;
                }else{
                    hlsPlaylist += `/hls?v=${mpdId}&quality=${quality}&type=download\n`;
                }
            }
        }
        console.log(`[HLS-CONTROLLER] Successfully generated master playlist. Length: ${hlsPlaylist.length}`);
        return hlsPlaylist;
    } catch (error) {
        console.error("[HLS-CONTROLLER] Error in multiQualityHLS:\n", error.stack);
        throw error; // Rethrow to let the route handle and log the stack
    }
};

export { convertMPDToHLS, multiQualityHLS };