/**
 * Sketch: Discord bot that replies with colored ANSI ASCII of an attached image.
 * Requires: npm i anime-ascii discord.js
 *
 * Run: DISCORD_TOKEN=... node examples/discord-bot.mjs
 */
import { Client, GatewayIntentBits, AttachmentBuilder } from "discord.js";
import { convertBufferColored } from "anime-ascii";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const token = process.env.DISCORD_TOKEN;
if (!token) {
  console.error("Set DISCORD_TOKEN");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!ascii")) return;
  const attachment = message.attachments.first();
  if (!attachment?.contentType?.startsWith("image/")) {
    await message.reply("Attach an image: `!ascii` + PNG/JPEG");
    return;
  }

  const res = await fetch(attachment.url);
  const buf = Buffer.from(await res.arrayBuffer());
  const { text, html } = await convertBufferColored(buf, {
    look: "ascii",
    quality: "high",
    // portraits / selfies
    style: message.content.includes("anime") ? "anime" : "auto",
  });

  // Discord message limit — send text snippet + HTML file
  const preview = text.length > 1800 ? `${text.slice(0, 1800)}\n…` : text;
  const out = join(tmpdir(), `ascii-${message.id}.html`);
  writeFileSync(
    out,
    `<!doctype html><meta charset=utf-8><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/anime-ascii@0.5.0/ascii.css" />${html}`,
  );
  await message.reply({
    content: "```\n" + preview + "\n```",
    files: [new AttachmentBuilder(out)],
  });
});

client.login(token);
