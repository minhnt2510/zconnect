import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../user/user.entity';
import { Post } from '../post/post.entity';
import { Comment } from '../comment/comment.entity';
import { UserModule } from '../user/user.module';
import { PostModule } from '../post/post.module';
import { CommentModule } from '../comment/comment.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminBootstrapService } from './admin-bootstrap.service';
import { DataRepairService } from './data-repair.service';
import { AdminGuard } from '../../common/guard/admin.guard';

@Module({
  imports: [
    TypeOrmModule.forFeature([User], 'mariadb'),
    TypeOrmModule.forFeature([Post, Comment], 'mongodb'),
    UserModule,
    PostModule,
    CommentModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminBootstrapService, DataRepairService, AdminGuard],
  exports: [AdminService],
})
export class AdminModule {}
