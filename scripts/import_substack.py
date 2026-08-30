#!/usr/bin/env python3
"""Import the public Substack RSS feed as clean, text-only Hugo Markdown."""

from datetime import datetime
from email.utils import parsedate_to_datetime
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET


SKIP_CLASSES = {
    "captioned-image-container",
    "subscription-widget-wrap-editor",
    "subscription-widget",
}

VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}


class MarkdownParser(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.out = []
        self.skip_depth = 0
        self.links = []
        self.lists = []
        self.in_li = 0
        self.in_pre = False
        self.inline_code = 0

    def emit(self, value):
        if not self.skip_depth:
            self.out.append(value)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        classes = set(attrs.get("class", "").split())
        if self.skip_depth:
            if tag not in VOID_TAGS:
                self.skip_depth += 1
            return
        if tag in {"img", "source", "input"}:
            return
        if tag in {"script", "style", "svg", "form", "button", "picture"} or classes & SKIP_CLASSES:
            self.skip_depth = 1
            return
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6"}:
            self.emit("\n\n" + "#" * int(tag[1]) + " ")
        elif tag == "p":
            if not self.in_li:
                self.emit("\n\n")
        elif tag == "br":
            self.emit("  \n")
        elif tag == "blockquote":
            self.emit("\n\n> ")
        elif tag in {"ul", "ol"}:
            self.lists.append(tag)
            self.emit("\n")
        elif tag == "li":
            marker = "1. " if self.lists and self.lists[-1] == "ol" else "- "
            self.emit("\n" + "  " * max(0, len(self.lists) - 1) + marker)
            self.in_li += 1
        elif tag == "a":
            self.links.append(attrs.get("href", ""))
            self.emit("[")
        elif tag in {"strong", "b"}:
            self.emit("**")
        elif tag in {"em", "i"}:
            self.emit("*")
        elif tag == "pre":
            self.in_pre = True
            self.emit("\n\n```text\n")
        elif tag == "code" and not self.in_pre:
            self.inline_code += 1
            if self.inline_code == 1:
                self.emit("`")

    def handle_endtag(self, tag):
        if self.skip_depth:
            self.skip_depth -= 1
            return
        if tag in {"h1", "h2", "h3", "h4", "h5", "h6", "blockquote"}:
            self.emit("\n\n")
        elif tag == "p":
            if not self.in_li:
                self.emit("\n\n")
        elif tag == "li":
            self.in_li = max(0, self.in_li - 1)
        elif tag in {"ul", "ol"}:
            if self.lists:
                self.lists.pop()
            self.emit("\n")
        elif tag == "a":
            href = self.links.pop() if self.links else ""
            self.emit(f"]({href})" if href else "]")
        elif tag in {"strong", "b"}:
            self.emit("**")
        elif tag in {"em", "i"}:
            self.emit("*")
        elif tag == "pre":
            self.emit("\n```\n\n")
            self.in_pre = False
        elif tag == "code" and not self.in_pre and self.inline_code:
            self.inline_code -= 1
            if self.inline_code == 0:
                self.emit("`")

    def handle_data(self, data):
        if self.skip_depth:
            return
        if self.in_pre:
            self.emit(data)
        else:
            self.emit(re.sub(r"[ \t\r\f\v]+", " ", data))

    def markdown(self):
        text = "".join(self.out)
        text = re.sub(r"\n[ \t]+\n", "\n\n", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        text = re.sub(r" +\n", "\n", text)
        text = re.sub(r">\n\n(?=\S)", "> ", text)
        return text.strip() + "\n"


def fetch(url):
    request = Request(url, headers={"User-Agent": "andreabor.io importer/1.0"})
    with urlopen(request, timeout=30) as response:
        return response.read()


def main():
    feed_url = sys.argv[1] if len(sys.argv) > 1 else "https://andreaborio.substack.com/feed"
    destination = Path(__file__).resolve().parents[1] / "content" / "posts"
    root = ET.fromstring(fetch(feed_url))
    namespace = {"content": "http://purl.org/rss/1.0/modules/content/"}
    imported = []

    for item in root.findall("./channel/item"):
        title = item.findtext("title", "").strip()
        description = item.findtext("description", "").strip()
        source_url = item.findtext("link", "").strip()
        published = parsedate_to_datetime(item.findtext("pubDate"))
        html = item.findtext("content:encoded", "", namespace)
        slug = Path(urlparse(source_url).path).name

        parser = MarkdownParser()
        parser.feed(html)
        body = parser.markdown()
        front_matter = "\n".join([
            "---",
            f"title: {json.dumps(title, ensure_ascii=False)}",
            f"date: {published.isoformat()}",
            f"description: {json.dumps(description, ensure_ascii=False)}",
            f"source_url: {json.dumps(source_url)}",
            f"slug: {json.dumps(slug)}",
            "---",
            "",
        ]) + "\n"
        (destination / f"{slug}.md").write_text(front_matter + body, encoding="utf-8")
        imported.append((published, title, slug))

    for published, title, slug in sorted(imported, reverse=True):
        print(f"{published.date()}  {slug}  {title}")


if __name__ == "__main__":
    main()
