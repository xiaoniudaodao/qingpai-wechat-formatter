/* 轻排 · 所见即所得画布
   - 粘贴：网页 / 公众号 / Word / Notion 的富文本只保留结构；纯文本 Markdown 直接排版
   - 画布 → Markdown（源稿始终是 Markdown，其他平台照常从它生成）
   - 重新套版式时保存 / 恢复光标
   - Markdown 快捷输入：## 标题、- 列表、1. 编号、> 引用、``` 代码、--- 分隔线 */
(function (root) {
  "use strict";

  const BLOCK = new Set(["P", "H1", "H2", "H3", "H4", "BLOCKQUOTE", "UL", "OL", "LI", "PRE", "TABLE", "HR", "SECTION", "FIGURE"]);
  const isDeco = n => n.nodeType === 1 && (n.hasAttribute("data-deco") || n.hasAttribute("data-preview-only"));

  /* ---------------- 粘贴清洗 ---------------- */
  const KEEP = new Set(["P", "H1", "H2", "H3", "H4", "STRONG", "EM", "MARK", "DEL", "CODE", "PRE", "BLOCKQUOTE", "UL", "OL", "LI", "A", "IMG", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD", "HR", "BR", "SUP"]);
  const RENAME = { B: "STRONG", I: "EM", S: "DEL", STRIKE: "DEL", H5: "H4", H6: "H4", FIGCAPTION: "P" };
  const DROP = new Set(["SCRIPT", "STYLE", "META", "LINK", "TITLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "SELECT", "TEXTAREA", "SVG", "VIDEO", "AUDIO", "NOSCRIPT", "TEMPLATE"]);

  function sanitizeHtml(html, onImage) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const body = doc.body;
    const walk = el => {
      [...el.childNodes].forEach(n => {
        if (n.nodeType === 8) { n.remove(); return; }
        if (n.nodeType !== 1) return;
        let tag = n.tagName;
        if (DROP.has(tag)) { n.remove(); return; }
        // 粗体 / 斜体也可能写在 style 里（公众号、Google Docs）
        const st = n.getAttribute("style") || "";
        if (tag === "SPAN" && /font-weight:\s*(bold|[6-9]00)/i.test(st)) tag = "STRONG";
        else if (tag === "SPAN" && /font-style:\s*italic/i.test(st)) tag = "EM";
        if (RENAME[tag]) tag = RENAME[tag];
        walk(n);
        if (tag === "IMG") {
          const src = n.getAttribute("data-src") || n.getAttribute("src") || "";
          if (!src || /^blob:/i.test(src)) { n.remove(); return; }
          const img = doc.createElement("img");
          img.setAttribute("src", onImage ? onImage(src) : src);
          if (n.getAttribute("alt")) img.setAttribute("alt", n.getAttribute("alt"));
          n.replaceWith(img);
          return;
        }
        if (KEEP.has(tag)) {
          const out = doc.createElement(tag);
          if (tag === "A" && n.getAttribute("href") && !/^\s*javascript:/i.test(n.getAttribute("href"))) out.setAttribute("href", n.getAttribute("href"));
          if ((tag === "OL") && n.getAttribute("start")) out.setAttribute("start", n.getAttribute("start"));
          if (tag === "TD" || tag === "TH") ["colspan", "rowspan"].forEach(a => n.getAttribute(a) && out.setAttribute(a, n.getAttribute(a)));
          if (tag === "CODE" && /language-/.test(n.className)) out.className = (/language-[\w+#-]+/.exec(n.className) || [""])[0];
          while (n.firstChild) out.appendChild(n.firstChild);
          n.replaceWith(out);
          return;
        }
        // DIV / SECTION / SPAN / FONT 等：块级容器里只有行内内容时变成段落，否则拆壳
        const hasBlock = [...n.children].some(c => BLOCK.has(c.tagName) || c.tagName === "DIV" || c.tagName === "IMG");
        if ((tag === "DIV" || tag === "SECTION" || tag === "ARTICLE" || tag === "HEADER" || tag === "FOOTER") && !hasBlock && n.textContent.trim()) {
          const p = doc.createElement("p");
          while (n.firstChild) p.appendChild(n.firstChild);
          n.replaceWith(p);
          return;
        }
        const frag = doc.createDocumentFragment();
        while (n.firstChild) frag.appendChild(n.firstChild);
        n.replaceWith(frag);
      });
    };
    walk(body);
    // 空段落、只剩空白的强调
    body.querySelectorAll("p,strong,em,mark,h1,h2,h3,h4").forEach(n => { if (!n.textContent.trim() && !n.querySelector("img,br")) n.remove(); });
    return body.innerHTML;
  }

  /* 纯文本像不像 Markdown */
  function looksLikeMarkdown(text) {
    return /(^|\n)\s{0,3}(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|```|---\s*$|\|.+\|)|!\[\[|!\[[^\]]*\]\(|\*\*[^*]+\*\*|==[^=]+==/m.test(text);
  }

  /* ---------------- 画布 → Markdown ---------------- */
  function inline(node) {
    let out = "";
    node.childNodes.forEach(n => {
      if (n.nodeType === 3) { out += n.textContent.replace(/ /g, " "); return; }
      if (n.nodeType !== 1 || isDeco(n)) return;
      const t = n.tagName;
      const inner = () => inline(n);
      if (n.dataset.wrap) out += inner();
      else if (t === "STRONG" || t === "B") out += wrapMark("**", inner());
      else if (t === "EM" || t === "I") out += wrapMark("*", inner());
      else if (t === "MARK") out += wrapMark("==", inner());
      else if (t === "DEL" || t === "S") out += wrapMark("~~", inner());
      else if (t === "CODE") out += "`" + n.textContent + "`";
      else if (t === "A") out += "[" + inner() + "](" + (n.getAttribute("href") || "") + ")";
      else if (t === "BR") out += "\n";
      else if (t === "IMG") out += imageMd(n, n.getAttribute("alt") || "");
      else if (t === "SUP" && n.dataset.fn) out += "[^" + n.dataset.fn + "]";
      else if (n.dataset.role === "task") out += n.textContent.includes("☑") ? "[x] " : "[ ] ";
      else out += inner();
    });
    return out;
  }
  function wrapMark(m, s) {
    const lead = /^\s*/.exec(s)[0], tail = /\s*$/.exec(s)[0];
    const core = s.trim();
    return core ? lead + m + core + m + tail : s;
  }
  function imageMd(img, caption) {
    const key = img.dataset.key || img.getAttribute("src") || "";
    const w = img.dataset.w ? "|" + img.dataset.w : "";
    const cap = (caption || "").replace(/[\[\]|]/g, "").trim();
    if (key.startsWith("obsidian-image:")) {
      const name = decodeURIComponent(key.slice(15));
      return "![[" + name + (cap ? "|" + cap : "") + (img.dataset.w ? "|" + img.dataset.w : "") + "]]";
    }
    return "![" + cap + w + "](" + key + ")";
  }

  function blocks(container, indent) {
    const out = [];
    container.childNodes.forEach(n => {
      if (n.nodeType === 3) { if (n.textContent.trim()) out.push(indent + n.textContent.trim()); return; }
      if (n.nodeType !== 1 || isDeco(n)) return;
      if (n.style && n.style.display === "none" && n.dataset.role !== "title" && n.dataset.role !== "caption" && n.tagName !== "HR") return;
      const t = n.tagName, role = n.dataset.role;
      if (role === "footnotes") return; // 脚注定义由 footnotesMd 统一输出
      if (/^H[1-4]$/.test(t)) out.push("#".repeat(+t[1]) + " " + inline(n).trim());
      else if (t === "P" || t === "DIV") { const s = inline(n).trim(); if (s) out.push(s); }
      else if (role === "figure") {
        const img = n.querySelector("img");
        const cap = n.querySelector("[data-role=caption]");
        if (img) out.push(imageMd(img, cap ? cap.textContent : img.getAttribute("alt")));
      }
      else if (t === "IMG") out.push(imageMd(n, n.getAttribute("alt")));
      else if (role === "callout") {
        const title = n.querySelector("[data-role=callout-title]");
        const body = [...n.children].filter(c => c !== title && !isDeco(c)).map(c => inline(c).trim()).filter(Boolean);
        out.push(["> [!" + (n.dataset.kind || "tip") + "] " + (title ? title.textContent.trim() : "")].concat(body.map(b => "> " + b.replace(/\n/g, "\n> "))).join("\n"));
      }
      else if (t === "BLOCKQUOTE") {
        const inner = blocks(n, "").join("\n\n") || inline(n).trim();
        out.push(inner.split("\n").map(l => "> " + l).join("\n").replace(/> $/gm, ">"));
      }
      else if (t === "UL" || t === "OL") out.push(listMd(n, 0));
      else if (t === "PRE") {
        const lang = n.dataset.lang || (/language-([\w+#-]+)/.exec((n.querySelector("code") || {}).className || "") || [])[1] || "";
        out.push("```" + lang + "\n" + n.textContent.replace(/\n$/, "") + "\n```");
      }
      else if (t === "HR") out.push("---");
      else if (t === "TABLE") out.push(tableMd(n));
      else if (t === "SECTION") out.push(...blocks(n, indent));
      else { const s = inline(n).trim(); if (s) out.push(s); }
    });
    return out;
  }
  function listMd(list, depth) {
    const ordered = list.tagName === "OL";
    let i = parseInt(list.getAttribute("start"), 10) || 1;
    const pad = "   ".repeat(depth);
    const lines = [];
    [...list.children].forEach(li => {
      if (li.tagName !== "LI") return;
      const textParts = [], nested = [];
      li.childNodes.forEach(c => {
        if (c.nodeType === 1 && (c.tagName === "UL" || c.tagName === "OL")) nested.push(c);
        else if (c.nodeType === 1 && c.tagName === "P") textParts.push(inline(c));
        else if (c.nodeType === 1 && isDeco(c)) return;
        else textParts.push(c.nodeType === 3 ? c.textContent : inline({ childNodes: [c] }));
      });
      lines.push(pad + (ordered ? (i++) + ". " : "- ") + textParts.join(" ").replace(/\s+/g, " ").trim());
      nested.forEach(nl => lines.push(listMd(nl, depth + 1)));
    });
    return lines.join("\n");
  }
  function tableMd(table) {
    const rows = [...table.querySelectorAll("tr")].map(tr => [...tr.children].map(c => inline(c).trim().replace(/\|/g, "\\|").replace(/\n/g, " ")));
    if (!rows.length) return "";
    const n = Math.max(...rows.map(r => r.length));
    rows.forEach(r => { while (r.length < n) r.push(""); });
    const line = r => "| " + r.join(" | ") + " |";
    return [line(rows[0]), line(rows[0].map(() => "---"))].concat(rows.slice(1).map(line)).join("\n");
  }
  function footnotesMd(container) {
    const box = container.querySelector("[data-role=footnotes]");
    if (!box) return "";
    return [...box.querySelectorAll("[data-role=fn]")].map((p, i) => {
      const clone = p.cloneNode(true);
      clone.querySelectorAll("[data-role=fn-num],[data-deco]").forEach(x => x.remove());
      return "[^" + (i + 1) + "]: " + inline(clone).trim();
    }).join("\n");
  }

  /* frontmatter 保留原样 */
  function toMarkdown(container, prevMd) {
    const fm = /^﻿?---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(prevMd || "");
    const body = blocks(container, "").join("\n\n");
    const notes = footnotesMd(container);
    return (fm ? fm[0].replace(/\s*$/, "\n\n") : "") + body + (notes ? "\n\n" + notes : "") + "\n";
  }

  /* ---------------- 光标 ---------------- */
  function closestBlock(node, rootEl) {
    let n = node.nodeType === 3 ? node.parentNode : node;
    while (n && n !== rootEl && !(n.nodeType === 1 && BLOCK.has(n.tagName) && !["UL", "OL", "TABLE", "SECTION", "BLOCKQUOTE"].includes(n.tagName))) n = n.parentNode;
    return n && n !== rootEl ? n : null;
  }
  function textNodes(el) {
    const out = [];
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => t.parentElement.closest("[data-deco]") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  // 记住选区（开头和结尾都记，不只记光标）：按「去掉版式装饰后的第几个字」记，重排版后还能放回原处
  function textPos(rootEl, c, o) {
    const r = document.createRange();
    r.setStart(rootEl, 0); r.setEnd(c, o);
    const f = r.cloneContents();
    f.querySelectorAll("[data-deco],[data-preview-only]").forEach(x => x.remove());
    return f.textContent.length;
  }
  function posToPoint(rootEl, pos) {
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: t => t.parentElement.closest("[data-deco],[data-preview-only]") ? 2 : 1 });
    let t, last = null;
    while ((t = w.nextNode())) { if (pos <= t.textContent.length) return [t, pos]; pos -= t.textContent.length; last = t; }
    return last ? [last, last.textContent.length] : [rootEl, rootEl.childNodes.length];
  }
  function saveCaret(rootEl) {
    const sel = getSelection();
    if (!sel.rangeCount || !rootEl.contains(sel.anchorNode)) return null;
    const r = sel.getRangeAt(0);
    try { return { start: textPos(rootEl, r.startContainer, r.startOffset), end: textPos(rootEl, r.endContainer, r.endOffset) }; }
    catch (e) { return null; }
  }
  function restoreCaret(rootEl, saved) {
    if (!saved) return;
    const r = document.createRange();
    const [a, ao] = posToPoint(rootEl, saved.start);
    r.setStart(a, ao);
    if (saved.end !== saved.start) { const [b, bo] = posToPoint(rootEl, saved.end); r.setEnd(b, bo); } else r.collapse(true);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }

  /* ---------------- 画布规整（编辑后） ---------------- */
  function normalize(rootEl) {
    // 浏览器生成的标签换成语义标签
    rootEl.querySelectorAll("b,i,s,strike,font,u").forEach(n => {
      const map = { B: "strong", I: "em", S: "del", STRIKE: "del" };
      if (map[n.tagName]) { const x = document.createElement(map[n.tagName]); while (n.firstChild) x.appendChild(n.firstChild); n.replaceWith(x); }
      else { const f = document.createDocumentFragment(); while (n.firstChild) f.appendChild(n.firstChild); n.replaceWith(f); }
    });
    // 紧挨着的两段加粗 / 斜体合成一段（否则源稿里会出现 ****）
    rootEl.querySelectorAll("strong,em,del,mark").forEach(n => {
      if (!n.isConnected) return;
      let next = n.nextSibling;
      while (next && next.nodeType === 1 && next.tagName === n.tagName && !next.attributes.length === !n.attributes.length) {
        while (next.firstChild) n.appendChild(next.firstChild);
        const gone = next; next = next.nextSibling; gone.remove();
      }
    });
    // 粘贴来的外层包装（section / div / 把块包在 p 里）拆掉，让每个段落、引用框都直接在正文这一层
    const BLOCKISH = "p,h1,h2,h3,h4,blockquote,ul,ol,pre,table,hr,section,div,figure";
    for (let guard = 0; guard < 6; guard++) {
      const wrappers = [...rootEl.children].filter(n => !isDeco(n) && !n.dataset.role && /^(SECTION|DIV|P|ARTICLE)$/.test(n.tagName) && [...n.children].some(c => c.matches(BLOCKISH)));
      if (!wrappers.length) break;
      wrappers.forEach(w => w.replaceWith(...w.childNodes));
    }
    // 顶层 DIV → P；顶层裸文字 → P
    [...rootEl.childNodes].forEach(n => {
      if (n.nodeType === 3 && n.textContent.trim()) { const p = document.createElement("p"); n.replaceWith(p); p.appendChild(n); }
      else if (n.nodeType === 1 && n.tagName === "DIV" && !isDeco(n)) { const p = document.createElement("p"); [...n.attributes].forEach(a => a.name.startsWith("data-") || p.setAttribute(a.name, a.value)); while (n.firstChild) p.appendChild(n.firstChild); n.replaceWith(p); }
    });
    // 没有语义的 span（浏览器复制粘贴残留）拆壳
    rootEl.querySelectorAll("span:not([data-deco]):not([data-wrap]):not([data-role])").forEach(n => {
      if (n.closest("pre,[data-deco]")) return;
      const f = document.createDocumentFragment(); while (n.firstChild) f.appendChild(n.firstChild); n.replaceWith(f);
    });
    // 落单的图片包成「图 + 图注」
    rootEl.querySelectorAll("img").forEach(img => {
      if (img.closest("[data-role=figure],[data-deco]")) return;
      const p = img.parentElement;
      const alone = p && p.tagName === "P" && p.textContent.trim() === "" && p.querySelectorAll("img").length === 1;
      const fig = document.createElement("section");
      fig.dataset.role = "figure";
      if (alone) { p.replaceWith(fig); fig.appendChild(img); }
      else if (p === rootEl) { img.replaceWith(fig); fig.appendChild(img); }
      else return;
      const cap = document.createElement("p");
      cap.dataset.role = "caption";
      cap.textContent = img.getAttribute("alt") || "";
      if (cap.textContent) fig.appendChild(cap);
    });
    dropBlankBlocks(rootEl);
  }

  // 去掉版式装饰后，这个块里还有没有内容（文字、图片、分隔线、表格）
  function isBlank(el) {
    if (el.querySelector("img,hr,table,pre")) return false;
    const c = el.cloneNode(true);
    c.querySelectorAll("[data-deco],[data-preview-only]").forEach(x => x.remove());
    return c.textContent.replace(/[\u200b\u00a0\s]/g, "") === "";
  }
  // 文字删光后留下的空标题、空引用：连同版式装饰一起清掉（光标所在的那个留着，可能正要往里打字）
  function dropBlankBlocks(rootEl) {
    const sel = getSelection();
    const anchor = sel.rangeCount ? sel.anchorNode : null;
    rootEl.querySelectorAll(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote").forEach(el => {
      if (el.dataset.role === "title" || !isBlank(el)) return;
      if (anchor && el.contains(anchor)) return;
      el.remove();
    });
  }

  /* ---------------- Markdown 快捷输入 ---------------- */
  function shortcut(rootEl) {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed) return false;
    const block = closestBlock(sel.anchorNode, rootEl);
    if (!block || block.tagName !== "P" || block.dataset.role) return false;
    const text = block.textContent.replace(/ /g, " ");
    const rules = [
      [/^(#{1,4}) $/, m => document.execCommand("formatBlock", false, "h" + m[1].length)],
      [/^[-*+] $/, () => document.execCommand("insertUnorderedList")],
      [/^1[.)] $/, () => document.execCommand("insertOrderedList")],
      [/^> $/, () => document.execCommand("formatBlock", false, "blockquote")],
      [/^```$/, () => document.execCommand("formatBlock", false, "pre")]
    ];
    for (const [re, run] of rules) {
      const m = re.exec(text);
      if (!m) continue;
      block.textContent = "";
      block.appendChild(document.createElement("br"));
      const r = document.createRange(); r.setStart(block, 0); r.collapse(true);
      sel.removeAllRanges(); sel.addRange(r);
      run(m);
      return true;
    }
    return false;
  }

  /* ---------------- base64 图片 → 本地图片库 ---------------- */
  // store(dataUrl) 返回 "img://id"
  function extractDataImages(md, store) {
    if (!/data:image\//i.test(md)) return md;
    return md
      .replace(/!\[([^\]\n]*)\]\(\s*(data:image\/[\w.+-]+;base64,[A-Za-z0-9+/=\s]+?)\s*\)/g, (m, alt, data) => "![" + alt + "](" + store(data.replace(/\s+/g, "")) + ")")
      .replace(/<img\b[^>]*?src=["'](data:image\/[\w.+-]+;base64,[^"']+)["'][^>]*>/gi, (m, data) => "![](" + store(data.replace(/\s+/g, "")) + ")");
  }

  root.Canvas = { sanitizeHtml, looksLikeMarkdown, toMarkdown, saveCaret, restoreCaret, normalize, shortcut, extractDataImages, isBlank };
})(window);
