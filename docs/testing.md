# Testing

## Static and unit tests

```bash
npm run check
npm test
```

单元测试使用 Node 内置的 `node:test`，不需要安装 npm 依赖。

## Browser runtime regression test

测试需要 Python Playwright 和 Chromium：

```bash
pip install playwright
playwright install chromium
npm run test:e2e
```

已有系统 Chromium 时也可以：

```bash
CHROMIUM_PATH=/usr/bin/chromium npm run test:e2e
```

该测试在真实 Chromium 页面中注入与扩展相同的 `core.js`、`diagnostics.js` 和 `content.js`，并提供最小 Chrome API mock。它检查：

- 简体、繁体和日文基本分类；
- 稳定模式不生成包装 `span`；
- 不进入 `ruby/rt` 和片假名脚本标记节点；
- 动态插入 800 条文本后页面仍可响应；
- 诊断接口能返回统计；
- 删除动态节点后不影响后续操作。

它不是商店安装流程测试。完整的“加载未打包扩展”端到端测试会在后续版本增加。
