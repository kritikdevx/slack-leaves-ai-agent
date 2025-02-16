import mongoose from "mongoose";

import logger from "./logger";

import { config } from "../utils/env";
import { ApiError } from "../utils/error";

const connectDB = async (): Promise<void> => {
  try {
    const mongoUri = config.mongodbUri;
    if (!mongoUri) {
      throw new ApiError(
        "MONGODB_URI is not defined in environment variables",
        500
      );
    }

    await mongoose.connect(mongoUri, {});
    logger.info("Connected to MongoDB");
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
