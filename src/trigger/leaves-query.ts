import { logger, schemaTask } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { AIService } from "../services/ai.server";
import { prisma } from "../services/db.server";
import { app } from "..";

const schema = z.object({
  channelId: z.string().min(1, "Channel ID is required"),
  query: z.string().min(1, "Query is required"),
  timestamp: z.string().min(1, "Timestamp is required"),
});

const openaiService = new AIService();

export const leavesQueryTask = schemaTask({
  id: "leaves-query",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 60, // Stop executing after 60 secs (1 min) of compute
  schema,
  run: async (payload, { ctx }) => {
    logger.log("Processing leaves query", { payload });

    // Convert the timestamp to a ISO string in IST
    const [seconds, microseconds] = payload.timestamp.split(".").map(Number);
    const timestamp = new Date(
      seconds * 1000 + microseconds / 1000
    ).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    const result = await openaiService.naturalLanguageToSQL(
      payload.query,
      timestamp
    );

    const rawQuery = result
      .toString()
      .replace(/\\n/g, "") // Remove newline characters
      .replace(/\\"/g, '"'); // Replace escaped double quotes with actual double quotes

    const res = await prisma.$queryRawUnsafe(rawQuery).catch((err) => {
      logger.error("Error", { err });
      return null;
    });
  },
});
