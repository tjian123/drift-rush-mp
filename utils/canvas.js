// utils/canvas.js
// 小程序下替代网页 document.createElement("canvas") 的离屏画布工厂。
// 网页版 world.js 里有 4 处离屏画布（约 line 540/543/546/592），移植时统一改调这里。
//
// 注意：小程序离屏画布用 wx.createOffscreenCanvas({ type: "2d", width, height })，
// 拿到的 canvas 可直接作为 new THREE.CanvasTexture(canvas) 的源（three-platformize 已适配）。

/**
 * 创建 2D 离屏画布（用于程序化纹理、字模、阴影等）。
 * @returns {{ canvas: WechatMiniprogram.OffscreenCanvas, ctx: CanvasRenderingContextType }}
 */
export function createOffscreenCanvas(width, height) {
  const canvas = wx.createOffscreenCanvas({ type: "2d", width, height });
  const ctx = canvas.getContext("2d");
  return { canvas, ctx };
}

/**
 * 便捷：用 draw 回调画一张离屏纹理画布，返回可直接喂给 THREE.CanvasTexture 的 canvas。
 * @param {(ctx: CanvasRenderingContextType, w: number, h: number) => void} draw
 */
export function makeCanvasTexture(draw, width = 256, height = 256) {
  const { canvas, ctx } = createOffscreenCanvas(width, height);
  draw(ctx, width, height);
  return canvas;
}
