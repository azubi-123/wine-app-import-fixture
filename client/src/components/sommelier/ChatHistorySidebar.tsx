import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { SquarePen, Trash2, MessageSquare } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SommelierChatSummary } from "@/hooks/useSommelierChat";

interface ChatHistorySidebarProps {
  open: boolean;
  onClose: () => void;
  chatList: SommelierChatSummary[];
  activeChatId: number | null;
  isLoading: boolean;
  onSelectChat: (chatId: number) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: number) => void;
}

// Time grouping helpers
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function groupChatsByTime(chats: SommelierChatSummary[]) {
  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: { label: string; chats: SommelierChatSummary[] }[] = [];

  const todayChats = chats.filter(c => new Date(c.updatedAt) >= today);
  const yesterdayChats = chats.filter(c => {
    const d = new Date(c.updatedAt);
    return d >= yesterday && d < today;
  });
  const weekChats = chats.filter(c => {
    const d = new Date(c.updatedAt);
    return d >= weekAgo && d < yesterday;
  });
  const olderChats = chats.filter(c => new Date(c.updatedAt) < weekAgo);

  if (todayChats.length > 0) groups.push({ label: "Today", chats: todayChats });
  if (yesterdayChats.length > 0) groups.push({ label: "Yesterday", chats: yesterdayChats });
  if (weekChats.length > 0) groups.push({ label: "Previous 7 Days", chats: weekChats });
  if (olderChats.length > 0) groups.push({ label: "Older", chats: olderChats });

  return groups;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Swipe-to-delete chat item for mobile
function SwipeableChatItem({
  chat,
  isActive,
  onSelect,
  onDelete,
}: {
  chat: SommelierChatSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const x = useMotionValue(0);
  const deleteOpacity = useTransform(x, [-80, -40], [1, 0]);
  const deleteScale = useTransform(x, [-80, -40], [1, 0.8]);
  const [swiped, setSwiped] = useState(false);

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Delete button behind */}
      <motion.div
        style={{ opacity: deleteOpacity, scale: deleteScale }}
        className="absolute inset-y-0 right-0 w-20 flex items-center justify-center bg-red-600 rounded-r-xl"
      >
        <Trash2 className="w-5 h-5 text-white" />
      </motion.div>

      {/* Swipeable chat item */}
      <motion.button
        style={{ x }}
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={(_, info) => {
          if (info.offset.x < -60) {
            setSwiped(true);
            animate(x, -80);
          } else {
            setSwiped(false);
            animate(x, 0);
          }
        }}
        onClick={() => {
          if (swiped) {
            onDelete();
          } else {
            onSelect();
          }
        }}
        className={`relative w-full text-left px-4 py-3 rounded-xl transition-colors ${
          isActive
            ? "bg-purple-600/20 border border-purple-500/30"
            : "bg-zinc-800/40 hover:bg-zinc-800/70"
        }`}
      >
        <p className="text-sm text-white truncate font-medium">
          {chat.title || "New conversation"}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          {chat.messageCount} msgs · {formatRelativeTime(chat.updatedAt)}
        </p>
      </motion.button>
    </div>
  );
}

// Desktop chat item with hover trash
function DesktopChatItem({
  chat,
  isActive,
  onSelect,
  onDelete,
}: {
  chat: SommelierChatSummary;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`group relative w-full text-left px-4 py-3 rounded-xl transition-colors ${
        isActive
          ? "bg-purple-600/20 border border-purple-500/30"
          : "hover:bg-zinc-800/70"
      }`}
    >
      <p className="text-sm text-white truncate font-medium pr-8">
        {chat.title || "New conversation"}
      </p>
      <p className="text-xs text-zinc-500 mt-0.5">
        {chat.messageCount} msgs · {formatRelativeTime(chat.updatedAt)}
      </p>

      {/* Hover trash icon */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="absolute top-3 right-3 p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-600/20 text-zinc-500 hover:text-red-400 transition-all"
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </button>
  );
}

function SidebarContent({
  chatList,
  activeChatId,
  isLoading,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClose,
  isMobile,
}: ChatHistorySidebarProps & { isMobile: boolean }) {
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const handleSelect = useCallback((chatId: number) => {
    onSelectChat(chatId);
  }, [onSelectChat]);

  const handleNewChat = useCallback(() => {
    onNewChat();
  }, [onNewChat]);

  const handleDelete = useCallback((chatId: number) => {
    setDeletingId(chatId);
  }, []);

  const confirmDelete = useCallback(() => {
    if (deletingId !== null) {
      onDeleteChat(deletingId);
      setDeletingId(null);
    }
  }, [deletingId, onDeleteChat]);

  const groups = groupChatsByTime(chatList);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* New chat button */}
      <button
        onClick={handleNewChat}
        className="flex items-center gap-3 px-5 py-4 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors"
      >
        <SquarePen className="w-5 h-5 text-zinc-400" />
        <span className="text-sm font-medium text-white">New chat</span>
      </button>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {isLoading ? (
          // Skeleton loader
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse">
                <div className="h-3 bg-zinc-800 rounded w-16 mb-2" />
                <div className="h-14 bg-zinc-800/60 rounded-xl" />
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          // Empty state
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-sm text-zinc-500">No previous conversations</p>
            <p className="text-xs text-zinc-600 mt-1">Your chats with Pierre will appear here</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label}>
              <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-wider px-1 mb-2">
                {group.label}
              </h3>
              <div className="space-y-1">
                {group.chats.map(chat => (
                  isMobile ? (
                    <SwipeableChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onSelect={() => handleSelect(chat.id)}
                      onDelete={() => handleDelete(chat.id)}
                    />
                  ) : (
                    <DesktopChatItem
                      key={chat.id}
                      chat={chat}
                      isActive={chat.id === activeChatId}
                      onSelect={() => handleSelect(chat.id)}
                      onDelete={() => handleDelete(chat.id)}
                    />
                  )
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Delete confirmation overlay */}
      <AnimatePresence>
        {deletingId !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 px-6"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-700 rounded-2xl p-5 w-full max-w-xs"
            >
              <h4 className="text-sm font-semibold text-white mb-1">Delete this chat?</h4>
              <p className="text-xs text-zinc-400 mb-4">This can't be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 py-2 rounded-xl text-sm text-zinc-300 bg-zinc-800 hover:bg-zinc-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-2 rounded-xl text-sm text-white bg-red-600 hover:bg-red-500 transition-colors"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ChatHistorySidebar(props: ChatHistorySidebarProps) {
  const isMobile = useIsMobile();
  const SIDEBAR_WIDTH = isMobile ? "85vw" : 280;

  return (
    <AnimatePresence>
      {props.open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={props.onClose}
            className="absolute inset-0 bg-black/50 z-30"
          />

          {/* Sidebar panel - slides from left */}
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            style={{ width: SIDEBAR_WIDTH }}
            className="absolute top-0 left-0 bottom-0 z-40 shadow-2xl"
          >
            <SidebarContent {...props} isMobile={isMobile} />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
