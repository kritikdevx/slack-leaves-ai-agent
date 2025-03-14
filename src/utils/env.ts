import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// Define the schema for environment variables
const envSchema = z.object({
  PORT: z
    .string()
    .transform((port) => parseInt(port, 10))
    .default("3000"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  OPENAI_API_KEY: z.string().min(1),
  SLACK_SIGNING_SECRET: z.string().min(1),
  SLACK_APP_TOKEN: z.string().min(1),
  SLACK_BOT_TOKEN: z.string().min(1),
  DATABASE_URL: z.string().min(1),
});

// Parse and validate environment variables
export const env = envSchema.parse(process.env);
