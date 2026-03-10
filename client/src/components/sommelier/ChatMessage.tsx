import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useLocation } from "wouter";
import type { ChatMessage as ChatMessageType } from "@/hooks/useSommelierChat";
import { Camera, RotateCcw } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
  onRetry?: (messageId: number) => void;
  onNavigate?: () => void;
}

export function ChatMessage({ message, onRetry, onNavigate }: ChatMessageProps) {
  const isUser = message.role === "user";
  const hasImage = (message.metadata as any)?.hasImage;
  const [, setLocation] = useLocation();

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} px-4 py-1`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? message.failed
              ? "bg-red-900/60 text-white rounded-br-sm border border-red-700/50"
              : "bg-purple-600 text-white rounded-br-sm"
            : "bg-zinc-800 text-zinc-100 rounded-bl-sm"
        }`}
      >
        {hasImage && (
          <div className="flex items-center gap-1.5 text-xs opacity-70 mb-1.5">
            <Camera className="w-3 h-3" />
            <span>Photo attached</span>
          </div>
        )}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <div className="text-sm prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-headings:my-2 prose-strong:text-white">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                a: ({ href, children }) => {
                  if (href?.startsWith("/")) {
                    return (
                      <button
                        onClick={() => {
                          onNavigate?.();
                          setLocation(href);
                        }}
                        className="text-purple-400 underline hover:text-purple-300 cursor-pointer inline"
                      >
                        {children}
                      </button>
                    );
                  }
                  return (
                    <a href={href} target="_blank" rel="noopener noreferrer">
                      {children}
                    </a>
                  );
                },
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}
        {message.failed && onRetry && (
          <button
            onClick={() => onRetry(message.id)}
            className="flex items-center gap-1.5 mt-1.5 text-xs text-red-300 hover:text-white transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            Tap to retry
          </button>
        )}
      </div>
    </div>
  );
}
