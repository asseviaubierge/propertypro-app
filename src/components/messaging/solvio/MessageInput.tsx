"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { normalizeMessage } from "./normalize";
import type { Message } from "./types";

interface MessageInputProps {
  conversationId: string;
  onMessageSent: (message: Message) => void;
}

export function MessageInput({
  conversationId,
  onMessageSent,
}: MessageInputProps) {
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: trimmed,
            messageType: "general",
            priority: "normal",
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || body?.message || "Failed to send message");
      }
      const data = await res.json();
      const normalized = normalizeMessage(data?.message);
      if (normalized) {
        onMessageSent(normalized);
      }
      setContent("");
      textareaRef.current?.focus();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send message"
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2 items-end">
        <div className="flex-1 relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[44px] max-h-[200px] resize-none pr-12 rounded-xl border-border/50 bg-background text-sm"
            disabled={sending}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="absolute right-2 bottom-2 h-7 w-7 rounded-full hover:bg-accent"
            disabled
            title="Attachments coming soon"
          >
            <Paperclip className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>

        <Button
          type="submit"
          size="icon"
          disabled={!content.trim() || sending}
          className="h-[44px] w-[44px] shrink-0 rounded-full bg-blue-600 hover:bg-blue-700 text-white"
        >
          {sending ? (
            <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </form>
  );
}
