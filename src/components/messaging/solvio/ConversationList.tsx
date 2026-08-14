"use client";

import { useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Search, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import type { Conversation } from "./types";
import { getInitials } from "./normalize";

type FilterTab = "all" | "unread" | "groups";

interface ConversationListProps {
  userId: string;
  conversations: Conversation[];
  loading?: boolean;
  onSelectConversation: (conversationId: string) => void;
  selectedConversationId?: string | null;
}

export function ConversationList({
  userId,
  conversations,
  loading = false,
  onSelectConversation,
  selectedConversationId,
}: ConversationListProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const filteredConversations = useMemo(() => {
    let filtered = conversations;

    switch (activeTab) {
      case "unread":
        filtered = filtered.filter(
          (c) => c.unreadCount && c.unreadCount > 0
        );
        break;
      case "groups":
        filtered = filtered.filter(
          (c) => c.type === "group" || (c.participants?.length || 0) > 2
        );
        break;
      default:
        break;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((conversation) => {
        const others = conversation.participants.filter(
          (p) => p.id !== userId
        );
        return others.some((p) => p.name?.toLowerCase().includes(query));
      });
    }

    return filtered;
  }, [conversations, searchQuery, userId, activeTab]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Tous" },
    { key: "unread", label: "Non lus" },
    { key: "groups", label: "Groupes" },
  ];

  if (loading) {
    return (
      <div className="space-y-2 px-2">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-7 w-16 rounded-full" />
          ))}
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Search */}
      <div className="relative px-2">
        <Search className="absolute left-4.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Rechercher une discussion"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 h-9 bg-muted/50 border-none rounded-full text-sm placeholder:text-muted-foreground/70"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1.5 px-2 pb-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              activeTab === tab.key
                ? "bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300"
                : "text-muted-foreground hover:bg-muted/60"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filteredConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center px-4">
          <p className="text-sm text-muted-foreground">
            {searchQuery
              ? "Aucune conversation trouvée"
              : activeTab === "unread"
              ? "Aucun message non lu"
              : activeTab === "groups"
              ? "Aucune conversation de groupe"
              : "Aucune conversation pour le moment"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchQuery
              ? "Essayez un autre terme de recherche"
              : "Commencez une nouvelle conversation pour démarrer"}
          </p>
        </div>
      ) : (
        filteredConversations.map((conversation) => {
          const others = conversation.participants.filter(
            (p) => p.id !== userId
          );
          const first = others[0];
          const isGroup =
            conversation.type === "group" ||
            (conversation.participants?.length || 0) > 2;
          const hasUnread = conversation.unreadCount > 0;
          const lastContent = conversation.lastMessage?.content || "";
          const lastIsSelf = conversation.lastMessage?.senderId === userId;

          return (
            <div
              key={conversation.id}
              className={cn(
                "flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition-all",
                selectedConversationId === conversation.id
                  ? "bg-blue-50 dark:bg-blue-950/30"
                  : "hover:bg-accent/50"
              )}
              onClick={() => onSelectConversation(conversation.id)}
            >
              {/* Avatar */}
              <div className="relative h-12 w-12 shrink-0">
                <Avatar className="h-12 w-12">
                  {isGroup ? (
                    <AvatarFallback className="bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300">
                      <Users className="h-5 w-5" />
                    </AvatarFallback>
                  ) : first?.avatar ? (
                    <AvatarImage src={first.avatar} alt={first.name} />
                  ) : null}
                  {!isGroup && (
                    <AvatarFallback className="bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 font-semibold text-sm">
                      {getInitials(first?.name || "?")}
                    </AvatarFallback>
                  )}
                </Avatar>
                {!isGroup && (
                  <span className="absolute bottom-0 right-0 block h-3 w-3 rounded-full ring-2 ring-card bg-green-500" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className={cn(
                      "text-sm truncate",
                      hasUnread ? "font-bold" : "font-medium"
                    )}
                  >
                    {others.length > 0
                      ? others.map((p) => p.name).join(", ")
                      : "Conversation sans nom"}
                  </p>
                </div>

                <div className="flex items-center gap-1.5 mt-0.5">
                  <p
                    className={cn(
                      "text-xs truncate flex-1",
                      hasUnread
                        ? "text-foreground font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    {lastContent ? (
                      <>
                        {lastIsSelf && (
                          <span className="font-medium">Vous : </span>
                        )}
                        {lastContent}
                      </>
                    ) : (
                      <span className="italic">Aucun message pour le moment</span>
                    )}
                  </p>
                  {conversation.lastActivityAt && (
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                      · {formatDistanceToNow(
                        new Date(conversation.lastActivityAt),
                        { addSuffix: false }
                      ).replace("about ", "")}
                    </span>
                  )}
                </div>
              </div>

              {hasUnread && (
                <div className="shrink-0">
                  <div className="h-3 w-3 rounded-full bg-blue-600" />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
