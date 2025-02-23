import { Document, Schema, model } from "mongoose";

export interface ILeave extends Document {
  _id: string;
  user: string; // User name
  original_text: string; // Original text of the leave/event
  start_time: Date; // Start time of the leave/event (ISO string in IST)
  end_time: Date; // End time of the leave/event (ISO string in IST)
  duration: string; // Human-readable duration (e.g., "2 hours", "Full day")
  reason?: string; // Optional reason for leave
  is_working_from_home: boolean; // True if WFH, false if it's leave
  is_leave_request: boolean; // True if the user requested a leave
  is_running_late: boolean; // True if the user mentioned being late
  created_at: Date;
  updated_at: Date;
}

const leaveSchema = new Schema<ILeave>(
  {
    user: { type: String, required: true, trim: true, lowercase: true },
    original_text: { type: String, required: true, trim: true },
    start_time: { type: Date, required: true },
    end_time: { type: Date, required: true },
    duration: { type: String, required: true },
    reason: { type: String, trim: true },
    is_working_from_home: { type: Boolean, default: false },
    is_leave_request: { type: Boolean, default: false },
    is_running_late: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "created_at", updatedAt: "updated_at" } }
);

export const Leave = model<ILeave>("Leave", leaveSchema);
