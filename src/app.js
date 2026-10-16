/* 轻排 · 界面与交互 */
(function () {
  "use strict";
  const { Core, Render, Cards, TEMPLATES, marked } = window;
  const $ = s => document.querySelector(s);
  const stage = $("#stage");

  /* ================= 状态与持久化 ================= */
  const STORE_KEY = "banxin.v9";
  const DEFAULTS = {
    md: null,
    platform: "wechat",
    theme: "light",
    mode: "canvas",
    device: "ip17",
    editorW: null,
    tab: {},
    wechat: { template: "bianjibu", tweaks: {}, favs: [], gScene: "全部", gTone: "all", keepTitle: false, captions: true, linkNotes: true, endMark: true, view: "phone", account: "", author: "", presets: [] },
    cards: { style: "paper", accent: null, cover: true, kicker: "", subtitle: "", handle: "" },
    note: { title: "", style: "plain", tags: null },
    x: { mode: "thread", numbering: true, name: "", handle: "" }
  };
  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!raw) return structuredClone(DEFAULTS);
      const s = structuredClone(DEFAULTS);
      Object.keys(raw).forEach(k => {
        s[k] = raw[k] && typeof raw[k] === "object" && !Array.isArray(raw[k]) && DEFAULTS[k] && typeof DEFAULTS[k] === "object"
          ? Object.assign({}, DEFAULTS[k], raw[k]) : raw[k];
      });
      return s;
    } catch (e) { return structuredClone(DEFAULTS); }
  }
  const S = load();
  let saveTimer = null;
  function save() {
    setSaved(false);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); setSaved(true); }
      catch (e) { setSaved(true, e && e.name === "QuotaExceededError" ? "未保存：浏览器存储已满" : "未保存：当前打开方式不允许本地存储"); }
    }, 350);
  }
  // 关页面 / 切走时立刻把未写入的改动存下，避免 350ms 防抖窗口里丢改动
  const flushSave = () => {
    if (!saveTimer) return;
    clearTimeout(saveTimer); saveTimer = null;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); } catch (e) {}
  };
  window.addEventListener("pagehide", flushSave);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });

  function setSaved(ok, msg) {
    const el = $("#stSaved");
    el.classList.toggle("pending", !ok);
    el.lastElementChild.textContent = msg || (ok ? "已保存" : "保存中…");
  }

  /* ================= 图片：IndexedDB ================= */
  const images = new Map(); // "img:<id>" / "obs:<文件名>" → dataURL
  const obsFiles = new Map(); // 关联的 Obsidian 附件：文件名 → File 或文件句柄
  const DIR_KEY = "dir:images"; // 记住的图片文件夹句柄（存在 IndexedDB）
  let savedDir = null, dirReady = false;
  const IDB = {
    db: null,
    open() {
      // 受限环境（隐私模式、部分预览器）里 IndexedDB 可能直接抛错：降级为仅本次会话保存图片
      // 另一个窗口占着连接时 open 可能一直挂起：最多等 1.5 秒，不阻塞启动
      return new Promise(resolve => {
        const timer = setTimeout(() => resolve(null), 1500);
        const done = v => { clearTimeout(timer); resolve(v); };
        try {
          if (!window.indexedDB) return done(null);
          const req = indexedDB.open("banxin", 1);
          req.onupgradeneeded = () => req.result.createObjectStore("images");
          req.onsuccess = () => {
            this.db = req.result;
            this.db.onversionchange = () => { this.db.close(); this.db = null; };
            done(this.db);
          };
          req.onerror = () => done(null);
          req.onblocked = () => done(null);
        } catch (e) { done(null); }
      });
    },
    tx(mode) { try { return this.db && this.db.transaction("images", mode).objectStore("images"); } catch (e) { return null; } },
    put(k, v) { const st = this.tx("readwrite"); if (st) try { st.put(v, k); } catch (e) {} },
    all() {
      return new Promise(resolve => {
        const st = this.tx("readonly");
        if (!st) return resolve([]);
        const out = [];
        const req = st.openCursor();
        req.onsuccess = () => { const c = req.result; if (c) { out.push([c.key, c.value]); c.continue(); } else resolve(out); };
        req.onerror = () => resolve(out);
      });
    }
  };
  const newId = () => Math.random().toString(36).slice(2, 8);

  function compress(file) {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = () => {
        const raw = reader.result;
        if (file.size < 400 * 1024 || /gif|svg/.test(file.type)) return resolve(raw);
        const img = new Image();
        img.onload = () => {
          const MAX = 1600;
          const r = Math.min(1, MAX / img.width);
          const w = Math.round(img.width * r), h = Math.round(img.height * r);
          const c = document.createElement("canvas");
          c.width = w; c.height = h;
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const out = c.toDataURL("image/jpeg", 0.9);
          resolve(out.length < raw.length ? out : raw);
        };
        img.onerror = () => resolve(raw);
        img.src = raw;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  const basename = p => decodeURIComponent(p).split(/[\\/]/).pop();
  function resolveImage(src) {
    if (src.startsWith("img://")) {
      const id = src.slice(6);
      const v = images.get("img:" + id);
      return v ? { src: v, embedded: true } : { unresolved: true, name: "图片 " + id + "（缓存已清除）" };
    }
    if (src.startsWith("sample://")) return { src: window.SAMPLE_IMAGES[src.slice(9)] || "", embedded: false, sample: true };
    if (/^data:/i.test(src)) return { src, embedded: true };
    if (/^https?:\/\//i.test(src)) return { src, remote: true };
    const name = src.startsWith("obsidian-image:") ? decodeURIComponent(src.slice(15)) : basename(src);
    const v = images.get("obs:" + name);
    if (v) return { src: v, embedded: true, name };
    if (obsFiles.has(name)) loadObs(name);
    return { unresolved: true, name };
  }
  const loading = new Set();
  async function loadObs(name) {
    if (loading.has(name)) return;
    loading.add(name);
    let f = obsFiles.get(name), data = null;
    try { if (f && f.getFile) f = await f.getFile(); data = f ? await compress(f) : null; } catch (e) { /* 文件被移走或权限失效 */ }
    loading.delete(name);
    if (!data) return;
    images.set("obs:" + name, data);
    IDB.put("obs:" + name, data);
    if (E) E.refreshImages();
    scheduleRender(true);
  }

  /* ================= 小工具 ================= */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === "class") el.className = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    kids.flat().forEach(k => k != null && el.append(k.nodeType ? k : document.createTextNode(k)));
    return el;
  }
  const icon = id => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("class", "i"); s.innerHTML = '<use href="#i-' + id + '"/>'; return s; };
  let toastTimer;
  function toast(msg, ms = 2400) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), ms);
  }
  function download(blob, name) {
    const a = h("a", { href: URL.createObjectURL(blob), download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const safeName = s => (s || "未命名").replace(/[\\/:*?"<>|\s]+/g, "-").slice(0, 40);
  async function copyRich(html, text) {
    try {
      await navigator.clipboard.write([new ClipboardItem({
        "text/html": new Blob([html], { type: "text/html" }),
        "text/plain": new Blob([text], { type: "text/plain" })
      })]);
      return true;
    } catch (e) {
      const box = h("div", { contenteditable: "true", style: "position:fixed;left:-9999px;top:0;" });
      box.innerHTML = html;
      document.body.appendChild(box);
      const r = document.createRange(); r.selectNodeContents(box);
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const ok = document.execCommand("copy");
      sel.removeAllRanges(); box.remove();
      return ok;
    }
  }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; }
    catch (e) {
      const ta = h("textarea", { style: "position:fixed;left:-9999px;" }); ta.value = text;
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand("copy"); ta.remove(); return ok;
    }
  }

  /* 对话框 */
  function dialog({ title, text, input, ok = "确定", cancel = "取消", danger }) {
    const mask = $("#dialog");
    const box = mask.firstElementChild;
    box.innerHTML = "";
    const field = input ? h("input", { class: "field", value: input.value || "", placeholder: input.placeholder || "", style: "margin-top:14px;width:100%;" }) : null;
    return new Promise(resolve => {
      const close = v => { mask.classList.remove("show"); document.removeEventListener("keydown", onKey, true); resolve(v); };
      const okBtn = h("button", { class: "btn ink", onclick: () => close(field ? field.value.trim() : true) }, ok);
      if (danger) okBtn.style.background = "var(--err)";
      box.append(h("h3", null, title), text ? h("p", null, text) : "", field || "",
        h("div", { class: "acts" }, cancel ? h("button", { class: "btn line", onclick: () => close(null) }, cancel) : "", okBtn));
      const onKey = e => { if (e.key === "Escape") { e.preventDefault(); close(null); } if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); okBtn.click(); } };
      document.addEventListener("keydown", onKey, true);
      mask.classList.add("show");
      mask.onclick = e => { if (e.target === mask) close(null); };
      setTimeout(() => (field || okBtn).focus(), 30);
    });
  }

  /* ================= 计算 ================= */
  let model = null;
  function compute() {
    const sem = Render.semantic(S.md, { resolveImage });
    const pre = sem.pre;
    const tokens = marked.lexer(pre.md, { gfm: true });
    const blocks = Core.toBlocks(pre.md);
    const title = Core.articleTitle(pre.md, pre.data);
    const fmTags = Core.frontmatterTags(pre.data);
    const text = blocks.map(b => b.text || (b.items || []).map(i => i.text).join("") || (b.rows || []).flat().join("")).join("");
    return {
      sem, pre, blocks, title, fmTags, tokens,
      links: Core.linksIn(tokens),
      images: sem.images.filter(i => !i.sample),
      words: Core.countWords(text)
    };
  }

  /* ================= 渲染调度 ================= */
  let renderTimer = null;
  function scheduleRender(force) {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => render(force), 160);
  }
  function render(force) {
    model = compute();
    updateStatus();
    updateDocTitle();
    VIEWS[S.platform].render(force);
    renderChecks();
  }
  function updateDocTitle() {
    document.title = (model.title ? model.title + " · " : "") + "轻排";
  }
  function updateStatus() {
    $("#stWords").textContent = model.words.toLocaleString();
    $("#stMin").textContent = Math.max(1, Math.round(model.words / 400));
    const miss = model.images.filter(i => i.unresolved).length;
    const n = model.images.length;
    $("#stImgs").innerHTML = n ? n + " 张图" + (miss ? ' · <span style="color:var(--err)">' + miss + " 张缺失</span>" : "") : "";
  }

  /* ================= 平台视图 ================= */
  const tplById = id => TEMPLATES.find(t => t.id === id) || TEMPLATES[0];
  const tweaksOf = id => Object.assign({}, tplById(id).defaults, S.wechat.tweaks[id] || {});
  function wechatTweaks() {
    const w = S.wechat;
    return Object.assign(tweaksOf(w.template), { keepTitle: w.keepTitle, captions: w.captions, linkNotes: w.linkNotes, endMark: w.endMark, imgAlign: w.imgAlign || "center", sidePad: w.sidePad == null ? 8 : w.sidePad, imgRadius: w.imgRadius || 0, imgShadow: w.imgShadow || 0, imgBorder: w.imgBorder ? (w.imgBorderColor || "#d9d6cf") : "" });
  }
  function markMissing(rootEl) {
    rootEl.querySelectorAll("img[data-unresolved]").forEach(img => {
      const box = h("div", { class: "img-miss", "data-deco": "1", "data-preview-only": "1", contenteditable: "false" },
        h("b", null, img.dataset.unresolved), h("span", null, "图片没带过来 · "),
        h("u", null, savedDir && !dirReady ? "点这里，允许读取「" + savedDir.name + "」文件夹" : "点这里选图片所在的文件夹"), h("span", null, "，文中缺的图会一次补齐"));
      img.before(box);
    });
  }

  let article = null;
  const VIEWS = {
    wechat: {
      label: "公众号",
      tabs: [["style", "版式"], ["adjust", "调整"], ["check", "检查"]],
      primary: { icon: "copy", text: "复制到公众号", run: copyWechat },
      render() {
        ensureCanvas();
        updateHead();
        article.replaceChildren(...model.sem.el.childNodes);
        restyle();
        focusIfEmpty();
      }
    },
    xlsh: cardsView("xlsh", "小绿书"),
    xhs: cardsView("xhs", "小红书"),
    zhihu: {
      label: "知乎",
      tabs: [["zhihu", "发布"], ["check", "检查"]],
      primary: { icon: "copy", text: "复制到知乎", run: copyZhihu },
      secondary: { text: "下载 .md", run: () => download(new Blob([Render.zhihuMarkdown(S.md)], { type: "text/markdown" }), safeName(model.title) + "-知乎.md") },
      render() {
        ensureCanvas();
        updateHead();
        article.replaceChildren(...model.sem.el.childNodes);
        restyle();
        focusIfEmpty();
      }
    },
    x: {
      label: "X",
      tabs: [["x", "设置"], ["check", "检查"]],
      get primary() {
        const m = S.x.mode;
        return { icon: "copy", text: m === "thread" ? "复制全部" : m === "long" ? "复制长帖" : "复制文章", run: copyX };
      },
      tools() {
        return seg([["thread", "串推"], ["long", "长帖"], ["article", "文章"]], S.x.mode, v => { S.x.mode = v; save(); syncTopActions(); render(); renderInspector(); });
      },
      render() {
        stage.innerHTML = "";
        const name = S.x.name || "你的名字";
        const handle = "@" + (S.x.handle || "handle").replace(/^@/, "");
        const ava = (S.x.name || "轻").slice(0, 1);
        if (S.x.mode === "article") {
          const body = h("div");
          body.append(...xArticleNode().childNodes);
          stage.append(h("article", { class: "zh x-article" }, h("h1", { class: "zh-title" }, model.title || "未命名文章"), body));
          return;
        }
        const posts = S.x.mode === "thread" ? xThread() : [{ text: xLong(), length: Core.xLength(xLong()), images: model.images.map(i => i.name || "图片").slice(0, 4) }];
        const max = S.x.mode === "thread" ? 280 : 25000;
        const list = h("div", { class: "thread" });
        posts.forEach((p, i) => {
          const pct = Math.min(1, p.length / max);
          const C = 2 * Math.PI * 8;
          const ring = h("span", { html: '<svg class="ring' + (p.length > max ? " over" : pct > 0.9 ? " warn" : "") + '" viewBox="0 0 20 20"><circle class="bg" cx="10" cy="10" r="8"/><circle class="fg" cx="10" cy="10" r="8" stroke-dasharray="' + C + '" stroke-dashoffset="' + C * (1 - pct) + '" transform="rotate(-90 10 10)"/></svg>' });
          list.append(h("div", { class: "post" + (i < posts.length - 1 ? " chain" : "") },
            h("div", { class: "ava" }, ava),
            h("div", null,
              h("div", { class: "who" }, h("b", null, name), h("span", null, handle)),
              S.x.mode === "long" ? xLongBody(p.text) : h("div", { class: "txt" }, p.text),
              p.images && p.images.length ? h("div", { class: "imgs" }, p.images.map(a => h("span", null, "图 · " + a))) : "",
              h("div", { class: "foot" }, ring, h("span", { class: "meter" + (p.length > max ? " over" : "") }, p.length.toLocaleString() + " / " + max.toLocaleString()),
                h("span", { class: "grow" }),
                h("button", { class: "btn small", onclick: async () => { await copyText(p.text); toast(posts.length > 1 ? "第 " + (i + 1) + " 条已复制" : "已复制"); } }, icon("copy"), "复制")))));
        });
        stage.append(list);
      }
    }
  };

  // 长帖：时间线上只显示前 280 加权字符，之后要点「显示更多」才展开——在预览里标出这条线
  function xLongBody(text) {
    if (Core.xLength(text) <= 280) return h("div", { class: "txt" }, text);
    let lo = 0, hi = text.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (Core.xLength(text.slice(0, mid)) <= 280) lo = mid; else hi = mid - 1; }
    return h("div", null, h("div", { class: "txt" }, text.slice(0, lo)),
      h("div", { class: "x-more" }, h("span", null, "显示更多 · 时间线上只显示到这里")),
      h("div", { class: "txt x-rest" }, text.slice(lo)));
  }
  function cardsView(id, label) {
    return {
      label,
      tabs: [["cards", "卡片"], ["note", "正文"], ["check", "检查"]],
      primary: { icon: "down", text: "导出卡片", run: exportCards },
      secondary: { text: "复制正文", run: async () => { await copyText(noteBody()); toast("正文已复制"); } },
      render() { buildCards(); }
    };
  }

  /* ---------- 预览里拖拽调整图片大小 ---------- */
  function applyWidthToPreview(index, width) {
    if (!article) return;
    article.querySelectorAll('img[data-img="' + index + '"]').forEach(img => {
      if (width) { img.dataset.w = width; img.style.width = width + "px"; }
      else { delete img.dataset.w; img.style.width = ""; }
    });
  }
  /* 块删除按钮：鼠标移到引用框、提示框、代码块、表格上，右下角出现垃圾桶，点一下整块删掉。
     块（外框）和里面的文字是一体的：删字只删字，删块用这个按钮。 */
  const BOX_SEL = ":scope > blockquote, :scope > pre, :scope > table";
  // 鼠标 / 光标所在的框：取最外层的引用、代码块、表格（不要求它直接在正文这一层，粘贴来的内容可能多包了一层）
  function boxOf(art, node) {
    let x = node && (node.nodeType === 3 ? node.parentNode : node);
    if (!x || !art.contains(x)) return null;
    let box = null;
    for (; x && x !== art; x = x.parentNode) if (x.nodeType === 1 && /^(BLOCKQUOTE|PRE|TABLE)$/.test(x.tagName)) box = x;
    return box;
  }
  function bindBlockDelete(paper, art) {
    const btn = h("button", { class: "blk-del", "data-preview-only": "1", type: "button", title: "删除这一块", "aria-label": "删除这一块" }, icon("trash"), h("span", null, "删除"));
    paper.appendChild(btn);
    let cur = null;
    const place = () => {
      if (!cur || !art.contains(cur)) { btn.classList.remove("show"); cur = null; return; }
      btn.classList.add("show"); // 先显示再量宽度（隐藏时宽度是 0）
      const r = cur.getBoundingClientRect(), p = paper.getBoundingClientRect();
      btn.style.left = r.right - p.left - btn.offsetWidth - 8 + "px";
      btn.style.top = r.bottom - p.top - btn.offsetHeight - 8 + "px";
    };
    // 鼠标在哪个框上就跟到哪个框；鼠标不在框上时，光标所在的框也显示按钮
    const caretBox = () => { const s = getSelection(); return s.rangeCount ? boxOf(art, s.anchorNode) : null; };
    const show = b => { cur = b; if (b) place(); else btn.classList.remove("show"); };
    paper.addEventListener("mousemove", e => {
      if (e.target === btn || btn.contains(e.target)) return;
      show(boxOf(art, e.target) || caretBox());
    });
    paper.addEventListener("mouseleave", () => show(caretBox()));
    document.addEventListener("selectionchange", () => { if (document.activeElement === art) show(caretBox() || (cur && art.contains(cur) && cur.matches(":hover") ? cur : null)); });
    btn.addEventListener("mousedown", e => e.preventDefault());
    btn.addEventListener("click", () => {
      if (!cur) return;
      const next = cur.nextElementSibling;
      cur.remove(); cur = null; btn.classList.remove("show");
      if (!art.querySelector(":scope > *:not([data-deco])")) { const p = document.createElement("p"); p.appendChild(document.createElement("br")); art.appendChild(p); }
      if (next && art.contains(next)) placeCaretStart(next);
      scheduleCanvasSync(true);
      toast("已删除这一块，⌘Z 可撤回", 1600);
    });
    stage.addEventListener("scroll", place);
  }
  function placeCaretStart(el) {
    const t = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => n.parentElement.closest("[data-deco]") ? 2 : 1 }).nextNode();
    const r = document.createRange();
    if (t) r.setStart(t, 0); else r.setStart(el, 0);
    r.collapse(true); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  }
  // 光标是否在某个元素内容的最开头 / 最末尾（版式装饰不算内容）
  function caretAtEdge(el, atEnd) {
    const sel = getSelection();
    if (!sel.rangeCount || !sel.isCollapsed || !el.contains(sel.anchorNode)) return false;
    const r = document.createRange();
    if (atEnd) { r.setStart(sel.anchorNode, sel.anchorOffset); r.setEnd(el, el.childNodes.length); }
    else { r.setStart(el, 0); r.setEnd(sel.anchorNode, sel.anchorOffset); }
    const f = r.cloneContents();
    f.querySelectorAll("[data-deco],[data-preview-only]").forEach(x => x.remove());
    return !f.textContent.replace(/[\s\u200b]/g, "") && !(f.querySelector && f.querySelector("img"));
  }
  function bindPreviewResize(paper, art) {
    const float = h("div", { class: "rz-float", "data-preview-only": "1" });
    paper.appendChild(float);
    let current = null, handle = null;
    const place = () => {
      if (!current) return;
      const r = current.getBoundingClientRect(), p = paper.getBoundingClientRect();
      Object.assign(float.style, { left: r.left - p.left + "px", top: r.top - p.top + "px", width: r.width + "px", height: r.height + "px" });
    };
    const show = img => {
      if (current !== img) {
        current = img;
        float.replaceChildren();
        const idx = +img.dataset.img;
        handle = window.Resize.attach(float, {
          img, centered: () => (S.wechat.imgAlign || "center") === "center", max: () => art.clientWidth, onLive: place,
          onCommit: w => { applyWidthToPreview(idx, w); place(); handle.sync(); commitImageWidth(idx, w); }
        });
      }
      place();
      float.classList.add("show");
    };
    const hide = () => { if (!float.classList.contains("rz-active")) { float.classList.remove("show"); current = null; } };
    art.addEventListener("mouseover", e => {
      const img = e.target.closest && e.target.closest("img[data-img]");
      if (img && !img.dataset.unresolved) show(img);
    });
    paper.addEventListener("mousemove", e => {
      if (!current || float.classList.contains("rz-active")) return;
      if (e.target === current || float.contains(e.target)) return;
      hide();
    });
    paper.addEventListener("mouseleave", hide);
  }

  /* ================= 画布：电脑端预览即编辑 ================= */
  const todayText = () => { const d = new Date(); return d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日"; };
  const isCanvasPlatform = () => S.platform === "wechat" || S.platform === "zhihu";
  function ensureCanvas() {
    const kind = S.platform;
    if (article && stage.contains(article) && article.dataset.kind === kind) return;
    stage.innerHTML = "";
    let paper, title;
    if (kind === "zhihu") {
      paper = h("article", { class: "zh canvas" });
      title = h("h1", { class: "zh-title", id: "wxTitle", contenteditable: "true", spellcheck: "false", "aria-label": "文章标题" });
      paper.append(title, article = h("section", { contenteditable: "true", spellcheck: "false", "aria-label": "文章正文，可直接编辑" }));
    } else {
      paper = h("div", { class: "paper canvas" });
      title = h("div", { class: "wx-title", id: "wxTitle", contenteditable: "true", spellcheck: "false", "aria-label": "文章标题" });
      paper.append(
        h("div", { class: "wx-head" }, title,
          h("div", { class: "wx-meta" }, h("span", { id: "wxAuthor" }), h("span", { class: "acct", id: "wxAcct" }), h("span", { id: "wxDate" }))),
        article = h("section", { contenteditable: "true", spellcheck: "false", "aria-label": "文章正文，可直接编辑" }));
    }
    article.dataset.kind = kind;
    stage.appendChild(paper);
    bindPreviewResize(paper, article);
    bindBlockDelete(paper, article);
    bindCanvas(article, title);
    stage.onscroll = syncPhoneScroll;
  }
  function updateHead() {
    const t = $("#wxTitle");
    if (t && document.activeElement !== t) t.textContent = model.title || "";
    if (!$("#wxAuthor")) return;
    $("#wxAuthor").textContent = S.wechat.author || "";
    $("#wxAuthor").hidden = !S.wechat.author;
    $("#wxAcct").textContent = S.wechat.account || "你的公众号";
    $("#wxDate").textContent = todayText();
  }

  let canvasTimer = null;
  let undoStack = [], redoStack = [];
  function storeDataImage(data) {
    const id = newId();
    images.set("img:" + id, data);
    IDB.put("img:" + id, data);
    return "img://" + id;
  }
  function scheduleCanvasSync(now) { clearTimeout(canvasTimer); canvasTimer = setTimeout(syncCanvas, now ? 0 : 500); }
  /* 画布改动 → 规整 → 重新套版式（保住光标）→ 写回 Markdown → 手机预览、字数、检查 */
  // 画布里如果有一段文字其实是图片代码（如 ![](img://abc "bxi:0:")，旧版本标题乱码留下的），换回真正的图片
  const IMG_TEXT = /!\[([^\]]*)\]\(((?:img:\/\/|obsidian-image:|https?:\/\/|data:image\/)[^\s)]+)(?:\s+"[^"]*")?\)/;
  function healImageText(rootEl) {
    const w = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, { acceptNode: t => IMG_TEXT.test(t.textContent) && !t.parentElement.closest("pre,code,[data-deco]") ? 1 : 2 });
    const hits = []; let t; while ((t = w.nextNode())) hits.push(t);
    hits.forEach(node => {
      let rest = node.textContent; const frag = document.createDocumentFragment(); let m;
      while ((m = IMG_TEXT.exec(rest))) {
        if (m.index) frag.appendChild(document.createTextNode(rest.slice(0, m.index)));
        const img = document.createElement("img");
        const r = resolveImage(m[2]);
        img.dataset.key = m[2]; img.setAttribute("alt", m[1]); img.setAttribute("src", r.src || "");
        if (r.unresolved) img.dataset.unresolved = r.name || "1";
        frag.appendChild(img);
        rest = rest.slice(m.index + m[0].length);
      }
      if (rest) frag.appendChild(document.createTextNode(rest));
      node.replaceWith(frag);
    });
    return hits.length;
  }
  function syncCanvas() {
    clearTimeout(canvasTimer);
    canvasTimer = null;
    if (!article || !stage.contains(article)) return;
    healImageText(article);
    const caret = Canvas.saveCaret(article);
    Canvas.normalize(article);
    restyle();
    if (document.activeElement === article) Canvas.restoreCaret(article, caret);
    const md = Canvas.toMarkdown(article, S.md);
    if (md === S.md) return;
    undoStack.push(S.md);
    if (undoStack.length > 100) undoStack.shift();
    redoStack = [];
    S.md = md; save();
    // 标题等信息来自重新计算后的 model，手机预览要在这之后再画一次，否则总慢一步
    model = compute(); updateStatus(); updateDocTitle(); renderPhone(); renderChecks();
  }
  function undo() {
    if (canvasTimer) syncCanvas();
    if (!undoStack.length) return toast("没有可以撤销的修改", 1200);
    redoStack.push(S.md); S.md = undoStack.pop(); save(); render(true);
  }
  function redo() {
    if (!redoStack.length) return;
    undoStack.push(S.md); S.md = redoStack.pop(); save(); render(true);
  }
  function curBlock() {
    const sel = getSelection();
    if (!sel.rangeCount || !article.contains(sel.anchorNode)) return null;
    let n = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode;
    while (n && n.parentNode !== article) n = n.parentNode;
    return n;
  }
  function placeCaretEnd(el) {
    const r = document.createRange(); r.selectNodeContents(el); r.collapse(false);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
  }
  function insertBlocks(nodes) {
    if (!nodes.length) return;
    const b = curBlock();
    const last = nodes[nodes.length - 1];
    const frag = document.createDocumentFragment();
    nodes.forEach(n => frag.appendChild(n));
    if (!b) article.appendChild(frag);
    else if (!b.textContent.trim() && !b.querySelector("img")) b.replaceWith(frag);
    else b.after(frag);
    if (last.nodeType === 1) placeCaretEnd(last);
  }
  function mdToNodes(md) {
    const sem = Render.semantic(md, { resolveImage });
    return [...sem.el.childNodes].filter(n => !(n.nodeType === 3 && !n.textContent.trim()));
  }
  /* 跨块删除，按「块」来删，不让浏览器默认行为把格式弄乱：
     - 选区从某一块（引用框、标题等）的开头选起：这几块整块删掉；
       最后一块如果只选了一部分，就只删选中的字、保持原来的格式（不会被吸进上面的引用框）。
     - 选区的起点或终点落在版式装饰上（如「批注」标签）或从标题拖进正文：按所在块的开头 / 结尾算。
     - 从一块中间开始选：交给浏览器正常合并。 */
  function deleteWholeLeadingBlocks(art) {
    const sel = getSelection();
    if (!sel.rangeCount) return false;
    const r = sel.getRangeAt(0).cloneRange();
    if (!art.contains(r.startContainer)) { if (!art.contains(r.endContainer)) return false; r.setStart(art, 0); }
    if (!art.contains(r.endContainer)) r.setEnd(art, art.childNodes.length);
    const topAt = (c, o) => {
      if (c === art) return art.childNodes[Math.min(o, art.childNodes.length - 1)] || null;
      let x = c.nodeType === 3 ? c.parentNode : c;
      while (x && x.parentNode !== art) x = x.parentNode;
      return x;
    };
    const a = topAt(r.startContainer, r.startOffset), b = topAt(r.endContainer, Math.max(0, r.endOffset - 1));
    if (!a || !b || a.nodeType !== 1 || b.nodeType !== 1) return false;
    const blank = frag => { frag.querySelectorAll("[data-deco],[data-preview-only]").forEach(x => x.remove()); return !frag.textContent.replace(/[\s\u200b]/g, "") && !frag.querySelector("img,hr,table"); };
    const before = document.createRange();
    if (r.startContainer === art) before.setStart(a, 0), before.setEnd(a, 0); else { before.setStart(a, 0); before.setEnd(r.startContainer, r.startOffset); }
    const after = document.createRange();
    if (r.endContainer === art) after.setStart(b, b.childNodes.length), after.setEnd(b, b.childNodes.length); else { after.setStart(r.endContainer, r.endOffset); after.setEnd(b, b.childNodes.length); }
    const headBlank = blank(before.cloneContents()), tailBlank = blank(after.cloneContents());
    if (!headBlank) return false;
    if (a === b && !tailBlank) return false; // 同一块里只删一部分：浏览器能处理
    let caretAt;
    if (tailBlank) {
      // a 到 b 整块删掉（连同上面的装饰）
      const gone = [];
      for (let x = a; x; x = x.nextSibling) { gone.push(x); if (x === b) break; }
      let next = b.nextElementSibling;
      while (next && (next.dataset.deco || next.style.display === "none")) next = next.nextElementSibling;
      const anchor = b.nextSibling;
      gone.forEach(x => x.remove());
      caretAt = next;
      if (!caretAt) { caretAt = document.createElement("p"); caretAt.appendChild(document.createElement("br")); art.insertBefore(caretAt, anchor && anchor.parentNode === art ? anchor : null); }
    } else {
      const del = document.createRange();
      del.setStartBefore(a); del.setEnd(r.endContainer, r.endOffset);
      del.deleteContents();
      b.querySelectorAll("[data-deco]").forEach(x => x.remove());
      caretAt = b;
      if (!b.textContent.replace(/[\s\u200b]/g, "") && !b.querySelector("img,hr,table")) {
        const p = document.createElement("p"); p.appendChild(document.createElement("br"));
        b.replaceWith(p); caretAt = p;
      }
    }
    const c = document.createRange();
    const firstText = document.createTreeWalker(caretAt, NodeFilter.SHOW_TEXT, { acceptNode: t => t.parentElement.closest("[data-deco]") ? 2 : 1 }).nextNode();
    if (firstText) c.setStart(firstText, 0); else c.setStart(caretAt, 0);
    c.collapse(true); art.focus(); sel.removeAllRanges(); sel.addRange(c);
    scheduleCanvasSync(true);
    return true;
  }
  /* 框（引用、提示、代码块、表格）和前后段落不合并：
     - 在框下面那段的开头按退格：框是空的就删掉框；不是空的就不动（以前会把这段吸进框里）。
     - 在框里最后按 Delete：不把下面那段吸进来。 */
  function guardBoxMerge(art, forward) {
    const sel = getSelection();
    const blk = (() => { let x = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentNode : sel.anchorNode); while (x && x.parentNode !== art) x = x.parentNode; return x && x.parentNode === art ? x : null; })();
    if (!blk) return false;
    const sib = el => { let x = forward ? el.nextElementSibling : el.previousElementSibling; while (x && (x.dataset.deco || x.style.display === "none")) x = forward ? x.nextElementSibling : x.previousElementSibling; return x; };
    if (!forward) {
      if (/^(BLOCKQUOTE|PRE|TABLE)$/.test(blk.tagName) || !caretAtEdge(blk, false)) return false;
      const prev = sib(blk);
      if (!prev || !/^(BLOCKQUOTE|PRE|TABLE)$/.test(prev.tagName)) return false;
      const c = prev.cloneNode(true); c.querySelectorAll("[data-deco],[data-role=callout-title]").forEach(x => x.remove());
      if (!c.textContent.replace(/[\s\u200b]/g, "") && !c.querySelector("img")) { prev.remove(); scheduleCanvasSync(true); }
      return true;
    }
    const box = /^(BLOCKQUOTE|PRE|TABLE)$/.test(blk.tagName) ? blk : null;
    if (!box || !caretAtEdge(box, true)) return false;
    const next = sib(box);
    return !!next; // 有下一段就不合并
  }
  // 选区是否盖住了整篇正文（按非空白字符数比较，兼容浏览器把选区收进首尾文字节点的情况）
  function isAllSelected(art) {
    const sel = getSelection();
    if (!sel.rangeCount || !art.contains(sel.anchorNode) && sel.anchorNode !== art) return false;
    const strip = t => t.replace(/[\s\u200b]/g, "").length;
    return strip(sel.getRangeAt(0).toString()) >= strip(art.textContent);
  }
  function bindCanvas(art, titleEl) {
    art.addEventListener("input", e => {
      // Markdown 快捷输入放到输入事件之后执行（编辑命令不能嵌套在输入事件里）
      if (e.inputType === "insertText" && (e.data === " " || e.data === "`")) setTimeout(() => { if (Canvas.shortcut(art)) scheduleCanvasSync(true); }, 0);
      scheduleCanvasSync();
    });
    art.addEventListener("paste", onCanvasPaste);
    // 光标移开后，留下的空标题 / 空引用马上清掉（不用等下一次输入）
    const sweepBlank = () => {
      const blank = [...art.querySelectorAll(":scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > blockquote")].some(el => el.dataset.role !== "title" && Canvas.isBlank(el) && !el.contains(getSelection().anchorNode));
      if (blank) scheduleCanvasSync(true);
    };
    art.addEventListener("mouseup", () => setTimeout(sweepBlank, 0));
    art.addEventListener("keyup", e => { if (/^(Arrow|Page|Home|End)/.test(e.key)) sweepBlank(); });
    art.addEventListener("keydown", e => {
      const mod = e.metaKey || e.ctrlKey, k = e.key.toLowerCase();
      if (mod && k === "z") { e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (mod && k === "y") { e.preventDefault(); redo(); }
      else if (mod && k === "k") { e.preventDefault(); CFMT.link(); }
      else if (mod && k === "b" && !e.shiftKey) { e.preventDefault(); CFMT.bold(); }
      else if (mod && k === "i" && !e.shiftKey) { e.preventDefault(); CFMT.italic(); }
      else if (mod && e.shiftKey && k === "h") { e.preventDefault(); CFMT.mark(); }
      else if (mod && k === "a") {
        // 全选：自己选中整篇正文（浏览器默认的全选会被版式装饰打断）
        e.preventDefault();
        const r = document.createRange(); r.selectNodeContents(art);
        const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      }
      else if ((e.key === "Backspace" || e.key === "Delete") && !getSelection().isCollapsed && isAllSelected(art)) {
        // 全选后删除：清空全文，留一个空段落（可以用撤销找回）
        e.preventDefault();
        clearTimeout(canvasTimer); canvasTimer = null;
        undoStack.push(S.md);
        if (undoStack.length > 100) undoStack.shift();
        redoStack = [];
        S.md = ""; save(); render(true);
      }
      else if ((e.key === "Backspace" || e.key === "Delete") && !getSelection().isCollapsed && deleteWholeLeadingBlocks(art)) e.preventDefault();
      else if ((e.key === "Backspace" || e.key === "Delete") && getSelection().isCollapsed && guardBoxMerge(art, e.key === "Delete")) e.preventDefault();
      else if (e.key === "Backspace" && getSelection().isCollapsed) {
        // 空标题 / 空引用里按退格：变回普通段落，版式装饰一起去掉
        const b = curBlock();
        if (b && /^(H[1-4]|BLOCKQUOTE)$/.test(b.tagName) && b.dataset.role !== "title" && Canvas.isBlank(b)) {
          e.preventDefault();
          const p = document.createElement("p");
          p.appendChild(document.createElement("br"));
          b.replaceWith(p); placeCaretEnd(p);
          scheduleCanvasSync(true);
        }
      }
      else if (e.key === "Enter" && !e.shiftKey) {
        const b = curBlock();
        if (b && b.tagName === "P" && /^(-{3,}|\*{3,})$/.test(b.textContent.trim())) {
          e.preventDefault();
          const hr = document.createElement("hr"), p = document.createElement("p");
          p.appendChild(document.createElement("br"));
          b.replaceWith(hr); hr.after(p); placeCaretEnd(p);
          scheduleCanvasSync(true);
        }
      }
    });
    titleEl.addEventListener("input", () => {
      let h1 = art.querySelector("[data-role=title]") || art.querySelector("h1");
      if (!h1) { h1 = document.createElement("h1"); h1.dataset.role = "title"; art.prepend(h1); }
      h1.textContent = titleEl.textContent.trim();
      scheduleCanvasSync();
    });
    titleEl.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); art.focus(); }
      else if ((e.key === "Backspace" || e.key === "Delete") && !getSelection().isCollapsed && art.contains(getSelection().focusNode) && deleteWholeLeadingBlocks(art)) e.preventDefault();
    });
    titleEl.addEventListener("paste", e => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData.getData("text/plain") || "").replace(/\s+/g, " ")); });
  }

  /* 粘贴：富文本只留结构、Markdown 直接排版、代码自动成块、base64 图片入库 */
  function onCanvasPaste(e) {
    const dt = e.clipboardData;
    if (!dt) return;
    const html = dt.getData("text/html"), text = dt.getData("text/plain");
    const files = [...dt.files].filter(f => f.type.startsWith("image/"));
    e.preventDefault();
    if (files.length && !text.trim()) { insertImages(files); return; }
    let md = null;
    const fromCodeEditor = html && /white-space:\s*pre|monospace|Menlo|Consolas|vscode/i.test(html) && /\n/.test(text) && !/<(h[1-6]|li|table|img)\b/i.test(html);
    if (fromCodeEditor) md = "```\n" + text.replace(/\n$/, "") + "\n```";
    else if (html && html.trim()) {
      const box = document.createElement("div");
      box.innerHTML = Canvas.sanitizeHtml(html, src => (/^data:image\//i.test(src) ? storeDataImage(src) : src));
      const rich = box.querySelector("img,h1,h2,h3,h4,ul,ol,pre,table,blockquote,strong,em,a,mark,code") || box.children.length > 1;
      if (rich && !Canvas.looksLikeMarkdown(text)) md = Canvas.toMarkdown(box, "");
    }
    if (md == null && text) {
      if (Canvas.looksLikeMarkdown(text) || /\n\s*\n/.test(text) || /data:image\//.test(text)) md = Canvas.extractDataImages(text, storeDataImage);
      else { document.execCommand("insertText", false, text); return; }
    }
    if (md == null) return;
    const nodes = mdToNodes(md);
    if (nodes.length === 1 && nodes[0].tagName === "P") {
      const sel = getSelection();
      if (sel.rangeCount) {
        const r = sel.getRangeAt(0);
        r.deleteContents();
        const kids = [...nodes[0].childNodes];
        const frag = document.createDocumentFragment();
        kids.forEach(k => frag.appendChild(k));
        r.insertNode(frag);
        if (kids.length) { r.setStartAfter(kids[kids.length - 1]); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); }
      }
    } else insertBlocks(nodes);
    scheduleCanvasSync(true);
    if (nodes.length > 3) toast(S.platform === "zhihu" ? "已按知乎样式排好，可以直接在上面改" : "已按「" + tplById(S.wechat.template).name + "」排好，可以直接在上面改");
  }

  /* 加粗 / 斜体开关：自己判断「选中的字是不是全都已经加粗」。
     浏览器自带的命令只看选区开头那个字：开头落在「批注」「NOTE 01」这类装饰或标题上时，
     它会以为没加粗、再加一次，所以全选后取消不了。 */
  let lastToggle = null;
  function toggleInline(tags, cmd) {
    article.focus();
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed || !article.contains(sel.getRangeAt(0).commonAncestorContainer)) return exec(cmd);
    const r = sel.getRangeAt(0);
    const inTag = n => { for (let x = n.parentNode; x && x !== article; x = x.parentNode) if (tags.includes(x.tagName)) return x; return null; };
    const texts = [];
    const w = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, { acceptNode: t => {
      if (!r.intersectsNode(t) || !t.textContent.trim()) return 2;
      const el = t.parentElement;
      if (el.closest("[data-deco],[data-preview-only],h1,h2,h3,h4,th,pre,code")) return 2;
      for (let x = el; x && x !== article; x = x.parentNode) if (x.style && x.style.display === "none") return 2;
      return 1;
    } });
    let t; while ((t = w.nextNode())) texts.push(t);
    if (!texts.length) return;
    // 判断「现在算不算已经加粗」：
    //  1. 上一次就是对同一段选区按的加粗 → 这次一定是取消（点一下加、再点一下去，最符合直觉）；
    //  2. 否则按字数算：选中的正文里九成以上已经加粗 → 取消；其余情况 → 全部加粗。
    //     不要求「每一个字都在加粗标签里」，避免个别零碎文字（脚注号、图片说明等）没被浏览器加上，导致永远判断成「没加粗」。
    const pos = Canvas.saveCaret(article);
    const same = lastToggle && lastToggle.cmd === cmd && pos && lastToggle.start === pos.start && lastToggle.end === pos.end;
    let total = 0, on = 0;
    texts.forEach(x => { const n = x.textContent.replace(/\s/g, "").length; total += n; if (inTag(x)) on += n; });
    const allOn = same ? lastToggle.on : on >= total * 0.9;
    if (!allOn) {
      // 加上：浏览器若误判为「已加粗」会先去掉，再执行一次就全部加上
      if (document.queryCommandState(cmd)) document.execCommand(cmd);
      document.execCommand(cmd);
      lastToggle = pos && { cmd, on: true, start: pos.start, end: pos.end };
      return scheduleCanvasSync(true);
    }
    lastToggle = pos && { cmd, on: false, start: pos.start, end: pos.end };
    // 去掉：在选区两端放标记，把跨端点的标签拆开，中间的整段拆壳
    const mark = () => { const m = document.createElement("span"); m.dataset.mark = "1"; return m; };
    const m1 = mark(), m2 = mark();
    const re = r.cloneRange(); re.collapse(false); re.insertNode(m2);
    const rs = r.cloneRange(); rs.collapse(true); rs.insertNode(m1);
    const splitAt = (m, keepBefore) => {
      for (let S = inTag(m); S; S = inTag(m)) {
        const tail = document.createRange(); tail.setStartAfter(m); tail.setEnd(S, S.childNodes.length);
        const frag = tail.extractContents();
        if (keepBefore) { const S2 = S.cloneNode(false); S2.append(frag); S.after(m); m.after(S2); }
        else { S.after(m); m.after(frag); }
      }
    };
    splitAt(m2, true);   // 结尾之后的部分保持原样
    splitAt(m1, false);  // 开头之后（选中的部分）拆出来
    const mid = document.createRange(); mid.setStartAfter(m1); mid.setEndBefore(m2);
    [...article.querySelectorAll(tags.join(","))].filter(el => mid.intersectsNode(el)).forEach(el => el.replaceWith(...el.childNodes));
    const back = document.createRange(); back.setStartAfter(m1); back.setEndBefore(m2);
    m1.remove(); m2.remove();
    sel.removeAllRanges(); sel.addRange(back);
    scheduleCanvasSync(true);
  }

  /* 画布上的格式按钮 */
  let savedRange = null;
  function keepRange() { const sel = getSelection(); savedRange = sel.rangeCount && article && article.contains(sel.anchorNode) ? sel.getRangeAt(0).cloneRange() : null; }
  function backRange() { if (!savedRange) return; article.focus(); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(savedRange); }
  function exec(cmd, val) { article.focus(); document.execCommand(cmd, false, val); scheduleCanvasSync(true); }
  function toggleBlock(tag) {
    article.focus();
    const sel = getSelection();
    const n = sel.anchorNode && (sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode);
    const cur = n && n.closest && n.closest("h1,h2,h3,h4,p,blockquote,pre");
    document.execCommand("formatBlock", false, cur && cur.tagName === tag ? "p" : tag.toLowerCase());
    scheduleCanvasSync(true);
  }
  const CFMT = {
    h2: () => toggleBlock("H2"),
    h3: () => toggleBlock("H3"),
    bold: () => toggleInline(["STRONG", "B"], "bold"),
    italic: () => toggleInline(["EM", "I"], "italic"),
    mark: () => {
      const sel = getSelection();
      if (!sel.rangeCount || sel.isCollapsed || !article.contains(sel.anchorNode)) return toast("先选中要高亮的文字", 1400);
      const r = sel.getRangeAt(0);
      const m = document.createElement("mark");
      m.appendChild(r.extractContents());
      r.insertNode(m);
      scheduleCanvasSync(true);
    },
    link: async () => {
      keepRange();
      const url = await dialog({ title: "插入链接", input: { placeholder: "https://", value: "https://" }, ok: "插入" });
      backRange();
      if (url) exec("createLink", url);
    },
    quote: () => {
      // 引用按钮是开关：选中的段落都已在引用里 → 去掉引用；否则 → 套上引用。
      // 光标在代码块里 → 整块改成引用。只动选中的这几块，其他内容不碰。
      article.focus();
      const sel = getSelection();
      if (!sel.rangeCount || !article.contains(sel.anchorNode)) return;
      const r = sel.getRangeAt(0);
      const n = sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
      const pre = n && n.closest && n.closest("pre");
      const touched = [...article.children].filter(c => !c.dataset.deco && c.dataset.role !== "title" && c.style.display !== "none" && r.intersectsNode(c));
      if (!touched.length) return;
      const para = text => { const p = document.createElement("p"); if (text != null) p.textContent = text; else p.appendChild(document.createElement("br")); return p; };
      const contentOf = el => {
        // 引用 / 代码块里真正的内容，装饰（如「批注」标签）丢掉
        if (el.tagName === "PRE") return el.textContent.split(/\n+/).map(l => l.trim()).filter(Boolean).map(l => para(l));
        if (el.tagName !== "BLOCKQUOTE") return [el];
        const out = [];
        [...el.childNodes].forEach(c => {
          if (c.nodeType === 3) { if (c.textContent.trim()) out.push(para(c.textContent.trim())); }
          else if (c.nodeType === 1 && !c.dataset.deco && c.dataset.role !== "callout-title") out.push(c);
        });
        return out;
      };
      let first = null;
      if (touched.every(c => c.tagName === "BLOCKQUOTE")) {
        touched.forEach(bq => { const kids = contentOf(bq); if (!kids.length) kids.push(para()); first = first || kids[0]; bq.replaceWith(...kids); });
      } else if (pre && touched.length === 1) {
        const bq = document.createElement("blockquote");
        const kids = contentOf(pre); bq.append(...(kids.length ? kids : [para()]));
        pre.replaceWith(bq); first = bq.lastChild;
      } else {
        const bq = document.createElement("blockquote");
        touched[0].before(bq);
        touched.forEach(c => bq.append(...contentOf(c).map(x => /^(H[1-4])$/.test(x.tagName) ? para(x.textContent) : x)));
        first = bq.lastChild;
      }
      if (first) placeCaretEnd(first);
      scheduleCanvasSync(true);
    },
    callout: () => { article.focus(); insertBlocks(mdToNodes("> [!tip] 提示\n> 在这里写提示内容")); scheduleCanvasSync(true); },
    ul: () => exec("insertUnorderedList"),
    ol: () => exec("insertOrderedList"),
    code: () => toggleBlock("PRE"),
    hr: () => { article.focus(); const p = document.createElement("p"); p.appendChild(document.createElement("br")); insertBlocks([document.createElement("hr"), p]); scheduleCanvasSync(true); },
    image: () => $("#imageInput").click()
  };

  /* 编辑方式：排版画布 / Markdown 源码 */
  function setMode(m) {
    if (m === "md" && S.mode !== "md") syncCanvas();
    S.mode = m; save();
    $("#main").dataset.mode = m;
    $("#modeSeg").querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.mode === m)));
    const md = m === "md";
    $("#mdPane").hidden = !md;
    $("#stage").hidden = md;
    if (md) { if (E.getValue() !== S.md) E.setValue(S.md); setTimeout(() => E.focus(), 0); }
    else render(true);
  }
  $("#modeSeg").addEventListener("click", e => { const b = e.target.closest("button[data-mode]"); if (b) setMode(b.dataset.mode); });

  /* ================= 左侧：手机预览 ================= */
  // 机型取 CSS 视口尺寸：iPhone 17 Pro Max 440×956、iPhone 17/17 Pro 402×874（yesviz / sizzy）；
  // 安卓 360 宽是最常见的宽度（华为、荣耀等 1080p 机型，DPR 3），也是最窄、一屏最短的情况。
  const DEVICES = [
    { id: "ip17pm", name: "iPhone 17 Pro Max", w: 440, h: 956, os: "ios", note: "大屏，一屏看到的最多" },
    { id: "ip17", name: "iPhone 17 / 17 Pro", w: 402, h: 874, os: "ios", note: "主流 iPhone" },
    { id: "and360", name: "安卓 · 华为 / 荣耀等", w: 360, h: 780, os: "android", note: "最窄、一屏最短" }
  ];
  const devOf = () => DEVICES.find(d => d.id === S.device) || DEVICES[1];
  let phoneOverflow = [];
  let cardIdx = 0;
  // 预览头像：用户上传的头像（存在图片库 "avatar"），没有时用轻排 logo
  const PROFILE_NAME = () => S.profileName || "你的名字";
  const avatarSrc = () => images.get("avatar") || window.DEFAULT_AVATAR;
  const avatarHtml = () => avatarSrc() ? '<img alt="" src="' + avatarSrc() + '">' : '<svg viewBox="0 0 24 28"><use href="#brandLogo"/></svg>';
  const logoAva = () => h("span", { class: "dev-ava", html: avatarHtml() });
  function syncAvatarBtn() { $("#avaBtn").innerHTML = avatarHtml(); }
  function initPhone() {
    const sel = $("#deviceSel");
    sel.replaceChildren(...DEVICES.map(d => h("option", { value: d.id }, d.name + " · " + d.w + "×" + d.h)));
    sel.value = devOf().id;
    sel.addEventListener("change", () => { S.device = sel.value; save(); renderPhone(); });
    window.addEventListener("resize", fitPhone);
    syncAvatarBtn();
    $("#avaBtn").addEventListener("click", () => $("#avatarInput").click());
    $("#avatarInput").addEventListener("change", async e => {
      const f = e.target.files[0]; e.target.value = "";
      if (!f) return;
      const data = await compress(f);
      if (!data) return;
      images.set("avatar", data); IDB.put("avatar", data);
      syncAvatarBtn(); renderPhone(); toast("预览头像已更换");
    });
    if (S.phoneW) $("#phoneCol").style.setProperty("--phone-w", S.phoneW + "px");
    // 手机预览和画布之间的分隔线：可拖动，双击恢复
    const rz = $("#resizer"), col = $("#phoneCol");
    rz.addEventListener("pointerdown", e => {
      rz.setPointerCapture(e.pointerId); rz.classList.add("drag");
      const x0 = e.clientX, w0 = col.offsetWidth;
      const move = ev => { const w = Math.max(240, Math.min(560, w0 + ev.clientX - x0)); col.style.setProperty("--phone-w", w + "px"); fitPhone(); };
      const up = () => { rz.classList.remove("drag"); rz.removeEventListener("pointermove", move); rz.removeEventListener("pointerup", up); S.phoneW = col.offsetWidth; save(); };
      rz.addEventListener("pointermove", move); rz.addEventListener("pointerup", up);
    });
    rz.addEventListener("dblclick", () => { col.style.removeProperty("--phone-w"); S.phoneW = null; save(); fitPhone(); });
  }
  function fitPhone() {
    const d = devOf(), box = $("#phoneStage");
    if (!box.clientWidth) return;
    // 屏幕顶在栏顶下 95px（外框顶与正文标题平齐），底边不超过中间画布底部（扣掉 30px 状态栏和留白）
    const sc = Math.min((box.clientWidth - 40) / d.w, (box.clientHeight - 95 - 30 - 24) / d.h, 1);
    $("#device").style.transform = "translate(13px,0) scale(" + sc + ")";
    $("#deviceBox").style.width = d.w * sc + 26 + "px";
    $("#deviceBox").style.height = d.h * sc + "px";
  }
  // 状态栏图标：信号四格、Wi-Fi 三弧、电池
  const SIGNAL = '<svg width="17" height="11" viewBox="0 0 17 11"><rect x="0" y="7" width="3" height="4" rx="1"/><rect x="4.5" y="5" width="3" height="6" rx="1"/><rect x="9" y="2.5" width="3" height="8.5" rx="1"/><rect x="13.5" y="0" width="3" height="11" rx="1"/></svg>';
  const WIFI = '<svg width="15" height="11" viewBox="0 0 15 11"><path d="M7.5 2.2c2.2 0 4.2.8 5.7 2.2l1.1-1.2A10 10 0 0 0 7.5.5 10 10 0 0 0 .7 3.2l1.1 1.2A8.3 8.3 0 0 1 7.5 2.2z"/><path d="M7.5 5.4c1.3 0 2.5.5 3.4 1.3l1.1-1.2a6.6 6.6 0 0 0-9 0l1.1 1.2c.9-.8 2.1-1.3 3.4-1.3z"/><path d="M7.5 8.4c.5 0 .9.2 1.2.5L7.5 10.5 6.3 8.9c.3-.3.7-.5 1.2-.5z"/></svg>';
  const BATTERY = '<svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke="#111" stroke-opacity=".4"/><rect x="2" y="2" width="17" height="8" rx="1.6"/><path d="M24 4v4c.8-.3 1.3-1.1 1.3-2S24.8 4.3 24 4z" fill-opacity=".45"/></svg>';
  // 公众号文章页底栏图标：赞、分享、推荐（心）、留言
  const WX_ICONS = {
    like: '<svg viewBox="0 0 24 24"><path d="M7 10v10H4V10h3zm0 0 4-7c1.4 0 2.3 1.1 2 2.5L12.3 9H18c1.2 0 2.1 1.1 1.9 2.3l-1.3 7c-.2.9-1 1.7-2 1.7H7"/></svg>',
    share: '<svg viewBox="0 0 24 24"><path d="M13 5l7 6.5-7 6.5v-4c-4.5 0-7.4 1.4-9 4.5.5-5 3.4-9 9-9.5V5z"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/></svg>',
    comment: '<svg viewBox="0 0 24 24"><path d="M4.5 5h15v11h-8l-4 3.5V16h-3z"/></svg>'
  };
  const wxAct = (ic, n) => h("span", { class: "act" }, h("span", { html: WX_ICONS[ic] }), n);
  function statusBar(d) {
    return d.os === "ios"
      ? [h("span", null, "9:41"), h("span", { class: "icons", html: SIGNAL + WIFI + BATTERY })]
      : [h("span", null, "09:41"), h("span", { class: "icons", html: WIFI + SIGNAL + BATTERY + '<span class="bat-n">98</span>' })];
  }
  const navBack = () => h("span", { class: "back" }, "‹");
  const bottomItem = (ic, label) => h("span", { class: "it" }, h("i", null, ic), label);

  function renderPhone(tplOverride, twOverride) {
    const p = S.platform;
    if (p === "x" || !model) return;
    // 调整开关等引起的重绘：手机停在原来的位置，不跳回顶部
    const oldScroll = $("#deviceScroll");
    const keep = oldScroll && oldScroll.dataset.p === p ? oldScroll.scrollTop : null;
    const restoreScroll = () => {
      const ds = $("#deviceScroll");
      if (!ds) return;
      ds.dataset.p = p;
      if (keep != null) ds.scrollTop = keep; else if (p === "wechat" || p === "zhihu") syncPhoneScroll();
    };
    const d = devOf();
    const dev = $("#device");
    dev.dataset.os = d.os;
    dev.dataset.dev = d.id;
    dev.style.width = d.w + "px";
    dev.style.height = d.h + "px";
    $("#deviceStatus").replaceChildren(...statusBar(d));
    const app = $("#devApp");
    phoneOverflow = [];
    if (p === "wechat" && article) {
      const clone = article.cloneNode(true);
      clone.removeAttribute("contenteditable");
      clone.classList.remove("is-empty");
      Render.decorate(clone, tplOverride || tplById(S.wechat.template), twOverride || wechatTweaks());
      markMissing(clone);
      const head = h("div", { class: "wx-head" },
        h("div", { class: "wx-title" }, model.title || "未命名文章"),
        h("div", { class: "wx-meta" }, S.wechat.author ? h("span", null, S.wechat.author) : "", h("span", { class: "acct" }, S.wechat.account || "你的公众号"), h("span", null, todayText())));
      const visible = d.h - (d.os === "ios" ? 54 : 32) - 44 - (d.os === "ios" ? 86 : 54);
      app.replaceChildren(
        h("div", { class: "dev-nav" }, navBack(), h("span", { class: "grow" }), h("span", null, "···")),
        h("div", { class: "device-scroll", id: "deviceScroll" }, h("div", { class: "device-page" }, head, clone, h("div", { class: "fold", style: "top:" + visible + "px" }, h("span", null, "首屏")))),
        h("div", { class: "dev-bottom wx-bottom" }, h("span", { class: "who" }, logoAva(), h("span", null, S.wechat.account || PROFILE_NAME())),
          wxAct("like", "12"), wxAct("share", "46"), wxAct("heart", "2"), wxAct("comment", "4")));
      fitPhone();
      phoneOverflow = detectOverflow(clone);
      restoreScroll();
    } else if (p === "zhihu" && article) {
      const clone = article.cloneNode(true);
      clone.removeAttribute("contenteditable");
      clone.classList.remove("is-empty");
      Render.undecorate(clone);
      clone.querySelectorAll("img[data-w]").forEach(img => { img.style.width = img.dataset.w + "px"; img.style.maxWidth = "100%"; });
      markMissing(clone);
      app.replaceChildren(
        h("div", { class: "dev-nav" }, navBack(), h("span", { class: "grow" }), h("span", null, "⌕"), h("span", null, "···")),
        h("div", { class: "device-scroll", id: "deviceScroll" }, h("div", { class: "zh-m" },
          h("div", { class: "zh-m-title" }, model.title || "未命名文章"),
          h("div", { class: "author" }, logoAva(), h("span", null, S.wechat.author || PROFILE_NAME()), h("span", { class: "follow" }, "+ 关注")),
          clone)),
        h("div", { class: "dev-bottom zh-bottom" }, h("span", { class: "agree" }, "▲ 赞同 1.2k"), bottomItem("💬", "评论 86"), bottomItem("★", "收藏"), bottomItem("♡", "喜欢")));
      fitPhone();
      restoreScroll();
    } else if (p === "xhs" || p === "xlsh") {
      const n = cardEls.length;
      cardIdx = Math.min(cardIdx, Math.max(0, n - 1));
      const sc = d.w / Cards.W;
      const car = h("div", { class: "dev-carousel", style: "width:" + d.w + "px;height:" + Math.round(d.w * 4 / 3) + "px" });
      if (n) {
        const c = cardEls[cardIdx].cloneNode(true);
        c.style.transform = "scale(" + sc + ")";
        const prev = () => { cardIdx = (cardIdx - 1 + n) % n; renderPhone(); };
        const next = () => { cardIdx = (cardIdx + 1) % n; renderPhone(); };
        car.append(c,
          h("span", { class: "tap l", onclick: prev }),
          h("span", { class: "tap r", onclick: next }),
          n > 1 ? h("button", { class: "arrow l", "aria-label": "上一张", onclick: prev }, "‹") : "",
          n > 1 ? h("button", { class: "arrow r", "aria-label": "下一张", onclick: next }, "›") : "",
          h("span", { class: "count" }, cardIdx + 1 + "/" + n));
      }
      const dots = h("div", { class: "dev-dots" }, Array.from({ length: Math.min(n, 9) }, (_, i) => h("i", { class: i === Math.min(cardIdx, 8) ? "on" : "" })));
      const title = noteTitle() || "未命名";
      const body = noteBody();
      const bodyEl = h("div", { class: "body" });
      body.split(/(#[^\s#]+)/).forEach(part => bodyEl.append(/^#/.test(part) ? h("span", { class: "tag" }, part) : part));
      if (p === "xhs") {
        app.replaceChildren(
          h("div", { class: "dev-nav xhs-top" }, navBack(), logoAva(), h("span", { class: "name" }, S.cards.handle ? S.cards.handle.replace(/^@/, "") : PROFILE_NAME()), h("span", { class: "grow" }), h("span", { class: "follow" }, "关注"), h("span", null, "↗")),
          h("div", { class: "device-scroll", id: "deviceScroll" }, car, dots, h("div", { class: "dev-note" }, h("h4", null, title), bodyEl, h("div", { class: "meta" }, "10-06 · 编辑于 杭州"))),
          h("div", { class: "dev-bottom xhs-bottom" }, h("span", { class: "say" }, "✎ 说点什么…"), h("span", { class: "cnt" }, "♡ 1.8万"), h("span", { class: "cnt" }, "☆ 2027"), h("span", { class: "cnt" }, "💬 391")));
      } else {
        app.replaceChildren(
          h("div", { class: "dev-nav" }, navBack(), h("span", { class: "grow" }), h("span", null, "···")),
          h("div", { class: "device-scroll", id: "deviceScroll" }, car, dots, h("div", { class: "dev-note" }, h("h4", null, title), bodyEl)),
          h("div", { class: "dev-bottom" }, h("span", { style: "display:flex;align-items:center;gap:8px;font-size:13px;margin-right:auto" }, logoAva(), S.wechat.account || PROFILE_NAME()),
            bottomItem("👍", "5"), bottomItem("↗", "15"), bottomItem("♡", "推荐"), bottomItem("✎", "写留言")));
      }
      fitPhone();
      restoreScroll();
    }
    $("#phoneInfo").replaceChildren(h("b", null, d.name), " · " + d.w + "×" + d.h + " · " + d.note,
      phoneOverflow.length ? h("span", { class: "warn" }, " · " + phoneOverflow.length + " 处溢出") : "");
  }
  let phoneSoonTimer = null;
  function renderPhoneSoon() { clearTimeout(phoneSoonTimer); phoneSoonTimer = setTimeout(() => renderPhone(), 200); }
  /* 和公众号「内容结构检测」同类的检查：哪些段落比屏幕宽 */
  function detectOverflow(sec) {
    const limit = sec.getBoundingClientRect().right + 1;
    const out = [];
    [...sec.children].filter(b => !b.dataset.deco && b.style.display !== "none").forEach((blk, i) => {
      const over = blk.scrollWidth > blk.clientWidth + 1 || blk.getBoundingClientRect().right > limit ||
        [...blk.querySelectorAll("*")].some(el => el.getBoundingClientRect().right > limit);
      if (over) out.push(i + 1);
    });
    return out;
  }
  function syncPhoneScroll() {
    const st = $("#stage"), ds = $("#deviceScroll");
    if (!ds) return;
    const r = st.scrollTop / Math.max(1, st.scrollHeight - st.clientHeight);
    ds.scrollTop = r * Math.max(0, ds.scrollHeight - ds.clientHeight);
  }

  /* ---------- 公众号 ---------- */
  function isCanvasEmpty() {
    return ![...article.children].some(n => !n.dataset.deco && n.dataset.role !== "title" && (n.textContent.trim() || n.querySelector("img,hr,table")));
  }
  function restyle() {
    if (!article) return;
    if (article.dataset.kind === "zhihu") {
      Render.undecorate(article);
      article.querySelectorAll("img[data-w]").forEach(img => { img.style.width = img.dataset.w + "px"; img.style.maxWidth = "100%"; });
    } else Render.decorate(article, tplById(S.wechat.template), wechatTweaks());
    markMissing(article);
    // 空白文档：留一个空段落给光标，并显示「把文章粘贴到这里」
    const empty = isCanvasEmpty();
    if (empty && !article.querySelector(":scope > p")) { const p = document.createElement("p"); p.appendChild(document.createElement("br")); article.appendChild(p); }
    article.classList.toggle("is-empty", empty);
    renderPhone();
  }
  function focusIfEmpty() {
    if (!article || !isCanvasEmpty() || S.mode === "md") return;
    const ae = document.activeElement;
    if (ae && ae !== document.body && !article.contains(ae)) return;
    const p = article.querySelector(":scope > p");
    article.focus();
    if (p) { const r = document.createRange(); r.setStart(p, 0); r.collapse(true); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); }
  }
  async function copyWechat() {
    if (!article) return;
    const html = Render.exportWechat(article);
    const ok = await copyRich(html, article.innerText);
    const miss = model.images.filter(i => i.unresolved).length;
    toast(ok ? (miss ? "已复制。注意：" + miss + " 张图片缺失，未包含在内" : "已复制，到公众号后台直接粘贴") : "复制失败，请检查浏览器的剪贴板权限");
  }

  /* ---------- 卡片 ---------- */
  let cardEls = [];
  let cardToken = 0;
  function noteTitle() { return (S.note.title || model.title || "").trim(); }
  function noteTags() { return S.note.tags || model.fmTags; }
  function noteBody() { return Core.noteText(model.blocks, { style: S.note.style, tags: noteTags() }); }
  async function buildCards() {
    const token = ++cardToken;
    const c = S.cards;
    const first = model.blocks.find(b => b.type === "para");
    const subtitle = c.subtitle || model.pre.data.description || (first ? Core.sentences(first.text)[0].slice(0, 46) : "");
    const cards = await Cards.build(model.sem.el, {
      style: c.style, accent: c.accent, cover: c.cover, title: noteTitle() || "未命名",
      kicker: c.kicker || (noteTags()[0] ? "# " + noteTags()[0] : ""), subtitle, handle: c.handle || PROFILE_NAME()
    });
    if (token !== cardToken || (S.platform !== "xhs" && S.platform !== "xlsh")) return;
    cardEls = cards;
    const grid = h("div", { class: "cards" });
    // 预览区够宽时排成多列：两列放不下 0.75 倍就缩到 0.58
    const avail = stage.clientWidth - 48;
    grid.style.setProperty("--cs", avail >= 2 * 270 + 16 || avail < 2 * 209 + 16 ? 0.75 : 0.58);
    cards.forEach((card, i) => {
      grid.append(h("div", { class: "card-slot" }, h("span", { class: "card-idx" }, i === 0 && c.cover ? "封面" : "第 " + (i + 1) + " 张"), card,
        h("button", { class: "card-act", onclick: () => saveCard(i) }, icon("down"), "下载")));
    });
    stage.replaceChildren(h("div", { class: "cards-wrap" }, grid));
    $("#stageLabel").textContent = STAGE_LABEL[S.platform] + " · 共 " + cards.length + " 张";
    renderPhone();
    renderChecks();
  }
  async function saveCard(i) {
    try { download(await Cards.toBlob(cardEls[i]), safeName(noteTitle()) + "-" + String(i + 1).padStart(2, "0") + ".png"); }
    catch (e) { toast("当前浏览器无法导出图片，请使用 Chrome 或 Edge"); }
  }
  async function exportCards() {
    if (!cardEls.length) return;
    toast("正在生成 " + cardEls.length + " 张图片…", 10000);
    try {
      const files = [];
      for (let i = 0; i < cardEls.length; i++) files.push({ name: String(i + 1).padStart(2, "0") + ".png", data: await Cards.toBlob(cardEls[i]) });
      files.push({ name: "正文.txt", data: new TextEncoder().encode(noteTitle() + "\n\n" + noteBody()) });
      download(await Cards.zip(files), safeName(noteTitle()) + "-" + VIEWS[S.platform].label + ".zip");
      toast("已导出 " + cardEls.length + " 张卡片和正文");
    } catch (e) {
      console.error(e);
      toast("导出失败：当前浏览器不支持，请使用 Chrome 或 Edge");
    }
  }

  /* ---------- 知乎 ---------- */
  async function copyZhihu() {
    if (canvasTimer) syncCanvas();
    const body = article;
    if (!body) return;
    const html = Render.exportZhihu(body);
    const ok = await copyRich(html, body.innerText);
    toast(ok ? "正文已复制。标题请在知乎单独填写" : "复制失败，请检查浏览器的剪贴板权限");
  }

  /* ---------- X ---------- */
  function xThread() { return Core.splitThread(Core.blocksToXUnits(model.blocks), { numbering: S.x.numbering }); }
  function xLong() { return Core.blocksToPlain(model.blocks, { bullet: "• " }); }
  function xArticleNode() {
    const box = h("div");
    box.append(...model.sem.el.cloneNode(true).childNodes);
    box.querySelectorAll("[data-role=title]").forEach(n => n.remove());
    box.querySelectorAll("pre").forEach(p => { const n = h("p"); n.textContent = p.textContent; p.replaceWith(n); });
    box.querySelectorAll("table").forEach(t => {
      const frag = document.createDocumentFragment();
      t.querySelectorAll("tr").forEach(tr => frag.append(h("p", null, [...tr.children].map(c => c.textContent.trim()).join(" ｜ "))));
      t.replaceWith(frag);
    });
    markMissing(box);
    return box;
  }
  async function copyX() {
    if (S.x.mode === "thread") {
      const posts = xThread();
      await copyText(posts.map(p => p.text).join("\n\n———\n\n"));
      toast("已复制全部 " + posts.length + " 条，条与条之间用 ——— 分隔");
    } else if (S.x.mode === "long") {
      await copyText(xLong()); toast("长帖已复制");
    } else {
      const node = xArticleNode();
      const ok = await copyRich(Render.exportZhihu(node), node.innerText);
      toast(ok ? "已复制，在 X 文章编辑器里粘贴" : "复制失败");
    }
  }

  /* ================= 检查：错别字与定位 ================= */
  // 画布里可见的正文文字（不含装饰、隐藏元素），用于检测与定位
  function canvasTextNodes() {
    if (!article) return [];
    const out = [];
    const w = document.createTreeWalker(article, NodeFilter.SHOW_TEXT, {
      acceptNode: t => {
        const el = t.parentElement;
        if (el.closest("[data-deco],[data-preview-only]")) return NodeFilter.FILTER_REJECT;
        for (let n = el; n && n !== article; n = n.parentElement) if (n.style && n.style.display === "none") return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }
  let typoShowAll = false;
  function typoSource() {
    if (isCanvasPlatform() && article && S.mode !== "md") return { text: canvasTextNodes().map(t => t.textContent).join(""), locatable: true };
    return { text: model.blocks.map(b => b.text || (b.items || []).map(i => i.text).join("\n") || "").join("\n"), locatable: false };
  }
  function locateInCanvas(start, len) {
    const nodes = canvasTextNodes();
    let pos = 0, sNode = null, sOff = 0, eNode = null, eOff = 0;
    for (const t of nodes) {
      const L = t.textContent.length;
      if (!sNode && start < pos + L) { sNode = t; sOff = start - pos; }
      if (sNode && start + len <= pos + L) { eNode = t; eOff = start + len - pos; break; }
      pos += L;
    }
    if (!sNode || !eNode) return;
    const r = document.createRange();
    r.setStart(sNode, sOff); r.setEnd(eNode, eOff);
    const rect = r.getBoundingClientRect(), sr = stage.getBoundingClientRect();
    stage.scrollTo({ top: stage.scrollTop + rect.top - sr.top - stage.clientHeight / 3, behavior: "smooth" });
    if (window.CSS && CSS.highlights && window.Highlight) {
      CSS.highlights.set("bx-locate", new Highlight(r));
      clearTimeout(locateInCanvas.t);
      locateInCanvas.t = setTimeout(() => CSS.highlights.delete("bx-locate"), 2400);
    } else {
      const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    }
  }
  function renderTypos(box) {
    const src = typoSource();
    const list = Core.findTypos(src.text);
    if (!list.length) { box.replaceChildren(); box.hidden = true; return 0; }
    box.hidden = false;
    const shown = typoShowAll ? list : list.slice(0, 2);
    const items = shown.map(t => {
      const a = Math.max(0, t.index - 6), b = Math.min(src.text.length, t.index + t.length + 6);
      const snip = h("span", { class: "snip" }, (a > 0 ? "…" : "") + src.text.slice(a, t.index), h("mark", null, t.wrong), src.text.slice(t.index + t.length, b) + (b < src.text.length ? "…" : ""));
      return h("button", { class: "typo", title: src.locatable ? "点击定位到正文" : "在公众号或知乎的画布里可以点击定位", onclick: () => src.locatable && locateInCanvas(t.index, t.length) },
        snip, h("span", { class: "fix" }, "→ " + t.right), h("span", { class: "kind" }, t.kind));
    });
    box.replaceChildren(h("div", { class: "t-h" }, "错别字与标点", h("span", null, list.length + " 处")), ...items,
      list.length > 2 ? h("button", { class: "more", onclick: () => { typoShowAll = !typoShowAll; renderTypos(box); } }, typoShowAll ? "收起" : "展开其余 " + (list.length - 2) + " 处") : "");
    return list.length;
  }

  /* ================= 检查 ================= */
  function renderChecks() {
    if (!model) return;
    const p = S.platform;
    const ctx = {
      blocks: model.blocks, title: (p === "xhs" || p === "xlsh") ? noteTitle() : model.title,
      footnotes: model.pre.footnotes, notes: model.pre.notes, tokensLinks: model.links, images: model.images,
      tags: noteTags(), noteBody: (p === "xhs" || p === "xlsh") ? noteBody() : "", cardCount: cardEls.length,
      xMode: S.x.mode, thread: p === "x" && S.x.mode === "thread" ? xThread() : null,
      plainLength: p === "x" && S.x.mode === "long" ? Core.xLength(xLong()) : 0
    };
    const list = Core.check(p, ctx);
    if (p === "wechat" && phoneOverflow.length) {
      const ok = list.findIndex(i => i.level === "ok");
      if (ok >= 0) list.splice(ok, 1);
      list.unshift({ level: "warn", title: phoneOverflow.length + " 处内容超出手机屏幕", detail: "在「" + devOf().name + "」上，第 " + phoneOverflow.join("、") + " 段比屏幕宽。粘贴到公众号时会提示「存在溢出问题」。常见原因：很长的英文链接或代码、拖得太宽的图片、列数太多的表格。" });
    }
    const typoBox = $("#typoList");
    const typoN = typoBox ? renderTypos(typoBox) : Core.findTypos(typoSource().text).length;
    if (typoN) { const ok = list.findIndex(i => i.level === "ok"); if (ok >= 0) list.splice(ok, 1); }
    const err = list.filter(i => i.level === "error").length;
    const warn = list.filter(i => i.level === "warn").length + typoN;
    const badge = document.querySelector('#inspTabs [data-tab="check"] .badge');
    if (badge) {
      badge.textContent = err || warn || "";
      badge.className = "badge" + (err ? " err" : warn ? " warn" : "");
      badge.hidden = !(err || warn);
    }
    const box = $("#checksList");
    if (!box) return;
    box.replaceChildren(...list.map(i => h("div", { class: "ck " + i.level }, h("span", { class: "lv" }), h("div", null, h("b", null, i.title), h("p", null, i.detail)))));
  }

  /* ================= 检查器面板 ================= */
  function seg(options, value, onPick, block) {
    const wrap = h("div", { class: "seg" + (block ? " block" : "") });
    options.forEach(([v, label, ic]) => {
      const b = h("button", { "aria-pressed": String(String(v) === String(value)), onclick: () => {
        wrap.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        onPick(v);
      } }, ic ? icon(ic) : "", label);
      wrap.append(b);
    });
    return wrap;
  }
  function toggle(label, checked, onChange, hint) {
    const inp = h("input", { type: "checkbox", "aria-label": label });
    inp.checked = !!checked;
    inp.addEventListener("change", () => onChange(inp.checked));
    return h("div", { class: "row", title: hint || null }, h("label", null, label), h("span", { class: "switch" }, inp, h("i")));
  }
  function slider(label, value, min, max, onInput) {
    const out = h("span", { class: "range-n" }, String(value));
    const inp = h("input", { type: "range", class: "range", min: String(min), max: String(max), step: "1", value: String(value), "aria-label": label });
    inp.addEventListener("input", () => { out.textContent = inp.value; onInput(+inp.value); });
    return h("div", { class: "row" }, h("label", null, label), h("span", { class: "range-w" }, inp, out));
  }
  function group(title, ...kids) { return h("div", { class: "group" }, title ? h("div", { class: "g-h" }, ...[].concat(title)) : "", ...kids); }
  function textField(label, value, placeholder, onInput) {
    const f = h("input", { class: "field", value: value || "", placeholder: placeholder || "" });
    f.addEventListener("input", () => onInput(f.value));
    return h("div", { class: "row" }, h("label", null, label), f);
  }
  function swatchRow(list, current, onPick) {
    const wrap = h("div", { class: "swatches" });
    const mark = v => wrap.querySelectorAll(".sw").forEach(s => s.setAttribute("aria-pressed", String(s.dataset.v === v)));
    list.forEach(c => wrap.append(h("button", { class: "sw", "data-v": c, style: "background:" + c, title: c, "aria-pressed": String(c === current), onclick: () => { mark(c); onPick(c); } })));
    const isCustom = current && !list.includes(current);
    const custom = h("button", { class: "sw custom", "data-v": isCustom ? current : "", title: "自定义颜色", "aria-label": "自定义颜色", "aria-pressed": String(!!isCustom) });
    // 自绘色盘：只改这一组，不用系统取色器
    custom.addEventListener("click", e => {
      e.stopPropagation();
      openPicker(custom, /^#[0-9a-f]{6}$/i.test(current || "") ? current : "#b23a2e", v => { current = v; custom.dataset.v = v; mark(v); onPick(v); });
    });
    wrap.append(custom);
    return wrap;
  }

  /* ---------- 自绘色盘：饱和度/明度方块 + 色相条 + 色值 ---------- */
  function hexToHsv(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let hh = 0;
    if (d) hh = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (hh * 60 + 360) % 360, s: max ? d / max : 0, v: max };
  }
  function hsvToHex({ h: hh, s: ss, v }) {
    const f = n => { const k = (n + hh / 60) % 6; return v - v * ss * Math.max(0, Math.min(k, 4 - k, 1)); };
    return "#" + [f(5), f(3), f(1)].map(x => Math.round(x * 255).toString(16).padStart(2, "0")).join("");
  }
  let pickerEl = null;
  function closePicker() { if (pickerEl) { pickerEl.remove(); pickerEl = null; document.removeEventListener("pointerdown", onPickerOutside, true); } }
  function onPickerOutside(e) { if (pickerEl && !pickerEl.contains(e.target)) closePicker(); }
  function openPicker(anchor, initial, onPick) {
    closePicker();
    const hsv = hexToHsv(initial);
    const sv = h("div", { class: "cp-sv" }, h("i", { class: "cp-knob" }));
    const hue = h("div", { class: "cp-hue" }, h("i", { class: "cp-knob" }));
    const dot = h("span", { class: "cp-dot" });
    const field = h("input", { class: "cp-hex", value: initial, maxlength: "7", spellcheck: "false", "aria-label": "色值" });
    pickerEl = h("div", { class: "cp", role: "dialog", "aria-label": "选择颜色" }, sv, hue, h("div", { class: "cp-row" }, dot, field));
    document.body.appendChild(pickerEl);
    let raf = 0;
    const paint = emit => {
      const hex = hsvToHex(hsv);
      sv.style.backgroundColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
      sv.firstChild.style.left = hsv.s * 100 + "%";
      sv.firstChild.style.top = (1 - hsv.v) * 100 + "%";
      hue.firstChild.style.left = (hsv.h / 360) * 100 + "%";
      dot.style.background = hex;
      if (document.activeElement !== field) field.value = hex;
      if (emit) { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => onPick(hex)); }
    };
    const drag = (el, fn) => el.addEventListener("pointerdown", e => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      const move = ev => { const r = el.getBoundingClientRect(); fn(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)), Math.max(0, Math.min(1, (ev.clientY - r.top) / r.height))); paint(true); };
      move(e);
      const up = () => { el.removeEventListener("pointermove", move); el.removeEventListener("pointerup", up); };
      el.addEventListener("pointermove", move); el.addEventListener("pointerup", up);
    });
    drag(sv, (x, y) => { hsv.s = x; hsv.v = 1 - y; });
    drag(hue, x => { hsv.h = Math.min(359.9, x * 360); });
    field.addEventListener("input", () => {
      let v = field.value.trim(); if (!v.startsWith("#")) v = "#" + v;
      if (/^#[0-9a-f]{6}$/i.test(v)) { Object.assign(hsv, hexToHsv(v.toLowerCase())); paint(true); }
    });
    field.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === "Escape") closePicker(); });
    paint(false);
    // 定位：色块下方，超出窗口时往上翻
    const r = anchor.getBoundingClientRect();
    const w = 232, hgt = pickerEl.offsetHeight;
    let left = Math.min(window.innerWidth - w - 12, Math.max(12, r.left + r.width / 2 - w / 2));
    let top = r.bottom + 10;
    if (top + hgt > window.innerHeight - 12) top = r.top - hgt - 10;
    Object.assign(pickerEl.style, { left: left + "px", top: top + "px" });
    setTimeout(() => document.addEventListener("pointerdown", onPickerOutside, true), 0);
  }
  document.addEventListener("keydown", e => { if (e.key === "Escape") closePicker(); });

  /* ---------- 版式标签改名（如「批注」）：改一处，全文同名标签一起变，存在版式调整项里 ---------- */
  let labelEl = null;
  function closeLabelEdit() { if (labelEl) { labelEl.remove(); labelEl = null; } }
  function setLabel(key, text, fromPanel) {
    const w = S.wechat, tw = Object.assign({}, w.tweaks[w.template]);
    const labels = Object.assign({}, tw.labels);
    const def = (tplById(w.template).labels || {})[key];
    if (!text || text === def) delete labels[key]; else labels[key] = text;
    tw.labels = labels;
    w.tweaks[w.template] = tw;
    save(); restyle();
    if (!fromPanel && S.tab[S.platform] === "adjust") renderInspector();
  }
  function openLabelEdit(target) {
    closeLabelEdit();
    const key = target.dataset.label;
    const field = h("input", { class: "field", value: target.textContent, spellcheck: "false", "aria-label": "标签名字" });
    const ok = h("button", { class: "btn ink small", onclick: () => { setLabel(key, field.value.trim()); closeLabelEdit(); } }, "确定");
    const reset = h("button", { class: "btn line small", title: "恢复版式原来的名字", onclick: () => { setLabel(key, ""); closeLabelEdit(); } }, "恢复");
    labelEl = h("div", { class: "label-pop", role: "dialog", "aria-label": "修改标签名字" },
      h("div", { class: "lp-row" }, field, ok, reset),
      h("p", { class: "hint" }, "全文同类标签一起改，下次打开仍保留。"));
    document.body.appendChild(labelEl);
    const r = target.getBoundingClientRect();
    const wd = labelEl.offsetWidth, ht = labelEl.offsetHeight;
    let top = r.bottom + 8;
    if (top + ht > window.innerHeight - 12) top = r.top - ht - 8;
    Object.assign(labelEl.style, { left: Math.min(window.innerWidth - wd - 12, Math.max(12, r.left)) + "px", top: top + "px" });
    field.focus(); field.select();
    field.addEventListener("keydown", e => {
      if (e.key === "Enter") { e.preventDefault(); ok.click(); }
      if (e.key === "Escape") closeLabelEdit();
    });
  }
  $("#stage").addEventListener("click", e => {
    const t = e.target.closest("[data-label]");
    if (t && S.platform === "wechat") { e.preventDefault(); openLabelEdit(t); }
  });
  document.addEventListener("pointerdown", e => { if (labelEl && !labelEl.contains(e.target) && !e.target.closest("[data-label]")) closeLabelEdit(); }, true);

  /* ---------- 版式选择器：悬停预览 ---------- */
  let hoverTimer = null, previewing = false;
  function hoverPreview(t, accent) {
    if (S.platform !== "wechat" || !article) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      previewing = true;
      const w = S.wechat;
      const tw = Object.assign({}, tweaksOf(t.id), { accent }, { keepTitle: w.keepTitle, captions: w.captions, linkNotes: w.linkNotes, endMark: w.endMark, imgAlign: w.imgAlign || "center", sidePad: w.sidePad == null ? 8 : w.sidePad, imgRadius: w.imgRadius || 0, imgShadow: w.imgShadow || 0, imgBorder: w.imgBorder ? (w.imgBorderColor || "#d9d6cf") : "" });
      Render.decorate(article, t, tw);
      markMissing(article);
      renderPhone(t, tw);
      $("#stageLabel").textContent = "预览「" + t.name + "」· 点击卡片应用";
    }, 250);
  }
  function endPreview() {
    clearTimeout(hoverTimer);
    if (!previewing) return;
    previewing = false;
    restyle();
    $("#stageLabel").textContent = STAGE_LABEL.wechat;
  }
  function applyTemplate(t, accent) {
    const w = S.wechat;
    clearTimeout(hoverTimer);
    previewing = false;
    w.template = t.id;
    w.tweaks[t.id] = Object.assign({}, w.tweaks[t.id], { accent });
    save(); restyle(); renderInspector();
    $("#stageLabel").textContent = STAGE_LABEL.wechat;
    // 在 Markdown 源码视图里选版式：切回排版视图，编辑区直接看到效果
    if (S.mode === "md") setMode("canvas");
  }

  const PANES = {
    style() {
      const w = S.wechat;
      const M = window.TemplateMeta;
      w.favs = w.favs || [];
      const rec = Core.detectScene(S.md)[0];
      const out = [];


      let list = TEMPLATES.map(t => ({ t }));
      const rank = x => (w.favs.includes(x.t.id) ? 2 : 0) + (rec && x.t.scenes.includes(rec.scene) ? 1 : 0);
      list.sort((a, b) => rank(b) - rank(a));

      const grid = h("div", { class: "tgrid" });
      list.forEach(({ t }) => {
        const active = w.template === t.id;
        const mine = tweaksOf(t.id).accent;
        const shown = mine;
        const art = h("div", { class: "tc-art" });
        art.innerHTML = t.cover(Render.makeK(t, Object.assign({}, tweaksOf(t.id), { accent: shown })));
        const fav = w.favs.includes(t.id);
        const card = h("div", { class: "tcard" + (active ? " on" : "") },
          h("button", { class: "tc-cover", "aria-label": "套用版式「" + t.name + "」", onclick: () => applyTemplate(t, shown), onmouseenter: () => hoverPreview(t, shown), onmouseleave: endPreview, onfocus: () => hoverPreview(t, shown), onblur: endPreview }, art),
          h("div", { class: "tc-meta" }, h("b", null, t.name), h("span", null, t.scenes.join(" · ")),
            h("button", { class: "tc-fav", "aria-pressed": String(fav), title: fav ? "取消收藏" : "收藏", onclick: () => { w.favs = fav ? w.favs.filter(x => x !== t.id) : w.favs.concat(t.id); save(); renderInspector(); } }, fav ? "★" : "☆")));
        if (rec && t.scenes.includes(rec.scene)) card.append(h("span", { class: "tc-rec" }, "推荐"));
        grid.append(card);
      });
      out.push(group(null, grid));

      const presets = h("div");
      if (!w.presets.length) presets.append(h("p", { class: "empty-note" }, "把调好的版式存起来，换文章时一键套用。"));
      w.presets.forEach(p => {
        const tw = Object.assign({}, tplById(p.tpl).defaults, p.tweaks);
        presets.append(h("div", { class: "preset" },
          h("span", { class: "dotc", style: "background:" + tw.accent }),
          h("button", { class: "nm", onclick: () => { w.template = p.tpl; w.tweaks[p.tpl] = Object.assign({}, p.tweaks); save(); restyle(); renderInspector(); toast("已套用「" + p.name + "」"); } }, p.name, h("span", { style: "color:var(--text-3);margin-left:6px;font-size:11.5px" }, tplById(p.tpl).name)),
          h("button", { class: "del", title: "删除", onclick: async () => {
            if (await dialog({ title: "删除「" + p.name + "」？", text: "只删除这个保存的版式，不影响文章。", ok: "删除", danger: true })) {
              w.presets = w.presets.filter(x => x !== p); save(); renderInspector();
            }
          } }, icon("trash"))));
      });
      out.push(group(["我的版式", h("button", { class: "act", onclick: savePreset }, "＋ 存为我的版式")], presets));
      return out;
    },
    adjust() {
      const w = S.wechat;
      const tpl = tplById(w.template);
      const tw = tweaksOf(w.template);
      const setTw = (k, v) => { w.tweaks[w.template] = Object.assign({}, w.tweaks[w.template], { [k]: v }); save(); restyle(); };
      return [
        group(["主色 · " + tpl.name, h("button", { class: "act", onclick: () => { delete w.tweaks[w.template]; save(); restyle(); renderInspector(); } }, "恢复默认")],
          swatchRow(tpl.swatches, tw.accent, v => setTw("accent", v))),
        group(["标题颜色", h("button", { class: "act", onclick: () => setTw("headColor", null) || renderInspector() }, "跟随版式")],
          swatchRow(["#222222", "#a8432f", "#3b4f6b", "#3f5f4e", "#8a6436", "#5e4352"], tw.headColor || null, v => setTw("headColor", v))),
        group(["高亮颜色", h("button", { class: "act", onclick: () => setTw("markColor", null) || renderInspector() }, "跟随版式")],
          swatchRow(["#f6e7b4", "#f3d9d4", "#dbe7d6", "#d9e3ec", "#e6dff0", "#eee3d3"], tw.markColor || null, v => setTw("markColor", v))),
        group(["页面边距"],
          seg([[8, "8"], [16, "16"], [24, "24"], [32, "32"]], w.sidePad == null ? 8 : w.sidePad, v => { w.sidePad = +v; save(); restyle(); }, true)),
        ...(() => {
          const lb = tpl.labels || {}, mine = tw.labels || {};
          const keys = Object.keys(lb).filter(k2 => k2 === "quote" || k2 === "notes" || k2 === "refs");
          if (!keys.length) return [];
          const names = { quote: "引用标签", notes: "注释标题", refs: "参考标题" };
          return [group(["标签文字", h("button", { class: "act", onclick: () => { keys.forEach(k2 => setLabel(k2, "", true)); renderInspector(); } }, "恢复默认")],
            ...keys.map(k2 => textField(names[k2], mine[k2] || lb[k2], lb[k2], v => setLabel(k2, v.trim(), true))))];
        })(),
        group(["图片位置"],
          seg([["left", "居左"], ["center", "居中"], ["right", "居右"]], w.imgAlign || "center", v => { w.imgAlign = v; save(); restyle(); }, true),
          toggle("显示图片备注", w.captions, v => { w.captions = v; save(); restyle(); }, "图片下方那一行小字，全文统一开关"),
          slider("圆角", w.imgRadius || 0, 0, 10, v => { w.imgRadius = v; save(); restyle(); }),
          toggle("描边", !!w.imgBorder, v => { w.imgBorder = v; save(); restyle(); renderInspector(); }, "给所有图片加一圈细线"),
          w.imgBorder ? h("div", { class: "sub-sw" }, swatchRow(["#d9d6cf", "#222222", "#a8432f", "#3b4f6b", "#3f5f4e", "#8a6436"], w.imgBorderColor || "#d9d6cf", v => { w.imgBorderColor = v; save(); restyle(); })) : "",
          slider("阴影", w.imgShadow || 0, 0, 10, v => { w.imgShadow = v; save(); restyle(); })),
        group(["正文"],
          h("div", { class: "row" }, h("span", null, "字体"), seg([["sans", "黑体"], ["serif", "宋体"], ["kai", "楷体"]], tw.font, v => setTw("font", v))),
          h("div", { class: "row" }, h("span", null, "字号"), seg([[14, "14"], [15, "15"], [16, "16"], [17, "17"]], tw.fontSize, v => setTw("fontSize", +v))),
          h("div", { class: "row" }, h("span", null, "行距"), seg([[1.75, "1.75"], [1.85, "1.85"], [2.0, "2.0"]], tw.lineHeight, v => setTw("lineHeight", +v))),
          toggle("首行缩进", tw.indent, v => setTw("indent", v)),
          h("p", { class: "hint" }, "宋体、楷体在多数安卓手机上没有，读者会看到系统默认字体。")),
        group(["内容"],
          toggle("正文里显示一级标题", w.keepTitle, v => { w.keepTitle = v; save(); restyle(); }, "公众号有单独的标题栏，通常不需要"),
          toggle("外链转为文末注释", w.linkNotes, v => { w.linkNotes = v; save(); restyle(); }),
          toggle("文末结束标记", w.endMark, v => { w.endMark = v; save(); restyle(); })),
        group(["预览信息"],
          textField("公众号名称", w.account, "你的公众号", v => { w.account = v; save(); $("#wxAcct").textContent = v || "你的公众号"; renderPhoneSoon(); }),
          textField("作者", w.author, "可不填", v => { w.author = v; save(); $("#wxAuthor").textContent = v; $("#wxAuthor").hidden = !v; renderPhoneSoon(); }),
          h("p", { class: "hint" }, "只用于预览，不会复制进正文。"))
      ];
    },
    cards() {
      const c = S.cards;
      const style = Cards.styleById(c.style);
      const list = h("div", { class: "style-list" });
      Cards.STYLES.forEach(st => {
        list.append(h("button", { class: "style-pick", "aria-pressed": String(st.id === c.style), onclick: () => { c.style = st.id; c.accent = null; save(); renderInspector(); buildCards(); } },
          h("span", { class: "tile", style: "background:" + st.vars.bg },
            h("i", { style: "top:34%;background:" + st.vars.fg + ";height:3px" }),
            h("i", { style: "top:46%;right:40%;background:" + st.vars.accent }),
            h("i", { style: "top:60%;background:" + st.vars.muted + ";opacity:.6" }),
            h("i", { style: "top:68%;right:30%;background:" + st.vars.muted + ";opacity:.6" })),
          st.name));
      });
      let t;
      const later = () => { clearTimeout(t); t = setTimeout(() => { save(); buildCards(); }, 300); };
      return [
        group(["卡片风格"], list),
        group(["点缀色"], swatchRow(style.swatches, c.accent || style.vars.accent, v => { c.accent = v; save(); buildCards(); })),
        group(["封面"],
          toggle("生成封面", c.cover, v => { c.cover = v; save(); buildCards(); }),
          textField("眉题", c.kicker, "默认用第一个话题", v => { c.kicker = v; later(); }),
          textField("副标题", c.subtitle, "默认取首段第一句", v => { c.subtitle = v; later(); }),
          textField("账号", c.handle, "@你的账号", v => { c.handle = v; later(); })),
        group(["分页"], h("p", { class: "hint", style: "margin-top:0" }, "正文自动分页：段落在句号处断开，小标题不会落在页尾。想在某处强制换页，在源稿里写一行 ", h("code", null, "---"), "。"))
      ];
    },
    note() {
      const n = S.note;
      const rules = Core.PLATFORMS[S.platform];
      let t;
      const later = () => { clearTimeout(t); t = setTimeout(() => { save(); buildCards(); }, 300); };
      const tags = h("div", { class: "tags", onclick: () => tagInput.focus() });
      const tagInput = h("input", { placeholder: "输入话题，回车添加" });
      const drawTags = () => {
        tags.replaceChildren(...noteTags().map((tg, i) => h("span", null, "#" + tg, h("button", { title: "移除", onclick: e => { e.stopPropagation(); const arr = noteTags().slice(); arr.splice(i, 1); n.tags = arr; save(); drawTags(); later(); } }, icon("x")))), tagInput);
      };
      tagInput.addEventListener("keydown", e => {
        if ((e.key === "Enter" || e.key === "," || e.key === "，" || e.key === " ") && !e.isComposing) {
          e.preventDefault();
          const v = tagInput.value.replace(/^#/, "").trim();
          if (v) { n.tags = noteTags().concat(v); tagInput.value = ""; save(); drawTags(); later(); tagInput.focus(); }
        } else if (e.key === "Backspace" && !tagInput.value && noteTags().length) {
          n.tags = noteTags().slice(0, -1); save(); drawTags(); later(); tagInput.focus();
        }
      });
      drawTags();
      return [
        group(["笔记标题", h("button", { class: "act", onclick: async () => { await copyText(noteTitle()); toast("标题已复制"); } }, "复制标题")],
          h("input", { class: "field", value: n.title, placeholder: model.title || "默认用一级标题", oninput: e => { n.title = e.target.value; later(); } })),
        group(["正文符号"], seg(Object.entries(Core.NOTE_STYLES).map(([k, v]) => [k, v.label]), n.style, v => { n.style = v; save(); buildCards(); }, true),
          h("p", { class: "hint" }, "小标题、列表和引用转成纯文本时用的符号。「表情」更口语化，其余三种更克制。")),
        group(["话题"], tags, h("p", { class: "hint" }, "默认取 frontmatter 里的 tags。建议 3–5 个；粘贴到小红书后，需要在 App 里点选一次才会变成可点的话题。"))
      ];
    },
    zhihu() {
      return [group(["标题"], h("button", { class: "btn line small", onclick: async () => { await copyText(model.title); toast("标题已复制"); } }, icon("copy"), "复制标题"),
        h("p", { class: "hint" }, "知乎的标题要单独填写，正文复制时不包含标题。")),
      group(["复制后会保留"], h("p", { class: "hint", style: "margin-top:0;font-size:12px;line-height:1.8;color:var(--text-2)" },
        "标题层级、加粗、引用、列表、代码块、表格、分隔线、图片。颜色和字体由知乎统一，所以这里预览的是知乎的中性样式。")),
      group(["两种发法"], h("p", { class: "hint", style: "margin-top:0;font-size:12px;line-height:1.8;color:var(--text-2)" },
        "① 点右上角「复制到知乎」，在知乎编辑器里粘贴；② 下载 .md，用知乎的「导入文档」（单个文件不超过 5MB）。本地图片在两种方式下都需要在知乎里重新上传。"))];
    },
    x() {
      const x = S.x;
      let t;
      const later = () => { clearTimeout(t); t = setTimeout(() => { save(); render(); }, 250); };
      return [
        group(["形式"], seg([["thread", "串推"], ["long", "长帖"], ["article", "文章"]], x.mode, v => { x.mode = v; save(); syncTopActions(); render(); renderInspector(); }, true),
          h("p", { class: "hint" }, x.mode === "thread" ? "按 280 加权字符自动拆分：中文算 2，英文算 1，链接固定算 23。先按段落，再按句子断开。"
            : x.mode === "long" ? "Premium 长帖，最多 25,000 字符，时间线上只显示前 280。" : "X 文章支持标题、加粗、列表、引用、图片；代码块和表格会转成普通段落。")),
        x.mode === "thread" ? group(["串推"], toggle("末尾加编号 1/n", x.numbering, v => { x.numbering = v; save(); render(); })) : "",
        group(["预览信息"],
          textField("名字", x.name, "你的名字", v => { x.name = v; later(); }),
          textField("账号", x.handle, "handle", v => { x.handle = v; later(); }))
      ];
    },
    check() {
      const rules = Core.PLATFORMS[S.platform];
      const rows = {
        wechat: [["标题", "后台 64 字，接口 32 字"], ["摘要", "120 字"], ["正文", "2 万字以内，且小于 1MB"], ["外链", "非公众号文章链接不可点"]],
        xlsh: [["标题", "32 字，转贴图时保留前 20 字"], ["正文", "纯文本，约 1000 字"], ["图片", "最多 20 张，3:4"]],
        xhs: [["标题", "20 字"], ["正文", "1000 字，纯文本"], ["图片", "最多 18 张，3:4（1080×1440）"], ["话题", "建议 3–5 个"]],
        zhihu: [["导入文档", "md / docx，单文件 ≤ 5MB"], ["图片", "需要公网地址或在知乎上传"]],
        x: [["普通帖", "280 加权字符"], ["长帖", "25,000（Premium）"], ["文章", "约 10 万字符（Premium）"], ["图片", "每条最多 4 张"]]
      }[S.platform];
      return [h("div", { class: "typos", id: "typoList", hidden: true }), h("div", { class: "checks", id: "checksList" }),
        h("div", { class: "rules" }, h("div", { class: "g-h" }, rules.label + " 发布规则"), h("dl", null, rows.flatMap(([a, b]) => [h("dt", null, a), h("dd", null, b)])),
          h("p", { class: "hint" }, "规则整理于 2026 年 10 月，平台可能调整。"))];
    }
  };

  async function savePreset() {
    const w = S.wechat;
    const name = await dialog({ title: "存为我的版式", text: "保存当前版式「" + tplById(w.template).name + "」和所有调整。", input: { placeholder: "起个名字，比如「读书笔记」", value: "" }, ok: "保存" });
    if (!name) return;
    w.presets.push({ id: newId(), name, tpl: w.template, tweaks: Object.assign({}, w.tweaks[w.template]) });
    save(); renderInspector(); toast("已保存「" + name + "」");
  }

  function renderInspector() {
    const v = VIEWS[S.platform];
    const tabs = $("#inspTabs");
    let cur = S.tab[S.platform];
    if (!v.tabs.some(t => t[0] === cur)) cur = v.tabs[0][0];
    tabs.replaceChildren(...v.tabs.map(([id, label]) => h("button", { role: "tab", "data-tab": id, "aria-selected": String(id === cur), onclick: () => { S.tab[S.platform] = id; save(); renderInspector(); } },
      label, id === "check" ? h("span", { class: "badge", hidden: true }) : "")));
    const body = $("#inspBody");
    const scroll = body.scrollTop;
    body.replaceChildren(...[].concat(PANES[cur]()).filter(Boolean));
    body.scrollTop = scroll;
    renderChecks();
  }

  /* ================= 顶栏与平台切换 ================= */
  const STAGE_LABEL = { wechat: "直接在文章上编辑", xlsh: "小绿书 · 内容在公众号或 Markdown 里改", xhs: "小红书 · 内容在公众号或 Markdown 里改", zhihu: "直接在文章上编辑", x: "X" };
  function syncTopActions() {
    const v = VIEWS[S.platform];
    const p = $("#primaryBtn");
    p.replaceChildren(icon(v.primary.icon), h("span", null, v.primary.text));
    const s = $("#secondaryBtn");
    s.hidden = !v.secondary;
    if (v.secondary) s.textContent = v.secondary.text;
    $("#stageLabel").textContent = STAGE_LABEL[S.platform];
    $("#stageTools").replaceChildren(v.tools ? v.tools() : "");
  }
  function setPlatform(p) {
    if (!VIEWS[p]) return;
    S.platform = p; save();
    document.querySelectorAll("#platforms button").forEach(b => b.setAttribute("aria-selected", String(b.dataset.p === p)));
    article = null;
    cardIdx = 0;
    $("#main").dataset.platform = p;
    cardEls = [];
    syncTopActions();
    model = model || compute();
    renderInspector();
    render(true);
  }
  $("#platforms").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (b) setPlatform(b.dataset.p); });
  $("#primaryBtn").addEventListener("click", () => VIEWS[S.platform].primary.run());
  $("#secondaryBtn").addEventListener("click", () => VIEWS[S.platform].secondary && VIEWS[S.platform].secondary.run());

  /* 外观 */
  function applyTheme() {
    const root = document.documentElement;
    if (S.theme !== "dark") S.theme = "light"; // 默认浅色，不跟随系统深色模式
    root.dataset.theme = S.theme;
    const b = $("#themeBtn");
    b.replaceChildren(icon(S.theme === "dark" ? "moon" : "sun"));
    b.title = "外观：" + (S.theme === "dark" ? "深色" : "浅色") + "（点击切换）";
  }
  $("#themeBtn").addEventListener("click", () => {
    S.theme = S.theme === "dark" ? "light" : "dark";
    save(); applyTheme(); toast("外观：" + (S.theme === "dark" ? "深色" : "浅色"), 1200);
  });

  /* 菜单 */
  const menu = $("#fileMenu");
  function openMenu() {
    const r = $("#fileBtn").getBoundingClientRect();
    menu.style.left = r.left + "px"; menu.style.top = (r.bottom + 6) + "px";
    menu.classList.add("open");
  }
  const closeMenu = () => menu.classList.remove("open");
  $("#fileBtn").addEventListener("click", e => { e.stopPropagation(); menu.classList.contains("open") ? closeMenu() : openMenu(); });
  document.addEventListener("click", e => { if (!menu.contains(e.target)) closeMenu(); });
  menu.addEventListener("click", e => { const b = e.target.closest("button[data-act]"); if (!b) return; closeMenu(); ACTIONS[b.dataset.act](); });

  const ACTIONS = {
    async new() {
      if (S.md.trim() && !(await dialog({ title: "新建空白文稿？", text: "当前文稿会被清空。需要的话先在菜单里「下载 .md」备份。", ok: "新建", danger: true }))) return;
      setDoc("");
      if (S.mode === "md") E.focus(); else { document.activeElement && document.activeElement.blur(); focusIfEmpty(); }
    },
    open() { $("#fileInput").click(); },
    exportMd() { download(new Blob([S.md], { type: "text/markdown" }), safeName(model.title) + ".md"); },
    exportHtml() {
      const art = article || (() => { const a = h("section"); a.append(...compute().sem.el.childNodes); Render.decorate(a, tplById(S.wechat.template), wechatTweaks()); return a; })();
      const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + (model.title || "文章") + '</title></head><body style="margin:0;background:#fff"><div style="max-width:640px;margin:0 auto;padding:32px 20px 64px">' + Render.exportWechat(art) + "</div></body></html>";
      download(new Blob([html], { type: "text/html" }), safeName(model.title) + ".html");
    },
    obsidian() { pickFolder(true); },
    async imagesZip() {
      const list = model.images.filter(i => i.src && i.embedded);
      if (!list.length) return toast("文中没有本地图片");
      const files = list.map((img, i) => {
        const m = /^data:image\/([\w+]+);base64,(.*)$/.exec(img.src);
        if (!m) return null;
        const bin = atob(m[2]);
        const u8 = new Uint8Array(bin.length);
        for (let j = 0; j < bin.length; j++) u8[j] = bin.charCodeAt(j);
        return { name: String(i + 1).padStart(2, "0") + "." + (m[1] === "jpeg" ? "jpg" : m[1].replace("+xml", "")), data: u8 };
      }).filter(Boolean);
      download(await Cards.zip(files), safeName(model.title) + "-图片.zip");
      toast("已打包 " + files.length + " 张图片，按文中顺序编号");
    },
    async sample() {
      if (S.md.trim() && S.md !== window.SAMPLE_MD && !(await dialog({ title: "载入示例文稿？", text: "当前文稿会被替换。需要的话先在菜单里「下载 .md」备份。", ok: "载入" }))) return;
      setDoc(window.SAMPLE_MD);
    },
    keys() {
      const keys = [["加粗 / 强调", "⌘B / ⌘I"], ["链接", "⌘K"], ["高亮", "⌘⇧H"], ["切换平台", "⌘1 – ⌘5"], ["复制 / 导出当前平台", "⌘⇧C"], ["打开 Markdown", "⌘O"]];
      const mask = $("#dialog");
      dialog({ title: "快捷键", ok: "好", cancel: null });
      mask.firstElementChild.insertBefore(h("div", { class: "keys" }, keys.flatMap(([a, b]) => [h("span", null, a), h("kbd", null, b)])), mask.firstElementChild.querySelector(".acts"));
    }
  };

  /* ================= 编辑器 ================= */
  let E = null; // 编辑器接口（CodeMirror），启动时创建
  function setDoc(md) {
    md = Canvas.extractDataImages(md, storeDataImage);
    E.setValue(md);
    S.md = md; save();
    undoStack = []; redoStack = [];
    render(true);
  }
  function onEditorChange(md) { S.md = md; save(); scheduleRender(false); }

  function insert(text, selectFrom, selectTo) {
    const { from, to } = E.getSel();
    E.replace(from, to, text, selectFrom, selectTo);
  }
  function selectedText() { const { from, to } = E.getSel(); return E.getValue().slice(from, to); }
  function wrap(before, after, placeholder) {
    const sel = selectedText() || placeholder;
    insert(before + sel + after, before.length, before.length + sel.length);
  }
  function linePrefix(fn) {
    const v = E.getValue();
    const { from, to } = E.getSel();
    const a = v.lastIndexOf("\n", from - 1) + 1;
    let b = v.indexOf("\n", to);
    if (b < 0) b = v.length;
    E.replace(a, b, v.slice(a, b).split("\n").map(fn).join("\n"));
  }
  function block(text) {
    const v = E.getValue(), a = E.getSel().from;
    const pre = a > 0 && v[a - 1] !== "\n" ? "\n\n" : (a > 1 && v[a - 2] !== "\n" ? "\n" : "");
    insert(pre + text + "\n");
  }
  const FMT = {
    h2: () => linePrefix(l => "## " + l.replace(/^#+\s*/, "")),
    h3: () => linePrefix(l => "### " + l.replace(/^#+\s*/, "")),
    bold: () => wrap("**", "**", "加粗文字"),
    italic: () => wrap("*", "*", "强调文字"),
    mark: () => wrap("==", "==", "高亮文字"),
    link: () => { const sel = selectedText() || "链接文字"; insert("[" + sel + "](https://)", sel.length + 3, sel.length + 11); },
    quote: () => linePrefix(l => "> " + l),
    callout: () => block("> [!tip] 提示\n> 内容"),
    ul: () => linePrefix(l => "- " + l.replace(/^\s*([-*+]|\d+\.)\s+/, "")),
    ol: () => { let n = 0; linePrefix(l => (++n) + ". " + l.replace(/^\s*([-*+]|\d+\.)\s+/, "")); },
    code: () => block("```\n" + (selectedText() || "代码") + "\n```"),
    hr: () => block("---"),
    image: () => $("#imageInput").click()
  };
  $("#fmt").addEventListener("mousedown", e => { if (e.target.closest("[data-fmt]") && S.mode !== "md") e.preventDefault(); });
  $("#fmt").addEventListener("click", e => {
    const b = e.target.closest("[data-fmt]");
    if (!b) return;
    if (S.mode === "md") FMT[b.dataset.fmt]();
    else if (isCanvasPlatform() && article) CFMT[b.dataset.fmt]();
  });
  const EDITOR_KEYS = [
    { key: "Mod-b", run: () => (FMT.bold(), true) },
    { key: "Mod-i", run: () => (FMT.italic(), true) },
    { key: "Mod-k", run: () => (FMT.link(), true) },
    { key: "Mod-Shift-h", run: () => (FMT.mark(), true) }
  ];

  async function insertImages(files) {
    const unresolvedNames = new Set(model ? model.images.filter(i => i.unresolved).map(i => i.name) : []);
    let linked = 0;
    const md = [];
    for (const f of files) {
      const data = await compress(f);
      if (!data) continue;
      if (unresolvedNames.has(f.name)) { images.set("obs:" + f.name, data); IDB.put("obs:" + f.name, data); linked++; continue; }
      const id = newId();
      images.set("img:" + id, data);
      IDB.put("img:" + id, data);
      md.push("![](img://" + id + ")");
    }
    if (md.length) {
      if (S.mode !== "md" && isCanvasPlatform() && article) { article.focus(); insertBlocks(mdToNodes(md.join("\n\n"))); scheduleCanvasSync(true); }
      else block(md.join("\n\n"));
    }
    if (linked) { E.refreshImages(); toast("已补上 " + linked + " 张缺失的图片"); render(true); }
    else if (md.length && S.mode !== "md") toast(md.length > 1 ? "已插入 " + md.length + " 张图片" : "图片已插入，拖图片两侧的手柄可以调大小");
    else if (md.length) toast(md.length > 1 ? "已插入 " + md.length + " 张图片" : "图片已插入，拖图片右侧的手柄可以调大小");
  }
  function onEditorPaste(e) {
    const dt = e.clipboardData;
    if (!dt) return false;
    const text = dt.getData("text/plain");
    const files = [...dt.files].filter(f => f.type.startsWith("image/"));
    // 同时有文字和图片时（从 Word、网页复制），优先保留文字
    if (files.length && !text.trim()) { e.preventDefault(); insertImages(files); return true; }
    // 带 base64 图片的 Markdown：图片存入图片库，源稿里只留短记号
    if (/data:image\//.test(text)) { e.preventDefault(); insert(Canvas.extractDataImages(text, storeDataImage)); return true; }
    return false;
  }

  /* 图片宽度：预览里拖拽后写回源稿 */
  function commitImageWidth(index, width) {
    if (S.mode !== "md" && article) { applyWidthToPreview(index, width); syncCanvas(); }
    else E.setWidth(index, width);
  }
  function onEditorResized() {}

  /* 文件与拖放 */
  function readText(file) { return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsText(file); }); }
  async function openMd(file) {
    const text = await readText(file);
    if (S.md.trim() && S.md !== window.SAMPLE_MD && !(await dialog({ title: "打开「" + file.name + "」？", text: "当前文稿会被替换。需要的话先在菜单里「下载 .md」备份。", ok: "打开" }))) return;
    setDoc(text);
    toast("已打开 " + file.name);
  }
  $("#fileInput").addEventListener("change", e => { const f = e.target.files[0]; if (f) openMd(f); e.target.value = ""; });
  $("#imageInput").addEventListener("change", e => { insertImages([...e.target.files]); e.target.value = ""; });
  /* 图片文件夹：选一次就记住（存的是文件夹的「钥匙」，不是图片本身）。
     下次打开，浏览器允许时自动读；需要重新允许时，点一下缺图的占位框即可。
     只有 Chrome / Edge 支持记住；其他浏览器退回到每次手动选文件夹。 */
  const IMG_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i;
  async function scanDir(dir, depth = 0) {
    let n = 0;
    for await (const ent of dir.values()) {
      if (ent.name.startsWith(".") || ent.name === "node_modules") continue;
      if (ent.kind === "file") { if (IMG_RE.test(ent.name)) { obsFiles.set(ent.name, ent); n++; } }
      else if (depth < 8) n += await scanDir(ent, depth + 1);
    }
    return n;
  }
  async function useDir(dir, quiet) {
    let n = 0;
    try { n = await scanDir(dir); } catch (e) { return false; }
    dirReady = true;
    const need = model ? model.images.filter(i => i.unresolved && obsFiles.has(i.name)) : [];
    if (!quiet) toast(n ? "「" + dir.name + "」里找到 " + n + " 张图，" + (need.length ? "正在载入文中用到的 " + need.length + " 张" : "但没有文中缺的这几张，换个文件夹试试") : "这个文件夹里没有图片", 3200);
    need.forEach(i => loadObs(i.name));
    return true;
  }
  async function pickFolder(forceNew) {
    if (!window.showDirectoryPicker) return $("#folderInput").click();
    try {
      // 之前选过、只是这次打开还没允许：先问一次权限，不用重新找文件夹
      if (!forceNew && savedDir && !dirReady) {
        const ok = (await savedDir.requestPermission({ mode: "read" })) === "granted";
        if (ok && await useDir(savedDir)) {
          const still = model.images.filter(i => i.unresolved && !obsFiles.has(i.name));
          if (!still.length) return;
          toast("「" + savedDir.name + "」里没有其中 " + still.length + " 张，请再选一下它们所在的文件夹", 3600);
        }
      }
      const dir = await window.showDirectoryPicker({ id: "qingpai-images", mode: "read" });
      savedDir = dir; IDB.put(DIR_KEY, dir);
      await useDir(dir);
    } catch (e) { /* 用户取消 */ }
  }
  // 启动时：之前选过的文件夹如果仍被允许读取，直接用
  async function restoreDir() {
    if (!savedDir || !savedDir.queryPermission) return;
    try { if ((await savedDir.queryPermission({ mode: "read" })) === "granted") await useDir(savedDir, true); } catch (e) {}
  }
  // 回到顶部：滚下去一段后出现，点一下回到最上面（排版视图滚画布，Markdown 视图滚源码）
  const scrollBox = () => S.mode === "md" ? ($("#editor .cm-scroller") || $("#mdPane")) : $("#stage");
  const syncToTop = () => { $("#toTop").hidden = scrollBox().scrollTop < 240; };
  document.addEventListener("scroll", e => { if (e.target === $("#stage") || (e.target.classList && e.target.classList.contains("cm-scroller"))) syncToTop(); }, true);
  $("#toTop").addEventListener("click", () => { scrollBox().scrollTop = 0; syncToTop(); });
  // 点「图片没带过来」的占位框：选（或重新允许）图片所在的文件夹
  $("#stage").addEventListener("click", e => { if (e.target.closest(".img-miss")) { e.preventDefault(); pickFolder(); } });
  $("#folderInput").addEventListener("change", async e => {
    const files = [...e.target.files].filter(f => /\.(png|jpe?g|gif|webp|svg|bmp|avif)$/i.test(f.name));
    files.forEach(f => obsFiles.set(f.name, f));
    e.target.value = "";
    const need = model.images.filter(i => i.unresolved && obsFiles.has(i.name));
    toast(files.length ? "已关联 " + files.length + " 张附件，" + (need.length ? "正在载入文中用到的 " + need.length + " 张" : "当前文稿没有缺失的图片") : "这个文件夹里没有图片");
    need.forEach(i => loadObs(i.name));
  });
  let dragDepth = 0;
  const veil = $("#dropVeil");
  document.addEventListener("dragenter", e => { if ([...(e.dataTransfer.types || [])].includes("Files")) { dragDepth++; veil.classList.add("show"); } });
  document.addEventListener("dragleave", () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) veil.classList.remove("show"); });
  document.addEventListener("dragover", e => e.preventDefault());
  document.addEventListener("drop", e => {
    e.preventDefault();
    dragDepth = 0; veil.classList.remove("show");
    const files = [...(e.dataTransfer.files || [])];
    const md = files.find(f => /\.(md|markdown|txt)$/i.test(f.name));
    if (md) return openMd(md);
    const imgs = files.filter(f => f.type.startsWith("image/"));
    if (imgs.length) insertImages(imgs);
  });

  /* 全局快捷键 */
  document.addEventListener("keydown", e => {
    const mod = e.metaKey || e.ctrlKey;
    if (e.key === "Escape") closeMenu();
    if (!mod) return;
    if (/^[1-5]$/.test(e.key) && !e.shiftKey) { e.preventDefault(); setPlatform(["wechat", "xlsh", "xhs", "zhihu", "x"][+e.key - 1]); }
    else if (e.key.toLowerCase() === "c" && e.shiftKey) { e.preventDefault(); VIEWS[S.platform].primary.run(); }
    else if (e.key.toLowerCase() === "o" && !e.shiftKey) { e.preventDefault(); ACTIONS.open(); }
    else if (e.key.toLowerCase() === "s" && !e.shiftKey) { e.preventDefault(); toast("文稿会自动保存在这台电脑的浏览器里", 1600); }
  });

  /* 窄屏分页 */
  $("#mobileTabs").addEventListener("click", e => {
    const b = e.target.closest("button[data-v]"); if (!b) return;
    $("#main").dataset.view = b.dataset.v;
    document.querySelectorAll("#mobileTabs button").forEach(x => x.setAttribute("aria-selected", String(x === b)));
    if (b.dataset.v === "phone") setTimeout(fitPhone, 0);
  });

  /* ================= 启动 ================= */
  (async function boot() {
    applyTheme();
    if (S.md == null) S.md = window.SAMPLE_MD;
    try {
      await IDB.open();
      (await IDB.all()).forEach(([k, v]) => { if (k === DIR_KEY) savedDir = v; else images.set(k, v); });
    } catch (e) { /* 图片只在本次会话可用 */ }
    S.md = Canvas.extractDataImages(S.md, storeDataImage).replace(/(!\[[^\]]*\]\([^\s)]+)\s+"bxi:\d+:\d*"\)/g, "$1)");
    E = window.Editor.create($("#editor"), {
      doc: S.md, resolveImage, keys: EDITOR_KEYS, onChange: onEditorChange, onPaste: onEditorPaste, onResized: onEditorResized,
      placeholder: "Markdown 源码。图片会直接显示成图。"
    });
    initPhone();
    setTimeout(restoreDir, 400); // 首次渲染之后再读记住的图片文件夹
    $("#main").dataset.mode = S.mode;
    setPlatform(S.platform);
    if (S.mode === "md") setMode("md");
    setSaved(true);
  })();

  window.__banxin = { S, render, VIEWS, detectOverflow, renderPhone, get model() { return model; } }; // 调试与测试
})();
