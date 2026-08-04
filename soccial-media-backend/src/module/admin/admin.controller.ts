import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminGuard } from '../../common/guard/admin.guard';

@Controller('api')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('moderator/users')
  @UseGuards(AdminGuard)
  listUsers() {
    return this.adminService.listUsers();
  }

  @Patch('social/admin/users/:id')
  @UseGuards(AdminGuard)
  updateUser(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      accountStatus?: string;
      role?: string;
      reason?: string;
      restrictionReason?: string;
      lockedUntil?: string | null;
    },
  ) {
    return this.adminService.updateUser(req.user.sub, id, body);
  }

  @Delete('admin/users/:id')
  @UseGuards(AdminGuard)
  deleteUser(@Req() req: any, @Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(req.user.sub, id);
  }

  @Get('social/admin/posts')
  @UseGuards(AdminGuard)
  listPosts(
    @Query('q') q?: string,
    @Query('status') status?: string,
    @Query('visibility') visibility?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.listPosts({
      q,
      status,
      visibility,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Patch('social/admin/posts/:id')
  @UseGuards(AdminGuard)
  updatePost(
    @Param('id') id: string,
    @Body() body: { status?: string; visibility?: string },
  ) {
    return this.adminService.updatePost(id, body);
  }

  @Delete('social/admin/posts/:id')
  @UseGuards(AdminGuard)
  deletePost(@Param('id') id: string) {
    return this.adminService.deletePost(id);
  }
}
