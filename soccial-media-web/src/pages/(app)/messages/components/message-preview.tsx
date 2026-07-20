import { Languages } from 'lucide-react'
import { Link } from 'react-router-dom'

import type { ChatMessage } from '@/types'
import { MESSAGE_ICON_TOKENS, STICKER_EMOJI_TOKENS, STICKER_ICON_TOKENS } from '../constants'

type MessagePreviewProps = {
  msg: ChatMessage
  translatedMessages: Record<string, string>
  onOpenMediaLightbox: (url: string, alt: string) => void
}

function renderRichMessageText(text: string) {
  const richTokenRegex = /(https?:\/\/[^\s]+|:[a-z-]+:)/g
  const parts = text.split(richTokenRegex)
  if (parts.length === 1) return text

  return parts.map((part, index) => {
    const iconToken = MESSAGE_ICON_TOKENS[part]
    if (iconToken) {
      return (
        <span key={`icon-${index}`} className="inline-flex items-center align-middle mx-0.5" title={iconToken.label} aria-label={iconToken.label}>
          <iconToken.Icon size={16} />
        </span>
      )
    }

    if (!/^https?:\/\//i.test(part)) {
      return <span key={`text-${index}`}>{part}</span>
    }

    const isSharedPostLink = /\/posts\/\d+(?:\?.*)?$/i.test(part)
    return (
      <a
        key={`link-${index}`}
        href={part}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 hover:underline break-all"
        title={isSharedPostLink ? 'Mở bài viết được chia sẻ' : 'Mở liên kết'}
      >
        {isSharedPostLink ? 'Xem bài viết được chia sẻ' : part}
      </a>
    )
  })
}

export function MessagePreview({ msg, translatedMessages, onOpenMediaLightbox }: MessagePreviewProps) {
  const recalled = Boolean(msg.meta && (msg.meta as Record<string, unknown>).recalled)
  const forwarded = Boolean(msg.meta && (msg.meta as Record<string, unknown>).forwarded)
  const forwardedTag = forwarded ? <small className="block text-[10px] opacity-60 mb-0.5">Đã chuyển tiếp</small> : null

  if (recalled) {
    return <p className="text-sm italic text-gray-400">Tin nhắn đã được thu hồi</p>
  }

  const sharedPost = msg.meta?.sharedPost as
    | {
        id?: number | string
        authorName?: string
        authorAvatar?: string | null
        content?: string
        mediaUrl?: string | null
        reactionCount?: number
        commentCount?: number
      }
    | undefined

  if (sharedPost) {
    return (
      <div className="my-1 rounded-lg border border-gray-200 bg-gray-50 p-2">
        {msg.text ? <p className="whitespace-pre-wrap break-words">{msg.text}</p> : null}
        <Link to={sharedPost.id ? `/posts/${sharedPost.id}` : '/feed'} className="mt-1 block rounded-md border border-gray-200 bg-white p-2 text-xs">
          <div className="mb-1 flex items-center gap-1.5 text-xs">
            {sharedPost.authorAvatar ? <img src={sharedPost.authorAvatar} alt={sharedPost.authorName || 'Tác giả'} /> : <span>{(sharedPost.authorName?.[0] || 'U').toUpperCase()}</span>}
            <b>{sharedPost.authorName || 'Người dùng ZChat'}</b>
          </div>
          {sharedPost.content ? <p>{sharedPost.content}</p> : <p>Bài viết gốc không còn khả dụng</p>}
          {sharedPost.mediaUrl ? <img src={sharedPost.mediaUrl} alt="Shared post" className="mt-1 max-h-40 w-full rounded object-cover" loading="lazy" /> : null}
          <small>
            {Number(sharedPost.reactionCount || 0)} cảm xúc • {Number(sharedPost.commentCount || 0)} bình luận
          </small>
        </Link>
      </div>
    )
  }

  if (msg.type === 'image' && msg.mediaUrl) {
    return (
      <div className="max-w-full">
        {forwardedTag}
        <button
          type="button"
          className="block max-w-full overflow-hidden rounded-lg"
          onClick={() => onOpenMediaLightbox(msg.mediaUrl!, msg.fileName || 'Ảnh trong tin nhắn')}
          aria-label="Xem ảnh"
        >
          <img
            src={msg.mediaUrl}
            alt={msg.fileName || 'image'}
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
          />
        </button>
        {msg.text ? <p className="whitespace-pre-wrap break-words">{renderRichMessageText(msg.text)}</p> : null}
      </div>
    )
  }

  if (msg.type === 'video' && msg.mediaUrl) {
    return (
      <div className="max-w-full">
        {forwardedTag}
        <video controls src={msg.mediaUrl} />
        {msg.text ? <p className="whitespace-pre-wrap break-words">{renderRichMessageText(msg.text)}</p> : null}
      </div>
    )
  }

  if (msg.type === 'audio' && msg.mediaUrl) {
    return (
      <div className="max-w-full">
        {forwardedTag}
        <audio controls src={msg.mediaUrl} />
        {msg.text ? <p className="whitespace-pre-wrap break-words">{renderRichMessageText(msg.text)}</p> : null}
      </div>
    )
  }

  if (msg.type === 'sticker') {
    const sticker = (msg.meta?.sticker as string) || msg.text || ':)'
    const stickerEmoji = STICKER_EMOJI_TOKENS[sticker]
    if (stickerEmoji) {
      return (
        <p className="text-center text-4xl py-1" title={stickerEmoji.label} aria-label={stickerEmoji.label}>
          <span className="inline-block">{stickerEmoji.emoji}</span>
        </p>
      )
    }
    const stickerIcon = STICKER_ICON_TOKENS[sticker]
    if (stickerIcon) {
      return (
        <p className="text-center text-4xl py-1" title={stickerIcon.label} aria-label={stickerIcon.label}>
          <stickerIcon.Icon size={34} />
        </p>
      )
    }
    return <p className="text-center text-4xl py-1">{sticker}</p>
  }

  if (msg.mediaUrl) {
    return (
      <div className="max-w-full">
        {forwardedTag}
        <a href={msg.mediaUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline break-all">
          {msg.fileName || 'Mở tệp đính kèm'}
        </a>
        {(msg.mimeType || msg.fileSize) ? (
          <small className="block text-[10px] text-gray-400">
            {[msg.mimeType, msg.fileSize ? `${Math.max(1, Math.round(msg.fileSize / 1024))} KB` : null]
              .filter(Boolean)
              .join(' - ')}
          </small>
        ) : null}
        {msg.text ? <p className="whitespace-pre-wrap break-words">{renderRichMessageText(msg.text)}</p> : null}
      </div>
    )
  }

  return (
    <div className="whitespace-pre-wrap break-words">
      {forwarded ? <small className="text-[10px] text-gray-400">[Đã chuyển tiếp] </small> : null}
      {msg.text ? renderRichMessageText(msg.text) : ''}
      {translatedMessages[msg.id] && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.1)' }}>
          <strong style={{ fontSize: '0.8em', color: 'var(--color-primary-dark)', display: 'block', marginBottom: 4 }}>
            <Languages size={12} style={{ display: 'inline', marginBottom: -2 }} /> Bản dịch AI:
          </strong>
          <p>{translatedMessages[msg.id]}</p>
        </div>
      )}
    </div>
  )
}
