import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/user.entity';
import { Post } from '../post/post.entity';
import { Comment } from '../comment/comment.entity';

// Sua du lieu cu khi khoi dong:
// - commentCount cua post = so comment top-level thuc te (truoc day dem bang
//   phep cong tru thu cong nen bi lech khi xoa reply/comment hang loat)
// - Bo reacts cua user da khong con ton tai (xoa user truc tiep qua SQL se
//   lam sot reacts trong post.interacts, khien post hien so cam xuc ao)
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
      this.usersRepo.find({ select: ['userId'] as any }),
    ]);

    const activeUserIds = new Set(users.map((u) => Number(u.userId)));

    const topLevelCounts = new Map<string, number>();
    for (const c of comments) {
      if (!c.parentId) {
        const key = String(c.postId);
        topLevelCounts.set(key, (topLevelCounts.get(key) || 0) + 1);
      }
    }

    let updated = 0;
    for (const post of posts) {
      const nextCount = topLevelCounts.get(String(post._id)) || 0;
      const interacts = (post.interacts || []).filter((i) =>
        activeUserIds.has(Number(i?.userId)),
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
