import { Bell, BellOff, CirclePlus, FileText, Film, Image, Info, LockKeyhole, MessageCircle, Mic, Phone, Pin, Search, Send, SmilePlus, UserPlus, Users } from 'lucide-react'

import { formatVietnamTime, getConversationDisplayName } from '@/services/messages/formatters'
import type { Conversation, NotificationItem } from '@/types'
import { cn } from '@/utils'

type MessagesSidebarProps = {
  initials: string
  userId?: number
  conversations: Conversation[]
  selectedConversationId: string | null
  notifications: NotificationItem[]
  searchTerm: string
  setSearchTerm: (value: string) => void
  isLoadingConversations?: boolean
  activeRailTab: 'messages' | 'newMessage' | 'createGroup' | 'notifications' | 'calls'
  onOpenConversation: (conversationId: string) => void
  onShowMessages: () => void
  onShowNotifications: () => void
  onShowCalls: () => void
  onShowNewMessage: () => void
  onShowCreateGroup: () => void
}

export function MessagesSidebar({
  initials,
  userId,
  conversations,
  selectedConversationId,
  notifications,
  searchTerm,
  setSearchTerm,
  isLoadingConversations = false,
  activeRailTab,
  onOpenConversation,
  onShowMessages,
  onShowNotifications,
  onShowCalls,
  onShowNewMessage,
  onShowCreateGroup,
}: MessagesSidebarProps) {
  const visibleConversations = conversations

  return (
    <>
      <aside className="hidden w-[56px] shrink-0 flex-col items-center border-r border-gray-200 bg-white py-3 md:flex lg:w-[60px]">
        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white">
          <MessageCircle size={20} />
        </div>
        <nav className="flex flex-col items-center gap-1">
          <button type="button" className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700', activeRailTab === 'messages' && 'bg-blue-50 text-blue-600')} onClick={onShowMessages} title="Tin nhắn" aria-label="Tin nhắn">
            <Send size={16} />
          </button>
          <button type="button" className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700', activeRailTab === 'newMessage' && 'bg-blue-50 text-blue-600')} onClick={onShowNewMessage} title="Tạo hội thoại mới" aria-label="Tạo hội thoại mới">
            <UserPlus size={16} />
          </button>
          <button type="button" className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700', activeRailTab === 'createGroup' && 'bg-blue-50 text-blue-600')} onClick={onShowCreateGroup} title="Tạo nhóm" aria-label="Tạo nhóm">
            <CirclePlus size={16} />
          </button>
          <button type="button" className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700', activeRailTab === 'notifications' && 'bg-blue-50 text-blue-600')} onClick={onShowNotifications} title="Thông báo" aria-label="Thông báo">
            <Bell size={16} />
          </button>
          <button type="button" className={cn('flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700', activeRailTab === 'calls' && 'bg-blue-50 text-blue-600')} onClick={onShowCalls} title="Cuộc gọi" aria-label="Cuộc gọi">
            <Phone size={16} />
          </button>
          <button type="button" className="mt-auto flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700" title="Thông tin" aria-label="Thông tin">
            <Info size={16} />
          </button>
        </nav>
        <div className="mt-auto flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">{initials}</div>
      </aside>

      <section className="flex min-w-0 flex-col border-r border-gray-200 bg-white md:w-[320px] lg:w-[340px]">
        <div className="shrink-0 px-3 pb-2 pt-3">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-lg font-bold text-gray-900">Tất cả cuộc trò chuyện</h1>
            <button type="button" onClick={onShowNotifications} className="relative flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" title="Thông báo" aria-label="Thông báo">
              <Bell size={14} />
              {notifications.some((item) => !item.is_read) ? <i className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" /> : null}
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-gray-100 px-2.5 py-1.5">
            <Search size={14} className="shrink-0 text-gray-400" />
            <input placeholder="Tìm cuộc trò chuyện" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="min-w-0 flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-gray-400" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoadingConversations ? (
            <div className="space-y-2 px-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" aria-hidden="true" />
              ))}
            </div>
          ) : null}

          {visibleConversations.map((conv) => {
            const isActive = conv.id === selectedConversationId
            const name = getConversationDisplayName(conv, userId)
            const fallback = (name[0] || 'C').toUpperCase()
            const lastMessage = conv.lastMessage || null
            const sender = lastMessage ? conv.members.find((member) => member.userId === lastMessage.senderId) || null : null
            const senderName = lastMessage ? (lastMessage.senderId === userId ? 'Bạn' : lastMessage.senderName || sender?.fullName || `Người dùng #${lastMessage.senderId}`) : ''
            const previewText = !lastMessage
              ? 'Chưa có tin nhắn'
              : lastMessage.isDeleted || (lastMessage.meta && (lastMessage.meta as Record<string, unknown>).recalled)
                ? 'Tin nhắn đã được thu hồi'
                : lastMessage.type === 'sticker'
                  ? String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker').startsWith('icon:')
                    ? 'Sticker'
                    : String((lastMessage.meta && (lastMessage.meta as Record<string, unknown>).sticker) || lastMessage.text || 'Sticker')
                  : lastMessage.type === 'image' ? 'Đã gửi một hình ảnh'
                  : lastMessage.type === 'video' ? 'Đã gửi một video'
                  : lastMessage.type === 'audio' ? 'Đã gửi một tin nhắn âm thanh'
                  : lastMessage.mediaUrl ? lastMessage.fileName || 'Đã gửi tệp đính kèm'
                  : lastMessage.text || ''
            const previewLine = lastMessage ? `${senderName}: ${previewText}` : previewText
            const previewIcon = lastMessage?.type === 'image' ? <Image size={13} />
              : lastMessage?.type === 'video' ? <Film size={13} />
              : lastMessage?.type === 'audio' ? <Mic size={13} />
              : lastMessage?.type === 'sticker' || lastMessage?.viewerReaction ? <SmilePlus size={13} />
              : lastMessage?.mediaUrl ? <FileText size={13} />
              : null
            const directPeer = conv.type === 'direct' ? conv.members.find((member) => member.userId !== userId) || null : null
            const peerUsername = conv.type === 'direct' ? directPeer?.username || null : null
            const avatarUrl = conv.avatarUrl || (conv.type === 'direct' ? directPeer?.avatarUrl || sender?.avatarUrl || null : null)
            const isOnline = Boolean(directPeer?.online)
            const statusLabel = conv.type === 'group'
              ? `${conv.members.length} thành viên${conv.onlineCount ? ` · ${conv.onlineCount} online` : ''}`
              : isOnline ? 'Đang hoạt động'
              : directPeer?.lastActiveAt ? `Hoạt động ${new Date(directPeer.lastActiveAt).toLocaleString('vi-VN')}`
              : 'Offline'

            return (
              <button
                key={conv.id}
                type="button"
                onClick={() => onOpenConversation(conv.id)}
                className={cn(
                  'flex w-full gap-2.5 border-b border-gray-50 px-3 py-2.5 text-left transition-colors hover:bg-gray-50',
                  isActive && 'bg-blue-50/60 hover:bg-blue-50/80',
                  conv.unreadCount > 0 && 'bg-blue-50/30'
                )}
              >
                <div className="relative mt-0.5 h-10 w-10 shrink-0">
                  {avatarUrl ? <img src={avatarUrl} alt={name} className="h-full w-full rounded-full object-cover" loading="lazy" onError={(event) => { event.currentTarget.style.display = 'none' }} /> : <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">{fallback}</div>}
                  <span className={cn('absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white', isOnline ? 'bg-green-500' : 'bg-gray-300')} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <strong className="truncate text-sm font-semibold text-gray-900">{name} {conv.isPinned ? <Pin size={11} className="inline text-gray-400" /> : null} {conv.isMuted ? <BellOff size={11} className="inline text-gray-400" /> : null} {conv.isHidden ? <LockKeyhole size={11} className="inline text-gray-400" /> : null} {conv.isLocked ? <LockKeyhole size={11} className="inline text-gray-400" /> : null}</strong>
                    <span className="shrink-0 text-[11px] text-gray-400">{lastMessage ? formatVietnamTime(lastMessage.createdAt) : 'Chat'}</span>
                  </div>
                  {peerUsername ? <p className="text-xs text-gray-500">@{peerUsername}</p> : null}
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    {conv.type === 'group' ? <Users size={12} /> : <span className={cn('inline-block h-1.5 w-1.5 rounded-full', isOnline ? 'bg-green-500' : 'bg-gray-300')} />}
                    <small>{statusLabel}</small>
                  </div>
                  <p className="truncate text-xs text-gray-600">{previewIcon && <span className="mr-0.5 inline-block align-middle">{previewIcon}</span>}{previewLine}</p>
                  {conv.unreadCount > 0 ? (
                    <div className="mt-0.5">
                      <span className="inline-flex items-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{conv.unreadCount} chưa đọc</span>
                    </div>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </>
  )
}
