import mongoose from 'mongoose';
import { Batch } from '../models/batches.js'
import { paidBatches, freeBatches, specificeBatch, subjectListDetails, videosBatch, videoNotes, dppQuestions, dppVideos } from './pw.js';

function isDbConnected() {
    return mongoose.connection.readyState === 1;
}

async function saveDataToMongoDB(token, batchSlug) {
    if (!isDbConnected()) return;
    try {
        const batch = await Batch.findOne({ slug: batchSlug });
        if (batch) {
            console.log('Batch Already Exist!!');
            return;
        }

        let batchData = await paidBatches(token);
        for (const course of batchData.data) {
            if (course.slug === batchSlug) {
                await saveBatchData(course, token);
            }
        }

        batchData = await freeBatches(token);
        for (const course of batchData.data) {
            if (course.slug === batchSlug) {
                await saveBatchData(course, token);
            }
        }

        await saveSubjectData(token, batchSlug);
        console.log('All data saved successfully.');
    } catch (error) {
        console.error('Error saving data:', error.message);
    }
}

async function saveAllDataToMongoDB(token) {
    if (!isDbConnected()) return;
    try {
        const batchData = await paidBatches(token);
        for (const course of batchData.data) {
            try {
                const batch = await Batch.findOne({ slug: course.slug });
                if (!batch) {
                    await saveBatchData(course, token);
                    await saveSubjectData(token, course.slug);
                    console.log('Batch Saved :- ', course.name);
                }
            } catch (err) {
                console.error('Error processing batch:', course.slug, err.message);
            }
        }
        console.log('All Batches are saved successfully.');
    } catch (error) {
        console.error('Error in saveAllDataToMongoDB:', error.message);
    }
}

async function saveBatchData(batchData, token) {
    if (!isDbConnected()) return;
    try {
        const batch = new Batch({
            name: batchData.name,
            byName: batchData.byName,
            language: batchData.language,
            previewImage: batchData.previewImage,
            slug: batchData.slug,
            token: token
        });
        await batch.save();
    } catch (error) {
        console.error('Error saving batch data:', error.message);
    }
}

async function saveSubjectData(token, batchSlug) {
    if (!isDbConnected()) return;
    try {
        const subjectData = await specificeBatch(token, batchSlug);
        const batch = await Batch.findOne({ slug: batchSlug });
        if (!batch) { console.error('Batch not found'); return; }

        for (const subject of subjectData.data.subjects) {
            batch.subjects.push({
                subject: subject.subject,
                imageId: subject.imageId,
                slug: subject.slug,
                tagCount: subject.tagCount
            });
        }
        await batch.save();
        console.log('Subject data saved successfully.');

        for (const subject of subjectData.data.subjects) {
            await saveChapterData(token, batchSlug, subject.slug, subject.tagCount);
            console.log('Subject Saved', subject.subject);
        }
    } catch (error) {
        console.error('Error saving subject data:', error.message);
    }
}

async function saveChapterData(token, batchSlug, subjectSlug, tagCount) {
    if (!isDbConnected()) return;
    try {
        const chapterData = await subjectListDetails(token, batchSlug, subjectSlug);
        const batch = await Batch.findOne({ slug: batchSlug });
        if (!batch) { console.error('Batch not found'); return; }

        const subject = batch.subjects.find(sub => sub.slug === subjectSlug);
        if (!subject) { console.error('Subject not found'); return; }

        subject.chapters = [];
        for (const chapter of chapterData.data) {
            subject.chapters.push({
                name: chapter.name,
                type: chapter.type,
                typeId: chapter.typeId,
                displayOrder: chapter.displayOrder,
                notes: chapter.notes,
                exercises: chapter.exercises,
                videos: chapter.videos,
                slug: chapter.slug
            });
        }
        await batch.save();

        for (const chapter of chapterData.data) {
            await saveVideoData(token, batchSlug, subjectSlug, chapter.slug);
            await saveNotesData(token, batchSlug, subjectSlug, chapter.slug);
            await saveDppsData(token, batchSlug, subjectSlug, chapter.slug);
            await saveDppVideoData(token, batchSlug, subjectSlug, chapter.slug);
            console.log("Chapter Saved ", chapter.name);
        }
    } catch (error) {
        console.error('Error saving chapter data:', error.message);
    }
}

async function saveVideoData(token, batchSlug, subjectSlug, chapterSlug) {
    if (!isDbConnected()) return;
    try {
        const videoData = await videosBatch(token, batchSlug, subjectSlug, chapterSlug);
        const batch = await Batch.findOne({ slug: batchSlug });
        if (!batch) return;
        const subject = batch.subjects.find(sub => sub.slug === subjectSlug);
        if (!subject) return;
        const chapter = subject.chapters.find(chap => chap.slug === chapterSlug);
        if (!chapter) return;

        for (const video of videoData.data) {
            chapter.videosSch.push({
                topic: video.topic,
                date: video.date,
                videoDetails: {
                    name: video.videoDetails.name,
                    image: video.videoDetails.image,
                    videoUrl: video.videoDetails.videoUrl,
                    duration: video.videoDetails.duration,
                    key: { kid: '', k: '' }
                }
            });
        }
        await batch.save();
    } catch (error) {
        console.error('Error saving video data:', error.message);
    }
}

async function saveNotesData(token, batchSlug, subjectSlug, chapterSlug) {
    if (!isDbConnected()) return;
    try {
        const notesData = await videoNotes(token, batchSlug, subjectSlug, chapterSlug);
        const batch = await Batch.findOne({ slug: batchSlug });
        if (!batch) return;
        const subject = batch.subjects.find(sub => sub.slug === subjectSlug);
        if (!subject) return;
        const chapter = subject.chapters.find(chap => chap.slug === chapterSlug);
        if (!chapter) return;

        for (const note of notesData.data) {
            chapter.notesSch.push({
                topic: note.topic,
                note: note.note,
                pdfName: note.pdfName,
                pdfUrl: note.pdfUrl
            });
        }
        await batch.save();
    } catch (error) {
        console.error('Error saving notes data:', error.message);
    }
}

async function saveDppVideoData(token, batchSlug, subjectSlug, chapterSlug) {
    if (!isDbConnected()) return;
    try {
        const videoData = await dppVideos(token, batchSlug, subjectSlug, chapterSlug);
        const batch = await Batch.findOne({ slug: batchSlug });
        if (!batch) return;
        const subject = batch.subjects.find(sub => sub.slug === subjectSlug);
        if (!subject) return;
        const chapter = subject.chapters.find(chap => chap.slug === chapterSlug);
        if (!chapter) return;

        for (const video of videoData.data) {
            chapter.dppVideosSch.push({
                topic: video.topic,
                date: video.date,
                videoDetails: {
                    name: video.videoDetails.name,
                    image: video.videoDetails.image,
                    videoUrl: video.videoDetails.videoUrl,
                    duration: video.videoDetails.duration,
                    key: { kid: '', k: '' }
                }
            });
        }
        await batch.save();
    } catch (error) {
        console.error('Error saving DPP video data:', error.message);
    }
}

async function saveDppsData(token, batchSlug, subjectSlug, chapterSlug) {
    if (!isDbConnected()) return;
    try {
        const notesData = await dppQuestions(token, batchSlug, subjectSlug, chapterSlug);
        const batch = await Batch.findOne({ slug: batchSlug });
        if (!batch) return;
        const subject = batch.subjects.find(sub => sub.slug === subjectSlug);
        if (!subject) return;
        const chapter = subject.chapters.find(chap => chap.slug === chapterSlug);
        if (!chapter) return;

        for (const note of notesData.data) {
            chapter.dppSch.push({
                topic: note.topic,
                note: note.note,
                pdfName: note.pdfName,
                pdfUrl: note.pdfUrl
            });
        }
        await batch.save();
    } catch (error) {
        console.error('Error saving DPP data:', error.message);
    }
}

export { saveDataToMongoDB, saveAllDataToMongoDB, saveChapterData };
