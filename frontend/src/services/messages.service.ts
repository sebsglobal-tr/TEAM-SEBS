import { api } from './api';

export interface MessageUser {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  message: string;
  isRead: boolean;
  replyToId?: string;
  sender?: MessageUser;
  receiver?: MessageUser;
  replyTo?: Message;
  createdAt: string;
  updatedAt: string;
}

export interface Conversation {
  user: MessageUser;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  lastMessageSenderId: string;
}

export interface ConversationMessages {
  data: Message[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export const messagesService = {
  send: (receiverId: string, message: string, replyToId?: string) =>
    api.post<Message>('/messages', { receiverId, message, replyToId }).then((r) => r.data),

  getConversations: () =>
    api.get<Conversation[]>('/messages/conversations').then((r) => r.data),

  getConversation: (userId: string, page?: number) =>
    api.get<ConversationMessages>(`/messages/conversation/${userId}`, {
      params: { page, limit: 50 },
    }).then((r) => r.data),

  getUnreadCount: () =>
    api.get<number>('/messages/unread-count').then((r) => r.data),

  markAsRead: (id: string) =>
    api.patch(`/messages/${id}/read`).then((r) => r.data),

  markAllAsRead: (userId: string) =>
    api.patch(`/messages/read-all/${userId}`).then((r) => r.data),

  search: (query: string) =>
    api.get<Message[]>('/messages/search', { params: { q: query } }).then((r) => r.data),
};
