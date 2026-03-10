import { useState, useCallback, useRef, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  imageDescription?: string | null;
  metadata?: any;
  createdAt: string;
  isStreaming?: boolean;
  failed?: boolean;
}

export interface SommelierChatSummary {
  id: number;
  userId: number;
  title: string | null;
  summary: string | null;
  messageCount: number;
  updatedAt: string;
  createdAt: string;
}

export function useSommelierChat(isOpen: boolean) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoadingChat, setIsLoadingChat] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingImageFiles = useRef<Map<number, File>>(new Map());
  const queryClient = useQueryClient();

  // Chat list for sidebar (only chats with messages, newest first)
  const { data: chatListData, isLoading: isLoadingChatList } = useQuery({
    queryKey: ["/api/sommelier-chat/list"],
    queryFn: async () => {
      const res = await fetch("/api/sommelier-chat/list", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chat list");
      return res.json() as Promise<{ chats: SommelierChatSummary[] }>;
    },
    enabled: isOpen,
    staleTime: 10000,
  });

  const chatList = chatListData?.chats ?? [];

  // Abort any active stream when Pierre closes
  useEffect(() => {
    if (!isOpen) {
      abortControllerRef.current?.abort();
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isOpen]);

  const parseSSEStream = useCallback(async (
    response: Response,
    optimisticUserMsg: ChatMessage
  ) => {
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let fullContent = "";
    let buffer = "";

    // Add placeholder assistant message
    const streamingMsg: ChatMessage = {
      id: -1,
      role: "assistant",
      content: "",
      createdAt: new Date().toISOString(),
      isStreaming: true,
    };

    setMessages(prev => [...prev, streamingMsg]);

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6).trim();
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);
            if (event.type === "start" && event.chatId) {
              // Track the chatId from the server (for new chats)
              setActiveChatId(event.chatId);
            } else if (event.type === "token") {
              fullContent += event.content;
              setStreamingContent(fullContent);
              setMessages(prev => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last && last.isStreaming) {
                  updated[updated.length - 1] = { ...last, content: fullContent };
                }
                return updated;
              });
            } else if (event.type === "done") {
              // Replace streaming message with final message
              setMessages(prev => {
                const updated = [...prev];
                const lastIdx = updated.length - 1;
                if (updated[lastIdx]?.isStreaming) {
                  updated[lastIdx] = {
                    id: event.messageId,
                    role: "assistant",
                    content: event.fullContent || fullContent,
                    createdAt: new Date().toISOString(),
                    isStreaming: false,
                  };
                }
                return updated;
              });
            } else if (event.type === "error") {
              setError(event.message);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreaming) return;

    setError(null);
    setIsStreaming(true);
    setStreamingContent("");

    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: text.trim(),
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMsg]);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const res = await fetch("/api/sommelier-chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), chatId: activeChatId }),
        credentials: "include",
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to send message" }));
        throw new Error(err.error || "Failed to send message");
      }

      await parseSSEStream(res, optimisticMsg);

      // Refresh chat list so new chat shows up in sidebar
      queryClient.invalidateQueries({ queryKey: ["/api/sommelier-chat/list"] });
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Something went wrong. Try again.");
      // Keep the user's message but mark it as failed; remove streaming placeholder
      setMessages(prev => prev
        .filter(m => m.id !== -1)
        .map(m => m.id === optimisticMsg.id ? { ...m, failed: true } : m)
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isStreaming, activeChatId, parseSSEStream, queryClient]);

  const sendMessageWithImage = useCallback(async (text: string, imageFile: File) => {
    if (isStreaming) return;

    setError(null);
    setIsStreaming(true);
    setStreamingContent("");

    const optimisticMsg: ChatMessage = {
      id: Date.now(),
      role: "user",
      content: text.trim() || "What can you tell me about these wines?",
      metadata: { hasImage: true },
      createdAt: new Date().toISOString(),
    };

    setMessages(prev => [...prev, optimisticMsg]);
    pendingImageFiles.current.set(optimisticMsg.id, imageFile);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const formData = new FormData();
      formData.append("message", text.trim() || "What can you tell me about these wines?");
      formData.append("image", imageFile);
      if (activeChatId) {
        formData.append("chatId", String(activeChatId));
      }

      const res = await fetch("/api/sommelier-chat/message-with-image", {
        method: "POST",
        body: formData,
        credentials: "include",
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to send message" }));
        throw new Error(err.error || "Failed to send message");
      }

      await parseSSEStream(res, optimisticMsg);

      // Image sent successfully — no longer needed for retry
      pendingImageFiles.current.delete(optimisticMsg.id);

      // Refresh chat list
      queryClient.invalidateQueries({ queryKey: ["/api/sommelier-chat/list"] });
    } catch (err: any) {
      if (err.name === "AbortError") return;
      setError(err.message || "Something went wrong. Try again.");
      // Keep the user's message but mark it as failed; remove streaming placeholder
      setMessages(prev => prev
        .filter(m => m.id !== -1)
        .map(m => m.id === optimisticMsg.id ? { ...m, failed: true } : m)
      );
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  }, [isStreaming, activeChatId, parseSSEStream, queryClient]);

  // Load a specific chat from history
  const loadChat = useCallback(async (chatId: number) => {
    setIsLoadingChat(true);
    setError(null);
    try {
      const res = await fetch(`/api/sommelier-chat/${chatId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load chat");
      const data = await res.json();
      setMessages(data.messages);
      setActiveChatId(chatId);
    } catch (err: any) {
      setError(err.message || "Failed to load chat");
    } finally {
      setIsLoadingChat(false);
    }
  }, []);

  // Delete a chat
  const deleteChat = useCallback(async (chatId: number) => {
    try {
      await fetch(`/api/sommelier-chat/${chatId}`, {
        method: "DELETE",
        credentials: "include",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/sommelier-chat/list"] });

      // If we deleted the active chat, reset to fresh state
      if (chatId === activeChatId) {
        setMessages([]);
        setActiveChatId(null);
      }
    } catch {
      setError("Failed to delete chat");
    }
  }, [activeChatId, queryClient]);

  // Start a new chat (just resets local state)
  const startNewChat = useCallback(() => {
    setMessages([]);
    setActiveChatId(null);
    setError(null);
  }, []);

  // Retry a failed message (supports both text-only and image messages)
  const retryMessage = useCallback((messageId: number) => {
    const failedMsg = messages.find(m => m.id === messageId && m.failed);
    if (!failedMsg) return;
    // Remove the failed message and resend
    setMessages(prev => prev.filter(m => m.id !== messageId));
    const pendingImage = pendingImageFiles.current.get(messageId);
    if (pendingImage) {
      pendingImageFiles.current.delete(messageId);
      sendMessageWithImage(failedMsg.content, pendingImage);
    } else {
      sendMessage(failedMsg.content);
    }
  }, [messages, sendMessage, sendMessageWithImage]);

  const cancelStream = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  // Set a persisted welcome message (from POST /api/sommelier-chat/welcome)
  const setWelcomeState = useCallback((chatId: number, msg: ChatMessage) => {
    setActiveChatId(chatId);
    setMessages([msg]);
    queryClient.invalidateQueries({ queryKey: ["/api/sommelier-chat/list"] });
  }, [queryClient]);

  const clearError = useCallback(() => setError(null), []);

  return {
    messages,
    activeChatId,
    chatList,
    isLoading: false, // No initial load needed — always starts fresh
    isLoadingChat,
    isLoadingChatList,
    isStreaming,
    error,
    sendMessage,
    sendMessageWithImage,
    loadChat,
    deleteChat,
    startNewChat,
    cancelStream,
    retryMessage,
    setWelcomeState,
    clearError,
  };
}
