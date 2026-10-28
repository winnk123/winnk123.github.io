"""Validate deployed native course fragments; optionally audit them against CS336 sources."""
from __future__ import annotations

import argparse
from collections import Counter
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET
from urllib.parse import parse_qs, urlsplit

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / 'dist'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'p', 'section', 'figure', 'aside', 'ul', 'ol', 'dl', 'table', 'div', 'pre', 'h2', 'h3', 'h4', 'h5', 'h6'}

class Article(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = set()
        self.images = []
        self.links = []
        self.parts = []
        self.codes = []
        self.code = None
        self.counts = Counter()

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        assert tag not in {'script', 'iframe', 'object', 'embed', 'style'}, f'unsafe article element: {tag}'
        assert not any(key.startswith('on') for key in attrs), 'inline event handler'
        if tag in BLOCK:
            assert 'p' not in self.stack, f'block <{tag}> nested in paragraph'
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'duplicate anchor: {attrs["id"]}'
            self.ids.add(attrs['id'])
        if tag == 'img':
            assert attrs.get('alt'), 'image missing alternative text'
            self.images.append(attrs['src'])
        if tag == 'a':
            self.links.append(attrs.get('href', ''))
        classes = attrs.get('class', '').split()
        for name in ['course-source-callout', 'course-code-block', 'course-source-table', 'course-footnote-ref']:
            if name in classes:
                self.counts[name] += 1
        if tag == 'math':
            self.counts['math'] += 1
        if tag == 'pre':
            self.code = []
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        assert self.stack and self.stack[-1] == tag, f'unbalanced </{tag}>: {self.stack[-5:]}'
        self.stack.pop()
        if tag == 'pre':
            self.codes.append(''.join(self.code or []))
            self.code = None

    def handle_data(self, text):
        self.parts.append(text)
        if self.code is not None:
            self.code.append(text)


def compact(value):
    return re.sub(r'\s+', '', value)


def source_evidence(module, nodes, source):
    fragments, code = [], []
    counts = Counter()
    def walk(nodes):
        for node in nodes:
            if isinstance(node, module.LatexMathNode):
                counts['math'] += 1
            elif isinstance(node, module.LatexCharsNode):
                text = compact(node.chars)
                if len(text) >= 4:
                    fragments.append(text)
            elif isinstance(node, module.LatexGroupNode):
                walk(node.nodelist)
            elif isinstance(node, module.LatexMacroNode):
                name = node.macroname
                args = [x for x in getattr(getattr(node, 'nodeargd', None), 'argnlist', []) if x is not None]
                if name in module.IGNORED_MACROS:
                    continue
                if name == 'lecturefig':
                    counts['images'] += 1
                    args = args[-1:]
                elif name == 'includegraphics':
                    counts['images'] += 1
                    continue
                elif name == 'href':
                    args = args[-1:]
                elif name == 'footnote':
                    counts['footnotes'] += 1
                    args = args[-1:]
                elif name in module.HEADING_COMMANDS:
                    counts['headings'] += 1
                    args = args[-1:]
                for arg in args:
                    if isinstance(arg, module.LatexGroupNode):
                        walk(arg.nodelist)
            elif isinstance(node, module.LatexEnvironmentNode):
                name = node.environmentname
                if name == 'lstlisting':
                    raw = source[node.pos:node.pos + node.len]
                    start = re.match(r'\\begin\{lstlisting\}(?:\[([^\]]*)\])?', raw, re.S)
                    code.append(raw[start.end():raw.rfind(r'\end{lstlisting}')].strip('\r\n'))
                    continue
                if name in {'importantbox', 'knowledgebox', 'warningbox', 'tcolorbox'}:
                    counts['callouts'] += 1
                    for arg in getattr(node.nodeargd, 'argnlist', []):
                        if arg is not None and isinstance(arg, module.LatexGroupNode):
                            walk(arg.nodelist)
                if name in {'tabularx', 'tabular'}:
                    counts['tables'] += 1
                walk(node.nodelist or [])
    walk(nodes)
    return fragments, code, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source', type=Path, help='Also compare every original text fragment/code block (requires pylatexenc).')
    args = parser.parse_args()
    manifest = json.loads((DIST / 'course-articles/cs336/index.json').read_text())
    metadata = json.loads((ROOT / 'content/courses.json').read_text())['courses'][0]['lectures']
    assert {x['lectureId'] for x in manifest['lectures']} == {x['id'] for x in metadata}, 'lecture coverage mismatch'
    module = None
    if args.source:
        spec = importlib.util.spec_from_file_location('course_migration', ROOT / 'scripts/migrate-course-notes.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
    totals = Counter()
    for entry in manifest['lectures']:
        identity = entry['lectureId']
        file = (DIST / entry['file'].removeprefix('./')).resolve()
        assert file.is_relative_to(DIST.resolve()), 'article path escapes dist'
        text = file.read_text()
        assert hashlib.sha256(file.read_bytes()).hexdigest() == entry['htmlSha256'], f'{identity}: modified generated HTML'
        parsed = Article()
        parsed.feed(text)
        parsed.close()
        assert not parsed.stack, f'{identity}: unclosed elements {parsed.stack}'
        assert len(parsed.images) == entry['sourceFigureRefs'] == entry['inlineImages'], f'{identity}: figure count mismatch'
        assert len(parsed.codes) == entry['sourceCodeBlocks'], f'{identity}: code count mismatch'
        assert all(item['id'] in parsed.ids for item in entry['toc']), f'{identity}: missing TOC anchors'
        assert parsed.counts['math'] == entry['equations'], f'{identity}: duplicated or missing equations'
        assert parsed.counts['course-source-callout'] == entry['callouts'], f'{identity}: callout count mismatch'
        for source in parsed.images:
            image = (DIST / source.removeprefix('./')).resolve()
            assert image.is_relative_to(DIST.resolve()), f'{identity}: asset path escapes dist'
            header = image.read_bytes()[:12]
            assert header[:4] == b'RIFF' and header[8:12] == b'WEBP', f'{identity}: invalid WebP {source}'
        for href in parsed.links:
            if href.startswith('#'):
                query = parse_qs(urlsplit(href[1:]).query)
                assert query.get('lecture') == [identity], f'{identity}: link loses lecture route {href}'
                target = query.get('section', [''])[0]
                assert target in parsed.ids, f'{identity}: broken internal link {href}'
            else:
                assert href.startswith(('https://', 'http://', 'mailto:')), f'{identity}: invalid link {href}'
        for match in re.finditer(r'<math\b.*?</math>', text, re.S):
            math = ET.fromstring(match.group())
            assert math.tag == '{http://www.w3.org/1998/Math/MathML}math', f'{identity}: invalid math namespace'
            assert not any('\\' in (element.text or '') for element in math.iter()), f'{identity}: unsupported math token'
        if module:
            number = int(identity[-2:])
            directory = module.main_source_dir(number, args.source.resolve())
            original = module.source_body(directory, number)
            assert hashlib.sha256(original.encode()).hexdigest() == entry['sourceBodySha256'], f'{identity}: stale source migration'
            nodes, _, _ = module.LatexWalker(original, latex_context=module.make_context()).get_latex_nodes()
            fragments, codes, expected = source_evidence(module, nodes, original)
            rendered_text = compact(''.join(parsed.parts))
            missing = [fragment for fragment in fragments if fragment not in rendered_text]
            assert not missing, f'{identity}: missing {len(missing)} source text fragments: {missing[:5]}'
            assert parsed.counts['math'] == expected['math'], f'{identity}: lost source equations'
            assert parsed.codes == codes, f'{identity}: changed source code'
            assert parsed.counts['course-footnote-ref'] == expected['footnotes'], f'{identity}: lost footnotes'
            assert parsed.counts['course-source-callout'] == expected['callouts'], f'{identity}: lost callouts'
            assert parsed.counts['course-source-table'] == expected['tables'], f'{identity}: lost tables'
            assert len(entry['toc']) == expected['headings'], f'{identity}: lost headings'
            assert len(parsed.images) == expected['images'], f'{identity}: lost images'
            totals['sourceTextFragments'] += len(fragments)
        totals['articles'] += 1
        totals['headings'] += len(entry['toc'])
        totals['images'] += len(parsed.images)
        totals['formulas'] += parsed.counts['math']
        totals['codeBlocks'] += len(parsed.codes)
        totals['callouts'] += parsed.counts['course-source-callout']
        totals['footnotes'] += parsed.counts['course-footnote-ref']
    print('Course migration audit passed: ' + ', '.join(f'{value} {key}' for key, value in totals.items()))

if __name__ == '__main__':
    main()
