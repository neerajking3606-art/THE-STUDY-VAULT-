import mongoose from 'mongoose';
import fetch from 'node-fetch';

const MONGODB_URL="mongodb://admin:vX7Neeraj%402008@ac-3jtslpc-shard-00-00.1srghiw.mongodb.net:27017,ac-3jtslpc-shard-00-01.1srghiw.mongodb.net:27017,ac-3jtslpc-shard-00-02.1srghiw.mongodb.net:27017/?ssl=true&replicaSet=atlas-xmosz1-shard-0&authSource=admin&retryWrites=true&w=majority&appName=PWDB";

const tokenSchema = new mongoose.Schema({
    access_token: String,
    refresh_token: String
});
const Token = mongoose.model('Token', tokenSchema);

async function test() {
    await mongoose.connect(MONGODB_URL);
    const tokenDoc = await Token.findOne();
    if (!tokenDoc) {
        console.log("No token in DB");
        process.exit();
    }
    const token = tokenDoc.access_token;
    
    // Get DppVideos from a known batch. e.g. let's just query batches to find one
    // Actually, I can just find a random batch from DB and find a subject/chapter
    const batchSchema = new mongoose.Schema({ slug: String, subjects: Array }, { strict: false });
    const Batch = mongoose.model('Batch', batchSchema, 'batches');
    const b = await Batch.findOne({"subjects.chapters": {$exists: true}});
    if (!b) { console.log("No batch with chapters"); process.exit(); }
    
    // Try to find a batch and chapter and fetch DppVideos
    const batchSlug = b.slug;
    const subjectSlug = b.subjects[0].slug;
    const chapterSlug = b.subjects[0].chapters[0].slug;
    
    console.log(`Testing batch: ${batchSlug}, subj: ${subjectSlug}, chap: ${chapterSlug}`);
    
    const url = `https://api.penpencil.co/v2/batches/${batchSlug}/subject/${subjectSlug}/contents?page=1&contentType=DppVideos&tag=${chapterSlug}`;
    console.log(url);
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
    const json = await res.json();
    console.log(JSON.stringify(json, null, 2).substring(0, 1500));
    console.log("\n-----\nItem details:");
    if (json.data && json.data.length > 0) {
        console.log(JSON.stringify(json.data[0], null, 2));
    }
    process.exit();
}
test();
