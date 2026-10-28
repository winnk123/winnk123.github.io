#!/usr/bin/env python3
"""Migrate the sibling CS336 notes into native, semantic Learning Atlas articles."""

from __future__ import annotations

import argparse
from collections import Counter
import hashlib
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import unicodedata
import xml.etree.ElementTree as ET

from latex2mathml.converter import convert
from pylatexenc.latexwalker import (
    LatexCharsNode,
    LatexCommentNode,
    LatexEnvironmentNode,
    LatexGroupNode,
    LatexMacroNode,
    LatexMathNode,
    LatexSpecialsNode,
    LatexWalker,
    get_default_latex_context_db,
)
from pylatexenc.macrospec import EnvironmentSpec, MacroSpec, MacroStandardArgsParser


ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOT = ROOT.parent / "CS336"
COURSE_DATA = ROOT / "content" / "courses.json"
OUTPUT_ROOT = ROOT / "dist" / "course-articles" / "cs336"
MAX_IMAGE_EDGE = 1800
WEBP_QUALITY = 94

HEADING_COMMANDS = {"section": 3, "subsection": 4, "subsubsection": 5, "paragraph": 6}
MATH_ENVIRONMENTS = {"equation", "equation*", "align", "align*", "gather", "gather*", "multline", "multline*", "displaymath"}
IGNORED_MACROS = {
    "label", "index", "vspace", "hspace", "vfill", "hfill", "noindent", "centering",
    "raggedright", "small", "footnotesize", "scriptsize", "tiny", "normalsize", "large",
    "Large", "LARGE", "huge", "Huge", "bfseries", "itshape", "rmfamily", "ttfamily",
    "color", "pagebreak", "newpage", "clearpage", "phantom", "hphantom", "vphantom",
    "toprule", "midrule", "bottomrule", "hline", "cline", "addlinespace", "tabularnewline",
    "selectlanguage", "foreignlanguage", "allowbreak", "linebreak", "sloppypar", "hypersetup",
    "textwidth", "textheight",
}
SYMBOL_MACROS = {
    "%": "%", "_": "_", "#": "#", "$": "$", "&": "&", "{": "{", "}": "}",
    "~": "\u00a0", "S": "§", "LaTeX": "LaTeX", "TeX": "TeX", "ldots": "…",
    "dots": "…", "textemdash": "—", "textendash": "–", "textellipsis": "…",
    "textasciitilde": "~", "textasciicircum": "^", "textbackslash": "\\",
}


def html_text(value: str) -> str:
    return escape(value, quote=False)


def group_text(node) -> str:
    if node is None:
        return ""
    if isinstance(node, LatexGroupNode):
        return "".join(group_text(child) for child in node.nodelist)
    if isinstance(node, LatexCharsNode):
        return node.chars
    if isinstance(node, LatexSpecialsNode):
        return node.specials_chars or ""
    if isinstance(node, LatexMacroNode):
        if node.macroname in SYMBOL_MACROS:
            return SYMBOL_MACROS[node.macroname]
        return "".join(group_text(arg) for arg in getattr(node.nodeargd, "argnlist", []) if arg is not None)
    return "".join(group_text(child) for child in getattr(node, "nodelist", []) or [])


def slug(value: str) -> str:
    value = unicodedata.normalize("NFKC", value).lower()
    value = re.sub(r"[^\w\u3400-\u9fff]+", "-", value, flags=re.UNICODE).strip("-")
    return value[:70] or "section"


def make_context():
    context = get_default_latex_context_db()
    context.add_context_category(
        "learning-atlas-course",
        macros=[
            MacroSpec("lecturefig", MacroStandardArgsParser(argspec="[{{")),
            MacroSpec("includegraphics", MacroStandardArgsParser(argspec="[{")),
            MacroSpec("href", MacroStandardArgsParser(argspec="{{")),
            MacroSpec("url", MacroStandardArgsParser(argspec="{")),
            MacroSpec("nolinkurl", MacroStandardArgsParser(argspec="{")),
            MacroSpec("caption", MacroStandardArgsParser(argspec="{")),
            MacroSpec("item", MacroStandardArgsParser(argspec="[")),
        ],
        environments=[
            EnvironmentSpec("importantbox", MacroStandardArgsParser(argspec="{")),
            EnvironmentSpec("knowledgebox", MacroStandardArgsParser(argspec="{")),
            EnvironmentSpec("warningbox", MacroStandardArgsParser(argspec="{")),
            EnvironmentSpec("tabularx", MacroStandardArgsParser(argspec="{{")),
            EnvironmentSpec("subfigure", MacroStandardArgsParser(argspec="[{")),
            EnvironmentSpec("tcolorbox", MacroStandardArgsParser(argspec="[")),
        ],
        prepend=True,
    )
    return context


class ArticleRenderer:
    def __init__(self, lecture_number: int, source_dir: Path, output_root: Path, source: str):
        self.lecture_number = lecture_number
        self.source_dir = source_dir
        self.figure_dir = source_dir / "figures"
        self.output_root = output_root
        self.source = source
        self.output_root.mkdir(parents=True, exist_ok=True)
        self.asset_dir = output_root.parent.parent / "assets" / "courses" / "cs336" / f"lecture-{lecture_number:02d}" / "figures"
        self.asset_dir.mkdir(parents=True, exist_ok=True)
        self.context = make_context()
        self.footnotes: list[str] = []
        self.figure_cache: dict[str, str] = {}
        self.image_sizes: dict[str, tuple[int, int]] = {}
        self.toc: list[dict] = []
        self.unknown_macros: Counter[str] = Counter()
        self.stats = Counter({name: 0 for name in ("headings", "paragraphs", "equations", "figures", "inlineImages", "pdfFiguresConverted", "codeBlocks", "callouts", "tables", "lists", "subfigures")})
        self.heading_counts: Counter[str] = Counter()

    def parse(self):
        nodes, _, _ = LatexWalker(self.source, latex_context=self.context).get_latex_nodes()
        return nodes

    @staticmethod
    def node_end(node) -> int:
        end = node.pos + node.len
        if isinstance(node, LatexMacroNode):
            for arg in getattr(getattr(node, "nodeargd", None), "argnlist", []) or []:
                if arg is not None:
                    end = max(end, arg.pos + arg.len)
        if isinstance(node, LatexEnvironmentNode):
            for arg in getattr(getattr(node, "nodeargd", None), "argnlist", []) or []:
                if arg is not None:
                    end = max(end, arg.pos + arg.len)
        return end

    @staticmethod
    def group_arg(node, index: int = 0):
        args = getattr(getattr(node, "nodeargd", None), "argnlist", []) or []
        present = [arg for arg in args if arg is not None]
        return present[index] if len(present) > index else None

    def heading(self, node):
        args = [arg for arg in getattr(node.nodeargd, "argnlist", []) if arg is not None]
        if not args:
            return ""
        return self.render_inline(args[-1].nodelist if isinstance(args[-1], LatexGroupNode) else [args[-1]])

    def heading_id(self, title: str, level: int) -> str:
        self.heading_counts[str(level)] += 1
        index = len(self.toc) + 1
        return f"lecture-{self.lecture_number:02d}-heading-{index:03d}-{slug(title)}"

    def math_markup(self, node) -> str:
        raw = self.source[node.pos:node.pos + node.len]
        opening, closing = node.delimiters
        expression = raw[len(opening):-len(closing)] if opening and closing else raw
        expression = re.sub(r"\\label\s*\{[^{}]*\}", "", expression)
        display = node.displaytype == "display"
        converted = convert(expression, display="block" if display else "inline")
        root = ET.fromstring(converted)
        root.set("aria-label", re.sub(r"\s+", " ", expression).strip()[:500])
        ET.register_namespace("", "http://www.w3.org/1998/Math/MathML")
        rendered = ET.tostring(root, encoding="unicode")
        self.stats["equations"] += 1
        if display:
            return f'<figure class="course-math-display" tabindex="0">{rendered}</figure>'
        return f'<span class="course-math-inline">{rendered}</span>'

    def convert_figure(self, value: str) -> str:
        name = value.strip().strip('"').strip("'")
        name = re.sub(r"\\(?:detokenize|protect)\s*", "", name)
        name = name.removeprefix("./")
        if name.startswith("figures/"):
            name = name[len("figures/"):]
        source_file = (self.figure_dir / name).resolve()
        if not source_file.is_file():
            raise FileNotFoundError(f"Lecture {self.lecture_number:02d}: referenced figure not found: {source_file}")
        source_key = str(source_file)
        if source_key in self.figure_cache:
            return self.figure_cache[source_key]

        digest = hashlib.sha1(source_file.relative_to(self.figure_dir.resolve()).as_posix().encode()).hexdigest()[:8]
        output_name = f"{slug(source_file.stem)}-{digest}.webp"
        destination = self.asset_dir / output_name
        destination.parent.mkdir(parents=True, exist_ok=True)

        with tempfile.TemporaryDirectory(prefix="atlas-course-figure-") as temp_dir:
            temp_dir = Path(temp_dir)
            image_input = source_file
            if source_file.suffix.lower() == ".pdf":
                prefix = temp_dir / "page"
                subprocess.run(
                    ["pdftoppm", "-f", "1", "-l", "1", "-singlefile", "-png", "-scale-to", str(MAX_IMAGE_EDGE), str(source_file), str(prefix)],
                    check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
                )
                image_input = prefix.with_suffix(".png")
                self.stats["pdfFiguresConverted"] += 1
            subprocess.run(
                ["convert", str(image_input), "-auto-orient", "-strip", "-resize", f"{MAX_IMAGE_EDGE}x{MAX_IMAGE_EDGE}>", "-quality", str(WEBP_QUALITY), str(destination)],
                check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE,
            )

        relative = f"./assets/courses/cs336/lecture-{self.lecture_number:02d}/figures/{output_name}"
        size = subprocess.check_output(["identify", "-format", "%w %h", str(destination)], text=True).split()
        self.image_sizes[relative] = (int(size[0]), int(size[1]))
        self.figure_cache[source_key] = relative
        self.stats["figures"] += 1
        return relative

    def render_inline(self, nodes) -> str:
        output: list[str] = []
        consumed_until = -1
        for node in nodes:
            if node.pos < consumed_until:
                continue
            consumed_until = self.node_end(node)
            if isinstance(node, LatexCommentNode):
                continue
            if isinstance(node, LatexCharsNode):
                output.append(html_text(re.sub(r"[\r\n]+", " ", node.chars)))
            elif isinstance(node, LatexMathNode):
                output.append(self.math_markup(node))
            elif isinstance(node, LatexSpecialsNode):
                specials = node.specials_chars or ""
                replacements = {"``": "“", "''": "”", "~": "\u00a0", "---": "—", "--": "–"}
                output.append(html_text(replacements.get(specials, specials)))
            elif isinstance(node, LatexGroupNode):
                output.append(self.render_inline(node.nodelist))
            elif isinstance(node, LatexMacroNode):
                rendered, is_block = self.render_macro(node)
                output.append(re.sub(r"</?p>", "", rendered) if is_block else rendered)
            elif isinstance(node, LatexEnvironmentNode):
                output.append(self.environment_body(node))
        return "".join(output).strip()

    def render_flow(self, nodes) -> str:
        output: list[str] = []
        inline: list[str] = []
        consumed_until = -1

        def flush():
            text = "".join(inline).strip()
            inline.clear()
            if text:
                output.append(f"<p>{text}</p>")

        for node in nodes:
            if node.pos < consumed_until:
                continue
            consumed_until = self.node_end(node)
            if isinstance(node, (LatexCommentNode,)):
                continue
            if isinstance(node, LatexCharsNode):
                chunks = re.split(r"\n[ \t]*\n(?:[ \t]*\n)*", node.chars)
                for index, chunk in enumerate(chunks):
                    if chunk.strip():
                        inline.append(html_text(re.sub(r"[\r\n]+", " ", chunk)))
                    if index < len(chunks) - 1:
                        flush()
                continue
            if isinstance(node, LatexMathNode):
                math = self.math_markup(node)
                if node.displaytype == "display":
                    flush()
                    output.append(math)
                else:
                    inline.append(math)
                continue
            if isinstance(node, LatexMacroNode) and node.macroname in HEADING_COMMANDS:
                flush()
                output.append(self.render_heading(node))
                continue
            rendered, block = self.render_node(node)
            if block:
                flush()
                if rendered:
                    output.append(rendered)
            elif rendered:
                inline.append(rendered)
        flush()
        return "\n".join(output)

    def render_heading(self, node) -> str:
        level = HEADING_COMMANDS[node.macroname]
        title = self.heading(node)
        identity = self.heading_id(title, level)
        self.toc.append({"id": identity, "title": re.sub(r"<[^>]+>", "", title), "level": level})
        self.stats["headings"] += 1
        return f'<h{level} id="{identity}" class="course-source-heading">{title}</h{level}>'

    def render_list(self, node) -> str:
        ordered = node.environmentname == "enumerate"
        description = node.environmentname == "description"
        tag = "dl" if description else ("ol" if ordered else "ul")
        items: list[tuple[object | None, list]] = []
        current: list = []
        label = None
        for child in node.nodelist or []:
            if isinstance(child, LatexMacroNode) and child.macroname == "item":
                if current or label is not None:
                    items.append((label, current))
                label = self.group_arg(child, 0)
                current = []
            else:
                current.append(child)
        if current or label is not None:
            items.append((label, current))
        rendered = []
        for item_label, children in items:
            if not any((isinstance(child, LatexCharsNode) and child.chars.strip()) or not isinstance(child, LatexCharsNode) for child in children) and item_label is None:
                continue
            body = self.render_flow(children)
            if description:
                rendered.append(f"<dt>{self.render_inline(item_label.nodelist) if item_label else ''}</dt><dd>{body}</dd>")
            else:
                rendered.append(f"<li>{body}</li>")
        self.stats["lists"] += 1
        return f'<{tag} class="course-{node.environmentname}">{"".join(rendered)}</{tag}>'

    def render_table(self, node) -> str:
        rows: list[list[list]] = [[]]
        cell: list = []
        for child in node.nodelist or []:
            if isinstance(child, LatexSpecialsNode) and child.specials_chars == "&":
                rows[-1].append(cell)
                cell = []
            elif isinstance(child, LatexMacroNode) and child.macroname in {"\\", "tabularnewline"}:
                rows[-1].append(cell)
                cell = []
                if any(self.render_inline(parts).strip() for parts in rows[-1]):
                    rows.append([])
                else:
                    rows[-1] = []
            elif isinstance(child, LatexMacroNode) and child.macroname in {"toprule", "midrule", "bottomrule", "hline", "addlinespace"}:
                continue
            else:
                cell.append(child)
        if cell:
            rows[-1].append(cell)
        rows = [row for row in rows if row and any(row)]
        if not rows:
            return ""
        rendered_rows = []
        for row_index, row in enumerate(rows):
            tag = "th" if row_index == 0 else "td"
            cells = "".join(f"<{tag}>{self.render_inline(parts)}</{tag}>" for parts in row)
            rendered_rows.append(f"<tr>{cells}</tr>")
        self.stats["tables"] += 1
        return f'<div class="course-table-wrap"><table class="course-source-table"><tbody>{"".join(rendered_rows)}</tbody></table></div>'

    def environment_body(self, node) -> str:
        args = [arg for arg in getattr(getattr(node, "nodeargd", None), "argnlist", []) or [] if arg is not None]
        title = self.render_inline(args[0].nodelist) if args and isinstance(args[0], LatexGroupNode) else ""
        env = node.environmentname
        if env in {"itemize", "enumerate", "description"}:
            return self.render_list(node)
        if env in {"importantbox", "knowledgebox", "warningbox", "tcolorbox"}:
            body = self.render_flow(node.nodelist or [])
            option_text = group_text(args[0]) if args and not title else ""
            if env == "tcolorbox":
                match = re.search(r"title\s*=\s*\{([^{}]*)\}", option_text)
                title = self.render_inline_text(match.group(1)) if match else "重点说明"
            style = {"importantbox": "important", "knowledgebox": "knowledge", "warningbox": "warning", "tcolorbox": "note"}[env]
            self.stats["callouts"] += 1
            return f'<aside class="course-source-callout {style}"><h4>{title or "重点说明"}</h4>{body}</aside>'
        if env in {"tabular", "tabularx"}:
            return self.render_table(node)
        if env == "lstlisting":
            return self.render_listing(node)
        if env == "subfigure":
            body = self.render_flow(node.nodelist or [])
            self.stats["subfigures"] += 1
            return f'<div class="course-subfigure">{body}</div>'
        if env == "figure":
            body = self.render_flow(node.nodelist or [])
            return f'<figure class="course-figure-group">{body}</figure>'
        if env == "center":
            body = self.render_flow(node.nodelist or [])
            return f'<div class="course-centered">{body}</div>'
        if env in MATH_ENVIRONMENTS or env in {"cases", "bmatrix", "pmatrix", "aligned", "array"}:
            return self.math_environment(node)
        if env in {"titlepage", "document"}:
            body = self.render_flow(node.nodelist or [])
            return body
        body = self.render_flow(node.nodelist or [])
        self.stats[f"env:{env}"] += 1
        return f'<div class="course-source-environment" data-environment="{escape(env, quote=True)}">{body}</div>'

    def render_listing(self, node) -> str:
        raw = self.source[node.pos:node.pos + node.len]
        match = re.match(r"\\begin\{lstlisting\}(?:\[([^\]]*)\])?", raw, re.S)
        if not match:
            raise ValueError(f"Malformed lstlisting in lecture {self.lecture_number:02d}")
        close = raw.rfind(r"\end{lstlisting}")
        code = raw[match.end():close].strip("\r\n")
        options = match.group(1) or ""
        lang = re.search(r"language\s*=\s*([\w+-]+)", options)
        caption_match = re.search(r"caption\s*=\s*\{([^{}]*)\}", options)
        language = (lang.group(1) if lang else "text").lower()
        caption = f'<div class="course-code-caption">{html_text(caption_match.group(1))}</div>' if caption_match else ""
        self.stats["codeBlocks"] += 1
        return f'<figure class="course-code-block">{caption}<pre><code class="language-{escape(language, quote=True)}">{html_text(code)}</code></pre></figure>'

    def math_environment(self, node) -> str:
        raw = self.source[node.pos:node.pos + node.len]
        begin = re.match(r"\\begin\{[^}]+\}", raw)
        end = raw.rfind(r"\end{")
        expression = raw[begin.end():end] if begin and end >= 0 else raw
        expression = re.sub(r"\\label\s*\{[^{}]*\}", "", expression)
        rendered = ET.tostring(ET.fromstring(convert(expression, display="block")), encoding="unicode")
        self.stats["equations"] += 1
        return f'<figure class="course-math-display" tabindex="0">{rendered}</figure>'

    def render_macro(self, node):
        name = node.macroname
        args = [arg for arg in getattr(getattr(node, "nodeargd", None), "argnlist", []) or [] if arg is not None]
        def arg_markup(index: int) -> str:
            if len(args) <= index:
                return ""
            arg = args[index]
            return self.render_inline(arg.nodelist if isinstance(arg, LatexGroupNode) else [arg])

        if name in HEADING_COMMANDS:
            return self.render_heading(node), True
        if name == "lecturefig":
            file_arg = args[-2] if len(args) >= 2 else None
            caption_arg = args[-1] if len(args) >= 1 else None
            if len(args) >= 3:
                file_arg, caption_arg = args[-2], args[-1]
            file_name = group_text(file_arg)
            caption = self.render_inline(caption_arg.nodelist) if isinstance(caption_arg, LatexGroupNode) else html_text(group_text(caption_arg))
            src = self.convert_figure(file_name)
            self.stats["inlineImages"] += 1
            caption_text = re.sub(r"<[^>]+>", "", caption)
            width, height = self.image_sizes[src]
            return f'<figure class="course-source-figure"><img src="{escape(src, quote=True)}" alt="{escape(caption_text, quote=True)}" width="{width}" height="{height}" loading="lazy"><figcaption>{caption}</figcaption></figure>', True
        if name == "includegraphics":
            return self.image_markup(node), True
        if name == "footnote":
            content = args[-1] if args else None
            if content is None:
                return "", False
            index = len(self.footnotes) + 1
            identity = f"course-footnote-{self.lecture_number:02d}-{index}"
            ref_id = f"course-footnote-ref-{self.lecture_number:02d}-{index}"
            route_prefix = f"#courses?lecture=lecture-{self.lecture_number:02d}&section="
            body = self.render_inline(content.nodelist if isinstance(content, LatexGroupNode) else [content])
            self.footnotes.append(f'<li id="{identity}">{body}<a class="course-footnote-back" href="{route_prefix}{ref_id}" aria-label="返回正文">↩</a></li>')
            return f'<sup class="course-footnote-ref" id="{ref_id}"><a href="{route_prefix}{identity}">{index}</a></sup>', False
        if name == "href" and len(args) >= 2:
            url = group_text(args[0]).strip()
            if not re.match(r"^(https?://|mailto:)", url, re.I):
                return arg_markup(1), False
            return f'<a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{arg_markup(1)}</a>', False
        if name in {"url", "nolinkurl"} and args:
            url = group_text(args[-1]).strip()
            shown = html_text(url)
            if name == "url" and re.match(r"^https?://", url, re.I):
                return f'<a href="{escape(url, quote=True)}" target="_blank" rel="noopener noreferrer">{shown}</a>', False
            return f'<code>{shown}</code>', False
        wrappers = {"textbf": "strong", "bf": "strong", "emph": "em", "textit": "em", "texttt": "code", "verb": "code", "underline": "u", "textsc": "span", "mbox": "span", "text": "span", "ensuremath": "span"}
        if name in wrappers and args:
            tag = wrappers[name]
            klass = ' class="course-small-caps"' if name == "textsc" else ""
            return f"<{tag}{klass}>{arg_markup(len(args)-1)}</{tag}>", False
        if name == "caption" and args:
            return f'<figcaption>{arg_markup(len(args)-1)}</figcaption>', True
        if name == "par":
            return "", True
        if name in {"\\", "newline", "linebreak"}:
            return "<br>", False
        if name in SYMBOL_MACROS:
            return html_text(SYMBOL_MACROS[name]), False
        if name in IGNORED_MACROS or name in {"item", "centering"}:
            return "", False
        self.unknown_macros[name] += 1
        if args:
            return "".join(arg_markup(index) for index in range(len(args))), False
        return f'<code class="course-unmapped-macro">\\{html_text(name)}</code>', False

    def image_markup(self, node) -> str:
        args = [arg for arg in getattr(getattr(node, "nodeargd", None), "argnlist", []) or [] if arg is not None]
        if not args:
            raise ValueError(f"includegraphics without a path in lecture {self.lecture_number:02d}")
        file_name = group_text(args[-1])
        src = self.convert_figure(file_name)
        alt = Path(file_name).name
        width, height = self.image_sizes[src]
        self.stats["inlineImages"] += 1
        return f'<img class="course-source-image" src="{escape(src, quote=True)}" alt="{escape(alt, quote=True)}" width="{width}" height="{height}" loading="lazy">'

    def render_node(self, node):
        if isinstance(node, LatexCommentNode):
            return "", False
        if isinstance(node, LatexCharsNode):
            return html_text(re.sub(r"[\r\n]+", " ", node.chars)), False
        if isinstance(node, LatexSpecialsNode):
            specials = node.specials_chars or ""
            replacements = {"``": "“", "''": "”", "~": "\u00a0", "---": "—", "--": "–", "\\&": "&"}
            return html_text(replacements.get(specials, specials)), False
        if isinstance(node, LatexGroupNode):
            return self.render_flow(node.nodelist), True
        if isinstance(node, LatexMathNode):
            return self.math_markup(node), node.displaytype == "display"
        if isinstance(node, LatexMacroNode):
            return self.render_macro(node)
        if isinstance(node, LatexEnvironmentNode):
            return self.environment_body(node), True
        return "", False

    def render_document(self, nodes) -> str:
        output: list[str] = []
        inline: list[str] = []
        section_stack: list[int] = []
        consumed_until = -1

        def flush():
            text = "".join(inline).strip()
            inline.clear()
            if text:
                output.append(f"<p>{text}</p>")
                self.stats["paragraphs"] += 1

        for node in nodes:
            if node.pos < consumed_until:
                continue
            consumed_until = self.node_end(node)
            if isinstance(node, LatexCharsNode):
                chunks = re.split(r"\n[ \t]*\n(?:[ \t]*\n)*", node.chars)
                for index, chunk in enumerate(chunks):
                    if chunk.strip():
                        inline.append(html_text(re.sub(r"[\r\n]+", " ", chunk)))
                    if index < len(chunks) - 1:
                        flush()
                continue
            if isinstance(node, LatexMacroNode) and node.macroname in HEADING_COMMANDS:
                flush()
                level = HEADING_COMMANDS[node.macroname]
                while section_stack and section_stack[-1] >= level:
                    output.append("</section>")
                    section_stack.pop()
                title = self.heading(node)
                identity = self.heading_id(title, level)
                self.toc.append({"id": identity, "title": re.sub(r"<[^>]+>", "", title), "level": level})
                output.append(f'<section class="course-source-section level-{level}" id="{identity}"><h{level}>{title}</h{level}>')
                section_stack.append(level)
                self.stats["headings"] += 1
                continue
            rendered, block = self.render_node(node)
            if block:
                flush()
                if rendered:
                    output.append(rendered)
            elif rendered:
                inline.append(rendered)
        flush()
        while section_stack:
            output.append("</section>")
            section_stack.pop()

        if self.footnotes:
            output.append('<section class="course-footnotes" id="course-footnotes"><h3>脚注与参考资料</h3><ol>')
            output.extend(self.footnotes)
            output.append("</ol></section>")
        return "\n".join(output)


class VisibleTextParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_data(self, data):
        if data.strip():
            self.parts.append(data)

    def handle_starttag(self, tag, attrs):
        if tag in {"img", "math"}:
            attrs = dict(attrs)
            label = attrs.get("alt") or attrs.get("aria-label")
            if label:
                self.parts.append(label)


def source_body(lecture_dir: Path, number: int) -> str:
    content = lecture_dir / "notes-content.tex"
    if content.is_file():
        return content.read_text(encoding="utf-8")
    notes = (lecture_dir / "notes.tex").read_text(encoding="utf-8")
    match = re.search(r"\\tableofcontents(?:\s*\\newpage)?", notes)
    if not match:
        raise ValueError(f"Lecture {number:02d} has no table-of-contents/body boundary")
    return notes[match.end():].split(r"\end{document}", 1)[0]


def main_source_dir(number: int, source_root: Path) -> Path:
    matches = sorted(source_root.glob(f"cs336_lecture_{number:02d}_*"))
    if len(matches) != 1 or not matches[0].is_dir():
        raise FileNotFoundError(f"Expected one lecture directory for {number:02d}, found {len(matches)}")
    return matches[0]


def build_lecture(lecture: dict, output_root: Path, source_root: Path) -> dict:
    number = lecture["number"]
    source_dir = main_source_dir(number, source_root)
    output_dir = output_root / f"lecture-{number:02d}.html"
    renderer = ArticleRenderer(number, source_dir, output_root, source_body(source_dir, number))
    nodes = renderer.parse()
    document = renderer.render_document(nodes)
    if not renderer.toc:
        raise ValueError(f"Lecture {number:02d}: no section headings parsed")

    output_dir.parent.mkdir(parents=True, exist_ok=True)
    output_dir.write_text(document + "\n", encoding="utf-8")
    text_parser = VisibleTextParser()
    text_parser.feed(document)
    visible_text = re.sub(r"\s+", " ", " ".join(text_parser.parts)).strip()
    record = {
        "lectureId": lecture["id"],
        "file": f"./course-articles/cs336/{output_dir.name}",
        "toc": renderer.toc,
        "searchText": visible_text,
        "htmlBytes": output_dir.stat().st_size,
        "htmlSha256": hashlib.sha256(output_dir.read_bytes()).hexdigest(),
        "sourceBodySha256": hashlib.sha256(renderer.source.encode()).hexdigest(),
        "textCharacters": len(visible_text),
        **renderer.stats,
        "unknownMacros": dict(renderer.unknown_macros),
        "sourceHeadings": len(re.findall(r"\\(?:section|subsection|subsubsection|paragraph)\*?\{", renderer.source)),
        "sourceFigureRefs": len(re.findall(r"\\(?:lecturefig|includegraphics)(?:\[[^]]*\])?\{", renderer.source)),
        "sourceCodeBlocks": len(re.findall(r"\\begin\{lstlisting\}", renderer.source)),
    }
    print(
        f"Lecture {number:02d}: {record['textCharacters']:,} text chars, "
        f"{record['headings']} headings, {record['paragraphs']} paragraphs, "
        f"{record['equations']} equations, {record['figures']} figures "
        f"({record.get('pdfFiguresConverted', 0)} PDF figures converted)",
        flush=True,
    )
    if renderer.unknown_macros:
        print(f"  Unmapped text macros: {dict(renderer.unknown_macros)}", flush=True)
    return record


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=SOURCE_ROOT)
    parser.add_argument("--output", type=Path, default=OUTPUT_ROOT)
    parser.add_argument("--lecture", type=int, action="append")
    args = parser.parse_args()

    if not args.source.is_dir():
        parser.error(f"CS336 source repository not found: {args.source}")
    for command in ("pdftoppm", "convert", "identify"):
        if shutil.which(command) is None:
            parser.error(f"Required image tool not found: {command}")

    courses = json.loads(COURSE_DATA.read_text(encoding="utf-8"))["courses"]
    if len(courses) != 1 or courses[0]["id"] != "cs336":
        parser.error("Expected CS336 course metadata")
    lectures = courses[0]["lectures"]
    selected = set(args.lecture or [lecture["number"] for lecture in lectures])
    if any(number < 1 or number > len(lectures) for number in selected):
        parser.error("lecture number out of range")
    if len(selected) != len(args.lecture or selected):
        parser.error("duplicate lecture number")

    output_root = args.output.resolve()
    if output_root.parts[-2:] != ("course-articles", "cs336"):
        parser.error("output must end in course-articles/cs336 so image URLs share the same site root")
    output_root.mkdir(parents=True, exist_ok=True)
    records = [build_lecture(lecture, output_root, args.source.resolve()) for lecture in lectures if lecture["number"] in selected]

    index_path = output_root / "index.json"
    if len(records) == len(lectures):
        index = {"courseId": "cs336", "lectures": records}
    elif index_path.is_file():
        index = json.loads(index_path.read_text(encoding="utf-8"))
        by_id = {item["lectureId"]: item for item in index["lectures"]}
        by_id.update({item["lectureId"]: item for item in records})
        index["lectures"] = [by_id[lecture["id"]] for lecture in lectures if lecture["id"] in by_id]
    else:
        index = {"courseId": "cs336", "lectures": records}
    index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    total_chars = sum(item["textCharacters"] for item in index["lectures"])
    print(f"Wrote {len(records)} articles; indexed {total_chars:,} visible text characters.")


if __name__ == "__main__":
    main()
