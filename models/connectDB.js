import mongoose from 'mongoose'
import dotenv from 'dotenv';
dotenv.config();

; (async () => {
  try {
    await mongoose.connect(`${process.env.MONGODB_URL}`, {
      serverSelectionTimeoutMS: 5000,
      family: 4
    });
    console.log('MongoDB Connected successfully.');
  } catch (err) {
    console.log('\n=============================================');
    console.log('⚠️  STARTUP WARNING: MongoDB Connection FAILED');
    console.log('   App will continue to run, but DB features will be unavailable.');
    
    if (err.name === 'MongooseServerSelectionError' || err.message.includes('ENOTFOUND') || err.message.includes('ETIMEDOUT') || err.message.includes('ECONNREFUSED')) {
        console.log('   Reason: Likely an IP whitelist issue (MongoDB Atlas) OR DNS/Network path failure.');
        console.log('   Please check your MongoDB Atlas Network Access settings (add IP 0.0.0.0/0 or your current IP).');
    } else {
        console.log('   Reason:', err.message || err);
    }
    console.log('=============================================\n');
  }
})();