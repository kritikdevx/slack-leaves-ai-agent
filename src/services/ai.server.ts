import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { JsonOutputParser } from "@langchain/core/output_parsers";
import { LeaveType } from "@prisma/client";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export class AIService {
  private openai35: ChatOpenAI;
  private openai4o: ChatOpenAI;
  private gemini: ChatGoogleGenerativeAI;

  constructor() {
    this.openai35 = new ChatOpenAI({
      modelName: "gpt-3.5-turbo",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });
    this.openai4o = new ChatOpenAI({
      modelName: "gpt-4o",
      temperature: 0,
      openAIApiKey: process.env.OPENAI_API_KEY!,
    });
    this.gemini = new ChatGoogleGenerativeAI({
      modelName: "gemini-1.5-flash",
      apiKey: process.env.GEMINI_API_KEY!,
    });
  }

  /**
   * Check if a message is related to a leave request
   */
  async isLeaveRelated(message: string): Promise<boolean> {
    const promptTemplate = PromptTemplate.fromTemplate(`
      Analyze the following message and determine if it's related to any type of absence or modified work arrangement.
      
      Respond with "yes" if the message indicates ANY of the following:
      - Time off (vacation, sick leave, personal days)
      - Running late or delayed arrival
      - Early departure or leaving before end of workday
      - Working from home or remotely
      - Stepping out for appointments
      - Any temporary absence during work hours
      - Out of office notifications
      
      Otherwise respond with "no".
      
      Examples that should return "yes":
      - "I'm taking tomorrow off"
      - "Working from home today"
      - "Running late, will be there by 11" 
      - "Need to step out for an appointment"
      - "Not feeling well, taking sick leave"
      - "Will be late by 30 minutes"
      - "Leaving early at 4pm for doctor's appointment"
      
      Examples that should return "no":
      - "Good morning everyone"
      - "What's the status of the project?"
      - "Could you please review this document?"
      - "Let's schedule a meeting next week"
      
      Message: {message}
    `);

    // Create a chain to process the message
    const isLeaveRelatedChain = promptTemplate
      .pipe(this.gemini)
      .pipe(new StringOutputParser());

    // Check if the message is leave-related
    const result = await isLeaveRelatedChain.invoke({
      message,
    });

    // TODO: Validate the result
    return result.trim().toLowerCase() === "yes";
  }

  /**
   * Parse leave request details from a message
   */
  async parseLeaveRequest(
    message: string,
    timestamp: string
  ): Promise<any | null> {
    try {
      // Define the schema for JSON output to match Prisma model
      const leaveRequestSchema = z.object({
        start_at: z.string(), // DateTime in ISO format
        end_at: z.string(), // DateTime in ISO format
        reason: z.string().optional(),
        duration: z.string(),
        type: z.enum([
          LeaveType.WFH,
          LeaveType.RUNNING_LATE,
          LeaveType.SICK,
          LeaveType.VACATION,
          LeaveType.OTHER,
        ]),
        original_text: z.string(), // The original message
        duration_in_seconds: z.number(),
      });

      // Create the system prompt for leave request parsing with proper escaping
      const promptTemplate = PromptTemplate.fromTemplate<{
        original_text: string;
        timestamp: string;
      }>(`
        You are a leave management assistant. Analyze the message and extract the required details based on the following rules:
        
        ### **Leave Request Parser**
        **Office Hours:**  
        - **Weekdays (Monday – Friday):** 9:00 AM – 6:00 PM (IST)  
        - **Saturday:** 9:00 AM – 1:00 PM (IST)  
        - **Sunday:** Office is closed
        
        **Task:** Parse the user's message: "{original_text}" (sent at {timestamp} IST)
        
        **Required Output Format:** Return a JSON object with these exact fields:
        - \`start_at\`: Starting time of leave/event (ISO string in IST)
        - \`end_at\`: Ending time of leave/event (ISO string in IST)
        - \`duration\`: Auto-generated human-readable description of duration (e.g., "2 hours", "Full day", "Half day")
        - \`reason\`: The reason for leave (if provided), otherwise null
        - \`type\`: Auto-determined as one of: "WFH", "RUNNING_LATE", "SICK", "VACATION", "OTHER"
        - \`original_text\`: Include the original message text here
        - \`duration_in_seconds\`: Duration of the leave in seconds (calculated from start_at and end_at)
        
        ### **Time Parsing Rules:**
        1. **Non-Working Days (Sunday & Post-Hours Saturday Handling):**
          - If the message is received on **Sunday**, **shift the leave request to Monday**.
          - If the message is received on **Saturday after 1:00 PM**, **shift the leave request to Monday**.
          - If a specific date is mentioned and it falls on a **Sunday**, assume the request is for the next working day (Monday).

        2. **Out-of-Office Request Handling:**
          - If timestamp is before 9:00 AM or after 6:00 PM on weekdays, assume request is for next working day
          - If timestamp is Saturday after 1:00 PM, assume request is for Monday
          - If timestamp is Sunday, assume request is for Monday unless specified otherwise
          - If the day mentioned is a past date, assume it's for the next occurrence of that day
        
        3. **Default Times:**
          - If no start time specified: use current timestamp
          - If no end time specified: use 6:00 PM (weekdays) or 1:00 PM (Saturday)
          - For "full day" leave: 9:00 AM to 6:00 PM (weekdays) or 9:00 AM to 1:00 PM (Saturday)
          - For "half day - first half": 9:00 AM to 1:00 PM
          - For "half day - second half": 1:00 PM to 6:00 PM (weekdays) or 1:00 PM (Saturday)
          - For "few hours", "couple of hours": Assume 2 hours from current timestamp
        
        4. **Type Classification Rules (Auto-Generated):**
          - If message contains "sick", "unwell", "not feeling good", "fever", "doctor": type="SICK"
          - If message contains "vacation", "holiday", "trip", "travel", "touring": type="VACATION"
          - If message contains "wfh", "working from home", "remote work": type="WFH"
          - If message contains "late", "delay", "delayed", "running late": type="RUNNING_LATE"
          - If none of the above match: type="OTHER"
        
        ### **Edge Cases Handling:**
        1. **Invalid or Non-Leave Messages:**
          - If message doesn't relate to leave/absence/WFH (e.g., "Hello", "Good morning"), return a complete JSON object but mark it with type="OTHER"
          - If message is too ambiguous to parse confidently, use type="OTHER"
        
        2. **Time Ambiguity Resolution:**
          - Ambiguous times like "11" should be interpreted as 11:00 AM
          - "Tomorrow" refers to the next calendar day
          - "Next week" refers to the same day next week
          - For date ranges (e.g., "Jan 5-7"), set appropriate start_at and end_at times
        
        3. **Duration Calculation (Auto-Generated):**
          - Calculate duration as the time difference between start_at and end_at
          - For multi-day leaves, count only working hours (9AM-6PM weekdays, 9AM-1PM Saturdays)
          - Maximum single leave request should not exceed 30 days
        
        4. **Special Phrases Handling:**
          - "Taking day off" → Full day leave (type="OTHER")
          - "OOO for X hours" → Leave for X hours from current timestamp (type="OTHER")
          - "Not available in morning/first half" → Half-day leave (9:00 AM – 1:00 PM) (type="OTHER")
          - "Not available in afternoon/second half" → Half-day leave (1:00 PM – 6:00 PM) (type="OTHER")
          - "Running late, will be in by X" → type="RUNNING_LATE", start_at="9:00 AM", end_at=specified time X
          - "Leaving early at X" → type="OTHER", start_at=current time, end_at=specified time X
        
        ### **Example Mappings:**
        - "Taking sick leave today" → RESULT: SICK type with Full day duration
        - "WFH today" → RESULT: WFH type with Full day duration
        - "Running late, will be in by 11" → RESULT: RUNNING_LATE type with 2 hours duration, from 9:00 AM to 11:00 AM
        - "Leaving at 3pm for doctor's appointment" → RESULT: SICK type with 3 hours duration, from 3:00 PM to 6:00 PM
        - "On vacation next week Mon-Wed" → RESULT: VACATION type with 3 days duration, from Monday 9:00 AM to Wednesday 6:00 PM
        - "Need to step out for 1 hour for personal work" → RESULT: OTHER type with 1 hour duration
        
        Analyze the message carefully and return a properly formatted JSON object matching the schema. Ensure all times are in ISO format with the correct timezone (IST).
        Be sure to include the original_text field with the exact message that was provided.
      `);

      // Create the JSON parser
      const parser = new JsonOutputParser<z.infer<typeof leaveRequestSchema>>();

      // Create the chain
      const leaveParsingChain = promptTemplate.pipe(this.gemini).pipe(parser);

      // Invoke the chain with the message and timestamp
      const result = await leaveParsingChain.invoke({
        original_text: message,
        timestamp: timestamp,
      });

      // TODO: Validate the result
      return result;
    } catch (error) {
      console.error("LangChain Error:", error);
      return null;
    }
  }
}
