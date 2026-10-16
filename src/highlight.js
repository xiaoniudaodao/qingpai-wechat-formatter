/* 轻排 · 轻量代码高亮（内联颜色，公众号可用）
   只区分注释 / 字符串 / 数字 / 关键字 / 函数名，够用、稳定、不依赖外部库。 */
(function (root) {
  "use strict";
  const KW = {
    js: "const let var function return if else for while do switch case break continue new class extends super this import export from default async await try catch finally throw typeof instanceof in of null undefined true false yield static get set",
    py: "def return if elif else for while in not and or is import from as class with try except finally raise lambda yield pass break continue global nonlocal None True False async await self print",
    sh: "if then else elif fi for while do done case esac function return export local echo cd ls sudo cat grep sed awk npm pip git brew curl mkdir rm cp mv source",
    go: "func package import return if else for range switch case break continue var const type struct interface map chan go defer select nil true false",
    java: "public private protected class interface extends implements return if else for while new static final void int long double float boolean char String null true false try catch finally throw throws import package this super",
    sql: "select from where and or not insert into values update set delete create table drop alter join left right inner outer on group by order having limit as distinct count sum avg min max null is in like between case when then else end",
    css: "important"
  };
  const ALIAS = { javascript: "js", ts: "js", typescript: "js", jsx: "js", tsx: "js", json: "js", python: "py", bash: "sh", shell: "sh", zsh: "sh", console: "sh", golang: "go", kotlin: "java", c: "java", cpp: "java", "c++": "java", cs: "java", csharp: "java", swift: "java", rust: "java", rs: "java", php: "js", rb: "py", ruby: "py", scss: "css", less: "css", mysql: "sql", postgres: "sql" };
  const THEMES = {
    dark: { comment: "#7f848e", string: "#a5d6a7", number: "#f2b880", keyword: "#ff9b8f", fn: "#8ec5ff", plain: null },
    light: { comment: "#9a9a9a", string: "#2e7d4f", number: "#b0562a", keyword: "#a1306b", fn: "#2a5db0", plain: null }
  };
  const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function html(code, lang, theme) {
    const l = ALIAS[(lang || "").toLowerCase()] || (lang || "").toLowerCase();
    const words = KW[l];
    const c = THEMES[theme] || THEMES.dark;
    if (!words && l !== "html" && l !== "xml") return esc(code);
    const kw = new Set((words || "").split(" "));
    const hashComment = l === "py" || l === "sh";
    const re = new RegExp([
      hashComment ? "(#[^\\n]*)" : "(\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/|<!--[\\s\\S]*?-->|--[^\\n]*(?=\\n|$))",
      "(\"(?:\\\\.|[^\"\\\\\\n])*\"|'(?:\\\\.|[^'\\\\\\n])*'|`(?:\\\\.|[^`\\\\])*`)",
      "(\\b\\d+(?:\\.\\d+)?\\b)",
      "([A-Za-z_$][\\w$]*)(?=\\s*\\()",
      "([A-Za-z_$][\\w$-]*)"
    ].join("|"), "g");
    let out = "", last = 0, m;
    const span = (color, s) => '<span style="color:' + color + ';">' + esc(s) + "</span>";
    while ((m = re.exec(code))) {
      out += esc(code.slice(last, m.index));
      if (m[1] && !(l === "sql" && m[1].startsWith("//"))) out += span(c.comment, m[1]);
      else if (m[2]) out += span(c.string, m[2]);
      else if (m[3]) out += span(c.number, m[3]);
      else if (m[4]) out += kw.has(m[4]) ? span(c.keyword, m[4]) : span(c.fn, m[4]);
      else if (m[5] && (kw.has(m[5]) || (l === "sql" && kw.has(m[5].toLowerCase())))) out += span(c.keyword, m[5]);
      else out += esc(m[0]);
      last = re.lastIndex;
    }
    return out + esc(code.slice(last));
  }
  root.CodeHighlight = { html };
})(window);
