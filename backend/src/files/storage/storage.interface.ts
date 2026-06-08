export interface StorageUploadResult {
  storedName: string;
  path: string;
}

export interface IStorageProvider {
  upload(file: Express.Multer.File, folder: string): Promise<StorageUploadResult>;
  download(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  getUrl(path: string): string;
}
