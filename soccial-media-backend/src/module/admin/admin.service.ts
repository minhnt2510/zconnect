import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { UserService } from '../user/user.service';
import { PostService } from '../post/post.service';
import { CommentService } from '../comment/comment.service';
import { emitToUser } from '../../common/socket/chat-socket';

const STATUS_TO_DB: Record<string, string> = {
  active: 'ACTIVE',
  locked: 'BLOCKED',
  restricted: 'RESTRICTED',
  hidden: 'HIDDEN',
  deleted: 'HIDDEN',
};

const ROLE_TO_DB: Record<string, string> = {
  admin: 'ADMIN',
  moderator: 'USER',
  user: 'USER',
};

@Injectable()
export class AdminService {
  constructor(
    @InjectRepository(User, 'mariadb')
    private readonly usersRepository: Repository<User>,
    private readonly userService: UserService,
    private readonly postService: PostService,
    private readonly commentService: CommentService,
  ) {}

  private mapUser(user: User) {
    return {
      id: user.userId,
      userId: user.userId,
      username: user.username,
      email: user.email,
      phone: user.phone || '',
      fullName: user.fullName,
      role: String(user.role || 'USER').toLowerCase(),
      accountStatus: this.mapStatus(user.status),
      avatarUrl: user.avatarUrl || '',
      coverUrl: user.coverUrl || '',
      bio: user.bio || null,
      location: user.location || null,
      isVerified: true,
      lockedUntil: user.lockedUntil?.toISOString?.() ?? null,
      warningCount: user.warningCount || 0,
      restrictionReason: user.restrictionReason || null,
      permissions: [],
      createdAt: user.createdAt?.toISOString?.() ?? null,
      lastLoginAt: user.lastLoginAt?.toISOString?.() ?? null,
      registerIp: user.registerIp || null,
    };
  }

  private mapStatus(status?: string) {
    const raw = String(status || 'ACTIVE').toUpperCase();
    if (raw === 'BLOCKED') return 'locked';
    if (raw === 'RESTRICTED') return 'restricted';
    if (raw === 'HIDDEN') return 'hidden';
    if (raw === 'DELETED') return 'deleted';
    return 'active';
  }

  async listUsers(): Promise<{ users: any[] }> {
    const users = await this.usersRepository.find({
      order: { createdAt: 'DESC' },
    });
    return { users: users.map((u) => this.mapUser(u)) };
  }

  async updateUser(
    adminId: number,
    userId: number,
    payload: {
      accountStatus?: string;
      role?: string;
      reason?: string;
      restrictionReason?: string;
      lockedUntil?: string | null;
    },
  ) {
    if (Number(adminId) === Number(userId)) {
      throw new BadRequestException('Không thể tự thay đổi tài khoản của bạn');
    }

    const user = await this.userService.findOne(Number(userId));
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const next: Record<string, any> = {};
    if (payload.role) {
      next.role = ROLE_TO_DB[String(payload.role).toLowerCase()] || 'USER';
    }
    if (payload.accountStatus) {
      const status = STATUS_TO_DB[String(payload.accountStatus).toLowerCase()];
      if (status) next.status = status;
    }
    const reason =
      payload.restrictionReason !== undefined
        ? payload.restrictionReason
        : payload.reason;
    if (reason !== undefined) next.restrictionReason = reason || null;
    if (payload.lockedUntil !== undefined) {
      next.lockedUntil = payload.lockedUntil
        ? new Date(payload.lockedUntil)
        : null;
    }

    const blockingNow =
      next.status &&
      String(next.status).toUpperCase() !== 'ACTIVE' &&
      String(user.status || '').toUpperCase() === 'ACTIVE';

    const updated = await this.userService.update(user.userId, next);

    if (blockingNow) {
      await this.purgeUserContent(user.userId);
    }

    const mapped = this.mapUser(updated);
    emitToUser(user.userId, 'user:updated', mapped);
    return { message: 'Cap nhat tai khoan thanh cong', user: mapped };
  }

  async deleteUser(adminId: number, userId: number) {
    if (Number(adminId) === Number(userId)) {
      throw new BadRequestException('Không thể tự xóa tài khoản của bạn');
    }

    const user = await this.userService.findOne(Number(userId));
    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    await this.purgeUserContent(user.userId);
    await this.userService.deactivateAccount(user.userId);

    const mapped = { ...this.mapUser(user), accountStatus: 'hidden' };
    emitToUser(user.userId, 'user:updated', mapped);
    return { message: 'Xoa tai khoan thanh cong', user: mapped };
  }

  private async purgeUserContent(userId: number) {
    try {
      await this.commentService.deleteAllByUser(userId);
    } catch {
      /* ignore */
    }
    try {
      await this.postService.deleteAllByUser(userId);
    } catch {
      /* ignore */
    }
    try {
      await this.postService.removeAllReactsByUser(userId);
    } catch {
      /* ignore */
    }
  }
}
