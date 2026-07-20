import { Module, Global } from '@nestjs/common';
import { MediaService } from './media.service';
import { S3Service } from './s3.service';

@Global()
@Module({
  providers: [MediaService, S3Service],
  exports: [MediaService, S3Service],
})
export class MediaModule {}
