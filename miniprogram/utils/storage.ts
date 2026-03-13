/**
 * 本地缓存工具 — Yours·凝刻
 * 封装 wx 存储 API，支持过期时间
 */

interface CacheItem<T> {
  data: T;
  expireAt: number; // 过期时间戳，0 表示永不过期
}

/**
 * 设置缓存
 * @param key 缓存键
 * @param data 缓存数据
 * @param expireMinutes 过期时间（分钟），0 表示永不过期
 */
export const setCache = <T>(key: string, data: T, expireMinutes = 0): void => {
  const item: CacheItem<T> = {
    data,
    expireAt: expireMinutes > 0 ? Date.now() + expireMinutes * 60 * 1000 : 0,
  };
  try {
    wx.setStorageSync(key, JSON.stringify(item));
  } catch (err) {
    console.error('[Storage] 写入缓存失败:', key, err);
  }
};

/**
 * 获取缓存
 * @param key 缓存键
 * @returns 缓存数据，过期或不存在返回 null
 */
export const getCache = <T>(key: string): T | null => {
  try {
    const raw = wx.getStorageSync(key);
    if (!raw) return null;

    const item: CacheItem<T> = JSON.parse(raw);

    // 检查过期
    if (item.expireAt > 0 && Date.now() > item.expireAt) {
      wx.removeStorageSync(key);
      return null;
    }

    return item.data;
  } catch {
    return null;
  }
};

/**
 * 删除缓存
 */
export const removeCache = (key: string): void => {
  try {
    wx.removeStorageSync(key);
  } catch (err) {
    console.error('[Storage] 删除缓存失败:', key, err);
  }
};

/**
 * 清除所有缓存
 */
export const clearCache = (): void => {
  try {
    wx.clearStorageSync();
  } catch (err) {
    console.error('[Storage] 清除缓存失败:', err);
  }
};
