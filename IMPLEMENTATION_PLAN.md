# Implementation plan

## What ships

A small Hugo site at `andreabor.io` with four page types: home, post index, article, and the About/Now pages. The first version contains one new post, `Why this blog exists`, plus the two articles currently exposed by Andrea's public Substack feed.

The Substack articles keep their original title, date, prose, headings, links, code, and attribution. Images and signup widgets are left out because this site is deliberately text-only. Each imported article links to the original Substack page.

## Editorial direction

The short site copy should sound like the field notes, not like a personal-brand exercise. Start with the machine, the test, or the number. Name the actual tools. Keep jokes sparse. State what a result does not prove when that distinction matters.

Avoid generic claims about AI, a punchline at the end of every paragraph, repeated three-part lists, perfect “not X but Y” contrasts, and headings that read like a content-marketing template.

## Technical shape

- Hugo with custom templates; no external theme.
- Markdown content and one CSS file under 150 lines.
- No JavaScript, trackers, external fonts, or images.
- Responsive layout, visible keyboard focus, semantic navigation, and a skip link.
- Home page shows the five newest posts; the post index shows the full archive newest first.
- RSS is available at `/index.xml`; every page has a canonical URL and a useful meta description.
- `robots.txt` explicitly permits major AI search and user-directed retrieval crawlers. Training access follows the hosting provider's Content Signals policy. Each page also has a clean Markdown alternate, while `/llms.txt` and `/llms-full.txt` provide a curated map and a compact full-text corpus.
- A small importer refreshes the public Substack archive without copying its widgets or presentation markup.

## Checks before publishing

1. `hugo --minify` completes without warnings or errors.
2. Home, About, Now, Posts, all article pages, the 404 page, and `/index.xml` are generated.
3. Imported dates match the public feed: 23 June 2026 and 10 June 2026.
4. The built site contains no scripts, remote stylesheets, tracking code, image tags, or subscription widgets.
5. The page remains readable at narrow mobile widths and long code lines scroll instead of breaking the layout.
6. `robots.txt`, `sitemap.xml`, `llms.txt`, `llms-full.txt`, and the Markdown alternates all resolve successfully.
