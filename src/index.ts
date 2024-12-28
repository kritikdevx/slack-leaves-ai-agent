import { App } from "@slack/bolt";
import { OpenAIService } from "./services/openai.service";

require("dotenv").config();

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  port: Number(process.env.PORT!) || 3000,
});

app.message("", async ({ message, say }) => {
  const ts = message.ts;
  let text = "";

  if (message.type === "message" && !message.subtype) {
    text = message.text || "";
  }

  let userResult;
  if ("user" in message) {
    userResult = await app.client.users.info({
      token: process.env.SLACK_BOT_TOKEN,
      user: message.user as string,
    });
  }

  const [seconds, microseconds] = ts.split(".").map(Number);
  const timestamp = new Date(
    seconds * 1000 + microseconds / 1000
  ).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" });

  const openaiService = new OpenAIService();
  const response = await openaiService.parseLeaveRequest(text, timestamp);

  console.log(response);
});

(async () => {
  // Start your app
  await app.start();

  app.logger.info("⚡️ Bolt app is running!");
})();
