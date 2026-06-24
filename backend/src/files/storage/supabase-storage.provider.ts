import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { IStorageProvider, StorageUploadResult } from './storage.interface';

const BUCKET_NAME = 'worktrack-files';

@Injectable()
export class SupabaseStorageProvider implements IStorageProvider {
  private readonly logger = new Logger(SupabaseStorageProvider.name);
  private supabase: SupabaseClient;
  private bucketReady = false;

  constructor(configService: ConfigService) {
    const supabaseUrl = configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      this.logger.warn(
        'SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik. Supabase Storage devre dışı.',
      );
      this.supabase = null as any;
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });
  }

  private ensureBucketPromise: Promise<void> | null = null;

  private async ensureBucket(): Promise<void> {
    if (this.bucketReady || !this.supabase) return;
    // Aynı anda birden fazla ensureBucket çağrısını önle
    if (this.ensureBucketPromise) return this.ensureBucketPromise;

    this.ensureBucketPromise = (async () => {
      try {
        const { data: buckets } = await this.supabase.storage.listBuckets();
        const exists = buckets?.some((b) => b.name === BUCKET_NAME);
        if (!exists) {
          const { error } = await this.supabase.storage.createBucket(BUCKET_NAME, {
            public: false,
            fileSizeLimit: 104857600, // 100MB
          });
          if (error) throw error;
          this.logger.log(`Bucket "${BUCKET_NAME}" oluşturuldu.`);
        }
        this.bucketReady = true;
      } catch (err: any) {
        this.logger.warn(`Bucket oluşturulamadı: ${err.message}`);
      }
    })();

    return this.ensureBucketPromise;
  }

  async upload(file: Express.Multer.File, folder: string): Promise<StorageUploadResult> {
    if (!this.supabase) {
      throw new Error('Supabase Storage yapılandırılmamış. Lütfen SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ayarlayın.');
    }

    await this.ensureBucket();

    const storedName = `${uuidv4()}-${file.originalname}`;
    const path = `${folder}/${storedName}`;

    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .upload(path, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

    if (error) {
      this.logger.error(`Supabase upload hatası: ${error.message}`);
      throw new Error(`Dosya yüklenirken hata: ${error.message}`);
    }

    this.logger.log(`Dosya yüklendi: ${path} (${file.size} bytes)`);
    return { storedName, path };
  }

  async download(path: string): Promise<Buffer> {
    if (!this.supabase) {
      throw new Error('Supabase Storage yapılandırılmamış.');
    }

    const { data, error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .download(path);

    if (error) {
      this.logger.error(`Supabase download hatası: ${error.message}`);
      throw new Error(`Dosya indirilirken hata: ${error.message}`);
    }

    // Convert Blob to Buffer
    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(path: string): Promise<void> {
    if (!this.supabase) {
      throw new Error('Supabase Storage yapılandırılmamış.');
    }

    const { error } = await this.supabase.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      this.logger.error(`Supabase delete hatası: ${error.message}`);
      throw new Error(`Dosya silinirken hata: ${error.message}`);
    }
  }

  getUrl(path: string): string {
    if (!this.supabase) return '';
    // Backend üzerinden proxied download kullanılıyor, URL gerekmiyor
    return path;
  }
}
