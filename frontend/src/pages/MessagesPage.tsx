import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Send, MessageSquare, ArrowLeft, Search, CheckCheck, User, Users, Bell } from 'lucide-react';
import { messagesService, type Conversation, type Message } from '../services/messages.service';
import { useAuth } from '../hooks/useAuth';
import { formatDateTime } from '../utils/format';
import './messages.css';

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: 'Admin',
  MANAGER: 'Yönetici',
  EMPLOYEE: 'Çalışan',
};

export function MessagesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChat, setActiveChat] = useState<string | null>(null);
  const [activeChatUser, setActiveChatUser] = useState<Conversation['user'] | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [unreadCount, setUnreadCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [convs, unread] = await Promise.all([
        messagesService.getConversations(),
        messagesService.getUnreadCount(),
      ]);
      setConversations(convs);
      setUnreadCount(unread);
    } catch (err) {
      console.error('Mesajlar yüklenirken hata:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-open conversation from ?user= query param
  useEffect(() => {
    const targetUserId = searchParams.get('user');
    if (!targetUserId || targetUserId === user?.id || conversations.length === 0 || loading) return;

    const existingConv = conversations.find(c => c.user.id === targetUserId);
    if (existingConv) {
      setActiveChat(existingConv.user.id);
      setActiveChatUser(existingConv.user);
      messagesService.getConversation(targetUserId).then(r => setMessages(r.data)).catch(() => {});
      messagesService.markAllAsRead(targetUserId).catch(() => {});
    }
  }, [searchParams, conversations, loading, user?.id]);

  const openChat = async (otherUser: Conversation['user']) => {
    setActiveChat(otherUser.id);
    setActiveChatUser(otherUser);
    try {
      const result = await messagesService.getConversation(otherUser.id);
      setMessages(result.data);
      await messagesService.markAllAsRead(otherUser.id);
      load();
    } catch (err) {
      console.error('Sohbet yüklenirken hata:', err);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !activeChat) return;
    setSending(true);
    try {
      const msg = await messagesService.send(activeChat, newMessage.trim());
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
      load();
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err) {
      console.error('Mesaj gönderilirken hata:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const filteredConvs = conversations.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.user.firstName.toLowerCase().includes(q) || c.user.lastName.toLowerCase().includes(q);
  });

  const goBack = () => {
    if (activeChat) {
      setActiveChat(null);
      setActiveChatUser(null);
      setMessages([]);
    } else {
      navigate(-1);
    }
  };

  const getUserLabel = (conv: Conversation) => {
    const name = `${conv.user.firstName} ${conv.user.lastName}`;
    const role = ROLE_LABELS[conv.user.role] ?? conv.user.role;
    return `${name} (${role})`;
  };

  return (
    <div className="messages-page">
      <div className="messages-container">
        {/* Sidebar - Conversation List */}
        <div className={`messages-sidebar ${activeChat ? 'hidden-mobile' : ''}`}>
          <div className="messages-sidebar-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <MessageSquare size={18} />
              <h3>Mesajlar</h3>
              {unreadCount > 0 && (
                <span className="badge badge-danger" style={{ fontSize: '0.7rem' }}>{unreadCount}</span>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate(-1)}>✕</button>
          </div>

          <div style={{ padding: '0.5rem 0.75rem' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: 'var(--text-secondary)' }} />
              <input
                className="form-input"
                style={{ paddingLeft: 30, fontSize: '0.8rem' }}
                placeholder="Kişi ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="messages-list">
            {loading ? (
              <div className="loading-spinner" style={{ padding: '2rem' }}>Yükleniyor...</div>
            ) : filteredConvs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                {search ? 'Sonuç bulunamadı.' : 'Henüz mesajınız yok.'}
              </div>
            ) : (
              filteredConvs.map((conv) => (
                <div
                  key={conv.user.id}
                  className={`conv-item ${activeChat === conv.user.id ? 'active' : ''}`}
                  onClick={() => openChat(conv.user)}
                >
                  <div className="conv-avatar">
                    {conv.user.firstName[0]}{conv.user.lastName[0]}
                  </div>
                  <div className="conv-info">
                    <div className="conv-name">
                      {conv.user.firstName} {conv.user.lastName}
                      <span className="conv-role">{ROLE_LABELS[conv.user.role] ?? conv.user.role}</span>
                    </div>
                    <div className="conv-last-msg">
                      {conv.lastMessageSenderId === user?.id && 'Siz: '}
                      {conv.lastMessage.length > 40 ? conv.lastMessage.slice(0, 40) + '...' : conv.lastMessage}
                    </div>
                  </div>
                  <div className="conv-meta">
                    <div className="conv-time">{formatTimeAgo(conv.lastMessageAt)}</div>
                    {conv.unreadCount > 0 && (
                      <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '0.1rem 0.4rem' }}>
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Main Chat Area */}
        <div className={`messages-chat ${!activeChat ? 'hidden-mobile' : ''}`}>
          {!activeChat ? (
            <div className="chat-empty">
              <MessageSquare size={48} style={{ opacity: 0.3 }} />
              <p style={{ marginTop: '0.5rem', opacity: 0.5 }}>Bir sohbet seçin</p>
            </div>
          ) : (
            <>
              <div className="chat-header">
                <button className="btn btn-ghost btn-sm show-mobile" onClick={goBack}>
                  <ArrowLeft size={16} />
                </button>
                <div className="chat-user-info">
                  <div className="chat-user-avatar">
                    {activeChatUser?.firstName[0]}{activeChatUser?.lastName[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {activeChatUser?.firstName} {activeChatUser?.lastName}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                      {ROLE_LABELS[activeChatUser?.role ?? ''] ?? activeChatUser?.role}
                    </div>
                  </div>
                </div>
              </div>

              <div className="chat-messages">
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                    Henüz mesaj yok. İlk mesajı gönderin!
                  </div>
                ) : (
                  messages.map((msg) => {
                    const isMine = msg.senderId === user?.id;
                    return (
                      <div key={msg.id} className={`chat-msg ${isMine ? 'mine' : 'theirs'}`}>
                        {msg.replyTo && (
                          <div className="chat-reply-to">
                            <div style={{ fontSize: '0.7rem', fontWeight: 600 }}>{msg.replyTo.senderId === user?.id ? 'Siz' : 'Yanıt'}</div>
                            <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>{msg.replyTo.message.slice(0, 60)}</div>
                          </div>
                        )}
                        <div className="chat-msg-text">{msg.message}</div>
                        <div className="chat-msg-time">
                          {formatDateTime(msg.createdAt)}
                          {isMine && <CheckCheck size={12} style={{ marginLeft: 4, opacity: msg.isRead ? 1 : 0.4 }} />}
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              <div className="chat-input-area">
                <input
                  ref={inputRef}
                  className="form-input"
                  placeholder="Mesaj yazın..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={sending}
                  autoFocus
                />
                <button
                  className="btn btn-primary"
                  onClick={handleSend}
                  disabled={!newMessage.trim() || sending}
                  style={{ borderRadius: 10 }}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'şimdi';
  if (diffMins < 60) return `${diffMins}d`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}s`;
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
}
