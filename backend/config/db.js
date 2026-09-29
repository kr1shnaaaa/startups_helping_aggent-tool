const dotenv = require('dotenv');
const dns = require('dns');
const mongoose = require('mongoose');
const Invitation = require('../models/Invitation');
const migrateInvitationIndexes = require('../scripts/migrateInvitationIndexes');

dotenv.config();
dns.setServers(['1.1.1.1', '1.0.0.1']);

const redactConnectionString = (message) =>
  message.replace(/(mongodb(?:\+srv)?:\/\/)([^@\s]+)@/gi, '$1[REDACTED]@');

const connectToDatabase = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  if (!process.env.MONGODB_DATABASE_NAME) {
    throw new Error('MONGODB_DATABASE_NAME is not configured');
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DATABASE_NAME,
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
      socketTimeoutMS: 20000,
    });

    await migrateInvitationIndexes(Invitation);
    console.log(`MongoDB connected to database: ${process.env.MONGODB_DATABASE_NAME}`);
  } catch (error) {
    console.error('MongoDB connection failed. Check MONGODB_URI, network access, and Atlas IP allowlist.', {
      name: error.name,
      message: redactConnectionString(error.message),
      ...(error.code !== undefined && { code: error.code }),
      ...(error.reason !== undefined && { reason: redactConnectionString(String(error.reason)) }),
    });
    throw error;
  }
};

module.exports = connectToDatabase;
