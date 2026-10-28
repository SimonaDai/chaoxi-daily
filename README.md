# 朝夕●一日一记

学习、工作，也记生活。面向学生和职场人的本机日历，手机优先，支持生成 Android APK。

这是完整的 React + TypeScript 前端和 Capacitor Android 工程，不只是静态原型。无需账号或业务服务器；数据保存在设备上。GitHub 备份源码，手机个人资料通过应用内「导出完整备份」另行保存。

## 功能

| 能力       | 当前实现                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------- |
| 手机日历   | 默认紧凑周视图，也可切换月历和清单；毛玻璃叠卡支持左右拖动、箭头和键盘切换，详情按需展开 |
| 记录       | 新建、编辑、删除、单次完成；日期不明确的事项存入待整理                                   |
| 类型与颜色 | 面试、笔试、学习、工作、生活、纪念日、订阅缴费、未分类；支持自己填写新类型并选颜色       |
| 重复       | 每周、每月、每年公历/农历；月末自动收敛；单次改期或修改整个系列                          |
| 中国日历   | 农历、二十四节气、已审核的 2026 年法定放假与调休补班                                     |
| 截图与 OCR | PNG/JPEG/WebP；可只附图，也可用内置 Tesseract 中英文模型在设备上识别，再人工核对         |
| 轻量图片   | 应用副本保存满一个自然月且对应事项结束后，在启动/恢复前台时清理；待定和未来事项受保护    |
| 本机备份   | JSON 完整备份，包含文字、类型、完成状态和图片；恢复前验证并提示替换                      |
| 提醒       | 新事项默认不提醒；Android 中主动选择提醒才申请权限，不申请精确闹钟权限                   |
| Android    | 应用 ID `app.chaoxi.daily`；最低 Android 7 / API 24；内置网页、字体和 OCR 模型           |

## 本地运行

安装 Node.js 24 LTS，然后在项目目录执行：

```sh
npm ci
npm run prepare:assets
npm run dev
```

打开终端给出的 `http://127.0.0.1:5173/`。网页版首次开发运行也需先准备本机 OCR 资源；生产构建会自动准备。版本锁文件固定依赖，使用官方 npm registry，不需要把 node_modules 提交给 Git。

```sh
npm run check
npm run policy:validate
npm run test:e2e
```

Windows 浏览器测试默认使用已安装的 Microsoft Edge；其他系统先执行 `npx playwright install chromium`。Windows 如使用其他 Chromium 浏览器，可设置 `PLAYWRIGHT_EXECUTABLE_PATH`。端到端测试会启动生产预览服务，验证真实本机存储、拖动、OCR 和图片导出。

## 生成 APK

最适合当前环境的方式是上传 GitHub 后使用 Actions。完整步骤见 [GitHub 上传与 APK 打包教程](docs/GITHUB_APK.md)。工作流先执行源码与浏览器检查，再编译 APK；默认产生 debug 测试包。固定签名正式包需要另外配置证书。

本机编译需要 JDK 21、Android SDK Platform 36 / Build Tools 36.0.0，并正确配置 `JAVA_HOME` 和 `ANDROID_HOME`：

```sh
npm run android:debug
```

输出：`android/app/build/outputs/apk/debug/app-debug.apk`。也可运行 `npm run android:open` 用 Android Studio 打开工程。

## 数据与适用边界

- 事项日期、重复、全天截止和清理规则统一采用北京时间。没有 OCR 结果会自动创建事项；含糊日期留给用户确认。
- 图片只保存应用副本，不修改系统相册原件。清理按附件关联的那一次重复事项判断，删除不影响文字。
- 不接第三方 OCR 服务，不包含统计或广告 SDK。可选的政策同步只获取公开 JSON。
- 网页版使用 IndexedDB；Android 版文字使用 Preferences，图片使用应用私有目录。关闭了系统云备份及设备迁移自动备份，跨设备迁移使用显式导出/恢复。
- 本机数据不自动跨设备同步。卸载、清除应用/网站数据会清除记录；建议换手机前导出备份。网页版请在一个标签页编辑。
- 单张上传最多 8 MB，每次事项最多 3 张；保存前按最长边 4096px 压缩。完整备份图片总量上限 30 MB，导入文件上限 45 MB。
- 提醒在启动、前台和编辑时更新未来 60 天、最多 200 条；长期不打开不会无限续排。全天提醒基准为 09:00。节电、权限和厂商策略可能延迟送达，当前不承诺精确闹钟。
- 官方假期不能靠农历推断：维护者审核政策后更新 JSON，应用可同步已审核源；未收录年份明确显示待更新。当前未实现政府网站自动抓取。
- 离线 OCR 引擎和中文字体会增加安装包体积；不以运行时在线下载模型来换取小包。

架构、更新协议及已知限制见 [开发说明](docs/ARCHITECTURE.md)。第三方组件与许可证见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

## 协作

遵循用户提供的《Git 协作规范.pdf》及 [AGENTS.md](AGENTS.md)。当前 `main` 是空基线，功能位于 `feature/chaoxi-android`。本地验收后再由用户推送、创建 PR、审查合并；不直接在主分支开发，不提交构建产物、截图、模型或证书。
