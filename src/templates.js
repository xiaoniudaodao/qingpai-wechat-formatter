/* 轻排 · 公众号版式
   只用公众号保留的内联 CSS：margin/padding/border/background-color/color/font/letter-spacing/line-height/text-align/inline-block。
   不用渐变、阴影、伪元素、position、超过 4px 的圆角。 */
(function (root) {
  "use strict";
  const GEORGIA = "Georgia,'Times New Roman',serif";
  const MONO = "'SF Mono',Menlo,Consolas,monospace";
  const LINING = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const CN_CAP = "壹贰叁肆伍陆柒捌玖拾";

  /* 各版式共享的基础样式，版式只覆盖有个性的部分 */
  function base(k, o) {
    const gap = Math.round(k.fs * 1.5);
    return Object.assign({
      root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#3a3a3a;letter-spacing:0.5px;text-align:justify;word-break:break-word;padding:0 4px;",
      p: "margin:0 0 " + gap + "px;",
      h1: "margin:0 0 32px;font-size:" + (k.fs + 8) + "px;line-height:1.4;font-weight:700;color:#1a1a1a;text-align:left;",
      h2: "margin:48px 0 20px;font-size:" + (k.fs + 2) + "px;line-height:1.5;font-weight:600;color:#1a1a1a;text-align:left;",
      h3: "margin:32px 0 12px;font-size:" + (k.fs + 1) + "px;line-height:1.5;font-weight:600;color:#1a1a1a;",
      h4: "margin:24px 0 10px;font-size:" + k.fs + "px;line-height:1.5;font-weight:600;color:#555;",
      strong: "font-weight:600;color:#111;",
      em: "font-style:normal;color:" + k.accent + ";",
      mark: "background-color:" + k.tint(k.accent, 0.14) + ";color:inherit;padding:0 2px;",
      a: "color:" + k.accent + ";text-decoration:none;border-bottom:1px solid " + k.tint(k.accent, 0.45) + ";",
      code: "font-family:" + MONO + ";font-size:0.88em;background-color:#f4f4f2;color:#444;padding:2px 4px;border-radius:3px;",
      quote: "margin:28px 0;padding:0 0 0 16px;border-left:2px solid #d9d9d9;color:#8c8c8c;",
      quoteP: "margin:0 0 8px;",
      ul: "margin:0 0 " + gap + "px;padding-left:0;list-style:none;",
      ol: "margin:0 0 " + gap + "px;padding-left:0;list-style:none;",
      li: "margin:0 0 8px;padding-left:1.5em;",
      hr: "border:none;border-top:1px solid #d9d9d9;width:40px;margin:40px auto;",
      table: "width:100%;border-collapse:collapse;margin:0 0 " + gap + "px;font-size:" + (k.fs - 2) + "px;line-height:1.6;",
      th: "padding:8px 10px;border-bottom:1.5px solid #1a1a1a;font-weight:600;text-align:left;color:#1a1a1a;",
      td: "padding:8px 10px;border-bottom:1px solid #eaeaea;color:#444;",
      figure: "margin:32px 0;text-align:center;",
      img: "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:2px;",
      caption: "margin:10px 0 0;font-size:12px;line-height:1.6;color:#a0a0a0;text-align:center;letter-spacing:0.5px;",
      callout: "margin:28px 0;padding:16px 18px;background-color:#f7f7f5;border-radius:2px;",
      calloutTitle: "margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:1px;color:#1a1a1a;",
      calloutP: "margin:0;font-size:" + (k.fs - 1) + "px;color:#555;",
      sup: "font-size:11px;line-height:0;color:" + k.accent + ";margin-left:1px;",
      notes: "margin:48px 0 0;padding-top:16px;border-top:1px solid #e6e6e6;",
      notesTitle: "margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:2px;color:#1a1a1a;text-align:left;",
      note: "margin:0 0 4px;font-size:12px;line-height:1.7;color:#8c8c8c;text-align:left;",
      pre: "margin:0 0 " + gap + "px;padding:16px;background-color:#f6f6f4;border-radius:4px;font-size:13px;line-height:1.7;text-align:left;",
      preCode: "font-family:" + MONO + ";font-size:13px;background:transparent;color:#333;padding:0;white-space:pre-wrap;word-break:break-all;letter-spacing:0;",
      codeTheme: "light"
    }, o);
  }
  const block = (css, text) => ({ css: "display:block;" + css, text });
  const marker = (text, css, width = "1.5em") => ({ text, pad: width, css: "display:inline-block;width:" + width + ";margin-left:-" + width + ";white-space:nowrap;letter-spacing:0;" + (css || "") });

  /* 「编辑部」用到的符号：标尺分隔线（公众号支持内联 SVG） */
  const INK = "#030303";
  function ruler(panel, nodes) {
    const marks = (nodes ? [85, 170, 255] : []).map(x => '<rect x="' + (x - 4) + '" y="10" width="8" height="8" fill="' + panel + '" stroke="' + INK + '" stroke-width="1"/>').join("");
    return '<svg width="100%" height="28" viewBox="0 0 340 28" preserveAspectRatio="none" style="display:block;">' +
      '<line x1="0" y1="14" x2="340" y2="14" stroke="' + INK + '" stroke-width="1"/>' +
      '<rect x="0" y="8" width="12" height="12" fill="' + INK + '"/><rect x="328" y="8" width="12" height="12" fill="' + INK + '"/>' + marks + "</svg>";
  }
  const kicker = (size, extra) => "display:block;font-family:" + MONO + ";font-size:" + size + "px;font-weight:400;line-height:1.4;letter-spacing:0.03em;text-transform:uppercase;color:#111;" + (extra || "");

  const TEMPLATES = [
    {
      id: "bianjibu", name: "编辑部", note: "细体 · 等宽 · 面板",
      defaults: { accent: "#f6eada", fontSize: 16, lineHeight: 1.95, font: "sans" },
      swatches: ["#f6eada", "#dad9d5", "#e3ebdd", "#e0e7ee", "#f1e1dc"],
      labels: { notes: "NOTES / 注释", refs: "LINKS / 参考", quote: "QUOTE · 摘录" },
      styles: k => {
        const panel = "margin:44px 0;padding:34px 18px;background-color:" + k.accent + ";";
        return base(k, {
          root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";font-weight:350;color:" + INK + ";letter-spacing:-0.2px;text-align:left;word-break:break-word;padding:0 4px;",
          p: "margin:0 0 22px;",
          h1: "margin:0 0 24px;font-size:" + (k.fs + 22) + "px;line-height:1.18;font-weight:300;letter-spacing:0.5px;color:" + INK + ";",
          h2: "margin:72px 0 22px;font-size:" + (k.fs + 12) + "px;line-height:1.25;font-weight:300;letter-spacing:0.4px;color:" + INK + ";",
          h3: "margin:40px 0 14px;font-size:" + (k.fs + 3) + "px;line-height:1.5;font-weight:500;letter-spacing:0;color:" + INK + ";",
          h4: kicker(13, "margin:32px 0 12px;"),
          strong: "font-weight:600;color:" + INK + ";",
          em: "font-style:normal;color:" + INK + ";border-bottom:1px solid " + INK + ";padding-bottom:1px;",
          mark: "background-color:" + k.accent + ";color:inherit;padding:1px 2px;",
          a: "color:" + INK + ";text-decoration:none;border-bottom:1px solid " + INK + ";",
          code: "font-family:" + MONO + ";font-size:0.875em;letter-spacing:0.3px;color:" + INK + ";background:none;padding:0 1px;",
          quote: panel + "font-size:" + (k.fs + 4) + "px;line-height:1.95;font-weight:350;color:" + INK + ";",
          quoteP: "margin:0 0 8px;",
          li: "margin:0 0 10px;padding-left:22px;",
          hr: "display:none;",
          table: "width:100%;border-collapse:collapse;margin:0 0 28px;font-size:" + (k.fs - 2) + "px;line-height:1.6;",
          th: "padding:10px 8px;border-bottom:1px solid " + INK + ";font-family:" + MONO + ";font-size:12px;font-weight:400;letter-spacing:0.03em;text-transform:uppercase;text-align:left;color:#111;",
          td: "padding:10px 8px;border-bottom:1px solid #e3e1dc;color:" + INK + ";",
          figure: "margin:44px 0;text-align:center;",
          img: "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:0;",
          caption: kicker(12, "margin:12px 0 0;text-align:left;text-transform:none;"),
          callout: panel,
          calloutTitle: kicker(12, "margin:0 0 18px;padding-bottom:14px;border-bottom:1px solid " + INK + ";"),
          calloutP: "margin:0 0 8px;font-size:" + (k.fs + 1) + "px;",
          sup: "font-family:" + MONO + ";font-size:10px;line-height:0;color:" + INK + ";margin-left:1px;",
          notes: "margin:72px 0 0;padding-top:18px;border-top:1px solid " + INK + ";",
          notesTitle: kicker(12, "margin:0 0 12px;"),
          note: "margin:0 0 6px;font-size:12px;line-height:1.7;color:#555;text-align:left;",
          pre: "margin:0 0 28px;padding:18px 16px;background-color:#f4f3f0;font-size:13px;line-height:1.7;text-align:left;",
          preCode: "font-family:" + MONO + ";font-size:13px;background:transparent;color:#222;padding:0;white-space:pre-wrap;word-break:break-all;letter-spacing:0;"
        });
      },
      decorate: {
        h1(el, { k, deco }) {
          const r = deco("section", "margin:28px 0 8px;");
          r.innerHTML = ruler(k.accent, true);
          el.appendChild(r);
        },
        h2(el, i, { k, deco, h2Total }) {
          el.prepend(deco("span", kicker(13, "margin-bottom:12px;"), k.pad2(i) + " / " + k.pad2(h2Total)));
        },
        h3(el, i, { deco }) {
          el.prepend(deco("span", "display:inline-block;width:8px;height:8px;margin:0 10px 3px 0;background-color:" + INK + ";vertical-align:middle;font-size:0;line-height:0;", "\u200b"));
        },
        quote(el, { k, deco }) {
          if (el.textContent.trim().length > 120) el.style.fontSize = (k.fs + 1) + "px";
          el.prepend(k.label("quote", "p", kicker(12, "margin:0 0 18px;")));
        },
        hr(el, { k, deco }) {
          const r = deco("section", "margin:48px 0;");
          r.innerHTML = ruler(k.accent, true);
          el.after(r);
        },
        figure(el, i, { deco }) {
          const cap = el.querySelector("[data-role=caption]");
          if (cap && cap.style.display !== "none") cap.prepend(deco("span", "font-family:" + MONO + ";text-transform:uppercase;", "PLATE " + (i < 10 ? "0" : "") + i + " · "));
        },
        end(rootEl, { k, deco }) {
          const r = deco("section", "margin:64px 0 0;");
          r.innerHTML = ruler(k.accent, false);
          rootEl.appendChild(r);
        }
      },
      marker: ({ ordered, index, depth }) => ordered
        ? { text: String(index), pad: "34px", css: "display:inline-block;width:22px;height:22px;line-height:22px;margin:4px 12px 0 -34px;vertical-align:top;background-color:" + INK + ";color:#fff;font-family:" + MONO + ";font-size:12px;font-weight:400;letter-spacing:0;text-align:center;" }
        : { text: "\u200b", pad: "22px", css: "display:inline-block;width:6px;height:6px;margin:0 16px 3px -22px;vertical-align:middle;font-size:0;line-height:0;" + (depth ? "width:4px;height:4px;border:1px solid " + INK + ";" : "background-color:" + INK + ";") }
    },
    {
      id: "subai", name: "素白", note: "留白 · 安静 · 长文",
      defaults: { accent: "#1a1a1a", fontSize: 16, lineHeight: 1.9, font: "sans" },
      swatches: ["#1a1a1a", "#1f6b55", "#2f4a7a", "#9a3b2e", "#7a5c3e"],
      styles: k => base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#3a3a3a;letter-spacing:0.5px;text-align:justify;word-break:break-word;padding:0 4px;",
        em: "font-style:normal;color:#1a1a1a;border-bottom:1px solid #cfcfcf;",
        a: "color:#1a1a1a;text-decoration:none;border-bottom:1px solid " + (k.accent === "#1a1a1a" ? "#bdbdbd" : k.accent) + ";"
      }),
      decorate: {
        h2(el, i, { k, deco }) {
          const c = k.accent === "#1a1a1a" ? "#8c8c8c" : k.accent;
          el.prepend(deco("span", "display:block;margin-bottom:6px;font-family:" + GEORGIA + ";font-size:13px;font-weight:400;letter-spacing:2px;color:" + c + ";", k.pad2(i)));
        },
        end(rootEl, { deco }) { rootEl.appendChild(deco("p", "margin:40px 0 0;font-size:13px;color:#a0a0a0;text-align:right;letter-spacing:1px;", "（完）")); }
      },
      marker: ({ ordered, index, depth }, k) => ordered
        ? marker(index + ".", "font-family:" + GEORGIA + ";color:#8c8c8c;")
        : marker(depth ? "·" : "—", "color:#8c8c8c;")
    },
    {
      id: "kanwu", name: "刊物", note: "杂志 · 粗线 · 金句",
      defaults: { accent: "#b8202a", fontSize: 16, lineHeight: 1.85, font: "sans" },
      swatches: ["#b8202a", "#111111", "#1f4e79", "#2e5e4e", "#8a5a00"],
      styles: k => base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#2a2a2a;letter-spacing:0.5px;text-align:justify;word-break:break-word;padding:0 4px;",
        h1: "margin:0 0 32px;padding-bottom:16px;border-bottom:1px solid #111;font-size:" + (k.fs + 10) + "px;line-height:1.35;font-weight:800;color:#111;letter-spacing:0.5px;",
        h2: "margin:52px 0 20px;padding-top:14px;border-top:3px solid #111;font-size:" + (k.fs + 4) + "px;line-height:1.45;font-weight:700;color:#111;",
        h3: "margin:32px 0 12px;font-size:" + (k.fs + 1) + "px;line-height:1.5;font-weight:700;color:#111;",
        strong: "font-weight:700;color:#111;",
        em: "font-style:normal;color:" + k.accent + ";",
        quote: "margin:36px 0;padding:20px 4px;border-top:1px solid #111;border-bottom:1px solid #111;text-align:center;font-size:" + (k.fs + 3) + "px;line-height:1.6;font-weight:700;color:#111;",
        quoteP: "margin:0;",
        hr: "border:none;border-top:1px solid #111;width:60px;margin:44px auto;",
        th: "padding:9px 10px;background-color:#111;color:#fff;font-weight:600;text-align:left;",
        td: "padding:9px 10px;border-bottom:1px solid #ddd;color:#333;",
        caption: "margin:10px 0 0;padding-left:8px;border-left:2px solid " + k.accent + ";font-size:12px;line-height:1.6;color:#888;text-align:left;",
        callout: "margin:32px 0;padding:16px 18px;border:1px solid #111;",
        calloutTitle: "margin:0 0 6px;font-size:12px;font-weight:700;letter-spacing:3px;color:" + k.accent + ";",
        notesTitle: "margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:3px;color:" + k.accent + ";",
        notes: "margin:48px 0 0;padding-top:14px;border-top:3px solid #111;",
        pre: "margin:0 0 24px;padding:16px;background-color:#161616;font-size:13px;line-height:1.7;text-align:left;",
        preCode: "font-family:" + MONO + ";font-size:13px;background:transparent;color:#e8e6e1;padding:0;white-space:pre-wrap;word-break:break-all;letter-spacing:0;",
        codeTheme: "dark"
      }),
      decorate: {
        h2(el, i, { k, deco }) {
          el.prepend(deco("span", "display:block;margin-bottom:4px;font-family:" + GEORGIA + ";font-size:30px;line-height:1.1;font-weight:400;color:" + k.accent + ";", k.pad2(i)));
        },
        h3(el, i, { k, deco }) {
          el.prepend(deco("span", "display:inline-block;width:7px;height:7px;margin:0 9px 3px 0;background-color:" + k.accent + ";vertical-align:middle;font-size:0;line-height:0;", "\u200b"));
        },
        quote(el, { k, s }) {
          // 长引用不适合做金句，退回到左线样式
          if (el.textContent.trim().length > 90) {
            el.style.cssText = "margin:28px 0;padding:0 0 0 16px;border-left:2px solid " + k.accent + ";color:#666;";
            el.querySelectorAll("p").forEach(p => { p.style.cssText = s.quoteP; });
          }
        },
        end(rootEl, { k, deco }) {
          const last = [...rootEl.children].reverse().find(n => n.tagName === "P" && !n.dataset.deco && n.style.display !== "none");
          if (last) last.appendChild(deco("span", "display:inline-block;width:9px;height:9px;margin-left:6px;background-color:" + k.accent + ";vertical-align:middle;font-size:0;line-height:0;", "\u200b"));
        }
      },
      marker: ({ ordered, index }, k) => ordered
        ? marker(index + ".", "font-family:" + GEORGIA + ";font-weight:700;color:" + k.accent + ";", index > 9 ? "1.9em" : "1.5em")
        : marker("■", "font-size:9px;vertical-align:2px;color:" + k.accent + ";")
    },
    {
      id: "zhusha", name: "朱砂", note: "书卷 · 宋体 · 留白",
      defaults: { accent: "#b3412f", fontSize: 16, lineHeight: 2.0, font: "serif" },
      swatches: ["#b3412f", "#9c2f2f", "#8c6e4a", "#3f5e5a", "#2b2b2b"],
      labels: { notes: "注", refs: "引" },
      styles: k => base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#3a3530;letter-spacing:1px;text-align:justify;word-break:break-word;padding:0 6px;",
        h1: "margin:8px 0 40px;font-size:" + (k.fs + 6) + "px;line-height:1.5;font-weight:700;color:#2b2b2b;text-align:center;letter-spacing:4px;",
        h2: "margin:56px 0 28px;font-size:" + (k.fs + 2) + "px;line-height:1.5;font-weight:600;color:#2b2b2b;text-align:center;letter-spacing:4px;",
        h3: "margin:36px 0 14px;font-size:" + k.fs + "px;line-height:1.6;font-weight:600;color:#2b2b2b;letter-spacing:2px;",
        strong: "font-weight:600;color:" + k.accent + ";",
        em: "font-style:normal;color:#8c6e4a;",
        mark: "background-color:#f3ece0;color:inherit;padding:0 2px;",
        quote: "margin:32px 0;padding:18px 20px;background-color:#f5f0e6;color:#5a5048;border-radius:2px;",
        hr: "display:none;",
        th: "padding:8px 10px;background-color:#f5f0e6;border:1px solid #d9cfc1;font-weight:600;color:#2b2b2b;text-align:center;",
        td: "padding:8px 10px;border:1px solid #d9cfc1;color:#3a3530;",
        caption: "margin:10px 0 0;font-size:12px;line-height:1.6;color:#8c6e4a;text-align:center;letter-spacing:1px;",
        callout: "margin:32px 0;padding:18px 20px;background-color:#f5f0e6;border-radius:2px;",
        calloutTitle: "margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:2px;color:" + k.accent + ";",
        notes: "margin:56px 0 0;padding-top:16px;border-top:1px solid #d9cfc1;",
        notesTitle: "margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:4px;color:" + k.accent + ";text-align:left;",
        note: "margin:0 0 4px;font-size:12px;line-height:1.8;color:#8c7f70;text-align:left;"
      }),
      decorate: {
        h1(el, { k, deco }) {
          el.appendChild(deco("span", "display:block;width:24px;margin:18px auto 0;border-top:2px solid " + k.accent + ";font-size:0;line-height:0;", "\u200b"));
        },
        h2(el, i, { k, deco }) {
          el.prepend(deco("span", "display:block;margin-bottom:8px;font-size:13px;font-weight:400;letter-spacing:2px;color:" + k.accent + ";", CN_CAP[i - 1] || String(i)));
          el.appendChild(deco("span", "display:block;width:20px;margin:14px auto 0;border-top:1px solid " + k.accent + ";font-size:0;line-height:0;", "\u200b"));
        },
        h3(el, i, { k, deco }) {
          el.prepend(deco("span", "color:" + k.accent + ";", "「"));
          el.appendChild(deco("span", "color:" + k.accent + ";", "」"));
        },
        hr(el, { k, deco }) {
          el.after(deco("p", "margin:44px 0;text-align:center;font-size:13px;letter-spacing:10px;color:" + k.tint(k.accent, 0.7) + ";", "·〇·"));
        },
        end(rootEl, { k, deco }) {
          const p = deco("p", "margin:48px 0 0;text-align:center;");
          p.appendChild(deco("span", "display:inline-block;padding:3px 7px;border:1.5px solid " + k.accent + ";border-radius:2px;font-size:13px;line-height:1.3;letter-spacing:0;color:" + k.accent + ";", "终"));
          rootEl.appendChild(p);
        }
      },
      marker: ({ ordered, index }, k) => ordered
        ? marker(k.cnNumber(index) + "、", "color:" + k.accent + ";", index > 10 ? "3.2em" : "2.2em")
        : marker("·", "font-weight:700;color:" + k.accent + ";")
    },
    {
      id: "gewu", name: "格物", note: "科技 · 清晰 · 教程",
      defaults: { accent: "#d7282a", fontSize: 16, lineHeight: 1.75, font: "sans" },
      swatches: ["#d7282a", "#1d5fd6", "#0f7b6c", "#e8590c", "#1f2329"],
      styles: k => base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#333;letter-spacing:0.3px;text-align:justify;word-break:break-word;padding:0 4px;",
        h1: "margin:0 0 28px;font-size:" + (k.fs + 8) + "px;line-height:1.4;font-weight:700;color:#1f2329;",
        h2: "margin:44px 0 18px;padding-bottom:8px;border-bottom:1px solid #e5e6eb;font-size:" + (k.fs + 4) + "px;line-height:1.45;font-weight:700;color:#1f2329;",
        h3: "margin:30px 0 12px;padding-left:9px;border-left:3px solid " + k.accent + ";font-size:" + (k.fs + 1) + "px;line-height:1.3;font-weight:700;color:#1f2329;",
        strong: "font-weight:700;color:#1f2329;",
        mark: "background-color:#fff4c2;color:inherit;padding:0 2px;",
        code: "font-family:" + MONO + ";font-size:0.88em;background-color:#f2f3f5;color:" + k.shade(k.accent, 0.1) + ";padding:2px 5px;border-radius:3px;",
        quote: "margin:24px 0;padding:12px 16px;background-color:#f6f7f9;border-left:3px solid #c9cdd4;color:#646a73;",
        quoteP: "margin:0 0 4px;",
        hr: "border:none;border-top:1px solid #e5e6eb;margin:36px 0;",
        th: "padding:8px 10px;background-color:#f6f7f9;border:1px solid #e5e6eb;font-weight:600;text-align:left;color:#1f2329;",
        td: "padding:8px 10px;border:1px solid #e5e6eb;color:#333;",
        img: "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:4px;",
        caption: "margin:8px 0 0;font-size:13px;line-height:1.6;color:#8f959e;text-align:center;",
        callout: "margin:24px 0;padding:14px 16px;background-color:" + k.tint(k.accent, 0.06) + ";border-left:3px solid " + k.accent + ";",
        calloutTitle: "margin:0 0 4px;font-size:14px;font-weight:700;color:" + k.accent + ";",
        calloutP: "margin:0;font-size:" + (k.fs - 1) + "px;color:#444;",
        pre: "margin:0 0 24px;padding:16px;background-color:#1f2329;border-radius:4px;font-size:13px;line-height:1.7;text-align:left;",
        preCode: "font-family:" + MONO + ";font-size:13px;background:transparent;color:#e6e6e6;padding:0;white-space:pre-wrap;word-break:break-all;letter-spacing:0;",
        codeTheme: "dark"
      }),
      decorate: {
        end(rootEl, { deco }) { rootEl.appendChild(deco("p", "margin:48px 0 0;font-size:12px;letter-spacing:6px;color:#c0c4cc;text-align:center;", "END")); }
      },
      marker: ({ ordered, index }, k) => ordered
        ? marker(index + ".", "font-weight:700;color:" + k.accent + ";")
        : marker("•", "color:#1f2329;")
    },
    {
      id: "jianbao", name: "简报", note: "商业 · 数据 · 报告",
      defaults: { accent: "#12284c", fontSize: 16, lineHeight: 1.75, font: "sans" },
      swatches: ["#12284c", "#0b4f6c", "#1f4e3d", "#5b2a3c", "#2f2f2f"],
      labels: { notes: "注释", refs: "资料来源" },
      styles: k => base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#333;letter-spacing:0.3px;text-align:justify;word-break:break-word;padding:0 4px;",
        h1: "margin:0 0 28px;font-size:" + (k.fs + 8) + "px;line-height:1.4;font-weight:800;color:" + k.accent + ";",
        h2: "display:inline-block;margin:0 0 18px;padding:5px 12px;background-color:" + k.accent + ";font-size:" + k.fs + "px;line-height:1.5;font-weight:600;color:#fff;letter-spacing:1px;",
        h3: "display:inline-block;margin:28px 0 12px;padding-bottom:3px;border-bottom:2px solid #c8962e;font-size:" + (k.fs + 1) + "px;line-height:1.5;font-weight:700;color:" + k.accent + ";",
        strong: "font-weight:700;color:" + k.accent + ";",
        em: "font-style:normal;color:#9a6f1c;",
        mark: "background-color:#fcefd3;color:inherit;padding:0 2px;",
        quote: "margin:28px 0;padding:16px 18px;border-top:2px solid " + k.accent + ";background-color:#f3f5f8;color:#333;",
        quoteP: "margin:0 0 6px;",
        hr: "border:none;border-top:1px solid #dde1e6;margin:36px 0;",
        th: "padding:9px 10px;background-color:" + k.accent + ";color:#fff;font-weight:600;text-align:left;",
        td: "padding:9px 10px;border-bottom:1px solid #dde1e6;color:#333;",
        caption: "margin:8px 0 0;font-size:12px;line-height:1.6;color:#8a94a6;text-align:left;",
        callout: "margin:28px 0;padding:14px 16px;background-color:#f3f5f8;border-left:3px solid #c8962e;",
        calloutTitle: "margin:0 0 4px;font-size:13px;font-weight:700;letter-spacing:1px;color:" + k.accent + ";",
        notesTitle: "margin:0 0 8px;font-size:12px;font-weight:700;letter-spacing:2px;color:" + k.accent + ";text-align:left;",
        notes: "margin:44px 0 0;padding-top:14px;border-top:2px solid " + k.accent + ";"
      }),
      decorate: {
        h2(el, i, { k, deco }) {
          el.before(deco("p", "margin:44px 0 8px;font-family:" + LINING + ";font-size:11px;line-height:1.4;letter-spacing:2px;color:#c8962e;text-align:left;", "PART " + k.pad2(i)));
        }
      },
      marker: ({ ordered, index }, k) => ordered
        ? marker(k.pad2(index), "font-family:" + LINING + ";font-weight:700;color:" + k.accent + ";", "1.9em")
        : marker("▪", "color:" + k.accent + ";")
    },
    {
      id: "richang", name: "日常", note: "生活 · 柔和 · 随笔",
      defaults: { accent: "#b9826a", fontSize: 15, lineHeight: 2.0, font: "sans" },
      swatches: ["#b9826a", "#7d8f69", "#6f8fa6", "#a3727f", "#8a7b6b"],
      styles: k => base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#4a4541;letter-spacing:1px;text-align:justify;word-break:break-word;padding:0 6px;",
        p: "margin:0 0 " + Math.round(k.fs * 1.85) + "px;",
        h1: "margin:12px 0 40px;font-size:" + (k.fs + 7) + "px;line-height:1.5;font-weight:500;color:#4a4541;text-align:center;letter-spacing:3px;",
        h2: "margin:52px 0 24px;font-size:" + (k.fs + 2) + "px;line-height:1.5;font-weight:500;color:#4a4541;text-align:center;letter-spacing:3px;",
        h3: "margin:32px 0 14px;font-size:" + k.fs + "px;line-height:1.6;font-weight:600;color:" + k.accent + ";text-align:center;letter-spacing:2px;",
        strong: "font-weight:600;color:" + k.accent + ";",
        em: "font-style:normal;color:#8a7f76;",
        mark: "background-color:" + k.tint(k.accent, 0.16) + ";color:inherit;padding:0 2px;",
        quote: "margin:36px 0;padding:22px 12px;border-top:1px solid #e8e2da;border-bottom:1px solid #e8e2da;color:#7a716a;text-align:center;",
        quoteP: "margin:0 0 6px;",
        hr: "display:none;",
        th: "padding:8px 10px;border-bottom:1px solid " + k.accent + ";font-weight:600;color:#4a4541;text-align:left;",
        td: "padding:8px 10px;border-bottom:1px solid #eee8e1;color:#5a544f;",
        figure: "margin:36px 0;text-align:center;",
        img: "display:block;max-width:100%;height:auto;margin:0 auto;border-radius:4px;",
        caption: "margin:10px 0 0;font-size:12px;line-height:1.6;color:#a39a92;text-align:center;letter-spacing:1px;",
        callout: "margin:32px 0;padding:18px 20px;background-color:#f7f4ef;border-radius:4px;",
        calloutTitle: "margin:0 0 6px;font-size:13px;font-weight:600;letter-spacing:2px;color:" + k.accent + ";",
        notes: "margin:52px 0 0;padding-top:16px;border-top:1px solid #e8e2da;"
      }),
      decorate: {
        h2(el, i, { k, deco }) {
          el.prepend(deco("span", "display:block;margin-bottom:6px;font-family:" + GEORGIA + ";font-style:italic;font-size:12px;font-weight:400;letter-spacing:1px;color:" + k.accent + ";", "No. " + k.pad2(i)));
        },
        hr(el, { k, deco }) {
          el.after(deco("p", "margin:44px 0;text-align:center;font-size:14px;letter-spacing:8px;color:" + k.accent + ";", "···"));
        },
        end(rootEl, { k, deco }) { rootEl.appendChild(deco("p", "margin:48px 0 0;font-family:" + GEORGIA + ";font-style:italic;font-size:13px;color:" + k.accent + ";text-align:center;letter-spacing:1px;", "fin.")); }
      },
      marker: ({ ordered, index }, k) => ordered
        ? marker(index + ".", "color:" + k.accent + ";")
        : marker("·", "font-weight:700;color:" + k.accent + ";")
    },
    {
      id: "shouji", name: "手记", note: "笔记 · 批注 · 清单",
      defaults: { accent: "#3d5a80", fontSize: 15, lineHeight: 1.8, font: "sans" },
      swatches: ["#3d5a80", "#2e6f5e", "#9c4a3b", "#5c5470", "#333333"],
      labels: { notes: "NOTES", refs: "LINKS", quote: "批注" },
      styles: k => base(k, {
        root: "font-family:" + k.font + ";font-size:" + k.fs + "px;line-height:" + k.lh + ";color:#333;letter-spacing:0.4px;text-align:justify;word-break:break-word;padding:0 4px;",
        h1: "margin:0 0 28px;padding-bottom:14px;border-bottom:1px dashed #cfcfcf;font-size:" + (k.fs + 7) + "px;line-height:1.4;font-weight:700;color:#222;",
        h2: "margin:40px 0 18px;padding-bottom:8px;border-bottom:1px dashed #cfcfcf;font-size:" + (k.fs + 3) + "px;line-height:1.5;font-weight:700;color:#222;",
        h3: "margin:28px 0 12px;font-size:" + (k.fs + 1) + "px;line-height:1.5;font-weight:700;color:#222;",
        strong: "font-weight:700;color:" + k.accent + ";",
        em: "font-style:normal;color:#222;border-bottom:1px dashed " + k.accent + ";",
        mark: "background-color:#fff1b8;color:inherit;padding:0 2px;",
        code: "font-family:" + MONO + ";font-size:0.88em;background-color:#f3f3f3;color:" + k.accent + ";padding:2px 4px;border-radius:3px;",
        quote: "margin:26px 0;padding:12px 16px;border:1px dashed #bdbdbd;border-radius:4px;color:#555;",
        quoteP: "margin:0 0 6px;",
        hr: "border:none;border-top:1px dashed #cfcfcf;margin:36px 0;",
        th: "padding:8px 10px;border:1px solid #e0e0e0;background-color:#fafafa;font-weight:600;text-align:left;color:#222;",
        td: "padding:8px 10px;border:1px solid #e0e0e0;color:#333;",
        caption: "margin:8px 0 0;font-family:" + MONO + ";font-size:11px;line-height:1.6;color:#999;text-align:center;letter-spacing:0;",
        callout: "margin:26px 0;padding:14px 16px;background-color:#fffbea;border:1px dashed #e6d27a;border-radius:4px;",
        calloutTitle: "margin:0 0 6px;font-family:" + MONO + ";font-size:12px;font-weight:600;letter-spacing:1px;color:" + k.accent + ";",
        notesTitle: "margin:0 0 8px;font-family:" + MONO + ";font-size:11px;font-weight:600;letter-spacing:2px;color:" + k.accent + ";text-align:left;",
        notes: "margin:44px 0 0;padding-top:14px;border-top:1px dashed #cfcfcf;"
      }),
      decorate: {
        h2(el, i, { k, deco }) {
          el.prepend(deco("span", "display:block;margin-bottom:4px;font-family:" + MONO + ";font-size:11px;font-weight:400;letter-spacing:1px;color:" + k.accent + ";", "NOTE " + k.pad2(i)));
        },
        h3(el, i, { deco }) { el.prepend(deco("span", "font-family:" + MONO + ";font-weight:400;color:#b0b0b0;", "# ")); },
        quote(el, { k }) {
          el.prepend(k.label("quote", "p", "margin:0 0 6px;font-family:" + MONO + ";font-size:11px;letter-spacing:1px;color:" + k.accent + ";"));
        },
        end(rootEl, { deco }) { rootEl.appendChild(deco("p", "margin:44px 0 0;font-family:" + MONO + ";font-size:11px;color:#b0b0b0;text-align:center;letter-spacing:1px;", "— end of note —")); }
      },
      marker: ({ ordered, index }, k) => ordered
        ? marker(index + ".", "font-family:" + MONO + ";font-size:0.9em;color:" + k.accent + ";")
        : marker("→", "color:" + k.accent + ";")
    }
  ];

  root.TEMPLATES = TEMPLATES;
  root.TemplateKit = { base, marker, kicker, ruler, MONO, GEORGIA, LINING, INK, CN_CAP };
})(window);
