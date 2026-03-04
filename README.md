# Centre for Music and Science — Website

The website for the [Centre for Music and Science](https://centre-for-music-and-science.github.io/website/) at the University of Cambridge, built with [Hugo](https://gohugo.io/).

## Prerequisites

Install Hugo **extended** edition (v0.157.0 or later):

```bash
# macOS
brew install hugo

# Linux (Debian/Ubuntu) — download from GitHub releases
wget -O hugo.deb https://github.com/gohugoio/hugo/releases/download/v0.157.0/hugo_extended_0.157.0_linux-amd64.deb
sudo dpkg -i hugo.deb

# Verify
hugo version
```

No other dependencies are required. The theme is included in the repository under `themes/cms/`.

## Local development

Clone the repository and start the dev server:

```bash
git clone https://github.com/centre-for-music-and-science/website.git
cd website
hugo server -D
```

The site will be available at **http://localhost:1313/**. The server watches for file changes and reloads automatically.

Useful flags:

| Flag | Description |
|------|-------------|
| `-D` | Include draft content |
| `--buildFuture` | Include future-dated content (enabled by default in `hugo.toml`) |
| `--disableFastRender` | Full rebuild on every change (slower but avoids stale state) |
| `--port 1414` | Use a different port |

## Project structure

```
.
├── content/             # Markdown content
│   ├── people/          # Lab members
│   ├── projects/        # Research projects
│   ├── themes/          # Research theme groupings
│   ├── publications/    # Publication entries
│   ├── events/          # Events
│   ├── datasets/        # Dataset pages
│   ├── facilities/      # Facilities info
│   └── applicants/      # Applicant info (PhD, MPhil, etc.)
├── data/                # YAML data files (lab authors, past members, videos)
├── static/              # Static assets (images, audio, JSON)
├── themes/cms/          # Custom Hugo theme
│   ├── layouts/         # HTML templates
│   └── static/          # Theme CSS and JS
├── hugo.toml            # Site configuration
└── .github/workflows/   # GitHub Actions deployment
```

## Adding content

### New publication

Create a file in `content/publications/`:

```yaml
---
title: "Paper Title"
date: 2026-01-15
authors: "Author, A., Author, B., & Author, C."
journal: "Journal Name, 12(3), 100–115."
doi: "https://doi.org/10.xxxx/xxxxx"
---
```

### New person

Create a file in `content/people/`:

```yaml
---
title: "Full Name"
role: "PhD Student"
category: "phd"          # director | phd | postdoc | technical | emeritus | affiliate
weight: 10               # controls sort order within category
email: "abc1@cam.ac.uk"
image: "/images/people/full-name.jpg"
website: "https://example.com"
---

Optional bio text here.
```

Place the photo in `static/images/people/`.

### New project

Create a file in `content/projects/` and add its slug to the relevant theme file in `content/themes/`:

```yaml
---
title: "Project Title"
theme: "music-cognition"   # must match a theme filename
summary: "One-line summary."
people:
  - "person-slug"
publications:
  - "publication-slug"
media:
  - type: "image"
    src: "/images/projects/filename.png"
    caption: "Description"
---

Project body text.
```

## Production build

```bash
hugo --gc --minify --cleanDestinationDir
```

Output goes to `public/`. Deployment to GitHub Pages happens automatically on push to `main` via GitHub Actions.
