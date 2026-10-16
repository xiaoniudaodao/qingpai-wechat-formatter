/* 轻排 · 核心逻辑（不依赖 DOM，可在 node 中测试）
   负责：frontmatter 解析、Obsidian 语法预处理、Markdown → 文本块、
   小红书/小绿书正文生成、X 加权字数与串推拆分、各平台发布检查。 */
(function (root) {
  "use strict";
  const marked = root.marked;

  /* ---------------- frontmatter ---------------- */
  function parseFrontmatter(md) {
    const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/.exec(md);
    if (!m) return { body: md, data: {}, lines: 0 };
    const data = {};
    let listKey = null;
    m[1].split(/\r?\n/).forEach(line => {
      const item = /^\s*-\s+(.*)$/.exec(line);
      if (item && listKey) { data[listKey].push(unquote(item[1])); return; }
      const kv = /^([^:#][^:]*):\s*(.*)$/.exec(line);
      if (!kv) return;
      const key = kv[1].trim();
      const val = kv[2].trim();
      if (val === "") { data[key] = []; listKey = key; return; }
      listKey = null;
      if (/^\[.*\]$/.test(val)) data[key] = val.slice(1, -1).split(",").map(s => unquote(s.trim())).filter(Boolean);
      else data[key] = unquote(val);
    });
    return { body: md.slice(m[0].length), data, lines: m[0].split("\n").length - 1 };
  }
  function unquote(s) { return s.replace(/^["']|["']$/g, ""); }

  function frontmatterTags(data) {
    const raw = data.tags || data.tag || data["标签"] || [];
    const arr = Array.isArray(raw) ? raw : String(raw).split(/[,，\s]+/);
    return arr.map(t => String(t).replace(/^#/, "").trim()).filter(Boolean);
  }

  /* ---------------- 代码保护：预处理时不碰代码 ---------------- */
  function protect(md) {
    const store = [];
    const put = s => "" + (store.push(s) - 1) + "";
    md = md.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, put);
    md = md.replace(/`[^`\n]+`/g, put);
    return { md, restore: s => s.replace(/(\d+)/g, (_, i) => store[i]) };
  }

  const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|heic)$/i;

  /* ---------------- 图片定位与尺寸 ----------------
     在「等长遮罩」上扫描：frontmatter、代码、%%注释%% 被替换成空格，位置与原文一一对应。 */
  function maskForScan(src) {
    const blank = m => m.replace(/[^\n]/g, " ");
    let out = src;
    const fm = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(out);
    if (fm) out = blank(fm[0]) + out.slice(fm[0].length);
    out = out.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, blank);
    out = out.replace(/`[^`\n]+`/g, blank);
    out = out.replace(/%%[\s\S]*?%%/g, blank);
    return out;
  }
  const IMG_TOKEN = /!\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"[^"\n]*")?\)/g;
  const SIZE_PART = /^\s*(\d+)(?:\s*x\s*\d+)?\s*$/;
  function findImageTokens(src) {
    const masked = maskForScan(src);
    const out = [];
    let m;
    IMG_TOKEN.lastIndex = 0;
    while ((m = IMG_TOKEN.exec(masked))) {
      const text = src.slice(m.index, m.index + m[0].length);
      const t = { index: out.length, from: m.index, to: m.index + m[0].length, text, width: null };
      if (m[1] != null) {
        const parts = text.slice(3, -2).split("|");
        t.embed = true;
        t.name = parts[0].replace(/#.*$/, "").trim();
        t.isImage = IMG_EXT.test(t.name);
        const size = parts.slice(1).find(p => SIZE_PART.test(p));
        if (size) t.width = parseInt(SIZE_PART.exec(size)[1], 10);
        t.alt = parts.slice(1).find(p => p.trim() && !SIZE_PART.test(p)) || "";
        t.alt = t.alt.trim();
      } else {
        const alt = /^!\[([^\]]*)\]/.exec(text)[1];
        const sm = /\|\s*(\d+)(?:\s*x\s*\d+)?\s*$/.exec(alt);
        t.embed = false;
        t.isImage = true;
        t.url = m[3];
        t.alt = (sm ? alt.slice(0, sm.index) : alt).trim();
        if (sm) t.width = parseInt(sm[1], 10);
      }
      out.push(t);
    }
    return out;
  }
  /* 改写某个图片记号的宽度；width 为空表示恢复原始大小 */
  function withImageWidth(t, width) {
    const w = width ? Math.round(width) : null;
    if (t.embed) {
      const parts = t.text.slice(3, -2).split("|");
      const keep = [parts[0]].concat(parts.slice(1).filter(p => !SIZE_PART.test(p)));
      if (w) keep.push(String(w));
      return "![[" + keep.join("|") + "]]";
    }
    const m = /^!\[([^\]]*)\]([\s\S]*)$/.exec(t.text);
    const alt = m[1].replace(/\s*\|\s*\d+(?:\s*x\s*\d+)?\s*$/, "");
    return "![" + alt + (w ? "|" + w : "") + "]" + m[2];
  }
  function setImageWidth(src, index, width) {
    const t = findImageTokens(src)[index];
    if (!t) return null;
    const insert = withImageWidth(t, width);
    return { from: t.from, to: t.to, insert, md: src.slice(0, t.from) + insert + src.slice(t.to) };
  }

  /* Obsidian / 扩展语法 → 标准 Markdown + 少量内联 HTML */
  function preprocess(src, opts = {}) {
    const localImages = [];
    const tokens = findImageTokens(src);
    for (let i = tokens.length - 1; i >= 0; i--) {
      const t = tokens[i];
      if (t.embed && !t.isImage) continue; // 笔记嵌入：后面统一略过
      const title = ' "bxi:' + t.index + ":" + (t.width || "") + '"';
      const url = t.embed ? "obsidian-image:" + encodeURIComponent(t.name) : t.url;
      if (t.embed) localImages.unshift(t.name);
      src = src.slice(0, t.from) + "![" + t.alt.replace(/[\[\]]/g, "") + "](" + url + title + ")" + src.slice(t.to);
    }
    const fm = opts.stripFrontmatter === false ? { body: src, data: {}, lines: 0 } : parseFrontmatter(src);
    const p = protect(fm.body);
    let md = p.md;
    const notes = { droppedEmbeds: [], localImages, comments: 0 };

    // %%注释%% 永远不进入成稿
    md = md.replace(/%%[\s\S]*?%%/g, () => { notes.comments++; return ""; });

    // ![[笔记]] 嵌入无法展开（图片已在前面转换）
    md = md.replace(/!\[\[([^\]]+)\]\]/g, (m, inner) => { notes.droppedEmbeds.push(inner.split("|")[0].trim()); return ""; });
    // [[页面#标题|显示]] → 显示
    md = md.replace(/\[\[([^\]]+)\]\]/g, (m, inner) => {
      const parts = inner.split("|");
      return (parts[1] || parts[0].replace(/#\^?.*$/, "") || parts[0]).trim();
    });
    // ==高亮==
    md = md.replace(/==([^=\n]+)==/g, "<mark>$1</mark>");
    // **加粗** 紧贴中文标点时，标准 Markdown 规则不认（如 **“引号里”**后面接着字、**一句话，**后面接着字），
    // Obsidian 自己也显示成两个星号。这里把这种写法直接认成加粗。
    md = md.replace(/\*\*(?!\s)([^*\n]+?)(?<!\s)\*\*/g, (m, inner, at, all) => {
      const P = /[\p{P}\p{S}]/u, W = /[^\s\p{P}\p{S}]/u;
      const before = all[at - 1] || "", after = all[at + m.length] || "";
      const openBad = P.test(inner[0]) && W.test(before);
      const closeBad = P.test(inner[inner.length - 1]) && W.test(after);
      return openBad || closeBad ? "<strong>" + inner + "</strong>" : m;
    });
    // 块引用 ID：行尾 ^abc123
    md = md.replace(/[ \t]\^[A-Za-z0-9-]+[ \t]*$/gm, "");

    // 脚注：[^id]: 内容   与   正文 [^id] / 行内 ^[内容]
    const defs = {};
    md = md.replace(/^\[\^([^\]]+)\]:[ \t]*(.*)$/gm, (m, id, text) => { defs[id] = text.trim(); return ""; });
    const footnotes = [];
    const order = {};
    md = md.replace(/\[\^([^\]]+)\]/g, (m, id) => {
      if (!(id in defs)) return m;
      if (!(id in order)) { footnotes.push(defs[id]); order[id] = footnotes.length; }
      return '<sup data-fn="' + order[id] + '">[' + order[id] + "]</sup>";
    });
    md = md.replace(/\^\[([^\]]+)\]/g, (m, text) => {
      footnotes.push(text.trim());
      return '<sup data-fn="' + footnotes.length + '">[' + footnotes.length + "]</sup>";
    });

    md = p.restore(md).replace(/\n{3,}/g, "\n\n").trim() + "\n";
    return { md, data: fm.data, footnotes, notes, frontmatterLines: fm.lines };
  }

  function toHtml(md) {
    return marked.parse(md, { gfm: true, breaks: true });
  }

  /* ---------------- Markdown → 文本块（给小红书 / X / 检查用） ---------------- */
  function inlineText(tokens) {
    if (!tokens) return "";
    return tokens.map(t => {
      switch (t.type) {
        case "text": return t.tokens ? inlineText(t.tokens) : decode(t.text);
        case "strong": case "em": case "del": return inlineText(t.tokens);
        case "codespan": return decode(t.text);
        case "br": return "\n";
        case "link": return inlineText(t.tokens);
        case "image": return "";
        case "escape": return t.text;
        case "html": return htmlInline(t.text);
        default: return t.tokens ? inlineText(t.tokens) : decode(t.raw || "");
      }
    }).join("");
  }
  function htmlInline(s) {
    return decode(s.replace(/<sup data-fn="(\d+)">\[\d+\]<\/sup>/g, "").replace(/<[^>]+>/g, ""));
  }
  function decode(s) {
    return String(s).replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&");
  }
  function linksIn(tokens, out = []) {
    (tokens || []).forEach(t => {
      if (t.type === "link") out.push({ href: t.href, text: inlineText(t.tokens) });
      if (t.tokens) linksIn(t.tokens, out);
      if (t.items) t.items.forEach(i => linksIn(i.tokens, out));
    });
    return out;
  }
  function imagesIn(tokens, out = []) {
    (tokens || []).forEach(t => {
      if (t.type === "image") out.push({ src: t.href, alt: t.text });
      if (t.tokens) imagesIn(t.tokens, out);
      if (t.items) t.items.forEach(i => imagesIn(i.tokens, out));
    });
    return out;
  }

  function toBlocks(md) {
    const tokens = marked.lexer(md, { gfm: true, breaks: true });
    const blocks = [];
    const walk = (list, depth) => list.forEach(t => {
      switch (t.type) {
        case "heading": blocks.push({ type: "heading", depth: t.depth, text: inlineText(t.tokens).trim() }); break;
        case "paragraph": {
          const imgs = imagesIn(t.tokens);
          const text = inlineText(t.tokens).trim();
          imgs.forEach(i => blocks.push({ type: "image", src: i.src, alt: i.alt }));
          if (text) blocks.push({ type: "para", text });
          break;
        }
        case "list":
          blocks.push({
            type: "list", ordered: t.ordered, start: t.start || 1, depth,
            items: t.items.map(i => ({
              text: inlineText(i.tokens.filter(x => x.type !== "list")).trim(),
              task: i.task, checked: i.checked
            }))
          });
          t.items.forEach(i => walk(i.tokens.filter(x => x.type === "list"), depth + 1));
          break;
        case "blockquote": {
          const inner = toBlocks(t.text);
          const first = inner[0];
          const call = first && /^\[!(\w+)\][+-]?[ \t]*([^\n]*)\n?([\s\S]*)$/.exec(first.text || "");
          if (call) {
            first.text = call[3].trim();
            if (!first.text) inner.shift();
            blocks.push({ type: "callout", kind: call[1].toLowerCase(), title: call[2].trim(), text: inner.map(b => b.text || "").filter(Boolean).join("\n") });
          } else {
            blocks.push({ type: "quote", text: inner.map(b => b.text || (b.items || []).map(i => i.text).join("\n")).filter(Boolean).join("\n") });
          }
          break;
        }
        case "code": blocks.push({ type: "code", lang: t.lang || "", text: t.text }); break;
        case "hr": blocks.push({ type: "hr" }); break;
        case "table":
          blocks.push({
            type: "table",
            header: t.header.map(c => inlineText(c.tokens)),
            rows: t.rows.map(r => r.map(c => inlineText(c.tokens)))
          });
          break;
        case "html": { const s = htmlInline(t.text).trim(); if (s) blocks.push({ type: "para", text: s }); break; }
        case "space": break;
        default: if (t.text) blocks.push({ type: "para", text: decode(t.text) });
      }
    });
    walk(tokens, 0);
    return blocks;
  }

  // 标题以正文里的 # 一级标题为准（画布上改的就是它），没有时才用 frontmatter 的 title
  function articleTitle(md, data) {
    const m = /^#[ \t]+(\S.*)$/m.exec(md); // 只在同一行里找标题文字（\s 会跨行，把下一段当成标题）
    // 标题行里的图片（![](...)、![[...]]）和内部标记不算标题文字
    if (m) return m[1].replace(/!\[\[[^\]]*\]\]/g, "").replace(/!\[[^\]]*\]\([^)]*\)/g, "").replace(/[*_`]/g, "").trim();
    return data && data.title ? String(data.title) : "";
  }

  /* 中文按字计，英文单词按 1 计（贴近公众号/小红书的直觉） */
  function countWords(text) {
    const cjk = (text.match(/[㐀-鿿豈-﫿]/g) || []).length;
    const latin = (text.replace(/[㐀-鿿豈-﫿]/g, " ").match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
    return cjk + latin;
  }
  /* 字符数（不含空白），用于平台上限 */
  function countChars(text) {
    return [...text.replace(/\s/g, "")].length;
  }
  function graphemes(text) {
    if (typeof Intl !== "undefined" && Intl.Segmenter) {
      return [...new Intl.Segmenter("zh", { granularity: "grapheme" }).segment(text)].map(s => s.segment);
    }
    return [...text];
  }
  function charLength(text) { return graphemes(text).length; }

  /* ---------------- X：twitter-text v3 加权长度 ---------------- */
  const X_LIGHT = [[0, 4351], [8192, 8205], [8208, 8223], [8242, 8247]];
  const URL_RE = /\bhttps?:\/\/[^\s<>"'，。！？）】」]+/g;
  function xLength(text) {
    text = text.normalize ? text.normalize("NFC") : text;
    let len = 0;
    const rest = text.replace(URL_RE, () => { len += 23; return ""; });
    for (const g of graphemes(rest)) {
      if (/\p{Extended_Pictographic}/u.test(g)) { len += 2; continue; }
      for (const ch of g) {
        const cp = ch.codePointAt(0);
        len += X_LIGHT.some(([a, b]) => cp >= a && cp <= b) ? 1 : 2;
      }
    }
    return len;
  }

  function sentences(text) {
    const out = [];
    const re = /[^。！？!?；;…\n]+[。！？!?；;…]*[”」』）)]*|\n/g;
    let m;
    while ((m = re.exec(text))) if (m[0].trim()) out.push(m[0].trim());
    return out.length ? out : [text];
  }
  function hardSplit(text, limit) {
    const out = [];
    let cur = "";
    for (const g of graphemes(text)) {
      if (xLength(cur + g) > limit) { out.push(cur); cur = g; } else cur += g;
    }
    if (cur) out.push(cur);
    return out;
  }

  /* 把文本块转为 X 纯文本段落 */
  function blocksToXUnits(blocks, opts = {}) {
    const units = [];
    blocks.forEach(b => {
      if (b.type === "heading") { if (b.depth === 1 && opts.skipTitle) return; units.push({ text: b.text, keepWithNext: true }); }
      else if (b.type === "para" || b.type === "quote") units.push({ text: b.type === "quote" ? "“" + b.text + "”" : b.text });
      else if (b.type === "callout") units.push({ text: [b.title, b.text].filter(Boolean).join("\n") });
      else if (b.type === "list") units.push({ text: b.items.map((it, i) => (b.ordered ? (b.start + i) + ". " : "· ") + it.text).join("\n") });
      else if (b.type === "code") units.push({ text: b.text });
      else if (b.type === "table") units.push({ text: [b.header.join(" | ")].concat(b.rows.map(r => r.join(" | "))).join("\n") });
      else if (b.type === "image") units.push({ image: true, alt: b.alt });
    });
    return units;
  }

  /* 串推拆分：贪心装箱，段落优先，其次句子，最后硬切 */
  function splitThread(units, opts = {}) {
    const limit = opts.limit || 280;
    const numbering = opts.numbering !== false;
    const reserve = numbering ? 8 : 0; // "\n\n12/34"
    const max = limit - reserve;
    const pieces = [];
    units.forEach(u => {
      if (u.image) { pieces.push({ image: true, alt: u.alt }); return; }
      if (xLength(u.text) <= max) { pieces.push({ text: u.text, keep: u.keepWithNext }); return; }
      let cur = "";
      sentences(u.text).forEach(s => {
        const parts = xLength(s) > max ? hardSplit(s, max) : [s];
        parts.forEach(part => {
          const joined = cur ? cur + part : part;
          if (xLength(joined) > max) { if (cur) pieces.push({ text: cur }); cur = part; } else cur = joined;
        });
      });
      if (cur) pieces.push({ text: cur });
    });

    const posts = [];
    let cur = null;
    const open = () => { cur = { text: "", images: [] }; posts.push(cur); return cur; };
    pieces.forEach(p => {
      if (p.image) { (cur || open()).images.push(p.alt || "图片"); return; }
      if (cur && !cur.text) cur.text = p.text;
      else if (cur && xLength(cur.text + "\n\n" + p.text) <= max) cur.text += "\n\n" + p.text;
      else open().text = p.text;
    });
    // 小标题不要落在一条的末尾：能挪就挪到下一条开头
    const headings = new Set(units.filter(u => u.keepWithNext).map(u => u.text));
    for (let i = 0; i < posts.length - 1; i++) {
      const lines = posts[i].text.split("\n\n");
      const last = lines[lines.length - 1];
      if (headings.has(last) && lines.length > 1) {
        const moved = last + "\n\n" + posts[i + 1].text;
        if (xLength(moved) <= max) { posts[i].text = lines.slice(0, -1).join("\n\n"); posts[i + 1].text = moved; }
      }
    }
    const total = posts.length;
    return posts.map((p, i) => {
      const text = numbering && total > 1 ? p.text + "\n\n" + (i + 1) + "/" + total : p.text;
      return { text, length: xLength(text), images: (p.images || []).slice(0, 4), extraImages: Math.max(0, (p.images || []).length - 4) };
    });
  }

  /* X 长帖 / 纯文本 */
  function blocksToPlain(blocks, style = {}) {
    const bullet = style.bullet || "· ";
    const out = [];
    blocks.forEach(b => {
      if (b.type === "heading") {
        if (b.depth === 1 && style.skipTitle) return;
        out.push((style.heading ? style.heading(b) : b.text));
      } else if (b.type === "para") out.push(b.text);
      else if (b.type === "quote") out.push(style.quote ? style.quote(b.text) : "“" + b.text + "”");
      else if (b.type === "callout") out.push([b.title && (style.calloutTitle ? style.calloutTitle(b.title) : b.title), b.text].filter(Boolean).join("\n"));
      else if (b.type === "list") out.push(b.items.map((it, i) => (b.ordered ? (style.number ? style.number(b.start + i) : (b.start + i) + ". ") : bullet) + it.text).join("\n"));
      else if (b.type === "code") out.push(b.text);
      else if (b.type === "hr") out.push(style.hr || "—");
      else if (b.type === "table") out.push([b.header.join(" ｜ ")].concat(b.rows.map(r => r.join(" ｜ "))).join("\n"));
    });
    return out.join("\n\n");
  }

  /* ---------------- 小红书 / 小绿书正文 ---------------- */
  const CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳";
  const NOTE_STYLES = {
    plain: { label: "克制", heading: b => b.text, bullet: "· ", number: n => n + ". ", quote: t => "「" + t + "」", hr: "—" },
    bracket: { label: "书签", heading: b => "【" + b.text + "】", bullet: "▪ ", number: n => (CIRCLED[n - 1] || n + ".") + " ", quote: t => "「" + t + "」", hr: "· · ·" },
    bar: { label: "竖线", heading: b => "▍" + b.text, bullet: "· ", number: n => n + "｜", quote: t => "“" + t + "”", hr: "———" },
    emoji: { label: "表情", heading: b => "📌 " + b.text, bullet: "✅ ", number: n => ["1️⃣", "2️⃣", "3️⃣", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"][n - 1] || n + ". ", quote: t => "💬 " + t, hr: "〰️〰️〰️" }
  };
  function noteText(blocks, opts = {}) {
    const st = NOTE_STYLES[opts.style] || NOTE_STYLES.plain;
    const body = blocksToPlain(blocks.filter(b => b.type !== "image" && b.type !== "code"), {
      skipTitle: true, heading: st.heading, bullet: st.bullet, number: st.number, quote: st.quote, hr: st.hr
    });
    const tags = (opts.tags || []).map(t => "#" + t.replace(/^#/, "").replace(/\s+/g, ""));
    return tags.length ? body + "\n\n" + tags.join(" ") : body;
  }

  /* ---------------- 错别字（常见误写词表 + 标点） ----------------
     只收「几乎不会写对的另一种形式」，避免误报。 */
  const TYPO_PAIRS = ("按装:安装,既使:即使,以经:已经,必竟:毕竟,帐号:账号,帐户:账户,做为:作为,陷井:陷阱,渡假:度假,国藉:国籍," +
    "松驰:松弛,辩认:辨认,辨论:辩论,籍口:借口,震憾:震撼,针贬:针砭,坐阵:坐镇,气慨:气概,沉缅:沉湎,装璜:装潢,幅射:辐射," +
    "侯选:候选,防碍:妨碍,暄嚣:喧嚣,寒喧:寒暄,脉膊:脉搏,宣染:渲染,嘻笑:嬉笑,一如继往:一如既往,不加思索:不假思索," +
    "再接再励:再接再厉,一股作气:一鼓作气,迫不急待:迫不及待,穿流不息:川流不息,甘败下风:甘拜下风,谈笑风声:谈笑风生," +
    "默守成规:墨守成规,提心掉胆:提心吊胆,无精打彩:无精打采,走头无路:走投无路,按步就班:按部就班,变本加利:变本加厉," +
    "不径而走:不胫而走,粗制烂造:粗制滥造,出奇不意:出其不意,鬼鬼崇崇:鬼鬼祟祟,汗流夹背:汗流浃背,黄梁美梦:黄粱美梦," +
    "既往不究:既往不咎,金榜提名:金榜题名,举步唯艰:举步维艰,滥芋充数:滥竽充数,名列前矛:名列前茅,披星带月:披星戴月," +
    "迫在眉捷:迫在眉睫,世外桃园:世外桃源,事半功陪:事半功倍,随声附合:随声附和,通货膨涨:通货膨胀,委屈求全:委曲求全," +
    "相辅相承:相辅相成,一愁莫展:一筹莫展,原形必露:原形毕露,再所不惜:在所不惜,专心至志:专心致志,即然:既然," +
    "罗唆:啰唆,捡查:检查,复盖:覆盖,渲泄:宣泄,竞然:竟然,竞争对手:竞争对手,部份:部分,赔偿金额:赔偿金额," +
    "截止目前:截至目前,截止到:截至,凑和:凑合,含蓄:含蓄,妥贴:妥帖,蜇伏:蛰伏,精萃:精粹,经典之做:经典之作,发帖子:发帖子," +
    "哪怕是:哪怕是,即将:即将,接触:接触,好象:好像,象这样:像这样,不能自己:不能自已,入场卷:入场券,优惠卷:优惠券")
    .split(",").map(x => x.split(":")).filter(([a, b]) => a && b && a !== b);
  function findTypos(text) {
    const out = [];
    const t = String(text || "");
    TYPO_PAIRS.forEach(([wrong, right]) => {
      let i = t.indexOf(wrong);
      while (i >= 0) { out.push({ index: i, length: wrong.length, wrong, right, kind: "错别字" }); i = t.indexOf(wrong, i + wrong.length); }
    });
    // 重复的字：的的、了了了、是是（「谢谢」「常常」等正常叠词不在其中）
    const dupRe = /(的的|地地|得得|是是|在在|和和|了了了)/g;
    let m;
    while ((m = dupRe.exec(t))) out.push({ index: m.index, length: m[0].length, wrong: m[0], right: m[0].slice(0, m[0][0] === "了" ? 2 : 1), kind: "重复字" });
    // 重复标点：，，  。。  、、
    const punRe = /([，。、；：？！])\1+/g;
    while ((m = punRe.exec(t))) out.push({ index: m.index, length: m[0].length, wrong: m[0], right: m[1], kind: "重复标点" });
    // 中文之间的半角逗号 / 句号
    const halfRe = /[\u4e00-\u9fa5]([,;])(?=[\u4e00-\u9fa5])/g;
    while ((m = halfRe.exec(t))) out.push({ index: m.index + 1, length: 1, wrong: m[1], right: m[1] === "," ? "，" : "；", kind: "半角标点" });
    return out.sort((a, b) => a.index - b.index);
  }

  /* ---------------- 识别文章场景（规则，用于推荐版式） ---------------- */
  const SCENE_RULES = [
    { scene: "种草", reason: "检测到价格或优惠信息", re: /[¥￥]\s?\d|\d+\s?元(?![素旦宵气宇代老])|券后|到手价|优惠券|满\s?\d+\s?减|包邮|下单|种草|好物|原价|折扣|性价比|回购/g },
    { scene: "教程", reason: "检测到代码或教程步骤", re: /```|安装|配置|步骤|教程|命令|报错|插件|Prompt|提示词|模型|API|GPT|Claude|DeepSeek|代码/gi },
    { scene: "艺术", reason: "检测到作品信息", re: /布面油画|纸本|水墨|装置|雕塑|版画|展览|画廊|美术馆|艺术家|策展|\d+\s?[×xX]\s?\d+\s?cm|创作于/g },
    { scene: "娱乐", reason: "检测到娱乐话题", re: /官宣|热搜|爆料|曝光|恋情|综艺|明星|粉丝|塌房|绯闻|同框|路透|演唱会|新剧|顶流|吃瓜/g },
    { scene: "情感", reason: "文章偏抒情", re: /想念|温柔|孤独|治愈|晚安|心事|喜欢你|难过|释怀|遗憾|陪伴|长大|成年人|深夜|眼泪/g },
    { scene: "商业", reason: "检测到经营数据", re: /营收|同比|环比|财报|增长率|毛利|市场份额|亿元|融资|估值|用户规模|GMV|季度/g },
    { scene: "人文", reason: "检测到读书或人文话题", re: /读书|书摘|作者|出版|诗人|小说|散文|历史|一本书|书里/g }
  ];
  function detectScene(md) {
    const text = String(md || "");
    return SCENE_RULES.map(r => ({ scene: r.scene, reason: r.reason, score: (text.match(r.re) || []).length }))
      .filter(r => r.score >= 2)
      .sort((a, b) => b.score - a.score);
  }

  /* ---------------- 平台规则（数字来自调研，见 README 的来源说明） ---------------- */
  const PLATFORMS = {
    wechat: { label: "公众号", titleMax: 64, titleApi: 32, digestMax: 120, bodyMax: 20000 },
    xlsh: { label: "小绿书", titleMax: 32, titleShow: 20, bodyMax: 1000, imagesMax: 20, ratio: [3, 4] },
    xhs: { label: "小红书", titleMax: 20, bodyMax: 1000, imagesMax: 18, tagsMax: 5, ratio: [3, 4] },
    zhihu: { label: "知乎", titleMax: 100 },
    x: { label: "X", postMax: 280, longMax: 25000, articleMax: 100000, imagesPerPost: 4 }
  };

  /* 小红书站外导流检测 */
  function leadRisks(text) {
    const hits = [];
    if (/https?:\/\/|www\.|\.(com|cn|net)\b/i.test(text)) hits.push("网址");
    if (/(微信|威信|V信|vx|wx|weixin|加v|➕v)[:：\s]*[A-Za-z0-9_-]{5,}/i.test(text) || /(加|➕)\s*(微信|V|vx|wx)/i.test(text)) hits.push("微信号");
    if (/(?<!\d)1[3-9]\d{9}(?!\d)/.test(text)) hits.push("手机号");
    if (/[\w.+-]+@[\w-]+\.[\w.]+/.test(text)) hits.push("邮箱");
    if (/(关注|搜索?|私信|来)\s*(我的?)?\s*(公众号|抖音号?|视频号|B站|快手|淘宝店?|闲鱼)/.test(text) || /(公众号|抖音号|视频号)\s*[:：]\s*[「“"]?[A-Za-z0-9_\u4e00-\u9fa5]{2,}[」”"]/.test(text)) hits.push("其他平台账号");
    return hits;
  }

  /* ---------------- 发布检查 ---------------- */
  function check(platform, ctx) {
    const { blocks, title, footnotes, notes, tokensLinks, images, noteBody, thread, tags } = ctx;
    const rules = PLATFORMS[platform];
    const out = [];
    const add = (level, title, detail) => out.push({ level, title, detail });
    const paras = blocks.filter(b => b.type === "para");

    if (notes && notes.comments) add("info", "已隐藏 " + notes.comments + " 处 %%注释%%", "Obsidian 注释只留在源稿，不会出现在成稿里。");
    if (notes && notes.droppedEmbeds.length) add("warn", "有 " + notes.droppedEmbeds.length + " 处笔记嵌入无法展开", "「" + notes.droppedEmbeds.slice(0, 3).join("」「") + "」等 ![[笔记]] 嵌入已略过，需要的话把内容直接贴进正文。");

    const unresolved = images.filter(i => i.unresolved);
    if (unresolved.length) add("error", unresolved.length + " 张图片没有找到", "Obsidian 本地图片需要先在「图片」里关联附件文件夹，或把图片拖进编辑区。");

    if (platform === "wechat") {
      if (!title) add("warn", "没有一级标题", "用 # 写文章标题，方便复制到标题栏；正文是否保留标题可在「调整」里设置。");
      else if (charLength(title) > rules.titleMax) add("error", "标题超过 " + rules.titleMax + " 字", "当前 " + charLength(title) + " 字，公众号后台无法保存。");
      else if (charLength(title) > rules.titleApi) add("warn", "标题超过 " + rules.titleApi + " 字", "当前 " + charLength(title) + " 字。后台手动发布一般可以，但通过接口或第三方工具发布会被拒绝；消息列表里也会被截断。");
      const ext = tokensLinks.filter(l => /^https?:/i.test(l.href) && !/mp\.weixin\.qq\.com/i.test(l.href));
      if (ext.length) add("info", ext.length + " 个外部链接已转为文末注释", "公众号正文里的外链不可点击，已自动编号放到文末「参考资料」。");
      const long = paras.filter(p => charLength(p.text) > 160);
      if (long.length) add("warn", long.length + " 个段落偏长", "手机上超过 160 字的段落会占满一屏，建议拆开。首段：「" + long[0].text.slice(0, 18) + "…」");
      const wide = blocks.filter(b => b.type === "table" && b.header.length > 4);
      if (wide.length) add("warn", "表格超过 4 列", "手机屏幕上会被挤压，考虑拆表或改用列表。");
      const words = countWords(blocks.map(b => b.text || "").join(""));
      if (words > rules.bodyMax) add("error", "正文超过 2 万字", "公众号单篇正文上限约 2 万字，需要拆成上下篇。");
    }

    if (platform === "xhs" || platform === "xlsh") {
      if (!title) add("warn", "缺少笔记标题", "标题取自一级标题，也可以在右侧单独填写。");
      else if (charLength(title) > rules.titleMax) add("error", "标题超过 " + rules.titleMax + " 字", "当前 " + charLength(title) + " 字，发布时会被截断或无法提交。");
      else if (rules.titleShow && charLength(title) > rules.titleShow) add("warn", "标题超过 " + rules.titleShow + " 字", "从文章转成贴图时只保留前 " + rules.titleShow + " 字，信息流里也会被截断。");
      const n = charLength(noteBody || "");
      if (n > rules.bodyMax) add(platform === "xhs" ? "error" : "warn", "正文超过 " + rules.bodyMax + " 字", "当前 " + n + " 字。多出的内容放进图片卡片里，正文只留导语和要点。");
      if (images && ctx.cardCount > rules.imagesMax) add("error", "卡片超过 " + rules.imagesMax + " 张", "当前 " + ctx.cardCount + " 张，精简正文或调小字号。");
      const lead = leadRisks(noteBody || "");
      if (lead.length) add(platform === "xhs" ? "error" : "warn", "含有引流信息", "检测到" + lead.join("、") + "。小红书会对站外导流逐级处罚（警告、限流、禁言），发布前删掉。");
      if (platform === "xhs") {
        if ((tags || []).length > rules.tagsMax) add("warn", "话题超过 " + rules.tagsMax + " 个", "话题太多会稀释推荐，挑 3–5 个最贴切的。");
        if (!(tags || []).length) add("info", "还没有话题", "在右侧添加 3–5 个话题，或在 frontmatter 里写 tags。");
        else add("info", "话题需要在 App 里选中", "直接粘贴的 #话题 只是文字。发布时把光标放在话题后，从候选里点选一次才会变成可点的标签。");
      }
    }

    if (platform === "zhihu") {
      if (images.some(i => i.embedded)) add("warn", "本地图片需在知乎重新上传", "知乎只抓取公网地址的图片。本地/粘贴的图片复制过去可能显示「上传失败」，可在「图片」里打包下载后手动上传。");
      if (!title) add("warn", "没有一级标题", "知乎文章需要单独填写标题，复制时会把一级标题从正文移除。");
      else if (charLength(title) > rules.titleMax) add("error", "标题超过 " + rules.titleMax + " 字", "当前 " + charLength(title) + " 字。");
      if (blocks.some(b => b.type === "heading" && b.depth >= 4)) add("info", "四级及以下标题会降级", "知乎正文只支持两级标题，H4 以下按加粗段落处理。");
      add("info", "颜色与字体不会保留", "知乎会统一正文样式，加粗、引用、列表、代码块、表格等结构可以保留。");
    }

    if (platform === "x" && ctx.xMode === "long" && ctx.plainLength > rules.longMax) add("error", "超过长帖上限", "Premium 长帖最多 25,000 字符，当前 " + ctx.plainLength + "。考虑改发 X 文章。");
    if (platform === "x" && ctx.xMode === "article") {
      if (blocks.some(b => b.type === "code" || b.type === "table")) add("warn", "代码块和表格会降级", "X 文章不支持代码块和表格，已转成普通段落；重要的表格建议截图插入。");
      add("info", "X 文章需要 Premium", "2026 年起所有 Premium 档位都能发文章；免费账号请改用串推。");
    }
    if (platform === "x" && thread) {
      const over = thread.filter(p => p.length > rules.postMax);
      if (over.length) add("error", over.length + " 条超过 280", "需要手动精简这几条。");
      if (thread.length > 25) add("warn", "串推共 " + thread.length + " 条", "超过 25 条的串推完读率很低，考虑改用长帖或 X 文章。");
      const extra = thread.filter(p => p.extraImages);
      if (extra.length) add("warn", "部分帖子图片超过 4 张", "每条最多 4 张图，多出的需要另起一条。");
    }

    if (footnotes && footnotes.length && platform !== "x") add("info", footnotes.length + " 条脚注", "脚注会编号放到文末。");
    if (!out.some(o => o.level === "error" || o.level === "warn")) out.unshift({ level: "ok", title: "可以发布", detail: "没有发现阻断问题。" });
    return out;
  }

  const Core = {
    parseFrontmatter, frontmatterTags, preprocess, toHtml, toBlocks, articleTitle,
    countWords, countChars, charLength, xLength, sentences, splitThread, blocksToXUnits,
    blocksToPlain, noteText, NOTE_STYLES, PLATFORMS, check, leadRisks, linksIn, imagesIn,
    maskForScan, findImageTokens, withImageWidth, setImageWidth, detectScene, findTypos
  };
  root.Core = Core;
  if (typeof module !== "undefined") module.exports = Core;
})(typeof window !== "undefined" ? window : globalThis);
