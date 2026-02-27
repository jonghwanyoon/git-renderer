# Git Renderer

Render web content from any Git repository directly in the browser — no server required.

A single HTML file that fetches HTML/CSS/JS/images from GitHub or GitLab repositories via their public APIs, resolves all resource references to blob URLs, and renders the result in an iframe.

## Quick Start

1. **Download** `dist/git-renderer.html`
2. **Open** it in a browser
3. **Paste** a Git repository URL and click **Render**

Or use a hash URL for instant rendering:

```
git-renderer.html#https://github.com/user/repo/tree/main/docs
```

## Deploy on GitHub Pages

1. Push `git-renderer.html` to a GitHub repository
2. Enable GitHub Pages (Settings → Pages → Source: `main`)
3. Share the link:

```
https://username.github.io/repo/git-renderer.html#https://github.com/target-user/target-repo
```

Anyone clicking the link sees the rendered content instantly. No backend needed.

## Supported URL Formats

```
# GitHub
https://github.com/user/repo
https://github.com/user/repo/tree/main/docs

# GitLab
https://gitlab.example.com/group/project
https://gitlab.example.com/group/project/-/tree/main/docs
```

## Private Repositories

Click the **Token** button and save an API token per domain:

- **GitHub**: Personal Access Token (`ghp_xxxx`)
- **GitLab**: Personal Access Token (`glpat-xxxx`)

Tokens are stored in `localStorage` (never sent anywhere except the respective API).

## How It Works

1. Parse the Git URL to extract provider, owner, repo, branch, and path
2. Fetch the file tree via Git API
3. Find the entry HTML file (`index.html` or first `.html`)
4. Fetch the HTML content and parse it with `DOMParser`
5. Collect all resource references (`<link>`, `<script>`, `<img>`, CSS `url()`, etc.)
6. Fetch each resource via Git API → create `Blob` → `URL.createObjectURL()`
7. Replace original references with blob URLs
8. Inject navigation script for in-iframe link handling
9. Create a blob URL for the final HTML and set it as `iframe.src`

## Build

```bash
bash build.sh
# → dist/git-renderer.html (single file, ~34KB)
```

The build script inlines all CSS and JS into one self-contained HTML file.

## Development

```
├── index.html              # Dev entry point (loads separate JS files)
├── css/style.css           # Styles
├── js/
│   ├── mime-types.js       # MIME type mapping
│   ├── url-parser.js       # Git URL parser (GitHub/GitLab)
│   ├── git-api.js          # Unified Git API client
│   ├── resource-resolver.js # HTML/CSS resource → blob URL resolver
│   └── app.js              # App orchestrator
├── build.sh                # Builds single-file dist
└── dist/
    └── git-renderer.html   # Built output (deploy this)
```

## License

MIT
