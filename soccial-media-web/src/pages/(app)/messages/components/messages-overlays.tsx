import { Check, CornerUpRight, Flag, Pin, RotateCcw, Trash2 } from 'lucide-react'

import { formatVietnamTime, getAvatarInitial, getConversationDisplayName } from '@/services/messages/formatters'
import { parseNotificationMeta, type MessageNotificationItem } from '@/services/messages/notification-meta'
import type { ChatMessage, Conversation, FriendConnection } from '@/types'
import { cn } from '@/utils'

type MessagesOverlaysProps = {
  userId?: number
  conversations: Conversation[]
  selectedConversationId: string | null
  actionMenu: { messageId: string; x: number; y: number } | null
  activeActionMessage: ChatMessage | null
  pinnedMessageIds: Set<string>
  forwardingMessageId: string | null
  showNewMessageModal: boolean
  newMessageKeyword: string
  searchUsersResult: Array<{ id: number; name: string; username?: string }>
  showNotificationsDrawer: boolean
  notifications: MessageNotificationItem[]
  showCreateGroupModal: boolean
  groupName: string
  groupSearchKeyword: string
  filteredCreateGroupInviteCandidates: FriendConnection[]
  groupMemberIds: number[]
  busyActionId: string | null
  creatingGroup: boolean
  acceptedFriendsCount: number
  setForwardingMessageId: (messageId: string | null) => void
  setActionMenu: (value: { messageId: string; x: number; y: number } | null) => void
  setShowNewMessageModal: (value: boolean) => void
  setNewMessageKeyword: (value: string) => void
  handleCreateConversationWithUser: (userId: number) => void | Promise<void>
  setShowNotificationsDrawer: (value: boolean) => void
  handleOpenNotificationConversation: (conversationId: string | null | undefined) => void
  handleAcceptFromNotification: (item: MessageNotificationItem) => void | Promise<void>
  setShowCreateGroupModal: (value: boolean) => void
  handleCreateGroupConversation: () => void | Promise<void>
  setGroupName: (value: string) => void
  setGroupSearchKeyword: (value: string) => void
  toggleGroupMember: (userId: number) => void
  handleTogglePinMessage: (message: ChatMessage) => void | Promise<void>
  handleReportMessage: (message: ChatMessage) => void | Promise<void>
  handleRecall: (message: ChatMessage) => void | Promise<void>
  handleDeleteMessage: (message: ChatMessage) => void | Promise<void>
  handleForward: (targetConversationId: string) => void | Promise<void>
}

function ListIdentity({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">{getAvatarInitial(title)}</span>
      <span className="min-w-0">
        <strong className="block truncate text-sm font-semibold text-gray-900">{title}</strong>
        <small className="block truncate text-xs text-gray-500">{subtitle}</small>
      </span>
    </span>
  )
}

export function MessagesOverlays({
  userId,
  conversations,
  selectedConversationId,
  actionMenu,
  activeActionMessage,
  pinnedMessageIds,
  forwardingMessageId,
  showNewMessageModal,
  newMessageKeyword,
  searchUsersResult,
  showNotificationsDrawer,
  notifications,
  showCreateGroupModal,
  groupName,
  groupSearchKeyword,
  filteredCreateGroupInviteCandidates,
  groupMemberIds,
  busyActionId,
  creatingGroup,
  acceptedFriendsCount,
  setForwardingMessageId,
  setActionMenu,
  setShowNewMessageModal,
  setNewMessageKeyword,
  handleCreateConversationWithUser,
  setShowNotificationsDrawer,
  handleOpenNotificationConversation,
  handleAcceptFromNotification,
  setShowCreateGroupModal,
  handleCreateGroupConversation,
  setGroupName,
  setGroupSearchKeyword,
  toggleGroupMember,
  handleTogglePinMessage,
  handleReportMessage,
  handleRecall,
  handleDeleteMessage,
  handleForward,
}: MessagesOverlaysProps) {
  return (
    <>
      {actionMenu && activeActionMessage ? (
        <div
          className="fixed z-50 w-52 rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
          style={{ left: actionMenu.x, top: actionMenu.y }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center gap-2.5 border-b border-gray-100 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-600">
              {getAvatarInitial(activeActionMessage.senderName || `Người dùng #${activeActionMessage.senderId}`)}
            </span>
            <div className="min-w-0">
              <strong className="block truncate text-sm text-gray-900">{String(activeActionMessage.senderName || `Người dùng #${activeActionMessage.senderId}`)}</strong>
              <small className="text-xs text-gray-500">{formatVietnamTime(activeActionMessage.createdAt)}</small>
            </div>
          </div>
          <button type="button" onClick={() => { setForwardingMessageId(activeActionMessage.id); setActionMenu(null) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <CornerUpRight size={15} /> Chuyển tiếp
          </button>
          <button type="button" onClick={() => { void handleTogglePinMessage(activeActionMessage); setActionMenu(null) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Pin size={15} /> {pinnedMessageIds.has(activeActionMessage.id) ? 'Bỏ ghim' : 'Ghim'}
          </button>
          <button type="button" onClick={() => { void handleReportMessage(activeActionMessage); setActionMenu(null) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
            <Flag size={15} /> Báo cáo tin nhắn
          </button>
          {activeActionMessage.senderId === userId ? (
            <>
              <button type="button" onClick={() => { void handleRecall(activeActionMessage); setActionMenu(null) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                <RotateCcw size={15} /> Thu hồi
              </button>
              <button type="button" onClick={() => { void handleDeleteMessage(activeActionMessage); setActionMenu(null) }} className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                <Trash2 size={15} /> Xóa
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {showNewMessageModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-3 text-lg font-bold text-gray-900">Tin nhắn mới</h3>
            <input value={newMessageKeyword} onChange={(event) => setNewMessageKeyword(event.target.value)} placeholder="Nhập tên bạn bè hoặc email đăng ký" className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            <div className="mb-3 max-h-60 space-y-1 overflow-y-auto">
              {searchUsersResult.map((item) => (
                <button key={item.id} type="button" onClick={() => void handleCreateConversationWithUser(item.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-gray-50">
                  <ListIdentity title={item.name} subtitle={item.username ? `@${item.username}` : `ID ${item.id}`} />
                </button>
              ))}
              {searchUsersResult.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">Không có kết quả phù hợp.</p> : null}
            </div>
            <button type="button" onClick={() => setShowNewMessageModal(false)} className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Đóng</button>
          </div>
        </div>
      ) : null}

      {showNotificationsDrawer ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-3.5">
              <h3 className="text-lg font-bold text-gray-900">Thông báo <span className="ml-1 text-sm font-normal text-gray-500">({notifications.length})</span></h3>
              <button type="button" onClick={() => setShowNotificationsDrawer(false)} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600">×</button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-2">
              {notifications.map((item) => {
                const meta = parseNotificationMeta(item)
                const conversationId = meta?.conversationId
                const canAccept = item.type === 'friend-request' && !item.is_read && Boolean(meta?.requesterId || meta?.friendshipId)
                return (
                  <div key={item.id} className="rounded-xl px-3 py-2.5 transition-colors hover:bg-gray-50">
                    <button type="button" className="flex w-full items-center gap-2.5 text-left" onClick={() => handleOpenNotificationConversation(conversationId)}>
                      <ListIdentity title={item.title} subtitle={`${item.body || 'Thông báo hệ thống'} - ${new Date(item.created_at).toLocaleString('vi-VN')}`} />
                    </button>
                    <div className="mt-2 flex items-center gap-2 pl-11">
                      {conversationId ? <button type="button" onClick={() => handleOpenNotificationConversation(conversationId)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50">Mở đoạn chat</button> : null}
                      {canAccept ? (
                        <button type="button" disabled={busyActionId === `notif-${item.id}`} onClick={() => void handleAcceptFromNotification(item)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                          {busyActionId === `notif-${item.id}` ? 'Đang đồng ý...' : 'Đồng ý'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
              {notifications.length === 0 ? <p className="py-6 text-center text-sm text-gray-500">Hiện chưa có thông báo quan trọng.</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {forwardingMessageId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-1 text-lg font-bold text-gray-900">Chuyển tiếp tin nhắn</h3>
            <p className="mb-3 text-sm text-gray-500">Chọn cuộc trò chuyện để chuyển tiếp:</p>
            <div className="mb-3 max-h-52 space-y-1 overflow-y-auto">
              {conversations.filter((conv) => conv.id !== selectedConversationId).map((conv) => {
                const name = getConversationDisplayName(conv, userId)
                return (
                  <button key={conv.id} type="button" onClick={() => void handleForward(conv.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-gray-50">
                    <ListIdentity title={name} subtitle={`ID ${conv.id}`} />
                  </button>
                )
              })}
            </div>
            <button type="button" onClick={() => setForwardingMessageId(null)} className="w-full rounded-xl bg-gray-100 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Hủy</button>
          </div>
        </div>
      ) : null}

      {showCreateGroupModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="mb-3 text-lg font-bold text-gray-900">Tạo nhóm chat</h3>
            <input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Nhập tên nhóm" className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            <input value={groupSearchKeyword} onChange={(event) => setGroupSearchKeyword(event.target.value)} placeholder="Tìm bạn bè để thêm vào nhóm" className="mb-3 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" />
            <div className="mb-3 max-h-52 space-y-1 overflow-y-auto">
              {filteredCreateGroupInviteCandidates.map((friend) => {
                const checked = groupMemberIds.includes(friend.id)
                return (
                  <button key={friend.id} type="button" onClick={() => toggleGroupMember(friend.id)} className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left hover:bg-gray-50">
                    <ListIdentity title={friend.fullName} subtitle={friend.username ? `@${friend.username}` : friend.email || friend.phone || `ID ${friend.id}`} />
                    <span className={cn('ml-2 shrink-0 rounded-full px-3 py-1 text-xs font-medium', checked ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600')}>
                      {checked ? <Check size={13} className="inline" /> : 'Chọn'}
                    </span>
                  </button>
                )
              })}
              {acceptedFriendsCount === 0 ? <p className="py-4 text-center text-sm text-gray-500">Bạn chưa có bạn bè để tạo nhóm.</p> : null}
              {acceptedFriendsCount > 0 && filteredCreateGroupInviteCandidates.length === 0 ? <p className="py-4 text-center text-sm text-gray-500">Không tìm thấy bạn bè phù hợp.</p> : null}
            </div>
            <div className="flex gap-2">
              <button type="button" disabled={!groupName.trim() || groupMemberIds.length === 0 || creatingGroup} onClick={() => void handleCreateGroupConversation()} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {creatingGroup ? 'Đang tạo nhóm...' : 'Tạo nhóm'}
              </button>
              <button type="button" onClick={() => setShowCreateGroupModal(false)} className="rounded-xl bg-gray-100 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-200">Đóng</button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
