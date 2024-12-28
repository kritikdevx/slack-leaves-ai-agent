import OpenAI from "openai";
import { OpenAILeaveResponse } from "../types/leave";
import { openai as openAI } from "../libs/openai";

export class OpenAIService {
  private openai: OpenAI;

  constructor() {
    this.openai = openAI;
  }

  async parseLeaveRequest(
    message: string,
    timestamp: string
  ): Promise<OpenAILeaveResponse | null> {
    try {
      const completion = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are a leave management assistant. Analyze the message and extract the required details based on the following rules:
  
            Timestamp of the Message: ${timestamp} (IST)
        
            **Office Timings**: 9:00 AM to 6:00 PM (IST)
            
            **Response Format**: Return a JSON object with the following keys:
            - \`startTime\`: The starting time of the leave or event (ISO string in IST).
            - \`endTime\`: The ending time of the leave or event (ISO string in IST).
            - \`duration\`: A human-readable description of the duration.
            - \`reason\` (optional): The reason provided in the message (if available).
            - \`isWorkingFromHome\`: \`true\` if the user mentions working from home, otherwise \`false\`.
            - \`isLeaveRequest\`: \`true\` if the message indicates a leave request, otherwise \`false\`.
            - \`isRunningLate\`: \`true\` if the user mentions being late, otherwise \`false\`.
        
            **Rules for Time Parsing**:
            1. Messages referencing times after 6:00 PM should be interpreted as events for the **next day**.
            2. Messages referencing times before 9:00 AM should be interpreted as events for the **same day**.
            3. If the message contains only a time (e.g., "11"), assume it refers to **11:00 AM** within office hours.
            4. If the user mentions "running late, will be there by [time]":
                - Set the \`startTime\` as the office start time (9:00 AM).
                - Set the \`endTime\` to the mentioned time.
                - Calculate the \`duration\` from 9:00 AM to the mentioned time.
            5. If the user does not specify a start time:
                - Assume the current timestamp as the start time.
            6. If the user does not specify an end time:
                - Assume the end of the day (6:00 PM) as the default end time.
            7. If the user does not specify a duration:
                - Consider it a **full-day leave** by default.
        
            **Additional Rules**:
            - If the timestamp of the message is after 6:00 PM, interpret any mentioned time or event as happening on the **next day**.
            - If the message mentions "running late," use the specified time (e.g., "by 11:00 AM") as the arrival time. If no time is mentioned, assume the user will arrive in 1 hour.
            - If the message mentions "leaving early," use the specified time as the end time. If no time is mentioned, consider the current timestamp as the start time and 6:00 PM as the end time.
            - If the message mentions "working from home," set \`isWorkingFromHome\` to \`true\` and do not consider it a leave request.
        
            **Examples**:
            - "Taking day off today" → Full-day leave from 9:00 AM to 6:00 PM today.
            - "OOO for 2 hours" → Leave for 2 hours from the current timestamp.
            - "Lunch break 30 mins" → Leave for 30 minutes from the current timestamp.
            - "Visiting doctor tomorrow morning" → Half-day leave tomorrow morning from 9:00 AM to 1:00 PM.
            - "WFH this afternoon" → Not a leave request, set \`isWorkingFromHome\` to \`true\`.
            - "Not feeling well, taking sick leave" → Full-day sick leave from 9:00 AM to 6:00 PM today.
            - "Not available in first half" → Half-day leave from 9:00 AM to 1:00 PM.
            - "Not available in second half" → Half-day leave from 1:00 PM to 6:00 PM.
            - "Running late, will be there by 11:00 AM" → Late arrival with \`startTime\` at 9:00 AM and \`endTime\` at 11:00 AM.
            - "Leaving early" → Early leave starting from the current timestamp and ending at 6:00 PM today.
            - "Leaving early at 5:00 PM today" → Early leave from the current timestamp to 5:00 PM today.
            - "Working from home today" → Working from home, not a leave request.
            - "Leaving early today" → Early leave from the current timestamp to 6:00 PM today.
            - "11" → Assume 11:00 AM as the referenced time within office hours.
            - "Leaving at 11" → Leaving at 11:00 AM within office hours.
            `,
          },
          {
            role: "user",
            content: message,
          },
        ],
        temperature: 0,
        response_format: { type: "json_object" },
      });

      const content = completion.choices[0].message.content;
      if (content) {
        return JSON.parse(content) as OpenAILeaveResponse | null;
      } else {
        throw new Error("OpenAI response content is null");
      }
    } catch (error) {
      console.error("OpenAI Error:", error);
      return null;
    }
  }
}
