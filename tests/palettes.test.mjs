import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const here = decodeURIComponent(new URL("..", import.meta.url).pathname);
const ctx = {};
ctx.window = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(here + "src/templates.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync(here + "src/scenes.js", "utf8"), ctx);

function lum(hex) {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

test("12 套版式都有封面卡和场景标签", () => {
  assert.equal(ctx.TEMPLATES.length, 12);
  ctx.TEMPLATES.forEach(t => {
    assert.equal(typeof t.cover, "function", t.id + " 缺封面卡");
    assert.ok(t.scenes.length > 0, t.id + " 缺场景");
    assert.ok(t.swatches.length >= 3, t.id + " 配色少于 3 组");
  });
});

test("场景版式：写小字的颜色对白底对比度 ≥ 4.5（WCAG AA）", () => {
  const bad = [];
  ctx.TEMPLATES.filter(t => t.palettes).forEach(t => t.palettes.forEach(p => {
    const textColors = [];
    if (p.deep) textColors.push(["deep", p.deep]);
    if (t.id === "kuaixun") textColors.push(["块底白字", p.accent]);
    if (t.id === "zhanqian") textColors.push(["accent", p.accent]);
    textColors.forEach(([k, c]) => { const r = contrast(c, "#ffffff"); if (r < 4.5) bad.push(t.name + "/" + p.name + " " + k + " " + c + " = " + r.toFixed(2)); });
    if (p.pop && p.popText) { const r = contrast(p.pop, p.popText); if (r < 4.5) bad.push(t.name + "/" + p.name + " 标签 " + r.toFixed(2)); }
  }));
  assert.deepEqual(bad, []);
});

test("色调归类", () => {
  const { toneOf } = ctx.TemplateMeta;
  assert.equal(toneOf("#1a1a1a"), "mono");
  assert.equal(toneOf("#dad9d5"), "mono");
  assert.equal(toneOf("#b8202a"), "warm");
  assert.equal(toneOf("#2f4a7a"), "cool");
  assert.equal(toneOf("#e9537a"), "pink");
  assert.equal(toneOf("#ffe600"), "bright");
});
