// src/ads.js ── 微信小游戏广告封装（激励视频 + 横幅）
// 依赖「企业号 + 流量主」资质（见任务 #42/#46）。adUnitId 为占位，上线前替换。
// 所有调用都做了存在性判断，无广告位时自动降级为空操作，不阻塞游戏。

let rewarded = null;

export function initRewarded(adUnitId) {
  if (!adUnitId || !wx.createRewardedVideoAd) return null;
  try {
    rewarded = wx.createRewardedVideoAd({ adUnitId });
    rewarded.onError((e) => console.warn("[ads] 激励视频错误:", e));
    rewarded.onClose((r) => {
      // r && r.isEnded === false 表示中途退出，不发放奖励
      if (!r || r.isEnded) console.log("[ads] 激励视频看完，可发奖励");
      else console.log("[ads] 激励视频未看完");
    });
    rewarded.load();
    return rewarded;
  } catch (e) {
    console.warn("[ads] 创建激励视频失败:", e);
    return null;
  }
}

// 返回 Promise<boolean>：true = 成功展示（无论是否看完，由 onClose 判定发奖）。
export function showRewarded() {
  return new Promise((resolve) => {
    if (!rewarded) {
      resolve(false);
      return;
    }
    rewarded
      .show()
      .then(() => resolve(true))
      .catch(() => {
        // 失败时重新 load 再 show（官方推荐写法）
        rewarded
          .load()
          .then(() => rewarded.show())
          .then(() => resolve(true))
          .catch(() => resolve(false));
      });
  });
}

export function initBanner(adUnitId) {
  if (!adUnitId || !wx.createBannerAd) return null;
  try {
    const b = wx.createBannerAd({
      adUnitId,
      adIntervals: 30,
      style: { left: 0, top: 0, width: 320 },
    });
    b.onError((e) => console.warn("[ads] 横幅错误:", e));
    return b;
  } catch (e) {
    console.warn("[ads] 创建横幅失败:", e);
    return null;
  }
}
