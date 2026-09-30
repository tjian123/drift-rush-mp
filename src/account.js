// src/account.js ── 匿名账号（wx.login）+ 预留 WorkBuddyCloud 云存档/排行榜
// 小游戏无 DOM，用 wx.login 拿 code 生成匿名 id；后续把 code 发到 WorkBuddyCloud
// 换取 openid / 建号 / 拉取跨端云存档（支撑「微信引流 → 端外付费」分流策略）。

let cached = null;

export function login() {
  if (cached) return Promise.resolve(cached);
  return new Promise((resolve) => {
    wx.login({
      success: (res) => {
        cached = { code: res.code, anonId: "wx_" + (res.code || "anon") };
        // TODO: 把 code 发到 WorkBuddyCloud 后端换取 openid 并拉取云存档
        resolve(cached);
      },
      fail: () => {
        cached = { code: null, anonId: "local_" + Date.now() };
        resolve(cached);
      },
    });
  });
}

export function getAccount() {
  return cached;
}
