/**
 * PropertyPro - Enhanced Messaging Service
 * Service for managing real-time messaging and communication
 */

import { Message } from "@/models";
import { IMessage, UserRole } from "@/types";
import mongoose from "mongoose";

export interface CreateMessageParams {
  senderId: string;
  recipientId?: string;
  recipientIds?: string[]; // For group messages
  propertyId?: string;
  subject: string;
  content: string;
  messageType?:
    | "general"
    | "maintenance"
    | "payment"
    | "lease"
    | "emergency"
    | "announcement";
  priority?: "low" | "normal" | "high" | "urgent";
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
  }>;
  replyToId?: string;
  isSystemMessage?: boolean;
  scheduledFor?: Date;
}

export interface MessageQueryParams {
  conversationId?: string;
  senderId?: string;
  recipientId?: string;
  propertyId?: string;
  messageType?: string;
  priority?: string;
  status?: string;
  unreadOnly?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface ConversationSummary {
  conversationId: string;
  participants: Array<{
    userId: string;
    name: string;
    avatar?: string;
    role: string;
  }>;
  lastMessage: {
    content: string;
    senderId: string;
    senderName: string;
    createdAt: Date;
    isRead: boolean;
  };
  unreadCount: number;
  propertyId?: string;
  propertyName?: string;
  messageType: string;
  priority: string;
}

export interface AnnouncementParams {
  title: string;
  content: string;
  priority: "low" | "normal" | "high" | "urgent";
  targetAudience: {
    roles?: UserRole[];
    propertyIds?: string[];
    userIds?: string[];
    tenantIds?: string[];
  };
  scheduledFor?: Date;
  expiresAt?: Date;
  attachments?: Array<{
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
  }>;
  actionButton?: {
    text: string;
    url: string;
  };
}

export class MessagingService {
  // Create a new message
  async createMessage(params: CreateMessageParams): Promise<IMessage> {
    const {
      senderId,
      recipientId,
      recipientIds = [],
      propertyId,
      subject,
      content,
      messageType = "general",
      priority = "normal",
      attachments = [],
      replyToId,
      isSystemMessage = false,
      scheduledFor,
    } = params;

    // Handle group messages
    if (recipientIds.length > 0) {
      const messages: IMessage[] = [];

      for (const recipientId of recipientIds) {
        const conversationId = Message.createConversationId(
          senderId,
          recipientId,
          propertyId
        );

        const message = new Message({
          conversationId,
          senderId: new mongoose.Types.ObjectId(senderId),
          recipientId: new mongoose.Types.ObjectId(recipientId),
          propertyId: propertyId
            ? new mongoose.Types.ObjectId(propertyId)
            : undefined,
          subject,
          content,
          messageType,
          priority,
          attachments,
          replyToId: replyToId
            ? new mongoose.Types.ObjectId(replyToId)
            : undefined,
          isSystemMessage,
        });

        await message.save();
        messages.push(message);
      }

      // Return the first message (they're all similar)
      return messages[0];
    }

    // Single recipient message
    if (!recipientId) {
      throw new Error("Recipient ID is required for single messages");
    }

    const conversationId = Message.createConversationId(
      senderId,
      recipientId,
      propertyId
    );

    const message = new Message({
      conversationId,
      senderId: new mongoose.Types.ObjectId(senderId),
      recipientId: new mongoose.Types.ObjectId(recipientId),
      propertyId: propertyId
        ? new mongoose.Types.ObjectId(propertyId)
        : undefined,
      subject,
      content,
      messageType,
      priority,
      attachments,
      replyToId: replyToId ? new mongoose.Types.ObjectId(replyToId) : undefined,
      isSystemMessage,
    });

    await message.save();

    // Populate related data
    await message.populate([
      { path: "senderId", select: "firstName lastName email avatar" },
      { path: "recipientId", select: "firstName lastName email avatar" },
      { path: "propertyId", select: "name address" },
      { path: "replyToId", select: "subject content senderId" },
    ]);

    return message;
  }

  // Get messages with filtering and pagination
  async getMessages(params: MessageQueryParams): Promise<{
    messages: IMessage[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const {
      conversationId,
      senderId,
      recipientId,
      propertyId,
      messageType,
      priority,
      status,
      unreadOnly = false,
      page = 1,
      limit = 20,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = params;

    // Build query
    const query: any = { deletedAt: null };

    if (conversationId) query.conversationId = conversationId;
    if (senderId) query.senderId = new mongoose.Types.ObjectId(senderId);
    if (recipientId)
      query.recipientId = new mongoose.Types.ObjectId(recipientId);
    if (propertyId) query.propertyId = new mongoose.Types.ObjectId(propertyId);
    if (messageType) query.messageType = messageType;
    if (priority) query.priority = priority;
    if (status) query.status = status;
    if (unreadOnly) query.readAt = { $exists: false };

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const sortOptions: any = {};
    sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

    const [messages, total] = await Promise.all([
      Message.find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .populate([
          { path: "senderId", select: "firstName lastName email avatar" },
          { path: "recipientId", select: "firstName lastName email avatar" },
          { path: "propertyId", select: "name address" },
          { path: "replyToId", select: "subject content senderId" },
        ])
        .lean(),
      Message.countDocuments(query),
    ]);

    return {
      messages: messages as IMessage[],
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // Get conversation summaries for a user
  async getConversations(
    userId: string,
    limit: number = 20
  ): Promise<ConversationSummary[]> {
    const pipeline = [
      {
        $match: {
          $or: [
            { senderId: new mongoose.Types.ObjectId(userId) },
            { recipientId: new mongoose.Types.ObjectId(userId) },
          ],
          deletedAt: null,
        },
      },
      {
        $sort: { createdAt: -1 },
      },
      {
        $group: {
          _id: "$conversationId",
          lastMessage: { $first: "$$ROOT" },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    {
                      $eq: [
                        "$recipientId",
                        new mongoose.Types.ObjectId(userId),
                      ],
                    },
                    { $eq: ["$readAt", null] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.senderId",
          foreignField: "_id",
          as: "sender",
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "lastMessage.recipientId",
          foreignField: "_id",
          as: "recipient",
        },
      },
      {
        $lookup: {
          from: "properties",
          localField: "lastMessage.propertyId",
          foreignField: "_id",
          as: "property",
        },
      },
      {
        $limit: limit,
      },
    ];

    const conversations = await Message.aggregate(pipeline);

    return conversations.map((conv) => {
      const sender = conv.sender[0];
      const recipient = conv.recipient[0];
      const property = conv.property[0];

      // Determine the other participant (not the current user)
      const otherParticipant =
        sender._id.toString() === userId ? recipient : sender;

      return {
        conversationId: conv._id,
        participants: [
          {
            userId: sender._id.toString(),
            name: `${sender.firstName} ${sender.lastName}`,
            avatar: sender.avatar,
            role: sender.role,
          },
          {
            userId: recipient._id.toString(),
            name: `${recipient.firstName} ${recipient.lastName}`,
            avatar: recipient.avatar,
            role: recipient.role,
          },
        ],
        lastMessage: {
          content: conv.lastMessage.content,
          senderId: conv.lastMessage.senderId.toString(),
          senderName: `${sender.firstName} ${sender.lastName}`,
          createdAt: conv.lastMessage.createdAt,
          isRead: !!conv.lastMessage.readAt,
        },
        unreadCount: conv.unreadCount,
        propertyId: property?._id?.toString(),
        propertyName: property?.name,
        messageType: conv.lastMessage.messageType,
        priority: conv.lastMessage.priority,
      };
    });
  }

  // Mark message as read
  async markAsRead(messageId: string, userId: string): Promise<boolean> {
    const result = await Message.updateOne(
      {
        _id: messageId,
        recipientId: new mongoose.Types.ObjectId(userId),
        readAt: null,
      },
      {
        $set: {
          status: "read",
          readAt: new Date(),
        },
      }
    );

    return result.modifiedCount > 0;
  }

  // Mark all messages in a conversation as read
  async markConversationAsRead(
    conversationId: string,
    userId: string
  ): Promise<number> {
    const result = await Message.updateMany(
      {
        conversationId,
        recipientId: new mongoose.Types.ObjectId(userId),
        readAt: null,
      },
      {
        $set: {
          status: "read",
          readAt: new Date(),
        },
      }
    );

    return result.modifiedCount;
  }

  // Delete message (soft delete)
  async deleteMessage(messageId: string, userId: string): Promise<boolean> {
    const message = await Message.findById(messageId);
    if (!message) return false;

    // Only sender can delete their own messages
    if (message.senderId.toString() !== userId) return false;

    const result = await Message.findByIdAndUpdate(
      messageId,
      { deletedAt: new Date() },
      { new: true }
    );

    return !!result;
  }

  // Get unread message count for a user
  async getUnreadCount(userId: string): Promise<number> {
    return await Message.countDocuments({
      recipientId: new mongoose.Types.ObjectId(userId),
      readAt: null,
      deletedAt: null,
    });
  }

  // Search messages
  async searchMessages(
    userId: string,
    query: string,
    options?: {
      propertyId?: string;
      messageType?: string;
      limit?: number;
    }
  ): Promise<IMessage[]> {
    const { propertyId, messageType, limit = 20 } = options || {};

    const searchQuery: any = {
      $or: [
        { senderId: new mongoose.Types.ObjectId(userId) },
        { recipientId: new mongoose.Types.ObjectId(userId) },
      ],
      $text: { $search: query },
      deletedAt: null,
    };

    if (propertyId) {
      searchQuery.propertyId = new mongoose.Types.ObjectId(propertyId);
    }

    if (messageType) {
      searchQuery.messageType = messageType;
    }

    const messages = await Message.find(searchQuery)
      .sort({ score: { $meta: "textScore" }, createdAt: -1 })
      .limit(limit)
      .populate([
        { path: "senderId", select: "firstName lastName email avatar" },
        { path: "recipientId", select: "firstName lastName email avatar" },
        { path: "propertyId", select: "name address" },
      ])
      .lean();

    return messages as IMessage[];
  }

  // Create announcement (broadcast message)
  async createAnnouncement(
    params: AnnouncementParams,
    createdBy: string
  ): Promise<any> {
    const {
      title,
      content,
      priority,
      targetAudience,
      scheduledFor,
      expiresAt,
      attachments = [],
      actionButton,
    } = params;

    // Import Announcement model dynamically to avoid circular dependencies
    const { default: Announcement } = await import("@/models/Announcement");

    const announcement = new Announcement({
      title,
      content,
      priority,
      type: "general",
      targetAudience,
      scheduledFor,
      expiresAt,
      attachments,
      actionButton,
      status: scheduledFor ? "scheduled" : "published",
      publishedAt: scheduledFor ? undefined : new Date(),
      createdBy: new mongoose.Types.ObjectId(createdBy),
    });

    await announcement.save();

    // If publishing immediately, send notifications
    if (!scheduledFor) {
      await this.sendAnnouncementNotifications(announcement);
    }

    return announcement;
  }

  // Send notifications for announcement
  private async sendAnnouncementNotifications(
    announcement: any
  ): Promise<void> {
    try {
      // Import User model dynamically
      const { default: User } = await import("@/models/User");

      // Build query to find target users
      const userQuery: any = { isActive: true };

      if (!announcement.targetAudience.includeAll) {
        const orConditions: any[] = [];

        if (announcement.targetAudience.roles?.length > 0) {
          orConditions.push({
            role: { $in: announcement.targetAudience.roles },
          });
        }

        if (announcement.targetAudience.userIds?.length > 0) {
          orConditions.push({
            _id: { $in: announcement.targetAudience.userIds },
          });
        }

        if (orConditions.length > 0) {
          userQuery.$or = orConditions;
        }
      }

      const targetUsers = await User.find(userQuery).select(
        "_id email firstName lastName"
      );

      // Send notifications to each user
      for (const user of targetUsers) {
        // Create individual messages for each user
        await this.createMessage({
          senderId: announcement.createdBy.toString(),
          recipientId: user._id.toString(),
          subject: `📢 ${announcement.title}`,
          content: announcement.content,
          messageType: "announcement",
          priority: announcement.priority,
          attachments: announcement.attachments,
          isSystemMessage: true,
        });
      }
    } catch (error) {
      console.error("Failed to send announcement notifications:", error);
    }
  }
}

export const messagingService = new MessagingService();
