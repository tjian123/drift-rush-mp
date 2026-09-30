// src/share.js ── 微信小游戏分享裂变钩子
// 小游戏分享与小程序不同：没有 onShareAppMessage，需在用户点击时主动调用
// wx.shareAppMessage(...)。这里封装「分享最佳成绩」与「好友挑战进入」两类钩子。

export function initShare() {
  try {
    if (wx.showShareMenu) wx.showShareMenu({ withShareTicket: true });
  } catch (e) {
    /* 部分基础库版本无此接口，忽略 */
  }
}

// 主动分享：在 tap 回调里调用即可（如 game.js 右上角热区）。
export function shareBestLap(best) {
  try {
    wx.shareAppMessage({
      title: "我在 Drift Rush 跑出 " + (best != null ? best.toFixed(1) : "—") + "s 最佳圈速，来挑战！",
      imageUrl: "", // 后续可用离屏 canvas 生成成绩图
      query: "from=friend&t=" + Date.now(),
    });
    return true;
  } catch (e) {
    console.warn("[share] shareAppMessage 失败:", e);
    return false;
  }
}

// 好友通过分享链接进入时，拿 query 做挑战钩子。
export function onFriendChallenge(handler) {
  if (!wx.onShow) return;
  wx.onShow((opts) => {
    const q = (opts && opts.query) || {};
    if (q.from === "friend" && handler) handler(q);
  });
}
