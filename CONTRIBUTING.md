# Contributing

感谢贡献。提交 PR 前请运行：

```bash
npm run check
npm test
npm run build
npm run test:e2e
npm run benchmark
npm run release:check
```

改变 DOM 扫描、MutationObserver、ruby 保护或稳定模式时，必须同时增加浏览器回归测试。站点适配器应保持声明式，不得引入远程代码或网页文字上传。误判报告请附识别试验台结果；性能问题请附弹窗复制的诊断报告。
