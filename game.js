// game.js ── Drift Rush 微信小游戏入口
// 小游戏没有 Page/App/WXML/WXSS，所有逻辑都在 game.js（及它 import 的模块）里。
// 主流程：拿到主画布 → three-platformize 接入 → 建世界 → 跑主循环 → 接触摸/分享/广告/账号。
//
// ⚠️ 本文件只能在「微信开发者工具」里跑（依赖 wx.* 全局），沙箱无法编译验证。
//    首次构建前需在开发者工具里点「构建 npm」（three-platformize 标准路径，非 Vite）。

import * as THREE from "three-platformize";
import WechatPlatform from "./utils/wechat-platform.js";
import { createWorld } from "./src/world.js";
import { createTouch } from "./src/touch.js";
import { initShare, shareBestLap, onFriendChallenge } from "./src/share.js";
import { initRewarded, showRewarded, initBanner } from "./src/ads.js";
import { login } from "./src/account.js";

// ── 屏幕信息 ───────────────────────────────────────────────
// 小游戏已锁定横屏（game.json deviceOrientation: "landscape"），
// windowWidth > windowHeight，触摸左右分工按横屏坐标计算。
const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
info.pixelRatio = info.pixelRatio || 2;

// ── 主画布 + WebGL 上下文 ──────────────────────────────────
const canvas = wx.createCanvas();
const gl = canvas.getContext("webgl");

// 关键：必须在 new THREE.WebGLRenderer 之前把适配层注入 three。
const platform = new WechatPlatform(canvas);
THREE.PLATFORM.set(platform);

// ── 世界 / 输入 ────────────────────────────────────────────
const world = createWorld(THREE, canvas, gl, info);
const touch = createTouch(info);

// ── 分享 / 广告 / 账号（变现与留存基础设施）────────────────
initShare(world);
onFriendChallenge((q) => console.log("[share] 好友挑战进入:", q));

// 广告位 adUnitId 为占位，上线前替换为微信后台申请的真实广告位（需企业号+流量主）。
initRewarded("");
const banner = initBanner("");
if (banner) banner.show().catch(() => {});

login().then((acc) => console.log("[account] anonId =", acc.anonId));

// ── 分享热区：右上角轻触触发分享成绩 ─────────────────────
wx.onTouchStart((e) => {
  const t = e.touches && e.touches[0];
  if (t && t.clientX > info.windowWidth * 0.78 && t.clientY < info.windowHeight * 0.12) {
    shareBestLap(world.state.best);
  }
});

// ── 看广告解锁（示例）：右上角长按区域之外的「双击」暂未接，留给 UI；
//    这里暴露一个全局钩子，方便后续 UI 按钮调用。
wx.__drShowRewarded = () => showRewarded();

// ── 主循环 ────────────────────────────────────────────────
let last = Date.now();
function loop() {
  const now = Date.now();
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05; // 后台切回时防止大跳

  const s = world.update(dt, touch.get());
  world.drawHUD(s);
  world.render();
  wx.requestAnimationFrame(loop);
}
wx.requestAnimationFrame(loop);

// 横竖屏翻转（极少数机型）时同步相机/渲染尺寸。
if (wx.onWindowResize) {
  wx.onWindowResize((r) => {
    if (r && r.windowWidth) world.resize(r.windowWidth, r.windowHeight);
  });
}
