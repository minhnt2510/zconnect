import { io, type Socket } from 'socket.io-client'

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  import.meta.env.NEXT_PUBLIC_SOCKET_URL ||
  (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '')
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || import.meta.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'

let socketInstance: Socket | null = null
let currentToken: string | null = null
let currentUserId: number | undefined

export const connectSocket = (token: string, userId?: number) => {
  currentToken = token
  currentUserId = userId

  if (socketInstance) {
    // Update auth token on existing connection
    socketInstance.auth = {
      token,
      userId: Number(userId || 0) || undefined,
    }
    if (!socketInstance.connected) {
      socketInstance.connect()
    }
    return socketInstance
  }

  socketInstance = io(SOCKET_URL, {
    autoConnect: true,
    transports: ['websocket', 'polling'], // WebSocket first for real-time
    path: SOCKET_PATH,
    auth: {
      token,
      userId: Number(userId || 0) || undefined,
    },
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 10000,
  })

  // Handle auth errors - try to reconnect with fresh token
  socketInstance.on('connect_error', (error) => {
    if (error.message?.includes('auth') || error.message?.includes('token') || error.message?.includes('jwt')) {
      // Don't disconnect - Socket.IO will retry automatically
      console.warn('[socket] Auth error, will retry:', error.message)
    }
  })

  return socketInstance
}

export const getSocket = () => socketInstance

export const refreshSocketAuth = (token: string) => {
  currentToken = token
  if (socketInstance) {
    socketInstance.auth = { token, userId: Number(currentUserId || 0) || undefined }
    if (!socketInstance.connected) {
      socketInstance.connect()
    }
  }
}

export const disconnectSocket = () => {
  if (socketInstance) {
    socketInstance.removeAllListeners()
    socketInstance.disconnect()
    socketInstance = null
  }
  currentToken = null
  currentUserId = undefined
}
