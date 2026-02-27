#!/bin/bash
# Build script: bundle CSS and JS into a single HTML file
# Output: dist/git-renderer.html (single file, no server needed)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

mkdir -p dist

echo "Building git-renderer..."

# Read source files
CSS=$(cat css/style.css)
MIME_TYPES_JS=$(cat js/mime-types.js)
URL_PARSER_JS=$(cat js/url-parser.js)
GIT_API_JS=$(cat js/git-api.js)
RESOURCE_RESOLVER_JS=$(cat js/resource-resolver.js)
APP_JS=$(cat js/app.js)

# Build single HTML file by inlining CSS and JS
cat > dist/git-renderer.html << 'HEADER'
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Git Renderer</title>
  <style>
HEADER

echo "$CSS" >> dist/git-renderer.html

cat >> dist/git-renderer.html << 'MIDDLE'
  </style>
</head>
<body>
  <div id="app">
    <!-- Top bar -->
    <div class="top-bar">
      <span class="logo">Git Renderer</span>
      <input
        id="url-input"
        type="text"
        placeholder="Git 저장소 URL을 입력하세요 (예: https://gitlab.company.com/group/project/-/tree/main/docs)"
        spellcheck="false"
        autocomplete="off"
      >
      <button id="render-btn">Render</button>
      <button id="settings-toggle">Token</button>
    </div>

    <!-- Settings panel (collapsible) -->
    <div id="settings-panel" class="settings-panel">
      <h3>API Token (도메인별 저장)</h3>
      <div class="token-row">
        <label>Domain:</label>
        <input id="token-domain" type="text" placeholder="gitlab.company.com">
      </div>
      <div class="token-row">
        <label>Token:</label>
        <input id="token-input" type="password" placeholder="glpat-xxxx 또는 ghp_xxxx">
        <button id="token-save">Save</button>
      </div>
    </div>

    <!-- Status bar -->
    <div id="status-bar" class="status-bar">
      <span id="status-text"></span>
      <div class="progress">
        <div id="progress-fill" class="progress-fill"></div>
      </div>
    </div>

    <!-- Error panel -->
    <div id="error-panel" class="error-panel">
      <span id="error-msg" class="error-msg"></span>
      <button id="error-close" class="close-btn">&times;</button>
    </div>

    <!-- Welcome screen -->
    <div id="welcome" class="welcome">
      <div>
        <h2>Git Renderer</h2>
        <p>
          Git 저장소의 웹 콘텐츠를 바로 렌더링합니다.<br>
          위 입력란에 GitLab 또는 GitHub URL을 입력하세요.<br><br>
          URL 형식: <code>#https://gitlab.company.com/group/project/-/tree/main/docs</code><br>
          브라우저 단축키: <code>gr https://gitlab.company.com/...</code>
        </p>
      </div>
    </div>

    <!-- Preview iframe (hidden until render) -->
    <iframe
      id="preview-frame"
      class="hidden"
      sandbox="allow-scripts allow-same-origin allow-forms"
    ></iframe>
  </div>

  <script>
MIDDLE

echo "$MIME_TYPES_JS" >> dist/git-renderer.html
echo "" >> dist/git-renderer.html
echo "$URL_PARSER_JS" >> dist/git-renderer.html
echo "" >> dist/git-renderer.html
echo "$GIT_API_JS" >> dist/git-renderer.html
echo "" >> dist/git-renderer.html
echo "$RESOURCE_RESOLVER_JS" >> dist/git-renderer.html
echo "" >> dist/git-renderer.html
echo "$APP_JS" >> dist/git-renderer.html

cat >> dist/git-renderer.html << 'FOOTER'
  </script>
</body>
</html>
FOOTER

# Report
HTML_SIZE=$(wc -c < dist/git-renderer.html)
echo "Done!"
echo "  dist/git-renderer.html  $(( HTML_SIZE / 1024 ))KB"
echo ""
echo "Deploy this single file anywhere - no server required."
