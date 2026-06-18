import mongoose from "mongoose";
import { ensureLocalMongoForDevelopment } from "./devMongo";

const DEFAULT_MONGODB_URI = "mongodb://localhost:27017/uptime-monitor";
const MONGODB_SERVER_SELECTION_TIMEOUT_MS = 5000;

const describeMongoTarget = (mongoURI: string): string => {
  try {
    const parsed = new URL(mongoURI);
    return parsed.host || mongoURI;
  } catch {
    return mongoURI;
  }
};

export const connectDB = async (): Promise<void> => {
  const mongoURI = process.env.MONGODB_URI || DEFAULT_MONGODB_URI;
  const mongoTarget = describeMongoTarget(mongoURI);

  try {
    await ensureLocalMongoForDevelopment(mongoURI);
    console.log(`Connecting to MongoDB on ${mongoTarget}...`);

    await mongoose.connect(mongoURI, {
      serverSelectionTimeoutMS: MONGODB_SERVER_SELECTION_TIMEOUT_MS,
    });

    console.log(`MongoDB connected successfully (${mongoTarget})`);

    mongoose.connection.on("error", (err) => {
      console.error("MongoDB runtime error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      console.log("MongoDB disconnected");
    });
  } catch (error) {
    console.error(
      `MongoDB connection failed (${mongoTarget}). Run "npm run mongo:dev" from backend/ or update MONGODB_URI in backend/.env.`,
    );
    console.error(error);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log("MongoDB disconnected");
  } catch (error) {
    console.error("Error while disconnecting from MongoDB:", error);
  }
};
