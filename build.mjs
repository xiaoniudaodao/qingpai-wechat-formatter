// 把 src/ 打包成一个可双击打开的 HTML（无外部依赖）
import fs from "node:fs";
import path from "node:path";
const dir = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname));
const read = f => fs.readFileSync(path.join(dir, f), "utf8");
const order = ["core.js", "highlight.js", "render.js", "templates.js", "scenes.js", "cards.js", "resize.js", "editor.js", "canvas.js", "sample.js", "app.js"];
const js = order.map(f => `/* ===== ${f} ===== */\n` + read("src/" + f)).join("\n");
const marked = read("vendor/marked.min.js");
let html = read("src/index.html")
  .replace("/*@@CSS@@*/", () => read("src/styles.css"))
  .replace("/*@@MARKED@@*/", () => marked)
  .replace("/*@@CODEMIRROR@@*/", () => read("vendor/codemirror.bundle.js").replace(/<\/script/gi, "<\\/script"))
  .replace("/*@@JS@@*/", () => js.replace(/<\/script/gi, "<\\/script"));
const out = path.join(dir, "index.html");
fs.writeFileSync(out, html);
console.log("built", out, (html.length / 1024).toFixed(1) + " KB");
