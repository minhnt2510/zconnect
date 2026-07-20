import { X } from 'lucide-react'

type MediaLightboxProps = {
  url: string
  alt: string
  onClose: () => void
}

export function MediaLightbox({ url, alt, onClose }: MediaLightboxProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" role="dialog" aria-modal="true" aria-label="Xem ảnh" onClick={onClose}>
      <button type="button" className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30" onClick={onClose} aria-label="Đóng">
        <X size={20} />
      </button>
      <img src={url} alt={alt} onClick={(event) => event.stopPropagation()} />
    </div>
  )
}
