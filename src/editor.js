/* 轻排 · 编辑区（CodeMirror 6）
   - 图片在所在行下方直接显示，可拖拽调整大小，宽度写回源稿（兼容 Obsidian |245 语法）
   - frontmatter 淡化；Markdown 语法轻量着色 */
(function (root) {
  "use strict";
  const CM = root.CM;
  const Core = root.Core;
  const {
    EditorState, StateField, StateEffect, EditorView, Decoration, WidgetType, keymap, placeholder,
    drawSelection, dropCursor, defaultKeymap, history, historyKeymap, indentWithTab,
    markdownLang, syntaxHighlighting, HighlightStyle, indentOnInput, tags: t
  } = CM;

  const refreshImages = StateEffect.define();

  const highlight = HighlightStyle.define([
    { tag: t.heading1, fontSize: "1.4em", fontWeight: "600", lineHeight: "1.5" },
    { tag: t.heading2, fontSize: "1.22em", fontWeight: "600" },
    { tag: t.heading3, fontSize: "1.08em", fontWeight: "600" },
    { tag: [t.heading4, t.heading5, t.heading6], fontWeight: "600" },
    { tag: t.strong, fontWeight: "700" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strikethrough, textDecoration: "line-through", color: "var(--text-3)" },
    { tag: t.link, color: "var(--accent)" },
    { tag: t.url, color: "var(--text-3)" },
    { tag: [t.processingInstruction, t.contentSeparator, t.labelName], color: "var(--text-3)" },
    { tag: t.monospace, fontFamily: "var(--mono)", fontSize: "0.9em", color: "var(--text-2)" },
    { tag: t.quote, color: "var(--text-2)" },
    { tag: [t.comment, t.meta], color: "var(--text-3)" }
  ]);

  const theme = EditorView.theme({
    "&": { height: "100%", backgroundColor: "var(--editor)", color: "var(--text)" },
    "&.cm-focused": { outline: "none" },
    ".cm-scroller": { fontFamily: "var(--sans)", fontSize: "15px", lineHeight: "1.9", letterSpacing: "0.01em" },
    ".cm-content": { padding: "28px clamp(20px, 3.4vw, 44px) 40vh", caretColor: "var(--accent)" },
    ".cm-line": { padding: "0" },
    ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--accent)", borderLeftWidth: "2px" },
    "&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection": { backgroundColor: "rgba(178, 58, 46, 0.14) !important" },
    ".cm-placeholder": { color: "var(--text-3)" },
    ".cm-fm": { fontFamily: "var(--mono)", fontSize: "12.5px", color: "var(--text-3)" },
    ".cm-fm *": { color: "var(--text-3) !important", fontSize: "12.5px !important", fontWeight: "400 !important" }
  });

  /* ---------- 图片小部件 ---------- */
  class ImageWidget extends WidgetType {
    constructor(info, api) {
      super();
      this.info = info;
      this.api = api;
    }
    eq(o) {
      const a = this.info, b = o.info;
      return a.index === b.index && a.src === b.src && a.width === b.width && a.unresolved === b.unresolved && a.alt === b.alt;
    }
    toDOM() {
      const i = this.info;
      const wrap = document.createElement("span");
      wrap.className = "cm-img";
      if (i.unresolved) {
        const miss = document.createElement("span");
        miss.className = "cm-img-miss";
        miss.innerHTML = "<b></b><span>图片未找到 · 菜单里「关联 Obsidian 附件文件夹」，或把同名图片拖进来</span>";
        miss.firstChild.textContent = i.name || "图片";
        wrap.appendChild(miss);
        return wrap;
      }
      const box = document.createElement("span");
      box.className = "cm-img-box";
      const img = document.createElement("img");
      img.src = i.src;
      img.alt = i.alt || "";
      img.draggable = false;
      if (i.width) { img.style.width = i.width + "px"; img.dataset.w = i.width; }
      // 没有固有尺寸的图（如未写宽高的 SVG）默认铺满
      img.addEventListener("load", () => { if (!img.naturalWidth && !i.width) img.style.width = "100%"; });
      box.appendChild(img);
      root.Resize.attach(box, {
        img, centered: false, sides: ["r"],
        max: () => wrap.clientWidth,
        onCommit: w => this.api.setWidth(i.index, w)
      });
      wrap.appendChild(box);
      return wrap;
    }
    ignoreEvent() { return true; }
    get estimatedHeight() { return this.info.width ? Math.round(this.info.width * 0.6) : 200; }
  }

  /* frontmatter 淡化 */
  function fmDecorations(state) {
    const doc = state.doc.toString();
    const decos = [];
    const fm = /^\uFEFF?---\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(doc);
    if (fm) {
      const end = state.doc.lineAt(Math.max(0, fm[0].replace(/\r?\n$/, "").length)).number;
      for (let n = 1; n <= end; n++) decos.push(Decoration.line({ class: "cm-fm" }).range(state.doc.line(n).from));
    }
    return Decoration.set(decos, true);
  }
  /* 图片记号整体替换成图片（不显示 Markdown 文字），光标把它当一个整体 */
  function imageDecorations(state, api) {
    const doc = state.doc.toString();
    const decos = [];
    Core.findImageTokens(doc).forEach(tk => {
      if (tk.embed && !tk.isImage) return;
      const key = tk.embed ? "obsidian-image:" + encodeURIComponent(tk.name) : tk.url;
      const r = api.resolveImage(key) || {};
      const info = { index: tk.index, src: r.src || "", unresolved: !r.src, name: r.name || tk.name || tk.url, width: tk.width, alt: tk.alt };
      decos.push(Decoration.replace({ widget: new ImageWidget(info, api) }).range(tk.from, tk.to));
    });
    return Decoration.set(decos, true);
  }

  function create(parent, opts) {
    let view;
    const api = {
      resolveImage: opts.resolveImage,
      setWidth(index, width) {
        const r = Core.setImageWidth(view.state.doc.toString(), index, width);
        if (!r) return;
        view.dispatch({ changes: { from: r.from, to: r.to, insert: r.insert }, userEvent: "input.resize" });
        opts.onResized && opts.onResized(index, width);
      }
    };
    const images = StateField.define({
      create: s => imageDecorations(s, api),
      update(deco, tr) {
        if (tr.docChanged || tr.effects.some(e => e.is(refreshImages))) return imageDecorations(tr.state, api);
        return deco;
      },
      provide: f => [EditorView.decorations.from(f), EditorView.atomicRanges.of(v => v.state.field(f))]
    });
    const frontmatter = StateField.define({
      create: s => fmDecorations(s),
      update: (deco, tr) => (tr.docChanged ? fmDecorations(tr.state) : deco),
      provide: f => EditorView.decorations.from(f)
    });
    const extensions = [
      history(), drawSelection(), dropCursor(), indentOnInput(),
      EditorView.lineWrapping,
      markdownLang, syntaxHighlighting(highlight), theme, images, frontmatter,
      placeholder(opts.placeholder || ""),
      keymap.of([].concat(opts.keys || [], [indentWithTab], defaultKeymap, historyKeymap)),
      EditorView.updateListener.of(u => { if (u.docChanged) opts.onChange(u.state.doc.toString()); }),
      EditorView.domEventHandlers({
        paste(e) { return opts.onPaste ? opts.onPaste(e) === true : false; }
      }),
      EditorView.contentAttributes.of({ "aria-label": "Markdown 源稿", spellcheck: "false" })
    ];
    const mk = doc => EditorState.create({ doc, extensions });
    view = new EditorView({ state: mk(opts.doc || ""), parent });

    return {
      view,
      getValue: () => view.state.doc.toString(),
      setValue(md) { view.setState(mk(md)); },
      getSel() { const r = view.state.selection.main; return { from: r.from, to: r.to }; },
      setSel(from, to) { view.dispatch({ selection: { anchor: from, head: to == null ? from : to } }); },
      replace(from, to, text, selFrom, selTo) {
        view.dispatch({
          changes: { from, to, insert: text },
          selection: selFrom != null ? { anchor: from + selFrom, head: from + selTo } : { anchor: from + text.length },
          scrollIntoView: true, userEvent: "input"
        });
        view.focus();
      },
      focus: () => view.focus(),
      refreshImages() { view.dispatch({ effects: refreshImages.of(null) }); },
      setWidth: api.setWidth
    };
  }

  root.Editor = { create };
})(window);
