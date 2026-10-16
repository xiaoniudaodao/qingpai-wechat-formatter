// 版心 V10 编辑器依赖：CodeMirror 6 精简打包（不含 HTML/CSS/JS 语言包）
import { EditorState, StateField, StateEffect, Compartment, RangeSetBuilder } from "@codemirror/state";
import { EditorView, Decoration, WidgetType, keymap, placeholder, drawSelection, dropCursor } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab, undo, redo } from "@codemirror/commands";
import { Language, defineLanguageFacet, syntaxHighlighting, HighlightStyle, indentOnInput } from "@codemirror/language";
import { parser as mdParser, GFM } from "@lezer/markdown";
import { tags } from "@lezer/highlight";

const markdownLang = new Language(defineLanguageFacet({ commentTokens: { block: { open: "<!--", close: "-->" } } }), mdParser.configure([GFM]), [], "markdown");

window.CM = {
  EditorState, StateField, StateEffect, Compartment, RangeSetBuilder,
  EditorView, Decoration, WidgetType, keymap, placeholder, drawSelection, dropCursor,
  defaultKeymap, history, historyKeymap, indentWithTab, undo, redo,
  markdownLang, syntaxHighlighting, HighlightStyle, indentOnInput, tags
};
