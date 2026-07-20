import { CirclePlus, File, Image, Paperclip, Send, Smile, Sparkles, Sticker, Video, X } from 'lucide-react'
import { useState, type ChangeEvent, type Dispatch, type RefObject, type SetStateAction } from 'react'

import { cn } from '@/utils'

type AttachmentDraft = {
  file: File
  type: 'image' | 'video' | 'audio' | 'file'
  previewUrl: string | null
}

type EmojiInsert = {
  value: string
  label: string
  emoji: string
}

const QUICK_EMOJI_SET: EmojiInsert[] = [
  { value: '😀', label: 'Cười', emoji: '😀' },
  { value: '😍', label: 'Yêu thích', emoji: '😍' },
  { value: '😂', label: 'Cười lớn', emoji: '😂' },
  { value: '🥳', label: 'Ăn mừng', emoji: '🥳' },
  { value: '👍', label: 'Thích', emoji: '👍' },
  { value: '❤️', label: 'Trái tim', emoji: '❤️' },
  { value: '🔥', label: 'Nổi bật', emoji: '🔥' },
  { value: '✨', label: 'Lấp lánh', emoji: '✨' },
  { value: '🤝', label: 'Cảm ơn', emoji: '🤝' },
  { value: '💪', label: 'Mạnh mẽ', emoji: '💪' },
  { value: '🚀', label: 'Bứt phá', emoji: '🚀' },
  { value: '🌟', label: 'Ngôi sao', emoji: '🌟' },
]

const EMOJI_STICKER_PACKS = {
  'Cảm xúc': [
    { value: 'emoji:🤩', label: 'Mắt sao', emoji: '🤩' },
    { value: 'emoji:🥰', label: 'Ấm áp', emoji: '🥰' },
    { value: 'emoji:😂', label: 'Cười lớn', emoji: '😂' },
    { value: 'emoji:🥹', label: 'Cảm động', emoji: '🥹' },
  ],
  'Nổi bật': [
    { value: 'emoji:🔥', label: 'Nổi bật', emoji: '🔥' },
    { value: 'emoji:🎉', label: 'Ăn mừng', emoji: '🎉' },
    { value: 'emoji:🚀', label: 'Bứt phá', emoji: '🚀' },
    { value: 'emoji:🌈', label: 'Rực rỡ', emoji: '🌈' },
  ],
  'Hành động': [
    { value: 'emoji:👏', label: 'Vỗ tay', emoji: '👏' },
    { value: 'emoji:🙌', label: 'Tuyệt vời', emoji: '🙌' },
    { value: 'emoji:💪', label: 'Mạnh mẽ', emoji: '💪' },
    { value: 'emoji:🤝', label: 'Cảm ơn', emoji: '🤝' },
  ],
  'Tiện ích': [
    { value: 'emoji:✅', label: 'Đã xong', emoji: '✅' },
    { value: 'emoji:❓', label: 'Cần hỏi', emoji: '❓' },
    { value: 'emoji:💡', label: 'Ý tưởng', emoji: '💡' },
    { value: 'emoji:📎', label: 'Đính kèm', emoji: '📎' },
  ],
} satisfies Record<string, EmojiInsert[]>

type StickerPackName = keyof typeof EMOJI_STICKER_PACKS

type MessageComposerProps = {
  message: string
  setMessage: (value: string) => void
  onStopTyping?: () => void
  handleSend: () => void | Promise<void>
  handleFileSelected: (event: ChangeEvent<HTMLInputElement>) => void
  handlePickAttachment: () => void
  handlePickAttachmentType: (type: 'image' | 'video' | 'file') => void
  busyUploading: boolean
  isSendingMessage: boolean
  composerMenuOpen: boolean
  setComposerMenuOpen: Dispatch<SetStateAction<boolean>>
  showEmojiPanel: boolean
  setShowEmojiPanel: Dispatch<SetStateAction<boolean>>
  showStickerPanel: boolean
  setShowStickerPanel: Dispatch<SetStateAction<boolean>>
  onSendSticker: (sticker: string) => Promise<void> | void
  attachmentDraft: AttachmentDraft | null
  onRemoveAttachment: () => void
  fileInputRef: RefObject<HTMLInputElement | null>
  imageInputRef: RefObject<HTMLInputElement | null>
  videoInputRef: RefObject<HTMLInputElement | null>
  onSuggestReplies?: () => void | Promise<void>
  isSuggesting?: boolean
}

const formatFileSize = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export function MessageComposer({
  message,
  setMessage,
  onStopTyping,
  handleSend,
  handleFileSelected,
  handlePickAttachment,
  handlePickAttachmentType,
  busyUploading,
  isSendingMessage,
  composerMenuOpen,
  setComposerMenuOpen,
  showEmojiPanel,
  setShowEmojiPanel,
  showStickerPanel,
  setShowStickerPanel,
  onSendSticker,
  attachmentDraft,
  onRemoveAttachment,
  fileInputRef,
  imageInputRef,
  videoInputRef,
  onSuggestReplies,
  isSuggesting,
}: MessageComposerProps) {
  const [activeStickerPack, setActiveStickerPack] = useState<StickerPackName>('Cảm xúc')
  const [loadedStickerPacks, setLoadedStickerPacks] = useState<Record<string, boolean>>({ 'Cảm xúc': true })

  return (
    <footer className="relative mx-3 mb-3 mt-auto rounded-xl border border-gray-200/80 bg-white px-2.5 py-2 shadow-sm md:mx-4 md:mb-4 md:rounded-2xl md:border-indigo-200/30 md:px-3 md:py-2.5 md:shadow-md">
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelected} aria-label="Đính kèm tệp" title="Đính kèm tệp" />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelected} aria-label="Đính kèm ảnh" title="Đính kèm ảnh" />
      <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileSelected} aria-label="Đính kèm video" title="Đính kèm video" />

      {attachmentDraft ? (
        <div className="mb-2 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-xl bg-blue-50/80 p-2 text-sm">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-100 text-gray-500">
            {attachmentDraft.type === 'image' && attachmentDraft.previewUrl ? (
              <img src={attachmentDraft.previewUrl} alt={attachmentDraft.file.name} className="h-full w-full object-cover" />
            ) : attachmentDraft.type === 'video' && attachmentDraft.previewUrl ? (
              <video src={attachmentDraft.previewUrl} muted className="h-full w-full object-cover" />
            ) : (
              <File size={18} />
            )}
          </div>
          <div className="min-w-0">
            <strong className="block truncate text-gray-800">{attachmentDraft.file.name}</strong>
            <span className="text-xs text-gray-500">{attachmentDraft.file.type || 'application/octet-stream'} - {formatFileSize(attachmentDraft.file.size)}</span>
          </div>
          <button type="button" onClick={onRemoveAttachment} disabled={busyUploading || isSendingMessage} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-40" title="Bỏ tệp đính kèm" aria-label="Bỏ tệp đính kèm">
            <X size={14} />
          </button>
        </div>
      ) : null}

      <div className="relative flex items-end gap-1.5 overflow-x-auto scrollbar-none md:gap-2 [&::-webkit-scrollbar]:hidden">
        <button type="button" onClick={handlePickAttachment} disabled={busyUploading} className="flex shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 w-9 h-9 md:w-10 md:h-10 md:rounded-full" title="Chọn tệp đính kèm" aria-label="Chọn tệp đính kèm">
          <CirclePlus size={18} />
        </button>

        {onSuggestReplies ? (
          <button type="button" onClick={onSuggestReplies} disabled={isSuggesting} className="flex shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 w-9 h-9 md:w-10 md:h-10 md:rounded-full" title="Gợi ý trả lời AI" aria-label="Gợi ý trả lời AI">
            <Sparkles size={18} />
          </button>
        ) : null}

        {composerMenuOpen ? (
          <div className="absolute bottom-full left-1 z-20 mb-1.5 w-56 rounded-xl border border-gray-200/80 bg-white/90 p-1.5 shadow-xl backdrop-blur-md">
            <button type="button" onClick={() => handlePickAttachmentType('image')} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Image size={16} /> Gửi ảnh
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('video')} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Video size={16} /> Gửi video
            </button>
            <button type="button" onClick={() => handlePickAttachmentType('file')} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <File size={16} /> Gửi tệp
            </button>
            <button type="button" onClick={() => { setShowEmojiPanel(true); setShowStickerPanel(false); setComposerMenuOpen(false) }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-sm text-gray-700 hover:bg-gray-100">
              <Smile size={16} /> Chèn emoji
            </button>
          </div>
        ) : null}

        <textarea
          className="h-10 min-h-[40px] flex-1 resize-none border-0 bg-transparent px-1.5 py-1.5 text-sm outline-none placeholder:text-gray-400 min-w-[60px] md:min-h-[44px] md:px-2 md:text-[16px]"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onBlur={() => onStopTyping?.()}
          placeholder={attachmentDraft ? 'Nhập chú thích...' : 'Nhập tin nhắn...'}
          rows={1}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              void handleSend()
            }
          }}
        />

        <button type="button" onClick={() => { setShowEmojiPanel((prev) => !prev); setShowStickerPanel(false); setComposerMenuOpen(false) }} disabled={busyUploading} className="flex shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 w-9 h-9 md:w-10 md:h-10 md:rounded-full" title="Mở bảng emoji" aria-label="Mở bảng emoji">
          <Smile size={16} />
        </button>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={busyUploading} className="flex shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 w-9 h-9 md:w-10 md:h-10 md:rounded-full" title="Chọn tệp" aria-label="Chọn tệp">
          <Paperclip size={16} />
        </button>
        <button type="button" onClick={() => { setShowEmojiPanel(false); setShowStickerPanel((prev) => !prev); setComposerMenuOpen(false) }} disabled={busyUploading} className="flex shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-40 w-9 h-9 md:w-10 md:h-10 md:rounded-full" title="Mở sticker" aria-label="Mở sticker">
          <Sticker size={16} />
        </button>
        {showStickerPanel ? (
          <button type="button" onClick={() => setShowStickerPanel(false)} className="flex shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 w-9 h-9 md:w-10 md:h-10 md:rounded-full" title="Đóng sticker" aria-label="Đóng sticker">
            <X size={14} />
          </button>
        ) : null}
        <button type="button" onClick={handleSend} disabled={(!message.trim() && !attachmentDraft) || isSendingMessage || busyUploading} className="flex shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700 active:scale-95 disabled:opacity-40 shadow-sm w-9 h-9 md:w-11 md:h-11 md:rounded-full md:shadow-md" title="Gửi tin nhắn" aria-label="Gửi tin nhắn">
          <Send size={17} />
        </button>

        {showEmojiPanel ? (
          <div className="absolute bottom-full right-2 z-20 mb-1.5 grid w-60 grid-cols-6 gap-1.5 rounded-xl border border-gray-200 bg-white p-2 shadow-xl" style={{ minWidth: '260px' }}>
            {QUICK_EMOJI_SET.map((item) => (
              <button key={item.value} type="button" title={item.label} aria-label={item.label} onClick={() => setMessage(`${message}${item.value}`)} className="flex h-9 items-center justify-center rounded-lg bg-gray-100 text-lg hover:bg-gray-200">
                {item.emoji}
              </button>
            ))}
          </div>
        ) : null}

        {showStickerPanel ? (
          <div className="absolute bottom-full right-2 z-20 mb-1.5 w-60 rounded-xl border border-gray-200 bg-white p-2 shadow-xl" style={{ minWidth: '260px' }}>
            <div className="col-span-full mb-1.5 flex gap-1">
              {(Object.keys(EMOJI_STICKER_PACKS) as Array<StickerPackName>).map((packName) => (
                <button
                  key={packName}
                  type="button"
                  className={cn('rounded-lg px-2 py-1 text-xs font-medium', packName === activeStickerPack ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}
                  onClick={() => {
                    setActiveStickerPack(packName)
                    if (!loadedStickerPacks[packName]) {
                      setTimeout(() => { setLoadedStickerPacks((prev) => ({ ...prev, [packName]: true })) }, 220)
                    }
                  }}
                >
                  {packName}
                </button>
              ))}
            </div>
            {loadedStickerPacks[activeStickerPack] ? (
              <div className="grid grid-cols-4 gap-1.5">
                {EMOJI_STICKER_PACKS[activeStickerPack].map((sticker) => (
                  <button key={sticker.value} type="button" title={sticker.label} aria-label={sticker.label} onClick={() => void onSendSticker(sticker.value)} className="flex h-12 items-center justify-center rounded-lg bg-gray-50 text-2xl hover:bg-gray-100">
                    {sticker.emoji}
                  </button>
                ))}
              </div>
            ) : (
              <p className="col-span-full py-2 text-center text-xs text-gray-500">Đang tải bộ {activeStickerPack}...</p>
            )}
          </div>
        ) : null}
      </div>
    </footer>
  )
}
