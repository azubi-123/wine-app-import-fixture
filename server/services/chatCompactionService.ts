/**
 * Chat Compaction Service
 * Rolling summary compaction for sommelier chat conversations.
 * Runs asynchronously after each assistant response to keep context bounded.
 */

import { requireOpenAI } from "../lib/openai";
import { storage } from "../storage";
import { db } from "../db";
import { sommelierChats, sommelierMessages } from "@shared/schema";
import { eq } from "drizzle-orm";

const COMPACTION_THRESHOLD = 10;
const MAX_SUMMARY_WORDS = 200;

/**
 * Check if compaction is needed and run it asynchronously.
 * Call this after every assistant response.
 */
export function triggerCompactionIfNeeded(chatId: number): void {
  runCompaction(chatId).catch((err) => {
    console.error("[Compaction] Error during compaction:", err);
  });
}

async function runCompaction(chatId: number): Promise<void> {
  const messagesToCompact = await storage.getUncompactedMessages(chatId, COMPACTION_THRESHOLD);
  if (messagesToCompact.length === 0) return;

  const [chatRecord] = await db
    .select()
    .from(sommelierChats)
    .where(eq(sommelierChats.id, chatId))
    .limit(1);

  if (!chatRecord) return;

  const existingSummary = chatRecord.summary || "";

  const messagesText = messagesToCompact
    .map((m) => {
      const prefix = m.role === "user" ? "User" : "Pierre";
      const imageNote = (m.metadata as any)?.hasImage ? " [sent a wine photo]" : "";
      return `${prefix}${imageNote}: ${m.content}`;
    })
    .join("\n");

  const prompt = existingSummary
    ? `Update this conversation summary with the new messages below. Keep the summary under ${MAX_SUMMARY_WORDS} words. Preserve key facts: wine preferences mentioned, specific wines discussed, recommendations made, photos analyzed.

EXISTING SUMMARY:
${existingSummary}

NEW MESSAGES TO INCORPORATE:
${messagesText}

Updated summary:`
    : `Summarize this conversation between a wine taster and Pierre, their AI sommelier. Keep under ${MAX_SUMMARY_WORDS} words. Capture: wine preferences discussed, specific wines mentioned, recommendations made, photos analyzed.

MESSAGES:
${messagesText}

Summary:`;

  try {
    const openai = requireOpenAI();
    const completion = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "You produce concise, factual conversation summaries for Pierre, an AI sommelier. Preserve specific wine names, user preferences, and recommendations. No commentary.",
        },
        { role: "user", content: prompt },
      ],
      max_completion_tokens: 300,
    });

    const summary = completion.choices[0]?.message?.content?.trim();
    if (!summary) return;

    // Add image descriptions for image messages before compacting
    for (const msg of messagesToCompact) {
      if ((msg.metadata as any)?.hasImage && msg.role === "user") {
        const idx = messagesToCompact.indexOf(msg);
        const nextAssistant = messagesToCompact.slice(idx + 1).find((m) => m.role === "assistant");
        if (nextAssistant) {
          const description = nextAssistant.content.substring(0, 200);
          await db
            .update(sommelierMessages)
            .set({ imageDescription: `Photo analyzed: ${description}` })
            .where(eq(sommelierMessages.id, msg.id));
        }
      }
    }

    // Update chat summary
    await storage.updateSommelierChat(chatId, {
      summary,
      lastSummaryAt: new Date(),
    });

    // Mark messages as compacted
    await storage.markMessagesCompacted(messagesToCompact.map((m) => m.id));

    console.log(`[Compaction] Chat ${chatId}: compacted ${messagesToCompact.length} messages`);
  } catch (error) {
    console.error("[Compaction] Failed to generate summary:", error);
  }
}
