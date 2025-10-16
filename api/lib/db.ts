import mongoose from 'mongoose';

const { MONGODB_URI = '' } = process.env;

if (!MONGODB_URI) {
  console.warn('Warning: MONGODB_URI is not set. Database operations will fail until it is provided.');
}

type MongooseGlobal = typeof globalThis & {
  _mongoose?: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
};

const globalForMongoose = globalThis as MongooseGlobal;

if (!globalForMongoose._mongoose) {
  globalForMongoose._mongoose = { conn: null, promise: null };
}

export async function connectDB(): Promise<typeof mongoose> {
  if (globalForMongoose._mongoose?.conn) {
    return globalForMongoose._mongoose.conn;
  }

  if (!globalForMongoose._mongoose?.promise) {
    const options: mongoose.ConnectOptions = {
      bufferCommands: false
    };

    globalForMongoose._mongoose!.promise = mongoose
      .connect(MONGODB_URI, options)
      .then((mongooseInstance) => mongooseInstance);
  }

  try {
    globalForMongoose._mongoose!.conn = await globalForMongoose._mongoose!.promise!;
  } catch (error) {
    globalForMongoose._mongoose!.promise = null;
    throw error;
  }

  return globalForMongoose._mongoose!.conn!;
}
