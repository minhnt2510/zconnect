import { IoAdapter } from '@nestjs/platform-socket.io'
import { ServerOptions } from 'socket.io'

export class CustomIoAdapter extends IoAdapter {
  createIOServer(port: number, options?: ServerOptions) {
    const corsOrigins = (process.env.CORS_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: corsOrigins.length > 0 ? corsOrigins : [
          'http://localhost:5173',
          'http://localhost:19006',
          'http://localhost:8088',
          process.env.FRONTEND_URL,
        ].filter(Boolean),
        credentials: true,
        methods: ['GET', 'POST'],
      },
      transports: ['websocket', 'polling'],
    })

    return server
  }
}
