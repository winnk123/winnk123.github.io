"""Compile authored LaTeX to static, accessible MathML in the guide source."""
import json
from pathlib import Path
from xml.etree import ElementTree as ET
from latex2mathml.converter import convert

path = Path(__file__).resolve().parents[1] / 'content/guides.json'
guides = json.loads(path.read_text())
count = 0

def walk(value):
    global count
    if isinstance(value, dict):
        if isinstance(value.get('latex'), str) and value.get('plain'):
            # MathML Core browsers use table rows for reliable multiline layout.
            latex = value['latex'].replace(r'\begin{gathered}', r'\begin{array}{c}').replace(r'\end{gathered}', r'\end{array}')
            result = convert(latex, display='block')
            root = ET.fromstring(result)
            if '<script' in result or '<merror' in result:
                raise ValueError('Invalid math rendering: ' + value['latex'])
            if any('\\' in (node.text or '') for node in root.iter()):
                raise ValueError('Unsupported LaTeX command: ' + value['latex'])
            if any(node.get('linebreak') == 'newline' for node in root.iter()):
                raise ValueError('Use a multiline math environment: ' + value['latex'])
            root.set('alttext', value['plain'])
            ET.register_namespace('', 'http://www.w3.org/1998/Math/MathML')
            result = ET.tostring(root, encoding='unicode')
            value['mathml'] = result
            value['mathmlSource'] = value['latex']
            count += 1
        for key, child in value.items():
            if key not in ('mathml', 'mathmlSource'):
                walk(child)
    elif isinstance(value, list):
        for child in value:
            walk(child)

for guide in guides:
    walk(guide['knowledge'])
path.write_text(json.dumps(guides, ensure_ascii=False, indent=2))
print(f'Compiled {count} equations to static MathML.')
