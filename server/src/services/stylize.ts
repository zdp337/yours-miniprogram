/**
 * Q版风格化服务 — Yours·凝刻
 * 调用腾讯混元 ImageToImage API 将真人照片转为 Q版手办风格
 * 
 * API: aiart.tencentcloudapi.com / ImageToImage
 * 风格: 121（黏土/泡泡马特风格）
 * 
 * 流程：真人照片 → ImageToImage 风格化 → Q版2D图 → 混元3D → Q版3D模型
 */

import axios from 'axios';
import crypto from 'crypto';

// ========== 风格编号常量 ==========

/** 可选风格列表 */
export const STYLE_OPTIONS = {
  /** 黏土 — 最接近泡泡马特/盲盒手办，哑光质感 ⭐推荐 */
  CLAY: '121',
  /** 3D卡通 — 立体卡通效果 */
  CARTOON_3D: '116',
  /** 卡通插画 — 经典Q版大头比例 */
  CARTOON_ILLUSTRATION: '107',
  /** 2.5D动画 — Q版立体感 */
  ANIMATION_2_5D: '210',
} as const;

/** 默认风格（黏土 = 泡泡马特风格） */
const DEFAULT_STYLE = STYLE_OPTIONS.CLAY;

/** Q版 Prompt（引导生成更好的手办效果） */
const Q_VERSION_PROMPT = 'Q版手办，泡泡马特风格，大头小身体，可爱，3D渲染，光滑材质，白色背景，精致细节，全身像，正面视角';

/** 反向 Prompt（排除不需要的元素） */
const NEGATIVE_PROMPT = '模糊，变形，多余手指，文字水印，低质量，恐怖，暴力';

// ========== TC3 签名（aiart 服务） ==========

interface StylizeConfig {
  secretId: string;
  secretKey: string;
  region: string;
}

const getConfig = (): StylizeConfig => ({
  secretId: process.env.HUNYUAN_SECRET_ID || process.env.COS_SECRET_ID || '',
  secretKey: process.env.HUNYUAN_SECRET_KEY || process.env.COS_SECRET_KEY || '',
  region: process.env.HUNYUAN_REGION || 'ap-guangzhou',
});

/**
 * TC3-HMAC-SHA256 签名（aiart 服务）
 */
const signRequest = (
  action: string,
  payload: string,
  timestamp: number,
  config: StylizeConfig
): string => {
  const endpoint = 'aiart.tencentcloudapi.com';
  const service = 'aiart';
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);

  // 1. 规范请求串
  const canonicalHeaders = `content-type:application/json\nhost:${endpoint}\nx-tc-action:${action.toLowerCase()}\n`;
  const signedHeaders = 'content-type;host;x-tc-action';
  const hashedPayload = crypto.createHash('sha256').update(payload).digest('hex');
  const canonicalRequest = [
    'POST', '/', '', canonicalHeaders, signedHeaders, hashedPayload,
  ].join('\n');

  // 2. 待签名字符串
  const algorithm = 'TC3-HMAC-SHA256';
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonical = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  const stringToSign = [algorithm, timestamp, credentialScope, hashedCanonical].join('\n');

  // 3. 计算签名
  const secretDate = crypto.createHmac('sha256', `TC3${config.secretKey}`).update(date).digest();
  const secretService = crypto.createHmac('sha256', secretDate).update(service).digest();
  const secretSigning = crypto.createHmac('sha256', secretService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

  return `${algorithm} Credential=${config.secretId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
};

// ========== 风格化接口 ==========

export interface StylizeResult {
  /** 风格化后的图片 URL（有效期1小时） */
  imageUrl: string;
  /** 使用的风格编号 */
  styleId: string;
}

/**
 * 将真人照片风格化为 Q版手办风格
 * 
 * @param imageUrl — 原始照片 URL（支持 http/https）
 * @param styleId — 风格编号（默认 121 黏土/泡泡马特）
 * @returns 风格化后的图片 URL
 */
export const stylizeToQVersion = async (
  imageUrl: string,
  styleId: string = DEFAULT_STYLE
): Promise<StylizeResult> => {
  const config = getConfig();
  const endpoint = 'aiart.tencentcloudapi.com';

  if (!config.secretId || !config.secretKey) {
    throw new Error('风格化服务未配置密钥（HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY）');
  }

  const params: Record<string, any> = {
    InputUrl: imageUrl,
    Prompt: Q_VERSION_PROMPT,
    NegativePrompt: NEGATIVE_PROMPT,
    Styles: [styleId],
    Strength: 0.75, // 风格化强度（0.75 兼顾 Q版效果和原照辨识度）
    ResultConfig: {
      Resolution: '768:1024', // 3:4 竖图（适合全身手办）
    },
    RspImgType: 'url', // 返回 URL（避免 base64 太大）
    EnhanceImage: 1,   // 开启画质增强
    RestoreFace: 1,    // 面部优化
  };

  const payload = JSON.stringify(params);
  const timestamp = Math.floor(Date.now() / 1000);
  const authorization = signRequest('ImageToImage', payload, timestamp, config);

  console.log(`[Stylize] 开始风格化: style=${styleId}, imageUrl=${imageUrl.slice(0, 80)}...`);

  try {
    const response = await axios.post(`https://${endpoint}`, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
        Host: endpoint,
        'X-TC-Action': 'ImageToImage',
        'X-TC-Version': '2022-12-29',
        'X-TC-Region': config.region,
        'X-TC-Timestamp': timestamp.toString(),
      },
      timeout: 60000, // 风格化可能需要较长时间
    });

    const resp = response.data.Response;

    if (resp.Error) {
      throw new Error(`风格化API错误 [${resp.Error.Code}]: ${resp.Error.Message}`);
    }

    const resultImage = resp.ResultImage;

    if (!resultImage) {
      throw new Error('风格化API未返回图片');
    }

    // ResultImage 可能是 URL 或 base64
    let finalUrl = resultImage;

    // 如果返回的是 base64，需要保存到服务器
    if (!resultImage.startsWith('http')) {
      // base64 数据，需要保存为文件
      const fs = require('fs');
      const path = require('path');
      const uploadsDir = path.join(process.cwd(), 'uploads', 'stylized');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const fileName = `stylized_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;
      const filePath = path.join(uploadsDir, fileName);
      const buffer = Buffer.from(resultImage, 'base64');
      fs.writeFileSync(filePath, buffer);

      // 构建可访问的 URL
      const serverHost = process.env.SERVER_HOST || `http://43.138.185.112:${process.env.PORT || 3001}`;
      finalUrl = `${serverHost}/uploads/stylized/${fileName}`;
      console.log(`[Stylize] base64 已保存为文件: ${finalUrl}`);
    }

    console.log(`[Stylize] 风格化完成: ${finalUrl.slice(0, 80)}...`);

    return {
      imageUrl: finalUrl,
      styleId,
    };
  } catch (err: any) {
    if (err.response?.data?.Response?.Error) {
      const apiErr = err.response.data.Response.Error;
      throw new Error(`风格化API错误 [${apiErr.Code}]: ${apiErr.Message}`);
    }
    throw err;
  }
};

/**
 * 检查风格化服务是否可用
 */
export const isStylizeAvailable = (): boolean => {
  const config = getConfig();
  return !!(config.secretId && config.secretKey);
};
