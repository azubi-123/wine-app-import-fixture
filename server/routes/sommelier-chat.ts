/**
 * Sommelier Chat Routes
 * API endpoints for AI sommelier chat with SSE streaming and vision support.
 * ChatGPT-style: always open to a fresh chat, sidebar shows history.
 */

import type { Express, Request, Response } from "express";
import multer from "multer";
import { requireAuth } from "./auth";
import { apiRateLimit, createRateLimit } from "../middleware/rateLimiter";
import { storage } from "../storage";
import { streamChatResponse, generateChatTitle } from "../services/sommelierChatService";

// Rate limit for chat messages: 15/min
const sommelierChatRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 15,
  message: "Slow down! Wait a moment before sending more messages.",
});

// Multer for image uploads (memory storage, max 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

export function registerSommelierChatRoutes(app: Express): void {
  /**
   * GET /api/sommelier-chat/active
   * Returns empty state for a fresh chat (no eager DB creation).
   * The chat record is only created when the first message is sent.
   */
  app.get("/api/sommelier-chat/active", requireAuth, apiRateLimit, async (_req: Request, res: Response) => {
    return res.json({ chat: null, messages: [] });
  });

  /**
   * POST /api/sommelier-chat/welcome
   * Persist a welcome message as a new chat (called after onboarding).
   */
  app.post("/api/sommelier-chat/welcome", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const { content } = req.body;

      if (!content || typeof content !== "string") {
        return res.status(400).json({ error: "Content is required" });
      }

      const chat = await storage.createSommelierChat({ userId, title: "Welcome to Cata", messageCount: 0 });
      const message = await storage.createSommelierMessage({
        chatId: chat.id,
        role: "assistant",
        content,
      });

      return res.json({ chatId: chat.id, message });
    } catch (error) {
      console.error("[SommelierChat] Welcome message error:", error);
      return res.status(500).json({ error: "Failed to save welcome message" });
    }
  });

  /**
   * GET /api/sommelier-chat/list
   * Get all user chats with messages (newest first)
   */
  app.get("/api/sommelier-chat/list", requireAuth, apiRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const chats = await storage.getUserSommelierChats(userId);
      return res.json({ chats });
    } catch (error) {
      console.error("[SommelierChat] Error listing chats:", error);
      return res.status(500).json({ error: "Failed to list chats" });
    }
  });

  /**
   * GET /api/sommelier-chat/:chatId
   * Load a specific chat + last 50 messages. Validates ownership.
   */
  app.get("/api/sommelier-chat/:chatId", requireAuth, apiRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const chatId = parseInt(req.params.chatId, 10);

      if (isNaN(chatId)) {
        return res.status(400).json({ error: "Invalid chat ID" });
      }

      const chat = await storage.getSommelierChatById(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      const messages = await storage.getSommelierChatMessages(chatId, 50);
      return res.json({ chat, messages });
    } catch (error) {
      console.error("[SommelierChat] Error getting chat:", error);
      return res.status(500).json({ error: "Failed to load chat" });
    }
  });

  /**
   * DELETE /api/sommelier-chat/:chatId
   * Hard-delete a chat and its messages (cascade). Validates ownership.
   */
  app.delete("/api/sommelier-chat/:chatId", requireAuth, apiRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const chatId = parseInt(req.params.chatId, 10);

      if (isNaN(chatId)) {
        return res.status(400).json({ error: "Invalid chat ID" });
      }

      const chat = await storage.getSommelierChatById(chatId, userId);
      if (!chat) {
        return res.status(404).json({ error: "Chat not found" });
      }

      await storage.deleteSommelierChat(chatId);
      return res.status(204).send();
    } catch (error) {
      console.error("[SommelierChat] Error deleting chat:", error);
      return res.status(500).json({ error: "Failed to delete chat" });
    }
  });

  /**
   * POST /api/sommelier-chat/backfill-titles
   * One-time: generate titles for all untitled chats using their first message.
   */
  app.post("/api/sommelier-chat/backfill-titles", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const chats = await storage.getUserSommelierChats(userId);
      const untitled = chats.filter((c) => !c.title);

      let updated = 0;
      for (const chat of untitled) {
        const messages = await storage.getSommelierChatMessages(chat.id, 50);
        const firstUserMsg = messages.find((m) => m.role === "user");
        if (firstUserMsg) {
          await generateChatTitle(chat.id, firstUserMsg.content);
          updated++;
        }
      }

      return res.json({ updated, total: untitled.length });
    } catch (error) {
      console.error("[SommelierChat] Backfill error:", error);
      return res.status(500).json({ error: "Failed to backfill titles" });
    }
  });

  /**
   * POST /api/sommelier-chat/message
   * Send a text message, returns SSE stream.
   * Accepts optional chatId — if not provided, creates a new chat.
   * Auto-sets title from first user message (truncated to 50 chars).
   */
  app.post("/api/sommelier-chat/message", requireAuth, sommelierChatRateLimit, async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userEmail = req.session.userEmail!;
      const { message, chatId } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ error: "Message is required" });
      }

      if (message.length > 2000) {
        return res.status(400).json({ error: "Message is too long (max 2000 characters)" });
      }

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Detect client disconnect to stop streaming early
      let clientDisconnected = false;
      req.on("close", () => { clientDisconnected = true; });

      const { stream } = await streamChatResponse(userId, userEmail, message.trim(), undefined, undefined, chatId || undefined);

      // Don't break on disconnect -- let generator complete so assistant message is saved
      for await (const event of stream) {
        if (!clientDisconnected) {
          try { res.write(event); } catch { /* response already closed */ }
        }
      }

      if (!clientDisconnected) res.end();
    } catch (error) {
      console.error("[SommelierChat] Error sending message:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Something went wrong. Try again." })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({ error: "Failed to send message" });
      }
    }
  });

  /**
   * POST /api/sommelier-chat/message-with-image
   * Send a text message with an image, returns SSE stream
   */
  app.post("/api/sommelier-chat/message-with-image", requireAuth, sommelierChatRateLimit, upload.single("image"), async (req: Request, res: Response) => {
    try {
      const userId = req.session.userId!;
      const userEmail = req.session.userEmail!;
      const message = req.body.message || "What can you tell me about these wines?";
      const chatId = req.body.chatId ? parseInt(req.body.chatId, 10) : undefined;

      if (!req.file) {
        return res.status(400).json({ error: "Image is required" });
      }

      const imageBase64 = req.file.buffer.toString("base64");
      const imageMimeType = req.file.mimetype;

      // Set SSE headers
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Detect client disconnect to stop streaming early
      let clientDisconnected = false;
      req.on("close", () => { clientDisconnected = true; });

      const { stream } = await streamChatResponse(
        userId,
        userEmail,
        message.trim(),
        imageBase64,
        imageMimeType,
        chatId
      );

      // Don't break on disconnect -- let generator complete so assistant message is saved
      for await (const event of stream) {
        if (!clientDisconnected) {
          try { res.write(event); } catch { /* response already closed */ }
        }
      }

      if (!clientDisconnected) res.end();
    } catch (error) {
      console.error("[SommelierChat] Error sending message with image:", error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ type: "error", message: "Something went wrong. Try again." })}\n\n`);
        res.end();
      } else {
        return res.status(500).json({ error: "Failed to send message" });
      }
    }
  });
}
