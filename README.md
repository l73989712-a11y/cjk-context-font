# CJK Context Font 0.5.0

按局部语境为中文、日文、繁体中文和韩文选择合适本地字体的 Chromium 扩展。识别完全在浏览器本地完成。

## 0.5.0 工程化版本

本版保持稳定 DOM 模式默认开启，并完成：

- `src/` 源码结构和可重复构建流程；
- 有界 LRU 识别缓存；
- Bilibili、YouTube、ChatGPT、Niconico、Wikipedia 的声明式站点适配器框架；
- 可选开发诊断浮层；
- 注入式浏览器回归测试与真实“加载未打包扩展”测试；
- 性能基准脚本；
- 标签发布时自动生成 GitHub Release 和两个 ZIP。

稳定模式不会拆分或替换网页文本节点，并继续跳过 `ruby`、`rt`、`rp` 和片假名注音脚本生成区域。

## 安装

普通用户请下载 GitHub Release 中的 `cjk-context-font-0.5.0-chromium.zip`：

1. 解压 ZIP。
2. 打开 `chrome://extensions`。
3. 启用开发者模式。
4. 选择“加载已解压的扩展程序”。
5. 选择解压后直接包含 `manifest.json` 的目录。

## 开发

```bash
npm run check
npm test
npm run build
npm run test:e2e
npm run benchmark
npm run release:check
npm run package
```

完整加载扩展的测试需要有图形环境；Linux CI 使用：

```bash
xvfb-run -a npm run test:extension
```

构建结果位于：

```text
dist/chromium/
dist/cjk-context-font-0.5.0-chromium.zip
dist/cjk-context-font-0.5.0-source.zip
```

## 目录

```text
src/                 扩展源码
  background/
  content/
  options/
  popup/
  styles/
tests/               单元和浏览器测试
scripts/             检查、构建、基准和打包
docs/                架构、识别模型、性能与测试说明
.github/workflows/    CI 和标签发布
```

## 隐私

扩展不上传网页文字、浏览记录、个人词典或诊断数据。开发诊断浮层只显示数字，并且默认关闭。详见 [PRIVACY.md](PRIVACY.md)。

## 文档

- [架构](docs/architecture.md)
- [识别模型](docs/detection.md)
- [性能设计](docs/performance.md)
- [测试](docs/testing.md)
- [发布流程](docs/releasing.md)

## License

MIT
