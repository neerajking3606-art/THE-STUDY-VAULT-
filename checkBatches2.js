import mongoose from 'mongoose';

const MONGODB_URL="mongodb://admin:vX7Neeraj%402008@ac-3jtslpc-shard-00-00.1srghiw.mongodb.net:27017,ac-3jtslpc-shard-00-01.1srghiw.mongodb.net:27017,ac-3jtslpc-shard-00-02.1srghiw.mongodb.net:27017/?ssl=true&replicaSet=atlas-xmosz1-shard-0&authSource=admin&retryWrites=true&w=majority&appName=PWDB";

const batchSchema = new mongoose.Schema({ slug: String, subjects: Array, token: String }, { strict: false });
const Batch = mongoose.model('Batch', batchSchema, 'batches');

async function test() {
    await mongoose.connect(MONGODB_URL);
    const b = await Batch.findOne({"subjects.chapters": {$exists: true}});
    if (b) {
        console.log("Token: ", b.token);
        console.log("Batch:", b.slug);
        console.log("Subject:", b.subjects[0].slug);
        console.log("Chapter:", b.subjects[0].chapters[0].slug);
    } else {
        console.log("No batch found");
    }
    process.exit();
}
test();
