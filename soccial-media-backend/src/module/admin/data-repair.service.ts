import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { Post } from '../post/post.entity';
import { Comment } from '../comment/comment.entity';

// Sua du lieu cu khi khoi dong:
// - Xoa comments cua user khong con ton tai (xoa user truc tiep qua SQL lam
//   sot comment + reacts, khi khien post hien so lieu ao)
// - commentCount cua post = so comment top-level cua tac gia con hoat dong
//   (giong bo loc hien thi cua findByPost, tranh lech so voi UI)
// - Bo reacts cua user khong con ton tai trong post.interacts
@Injectable()
export class DataRepairService implements OnApplicationBootstrap {
  private readonly logger = new Logger('DataRepair');

  constructor(
    @InjectRepository(Post, 'mongodb')
    private readonly postsRepo: Repository<Post>,
    @InjectRepository(Comment, 'mongodb')
    private readonly commentsRepo: Repository<Comment>,
    @InjectRepository(User, 'mariadb')
    private readonly usersRepo: Repository<User>,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.repairPosts();
    } catch (err: any) {
      this.logger.warn(`Data repair failed: ${err?.message}`);
    }
  }

  private async repairPosts() {
    const [posts, comments, users] = await Promise.all([
      this.postsRepo.find({}),
      this.commentsRepo.find({}),
      this.usersRepo.find({}),
    ]);

    const existingIds = new Set(users.map((u) => Number(u.userId)));
    const activeIds = new Set(
      users
        .filter((u) => String(u.status || '').toUpperCase() === 'ACTIVE')
        .map((u) => Number(u.userId)),
    );

    // Xoa comment cua tac gia da khong con ton tai + reply con mo coi
    const deadTopIds = new Set(
      comments
        .filter((c) => !existingIds.has(Number(c.owner?.userId)))
        .map((c) => String(c._id)),
    );
    let removedComments = 0;
    for (const c of comments) {
      const isDeadAuthor = !existingIds.has(Number(c.owner?.userId));
      const isOrphanReply =
        Boolean(c.parentId) && deadTopIds.has(String(c.parentId));
      if (isDeadAuthor || isOrphanReply) {
        await this.commentsRepo.delete({ _id: c._id } as any);
        removedComments++;
      }
    }
    if (removedComments > 0) {
      this.logger.log(`Data repair: removed ${removedComments} orphan comments`);
    }

    const topLevelCounts = new Map<string, number>();
    for (const c of comments) {
      if (!c.parentId && activeIds.has(Number(c.owner?.userId))) {
        const key = String(c.postId);
        topLevelCounts.set(key, (topLevelCounts.get(key) || 0) + 1);
      }
    }

    let updated = 0;
    for (const post of posts) {
      const nextCount = topLevelCounts.get(String(post._id)) || 0;
      const interacts = (post.interacts || []).filter((i) =>
        existingIds.has(Number(i?.userId)),
      );
      const countChanged = Number(post.commentCount || 0) !== nextCount;
      const reactsChanged = interacts.length !== (post.interacts || []).length;

      if (countChanged || reactsChanged) {
        post.commentCount = nextCount;
        post.interacts = interacts;
        await this.postsRepo.save(post);
        updated++;
      }
    }

    if (updated > 0) {
      this.logger.log(`Data repair: fixed counts/reactions on ${updated} posts`);
    }
  }
}
