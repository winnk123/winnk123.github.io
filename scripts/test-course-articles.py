"""Regression tests for HTML link escaping, using only the standard library."""
from html import escape
import importlib.util
from pathlib import Path
import unittest
from urllib.parse import parse_qs, urlsplit

spec = importlib.util.spec_from_file_location(
    'check_course_articles', Path(__file__).with_name('check-course-articles.py'))
checker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(checker)


class CourseLinkTests(unittest.TestCase):
    def parse_link(self, markup):
        article = checker.Article()
        article.feed(markup)
        article.close()
        self.assertFalse(article.stack)
        return article

    def test_escaped_footnote_routes_and_backlinks(self):
        for number in (1, 9, 18):
            lecture = f'lecture-{number:02d}'
            for prefix in ('course-footnote', 'course-footnote-ref'):
                section = f'{prefix}-{number:02d}-1'
                route = f'#courses?lecture={lecture}&section={section}'
                with self.subTest(route=route):
                    article = self.parse_link(f'<a href="{escape(route, quote=True)}">1</a>')
                    self.assertEqual(article.links, [route])
                    self.assertEqual(parse_qs(urlsplit(article.links[0][1:]).query),
                                     {'lecture': [lecture], 'section': [section]})

    def test_bare_ampersands_are_rejected_on_every_python_version(self):
        for href in ('#courses?lecture=lecture-01&section=course-footnote-01-1',
                     'https://example.org/?a=1&copy=2',
                     'https://example.org/?a=1&other=2'):
            with self.subTest(href=href):
                with self.assertRaisesRegex(AssertionError, 'unescaped ampersand'):
                    self.parse_link(f'<a href="{href}">link</a>')

    def test_external_query_links_and_label_entities(self):
        url = 'https://example.org/?a=1&section=notes&copy=2'
        article = self.parse_link(f'<a href="{escape(url, quote=True)}">A &amp; B</a>')
        self.assertEqual(article.links, [url])
        self.assertEqual(''.join(article.parts), 'A & B')

    def test_attribute_entities_are_decoded_only_once(self):
        url = 'https://example.org/?literal=&amp;section'
        article = self.parse_link(f'<a href="{escape(url, quote=True)}">link</a>')
        self.assertEqual(article.links, [url])


if __name__ == '__main__':
    unittest.main()
