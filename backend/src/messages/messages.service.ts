import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class MessagesService {
  constructor(private prisma: PrismaService) {}

  async send(receiverId: string, message: string, senderId: string, replyToId?: string) {
    if (!message?.trim()) {
      throw new Error('Mesaj boş olamaz');
    }

    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId, deletedAt: null },
    });
    if (!receiver) {
      throw new NotFoundException('Alıcı bulunamadı');
    }

    const msg = await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        message: message.trim(),
        replyToId: replyToId || null,
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        receiver: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
    });

    return msg;
  }

  async getConversations(userId: string) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    // Toplu kullanıcı sorgusu: tüm unique karşı taraf ID'lerini tek seferde al
    const otherUserIds = [...new Set(
      messages.map(m => m.senderId === userId ? m.receiverId : m.senderId)
    )];

    const otherUsers = otherUserIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: otherUserIds } },
          select: { id: true, firstName: true, lastName: true, role: true },
        })
      : [];

    const userMap = new Map(otherUsers.map(u => [u.id, u]));

    // Group by other user
    const conversationMap = new Map<string, {
      user: { id: string; firstName: string; lastName: string; role: string };
      lastMessage: string;
      lastMessageAt: Date;
      unreadCount: number;
      lastMessageSenderId: string;
    }>();

    for (const msg of messages) {
      const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
      const existing = conversationMap.get(otherId);
      if (!existing) {
        const otherUser = msg.senderId === userId
          ? userMap.get(msg.receiverId) ?? null
          : msg.sender;

        if (!otherUser) continue;

        conversationMap.set(otherId, {
          user: otherUser,
          lastMessage: msg.message,
          lastMessageAt: msg.createdAt,
          unreadCount: (!msg.isRead && msg.receiverId === userId) ? 1 : 0,
          lastMessageSenderId: msg.senderId,
        });
      } else {
        if (msg.createdAt > existing.lastMessageAt) {
          existing.lastMessage = msg.message;
          existing.lastMessageAt = msg.createdAt;
          existing.lastMessageSenderId = msg.senderId;
        }
        if (!msg.isRead && msg.receiverId === userId) {
          existing.unreadCount += 1;
        }
      }
    }

    return Array.from(conversationMap.values())
      .sort((a, b) => b.lastMessageAt.getTime() - a.lastMessageAt.getTime());
  }

  async getConversation(userId: string, otherUserId: string, page: number = 1, limit: number = 50) {
    const skip = (page - 1) * limit;

    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, role: true } },
        replyTo: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    });

    const total = await this.prisma.message.count({
      where: {
        OR: [
          { senderId: userId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: userId },
        ],
      },
    });

    return {
      data: messages.reverse(),
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    };
  }

  async getUnreadCount(userId: string) {
    return this.prisma.message.count({
      where: { receiverId: userId, isRead: false },
    });
  }

  async markAsRead(messageId: string, userId: string) {
    const msg = await this.prisma.message.findUnique({ where: { id: messageId } });
    if (!msg) throw new NotFoundException('Mesaj bulunamadı');
    if (msg.receiverId !== userId) throw new ForbiddenException('Bu mesajı okuyamazsınız');

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  async markAllAsRead(userId: string, otherUserId: string) {
    await this.prisma.message.updateMany({
      where: { senderId: otherUserId, receiverId: userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }
}
