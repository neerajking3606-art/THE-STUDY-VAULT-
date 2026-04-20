import mongoose from 'mongoose'
import dotenv from 'dotenv';
dotenv.config();

const MONGODB_URL = process.env.MONGODB_URL;

if (!MONGODB_URL) {
  throw new Error('Please define the MONGODB_URL environment variable inside .env or Vercel Settings');
}

let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

const connectDB = async () => {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
      serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
      family: 4, // Use IPv4, skip trying IPv6
      maxPoolSize: 10 // Maintain up to 10 socket connections
    };

    console.log('Connecting to MongoDB...');
    cached.promise = mongoose.connect(MONGODB_URL, opts).then((mongoose) => {
      console.log('MongoDB Connected successfully.');
      return mongoose;
    }).catch(err => {
      console.error('\n=============================================');
      console.error('⚠️  MongoDB Connection FAILED');
      console.error('   Please check your IP Access List (0.0.0.0/0) in MongoDB Atlas');
      console.error('   Error:', err.message);
      console.error('=============================================\n');
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    cached.promise = null; // Reset the promise so a new attempt can be made on next request
    throw error;
  }
};

export default connectDB;
