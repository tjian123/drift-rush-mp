# Drift Rush · 微信小游戏版

把 Drift Rush 漂移竞速包装成**微信小游戏**（`game.json` + `game.js` 入口，非小程序）。
引擎用 **three-platformize**（自带打补丁的 THREE r133），渲染层跑在小游戏 WebGL 运行时里。

## 目录结构

```
drift-rush-mp/
├── game.js              # 小游戏入口：建画布 → three-platformize 接入 → 主循环 → 接触摸/分享/广告/账号
├── game.json            # 小游戏配置（横屏 landscape、隐藏状态栏、网络超时）
├── project.config.json  # compileType: "game"；appid 为占位 touristappid（上线前替换，见下）
├── package.json         # 依赖 three-platformize（构建 npm 用）
├── src/
│   ├── world.js         # 渲染世界：赛道+车+追逐相机+漂移物理+HUD 叠层（可玩内核 POC）
│   ├── touch.js         # 触摸操控：左半屏转向、右半屏油门/刹车
│   ├── share.js         # 分享裂变钩子（wx.shareAppMessage + 好友挑战进入）
│   ├── ads.js           # 广告封装（激励视频 + 横幅，占位 adUnitId）
│   └── account.js       # 匿名账号（wx.login），预留 WorkBuddyCloud 云存档
└── utils/
    ├── wechat-platform.js  # three-platformize 的 WechatPlatform 适配层（自写，npm 无官方版）
    └── canvas.js          # 离屏画布工厂
```

## 本机跑起来（必做）

> ⚠️ 沙箱无微信开发者工具，以下全部需你在本机操作。

1. 装 **微信开发者工具**（稳定版），登录你的微信账号。
2. 导入项目：选 `drift-rush-mp/` 目录。
   - 若提示 appid 无效，点「测试号」或填入你自己的**小游戏 AppID**（任务 #42 注册的企业号）。
3. 工具栏点 **「构建 npm」**（three-platformize 标准路径，**不是 Vite**）。构建完成后会生成 `miniprogram_npm/`。
4. 编译运行 → 模拟器/真机预览。
5. 操作：**左半屏左右拖动 = 转向**，**右半屏按住 = 油门**（右下 = 刹车），**右上角轻触 = 分享成绩**。

## 上线前置（任务 #42，需你本人办）

- 微信**小游戏**必须在**微信公众平台**注册**企业号**（个人号不能接广告与虚拟支付，且游戏类目审核偏严）。
- 拿到真实 AppID 后替换 `project.config.json` 里的 `touristappid`。
- 接广告需开通**流量主**（通常累计独立访客达标后申请），再把 `src/ads.js` 里的空 `adUnitId` 换成后台申请的真实广告位。
- 游戏类目审核建议备好**软著**，企业号 + 软著更稳。

## 包体（主包 4MB 限制，任务 #46）

- 当前主包只放引擎 + 入口 + 内核代码，体积可控。
- 后续若加音效/贴图/更复杂的世界，场景资源走**小游戏远程资源（CDN）或分包**，确保首包 < 4MB 可提交。

## 已实现 / 待办

- ✅ 渲染管线跑通（three-platformize r133 + 小游戏 WebGL）
- ✅ 触控驾驶 + 漂移物理 + 追逐相机 + HUD 叠层
- ✅ 分享钩子 / 广告封装（占位）/ 匿名账号
- ⬜ 完整移植网页版 world.js 特性（后处理、天空、道具、AI 对手）
- ⬜ WorkBuddyCloud 云存档与跨端账号互通（account.js 已留 TODO）
- ⬜ 真机性能与低端机兼容打磨（任务 #48）
