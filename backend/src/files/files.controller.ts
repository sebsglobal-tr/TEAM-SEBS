import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  Body,
  BadRequestException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { FileType } from '@prisma/client';
import { FilesService } from './files.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ActiveUserGuard } from '../common/guards/active-user.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { ConfigService } from '@nestjs/config';

@Controller('files')
@UseGuards(JwtAuthGuard, ActiveUserGuard)
export class FilesController {
  constructor(
    private filesService: FilesService,
    private configService: ConfigService,
  ) {}

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB hard limit
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: JwtPayload,
    @Body('taskId') taskId?: string,
    @Body('fileType') fileType?: FileType,
    @Body('description') description?: string,
  ) {
    if (!file) {
      throw new BadRequestException('Dosya gönderilemedi. Dosya boyutu çok büyük olabilir.');
    }
    return this.filesService.upload(file, user, { taskId, fileType, description });
  }

  @Post('upload-multiple')
  @UseInterceptors(
    FilesInterceptor('files', 50, {
      limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per file
    }),
  )
  uploadMultiple(
    @UploadedFiles() files: Express.Multer.File[],
    @CurrentUser() user: JwtPayload,
    @Body('taskId') taskId?: string,
    @Body('fileType') fileType?: FileType,
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('Dosya gönderilemedi. Dosya boyutu çok büyük olabilir.');
    }
    return this.filesService.uploadMultiple(files, user, { taskId, fileType });
  }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('taskId') taskId?: string,
    @Query('fileType') fileType?: FileType,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('page') page?: string,
  ) {
    return this.filesService.findAll(user, {
      taskId, fileType, search,
      limit: limit ? parseInt(limit, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
    });
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const { file, buffer } = await this.filesService.download(id, user);
    // Türkçe karakterler dahil non-ASCII dosya adlarını RFC 5987 ile encode et
    // Aynı anda ASCII fallback filename gönder (yaşlı tarayıcılar ve mobil için)
    const asciiName = file.originalName.replace(/[^\x20-\x7E]/g, '_');
    const encodedName = encodeURIComponent(file.originalName).replace(/%20/g, ' ');
    return new StreamableFile(buffer, {
      type: file.mimeType,
      disposition: `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      length: file.size,
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    return this.filesService.remove(id, user);
  }
}
