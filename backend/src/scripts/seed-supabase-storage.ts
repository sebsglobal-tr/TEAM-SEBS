/**
 * Supabase Storage seed script
 *
 * Kullanım:
 *   npx ts-node -r tsconfig-paths/register src/scripts/seed-supabase-storage.ts
 *
 * Not: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri
 * ayarlanmış olmalıdır. NODE_ENV=development ile çalıştırılırsa
 * NestJS ConfigModule .env dosyasını otomatik yükler.
 *
 * Bu script:
 * 1. "worktrack-files" bucket'ını oluşturur (yoksa)
 * 2. Opsiyonel olarak mevcut local dosyaları Supabase'e yükler (--migrate ile)
 */

import { createClient } from '@supabase/supabase-js';
import { readFile, readdir, stat } from 'fs/promises';
import { join } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const LOCAL_PATH = process.env.STORAGE_LOCAL_PATH || './uploads';
const BUCKET_NAME = 'worktrack-files';

async function main() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('HATA: SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY .env dosyasında tanımlı olmalıdır.');
    process.exit(1);
  }

  console.log(`Supabase bağlantısı: ${SUPABASE_URL}`);
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Bucket'ı oluştur
  console.log(`\n📦 Bucket "${BUCKET_NAME}" kontrol ediliyor...`);
  const { data: buckets } = await supabase.storage.listBuckets();
  const exists = buckets?.some((b: any) => b.name === BUCKET_NAME);

  if (!exists) {
    const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
      public: false,
      fileSizeLimit: 104857600, // 100MB
    });
    if (error) {
      console.error(`Bucket oluşturulamadı: ${error.message}`);
      process.exit(1);
    }
    console.log(`✅ Bucket "${BUCKET_NAME}" oluşturuldu.`);
  } else {
    console.log(`✅ Bucket "${BUCKET_NAME}" zaten mevcut.`);
  }

  // 2. Mevcut local dosyaları migrate et
  const migrate = process.argv.includes('--migrate');
  if (migrate) {
    console.log('\n📤 Local dosyalar Supabase\'e yükleniyor...');
    const basePath = join(process.cwd(), LOCAL_PATH);
    let uploaded = 0;
    let skipped = 0;

    try {
      const entries = await readdir(basePath, { recursive: true });
      for (const entry of entries) {
        const fullPath = join(basePath, entry);
        const entryStat = await stat(fullPath).catch(() => null);
        if (!entryStat || !entryStat.isFile()) continue;

        // Bucket içinde aynı yolda dosya var mı kontrol et
        const { data: existing } = await supabase.storage
          .from(BUCKET_NAME)
          .list(entry.split('/').slice(0, -1).join('/'), {
            search: entry.split('/').pop(),
          });

        if (existing && existing.length > 0) {
          console.log(`  ⏭️  Atlanıyor (zaten var): ${entry}`);
          skipped++;
          continue;
        }

        const content = await readFile(fullPath);
        const { error } = await supabase.storage
          .from(BUCKET_NAME)
          .upload(entry, content, { upsert: false });

        if (error) {
          console.error(`  ❌ Hata: ${entry} — ${error.message}`);
        } else {
          console.log(`  ✅ Yüklendi: ${entry}`);
          uploaded++;
        }
      }
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log('  ℹ️  Local uploads dizini bulunamadı, migrasyon atlanıyor.');
      } else {
        throw err;
      }
    }

    console.log(`\n📊 Özet: ${uploaded} yüklendi, ${skipped} atlandı.`);
  }

  console.log('\n✅ Supabase Storage hazır!');
  console.log(`   STORAGE_TYPE=supabase olarak değiştirip Render'da deploy edin.`);
}

main().catch(console.error);
