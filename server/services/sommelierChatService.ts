/**
 * Sommelier Chat Service
 * Core logic for AI sommelier chat: message handling, streaming, context assembly.
 * Supports lazy chat creation (chat created on first message, not on open).
 */

import { requireOpenAI, getOpenAIClient } from "../lib/openai";
import { storage } from "../storage";
import { sanitizeForPrompt } from "../lib/sanitize";
import { buildSystemPrompt } from "./sommelierContextBuilder";
import type { SommelierChat, SommelierMessage } from "@shared/schema";
import { triggerCompactionIfNeeded } from "./chatCompactionService";

interface ChatContext {
  chat: SommelierChat;
  userEmail: string;
}

/**
 * Get an existing chat or create a new one.
 * If chatId is provided, looks up that chat. Otherwise creates a new chat.
 */
async function resolveChat(userId: number, chatId?: number): Promise<SommelierChat> {
  if (chatId) {
    const existing = await storage.getSommelierChatById(chatId, userId);
    if (existing) return existing;
  }

  return storage.createSommelierChat({
    userId,
    title: null,
    summary: null,
    messageCount: 0,
  });
}

/**
 * Generate a short chat title from the first user message using GPT-5-mini.
 * Awaited so the title is set before the chat list is refetched.
 */
export async function generateChatTitle(chatId: number, userMessage: string): Promise<void> {
  try {
    console.log(`[SommelierChat] Generating title for chat ${chatId}...`);
    const client = getOpenAIClient();
    if (!client) {
      console.log(`[SommelierChat] No OpenAI client, using fallback title`);
      await storage.updateSommelierChat(chatId, { title: userMessage.slice(0, 50) });
      return;
    }

    const completion = await client.chat.completions.create({
      model: "gpt-5-mini",
      messages: [
        {
          role: "system",
          content: "Generate a very short title (3-6 words max) for a wine chat conversation. No quotes, no punctuation at end. Just the topic.",
        },
        { role: "user", content: userMessage.slice(0, 200) },
      ],
      max_completion_tokens: 20,
    });

    const title = completion.choices[0]?.message?.content?.trim();
    console.log(`[SommelierChat] Generated title for chat ${chatId}: "${title}"`);
    await storage.updateSommelierChat(chatId, { title: (title || userMessage).slice(0, 100) });
  } catch (err: any) {
    console.error("[SommelierChat] Title generation failed, using fallback:", err.message);
    await storage.updateSommelierChat(chatId, { title: userMessage.slice(0, 50) });
  }
}

/**
 * Build the messages array for the OpenAI API call.
 * Includes system prompt, recent messages, and the new user message.
 */
async function buildMessagesForAPI(
  ctx: ChatContext,
  userMessage: string,
  imageBase64?: string,
  imageMimeType?: string
): Promise<Array<any>> {
  const systemPrompt = await buildSystemPrompt(ctx.userEmail, ctx.chat.summary);

  // Get last 10 uncompacted messages for context
  const recentMessages = await storage.getSommelierChatMessages(ctx.chat.id, 10);

  const messages: any[] = [
    { role: "system", content: systemPrompt },
  ];

  // Add recent conversation history
  for (const msg of recentMessages) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add new user message
  if (imageBase64 && imageMimeType) {
    messages.push({
      role: "user",
      content: [
        { type: "text", text: userMessage },
        {
          type: "image_url",
          image_url: {
            url: `data:${imageMimeType};base64,${imageBase64}`,
            detail: "high",
          },
        },
      ],
    });
  } else {
    messages.push({ role: "user", content: userMessage });
  }

  return messages;
}

/**
 * Send a message and get a streaming response.
 * Returns an async iterable of SSE events.
 * If no chatId provided, creates a new chat and auto-titles it from the first message.
 */
export async function streamChatResponse(
  userId: number,
  userEmail: string,
  messageText: string,
  imageBase64?: string,
  imageMimeType?: string,
  chatId?: number
): Promise<{
  userMessageId: number;
  stream: AsyncIterable<string>;
  onComplete: (fullContent: string) => Promise<number>;
}> {
  const openai = requireOpenAI();
  const chat = await resolveChat(userId, chatId);
  const isNewChat = !chatId;
  const sanitizedMessage = sanitizeForPrompt(messageText, 2000);

  // Save user message
  const userMsg = await storage.createSommelierMessage({
    chatId: chat.id,
    role: "user",
    content: sanitizedMessage,
    metadata: imageBase64 ? { hasImage: true } : null,
  });

  // Fire title generation without blocking the stream start
  if (isNewChat || !chat.title) {
    generateChatTitle(chat.id, sanitizedMessage).catch(err => {
      console.error("[SommelierChat] Title generation failed:", err);
    });
  }

  const ctx: ChatContext = { chat, userEmail };
  const apiMessages = await buildMessagesForAPI(ctx, sanitizedMessage, imageBase64, imageMimeType);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: apiMessages,
    max_completion_tokens: 1000,
    stream: true,
  });

  // Create async iterable that yields SSE-formatted strings
  async function* generateSSE(): AsyncIterable<string> {
    // Include chatId in start event so frontend can track which chat this belongs to
    yield `data: ${JSON.stringify({ type: "start", messageId: userMsg.id, chatId: chat.id })}\n\n`;

    let fullContent = "";
    for await (const chunk of completion) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) {
        fullContent += delta;
        yield `data: ${JSON.stringify({ type: "token", content: delta })}\n\n`;
      }
    }

    // Save assistant message
    const assistantMsg = await storage.createSommelierMessage({
      chatId: chat.id,
      role: "assistant",
      content: fullContent,
      metadata: { model: "gpt-5.2" },
    });

    // Trigger compaction asynchronously
    triggerCompactionIfNeeded(chat.id);

    yield `data: ${JSON.stringify({ type: "done", messageId: assistantMsg.id, fullContent })}\n\n`;
    yield `data: [DONE]\n\n`;
  }

  return {
    userMessageId: userMsg.id,
    stream: generateSSE(),
    onComplete: async (fullContent: string) => {
      // This is handled inside generateSSE now
      return 0;
    },
  };
}

/**
 * Non-streaming version for simpler use cases / testing
 */
export async function sendChatMessage(
  userId: number,
  userEmail: string,
  messageText: string,
  imageBase64?: string,
  imageMimeType?: string,
  chatId?: number
): Promise<{ userMessage: SommelierMessage; assistantMessage: SommelierMessage }> {
  const openai = requireOpenAI();
  const chat = await resolveChat(userId, chatId);
  const isNewChat = !chatId;
  const sanitizedMessage = sanitizeForPrompt(messageText, 2000);

  // Save user message
  const userMessage = await storage.createSommelierMessage({
    chatId: chat.id,
    role: "user",
    content: sanitizedMessage,
    metadata: imageBase64 ? { hasImage: true } : null,
  });

  // Fire title generation without blocking the response
  if (isNewChat || !chat.title) {
    generateChatTitle(chat.id, sanitizedMessage).catch(err => {
      console.error("[SommelierChat] Title generation failed:", err);
    });
  }

  const ctx: ChatContext = { chat, userEmail };
  const apiMessages = await buildMessagesForAPI(ctx, sanitizedMessage, imageBase64, imageMimeType);

  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    messages: apiMessages,
    max_completion_tokens: 1000,
  });

  const responseContent = completion.choices[0]?.message?.content || "I couldn't come up with a response. Try rephrasing?";

  const assistantMessage = await storage.createSommelierMessage({
    chatId: chat.id,
    role: "assistant",
    content: responseContent,
    metadata: { model: "gpt-5.2" },
  });

  // Trigger compaction asynchronously
  triggerCompactionIfNeeded(chat.id);

  return { userMessage, assistantMessage };
}
