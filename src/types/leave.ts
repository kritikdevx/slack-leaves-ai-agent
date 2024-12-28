export interface LeaveDetails {
  userId: string;
  startTime: Date;
  endTime: Date;
  duration: string;
  reason?: string;
  rawMessage: string;
  created: Date;
}

export interface OpenAILeaveResponse {
  startTime: string;
  endTime: string;
  duration: string;
  reason?: string;
  isWorkingFromHome: boolean;
}
