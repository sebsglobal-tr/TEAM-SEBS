import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdir, writeFile, readFile, unlink } from 'fs/promises';
import { join, dirname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { IStorageProvider, StorageUploadResult } from './storage.interface';

@Injectable()
export class LocalStorageProvider implements IStorageProvider {
  private basePath: string;

  constructor(configService: ConfigService) {
    this.basePath = configService.get<string>('STORAGE_LOCAL_PATH', './uploads');
  }

  async upload(file: Express.Multer.File, folder: string): Promise<StorageUploadResult> {
    const storedName = `${uuidv4()}-${file.originalname}`;
    const relativePath = join(folder, storedName);
    const fullPath = join(this.basePath, relativePath);

    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.buffer);

    return { storedName, path: relativePath };
  }

  async download(path: string): Promise<Buffer> {
    return readFile(join(this.basePath, path));
  }

  async delete(path: string): Promise<void> {
    await unlink(join(this.basePath, path));
  }

  getUrl(path: string): string {
    return `/api/files/download/${encodeURIComponent(path)}`;
  }
}
