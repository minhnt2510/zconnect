import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../../module/user/user.service';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private userService: UserService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException('Chưa đăng nhập');

    let payload: { sub: number };
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Token không hợp lệ');
    }

    const user = await this.userService.findOne(Number(payload.sub || 0));
    if (!user) {
      throw new UnauthorizedException('Người dùng không tồn tại');
    }
    if (String(user.status || '').toUpperCase() !== 'ACTIVE') {
      throw new ForbiddenException('Tài khoản đã bị vô hiệu hóa');
    }
    if (String(user.role || '').toUpperCase() !== 'ADMIN') {
      throw new ForbiddenException('Bạn không có quyền truy cập');
    }

    request.user = { sub: user.userId, username: user.username, role: 'ADMIN' };
    return true;
  }

  private extractToken(request: any): string | null {
    const header = request.headers?.authorization;
    if (!header) return null;
    const [type, token] = header.split(' ');
    return type === 'Bearer' ? token : null;
  }
}
