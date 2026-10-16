/* 轻排 · 图片拖拽缩放（编辑区与预览共用）
   宽度以「手机正文宽度」为参照：PHONE_W ≈ 公众号手机端正文可用宽度。 */
(function (root) {
  "use strict";
  const PHONE_W = 340;
  const MIN_W = 48;

  function label(w) {
    if (!w) return "原始大小";
    return w + " px · " + Math.round((w / PHONE_W) * 100) + "%";
  }

  /* 在 box（position:relative）里放手柄、尺寸标签和快捷尺寸
     opts: { img, centered, max(): number, onCommit(width|null), sides: ["l","r"] } */
  function attach(box, opts) {
    const ui = document.createElement("div");
    ui.className = "rz";
    ui.setAttribute("contenteditable", "false");
    ui.dataset.previewOnly = "1";
    const tag = document.createElement("span");
    tag.className = "rz-tag";
    ui.appendChild(tag);
    const chips = document.createElement("span");
    chips.className = "rz-chips";
    [["小", 0.4], ["中", 0.6], ["大", 0.8], ["原始", null]].forEach(([t, pct]) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = t;
      b.title = pct ? "约占手机屏宽 " + Math.round(pct * 100) + "%" : "恢复原始大小";
      b.addEventListener("pointerdown", e => e.stopPropagation());
      b.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); opts.onCommit(pct ? Math.round(PHONE_W * pct) : null); });
      chips.appendChild(b);
    });
    ui.appendChild(chips);
    // 右下角把手：最直观的缩放入口
    const corner = document.createElement("span");
    corner.className = "rz-c";
    corner.title = "拖动缩放，双击恢复原始大小";
    corner.addEventListener("pointerdown", e => start(e, 1));
    corner.addEventListener("dblclick", e => { e.preventDefault(); e.stopPropagation(); opts.onCommit(null); });
    ui.appendChild(corner);
    (opts.sides || ["l", "r"]).forEach(side => {
      const h = document.createElement("span");
      h.className = "rz-h rz-" + side;
      h.title = "拖动调整大小，双击恢复原始大小";
      h.addEventListener("pointerdown", e => start(e, side === "l" ? -1 : 1));
      h.addEventListener("dblclick", e => { e.preventDefault(); e.stopPropagation(); opts.onCommit(null); });
      ui.appendChild(h);
    });
    box.appendChild(ui);
    const sync = () => { tag.textContent = label(opts.img.dataset.w ? +opts.img.dataset.w : null); };
    sync();

    function start(e, dir) {
      e.preventDefault(); e.stopPropagation();
      const img = opts.img;
      const startX = e.clientX;
      const startW = img.getBoundingClientRect().width;
      const max = opts.max();
      const factor = (typeof opts.centered === "function" ? opts.centered() : opts.centered) ? 2 : 1;
      let w = startW;
      // 拉到最宽、且原图本来就够宽时，等于「原始大小」，不写死宽度
      const full = v => v >= max - 6 && (img.naturalWidth || 0) >= max - 6;
      box.classList.add("rz-active");
      document.body.classList.add("rz-dragging");
      const move = ev => {
        w = Math.max(MIN_W, Math.min(max, startW + (ev.clientX - startX) * dir * factor));
        img.style.width = Math.round(w) + "px";
        img.style.maxWidth = "100%";
        tag.textContent = full(w) ? "铺满 · 原始大小" : label(Math.round(w));
        opts.onLive && opts.onLive();
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        box.classList.remove("rz-active");
        document.body.classList.remove("rz-dragging");
        if (Math.abs(w - startW) < 2) return;
        opts.onCommit(full(w) ? null : Math.round(w));
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
    }
    return { el: ui, sync };
  }

  root.Resize = { attach, PHONE_W, label };
})(window);
