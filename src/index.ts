import { App } from "@slack/bolt";
import { env } from "./utils/env";
import logger from "./libs/logger";
import { leaveTask } from "./trigger/leave";
import { leavesQueryTask } from "./trigger/leaves-query";

export const app = new App({
  token: env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: env.SLACK_APP_TOKEN,
  signingSecret: env.SLACK_SIGNING_SECRET,
  port: env.PORT,
});

app.message("", async ({ message, say }) => {
  try {
    const ts = message.ts;
    let text = "";

    if (message.type === "message" && !message.subtype) {
      text = message.text || "";
    }
    if (!text) {
      throw new Error("No text found");
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
      username: userResult?.user?.name || "anonymous",
      message: text,
      timestamp: ts,
    });
  } catch (error) {
    logger.error("Error", { error });
  }
});

app.command("/query", async ({ command, context, body, ack, say }) => {
  await ack();

  const text = command.text;

  const res = await say("Processing your query...");

  const ts =
    res?.ts ||
    res?.message?.ts ||
    `${new Date().getTime()}.${new Date().getMilliseconds()}`;

  await leavesQueryTask.trigger({
    channelId: body.channel_id,
    query: text,
    timestamp: ts,
  });
});

(async () => {
  // Start your app
  await app.start();

  app.logger.info("⚡️ Bolt app is running!");
})();
