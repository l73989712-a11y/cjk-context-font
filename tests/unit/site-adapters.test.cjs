"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Adapters = require("../../src/content/site-adapters.js");
test("resolves known sites and generic fallback", () => {
  assert.equal(Adapters.resolve("www.bilibili.com").id, "bilibili");
  assert.equal(Adapters.resolve("m.youtube.com").id, "youtube");
  assert.equal(Adapters.resolve("chatgpt.com").id, "chatgpt");
  assert.equal(Adapters.resolve("example.org").id, "generic");
});
