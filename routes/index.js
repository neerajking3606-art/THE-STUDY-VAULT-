import express from 'express';
const router = express.Router();
import { paidBatches, freeBatches, specificeBatch, subjectListDetails, videosBatch, videoNotes, dppQuestions, dppVideos } from '../controllers/pw.js';
// Your main file
import authLogin from '../middlewares/auth.js';
import { saveDataToMongoDB, saveAllDataToMongoDB, saveChapterData } from '../controllers/saveBatch.js';
// import saveDataToMongoDB from '../controllers/new.js';
import updateDataToMongoDB from '../controllers/updateBatch.js'
import { Batch, Subject, Chapter, Video, Note, Token } from '../models/batches.js'
import { convertMPDToHLS, multiQualityHLS } from '../controllers/hls.js'
import { Readable } from 'stream';
import axios from 'axios';
import https from 'https';


/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Kuch nahi Yrr' });
});

router.get('/logout', function (req, res, next) {
  res.clearCookie('token', { httpOnly: true, sameSite: 'lax' });
  res.redirect('/login');
});

router.get('/login', function (req, res, next) {
  res.render('login');
});

router.post('/login', async function (req, res, next) {
  const token = req.body.token;
  if (!token) return res.send("<script>alert('Please Enter Token'); window.location.href='/login';</script>");
  
  // Directly save the token. Physics Wallah's verify-token API aggressively rejects 
  // perfectly valid tokens if the device randomId doesn't identically match.
  // We bypass this entirely and assume the user's token is valid.
  try {
      res.cookie('token', token, { maxAge: 604800000, httpOnly: true, sameSite: 'lax' });
      
      // Permanently fix DB token mismatch: update the global token when user logs in
      let db = await Token.findOne();
      if(db) {
         db.access_token = token;
         // Best effort update, refresh token won't be available here unless provided
         await db.save();
      } else {
         await new Token({access_token: token, refresh_token: token}).save();
      }

      res.redirect('/batches');
  } catch (error) {
      console.error('Error logging in:', error.message);
      res.status(500).send("Login failed.");
  }
});


router.get('/batches', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  saveAllDataToMongoDB(token);
  const paidBatch = await paidBatches(token);
  const freeBatch = await freeBatches(token);
  console.log('paidBatch count:', paidBatch?.data?.length, '| error:', paidBatch?.error);
  console.log('freeBatch count:', freeBatch?.data?.length, '| error:', freeBatch?.error);
  res.set('Cache-Control', 'no-store');
  res.render('batch', { paidBatch: paidBatch || { data: [] }, freeBatch: freeBatch || { data: [] } });
});

router.get('/batches/:batchSlug/save', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  const batchSlug = req.params.batchSlug;
  await saveDataToMongoDB(token, batchSlug);
  res.send('Saved')
});

router.get('/batches/:batchSlug/update', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  const batchSlug = req.params.batchSlug;
  await updateDataToMongoDB(token, batchSlug);
  res.send('Updated')
});

router.get('/batches/:batchNameSlug/details', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  const specificeBatchdata = await specificeBatch(token, req.params.batchNameSlug)
  res.render('batchesDetails', { specificeBatch: specificeBatchdata, batchNameSlug: req.params.batchNameSlug });
});

router.get('/batches/:batchNameSlug/subject/:subjectSlug/topics', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  const subjectListDetailsData = await subjectListDetails(token, req.params.batchNameSlug, req.params.subjectSlug)
  res.render('subjectListDetails', { subjectListDetails: subjectListDetailsData, batchNameSlug: req.params.batchNameSlug, subjectSlug: req.params.subjectSlug });
});

router.get('/batches/:batchNameSlug/subject/:subjectSlug/topics/save', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  await saveChapterData(token, req.params.batchNameSlug, req.params.subjectSlug, 1)
  res.status(200).send('Saved');
});

router.get('/batches/:batchNameSlug/subject/:subjectSlug/contents/:chapterSlug', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  const specificeBatchdata = await specificeBatch(token, req.params.batchNameSlug);
  const parentId = (specificeBatchdata && specificeBatchdata.data) ? specificeBatchdata.data._id : "";
  const videosBatchData = await videosBatch(token, req.params.batchNameSlug, req.params.subjectSlug, req.params.chapterSlug)
  res.render('videosBatch', { videosBatch: videosBatchData, batchNameSlug: req.params.batchNameSlug, subjectSlug: req.params.subjectSlug, chapterSlug: req.params.chapterSlug, token, parentId });
});

router.get('/batches/:batchNameSlug/subject/:subjectSlug/contents/:chapterSlug/:contentType', authLogin, async function (req, res, next) {
  const token = req.cookies.token;
  const contentType = req.params.contentType;
  switch (contentType) {
    case "lectures":
      const videosBatchData = await videosBatch(token, req.params.batchNameSlug, req.params.subjectSlug, req.params.chapterSlug)
      return res.status(200).json(videosBatchData);
      break;
    case "notes":
      const videoNotesData = await videoNotes(token, req.params.batchNameSlug, req.params.subjectSlug, req.params.chapterSlug)
      return res.status(200).json(videoNotesData);
      break;
    case "dpp":
      const dppQuestionsData = await dppQuestions(token, req.params.batchNameSlug, req.params.subjectSlug, req.params.chapterSlug)
      return res.status(200).json(dppQuestionsData);
      break;
    case "dppVideos":
      const dppVideosData = await dppVideos(token, req.params.batchNameSlug, req.params.subjectSlug, req.params.chapterSlug)
      return res.status(200).json(dppVideosData);
      break;

    default:
      break;
  }
  const videosBatchData = await videosBatch(token, req.params.batchNameSlug, req.params.subjectSlug, req.params.chapterSlug)
  return res.render('videosBatch', { videosBatch: videosBatchData });
});


router.get('/hls', async function (req, res, next) {
  try {
    const vidID = req.query.v;
    const quality = req.query.quality;
    let type = req.query.type;
    if (!type) type = "play";
    const data = await convertMPDToHLS(vidID, quality, type)
    if (!data) { return res.status(403).send("Token Expired Change it!"); }
    res.setHeader('Content-Type', 'application/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="main.m3u8"');
    res.send(data);

  } catch (error) {
    res.status(403).send("HLS Error: " + error.message);
  }
})

router.get('/download/:vidID/master.m3u8', async function (req, res, next) {
  try {
    const vidID = req.params.vidID;
    const type = req.query.type || 'play';
    const userToken = req.cookies ? req.cookies.token : null;
    let originalMpdUrl = null;
    if (req.query.src) {
        try { originalMpdUrl = Buffer.from(req.query.src, 'base64').toString('ascii'); } catch (e) {}
    }
    
    console.log(`\n--- [BACKEND ROUTE] START: /download/${vidID}/master.m3u8 ---`);
    console.log(`[BACKEND ROUTE] Incoming videoId: ${vidID}, type: ${type}`);
    
    // Pass original URL through so we use the correct AWS cloudfront origin
    const data = await multiQualityHLS(vidID, type, userToken, originalMpdUrl);

    if (!data || !data.startsWith("#EXTM3U")) {
        console.error(`[BACKEND ROUTE] Generated invalid playlist:\n${data ? data.substring(0, 100) : 'null'}`);
        return res.status(502).json({ error: "Invalid or empty HLS playlist generated from upstream.", code: "INVALID_PLAYLIST" });
    }

    console.log(`[BACKEND ROUTE] Successfully generated M3U8 for ${vidID}. First 50 chars:`, data.substring(0, 50).replace(/\\n/g, '\\\\n'));
    console.log(`--- [BACKEND ROUTE] END ---\n`);
    
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    // Removed res.setHeader('Content-Disposition', 'attachment; ...') so player can read it inline
    res.send(data);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    console.error(`\n[BACKEND ROUTE] HLS Route Error Stack:`);
    console.error(error.stack);
    console.log(`[BACKEND ROUTE] Final response status: ${statusCode}`);
    console.log(`--- [BACKEND ROUTE] ERROR END ---\n`);
    res.status(statusCode).json({ error: "HLS Error", detail: error.message, stack: error.stack });
  }
});

router.get('/get-hls-key', async (req, res) => {
  try {
    let db = await Token.findOne();
    if (!db) return res.status(503).send('Token not found in database');
    const token = db.access_token;
    const videoKey = req.query.videoKey;
    const url = `https://api.penpencil.xyz/v1/videos/get-hls-key?videoKey=${videoKey}&key=enc.key&authorization=${token}`;
    const response = await fetch(url);
    const data = await response.arrayBuffer();
    res.setHeader('Content-Type', 'application/octet-stream');
    res.send(Buffer.from(data));
  } catch (error) {
    console.error('Error in /get-hls-key:', error.message);
    res.status(500).send('An error occurred');
  }
});

router.get('/dash/:vidId/hls/:quality/:ts', async (req, res) => {
  const policy = req.query.Policy;
  const keyPairId = req.query['Key-Pair-Id'];
  const Signature = req.query.Signature;
  const vidId = req.params.vidId
  const quality = req.params.quality
  const ts = req.params.ts

  const url = `https://sec1.pw.live/${vidId}/hls/${quality}/${ts}?Policy=${policy}&Key-Pair-Id=${keyPairId}&Signature=${Signature}`
  try {
    const response = await fetch(url);
    const data = await response.arrayBuffer();  // Use arrayBuffer() for binary data
    res.setHeader('Content-Type', 'application/octet-stream');  // Set correct MIME type for binary data
    res.send(Buffer.from(data));  // Convert ArrayBuffer to Buffer
  } catch (error) {
    console.error('Error:', error);
    res.status(500).send('An error occurred');
  }
});



router.get('/player', async function (req, res) {
  res.render('watch', { query: req.query });
});


router.get('/saved/Batches', async function (req, res, next) {
  try {
    const batch = await Batch.find().select('-subjects');
    res.render('savedBatch', { batch });
  } catch (err) {
    res.status(503).send('<h2>Database unavailable. Please set MONGODB_URL.</h2>');
  }
});

router.get('/saved/batches/:batchSlug/delete', authLogin, async function (req, res, next) {
  try {
    const batchSlug = req.params.batchSlug;
    const specificeBatchdata = await Batch.findOneAndDelete({ slug: batchSlug });
    res.send(`<h1>DELETED</h1><br>${specificeBatchdata}`)
  } catch (err) {
    res.status(503).send('<h2>Database unavailable.</h2>');
  }
});

router.get('/saved/batches/:batchNameSlug/details', async function (req, res, next) {
  try {
    const specificeBatchdata = await Batch.findOne({ slug: req.params.batchNameSlug }).select('-subjects.chapters');
    res.render('savedBatchesDetails', { specificeBatch: specificeBatchdata, batchNameSlug: req.params.batchNameSlug });
  } catch (err) {
    res.status(503).send('<h2>Database unavailable. Please set MONGODB_URL.</h2>');
  }
});

router.get('/saved/batches/:batchNameSlug/subject/:subjectSlug/topics', async function (req, res, next) {
  try {
    const batch = await Batch.findOne({ slug: req.params.batchNameSlug }).select('-subjects.chapters.videosSch -subjects.chapters.notesSch -subjects.chapters.dppVideosSch -subjects.chapters.dppSch');
    if (batch) {
      const subjectListDetailsData = batch.subjects.find(sub => sub.slug === req.params.subjectSlug);
      res.render('savedSubjectListDetails', { subjectListDetails: subjectListDetailsData, batchNameSlug: req.params.batchNameSlug, subjectSlug: req.params.subjectSlug });
    } else {
      res.status(404).json({ message: "Batch not found" });
    }
  } catch (err) {
    res.status(503).send('<h2>Database unavailable. Please set MONGODB_URL.</h2>');
  }
});

router.get('/saved/batches/:batchNameSlug/subject/:subjectSlug/contents/:chapterSlug', async function (req, res, next) {
  try {
    const batch = await Batch.findOne({ slug: req.params.batchNameSlug });
    const subjectListDetailsData = batch.subjects.find(sub => sub.slug === req.params.subjectSlug);
    const videosBatchData = subjectListDetailsData.chapters.find(sub => sub.slug === req.params.chapterSlug);
    const dbToken = await Token.findOne();
    const token = dbToken ? dbToken.access_token : "";
    res.render('savedVideosBatch', { videosBatch: videosBatchData, batchNameSlug: req.params.batchNameSlug, subjectSlug: req.params.subjectSlug, chapterSlug: req.params.chapterSlug, parentId: batch._id, token: token });
  } catch (err) {
    res.status(503).send('<h2>Database unavailable. Please set MONGODB_URL.</h2>');
  }
});

router.get('/saved/batches/:batchNameSlug/subject/:subjectSlug/contents/:chapterSlug/:contentType', async function (req, res, next) {
  try {
    const batch = await Batch.findOne({ slug: req.params.batchNameSlug });
    const subjectListDetailsData = batch.subjects.find(sub => sub.slug === req.params.subjectSlug);
    const videosBatchData = subjectListDetailsData.chapters.find(sub => sub.slug === req.params.chapterSlug);
    res.json(videosBatchData)
  } catch (err) {
    res.status(503).json({ error: 'Database unavailable' });
  }
});


router.get("/get-parent-id/:batchNameSlug", async (req, res) => {
  try {
    const token = req.cookies.token;
    if (token) {
      const data = await specificeBatch(token, req.params.batchNameSlug);
      if (data && data.data && data.data._id) {
        return res.json({ parentId: data.data._id });
      }
    }
    const dbBatch = await Batch.findOne({ slug: req.params.batchNameSlug });
    if (dbBatch && dbBatch._id) {
      return res.json({ parentId: dbBatch._id });
    }
    res.json({ parentId: null });
  } catch (error) {
    res.json({ parentId: null });
  }
});

router.get("/token/update", async (req, res) => {
  res.render('updateToken')
});

router.post("/token/update", async (req, res) => {
  const { access_token, refresh_token } = req.body;

  if (!access_token || !refresh_token) {
    return res.status(400).json({ error: "access_token and refresh_token are required" });
  }

  try {
    let token = await Token.findOne();
    if (token) {
      token.access_token = access_token;
      token.refresh_token = refresh_token;
    } else {
      token = new Token({ access_token, refresh_token });
    }
    await token.save();
    res.status(200).json({ message: "Token saved/updated successfully" });
  } catch (error) {
    res.status(500).json({ error: "An error occurred while saving/updating the token" });
  }
});

router.get("/redirect-to-vlc", async (req, res) => {
  const vidID = req.query.v;
  const quality = req.query.quality;
  res.render('redirectToVlc', { vidID, quality })
});



export default router;
