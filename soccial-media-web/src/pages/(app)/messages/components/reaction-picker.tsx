import { useCallback, type RefObject } from 'react'

import type { ChatMessage } from '@/types'
import { MESSAGE_REACTION_ICONS } from '../constants'

type ReactionPickerProps = {
  reactionPickerRef: RefObject<HTMLDivElement | null>
  activeReactionMessage: ChatMessage
  busyActionId: string | null
  placement: 'above' | 'below'
  onReact: (message: ChatMessage, type: string) => void
  onClose: () => void
}

export function ReactionPicker({ reactionPickerRef, activeReactionMessage, busyActionId, placement, onReact, onClose }: ReactionPickerProps) {
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (!reactionPickerRef.current) return
    const buttons = Array.from(reactionPickerRef.current.querySelectorAll('button')) as HTMLButtonElement[]
    if (buttons.length === 0) return
    const currentIndex = buttons.findIndex((btn) => btn === document.activeElement)
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      const nextIndex = (currentIndex + 1) % buttons.length
      buttons[nextIndex]?.focus()
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      const nextIndex = currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1
      buttons[nextIndex]?.focus()
    }
  }, [reactionPickerRef, onClose])

  return (
    <div
      ref={reactionPickerRef}
      className={`fixed z-50 flex items-center gap-1 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-xl ${placement === 'above' ? 'mb-2' : 'mt-2'}`}
      role="toolbar"
      aria-label="Chọn cảm xúc"
      onKeyDown={handleKeyDown}
    >
      {MESSAGE_REACTION_ICONS.map((reaction) => (
        <button
          key={reaction.type}
          type="button"
          className={activeReactionMessage.viewerReaction === reaction.type ? 'bg-blue-100' : ''}
          title={reaction.label}
          aria-label={reaction.label}
          disabled={busyActionId === activeReactionMessage.id}
          onClick={() => {
            onReact(activeReactionMessage, reaction.type)
            onClose()
          }}
        >
          <span className="text-xl">{reaction.emoji}</span>
        </button>
      ))}
    </div>
  )
}
