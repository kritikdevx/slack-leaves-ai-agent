import { App } from "@slack/bolt";
import { env } from "./utils/env";
import logger from "./libs/logger";
import { leaveTask } from "./trigger/leave";

const app = new App({
  token: env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: env.SLACK_APP_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  port: env.PORT,
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

  logger.info("Message", { text, ts, userResult });

  await leaveTask.trigger({
    username: userResult?.user?.name || "Unknown",
    message: text,
    timestamp: ts,
  });
});

(async () => {
  // Start your app
  await app.start();

  app.logger.info("⚡️ Bolt app is running!");
})();
