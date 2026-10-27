# 第三方组件

项目使用开源组件。构建时从已锁定 npm 包复制 OCR 模型、引擎和字体；不把下载的模型或依赖目录提交到本仓库。安装包自动携带 `THIRD_PARTY_LICENSES.txt`，由依赖原包中的许可证文件生成。

| 组件                             | 主要用途                             | 许可证 / 来源                                                  |
| -------------------------------- | ------------------------------------ | -------------------------------------------------------------- |
| React / React DOM                | 界面                                 | MIT，https://github.com/facebook/react                         |
| Capacitor 与官方插件             | Android 容器、文件、偏好、通知、分享 | MIT，https://github.com/ionic-team/capacitor                   |
| Tesseract.js / tesseract.js-core | 本机 OCR / WASM                      | Apache-2.0，https://github.com/naptha/tesseract.js             |
| Tesseract 语言数据               | 中英文 LSTM 模型                     | Apache-2.0，https://github.com/tesseract-ocr/tessdata_best     |
| lunar-typescript                 | 农历与节气                           | MIT，https://github.com/6tail/lunar-typescript                 |
| Lucide                           | 图标                                 | ISC，https://lucide.dev/license                                |
| Zod                              | 数据校验                             | MIT，https://github.com/colinhacks/zod                         |
| Noto Sans SC / Noto Serif SC     | 中文字体                             | SIL Open Font License 1.1，https://fonts.google.com/noto       |
| Manrope                          | 数字字体                             | SIL Open Font License 1.1，https://github.com/sharanda/manrope |

各组件保留自身版权与许可证。项目源码的对外授权方式由仓库所有者另行决定；这里不替源码所有者选择开源许可证。
