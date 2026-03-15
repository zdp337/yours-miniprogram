/**
 * 腾讯云 COS 文件服务 — Yours·凝刻
 * 照片上传 / 模型文件存储
 */

import COS from 'cos-nodejs-sdk-v5';
import { Readable } from 'stream';
import path from 'path';

const cos = new COS({
  SecretId: process.env.COS_SECRET_ID || '',
  SecretKey: process.env.COS_SECRET_KEY || '',
});

const BUCKET = process.env.COS_BUCKET || 'yours-1234567890';
const REGION = process.env.COS_REGION || 'ap-guangzhou';
const CDN_DOMAIN = process.env.COS_CDN_DOMAIN || '';

/**
 * 上传文件到 COS
 * @param key 存储路径 (如: photos/user_1/xxx.jpg)
 * @param body 文件内容 (Buffer 或 ReadableStream)
 * @returns 文件访问 URL
 */
export const uploadFile = async (
  key: string,
  body: Buffer | Readable,
  contentType?: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    cos.putObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Body: body,
        ContentType: contentType,
      },
      (err, data) => {
        if (err) {
          console.error('[COS] 上传失败:', err);
          reject(new Error('文件上传失败'));
          return;
        }
        const url = CDN_DOMAIN
          ? `${CDN_DOMAIN}/${key}`
          : `https://${BUCKET}.cos.${REGION}.myqcloud.com/${key}`;
        resolve(url);
      }
    );
  });
};

/**
 * 删除 COS 文件
 */
export const deleteFile = async (key: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    cos.deleteObject(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
      },
      (err) => {
        if (err) {
          console.error('[COS] 删除失败:', err);
          reject(new Error('文件删除失败'));
          return;
        }
        resolve();
      }
    );
  });
};

/**
 * 生成临时上传签名 URL（供小程序端直传）
 */
export const getUploadSignUrl = async (
  key: string,
  contentType: string
): Promise<{ url: string; headers: Record<string, string> }> => {
  return new Promise((resolve, reject) => {
    cos.getObjectUrl(
      {
        Bucket: BUCKET,
        Region: REGION,
        Key: key,
        Method: 'PUT',
        Sign: true,
        Expires: 600,
      },
      (err, data) => {
        if (err) {
          reject(new Error('获取签名失败'));
          return;
        }
        resolve({
          url: data.Url,
          headers: {
            'Content-Type': contentType,
          },
        });
      }
    );
  });
};

/**
 * 生成照片存储 Key
 */
export const generatePhotoKey = (userId: number, filename: string): string => {
  const ext = path.extname(filename) || '.jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `photos/user_${userId}/${timestamp}_${random}${ext}`;
};

/**
 * 生成裁剪照片存储 Key
 */
export const generateCroppedKey = (userId: number, filename: string): string => {
  const ext = path.extname(filename) || '.jpg';
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `photos/user_${userId}/cropped_${timestamp}_${random}${ext}`;
};
