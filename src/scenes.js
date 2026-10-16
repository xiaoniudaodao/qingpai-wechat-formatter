/* 轻排 · 场景版式与版式目录
   - 四套场景版式：快讯（娱乐）、种草（电商）、夜读（情感）、展签（艺术）
   - 每套版式的「封面卡」：只画最有辨识度的元素，用于版式选择器
   - 场景标签、色调归类、多组配色 */
(function (root) {
  "use strict";
  const { base, marker, MONO, GEORGIA, LINING } = root.TemplateKit;
  const SERIF = "'Songti SC','Noto Serif SC','Source Han Serif SC','STSong',Georgia,serif";
  const SANS = "-apple-system,BlinkMacSystemFont,'PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";
  const ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII", "XIII", "XIV", "XV"];
  // 价格：¥199 / ￥19.9 / 199元（不误伤「元素」「元旦」等）
  const PRICE = /[¥￥]\s?\d+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?\s?元(?![素旦宵气宇代老])/g;
  const ZW = "​";

  /* ---------------- 快讯 · 娱乐 ---------------- */
  const kuaixun = {
    id: "kuaixun", name: "快讯", note: "娱乐 · 大字报 · 爆点",
    defaults: { accent: "#111111", fontSize: 16, lineHeight: 1.8, font: "sans" },
    palettes: [
      { name: "黑黄", accent: "#111111", hl: "#ffe600", pop: "#ff2e7e", popText: "#111111", tone: "bright" },
      { name: "玫红", accent: "#c8005a", hl: "#ffe1ee", pop: "#c8005a", popText: "#ffffff", tone: "pink" },
      { name: "电光蓝", accent: "#1f3cff", hl: "#dcf2ff", pop: "#1f3cff", popText: "#ffffff", tone: "cool" }
    ],
    styles: k => {
      const p = k.pal.hl ? k.pal : { hl: k.tint(k.accent, 0.18), pop: k.accent, popText: "#ffffff" };
      return base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#222;letter-spacing:0.3px;text-align:justify;word-break:break-word;padding:0 4px;",
        p: "margin:0 0 22px;",
        h1: "margin:0 0 26px;font-size:" + (k.fs + 12) + "px;line-height:1.25;font-weight:900;color:#111;letter-spacing:0;",
        h2: "display:inline-block;margin:0 0 16px;padding:6px 12px;background-color:" + k.accent + ";color:#fff;font-size:" + (k.fs + 3) + "px;line-height:1.4;font-weight:900;letter-spacing:0.5px;",
        h3: "display:inline-block;margin:28px 0 12px;padding:0 2px;border-bottom:4px solid " + p.hl + ";font-size:" + (k.fs + 1) + "px;line-height:1.4;font-weight:800;color:#111;",
        strong: "background-color:" + p.hl + ";color:#111;font-weight:800;padding:0 3px;",
        em: "font-style:normal;color:#111;border-bottom:2px solid " + p.pop + ";",
        mark: "background-color:" + p.pop + ";color:" + p.popText + ";padding:0 3px;",
        a: "color:#111;text-decoration:none;border-bottom:2px solid " + p.hl + ";",
        quote: "margin:24px 0;padding:14px 16px;background-color:#f3f3f3;border-radius:4px 16px 16px 16px;color:#333;font-size:" + (k.fs - 1) + "px;",
        quoteP: "margin:0 0 6px;",
        callout: "margin:28px 0;padding:16px;border:2px solid #111;border-bottom-width:5px;background-color:#fff;",
        calloutTitle: "display:inline-block;margin:0 0 10px;padding:2px 8px;background-color:" + p.hl + ";color:#111;font-size:13px;font-weight:800;",
        calloutP: "margin:0;font-size:" + k.fs + "px;color:#222;",
        li: "margin:0 0 10px;padding-left:1.5em;",
        hr: "display:none;",
        th: "padding:9px 10px;background-color:#111;color:#fff;font-weight:700;text-align:left;",
        td: "padding:9px 10px;border-bottom:1px solid #eee;color:#222;",
        figure: "margin:28px 0;text-align:center;",
        img: "display:block;max-width:100%;height:auto;margin:0 auto;border:3px solid #111;border-radius:0;",
        caption: "margin:8px 0 0;font-size:12px;line-height:1.6;color:#111;text-align:left;font-weight:700;letter-spacing:0;",
        sup: "font-size:11px;line-height:0;color:#111;font-weight:700;margin-left:1px;",
        notesTitle: "display:inline-block;margin:0 0 10px;padding:2px 8px;background-color:#111;color:#fff;font-size:12px;font-weight:800;letter-spacing:1px;",
        notes: "margin:44px 0 0;padding-top:16px;border-top:3px solid #111;",
        pre: "margin:0 0 22px;padding:16px;background-color:#111;font-size:13px;line-height:1.7;text-align:left;",
        preCode: "font-family:" + MONO + ";font-size:13px;background:transparent;color:#f2f2f2;padding:0;white-space:pre-wrap;word-break:break-all;letter-spacing:0;",
        codeTheme: "dark"
      });
    },
    decorate: {
      h2(el, i, { k, deco }) {
        const p = k.pal.hl ? k.pal : { pop: k.accent, popText: "#ffffff" };
        const tag = deco("p", "margin:40px 0 8px;line-height:1;text-align:left;");
        tag.appendChild(deco("span", "display:inline-block;padding:4px 8px;background-color:" + p.pop + ";color:" + p.popText + ";font-size:12px;font-weight:800;letter-spacing:1px;", "看点 " + k.pad2(i)));
        el.before(tag);
      },
      hr(el, { deco }) { el.after(deco("p", "margin:36px 0;text-align:center;font-size:12px;font-weight:800;letter-spacing:4px;color:#111;", "▼ 继续往下看 ▼")); },
      figure(el, i, { deco }) {
        const cap = el.querySelector("[data-role=caption]");
        if (cap && cap.style.display !== "none") cap.prepend(deco("span", "", "▲ "));
      },
      end(rootEl, { deco }) {
        const p = deco("p", "margin:44px 0 0;text-align:center;");
        p.appendChild(deco("span", "display:inline-block;padding:4px 16px;background-color:#111;color:#fff;font-size:12px;font-weight:800;letter-spacing:4px;", "END"));
        rootEl.appendChild(p);
      }
    },
    marker: ({ ordered, index }, k) => ordered
      ? { text: k.pad2(index), pad: "32px", css: "display:inline-block;width:24px;height:20px;line-height:20px;margin:0 8px 0 -32px;background-color:" + k.accent + ";color:#fff;font-size:11px;font-weight:800;text-align:center;letter-spacing:0;vertical-align:1px;" }
      : marker("▶", "font-size:10px;vertical-align:2px;color:" + (k.pal.pop || k.accent) + ";")
  };

  /* ---------------- 种草 · 电商 ---------------- */
  const zhongcao = {
    id: "zhongcao", name: "种草", note: "电商 · 价签 · 优惠券",
    defaults: { accent: "#e8402f", fontSize: 15, lineHeight: 1.85, font: "sans" },
    labels: { quote: "★★★★★ 真实体验" },
    palettes: [
      { name: "珊瑚", accent: "#e8402f", deep: "#b9281a", soft: "#fff1ee", tone: "warm" },
      { name: "橙光", accent: "#f26a10", deep: "#a84600", soft: "#fff4ea", tone: "warm" },
      { name: "樱粉", accent: "#e9537a", deep: "#b02c4c", soft: "#fff0f4", tone: "pink" },
      { name: "薄荷", accent: "#14a37f", deep: "#0b6a52", soft: "#eaf8f2", tone: "cool" }
    ],
    styles: k => {
      const p = k.pal.deep ? k.pal : { deep: k.shade(k.accent, 0.3), soft: k.tint(k.accent, 0.08) };
      return base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#333;letter-spacing:0.3px;text-align:justify;word-break:break-word;padding:0 4px;",
        p: "margin:0 0 22px;",
        h1: "margin:0 0 24px;font-size:" + (k.fs + 9) + "px;line-height:1.4;font-weight:800;color:#1a1a1a;",
        h2: "margin:40px 0 16px;padding:9px 14px;background-color:" + p.soft + ";border-radius:8px;font-size:" + (k.fs + 2) + "px;line-height:1.5;font-weight:800;color:" + p.deep + ";",
        h3: "margin:26px 0 10px;font-size:" + (k.fs + 1) + "px;line-height:1.5;font-weight:700;color:#1a1a1a;",
        strong: "font-weight:700;color:" + p.deep + ";",
        em: "font-style:normal;color:" + p.deep + ";",
        mark: "background-color:" + p.soft + ";color:" + p.deep + ";border-bottom:2px solid " + k.accent + ";padding:0 2px;",
        a: "color:" + p.deep + ";text-decoration:none;border-bottom:1px solid " + k.accent + ";",
        del: "color:#aaa;text-decoration:line-through;",
        quote: "margin:24px 0;padding:14px 16px;background-color:#fafafa;border-radius:10px;color:#555;font-size:" + (k.fs - 1) + "px;",
        quoteP: "margin:0 0 6px;",
        callout: "margin:26px 0;padding:14px 16px;border:1.5px dashed " + k.accent + ";border-radius:10px;background-color:" + p.soft + ";text-align:center;",
        calloutTitle: "margin:0 0 4px;font-size:" + (k.fs + 5) + "px;line-height:1.4;font-weight:800;color:" + p.deep + ";letter-spacing:1px;",
        calloutP: "margin:0;font-size:" + (k.fs - 2) + "px;color:#666;",
        li: "margin:0 0 8px;padding-left:1.5em;",
        hr: "border:none;border-top:1px dashed " + k.tint(k.accent, 0.45) + ";margin:32px 0;",
        th: "padding:9px 10px;background-color:" + p.deep + ";color:#fff;font-weight:700;text-align:center;",
        td: "padding:9px 10px;border-bottom:1px solid #f0f0f0;color:#333;text-align:center;",
        figure: "margin:26px 0;text-align:center;",
        img: "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:10px;",
        caption: "margin:8px 0 0;font-size:12px;line-height:1.6;color:#999;text-align:center;"
      });
    },
    decorate: {
      h2(el, i, { k, deco }) {
        const deep = k.pal.deep || k.shade(k.accent, 0.3);
        el.prepend(deco("span", "display:inline-block;width:22px;height:22px;line-height:22px;margin:0 8px 0 0;border-radius:11px;background-color:" + deep + ";color:#fff;font-size:12px;font-weight:700;text-align:center;vertical-align:1px;letter-spacing:0;", String(i)));
      },
      quote(el, { k, deco }) {
        const deep = k.pal.deep || k.shade(k.accent, 0.3);
        el.prepend(k.label("quote", "p", "margin:0 0 6px;font-size:12px;font-weight:700;color:" + deep + ";letter-spacing:1px;"));
      },
      body(rootEl, { k, wrapMatches }) {
        const deep = k.pal.deep || k.shade(k.accent, 0.3);
        wrapMatches(rootEl, PRICE, "color:" + deep + ";font-weight:800;font-size:1.12em;");
      },
      end(rootEl, { k, deco }) {
        const deep = k.pal.deep || k.shade(k.accent, 0.3);
        const p = deco("p", "margin:40px 0 0;text-align:center;");
        p.appendChild(deco("span", "display:inline-block;padding:9px 26px;border-radius:22px;background-color:" + deep + ";color:#fff;font-size:14px;font-weight:700;letter-spacing:1px;", "点击「阅读原文」查看详情"));
        rootEl.appendChild(p);
      }
    },
    marker: ({ ordered, index }, k) => {
      const p = k.pal.deep ? k.pal : { deep: k.shade(k.accent, 0.3), soft: k.tint(k.accent, 0.08) };
      return ordered
        ? { text: String(index), pad: "28px", css: "display:inline-block;width:18px;height:18px;line-height:18px;margin:0 10px 0 -28px;border-radius:9px;background-color:" + p.soft + ";color:" + p.deep + ";font-size:11px;font-weight:700;text-align:center;vertical-align:1px;letter-spacing:0;" }
        : marker("✓", "font-weight:800;color:" + p.deep + ";");
    }
  };

  /* ---------------- 夜读 · 情感 ---------------- */
  const yedu = {
    id: "yedu", name: "夜读", note: "情感 · 信笺 · 慢节奏",
    defaults: { accent: "#c48a8f", fontSize: 15, lineHeight: 2.0, font: "sans" },
    palettes: [
      { name: "豆沙", accent: "#c48a8f", deep: "#8d555b", soft: "#faf3f1", tone: "pink" },
      { name: "灰绿", accent: "#8aa595", deep: "#4f6b5b", soft: "#f1f5f2", tone: "cool" },
      { name: "雾蓝", accent: "#8d9cc0", deep: "#4e5d83", soft: "#f1f3f9", tone: "cool" },
      { name: "暖杏", accent: "#c9a27a", deep: "#7d5d3b", soft: "#faf5ee", tone: "warm" }
    ],
    styles: k => {
      const p = k.pal.deep ? k.pal : { deep: k.shade(k.accent, 0.4), soft: k.tint(k.accent, 0.08) };
      return base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#4a4545;letter-spacing:1px;text-align:justify;word-break:break-word;padding:0 8px;",
        p: "margin:0 0 28px;",
        h1: "margin:16px 0 40px;font-size:" + (k.fs + 6) + "px;line-height:1.5;font-weight:500;color:#3e3838;text-align:center;letter-spacing:4px;",
        h2: "margin:56px 0 28px;font-size:" + (k.fs + 2) + "px;line-height:1.5;font-weight:500;color:#3e3838;text-align:center;letter-spacing:5px;",
        h3: "margin:36px 0 16px;font-size:" + k.fs + "px;line-height:1.6;font-weight:600;color:" + p.deep + ";text-align:center;letter-spacing:2px;",
        strong: "font-weight:600;color:" + p.deep + ";",
        em: "font-style:normal;color:" + p.deep + ";",
        mark: "background-color:" + p.soft + ";color:inherit;border-bottom:1px solid " + k.accent + ";padding:0 2px;",
        a: "color:" + p.deep + ";text-decoration:none;border-bottom:1px solid " + k.accent + ";",
        quote: "margin:36px 0;padding:26px 22px 22px;background-color:" + p.soft + ";border-radius:4px;text-align:center;color:#5a5050;font-size:" + k.fs + "px;line-height:2;",
        quoteP: "margin:0 0 6px;",
        callout: "margin:36px 0;padding:22px;background-color:" + p.soft + ";border-radius:4px;",
        calloutTitle: "margin:0 0 10px;font-size:13px;font-weight:500;letter-spacing:3px;color:" + p.deep + ";text-align:center;",
        calloutP: "margin:0;font-size:" + k.fs + "px;color:#5a5050;",
        li: "margin:0 0 10px;padding-left:1.5em;",
        hr: "display:none;",
        th: "padding:8px 10px;border-bottom:1px solid " + k.accent + ";font-weight:500;color:#3e3838;text-align:left;",
        td: "padding:8px 10px;border-bottom:1px solid #f0ebe8;color:#4a4545;",
        figure: "margin:40px 0;text-align:center;",
        img: "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:6px;",
        caption: "margin:10px 0 0;font-size:12px;line-height:1.7;color:" + p.deep + ";text-align:center;letter-spacing:1px;",
        notes: "margin:56px 0 0;padding-top:16px;border-top:1px solid " + p.soft + ";",
        notesTitle: "margin:0 0 8px;font-size:12px;letter-spacing:3px;color:" + p.deep + ";text-align:center;"
      });
    },
    decorate: {
      h2(el, i, { k, deco }) {
        el.prepend(deco("span", "display:block;margin-bottom:10px;font-family:" + GEORGIA + ";font-style:italic;font-size:12px;font-weight:400;letter-spacing:2px;color:" + (k.pal.deep || k.shade(k.accent, 0.4)) + ";", "— " + k.pad2(i) + " —"));
      },
      quote(el, { k, deco }) {
        el.prepend(deco("p", "margin:0 0 6px;font-family:" + GEORGIA + ";font-size:40px;line-height:0.8;color:" + k.accent + ";", "“"));
      },
      hr(el, { k, deco }) { el.after(deco("p", "margin:44px 0;text-align:center;font-size:14px;letter-spacing:10px;color:" + k.accent + ";", "· · ·")); },
      end(rootEl, { k, deco }) {
        rootEl.appendChild(deco("p", "margin:52px 0 0;text-align:center;font-family:" + GEORGIA + ";font-style:italic;font-size:13px;letter-spacing:3px;color:" + (k.pal.deep || k.shade(k.accent, 0.4)) + ";", "· END ·"));
      }
    },
    marker: ({ ordered, index }, k) => ordered
      ? marker(index + ".", "font-family:" + GEORGIA + ";color:" + (k.pal.deep || k.accent) + ";")
      : marker("·", "font-weight:700;color:" + k.accent + ";")
  };

  /* ---------------- 展签 · 艺术 ---------------- */
  const zhanqian = {
    id: "zhanqian", name: "展签", note: "艺术 · 画廊 · 作品信息",
    defaults: { accent: "#1a1a1a", fontSize: 16, lineHeight: 1.95, font: "serif" },
    palettes: [
      { name: "纸墨", accent: "#1a1a1a", paper: "#f7f5f0", tone: "mono" },
      { name: "朱红", accent: "#b23a2e", paper: "#f8f3ee", tone: "warm" },
      { name: "克莱因蓝", accent: "#002fa7", paper: "#f2f4f9", tone: "cool" }
    ],
    styles: k => {
      const paper = k.pal.paper || k.tint(k.accent, 0.05);
      return base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#2a2a2a;letter-spacing:0.5px;text-align:justify;word-break:break-word;padding:0 6px;",
        p: "margin:0 0 24px;",
        h1: "margin:8px 0 36px;font-size:" + (k.fs + 12) + "px;line-height:1.35;font-weight:400;color:#1a1a1a;letter-spacing:2px;",
        h2: "margin:60px 0 24px;font-size:" + (k.fs + 5) + "px;line-height:1.45;font-weight:400;color:#1a1a1a;letter-spacing:2px;",
        h3: "margin:32px 0 12px;font-family:" + SANS + ";font-size:14px;line-height:1.6;font-weight:600;color:#1a1a1a;letter-spacing:3px;",
        strong: "font-weight:600;color:#1a1a1a;",
        em: "font-style:normal;color:" + k.accent + ";",
        mark: "background-color:" + paper + ";color:inherit;padding:0 2px;",
        a: "color:#1a1a1a;text-decoration:none;border-bottom:1px solid #bbb;",
        quote: "margin:40px 0;padding:0 1.5em;color:#555;font-size:" + (k.fs + 1) + "px;text-align:left;",
        quoteP: "margin:0 0 8px;",
        callout: "margin:36px 0;padding:20px 22px;background-color:" + paper + ";border:1px solid #e3ded3;",
        calloutTitle: "margin:0 0 8px;font-family:" + GEORGIA + ";font-size:12px;letter-spacing:3px;text-transform:uppercase;color:" + k.accent + ";",
        calloutP: "margin:0;font-size:" + (k.fs - 1) + "px;",
        li: "margin:0 0 8px;padding-left:1.5em;",
        hr: "display:none;",
        table: "width:100%;border-collapse:collapse;margin:0 0 28px;font-size:" + (k.fs - 2) + "px;line-height:1.6;",
        th: "padding:8px;border-top:1.5px solid #1a1a1a;border-bottom:0.5px solid #1a1a1a;font-weight:600;text-align:left;color:#1a1a1a;",
        td: "padding:8px;border-bottom:0.5px solid #e3ded3;color:#2a2a2a;",
        figure: "margin:48px 0;text-align:left;",
        img: "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:0;",
        caption: "margin:14px 0 0;font-size:13px;line-height:1.7;color:#1a1a1a;text-align:left;letter-spacing:0.5px;",
        sup: "font-size:11px;line-height:0;color:" + k.accent + ";margin-left:1px;",
        notes: "margin:60px 0 0;padding-top:16px;border-top:0.5px solid #1a1a1a;",
        notesTitle: "margin:0 0 8px;font-family:" + GEORGIA + ";font-size:12px;letter-spacing:3px;text-transform:uppercase;color:" + k.accent + ";text-align:left;",
        pre: "margin:0 0 24px;padding:16px;background-color:" + paper + ";font-size:13px;line-height:1.7;text-align:left;"
      });
    },
    decorate: {
      h2(el, i, { k, deco }) {
        el.prepend(deco("span", "display:block;margin-bottom:10px;font-family:" + GEORGIA + ";font-size:13px;font-weight:400;letter-spacing:3px;color:" + k.accent + ";", (ROMAN[i - 1] || i) + "."));
        el.appendChild(deco("span", "display:block;width:24px;margin:18px 0 0;border-top:1px solid " + k.accent + ";font-size:0;line-height:0;", ZW));
      },
      figure(el, i, { k, deco }) {
        // 图注写成「作品名，年份，材质，尺寸」时，排成博物馆展签
        const cap = el.querySelector("[data-role=caption]");
        if (!cap || cap.style.display === "none") return;
        const plate = deco("p", "margin:8px 0 0;font-family:" + GEORGIA + ";font-size:11px;letter-spacing:3px;color:" + k.accent + ";text-align:left;", "PLATE " + (ROMAN[i - 1] || i));
        const parts = cap.textContent.split(/\s*[，,／/｜|·]\s*/).map(s => s.trim()).filter(Boolean);
        if (parts.length < 2) { cap.after(plate); return; }
        cap.style.display = "none";
        const label = deco("section", "margin:14px 0 0;text-align:left;");
        label.appendChild(deco("p", "margin:0;font-size:14px;line-height:1.6;color:#1a1a1a;letter-spacing:0.5px;", parts[0]));
        label.appendChild(deco("p", "margin:2px 0 0;font-family:" + SANS + ";font-size:12px;line-height:1.7;color:#777;letter-spacing:0.5px;", parts.slice(1).join(" · ")));
        label.appendChild(plate);
        cap.after(label);
      },
      quote(el, { k, deco }) {
        el.prepend(deco("p", "margin:0 0 4px;font-family:" + GEORGIA + ";font-size:32px;line-height:0.8;color:" + k.accent + ";", "“"));
      },
      hr(el, { k, deco }) { el.after(deco("p", "margin:48px 0;text-align:center;font-size:12px;color:" + k.accent + ";", "◇")); },
      end(rootEl, { k, deco }) {
        rootEl.appendChild(deco("p", "margin:56px 0 0;text-align:center;font-family:" + GEORGIA + ";font-size:12px;letter-spacing:6px;color:" + k.accent + ";", "FIN"));
      }
    },
    marker: ({ ordered, index }, k) => ordered
      ? marker((ROMAN[index - 1] || String(index)).toLowerCase() + ".", "font-family:" + GEORGIA + ";font-style:italic;color:" + k.accent + ";", "2em")
      : marker("–", "color:#999;")
  };

  root.TEMPLATES.push(kuaixun, zhongcao, yedu, zhanqian);

  /* ---------------- 场景与色调 ---------------- */
  const SCENES = ["深度", "教程", "商业", "人文", "情感", "艺术", "种草", "娱乐", "生活", "笔记"];
  const SCENE_OF = {
    bianjibu: ["深度", "教程", "商业"], subai: ["深度", "生活"], kanwu: ["深度", "商业"], zhusha: ["人文", "艺术"],
    gewu: ["教程"], jianbao: ["商业"], richang: ["生活", "情感"], shouji: ["笔记", "教程"],
    kuaixun: ["娱乐"], zhongcao: ["种草", "生活"], yedu: ["情感", "人文"], zhanqian: ["艺术", "人文"]
  };
  const TONES = [["mono", "黑白", "#1a1a1a"], ["warm", "暖色", "#c8643c"], ["cool", "冷色", "#3a6ea5"], ["pink", "粉调", "#e48aa0"], ["bright", "亮色", "#ffd400"]];

  function toneOf(hex) {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    if (s < 0.12 || l < 0.16) return "mono";
    let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    const red = h >= 345 || h < 15;
    if ((h >= 285 && h < 345) || (red && l > 0.6)) return "pink";
    if (red) return "warm";
    if (h < 48) return "warm";
    if (h < 75) return "bright";
    return "cool";
  }
  function palettesOf(tpl) {
    return (tpl.palettes || tpl.swatches.map(a => ({ accent: a }))).map(p => Object.assign({ tone: toneOf(p.accent) }, p));
  }

  /* ---------------- 封面卡：每套版式最有辨识度的样子 ---------------- */
  const bar = (w, c, mt) => '<i style="display:block;height:4px;border-radius:2px;width:' + w + '%;background:' + (c || "#e6e6e6") + ';margin-top:' + (mt || 5) + 'px"></i>';
  const COVERS = {
    bianjibu: k => '<div style="padding:14px 12px 0;height:100%;display:flex;flex-direction:column;background:#fff">' +
      '<div style="font:10px/1 ' + MONO + ';letter-spacing:.05em;color:#111">01 / 03</div>' +
      '<div style="font:300 22px/1.15 ' + SANS + ';color:#030303;margin-top:9px">留白的<br>力量</div>' +
      '<svg viewBox="0 0 120 10" preserveAspectRatio="none" style="display:block;width:100%;height:9px;margin-top:11px"><line x1="0" y1="5" x2="120" y2="5" stroke="#030303" stroke-width=".7"/><rect x="0" y="2" width="6" height="6" fill="#030303"/><rect x="114" y="2" width="6" height="6" fill="#030303"/><rect x="58" y="3" width="4" height="4" fill="' + k.accent + '" stroke="#030303" stroke-width=".5"/></svg>' +
      bar(92, "#ececec", 12) + bar(80, "#ececec") +
      '<div style="margin:auto -12px 0;background:' + k.accent + ';padding:10px 12px 12px;font:10px/1.4 ' + MONO + ';color:#111">QUOTE · 摘录' + bar(85, "rgba(0,0,0,.18)", 7) + '</div></div>',
    subai: k => '<div style="padding:16px 13px;height:100%;display:flex;flex-direction:column;background:#fff">' +
      '<div style="font:11px/1 ' + GEORGIA + ';letter-spacing:2px;color:' + (k.accent === "#1a1a1a" ? "#8c8c8c" : k.accent) + '">01</div>' +
      '<div style="font:600 15px/1.4 ' + SANS + ';color:#1a1a1a;margin-top:6px">慢下来，<br>写一篇长文</div>' +
      bar(95, "#ededed", 12) + bar(88, "#ededed") + bar(92, "#ededed") +
      '<div style="border-left:2px solid #d9d9d9;padding-left:7px;margin-top:10px">' + bar(80, "#e2e2e2", 0) + bar(55, "#e2e2e2") + '</div>' +
      '<div style="margin-top:auto;text-align:right;font:11px/1 ' + SANS + ';color:#a0a0a0">（完）</div></div>',
    kanwu: k => '<div style="padding:14px 12px;height:100%;display:flex;flex-direction:column;background:#fff">' +
      '<div style="border-top:3px solid #111;padding-top:7px;font:30px/1 ' + GEORGIA + ';color:' + k.accent + '">01</div>' +
      '<div style="font:800 15px/1.35 ' + SANS + ';color:#111;margin-top:5px">观点的<br>分量</div>' +
      '<div style="margin-top:auto;border-top:1px solid #111;border-bottom:1px solid #111;padding:9px 2px;text-align:center;font:700 12px/1.5 ' + SANS + ';color:#111">金句要<br>站得住</div></div>',
    zhusha: k => '<div style="padding:14px 13px 12px;height:100%;display:flex;flex-direction:column;align-items:center;background:#fbf8f2">' +
      '<div style="font:10px/1 ' + SERIF + ';color:' + k.accent + ';letter-spacing:.3em">壹</div>' +
      '<div style="font:15px/1.3 ' + SERIF + ';color:#2b2b2b;letter-spacing:.32em;margin-top:6px;white-space:nowrap">山中岁月</div>' +
      '<div style="width:16px;border-top:1px solid ' + k.accent + ';margin-top:7px"></div>' +
      '<div style="width:100%;margin-top:9px">' + bar(100, "#e6dfd2", 0) + bar(94, "#e6dfd2") + bar(70, "#e6dfd2") + '</div>' +
      '<div style="width:100%;background:#f3ece0;padding:8px 9px;margin-top:9px;font:11px/1.6 ' + SERIF + ';color:#5a5048;letter-spacing:.08em">「' + '<span style="color:' + k.accent + '">一窗</span>春色，半卷闲书」</div>' +
      '<div style="font:10px/1 ' + SERIF + ';color:' + k.tint(k.accent, 0.7) + ';letter-spacing:6px;margin-top:9px">·〇·</div>' +
      '<div style="margin-top:auto;border:1.2px solid ' + k.accent + ';color:' + k.accent + ';font:10px/1.2 ' + SERIF + ';padding:2px 4px;border-radius:2px">终</div></div>',
    gewu: k => '<div style="padding:12px;height:100%;display:flex;flex-direction:column;gap:6px;background:#fff">' +
      '<div style="font:700 13px/1.4 ' + SANS + ';color:#1f2329;border-bottom:1px solid #e5e6eb;padding-bottom:5px">3 步上手</div>' +
      ['安装依赖', '写配置'].map((t, i) => '<div style="display:flex;gap:6px;align-items:center;font:11px/1 ' + SANS + ';color:#333"><b style="color:' + k.accent + ';font-weight:700">' + (i + 1) + '.</b>' + t + '</div>').join("") +
      '<div style="background:#1f2329;color:#a5d6a7;font:10px/1.5 ' + MONO + ';padding:6px 7px;border-radius:3px">$ npm run dev</div>' +
      '<div style="margin-top:auto;border-left:3px solid ' + k.accent + ';background:' + k.tint(k.accent, 0.07) + ';font:11px/1.4 ' + SANS + ';color:' + k.accent + ';padding:4px 6px;font-weight:700">提示</div></div>',
    jianbao: k => '<div style="padding:12px;height:100%;display:flex;flex-direction:column;background:#fff">' +
      '<div style="font:10px/1 ' + LINING + ';color:#c8962e;letter-spacing:.15em">PART 01</div>' +
      '<div style="align-self:flex-start;background:' + k.accent + ';color:#fff;font:600 12px/1 ' + SANS + ';padding:5px 8px;margin-top:6px">季度复盘</div>' +
      '<div style="display:flex;align-items:baseline;gap:4px;margin-top:12px"><span style="font:300 28px/1 ' + LINING + ';color:' + k.accent + '">68%</span><span style="font:10px ' + SANS + ';color:#888">同比</span></div>' +
      '<div style="display:flex;align-items:flex-end;gap:4px;height:40px;margin-top:auto"><i style="flex:1;background:#dde1e6;height:40%"></i><i style="flex:1;background:#dde1e6;height:62%"></i><i style="flex:1;background:' + k.accent + ';height:100%"></i></div></div>',
    richang: k => '<div style="padding:16px 12px;height:100%;display:flex;flex-direction:column;align-items:center;text-align:center;background:#fff">' +
      '<div style="font:italic 11px/1 ' + GEORGIA + ';color:' + k.accent + '">No. 01</div>' +
      '<div style="font:500 14px/1.5 ' + SANS + ';color:#4a4541;letter-spacing:3px;margin-top:6px">周末的<br>小日子</div>' +
      '<div style="border-top:1px solid #e8e2da;border-bottom:1px solid #e8e2da;padding:9px 0;margin-top:12px;width:100%;font:11px/1.7 ' + SANS + ';color:#7a716a">慢慢来<br>比较快</div>' +
      '<div style="margin-top:auto;font:italic 11px ' + GEORGIA + ';color:' + k.accent + '">fin.</div></div>',
    shouji: k => '<div style="padding:12px;height:100%;display:flex;flex-direction:column;background:#fff">' +
      '<div style="font:10px/1 ' + MONO + ';color:' + k.accent + ';letter-spacing:1px">NOTE 01</div>' +
      '<div style="font:700 14px/1.4 ' + SANS + ';color:#222;border-bottom:1px dashed #cfcfcf;padding:4px 0 6px">读书笔记</div>' +
      '<div style="font:11px/1.8 ' + SANS + ';color:#333;margin-top:6px">→ 先写<span style="background:#fff1b8">结论</span><br>→ 再补例子</div>' +
      '<div style="margin-top:auto;border:1px dashed #bdbdbd;border-radius:4px;padding:6px 7px"><div style="font:9px/1 ' + MONO + ';color:' + k.accent + '">批注</div>' + bar(80, "#e6e6e6", 5) + '</div></div>',
    kuaixun: k => {
      const p = k.pal.hl ? k.pal : { hl: k.tint(k.accent, 0.18), pop: k.accent, popText: "#fff" };
      return '<div style="padding:12px;height:100%;display:flex;flex-direction:column;background:#fff">' +
        '<div style="align-self:flex-start;background:' + p.pop + ';color:' + p.popText + ';font:800 10px/1 ' + SANS + ';padding:4px 6px;letter-spacing:1px">看点 01</div>' +
        '<div style="font:900 19px/1.25 ' + SANS + ';color:#111;margin-top:8px">官宣了！<br>这次<span style="background:' + p.hl + ';padding:0 2px">终于</span><br>公开</div>' +
        '<div style="align-self:flex-start;background:' + k.accent + ';color:#fff;font:900 12px/1 ' + SANS + ';padding:5px 8px;margin-top:10px">最新进展</div>' +
        '<div style="margin-top:auto;border:2px solid #111;border-bottom-width:4px;padding:5px 6px;font:700 10px/1.3 ' + SANS + ';color:#111">爆料卡 · 3 个细节</div></div>';
    },
    zhongcao: k => {
      const p = k.pal.deep ? k.pal : { deep: k.shade(k.accent, 0.3), soft: k.tint(k.accent, 0.08) };
      return '<div style="padding:12px;height:100%;display:flex;flex-direction:column;background:#fff">' +
        '<div style="font:800 13px/1.35 ' + SANS + ';color:#1a1a1a">这支精华<br>值不值得买？</div>' +
        '<div style="border:1px solid #f0f0f0;border-radius:8px;padding:7px;margin-top:8px;display:flex;gap:7px;align-items:center"><i style="width:28px;height:36px;background:' + p.soft + ';border-radius:4px;flex:none"></i>' +
        '<div><div style="font:10px/1.3 ' + SANS + ';color:#666">修护精华 30ml</div><div style="font:800 15px/1.2 ' + SANS + ';color:' + p.deep + '">¥199 <s style="font-size:10px;font-weight:400;color:#aaa">299</s></div></div></div>' +
        '<div style="border:1.2px dashed ' + k.accent + ';background:' + p.soft + ';color:' + p.deep + ';font:800 11px/1 ' + SANS + ';text-align:center;padding:6px;margin-top:8px;border-radius:6px">满 200 减 30</div>' +
        '<div style="margin-top:auto;background:' + p.deep + ';color:#fff;font:700 11px/1 ' + SANS + ';text-align:center;padding:6px;border-radius:12px">阅读原文</div></div>';
    },
    yedu: k => {
      const p = k.pal.deep ? k.pal : { deep: k.shade(k.accent, 0.4), soft: k.tint(k.accent, 0.08) };
      return '<div style="padding:14px 12px;height:100%;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;background:' + p.soft + '">' +
        '<div style="font:38px/.6 ' + GEORGIA + ';color:' + k.accent + '">“</div>' +
        '<div style="font:13px/1.95 ' + SANS + ';color:#5a5050;letter-spacing:1px;margin-top:8px">后来才明白<br>温柔是一种<br>很慢的力量</div>' +
        '<div style="font:italic 10px ' + GEORGIA + ';color:' + k.accent + ';margin-top:12px;letter-spacing:3px">· END ·</div></div>';
    },
    zhanqian: k => {
      const paper = k.pal.paper || k.tint(k.accent, 0.05);
      return '<div style="padding:12px;height:100%;display:flex;flex-direction:column;background:#fff">' +
        '<div style="height:74px;background:' + paper + ';display:flex;align-items:center;justify-content:center"><i style="width:34px;height:44px;background:#d8d2c6;display:block"></i></div>' +
        '<div style="font:13px/1.4 ' + SERIF + ';color:#1a1a1a;margin-top:9px">《晨光中的静物》</div>' +
        '<div style="font:10px/1.6 ' + SANS + ';color:#777">1923 · 布面油画 · 81×65 cm</div>' +
        '<div style="margin-top:auto;font:10px/1 ' + GEORGIA + ';color:' + k.accent + ';letter-spacing:3px">PLATE I</div></div>';
    }
  };

  root.TEMPLATES.forEach(t => {
    t.scenes = SCENE_OF[t.id] || [];
    t.cover = COVERS[t.id];
    if (!t.swatches && t.palettes) t.swatches = t.palettes.map(p => p.accent);
  });

  root.TemplateMeta = { SCENES, TONES, toneOf, palettesOf };
})(window);
