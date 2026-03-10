import { useRef, useEffect, useState } from "react";
import { ChatMessage } from "./ChatMessage";
import { TypingIndicator } from "./TypingIndicator";
import type { ChatMessage as ChatMessageType } from "@/hooks/useSommelierChat";

interface MessageListProps {
  messages: ChatMessageType[];
  isStreaming: boolean;
  onRetryMessage?: (messageId: number) => void;
  onNavigate?: () => void;
}

export function MessageList({ messages, isStreaming, onRetryMessage, onNavigate }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isStreaming, autoScroll]);

  // Detect when user scrolls up to pause auto-scroll
  const handleScroll = () => {
    const container = containerRef.current;
    if (!container) return;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isAtBottom);
  };

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-y-auto py-4 space-y-1"
      onScroll={handleScroll}
    >
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} onRetry={onRetryMessage} onNavigate={onNavigate} />
      ))}
      {isStreaming && !messages[messages.length - 1]?.isStreaming && (
        <TypingIndicator />
      )}
      <div ref={bottomRef} />
    </div>
  );
}
