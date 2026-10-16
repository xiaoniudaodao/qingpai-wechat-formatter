/* 轻排 · 图文卡片（小红书 / 公众号小绿书）
   3:4 卡片，设计尺寸 360×480，导出 ×3 = 1080×1440 PNG。
   正文自动分页：段落按句子切、列表按条切；Markdown 里的 --- 视为手动分页。 */
(function (root) {
  "use strict";
  const W = 360, H = 480;
  const SERIF = "'Songti SC','Noto Serif SC','Source Han Serif SC','STSong',Georgia,serif";
  const SANS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
  const MONO = "'SF Mono',Menlo,Consolas,monospace";
  const GEORGIA = "Georgia,'Times New Roman',serif";

  const STYLES = [
    { id: "paper", name: "纸本", vars: { bg: "#f6f3ec", fg: "#2a2622", muted: "#a0978b", muted2: "#6e665d", accent: "#b3412f", line: "#e3dccf", panel: "#eee8dc", mark: "#eadfc9", code: "#ece6da", strong: "#2a2622", title: SERIF, body: SANS, align: "left" }, swatches: ["#b3412f", "#8c6e4a", "#3f5e5a", "#2a2622"] },
    { id: "ink", name: "墨色", vars: { bg: "#151515", fg: "#edeae4", muted: "#7d7a74", muted2: "#b5b1a9", accent: "#d9b26a", line: "#2e2e2e", panel: "#1f1f1f", mark: "#4a3f2a", code: "#222222", strong: "#ffffff", title: SERIF, body: SANS, align: "center" }, swatches: ["#d9b26a", "#e07a5f", "#8fb9a8", "#edeae4"] },
    { id: "clean", name: "素净", vars: { bg: "#ffffff", fg: "#161616", muted: "#a3a3a3", muted2: "#5f5f5f", accent: "#1f6b55", line: "#ececec", panel: "#f4f5f3", mark: "#dcefe6", code: "#f3f3f3", strong: "#161616", title: SANS, body: SANS, align: "left" }, swatches: ["#1f6b55", "#2f4a7a", "#c2410c", "#161616"] },
    { id: "mist", name: "雾蓝", vars: { bg: "#e8edf1", fg: "#1e2a36", muted: "#8393a3", muted2: "#4d5d6e", accent: "#3d5a80", line: "#d3dce4", panel: "#dce4eb", mark: "#cddceb", code: "#dce3ea", strong: "#1e2a36", title: SANS, body: SANS, align: "left" }, swatches: ["#3d5a80", "#5b7f6e", "#9a5b4c", "#1e2a36"] },
    { id: "magazine", name: "杂志", vars: { bg: "#ffffff", fg: "#111111", muted: "#9a9a9a", muted2: "#555555", accent: "#c2202c", line: "#111111", panel: "#f3f3f3", mark: "#fbe3e4", code: "#f3f3f3", strong: "#111111", title: SANS, body: SANS, align: "left" }, swatches: ["#c2202c", "#111111", "#1f4e79", "#b07a12"], numbered: true }
  ];

  const CSS = `
.bx-card{width:${W}px;height:${H}px;box-sizing:border-box;padding:28px 28px 24px;display:flex;flex-direction:column;background:var(--bg);color:var(--fg);font-family:var(--body);overflow:hidden;letter-spacing:.3px;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
.bx-card *{box-sizing:border-box}
.bx-head{display:flex;justify-content:space-between;align-items:center;height:14px;flex:none;margin-bottom:20px;font-size:10px;letter-spacing:1.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.bx-page{font-family:${GEORGIA};letter-spacing:1px}
.bx-body{flex:1;min-height:0;overflow:hidden;font-size:14.5px;line-height:1.78;text-align:justify;word-break:break-word}
.bx-body>*:first-child{margin-top:0}
.bx-body p{margin:0 0 12px}
.bx-body h1,.bx-body h2{font-family:var(--title);font-size:19px;line-height:1.42;font-weight:700;margin:4px 0 12px;color:var(--fg);letter-spacing:.5px}
.bx-body h3{font-size:15.5px;line-height:1.5;font-weight:700;margin:4px 0 8px;color:var(--accent)}
.bx-body h4{font-size:14.5px;font-weight:700;margin:0 0 6px}
.bx-num{display:block;font-family:${GEORGIA};font-size:26px;line-height:1;font-weight:400;color:var(--accent);margin-bottom:8px}
.bx-body strong{color:var(--strong);font-weight:700}
.bx-body em{font-style:normal;color:var(--accent)}
.bx-body mark{background:var(--mark);color:inherit;padding:0 2px}
.bx-body a{color:inherit;text-decoration:none}
.bx-body del{opacity:.55}
.bx-body code{font-family:${MONO};font-size:.86em;background:var(--code);padding:1px 4px;border-radius:3px}
.bx-body pre{margin:0 0 12px;padding:10px 12px;background:var(--code);border-radius:4px;font-size:11px;line-height:1.6;white-space:pre-wrap;word-break:break-all;text-align:left}
.bx-body pre code{background:none;padding:0;font-size:11px}
.bx-body blockquote{margin:0 0 12px;padding:1px 0 1px 12px;border-left:2px solid var(--accent);color:var(--muted2)}
.bx-body blockquote p{margin:0 0 4px}
.bx-body [data-role=callout]{border-left:none;padding:10px 12px;background:var(--panel);border-radius:4px;color:var(--fg)}
.bx-body [data-role=callout-title]{font-size:12px;font-weight:700;letter-spacing:1px;color:var(--accent);margin:0 0 2px}
.bx-body ul,.bx-body ol{margin:0 0 12px;padding-left:1.25em}
.bx-body li{margin:0 0 5px;padding-left:.15em}
.bx-body li::marker{color:var(--accent)}
.bx-body li>p{margin:0}
.bx-body table{width:100%;border-collapse:collapse;font-size:11.5px;line-height:1.5;margin:0 0 12px}
.bx-body th,.bx-body td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}
.bx-body th{font-weight:700;border-bottom-color:var(--fg)}
.bx-body [data-role=figure]{margin:2px 0 12px}
.bx-body img{display:block;width:100%;max-height:300px;object-fit:cover;border-radius:3px}
.bx-body [data-role=caption]{margin:6px 0 0;font-size:11px;line-height:1.5;color:var(--muted);text-align:center}
.bx-body sup{font-size:9px;color:var(--accent);line-height:0}
.bx-body [data-role=footnotes]{border-top:1px solid var(--line);padding-top:8px;font-size:11px;line-height:1.6;color:var(--muted2)}
.bx-body [data-role=fn]{margin:0 0 4px}
.bx-body [data-unresolved]{display:none}
.bx-foot{flex:none;display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:10px;letter-spacing:1px;color:var(--muted)}
.bx-cover .bx-main{flex:1;display:flex;flex-direction:column;justify-content:center;text-align:var(--align)}
.bx-kicker{font-size:11px;letter-spacing:3px;color:var(--accent);margin-bottom:18px;font-weight:600}
.bx-title{font-family:var(--title);font-size:32px;line-height:1.32;font-weight:800;margin:0;letter-spacing:1px;color:var(--fg)}
.bx-rule{width:28px;height:2px;background:var(--accent);margin:24px 0}
.bx-cover[data-align=center] .bx-rule{margin:24px auto}
.bx-sub{font-size:13.5px;line-height:1.75;color:var(--muted2);margin:0}
.bx-card[data-style=magazine] .bx-title{font-weight:900;letter-spacing:0}
.bx-card[data-style=magazine] .bx-head{border-bottom:2px solid var(--fg);padding-bottom:8px;height:auto;color:var(--fg)}
.bx-card[data-style=magazine] .bx-foot{border-top:none}
.bx-card[data-style=ink] .bx-foot{border-top-color:#2a2a2a}
`;

  function styleById(id) { return STYLES.find(s => s.id === id) || STYLES[0]; }

  function makeCard(style, accent, opts, cover) {
    const v = Object.assign({}, style.vars, accent ? { accent } : {});
    const card = document.createElement("div");
    card.className = "bx-card" + (cover ? " bx-cover" : "");
    card.dataset.style = style.id;
    card.dataset.align = v.align;
    card.style.cssText = Object.entries(v).map(([k, val]) => "--" + k + ":" + val).join(";");
    const head = document.createElement("div");
    head.className = "bx-head";
    head.innerHTML = '<span class="bx-handle"></span><span class="bx-page"></span>';
    head.firstChild.textContent = opts.handle ? "@" + opts.handle.replace(/^@/, "") : (opts.brand || "");
    card.appendChild(head);
    return card;
  }

  function coverCard(style, accent, opts) {
    const card = makeCard(style, accent, opts, true);
    const main = document.createElement("div");
    main.className = "bx-main";
    if (opts.kicker) main.appendChild(el("div", "bx-kicker", opts.kicker));
    main.appendChild(el("h1", "bx-title", opts.title || "未命名"));
    if (opts.subtitle) { main.appendChild(el("div", "bx-rule", "")); main.appendChild(el("p", "bx-sub", opts.subtitle)); }
    card.appendChild(main);
    const foot = el("div", "bx-foot", "");
    foot.appendChild(el("span", "", opts.date || ""));
    foot.appendChild(el("span", "", "左滑阅读 →"));
    card.appendChild(foot);
    return card;
  }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
  }

  /* 句读边界（在文本节点里的位置） */
  function boundaries(node, strong) {
    const out = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    const re = strong ? /[。！？!?；;…]+[”」』）)]*/g : /[，,、：:]/g;
    while (walker.nextNode()) {
      const t = walker.currentNode;
      let m;
      re.lastIndex = 0;
      while ((m = re.exec(t.textContent))) out.push({ node: t, offset: m.index + m[0].length });
    }
    return out;
  }
  function charBoundaries(node) {
    const out = [];
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const t = walker.currentNode;
      for (let i = 8; i < t.textContent.length; i += 8) out.push({ node: t, offset: i });
    }
    return out;
  }
  function splitAt(node, b) {
    const r1 = document.createRange();
    r1.setStart(node, 0); r1.setEnd(b.node, b.offset);
    const r2 = document.createRange();
    r2.setStart(b.node, b.offset); r2.setEnd(node, node.childNodes.length);
    const a = node.cloneNode(false); a.appendChild(r1.cloneContents());
    const c = node.cloneNode(false); c.appendChild(r2.cloneContents());
    return [a, c];
  }
  const isEmpty = n => !n.textContent.trim() && !n.querySelector("img");

  /* 试着把块拆成「放得下的前半」+「剩下的」 */
  function trySplit(block, body, fits, fill) {
    const tag = block.tagName;
    if (tag === "UL" || tag === "OL") {
      const items = [...block.children];
      // 前后两段至少各留 2 条（空页除外），避免孤行
      const minKeep = body.children.length ? 2 : 1;
      for (let n = items.length - minKeep; n >= minKeep; n--) {
        const a = block.cloneNode(false); items.slice(0, n).forEach(i => a.appendChild(i.cloneNode(true)));
        body.appendChild(a);
        const ok = fits();
        body.removeChild(a);
        if (ok) {
          const c = block.cloneNode(false); items.slice(n).forEach(i => c.appendChild(i.cloneNode(true)));
          if (tag === "OL") c.setAttribute("start", (parseInt(block.getAttribute("start"), 10) || 1) + n);
          return [a, c];
        }
      }
      return null;
    }
    if (tag === "P" || (tag === "BLOCKQUOTE" && !block.dataset.role)) {
      const target = block;
      // 句号处断不开、而本页已过半时，整段挪到下一页，不在逗号处硬拆
      const levels = fill < 0.5 ? [boundaries(target, true), boundaries(target, false), charBoundaries(target)] : [boundaries(target, true)];
      for (const list of levels) {
        for (let i = list.length - 1; i >= 0; i--) {
          const [a, c] = splitAt(target, list[i]);
          if (isEmpty(a) || isEmpty(c)) continue;
          body.appendChild(a);
          const ok = fits();
          body.removeChild(a);
          if (ok) return [a, c];
        }
      }
    }
    return null;
  }

  async function waitImages(node) {
    await Promise.all([...node.querySelectorAll("img")].map(img => img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
  }

  /* semanticEl: Render.semantic().el；返回卡片元素数组 */
  async function build(semanticEl, opts) {
    const style = styleById(opts.style);
    const accent = opts.accent || null;
    const stage = document.createElement("div");
    stage.style.cssText = "position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;";
    if (!document.getElementById("bx-card-css")) {
      const st = document.createElement("style"); st.id = "bx-card-css"; st.textContent = CSS; document.head.appendChild(st);
    }
    document.body.appendChild(stage);

    const src = semanticEl.cloneNode(true);
    const titleEl = src.querySelector("[data-role=title]");
    if (titleEl) titleEl.remove();
    src.querySelectorAll("img[data-unresolved]").forEach(i => (i.closest("[data-role=figure]") || i).remove());
    src.querySelectorAll("img[data-w]").forEach(i => { i.style.width = Math.min(+i.dataset.w, W - 56) + "px"; i.style.margin = "0 auto"; });
    await waitImages(src);

    const cards = [];
    if (opts.cover !== false) {
      const c = coverCard(style, accent, opts);
      stage.appendChild(c);
      // 标题字号自适应
      const t = c.querySelector(".bx-title");
      const main = c.querySelector(".bx-main");
      for (let fs = 34; fs >= 22; fs -= 1) { t.style.fontSize = fs + "px"; if (main.scrollHeight <= main.clientHeight) break; }
      cards.push(c);
    }

    let card, body;
    let h2n = 0;
    const fits = () => body.scrollHeight <= body.clientHeight + 1;
    const fresh = () => {
      card = makeCard(style, accent, opts, false);
      body = el("div", "bx-body", "");
      card.appendChild(body);
      stage.appendChild(card);
      cards.push(card);
    };
    const finish = () => {
      // 小标题不留在页尾
      const last = body.lastElementChild;
      if (last && /^H[2-4]$/.test(last.tagName) && body.children.length > 1) { body.removeChild(last); return last; }
      return null;
    };
    fresh();

    const queue = [...src.children];
    let guard = 0;
    while (queue.length && guard++ < 2000) {
      let block = queue.shift();
      if (block.tagName === "HR") { if (body.children.length) { const carry = finish(); fresh(); if (carry) body.appendChild(carry); } continue; }
      if (block.tagName === "H2" && style.numbered && !block.dataset.numbered) {
        h2n++;
        block.dataset.numbered = "1";
        const num = el("span", "bx-num", (h2n < 10 ? "0" : "") + h2n);
        block.prepend(num);
      }
      body.appendChild(block);
      if (fits()) continue;
      body.removeChild(block);
      const lastEl = body.lastElementChild;
      const fill = lastEl ? (lastEl.getBoundingClientRect().bottom - body.getBoundingClientRect().top) / body.clientHeight : 0;
      const parts = trySplit(block, body, fits, fill);
      if (parts) {
        body.appendChild(parts[0]);
        queue.unshift(parts[1]);
        const carry = finish(); fresh(); if (carry) body.appendChild(carry);
        continue;
      }
      if (!body.children.length) {
        // 单块放不下（大图/长表）：压缩图片高度，或任其截断
        body.appendChild(block);
        block.querySelectorAll("img").forEach(img => { img.style.maxHeight = (body.clientHeight - 40) + "px"; img.style.objectFit = "contain"; });
        fresh();
        continue;
      }
      const carry = finish();
      fresh();
      if (carry) body.appendChild(carry);
      queue.unshift(block);
    }
    if (!body.children.length && cards.length > 1) { cards.pop(); card.remove(); }

    const total = cards.length;
    cards.forEach((c, i) => {
      c.querySelector(".bx-page").textContent = (i + 1 < 10 ? "0" : "") + (i + 1) + " / " + (total < 10 ? "0" : "") + total;
    });
    stage.remove();
    return cards;
  }

  /* ---------- 导出 PNG（SVG foreignObject → canvas） ---------- */
  async function toBlob(card, scale = 3) {
    const clone = card.cloneNode(true);
    clone.style.transform = "";
    const xhtml = new XMLSerializer().serializeToString(clone);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W * scale + '" height="' + H * scale + '" viewBox="0 0 ' + W + " " + H + '">' +
      '<foreignObject x="0" y="0" width="' + W + '" height="' + H + '"><div xmlns="http://www.w3.org/1999/xhtml"><style>' + CSS + "</style>" + xhtml + "</div></foreignObject></svg>";
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, W * scale, H * scale);
    return new Promise((resolve, reject) => {
      try { canvas.toBlob(b => (b ? resolve(b) : reject(new Error("toBlob 失败"))), "image/png"); }
      catch (e) { reject(e); }
    });
  }

  /* ---------- 极简 ZIP（store，不压缩；PNG 本身已压缩） ---------- */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  async function zip(files) {
    const enc = new TextEncoder();
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const time = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const date = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(await f.data.arrayBuffer());
      const name = enc.encode(f.name);
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, time, true); lh.setUint16(12, date, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(lh.buffer, name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, time, true); ch.setUint16(14, date, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(ch.buffer, name);
      offset += 30 + name.length + data.length;
    }
    const size = central.reduce((s, p) => s + (p.byteLength || p.length), 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
  }

  root.Cards = { STYLES, CSS, W, H, build, toBlob, zip, styleById };
})(window);
