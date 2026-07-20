"use client"

import { Link } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MoreHorizontal, Rss, Settings } from 'lucide-react'
import { useAuthStore } from '@/contexts/auth-store'
import { api } from '@/api/client'
import { ReportDialog } from '@/components/dialogs'
import { useSocialRealtime } from '@/hooks/use-social-realtime'
import { toast } from '@/hooks/use-toast'
import ProfileTabs, { type ProfileTab } from '@/components/navigation/profile-tabs'
import PostCard from '@/components/feed/PostCard'
import { FeedSkeleton } from '@/components/feed/PostSkeleton'
import type { FeedPost, FriendConnection, User } from '@/types'
import { Skeleton } from '@/components/ui/skeleton'
import styles from './page.module.css'

const isVideoMediaUrl = (url: string) =>
  /\.(mp4|webm|ogg|mov|m4v|avi|mkv)(\?.*)?$/i.test(url) || url.includes('/video/')

type ProfileUser = {
  userId: number
  displayName: string
  username: string
  avatarUrl: string | null
  coverUrl?: string | null
  role: string
  isVerified: boolean
  bio?: string | null
  location?: string | null
  lastActiveAt?: string | null
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const params = useParams<{ id: string }>()
  const profileId = params?.id || ''
  const token = useAuthStore((state) => state.accessToken)
  const me = useAuthStore((state) => state.user)
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null)
  const [posts, setPosts] = useState<FeedPost[]>([])
  const [friends, setFriends] = useState<FriendConnection[]>([])
  const [friendStatus, setFriendStatus] = useState<'none' | 'pending' | 'accepted'>('none')
  const [relationship, setRelationship] = useState<{ status: string; requestedByMe?: boolean; isBlockedByMe?: boolean; isBlockedMe?: boolean } | null>(null)
  const [socialActionBusy, setSocialActionBusy] = useState(false)
  const [isLoadingProfile, setIsLoadingProfile] = useState(true)
  const [isLoadingPosts, setIsLoadingPosts] = useState(true)
  const [profileAvatarBroken, setProfileAvatarBroken] = useState(false)
  const [activeTab, setActiveTab] = useState<ProfileTab>('posts')
  const [mediaOnly, setMediaOnly] = useState(false)
  const [reportAccountOpen, setReportAccountOpen] = useState(false)
  const [showOwnMenu, setShowOwnMenu] = useState(false)
  const ownMenuRef = useRef<HTMLDivElement>(null)
  const [composeOpen, setComposeOpen] = useState(false)
  const [composeContent, setComposeContent] = useState('')
  const [composeVisibility, setComposeVisibility] = useState<'public' | 'private'>('public')
  const [busyPost, setBusyPost] = useState(false)

  const isOwnProfile = useMemo(() => {
    if (!me?.id) return false
    return String(me.id) === profileId || me.username === profileId
  }, [me?.id, me?.username, profileId])

  const targetUserId = useMemo(() => {
    if (/^\d+$/.test(profileId)) return Number(profileId)
    return profileUser?.userId || 0
  }, [profileId, profileUser?.userId])

  const clearAuth = useAuthStore((state) => state.clearAuth)

  // Close own-profile menu on outside click
  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ownMenuRef.current && !ownMenuRef.current.contains(e.target as Node)) {
      setShowOwnMenu(false)
    }
  }, [])
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [handleClickOutside])

  const handleCreatePost = async () => {
    const text = composeContent.trim()
    if (!text || !token || busyPost) return
    setBusyPost(true)
    try {
      const { post } = await api.createPost(token, {
        content: text,
        visibility: composeVisibility,
      })
      setPosts((prev) => [post, ...prev])
      setComposeContent('')
      setComposeOpen(false)
      setComposeVisibility('public')
      toast({ title: 'Đã đăng bài viết' })
    } catch {
      toast({ title: 'Không thể đăng bài viết', description: 'Vui lòng thử lại.', variant: 'destructive' })
    } finally {
      setBusyPost(false)
    }
  }

  const mapUserToProfileUser = (user: User): ProfileUser => ({
    userId: user.id,
    displayName: user.fullName,
    username: user.username,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    role: user.role,
    isVerified: user.isVerified,
    bio: user.bio || null,
    location: user.location || null,
    lastActiveAt: null,
  })

  const fetchProfileByUsername = async (token: string, username: string) => {
    try {
      const r = await api.getUserByUsername(token, username)
      if (r.user) {
        const mappedUser = mapUserToProfileUser(r.user)
        setProfileUser(mappedUser)
        setRelationship(r.relationship || null)
        if (r.relationship?.status === 'friends') {
          setFriendStatus('accepted')
        } else if (r.relationship?.status === 'pending_sent' || r.relationship?.status === 'pending_received') {
          setFriendStatus('pending')
        } else {
          setFriendStatus('none')
        }
        return r.user.id
      }
    } catch { /* not found */ }
    return null
  }

  useEffect(() => {
    if (!profileId || !token) return
    setIsLoadingProfile(true)
    setFriendStatus('none')
    const isNumericId = /^\d+$/.test(profileId)
    if (isNumericId) {
      api.getUserProfile(token, Number(profileId))
        .then((r) => {
          if (r.user) {
            setProfileUser(mapUserToProfileUser(r.user))
            setRelationship(r.relationship || null)
            if (r.relationship?.status === 'friends') {
              setFriendStatus('accepted')
            } else if (r.relationship?.status === 'pending_sent' || r.relationship?.status === 'pending_received') {
              setFriendStatus('pending')
            } else {
              setFriendStatus('none')
            }
          }
        })
        .catch(console.error)
        .finally(() => setIsLoadingProfile(false))
    } else {
      fetchProfileByUsername(token, profileId).then((userId) => {
        if (!userId) setIsLoadingProfile(false)
      })
    }
  }, [profileId, token])

  useEffect(() => {
    if (!profileId || !token) return
    setIsLoadingPosts(true)
    const isNumericId = /^\d+$/.test(profileId)
    if (isNumericId) {
      api.getUserPosts(token, Number(profileId))
        .then((r) => setPosts(r.posts))
        .catch(console.error)
        .finally(() => setIsLoadingPosts(false))
    } else {
      fetchProfileByUsername(token, profileId).then((userId) => {
        if (userId) {
          api.getUserPosts(token, userId)
            .then((r) => setPosts(r.posts))
            .catch(console.error)
            .finally(() => setIsLoadingPosts(false))
        } else {
          setIsLoadingPosts(false)
        }
      })
    }
  }, [profileId, token])

  useEffect(() => {
    if (!token || !isOwnProfile) return
    api
      .listFriends(token)
      .then((response) => {
        setFriends(response.friends)
      })
      .catch(console.error)
  }, [isOwnProfile, profileId, token])

  const acceptedFriends = useMemo(
    () => friends.filter((friend) => friend.status === 'accepted'),
    [friends]
  )

  const profileFriend = useMemo(
    () => friends.find((friend) => String(friend.id) === profileId) || null,
    [friends, profileId]
  )

  const profileMedia = useMemo(
    () => posts.filter((post) => Boolean(post.mediaUrl || post.sharedPost?.mediaUrl)).slice(0, 6),
    [posts]
  )

  const getPostMediaUrl = (post: FeedPost) => post.mediaUrl || post.sharedPost?.mediaUrl || null
  const isVideoPost = (post: FeedPost) => {
    const mediaUrl = getPostMediaUrl(post)
    return Boolean(mediaUrl && /\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(mediaUrl))
  }

  const visiblePosts = useMemo(() => {
    if (activeTab === 'photos') return posts.filter((post) => getPostMediaUrl(post) && !isVideoPost(post))
    if (activeTab === 'videos') return posts.filter(isVideoPost)
    if (mediaOnly) return posts.filter((post) => Boolean(getPostMediaUrl(post)))
    return posts
  }, [activeTab, mediaOnly, posts])

  const totalInteractions = useMemo(
    () => posts.reduce((sum, post) => sum + post.reactionCount + post.commentCount, 0),
    [posts]
  )

  const profileName = isOwnProfile && me
    ? me.fullName
    : profileUser?.displayName || profileFriend?.fullName || `Người dùng #${profileId}`

  const profileAvatar = isOwnProfile && me
    ? me.avatarUrl
    : profileUser?.avatarUrl || profileFriend?.avatarUrl || null

  const initials = (profileName[0] || 'U').toUpperCase()

  const isOnline = useMemo(() => {
    if (isOwnProfile) return true
    const lastActive = profileUser?.lastActiveAt
    if (!lastActive) return false
    return Date.now() - new Date(lastActive).getTime() < 5 * 60 * 1000
  }, [isOwnProfile, profileUser?.lastActiveAt])

  useSocialRealtime({
    token,
    user: me,
    setPosts,
  })

  useEffect(() => {
    setProfileAvatarBroken(false)
  }, [profileAvatar])

  const roleSource = isOwnProfile ? me?.role : (profileUser?.role || profileFriend?.role)
  const roleText = roleSource === 'admin'
    ? 'Quản trị viên hệ thống'
    : roleSource === 'moderator'
      ? 'Kiểm duyệt viên cộng đồng'
      : 'Thành viên ZChat'

  const accountText = isOwnProfile && me
    ? me.accountStatus === 'active' ? 'Tài khoản hoạt động'
      : me.accountStatus === 'restricted' ? 'Tài khoản bị hạn chế'
        : me.accountStatus === 'hidden' ? 'Tài khoản đang ẩn'
          : 'Tài khoản đã xóa'
    : friendStatus === 'accepted' ? 'Đã kết bạn'
      : relationship?.status === 'pending_sent' ? 'Đã gửi lời mời'
        : relationship?.status === 'pending_received' ? 'Đang chờ xác nhận'
          : 'Chưa kết nối'

  const handleRequestFriend = async () => {
    if (!token || isOwnProfile || !targetUserId) return
    setSocialActionBusy(true)
    try {
      await api.requestFriend(token, targetUserId)
      setFriendStatus('pending')
      setRelationship({ status: 'pending_sent', requestedByMe: true })
    } catch (error) {
      const errMsg = String(typeof error === 'object' && error && 'message' in error ? (error as any).message : '')
      if (errMsg.toLowerCase().includes('already')) {
        setFriendStatus('pending')
        setRelationship({ status: 'pending_sent', requestedByMe: true })
      } else {
        console.error('Không thể gửi lời mời kết bạn', error)
      }
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleUnfriend = async () => {
    if (!token || isOwnProfile || !targetUserId) return
    if (!window.confirm('Bạn có chắc muốn hủy kết bạn?')) return
    setSocialActionBusy(true)
    try {
      await api.deleteFriend(token, targetUserId)
      setFriendStatus('none')
      setRelationship((prev) => prev ? { ...prev, status: 'none' } : null)
      setFriends((prev) => prev.filter((f) => String(f.id) !== profileId))
    } catch (error) {
      console.error('Không thể hủy kết bạn', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleAcceptRequest = async () => {
    if (!token || isOwnProfile || !targetUserId) return
    setSocialActionBusy(true)
    try {
      await api.acceptFriend(token, targetUserId)
      setFriendStatus('accepted')
      setRelationship((prev) => prev ? { ...prev, status: 'friends' } : null)
    } catch (error) {
      console.error('Không thể chấp nhận lời mời', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleCancelRequest = async () => {
    if (!token || isOwnProfile || !targetUserId) return
    setSocialActionBusy(true)
    try {
      await api.deleteFriend(token, targetUserId)
      setFriendStatus('none')
      setRelationship((prev) => prev ? { ...prev, status: 'none' } : null)
    } catch (error) {
      console.error('Không thể hủy lời mời', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleMessageUser = async () => {
    if (!token || isOwnProfile || !targetUserId) return
    setSocialActionBusy(true)
    try {
      const conversations = await api.listConversations(token)
      const existing = conversations.conversations.find(
        (conversation) =>
          conversation.type === 'direct' &&
          conversation.members.some((member) => member.userId === targetUserId)
      )
      if (existing) {
        navigate(`/messages?conversation=${existing.id}`)
        return
      }
      const created = await api.createDirectConversation(token, targetUserId)
      navigate(`/messages?conversation=${created.conversation.id}`)
    } catch (error) {
      console.error('Không thể mở hội thoại', error)
    } finally {
      setSocialActionBusy(false)
    }
  }

  const handleReportAccount = async (payload: { reason: string; details?: string }) => {
    if (!token || isOwnProfile || !targetUserId) return
    await api.submitReport(token, {
      targetType: 'user',
      targetId: profileId,
      reason: payload.reason,
      details: payload.details,
    })
    toast({
      title: 'Đã gửi báo cáo tài khoản',
      description: 'Đội ngũ kiểm duyệt sẽ xem xét tài khoản này và thông báo khi có cập nhật.',
    })
  }

  if (isLoadingProfile && !profileUser) {
    return (
      <div className={styles.page}>
        <section className={styles.cover}>
          <div className={styles.coverGlow}></div>
        </section>
        <div className={styles.shell}>
          <header className={styles.profileHeader}>
            <Skeleton style={{ width: 96, height: 96, borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
              <Skeleton style={{ width: 180, height: 22 }} />
              <Skeleton style={{ width: 120, height: 16 }} />
            </div>
          </header>
          <div className={styles.grid}>
            <aside className={styles.leftCol}>
              <section className={styles.card}>
                <Skeleton style={{ height: 16, width: '55%', marginBottom: 14 }} />
                <Skeleton style={{ height: 13, marginBottom: 10 }} />
                <Skeleton style={{ height: 13, marginBottom: 10 }} />
                <Skeleton style={{ height: 13, marginBottom: 10 }} />
                <Skeleton style={{ height: 13 }} />
              </section>
            </aside>
            <section className={styles.rightCol}>
              <Skeleton style={{ height: 176, borderRadius: 16, marginBottom: 12 }} />
              <Skeleton style={{ height: 176, borderRadius: 16 }} />
            </section>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Cover */}
      <section className="relative h-48 md:h-56 overflow-hidden bg-gradient-to-r from-primary/80 via-primary/50 to-accent/60">
        {(isOwnProfile ? me?.coverUrl : profileUser?.coverUrl) ? (
          <img src={isOwnProfile ? me?.coverUrl || '' : profileUser?.coverUrl || ''} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
      </section>

      <div className="max-w-[var(--feed-max-width)] mx-auto px-4">
        {/* Avatar - overlaps cover bottom edge only */}
        <div className="flex -mt-14 md:-mt-16 mb-4">
          <div className="relative shrink-0">
            <div className="w-24 h-24 md:w-28 md:h-28 rounded-2xl border-4 border-background bg-card overflow-hidden shadow-xl">
              {profileAvatar && !profileAvatarBroken ? (
                <img
                  src={profileAvatar}
                  alt={profileName}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={() => setProfileAvatarBroken(true)}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-2xl font-bold">
                  {initials}
                </div>
              )}
            </div>
            {isOnline && (
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-background" title="Đang hoạt động" />
            )}
          </div>
        </div>

        {/* Profile Info - always below cover */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl md:text-2xl font-bold truncate">{profileName}</h1>
            {(profileUser?.username || (isOwnProfile && me?.username)) && (
              <p className="text-sm text-muted-foreground">@{isOwnProfile ? me?.username : profileUser?.username}</p>
            )}
            <p className="text-sm text-muted-foreground">{roleText}</p>
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
              <span>{posts.length} bài viết</span>
              <span>{totalInteractions} tương tác</span>
              <span>{accountText}</span>
            </div>
          </div>

          {/* Action buttons */}
          {isOwnProfile ? (
            <div className="flex items-center gap-2 shrink-0">
              <Link
                to="/profile/edit"
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-medium border border-border bg-card hover:bg-accent/10 transition-colors shrink-0"
              >
                <Settings size={15} />
                Chỉnh sửa trang cá nhân
              </Link>
              <div className="relative" ref={ownMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowOwnMenu((prev) => !prev)}
                  className="p-2 rounded-xl text-muted-foreground hover:bg-accent/10 transition-colors"
                  title="Thêm"
                >
                  <MoreHorizontal size={18} />
                </button>
                {showOwnMenu && (
                  <div className="absolute right-0 top-full mt-1 z-50 min-w-[200px] rounded-xl border border-border bg-card shadow-lg py-1 overflow-hidden">
                    <Link
                      to="/settings"
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-foreground hover:bg-accent/10 transition-colors no-underline"
                    >
                      Cài đặt tài khoản
                    </Link>
                    <button
                      type="button"
                      onClick={() => { clearAuth(); navigate('/auth/login') }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-destructive hover:bg-destructive/10 transition-colors text-left"
                    >
                      Đăng xuất
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 shrink-0">
              {/* Friend action buttons based on relationship status */}
              {relationship?.status === 'pending_sent' || (friendStatus === 'pending' && relationship?.requestedByMe !== false) ? (
                <button
                  type="button"
                  onClick={handleCancelRequest}
                  disabled={socialActionBusy}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-accent/10 disabled:opacity-50 transition-all"
                >
                  Hủy lời mời
                </button>
              ) : relationship?.status === 'pending_received' || (friendStatus === 'pending' && relationship?.requestedByMe === false) ? (
                <button
                  type="button"
                  onClick={handleAcceptRequest}
                  disabled={socialActionBusy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  Chấp nhận
                </button>
              ) : friendStatus === 'accepted' ? (
                <button
                  type="button"
                  onClick={handleUnfriend}
                  disabled={socialActionBusy}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-border bg-card hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 disabled:opacity-50 transition-all"
                >
                  Bạn bè
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestFriend}
                  disabled={socialActionBusy}
                  className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                >
                  Thêm bạn
                </button>
              )}
              <button
                type="button"
                onClick={handleMessageUser}
                disabled={socialActionBusy}
                className="px-4 py-2 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
              >
                Nhắn tin
              </button>
              <button
                type="button"
                onClick={() => setReportAccountOpen(true)}
                className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Báo cáo"
              >
                <Settings size={16} />
              </button>
            </div>
          )}
        </div>

        <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

        {/* 2-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 mt-6">
          {/* Left sidebar */}
          <aside className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
              <h3 className="text-sm font-semibold">Giới thiệu</h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Settings size={14} className="shrink-0" />
                  <span>Vai trò: <strong className="text-foreground">{roleText}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Rss size={14} className="shrink-0" />
                  <span>Trạng thái: <strong className="text-foreground">{accountText}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Rss size={14} className="shrink-0" />
                  <span>Bài viết: <strong className="text-foreground">{isLoadingPosts ? '...' : posts.length}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <Rss size={14} className="shrink-0" />
                  <span>Tương tác: <strong className="text-foreground">{isLoadingPosts ? '...' : totalInteractions}</strong></span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Ảnh</h3>
                <Link to="/media" className="text-xs text-primary hover:underline">Xem tất cả</Link>
              </div>
              {profileMedia.length > 0 ? (
                <div className="grid grid-cols-3 gap-1.5">
                  {profileMedia.map((post) => (
                    <img
                      key={post.id}
                      src={post.mediaUrl || ''}
                      alt={`Media ${post.id}`}
                      className="aspect-square rounded-lg object-cover bg-muted"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = 'none' }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">Chưa có ảnh/video.</p>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Bạn bè</h3>
                {isOwnProfile && (
                  <Link to="/friends" className="text-xs text-primary hover:underline">Xem tất cả</Link>
                )}
              </div>
              {isOwnProfile ? (
                <>
                  <p className="text-xs text-muted-foreground mb-3">{acceptedFriends.length} người bạn</p>
                  {acceptedFriends.length > 0 ? (
                    <div className="grid grid-cols-3 gap-2">
                      {acceptedFriends.slice(0, 6).map((friend) => (
                        <Link key={friend.id} to={`/profile/${friend.username || friend.id}`} className="flex flex-col items-center gap-1">
                          <div className="w-14 h-14 rounded-xl bg-muted overflow-hidden">
                            {friend.avatarUrl ? (
                              <img src={friend.avatarUrl} alt={friend.fullName} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-xs font-bold">
                                {(friend.fullName[0] || 'U').toUpperCase()}
                              </div>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2">{friend.fullName}</span>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Chưa có bạn bè.</p>
                  )}
                </>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {friendStatus === 'accepted' ? 'Đã kết bạn với chủ tài khoản này' : 'Chưa kết nối với chủ tài khoản này'}
                </p>
              )}
            </section>
          </aside>

          {/* Right column */}
          <div className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-4">
              {isOwnProfile ? (
                composeOpen ? (
                  <div className="space-y-3">
                    <textarea
                      value={composeContent}
                      onChange={(e) => setComposeContent(e.target.value)}
                      placeholder={`${profileName.split(' ')[0]} ơi, bạn đang nghĩ gì thế?`}
                      rows={4}
                      className="w-full resize-none bg-muted/30 rounded-xl p-3 text-sm outline-none focus:bg-muted/50 transition-colors"
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <select
                        value={composeVisibility}
                        onChange={(e) => setComposeVisibility(e.target.value as 'public' | 'private')}
                        className="text-xs bg-muted/50 rounded-lg px-2 py-1.5 border border-border outline-none"
                      >
                        <option value="public">Công khai</option>
                        <option value="private">Chỉ mình tôi</option>
                      </select>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setComposeOpen(false); setComposeContent('') }}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border hover:bg-accent/10 transition-colors"
                        >
                          Hủy
                        </button>
                        <button
                          type="button"
                          onClick={handleCreatePost}
                          disabled={!composeContent.trim() || busyPost}
                          className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                        >
                          {busyPost ? 'Đang đăng...' : 'Đăng'}
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                        {initials}
                      </div>
                      <button
                        type="button"
                        onClick={() => setComposeOpen(true)}
                        className="flex-1 text-left text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-2.5 hover:bg-muted/50 transition-colors"
                      >
                        {profileName.split(' ')[0]} ơi, bạn đang nghĩ gì thế?
                      </button>
                    </div>
                    <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/60">
                      <button type="button" onClick={() => setComposeOpen(true)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Tạo bài viết</button>
                      <button type="button" onClick={() => setActiveTab('photos')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Ảnh/Video</button>
                      <div className="flex-1" />
                      <button
                        type="button"
                        onClick={() => setMediaOnly((c) => !c)}
                        className={`text-xs transition-colors ${mediaOnly ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {mediaOnly ? 'Tất cả' : 'Chỉ media'}
                      </button>
                    </div>
                  </>
                )
              ) : (
                <>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary text-sm font-bold shrink-0">
                      {initials}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('/messages')}
                      className="flex-1 text-left text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      Nhắn tin với {profileName.split(' ')[0]}
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/60">
                    <button type="button" onClick={() => setActiveTab('photos')} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Ảnh/Video</button>
                    <div className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setMediaOnly((c) => !c)}
                      className={`text-xs transition-colors ${mediaOnly ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      {mediaOnly ? 'Tất cả' : 'Chỉ media'}
                    </button>
                  </div>
                </>
              )}
            </section>

            <div className="space-y-4">
              {isLoadingPosts ? (
                <FeedSkeleton count={2} />
              ) : visiblePosts.length === 0 ? (
                <div className="rounded-2xl border border-border bg-card p-8 text-center">
                  <p className="text-sm text-muted-foreground">Chưa có nội dung phù hợp.</p>
                </div>
              ) : (
                visiblePosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    user={me}
                    isGuestView={false}
                    savedPostIds={new Set()}
                    activeMenuId={null}
                    onReact={() => {}}
                    onToggleComments={() => navigate(`/posts/${post.id}`)}
                    onShare={() => {}}
                    onSave={() => {}}
                    onMenuOpen={() => {}}
                    onDelete={() => {}}
                    onReport={() => {}}
                    onHide={() => {}}
                    onEdit={() => {}}
                    onCopyLink={() => {}}
                    onCopyId={() => {}}
                    commentInput=""
                    onCommentInputChange={() => {}}
                    isCommenting={false}
                    onAddComment={() => {}}
                    comments={[]}
                    expanded={false}
                    loadingComments={false}
                    hasMoreComments={false}
                    onLoadMore={() => {}}
                    replyInputs={{}}
                    onReplyInputChange={() => {}}
                    replyingToCommentIds={{}}
                    onToggleReply={() => {}}
                    onAddReply={() => {}}
                    busyCommentId={null}
                    onDeleteComment={() => {}}
                    onReportComment={() => {}}
                    expandedReplyIds={{}}
                    onToggleExpandedReply={() => {}}
                    commentImageDraft={null}
                    onCommentImageSelect={() => {}}
                    onRemoveCommentImage={() => {}}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {!isOwnProfile && (
        <ReportDialog
          open={reportAccountOpen}
          onOpenChange={setReportAccountOpen}
          title="Báo cáo tài khoản"
          onSubmit={handleReportAccount}
        />
      )}
    </div>
  )
}
