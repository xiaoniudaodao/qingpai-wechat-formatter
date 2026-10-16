import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const here = decodeURIComponent(new URL("..", import.meta.url).pathname);
const ctx = { console, Intl };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(here + "vendor/marked.min.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync(here + "src/core.js", "utf8"), ctx);
const Core = ctx.Core;

test("frontmatter：剥离并读出 title 与 tags", () => {
  const r = Core.parseFrontmatter("---\ntitle: 慢写作\ntags: [读书, 写作]\n---\n正文");
  assert.equal(r.body, "正文");
  assert.equal(r.data.title, "慢写作");
  assert.deepEqual([...Core.frontmatterTags(r.data)], ["读书", "写作"]);
  const r2 = Core.parseFrontmatter("---\ntags:\n  - a\n  - '#b'\n---\nx");
  assert.deepEqual([...Core.frontmatterTags(r2.data)], ["a", "b"]);
});

test("Obsidian：注释、图片、双链、高亮、块 ID", () => {
  const r = Core.preprocess("开头 %%私密%% 结尾\n\n![[Pasted image 1.png|300]]\n\n![[封面.jpg|这是封面]]\n\n见 [[笔记#小节|这里]] 和 [[另一篇]]\n\n==重点== 段落 ^abc123\n\n![[某笔记]]");
  assert.ok(!r.md.includes("私密"));
  assert.equal(r.notes.comments, 1);
  assert.ok(r.md.includes('![](obsidian-image:Pasted%20image%201.png "bxi:0:300")'), "纯数字是宽度，不当图注；默认文件名也不当图注");
  assert.ok(r.md.includes('![这是封面](obsidian-image:%E5%B0%81%E9%9D%A2.jpg "bxi:1:")'));
  assert.ok(r.md.includes("见 这里 和 另一篇"));
  assert.ok(r.md.includes("<mark>重点</mark> 段落\n"));
  assert.deepEqual([...r.notes.droppedEmbeds], ["某笔记"]);
});

test("代码里的 == 和 %% 不被改动", () => {
  const r = Core.preprocess("```js\nif (a == b) {} // %%x%%\n```\n\n行内 `a==b==c` 保留");
  assert.ok(r.md.includes("if (a == b) {} // %%x%%"));
  assert.ok(r.md.includes("`a==b==c`"));
});

test("脚注：定义被移除，引用编号按出现顺序", () => {
  const r = Core.preprocess("甲[^b]，乙[^a]，丙^[行内注]\n\n[^a]: 注 A\n[^b]: 注 B");
  assert.deepEqual([...r.footnotes], ["注 B", "注 A", "行内注"]);
  assert.ok(r.md.includes('甲<sup data-fn="1">[1]</sup>'));
  assert.ok(!r.md.includes("[^a]:"));
  const html = Core.toHtml(r.md);
  assert.ok(!/<a /.test(html), "脚注不应被解析成链接");
});

test("文本块：callout、列表、引用", () => {
  const blocks = Core.toBlocks("# 标题\n\n> [!tip] 小提示\n> 内容一\n\n- 甲\n- 乙\n  - 乙一\n\n> 普通引用");
  assert.equal(blocks[0].type, "heading");
  assert.equal(blocks[1].type, "callout");
  assert.equal(blocks[1].kind, "tip");
  assert.equal(blocks[1].title, "小提示");
  assert.equal(blocks[2].type, "list");
  assert.equal(blocks[2].items.length, 2);
  assert.equal(blocks[3].type, "list");
  assert.equal(blocks[3].depth, 1);
  assert.equal(blocks[4].type, "quote");
});

test("X 加权长度：中文算 2、英文算 1、链接算 23、emoji 算 2", () => {
  assert.equal(Core.xLength("hello"), 5);
  assert.equal(Core.xLength("你好"), 4);
  assert.equal(Core.xLength("看 https://example.com/a/very/long/path"), 2 + 1 + 23);
  assert.equal(Core.xLength("👍🏽"), 2);
  assert.equal(Core.xLength("“引号”"), 1 + 4 + 1, "常用标点 U+201C/D 属于轻量区间");
});

test("串推拆分：每条不超过 280，编号正确，小标题不落在末尾", () => {
  const long = "这是一段很长的中文段落。".repeat(40);
  const md = "# 标题\n\n## 第一节\n\n" + long + "\n\n## 第二节\n\n短段落。";
  const blocks = Core.toBlocks(Core.preprocess(md).md);
  const posts = Core.splitThread(Core.blocksToXUnits(blocks, { skipTitle: true }));
  assert.ok(posts.length > 3);
  posts.forEach((p, i) => {
    assert.ok(p.length <= 280, "第 " + (i + 1) + " 条长度 " + p.length);
    assert.ok(p.text.endsWith((i + 1) + "/" + posts.length));
  });
  posts.forEach(p => {
    const body = p.text.replace(/\n\n\d+\/\d+$/, "");
    assert.ok(!body.endsWith("第二节"), "小标题被挪到下一条开头");
  });
});

test("小红书正文：去标题、列表符号、话题", () => {
  const blocks = Core.toBlocks("# 标题\n\n## 要点\n\n1. 早起\n2. 散步\n\n**加粗**正文");
  const text = Core.noteText(blocks, { style: "bracket", tags: ["生活", "#习惯"] });
  assert.ok(!text.includes("标题\n"));
  assert.ok(text.startsWith("【要点】"));
  assert.ok(text.includes("① 早起"));
  assert.ok(text.includes("加粗正文"));
  assert.ok(text.endsWith("#生活 #习惯"));
});

test("检查：小红书标题超长报错、公众号外链提示", () => {
  const md = "# 这是一个非常非常非常非常非常非常长的小红书标题啊\n\n看 [这里](https://example.com)";
  const pre = Core.preprocess(md);
  const tokens = ctx.marked.lexer(pre.md);
  const base = { blocks: Core.toBlocks(pre.md), title: Core.articleTitle(pre.md), footnotes: [], notes: pre.notes, tokensLinks: Core.linksIn(tokens), images: [], tags: [] };
  const xhs = Core.check("xhs", { ...base, noteBody: "短" });
  assert.ok(xhs.some(i => i.level === "error" && i.title.includes("标题")));
  const wx = Core.check("wechat", base);
  assert.ok(wx.some(i => i.title.includes("外部链接")));
});

test("字数统计", () => {
  assert.equal(Core.countWords("你好 world，再见 foo-bar"), 6);
  assert.equal(Core.charLength("ab你好👍🏽"), 5);
});

test("小红书引流检测", () => {
  assert.deepEqual([...Core.leadRisks("加微信 abc12345 详聊，电话 13812345678")], ["微信号", "手机号"]);
  assert.deepEqual([...Core.leadRisks("今天天气很好")], []);
});

test("引流检测不误伤普通提到平台名的句子", () => {
  assert.deepEqual([...Core.leadRisks("公众号：复制，到后台粘贴")], []);
  assert.deepEqual([...Core.leadRisks("欢迎关注我的公众号")], ["其他平台账号"]);
  assert.deepEqual([...Core.leadRisks("公众号：「版心笔记」")], ["其他平台账号"]);
});

test("图片记号：定位、宽度解析，跳过代码与 frontmatter", () => {
  const md = "---\ncover: ![](x.png)\n---\n![[a.png|245]] 与 ![说明|300](https://e.com/b.jpg)\n\n`![](c.png)`\n\n```\n![](d.png)\n```\n\n![[笔记]] ![[e.jpg|封面|120x80]] %% ![](f.png) %%";
  const t = Core.findImageTokens(md);
  assert.equal(t.length, 4);
  assert.equal(t[0].name, "a.png"); assert.equal(t[0].width, 245);
  assert.equal(t[1].url, "https://e.com/b.jpg"); assert.equal(t[1].alt, "说明"); assert.equal(t[1].width, 300);
  assert.equal(t[2].isImage, false);
  assert.equal(t[3].alt, "封面"); assert.equal(t[3].width, 120);
  assert.equal(md.slice(t[1].from, t[1].to), "![说明|300](https://e.com/b.jpg)");
});

test("改宽度：写回原位，Obsidian 与标准语法都支持，可清除", () => {
  const md = "![[a.png]]\n\n![说明|300](img://x1)\n\n![[b.png|封面|120]]";
  let r = Core.setImageWidth(md, 0, 245.4);
  assert.equal(r.insert, "![[a.png|245]]");
  r = Core.setImageWidth(r.md, 1, 180);
  assert.ok(r.md.includes("![说明|180](img://x1)"));
  r = Core.setImageWidth(r.md, 2, null);
  assert.ok(r.md.endsWith("![[b.png|封面]]"));
  r = Core.setImageWidth(r.md, 1, null);
  assert.ok(r.md.includes("![说明](img://x1)"));
});

test("预处理：图片带上序号与宽度，图注不含尺寸", () => {
  const pre = Core.preprocess("![[Pasted image 2026.png|245]]\n\n![说明|300](img://x1)\n\n![[某笔记]]");
  assert.ok(pre.md.includes('![](obsidian-image:Pasted%20image%202026.png "bxi:0:245")'));
  assert.ok(pre.md.includes('![说明](img://x1 "bxi:1:300")'));
  assert.deepEqual([...pre.notes.localImages], ["Pasted image 2026.png"]);
  assert.deepEqual([...pre.notes.droppedEmbeds], ["某笔记"]);
});

test("场景识别：价格信息推荐种草、代码推荐教程、普通文本不推荐", () => {
  assert.equal(Core.detectScene("这支精华到手价 ¥199，原价 299 元，满 200 减 30")[0].scene, "种草");
  assert.equal(Core.detectScene("## 安装\n\n```bash\nnpm i\n```\n\n配置好模型的 API 即可")[0].scene, "教程");
  assert.equal(Core.detectScene("《晨光》，1923，布面油画，81×65 cm。这位艺术家在美术馆的展览")[0].scene, "艺术");
  assert.equal(Core.detectScene("今天天气很好，我们去公园散步。").length, 0);
  assert.equal(Core.detectScene("学习元素周期表，元旦快乐").length, 0, "元素、元旦不算价格");
});

test("错别字：常见误写、重复字、重复标点、半角逗号", () => {
  const t = "我们按装好软件以后，，就可以再接再励了。这是我的的作品,很好";
  const r = Core.findTypos(t);
  const kinds = r.map(x => x.wrong + "→" + x.right);
  assert.deepEqual([...kinds], ["按装→安装", "，，→，", "再接再励→再接再厉", "的的→的", ",→，"]);
  assert.equal(t.slice(r[0].index, r[0].index + r[0].length), "按装");
  assert.equal(Core.findTypos("谢谢你，我们常常见面。截至目前一切顺利").length, 0);
});

test("articleTitle：空的 # 行不会把下一段当成标题", () => {
  assert.equal(Core.articleTitle("# \n\n![a.png](img://x \"bxi:0:\")\n\n正文"), "");
  assert.equal(Core.articleTitle("#\n\n正文"), "");
  assert.equal(Core.articleTitle("# 标题\n\n正文", { title: "旧标题" }), "标题");
  assert.equal(Core.articleTitle("正文", { title: "旧标题" }), "旧标题");
});

test("加粗紧贴中文标点也能识别", () => {
  const html = md => Core.toHtml(Core.preprocess(md).md);
  assert.match(html("这里面**“先别写标书”“不确定直接说”**这三句很重要"), /<strong>“先别写标书”“不确定直接说”<\/strong>这三句/);
  assert.match(html("**拿到招标文件，这两件事最费眼睛，**因为废标条款"), /<strong>拿到招标文件，这两件事最费眼睛，<\/strong>因为/);
  assert.match(html("普通的**加粗**不受影响"), /<strong>加粗<\/strong>/);
  assert.doesNotMatch(html("`**代码里“不动”**的`"), /<strong>/);
  assert.doesNotMatch(html("2 ** 3 ** 4"), /<strong>/);
});

test("articleTitle：标题行里的图片代码不算标题", () => {
  assert.equal(Core.articleTitle(Core.preprocess("# ![](img://5n743a)\n\n正文").md), "");
  assert.equal(Core.articleTitle("# 我的标题 ![[a.png]]\n\n正文"), "我的标题");
});
