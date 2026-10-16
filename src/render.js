/* 轻排 · 渲染层（浏览器）
   Markdown → 语义 DOM（可编辑、可反复套版式）→ 版式装饰（内联样式 + data-deco 装饰节点）
   预览区的手动修改保存在语义 DOM 里；换版式只是「去装饰 → 再装饰」，不会丢改动。 */
(function (root) {
  "use strict";
  const Core = root.Core;

  /* ---------------- 语义化 ---------------- */
  const CALLOUT_LABEL = {
    note: "注", info: "说明", tip: "提示", hint: "提示", important: "重要", success: "完成", check: "完成",
    question: "问", faq: "问", warning: "注意", caution: "注意", attention: "注意", danger: "警告", error: "警告",
    bug: "问题", example: "示例", quote: "引", cite: "引", abstract: "摘要", summary: "摘要", tldr: "摘要", todo: "待办"
  };

  function sanitize(rootEl) {
    rootEl.querySelectorAll("script,style,iframe,object,embed,form,link,meta,video,audio").forEach(n => n.remove());
    rootEl.querySelectorAll("*").forEach(el => {
      [...el.attributes].forEach(a => {
        if (/^on/i.test(a.name)) el.removeAttribute(a.name);
        if ((a.name === "href" || a.name === "src") && /^\s*javascript:/i.test(a.value)) el.removeAttribute(a.name);
      });
    });
  }

  /* images: { resolve(src) → { src, embedded, unresolved, name } } */
  function semantic(md, opts) {
    const pre = Core.preprocess(md, { stripFrontmatter: opts.stripFrontmatter !== false });
    const box = document.createElement("div");
    box.innerHTML = Core.toHtml(pre.md);
    sanitize(box);

    box.querySelectorAll("h5,h6").forEach(h => retag(h, "h4"));
    const h1 = box.querySelector("h1");
    if (h1) h1.dataset.role = "title";

    // 任务列表
    box.querySelectorAll('li > input[type="checkbox"], li > p > input[type="checkbox"]').forEach(cb => {
      const s = document.createElement("span");
      s.dataset.role = "task";
      s.textContent = cb.checked ? "☑ " : "☐ ";
      cb.replaceWith(s);
    });

    // 图片：独占一段的图片变成「图 + 图注」组
    const images = [];
    box.querySelectorAll("img").forEach(img => {
      const key = img.getAttribute("src") || "";
      img.dataset.key = key;
      const r = opts.resolveImage(key);
      images.push(r);
      img.setAttribute("src", r.src || "");
      if (r.unresolved) { img.dataset.unresolved = r.name || "1"; }
      const mark = /^bxi:(\d+):(\d*)$/.exec(img.getAttribute("title") || "");
      if (mark) { img.dataset.img = mark[1]; if (mark[2]) img.dataset.w = mark[2]; }
      img.removeAttribute("title");
    });
    box.querySelectorAll("p").forEach(p => {
      const kids = [...p.childNodes].filter(n => !(n.nodeType === 3 && !n.textContent.trim()) && n.nodeName !== "BR");
      if (!kids.length || !kids.every(n => n.nodeName === "IMG")) return;
      const frag = document.createDocumentFragment();
      kids.forEach(img => {
        const fig = document.createElement("section");
        fig.dataset.role = "figure";
        fig.appendChild(img);
        const cap = document.createElement("p");
        cap.dataset.role = "caption";
        cap.textContent = (img.getAttribute("alt") || "").trim();
        if (cap.textContent) fig.appendChild(cap);
        frag.appendChild(fig);
      });
      p.replaceWith(frag);
    });

    // Callout：> [!tip] 标题
    box.querySelectorAll("blockquote").forEach(bq => {
      const first = bq.firstElementChild;
      if (!first || first.tagName !== "P") return;
      // 标记行 = 首段里第一个 <br> 之前的文字
      let line = "";
      for (const n of first.childNodes) { if (n.nodeName === "BR") break; line += n.textContent; }
      line = line.split("\n")[0];
      const m = /^\s*\[!(\w+)\]([+-]?)[ \t]*(.*)$/.exec(line);
      if (!m) return;
      const kind = m[1].toLowerCase();
      bq.dataset.role = "callout";
      bq.dataset.kind = kind;
      stripLeadingText(first, line);
      if (first.firstChild && first.firstChild.nodeType === 3 && !first.firstChild.textContent.trim()) first.firstChild.remove();
      const brk = first.firstChild;
      if (brk && brk.nodeName === "BR") brk.remove();
      const title = document.createElement("p");
      title.dataset.role = "callout-title";
      title.textContent = m[3].trim() || CALLOUT_LABEL[kind] || kind.toUpperCase();
      bq.insertBefore(title, first);
      if (!first.textContent.trim() && !first.querySelector("img")) first.remove();
    });

    box.querySelectorAll("pre > code").forEach(code => {
      const lang = (/language-([\w+#-]+)/.exec(code.className) || [])[1] || "";
      code.parentElement.dataset.lang = lang;
      code.removeAttribute("class");
    });

    // 脚注区
    if (pre.footnotes.length) {
      const fn = document.createElement("section");
      fn.dataset.role = "footnotes";
      pre.footnotes.forEach((t, i) => {
        const p = document.createElement("p");
        p.dataset.role = "fn";
        p.innerHTML = '<span data-role="fn-num">[' + (i + 1) + "]</span> " + inlineMd(t);
        fn.appendChild(p);
      });
      box.appendChild(fn);
    }
    return { el: box, pre, images };
  }

  function inlineMd(s) {
    return Core.toHtml(s).replace(/^<p>|<\/p>\s*$/g, "");
  }
  function retag(el, tag) {
    const n = document.createElement(tag);
    [...el.attributes].forEach(a => n.setAttribute(a.name, a.value));
    while (el.firstChild) n.appendChild(el.firstChild);
    el.replaceWith(n);
    return n;
  }
  function stripLeadingText(el, text) {
    let left = text.length;
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const n of nodes) {
      if (left <= 0) break;
      const take = Math.min(left, n.textContent.length);
      n.textContent = n.textContent.slice(take);
      left -= take;
    }
  }

  /* ---------------- 版式装饰 ---------------- */
  function deco(tag, css, text) {
    const el = document.createElement(tag);
    el.dataset.deco = "1";
    el.setAttribute("contenteditable", "false");
    if (css) el.style.cssText = css;
    if (text != null) el.textContent = text;
    return el;
  }

  function undecorate(rootEl) {
    rootEl.querySelectorAll("[data-deco]").forEach(n => n.remove());
    // 包裹类装饰（如价签）：拆掉外壳，保留文字
    rootEl.querySelectorAll("[data-wrap]").forEach(w => {
      const parent = w.parentNode;
      while (w.firstChild) parent.insertBefore(w.firstChild, w);
      w.remove();
      parent.normalize();
    });
    rootEl.querySelectorAll("[style]").forEach(n => n.removeAttribute("style"));
    rootEl.querySelectorAll("[data-ext]").forEach(n => n.removeAttribute("data-ext"));
  }

  const FONT_STACK = {
    sans: "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei','Helvetica Neue',sans-serif",
    serif: "'Songti SC','Noto Serif SC','Source Han Serif SC','STSong','SimSun',Georgia,serif",
    kai: "'Kaiti SC','STKaiti','KaiTi',serif",
    mono: "'SF Mono',Menlo,Consolas,'Liberation Mono',monospace"
  };

  function hexToRgb(hex) {
    const h = hex.replace("#", "");
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  function rgba(hex, a) { return "rgba(" + hexToRgb(hex).join(",") + "," + a + ")"; }
  /* 与白色混合，得到不透明的浅色（公众号深色模式下比 rgba 更可控） */
  function tint(hex, amount) {
    const c = hexToRgb(hex).map(v => Math.round(v + (255 - v) * (1 - amount)));
    return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  }
  function shade(hex, amount) {
    const c = hexToRgb(hex).map(v => Math.round(v * (1 - amount)));
    return "#" + c.map(v => v.toString(16).padStart(2, "0")).join("");
  }

  const CN_NUM = "一二三四五六七八九十";
  function cnNumber(n) {
    if (n <= 10) return CN_NUM[n - 1];
    if (n < 20) return "十" + CN_NUM[n - 11];
    return String(n);
  }
  const pad2 = n => (n < 10 ? "0" : "") + n;

  /* 在正文文字里给匹配的片段套上样式（不进代码、不进装饰） */
  function wrapMatches(rootEl, re, css) {
    const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.parentElement.closest("pre,code,del,s,[data-deco],[data-wrap],a,h1,h2,h3,h4,th") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(tn => {
      const text = tn.textContent;
      re.lastIndex = 0;
      if (!re.test(text)) return;
      re.lastIndex = 0;
      const frag = document.createDocumentFragment();
      let last = 0, m;
      while ((m = re.exec(text))) {
        if (m.index > last) frag.appendChild(document.createTextNode(text.slice(last, m.index)));
        const span = document.createElement("span");
        span.dataset.wrap = "1";
        span.style.cssText = css;
        span.textContent = m[0];
        frag.appendChild(span);
        last = m.index + m[0].length;
        if (!re.global) break;
      }
      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));
      tn.replaceWith(frag);
    });
  }

  /* 版式参数：字号、行距、字体、主色；多色配色在 pal 里 */
  function makeK(tpl, tw) {
    const t = Object.assign({}, tpl.defaults, tw);
    const pal = (tpl.palettes || []).find(p => p.accent === t.accent) || {};
    return {
      accent: t.accent, fs: +t.fontSize, lh: +t.lineHeight, font: FONT_STACK[t.font] || FONT_STACK.sans,
      pal, tint, shade, rgba, FONT_STACK, cnNumber, pad2,
      // 可改名的装饰标签（如「批注」）：用户改过的名字存在调整项 labels 里，全文同一处生效
      label(key, tag, css, fallback) {
        const def = (tpl.labels || {})[key] || fallback || "";
        const el = deco(tag, css, (t.labels || {})[key] || def);
        el.dataset.label = key;
        return el;
      }
    };
  }

  /* 把版式定义套到语义 DOM 上
     tpl: 版式对象（templates.js），tw: 调整项 { accent, fontSize, lineHeight, font, keepTitle, captions, linkNotes, indent } */
  function decorate(rootEl, tpl, tw, env = {}) {
    undecorate(rootEl);
    const t = Object.assign({}, tpl.defaults, tw);
    const k = makeK(tpl, tw);
    const s = tpl.styles(k);
    const set = (sel, css) => css != null && rootEl.querySelectorAll(sel).forEach(el => { el.style.cssText = css; });

    rootEl.style.cssText = s.root;
    // 页面边距：正文左右留白，全局设置，覆盖版式自带的左右内边距
    if (t.sidePad != null) { rootEl.style.paddingLeft = t.sidePad + "px"; rootEl.style.paddingRight = t.sidePad + "px"; }
    set("p", s.p);
    if (t.indent) rootEl.querySelectorAll(":scope > p").forEach(p => { p.style.textIndent = "2em"; });
    set("h2", s.h2); set("h3", s.h3); set("h4", s.h4);
    set("h1", s.h1);
    // 标题颜色：用户自选时覆盖版式默认（只改标题文字，不改编号等装饰）
    if (t.headColor) rootEl.querySelectorAll("h1,h2,h3").forEach(hd => { hd.style.color = t.headColor; });
    set("strong", s.strong); set("em", s.em); set("del", s.del || "color:#999;");
    set("mark", t.markColor ? (s.mark || "") + "background-color:" + t.markColor + ";border-bottom:none;" : s.mark); set("a", s.a);
    set("code", s.code);
    set("blockquote", s.quote);
    set("blockquote p", s.quoteP);
    set("ul", s.ul); set("ol", s.ol); set("li", s.li); set("li > p", "margin:0;");
    set("hr", s.hr);
    set("table", s.table); set("th", s.th); set("td", s.td);
    set("[data-role=figure]", s.figure);
    set("img", s.img);
    rootEl.querySelectorAll("img[data-w]").forEach(img => { img.style.width = img.dataset.w + "px"; });
    // 图片位置：左 / 中 / 右（默认居中）
    const align = t.imgAlign || "center";
    rootEl.querySelectorAll("[data-role=figure] img, img").forEach(img => {
      img.style.marginLeft = align === "left" ? "0" : "auto";
      img.style.marginRight = align === "right" ? "0" : "auto";
    });
    // 图片圆角（0–10）与阴影（0–10：滑块越大范围越大，颜色始终很浅）
    if (t.imgRadius != null || t.imgShadow || t.imgBorder) rootEl.querySelectorAll("img").forEach(img => {
      if (t.imgBorder) { img.style.border = "1px solid " + t.imgBorder; img.style.boxSizing = "border-box"; }
      if (t.imgRadius != null) img.style.borderRadius = t.imgRadius + "px";
      const v = +t.imgShadow || 0;
      if (v) img.style.boxShadow = "0 " + (0.5 + v * 0.25).toFixed(1) + "px " + (2 + v * 0.8).toFixed(1) + "px rgba(0,0,0," + (0.08 + v * 0.006).toFixed(3) + ")";
    });
    if (align !== "center") rootEl.querySelectorAll("[data-role=figure]").forEach(f => { f.style.textAlign = align; });
    rootEl.querySelectorAll("[data-role=caption]").forEach(c => { if (align !== "center") c.style.textAlign = align; });
    set("[data-role=caption]", s.caption);
    set("[data-role=callout]", s.callout);
    set("[data-role=callout-title]", s.calloutTitle);
    set("[data-role=callout] > p:not([data-role])", s.calloutP);
    set("sup[data-fn]", s.sup);
    set("[data-role=footnotes]", s.notes);
    set("[data-role=fn]", s.note);
    set("[data-role=fn-num]", "color:" + k.accent + ";");
    set("[data-role=task]", "display:inline-block;width:1.5em;margin-left:-1.5em;color:" + k.accent + ";");

    // 列表符号：用装饰节点画，公众号里不依赖 list-style
    rootEl.querySelectorAll("li").forEach(li => {
      if (li.querySelector(":scope > [data-role=task], :scope > p > [data-role=task]")) return;
      const list = li.parentElement;
      const ordered = list.tagName === "OL";
      let depth = 0;
      for (let n = list.parentElement; n && n !== rootEl; n = n.parentElement) if (n.tagName === "UL" || n.tagName === "OL") depth++;
      const index = [...list.children].indexOf(li) + (parseInt(list.getAttribute("start"), 10) || 1);
      const m = tpl.marker ? tpl.marker({ ordered, index, depth }, k)
        : { text: ordered ? index + "." : "•", css: "display:inline-block;width:1.5em;margin-left:-1.5em;" };
      if (m.pad) li.style.paddingLeft = m.pad;
      const target = li.firstElementChild && li.firstElementChild.tagName === "P" ? li.firstElementChild : li;
      target.prepend(deco("span", m.css, m.text));
    });

    // 代码块
    rootEl.querySelectorAll("pre").forEach(pre => {
      pre.style.cssText = s.pre;
      const code = pre.querySelector("code");
      if (code) {
        code.style.cssText = s.preCode;
        if (!code.dataset.hl && root.CodeHighlight) {
          code.innerHTML = root.CodeHighlight.html(code.textContent, pre.dataset.lang, s.codeTheme || "dark");
          code.dataset.hl = s.codeTheme || "dark";
        } else if (code.dataset.hl && code.dataset.hl !== (s.codeTheme || "dark") && root.CodeHighlight) {
          code.innerHTML = root.CodeHighlight.html(code.textContent, pre.dataset.lang, s.codeTheme || "dark");
          code.dataset.hl = s.codeTheme || "dark";
        }
      }
    });

    // 标题：正文里是否保留
    const title = rootEl.querySelector("[data-role=title]");
    if (title && !t.keepTitle) title.style.cssText = "display:none;";

    // 图注开关
    if (!t.captions) set("[data-role=caption]", "display:none;");

    // 版式自己的装饰（编号、刊头、花饰等）
    const ctx = { k, s, t, deco, rootEl, wrapMatches, h2Total: rootEl.querySelectorAll("h2").length };
    if (tpl.decorate && tpl.decorate.figure) rootEl.querySelectorAll("[data-role=figure]").forEach((f, i) => tpl.decorate.figure(f, i + 1, ctx));
    let h2i = 0, h3i = 0;
    if (tpl.decorate) {
      rootEl.querySelectorAll("h2,h3,hr,blockquote,h1").forEach(el => {
        if (el.tagName === "H2") { h2i++; h3i = 0; tpl.decorate.h2 && tpl.decorate.h2(el, h2i, ctx); }
        else if (el.tagName === "H3") { h3i++; tpl.decorate.h3 && tpl.decorate.h3(el, h3i, ctx); }
        else if (el.tagName === "HR") tpl.decorate.hr && tpl.decorate.hr(el, ctx);
        else if (el.tagName === "H1") tpl.decorate.h1 && el.style.display !== "none" && tpl.decorate.h1(el, ctx);
        else if (el.tagName === "BLOCKQUOTE" && !el.dataset.role) tpl.decorate.quote && tpl.decorate.quote(el, ctx);
      });
    }
    if (tpl.decorate && tpl.decorate.callout) rootEl.querySelectorAll("[data-role=callout]").forEach(el => tpl.decorate.callout(el, ctx));
    if (tpl.decorate && tpl.decorate.body) tpl.decorate.body(rootEl, ctx);
    // 外链 → 文末注释（公众号正文外链不可点）
    const ext = [];
    if (t.linkNotes) {
      rootEl.querySelectorAll("a[href]").forEach(a => {
        const href = a.getAttribute("href");
        if (!/^https?:/i.test(href) || /mp\.weixin\.qq\.com/i.test(href)) return;
        let idx = ext.findIndex(e => e.href === href);
        if (idx < 0) { ext.push({ href, text: a.textContent }); idx = ext.length - 1; }
        a.dataset.ext = "1";
        a.after(deco("sup", s.sup, "[" + (idx + 1) + "]"));
      });
    }
    const fnBox = rootEl.querySelector("[data-role=footnotes]");
    if (fnBox) fnBox.prepend(k.label("notes", "p", s.notesTitle, "注释"));
    if (ext.length) {
      const refs = deco("section", s.notes);
      refs.appendChild(k.label("refs", "p", s.notesTitle, "参考资料"));
      ext.forEach((e, i) => {
        const p = deco("p", s.note);
        p.appendChild(deco("span", "color:" + k.accent + ";", "[" + (i + 1) + "] "));
        p.appendChild(deco("span", "", e.text + "："));
        p.appendChild(deco("span", "word-break:break-all;color:#8c8c8c;", e.href));
        refs.appendChild(p);
      });
      rootEl.appendChild(refs);
    }
    const hasContent = [...rootEl.children].some(n => !n.dataset.deco && (n.textContent.trim() || n.querySelector("img")));
    if (hasContent && tpl.decorate && tpl.decorate.end && t.endMark !== false) tpl.decorate.end(rootEl, ctx);
    return { links: ext.length };
  }

  /* ---------------- 导出：公众号 ---------------- */
  function cleanForExport(node) {
    node.querySelectorAll("[data-preview-only]").forEach(n => n.remove());
    node.querySelectorAll("img[data-unresolved]").forEach(img => {
      const fig = img.closest("[data-role=figure]");
      (fig || img).remove();
    });
    node.querySelectorAll('[style*="display:none"],[style*="display: none"]').forEach(n => n.remove());
    node.querySelectorAll("*").forEach(el => {
      [...el.attributes].forEach(a => {
        if (a.name.startsWith("data-") || a.name === "contenteditable" || a.name === "class" || a.name === "id" || a.name === "spellcheck") el.removeAttribute(a.name);
      });
    });
  }

  /* 代码块：换行转 <br>；只把行首缩进和连续空格转成不换行空格，其余空格照常折行。
     公众号对 <pre> 有特殊处理且容易判定「溢出」，导出时改成 section/span，并允许自动换行。 */
  function hardenPre(node) {
    node.querySelectorAll("pre").forEach(pre => {
      const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
      const texts = [];
      while (walker.nextNode()) texts.push(walker.currentNode);
      let atLineStart = true;
      texts.forEach(tn => {
        const parts = tn.textContent.replace(/\t/g, "    ").split("\n");
        const frag = document.createDocumentFragment();
        parts.forEach((part, i) => {
          if (i > 0) { frag.appendChild(document.createElement("br")); atLineStart = true; }
          if (!part) return;
          let txt = part.replace(/ {2,}/g, m => "\u00a0".repeat(m.length));
          if (atLineStart) txt = txt.replace(/^ +/, m => "\u00a0".repeat(m.length));
          frag.appendChild(document.createTextNode(txt));
          atLineStart = false;
        });
        tn.replaceWith(frag);
      });
      const code = pre.querySelector("code") || pre;
      while (code.lastChild && code.lastChild.nodeName === "BR") code.lastChild.remove();
      // pre/code → section/span，保留样式并强制可换行
      pre.querySelectorAll("code").forEach(c => {
        const span = document.createElement("span");
        span.style.cssText = c.style.cssText;
        span.style.whiteSpace = "normal";
        span.style.wordBreak = "break-all";
        while (c.firstChild) span.appendChild(c.firstChild);
        c.replaceWith(span);
      });
      const sec = document.createElement("section");
      sec.style.cssText = pre.style.cssText;
      sec.style.whiteSpace = "normal";
      sec.style.wordBreak = "break-all";
      sec.style.overflow = "hidden";
      while (pre.firstChild) sec.appendChild(pre.firstChild);
      pre.replaceWith(sec);
    });
    // 表格单元格允许断行，避免撑宽
    node.querySelectorAll("td,th").forEach(c => { c.style.wordBreak = "break-all"; });
  }

  function exportWechat(articleEl) {
    const node = articleEl.cloneNode(true);
    node.querySelectorAll("a[data-ext]").forEach(a => {
      const span = document.createElement("span");
      span.style.cssText = a.style.cssText;
      while (a.firstChild) span.appendChild(a.firstChild);
      a.replaceWith(span);
    });
    hardenPre(node);
    // 列表：公众号对嵌套 ul/li 的渲染因机型而异，导出为 section + 手动符号
    node.querySelectorAll("li").forEach(li => retag(li, "section"));
    node.querySelectorAll("ul,ol").forEach(l => retag(l, "section"));
    cleanForExport(node);
    const wrap = document.createElement("section");
    wrap.style.cssText = articleEl.style.cssText;
    while (node.firstChild) wrap.appendChild(node.firstChild);
    return wrap.outerHTML;
  }

  /* ---------------- 导出：知乎（结构化、无样式） ---------------- */
  function exportZhihu(articleEl) {
    const node = articleEl.cloneNode(true);
    undecorate(node);
    node.querySelectorAll("[data-role=title]").forEach(n => n.remove());
    node.querySelectorAll("h4").forEach(h => { const p = retag(h, "p"); p.innerHTML = "<strong>" + p.innerHTML + "</strong>"; });
    node.querySelectorAll("mark").forEach(m => retag(m, "strong"));
    node.querySelectorAll("[data-role=callout]").forEach(c => {
      const t = c.querySelector("[data-role=callout-title]");
      if (t) t.innerHTML = "<strong>" + t.innerHTML + "</strong>";
    });
    node.querySelectorAll("[data-role=figure]").forEach(f => {
      const img = f.querySelector("img");
      const cap = f.querySelector("[data-role=caption]");
      const fig = document.createElement("figure");
      if (img) fig.appendChild(img);
      if (cap && cap.textContent.trim()) { const fc = document.createElement("figcaption"); fc.textContent = cap.textContent; fig.appendChild(fc); }
      f.replaceWith(fig);
    });
    node.querySelectorAll("[data-role=footnotes]").forEach(f => {
      f.prepend(Object.assign(document.createElement("h3"), { textContent: "注释" }));
    });
    node.querySelectorAll("pre code").forEach(c => { c.textContent = c.textContent; if (c.parentElement.dataset.lang) c.className = "language-" + c.parentElement.dataset.lang; });
    cleanForExport(node);
    return node.innerHTML;
  }

  /* 知乎「导入文档」用的标准 Markdown（去掉 Obsidian 私有语法） */
  function zhihuMarkdown(md) {
    const pre = Core.preprocess(md);
    let out = pre.md
      .replace(/^#(?:[ \t]+.*)?\n+/, "")
      .replace(/<mark>(.*?)<\/mark>/g, "**$1**")
      .replace(/<strong>(.*?)<\/strong>/g, "**$1**")
      .replace(/<sup data-fn="(\d+)">\[\d+\]<\/sup>/g, "[$1]")
      .replace(/!\[([^\]]*)\]\(obsidian-image:[^)]+\)/g, "（图片：$1）");
    if (pre.footnotes.length) out += "\n\n### 注释\n\n" + pre.footnotes.map((f, i) => (i + 1) + ". " + f).join("\n");
    return out;
  }

  root.Render = { semantic, decorate, undecorate, makeK, wrapMatches, exportWechat, exportZhihu, zhihuMarkdown, FONT_STACK, tint, shade, rgba, deco, cnNumber, pad2 };
})(window);
