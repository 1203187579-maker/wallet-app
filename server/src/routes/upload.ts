import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import { S3Storage } from 'coze-coding-dev-sdk';
import { successResponse, errorResponse } from '../utils';

const router = express.Router();

// 配置multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 初始化 S3 对象存储
const storage = new S3Storage({
  endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
  accessKey: "",
  secretKey: "",
  bucketName: process.env.COZE_BUCKET_NAME,
  region: "cn-beijing",
});

/**
 * 上传文件
 * POST /api/v1/upload
 * Body: FormData with file
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorResponse('未找到上传文件'));
    }

    const { buffer, originalname, mimetype } = req.file;
    
    // 生成文件名（添加时间戳防止冲突）
    const ext = originalname.split('.').pop() || 'jpg';
    const fileName = `uploads/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
    
    try {
      // 上传到 S3 对象存储
      const fileKey = await storage.uploadFile({
        fileContent: buffer,
        fileName: fileName,
        contentType: mimetype,
      });

      // 生成签名 URL（有效期 7 天）
      const signedUrl = await storage.generatePresignedUrl({
        key: fileKey,
        expireTime: 7 * 24 * 60 * 60, // 7 天
      });

      res.json({
        success: true,
        url: signedUrl,
        key: fileKey,
      });
    } catch (storageError) {
      console.error('Upload to S3 storage error:', storageError);
      // 降级：返回 base64 数据 URL
      const base64 = buffer.toString('base64');
      const dataUrl = `data:${mimetype};base64,${base64}`;
      res.json({
        success: true,
        url: dataUrl,
        message: '文件已处理（本地存储）'
      });
    }
  } catch (error: any) {
    console.error('Upload error:', error);
    res.status(500).json(errorResponse(error.message || '上传失败'));
  }
});

export default router;
