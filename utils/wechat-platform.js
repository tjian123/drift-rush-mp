// utils/wechat-platform.js
// ───────────────────────────────────────────────────────────────────────────
// WeChat 平台适配层（three-platformize 的 Platform 契约实现）。
//
// three-platformize@1.133.3 的 npm 包**没有**附带官方 WechatPlatform，
// 这里自行实现：把小程序的 wx / 全局对象 暴露成 three 需要的 browser 全局
// （window / document / XMLHttpRequest / OffscreenCanvas / Image …）。
//
// three-platformize 在 PLATFORM.set(platform) 时会调用 platform.getGlobals()
// 读取以下字段：atob / Blob / window / document / XMLHttpRequest /
// OffscreenCanvas / HTMLCanvasElement / createImageBitmap，以及 window 上的
// URL / DOMParser / TextDecoder / requestAnimationFrame / cancelAnimationFrame。
//
// ⚠️ 该文件无法在沙箱里跑微信模拟器验证，需在「微信开发者工具」里实测。
//    若某处报错，多半是某个 three 内部用到的全局未覆盖，按需在此补齐即可。
// ───────────────────────────────────────────────────────────────────────────

const noop = () => {};

function makeXHR() {
  const xhr = {
    status: 0,
    response: null,
    responseText: "",
    responseType: "",
    withCredentials: false,
    onload: null,
    onerror: null,
    onprogress: null,
    onreadystatechange: null,
    _headers: {},
    open(method, url) {
      this.method = method;
      this.url = url;
    },
    setRequestHeader(k, v) {
      this._headers[k] = v;
    },
    abort() {},
    send(data) {
      const isBinary =
        this.responseType === "arraybuffer" || this.responseType === "blob";
      wx.request({
        url: this.url,
        method: (this.method || "GET").toUpperCase(),
        data: data || "",
        responseType: isBinary ? "arraybuffer" : "text",
        header: this._headers,
        enableHttp2: false,
        success: (res) => {
          this.status = res.statusCode;
          this.response = res.data;
          this.responseText = isBinary ? "" : res.data || "";
          if (this.onload) this.onload();
          if (this.onreadystatechange) this.onreadystatechange();
        },
        fail: (err) => {
          this.status = 0;
          if (this.onerror) this.onerror(err);
        },
      });
    },
  };
  return xhr;
}

function makeImg() {
  // 小程序没有 DOM Image，用 wx.createImage 顶替（three 的 ImageLoader 需要 src/onload/onerror）
  try {
    return wx.createImage();
  } catch (e) {
    return { src: "", onload: noop, onerror: noop, width: 0, height: 0 };
  }
}

class WechatPlatform {
  constructor(canvas) {
    this.canvas = canvas;
    this.globals = this._buildGlobals();
  }

  _buildGlobals() {
    const win = globalThis || global || {};

    // requestAnimationFrame / cancelAnimationFrame（优先用 canvas 节点自带，否则 setTimeout 兜底）
    const raf = (cb) =>
      this.canvas && this.canvas.requestAnimationFrame
        ? this.canvas.requestAnimationFrame(cb)
        : setTimeout(() => cb(Date.now()), 16);
    const caf = (id) =>
      this.canvas && this.canvas.cancelAnimationFrame
        ? this.canvas.cancelAnimationFrame(id)
        : clearTimeout(id);
    win.requestAnimationFrame = raf;
    win.cancelAnimationFrame = caf;
    if (!win.URL)
      win.URL = { createObjectURL: noop, revokeObjectURL: noop };
    if (!win.DOMParser)
      win.DOMParser = class {
        parseFromString() {
          return { body: {}, documentElement: {} };
        }
      };
    if (!win.TextDecoder)
      win.TextDecoder =
        typeof TextDecoder !== "undefined"
          ? TextDecoder
          : class {
              decode() {
                return "";
              }
            };

    // document：three 用 createElementNS('img') 加载贴图、createElement('canvas') 做离屏绘制
    const doc = {
      createElement: (tag) => {
        if (tag === "canvas") {
          return wx.createOffscreenCanvas({ type: "2d", width: 300, height: 150 });
        }
        return makeImg();
      },
      createElementNS: (_ns, tag) => doc.createElement(tag),
      createOffscreenCanvas: (w, h) =>
        wx.createOffscreenCanvas({ type: "2d", width: w, height: h }),
      addEventListener: noop,
      removeEventListener: noop,
      getElementById: () => null,
      body: { appendChild: noop },
    };

    return {
      atob:
        typeof atob !== "undefined"
          ? atob
          : (s) => Buffer.from(s, "base64").toString("binary"),
      Blob: typeof Blob !== "undefined" ? Blob : class Blob {},
      window: win,
      document: doc,
      XMLHttpRequest: makeXHR,
      OffscreenCanvas:
        typeof OffscreenCanvas !== "undefined"
          ? OffscreenCanvas
          : class {
              constructor(w, h) {
                return wx.createOffscreenCanvas({ type: "2d", width: w, height: h });
              }
            },
      HTMLCanvasElement:
        this.canvas && this.canvas.constructor
          ? this.canvas.constructor
          : class {},
      createImageBitmap:
        typeof createImageBitmap !== "undefined"
          ? createImageBitmap
          : () => Promise.resolve({}),
    };
  }

  getGlobals() {
    return this.globals;
  }

  // 可选：提供默认 WebGL 扩展集合（返回 null 让 three 自行探测）
  setWebGLExtensions() {
    return null;
  }

  dispose() {
    this.canvas = null;
    this.globals = null;
  }
}

export default WechatPlatform;
