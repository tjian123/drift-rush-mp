// src/touch.js ── 小游戏触摸操控：左半屏转向、右半屏油门/刹车
// 移植自网页版 src/touch.js 的「左右分工」思路，但用小游戏全局 wx.onTouch* 实现
// （小游戏没有 WXML 的 bindtouch，也没有 DOM 事件）。

export function createTouch(info) {
  const W = info.windowWidth;
  const H = info.windowHeight;
  const input = { steer: 0, throttle: 0, brake: 0 };

  const left = { id: null, startX: 0, curX: 0 };
  const right = { id: null, startY: 0, curY: 0 };

  function recompute() {
    if (left.id != null) {
      // 左滑手指 = 向左打方向，量程约屏幕宽度的 1/3
      const dx = (left.startX - left.curX) / (W * 0.33);
      input.steer = Math.max(-1, Math.min(1, dx));
    } else {
      input.steer = 0;
    }
    if (right.id != null) {
      input.throttle = 1;
      input.brake = right.curY > H * 0.66 ? 1 : 0; // 右下半屏 = 刹车
    } else {
      input.throttle = 0;
      input.brake = 0;
    }
  }

  wx.onTouchStart((e) => {
    const touches = e.touches || [];
    for (const t of touches) {
      if (t.clientX < W / 2 && left.id == null) {
        left.id = t.identifier;
        left.startX = t.clientX;
        left.curX = t.clientX;
      } else if (t.clientX >= W / 2 && right.id == null) {
        right.id = t.identifier;
        right.startY = t.clientY;
        right.curY = t.clientY;
      }
    }
    recompute();
  });

  wx.onTouchMove((e) => {
    const touches = e.touches || [];
    for (const t of touches) {
      if (t.identifier === left.id) left.curX = t.clientX;
      if (t.identifier === right.id) right.curY = t.clientY;
    }
    recompute();
  });

  function endTouches(e) {
    const changed = e.changedTouches || [];
    for (const t of changed) {
      if (t.identifier === left.id) left.id = null;
      if (t.identifier === right.id) right.id = null;
    }
    recompute();
  }
  wx.onTouchEnd(endTouches);
  wx.onTouchCancel(endTouches);

  return { input, get: () => input };
}
