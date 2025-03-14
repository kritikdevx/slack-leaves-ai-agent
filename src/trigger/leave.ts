import { logger, schemaTask, wait } from "@trigger.dev/sdk/v3";
import { z } from "zod";
import { AIService } from "../services/ai.server";
import { prisma } from "../services/db.server";
import { Leave } from "@prisma/client";

const schema = z.object({
  username: z.string().min(1, "Username is required"),
  timestamp: z.string().min(1, "Timestamp is required"),
  message: z.string().min(1, "Message is required"),
});

const openaiService = new AIService();

export const leaveTask = schemaTask({
  id: "leave",
  // Set an optional maxDuration to prevent tasks from running indefinitely
  maxDuration: 60, // Stop executing after 60 secs (1 min) of compute
  schema,
  run: async (payload, { ctx }) => {
    logger.log("Processing leave message", { payload });

    // Convert the timestamp to a ISO string in IST
    const [seconds, microseconds] = payload.timestamp.split(".").map(Number);
    const timestamp = new Date(
      seconds * 1000 + microseconds / 1000
    ).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

    // Check if the message is related to a leave request
    const isLeaveRelated = await openaiService.isLeaveRelated(payload.message);
    logger.log("Is leave related message", { isLeaveRelated });

    // If the message is not related to a leave request, return
    if (!isLeaveRelated) {
      logger.log("Message is not leave related", { payload, ctx });
      return;
    }

    // Parse the leave request
    const leaveRequest = await openaiService.parseLeaveRequest(
      payload.message,
      timestamp
    );

    logger.log("Leave message parsed", { leaveRequest });

    // Check if the leave request already exists with the same username and date range
    const existingLeave = await prisma.leave.findFirst({
      where: {
        username: payload.username,
        OR: [
          { start_at: { not: leaveRequest.start_at } },
          { end_at: { not: leaveRequest.end_at } },
        ],
      },
    });

    let leave: Leave;

    if (existingLeave) {
      logger.log("Leave request already exists", { existingLeave });
      // Update the leave request
      leave = await prisma.leave.update({
        where: { id: existingLeave.id },
        data: {
          ...leaveRequest,
          username: payload.username,
        },
      });
    } else {
      logger.log("Leave request does not exist, creating new one");
      // Create the leave request
      leave = await prisma.leave.create({
        data: {
          ...leaveRequest,
          username: payload.username,
        },
      });
    }

    logger.log("Leave request saved", { leave });

    return leave;
  },
});
