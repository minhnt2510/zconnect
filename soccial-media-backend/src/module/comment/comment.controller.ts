import {
  Body,
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  NotFoundException,
} from '@nestjs/common';
import { CommentService } from './comment.service';
import { JwtAuthGuard } from '../../common/guard/jwt-auth.guard';

@Controller('api/social')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('posts/:postId/comments')
  @UseGuards(JwtAuthGuard)
  create(
    @Param('postId') postId: string,
    @Body() body: { content: string; parentId?: string; parentCommentId?: string },
    @Req() req: any,
  ) {
    return this.commentService.create(
      postId,
      body.content,
      body.parentCommentId || body.parentId || null,
      req.user.sub,
    );
  }

  @Post("comments/:id/replies")
  @UseGuards(JwtAuthGuard)
  async addReply(
    @Param("id") id: string,
    @Body() body: { content: string; imageUrl?: string },
    @Req() req: any,
  ) {
    const parentComment = await this.commentService.findRawById(id);
    if (!parentComment) throw new NotFoundException("Comment not found");
    return this.commentService.create(
      parentComment.postId,
      body.content,
      id,
      req.user.sub,
    );
  }

  @Get("posts/:postId/comments")
  async getComments(@Param('postId') postId: string, @Req() req: any) {
    return this.commentService.findByPost(postId, req.user?.sub);
  }

  @Post('comments/:id/reaction')
  @UseGuards(JwtAuthGuard)
  react(
    @Param('id') id: string,
    @Body() body: { type?: string },
    @Req() req: any,
  ) {
    return this.commentService.react(id, req.user.sub, body.type || 'like');
  }

  @Delete('comments/:id/reaction')
  @UseGuards(JwtAuthGuard)
  unreact(@Param('id') id: string, @Req() req: any) {
    return this.commentService.unreact(id, req.user.sub);
  }

  @Delete('comments/:id')
  @UseGuards(JwtAuthGuard)
  delete(@Param('id') id: string, @Req() req: any) {
    return this.commentService.delete(id, req.user.sub);
  }
}
