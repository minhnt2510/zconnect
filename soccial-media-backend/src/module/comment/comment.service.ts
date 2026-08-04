import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectId } from 'mongodb';
import { Repository } from 'typeorm';
import { Comment } from './comment.entity';
import { UserService } from '../user/user.service';
import { PostService } from '../post/post.service';
import { emitToConversation } from '../../common/socket/chat-socket';
import { NotificationService } from '../notification/notification.service';
import { UserStatus } from '../../common/enum/user-status.enum';
import {
  SPAM,
  SPAM_BLOCK_MESSAGE,
  SPAM_RESTRICTED_MESSAGE,
} from '../../common/constants/spam.constants';

@Injectable()
export class CommentService {
  constructor(
    @InjectRepository(Comment, 'mongodb')
    private readonly commentsRepository: Repository<Comment>,
    private readonly userService: UserService,
    private readonly postService: PostService,
    private readonly notificationService: NotificationService,
  ) {}

  private async recountCommentCount(postId: string) {
    try {
      // Chi dem comment cua tac gia con hoat dong - giong bo loc hien thi
      // cua findByPost, de count luon khop voi so comment nguoi dung thay duoc
      const topLevel = await this.commentsRepository.find({
        where: { postId, parentId: { $in: ['', null] } } as any,
      });
      const visible = await this.keepActiveAuthors(topLevel);
      await this.postService.setCommentCount(postId, visible.length);
    } catch {
      /* ignore */
    }
  }

  private toResponse(comment: Comment, viewerId?: number) {
    const viewerReact = viewerId
      ? (comment.reacts || []).find((r) => r.userId === viewerId)
      : null;

    return {
      id: String(comment._id),
      postId: comment.postId,
      parentId: comment.parentId || null,
      content: comment.content,
      fileUrl: comment.fileUrl,
      createdAt: comment.createdAt?.toISOString?.() ?? new Date().toISOString(),
      userId: comment.owner?.userId,
      authorName: comment.owner?.displayName || 'Nguoi dung',
      authorUsername: comment.owner?.username || '',
      authorAvatar: comment.owner?.avatarUrl,
      owner: comment.owner,
      reactionCount: (comment.reacts || []).length,
      viewerReaction: viewerReact?.type || null,
      replyCount: 0,
    };
  }

  private async restrictForSpam(userId: number, reason: string): Promise<never> {
    try {
      await this.userService.update(userId, {
        status: UserStatus.RESTRICTED,
        restrictionReason: reason,
      });
    } catch {
      /* ignore */
    }
    try {
      await this.notificationService.create({
        userId,
        type: 'account_restricted',
        title: 'Phát hiện spam',
        content: 'Tài khoản của bạn đã bị khóa do đăng spam. Chờ admin duyệt (khoảng 1 tuần) để tiếp tục.',
        link: '/feed',
        meta: { reason },
      });
    } catch {
      /* ignore */
    }
    throw new HttpException(SPAM_BLOCK_MESSAGE, 429);
  }

  private async checkCommentSpam(userId: number, content: string) {
    // TypeORM mongo count() ignores dotted "owner.userId" paths (returns 0),
    // same limitation as delete(); find() + length is the reliable way.
    const since = new Date(Date.now() - SPAM.COMMENT_WINDOW_MS);
    const recent = await this.commentsRepository.find({
      where: {
        'owner.userId': Number(userId),
        createdAt: { $gte: since },
      } as any,
      take: SPAM.MAX_COMMENTS_PER_WINDOW + 1,
    });
    if (recent.length >= SPAM.MAX_COMMENTS_PER_WINDOW) {
      await this.restrictForSpam(
        userId,
        `Bình luận ${recent.length + 1} lần trong ${SPAM.COMMENT_WINDOW_MS / 60000} phút`,
      );
    }
    if (content) {
      const dup = await this.commentsRepository.find({
        where: {
          'owner.userId': Number(userId),
          content,
          createdAt: { $gte: new Date(Date.now() - SPAM.DUPLICATE_WINDOW_MS) },
        } as any,
        take: SPAM.DUPLICATE_LIMIT + 1,
      });
      if (dup.length >= SPAM.DUPLICATE_LIMIT) {
        await this.restrictForSpam(userId, 'Bình luận trùng lặp nhiều lần');
      }
    }
  }

  async create(
    postId: string,
    content: string,
    parentId: string | null,
    userId: number,
  ) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    if (String(user.status || '').toUpperCase() !== 'ACTIVE') {
      throw new HttpException(SPAM_RESTRICTED_MESSAGE, 403);
    }

    await this.checkCommentSpam(userId, content);

    const comment = this.commentsRepository.create({
      postId,
      content,
      parentId: parentId || '',
      fileUrl: '',
      createdAt: new Date(),
      owner: {
        userId: user.userId,
        username: user.username,
        displayName: user.fullName,
        avatarUrl: user.avatarUrl,
      },
      reacts: [],
    });

    const saved = await this.commentsRepository.save(comment);

    // Recalc post comment count from real data (reply also triggers a recount
    // which is a no-op since only top-level comments are counted)
    await this.recountCommentCount(postId);

    // Emit realtime event
    emitToConversation(
      `post-${postId}`,
      'comment:new',
      this.toResponse(saved, userId),
    );
    emitToConversation(
      'global-feed',
      'comment:new',
      this.toResponse(saved, userId),
    );

    try {
      const postSummary = await this.postService.getPostSummary(postId);
      const postOwnerId = Number(postSummary?.authorId || 0);
      if (postOwnerId > 0 && postOwnerId !== Number(userId)) {
        await this.notificationService.create({
          userId: postOwnerId,
          type: 'post_comment',
          title: 'Co binh luan moi',
          content: `${user.fullName} vua binh luan bai viet cua ban`,
          link: '/feed',
          meta: {
            postId,
            commentId: String(saved._id),
            actorId: Number(user.userId),
            actorName: user.fullName,
            parentId: parentId || null,
          },
        });
      }

      if (parentId) {
        const parentComment = await this.commentsRepository.findOne({
          where: { _id: this.toObjectId(parentId) } as any,
        });
        const parentOwnerId = Number(parentComment?.owner?.userId || 0);
        if (
          parentOwnerId > 0 &&
          parentOwnerId !== Number(userId) &&
          parentOwnerId !== postOwnerId
        ) {
          await this.notificationService.create({
            userId: parentOwnerId,
            type: 'comment_reply',
            title: 'Co phan hoi binh luan moi',
            content: `${user.fullName} da tra loi binh luan cua ban`,
            link: '/feed',
            meta: {
              postId,
              commentId: String(saved._id),
              parentId,
              actorId: Number(user.userId),
              actorName: user.fullName,
            },
          });
        }
      }
    } catch {
      /* ignore notification errors */
    }

    return { comment: this.toResponse(saved, userId) };
  }

  private async keepActiveAuthors<T extends { owner?: { userId?: number } }>(
    items: T[],
  ): Promise<T[]> {
    const ids = Array.from(
      new Set(items.map((i) => Number(i.owner?.userId || 0)).filter(Boolean)),
    );
    if (!ids.length) return items;
    const users = await this.userService.findByIds(ids);
    const activeIds = new Set(
      users
        .filter((u) => String(u.status || '').toUpperCase() === 'ACTIVE')
        .map((u) => u.userId),
    );
    return items.filter((i) => activeIds.has(Number(i.owner?.userId || 0)));
  }

  async findByPost(postId: string, viewerId?: number) {
    const comments = await this.commentsRepository.find({
      where: { postId, parentId: { $in: ['', null] } as any },
      order: { createdAt: 'ASC' },
    });

    const replies = await this.commentsRepository.find({
      where: { postId, parentId: { $ne: '' } as any },
      order: { createdAt: 'ASC' },
    });

    const [visibleComments, visibleReplies] = await Promise.all([
      this.keepActiveAuthors(comments),
      this.keepActiveAuthors(replies),
    ]);

    const visibleTopIds = new Set(visibleComments.map((c) => String(c._id)));
    const commentMap = new Map<string, any[]>();
    for (const reply of visibleReplies) {
      const parentKey = reply.parentId || String(reply._id);
      if (!visibleTopIds.has(parentKey)) continue;
      if (!commentMap.has(parentKey)) commentMap.set(parentKey, []);
      commentMap.get(parentKey)!.push(this.toResponse(reply, viewerId));
    }

    return {
      comments: visibleComments.map((c) => ({
        ...this.toResponse(c, viewerId),
        replyCount: commentMap.get(String(c._id))?.length || 0,
        replies: commentMap.get(String(c._id)) || [],
      })),
      total: visibleComments.length,
    };
  }

  async react(commentId: string, userId: number, type: string) {
    const user = await this.userService.findOne(userId);
    if (!user) throw new NotFoundException('User not found');

    const comment = await this.commentsRepository.findOne({
      where: { _id: this.toObjectId(commentId) } as any,
    });
    if (!comment) throw new NotFoundException('Comment not found');

    comment.reacts = (comment.reacts || []).filter((r) => r.userId !== userId);
    comment.reacts.push({
      userId: user.userId,
      username: user.username,
      displayName: user.fullName,
      avatarUrl: user.avatarUrl,
      type,
      createdAt: new Date(),
    });

    const saved = await this.commentsRepository.save(comment);

    const ownerId = Number(saved.owner?.userId || 0);
    if (ownerId > 0 && ownerId !== Number(userId)) {
      try {
        await this.notificationService.create({
          userId: ownerId,
          type: 'comment_reaction',
          title: 'Co nguoi tha cam xuc binh luan',
          content: `${user.fullName} da tha cam xuc binh luan cua ban`,
          link: '/feed',
          meta: {
            postId: saved.postId,
            commentId: String(saved._id),
            actorId: Number(user.userId),
            actorName: user.fullName,
            reactionType: type,
          },
        });
      } catch {
        /* ignore notification errors */
      }
    }

    return { comment: this.toResponse(saved, userId) };
  }

  async unreact(commentId: string, userId: number) {
    const comment = await this.commentsRepository.findOne({
      where: { _id: this.toObjectId(commentId) } as any,
    });
    if (!comment) throw new NotFoundException('Comment not found');

    comment.reacts = (comment.reacts || []).filter((r) => r.userId !== userId);
    const saved = await this.commentsRepository.save(comment);
    return { comment: this.toResponse(saved, userId) };
  }

  async delete(commentId: string, userId: number) {
    const comment = await this.commentsRepository.findOne({
      where: { _id: this.toObjectId(commentId) } as any,
    });
    if (!comment) throw new NotFoundException('Comment not found');

    const isOwner = Number(comment.owner?.userId) === Number(userId);
    if (!isOwner) {
      let postOwnerId = 0;
      try {
        postOwnerId = Number(
          (await this.postService.getPostSummary(comment.postId))?.authorId || 0,
        );
      } catch {
        postOwnerId = 0;
      }
      if (postOwnerId !== Number(userId)) {
        throw new ForbiddenException('Not authorized');
      }
    }

    // Xoa ca reply mo coi cua comment goc de khong con sot ban sao
    const replies = await this.commentsRepository.find({
      where: { parentId: commentId } as any,
    });
    for (const reply of replies) {
      await this.commentsRepository.delete({ _id: reply._id } as any);
    }

    await this.commentsRepository.delete({
      _id: this.toObjectId(commentId),
    } as any);

    await this.recountCommentCount(comment.postId);

    return { message: 'Comment deleted successfully' };
  }

  async deleteAllByUser(userId: number): Promise<void> {
    const authored = await this.commentsRepository.find({
      where: { 'owner.userId': Number(userId) } as any,
    });

    const authoredIds = authored.map((c) => String(c._id));
    const affectedPostIds = Array.from(
      new Set(
        authored.map((c) => String(c.postId)).filter((id) => id && id !== ''),
      ),
    );

    // Delete by _id: TypeORM mongo delete() with the nested "owner.userId"
    // path would silently drop the whole collection instead of filtering.
    for (const comment of authored) {
      await this.commentsRepository.delete({ _id: comment._id } as any);
    }

    const orphanReplies = authoredIds.length
      ? await this.commentsRepository.find({
          where: { parentId: { $in: authoredIds } } as any,
        })
      : [];
    for (const reply of orphanReplies) {
      await this.commentsRepository.delete({ _id: reply._id } as any);
    }

    // Recalc tu so lieu thuc te thay cho phep tru thuc cong (tru 1 lan/post
    // cung khong chinh xac khi user co nhieu comment tren cung mot post)
    for (const postId of affectedPostIds) {
      await this.recountCommentCount(postId);
    }

    const reactedComments = await this.commentsRepository.find({
      where: { 'reacts.userId': Number(userId) } as any,
    });
    for (const comment of reactedComments) {
      comment.reacts = (comment.reacts || []).filter(
        (r) => Number(r.userId) !== Number(userId),
      );
      await this.commentsRepository.save(comment);
    }
  }

  async syncAuthorProfile(userId: number, fullName: string, avatarUrl: string, username: string) {
    // Filter by owner first, then also update reactions in a separate pass
    const authoredComments = await this.commentsRepository.find({
      where: { 'owner.userId': Number(userId) } as any,
    });

    if (authoredComments.length) {
      for (const comment of authoredComments) {
        comment.owner.displayName = fullName;
        comment.owner.avatarUrl = avatarUrl || '';
        comment.owner.username = username;
      }
      await this.commentsRepository.save(authoredComments);
    }

    // Update reactions for reacts matching this user
    const reactedComments = await this.commentsRepository.find({
      where: { 'reacts.userId': Number(userId) } as any,
    });

    if (reactedComments.length) {
      for (const comment of reactedComments) {
        comment.reacts = (comment.reacts || []).map((react: any) => {
          if (Number(react?.userId) !== Number(userId)) return react;
          return {
            ...react,
            displayName: fullName,
            avatarUrl: avatarUrl || '',
            username,
          };
        });
      }
      await this.commentsRepository.save(reactedComments);
    }
  }

  async deleteByPost(postId: string): Promise<number> {
    const comments = await this.commentsRepository.find({
      where: { postId } as any,
    });
    for (const comment of comments) {
      await this.commentsRepository.delete({ _id: comment._id } as any);
    }
    return comments.length;
  }

  async findRawById(id: string): Promise<Comment | null> {
    if (!ObjectId.isValid(id)) return null;
    return this.commentsRepository.findOne({
      where: { _id: new ObjectId(id) } as any,
    });
  }

  private toObjectId(id: string): any {
    if (!ObjectId.isValid(id)) {
      throw new BadRequestException('Comment id khong hop le');
    }
    return new ObjectId(id);
  }
}
