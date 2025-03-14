import { logger, schemaTask } from "@trigger.dev/sdk/v3";
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

    const username = payload.username;
    const startAt = new Date(leaveRequest.start_at).toISOString();
    const endAt = new Date(leaveRequest.end_at).toISOString();

    // check for overlapping leave requests
    const overlappingLeave = await prisma.leave.findFirst({
      where: {
        username,
        AND: [
          {
            start_at: {
              lte: endAt, // Starts before or exactly when the new leave ends
            },
          },
          {
            end_at: {
              gte: startAt, // Ends after or exactly when the new leave starts
            },
          },
        ],
      },
    });

    let leave: Leave;

    if (overlappingLeave) {
      logger.log("Leave request already exists", { overlappingLeave });
      // Update the leave request
      leave = await prisma.leave.update({
        where: { id: overlappingLeave.id },
        data: {
          ...leaveRequest,
          username,
        },
      });
    } else {
      logger.log("Leave request does not exist, creating new one");
      // Create the leave request
      leave = await prisma.leave.create({
        data: {
          ...leaveRequest,
          username,
        },
      });
    }

    logger.log("Leave request saved", { leave });

    return leave;
  },
});
