/**
 * App Orchestrator - ties together URL parsing, Git API, Resource Resolver, and UI
 */

(function () {
  // ── DOM refs ──
  const urlInput = document.getElementById('url-input');
  const renderBtn = document.getElementById('render-btn');
  const settingsToggle = document.getElementById('settings-toggle');
  const settingsPanel = document.getElementById('settings-panel');
  const tokenDomain = document.getElementById('token-domain');
  const tokenInput = document.getElementById('token-input');
  const tokenSaveBtn = document.getElementById('token-save');
  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');
  const progressFill = document.getElementById('progress-fill');
  const errorPanel = document.getElementById('error-panel');
  const errorMsg = document.getElementById('error-msg');
  const errorClose = document.getElementById('error-close');
  const previewFrame = document.getElementById('preview-frame');
  const welcomeScreen = document.getElementById('welcome');

  // Current render context (for in-iframe navigation)
  let currentCtx = null;

  // ── Init ──

  function init() {
    setupEventListeners();
    checkHashAndRender();
  }

  function setupEventListeners() {
    renderBtn.addEventListener('click', () => render());
    urlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') render();
    });

    settingsToggle.addEventListener('click', () => {
      settingsPanel.classList.toggle('open');
    });

    tokenSaveBtn.addEventListener('click', saveToken);

    errorClose.addEventListener('click', () => {
      errorPanel.classList.remove('visible');
    });

    window.addEventListener('hashchange', checkHashAndRender);

    // Listen for navigation messages from iframe
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'navigate') {
        handleIframeNavigation(e.data.href);
      }
    });
  }

  // ── Token management ──

  function getToken(domain) {
    return localStorage.getItem(`token:${domain}`) || '';
  }

  function saveToken() {
    const domain = tokenDomain.value.trim();
    const token = tokenInput.value.trim();
    if (!domain) return;

    if (token) {
      localStorage.setItem(`token:${domain}`, token);
    } else {
      localStorage.removeItem(`token:${domain}`);
    }
    tokenInput.value = '';
    showStatus(`${domain} 토큰 저장됨`);
  }

  // ── Render flow ──

  function checkHashAndRender() {
    const hash = location.hash.slice(1);
    if (hash) {
      urlInput.value = decodeURIComponent(hash);
      render();
    }
  }

  async function render() {
    const url = urlInput.value.trim();
    if (!url) return;

    hideError();
    renderBtn.disabled = true;
    renderBtn.textContent = '로딩...';

    try {
      // 1. Parse URL
      const parsed = parseGitUrl(url);

      // Update token input hint
      const domain = new URL(parsed.origin).hostname;
      tokenDomain.value = domain;

      // 2. Get token
      const token = getToken(domain);

      // 3. Create API client
      const api = new GitAPI(parsed.provider, parsed.origin, token);

      // 4. Resolve branch
      let branch = parsed.branch;
      if (!branch) {
        showStatus('기본 브랜치 조회 중...');
        branch = await api.getDefaultBranch(parsed.owner, parsed.repo);
      }

      // 5. Get file tree
      showStatus('파일 트리 조회 중...');
      const tree = await api.getTree(parsed.owner, parsed.repo, branch);
      const blobs = tree.filter(f => f.type === 'blob');

      if (blobs.length === 0) {
        throw new Error('이 저장소에 파일이 없습니다');
      }

      // Build path → sha map
      const fileTree = new Map();
      for (const item of blobs) {
        fileTree.set(item.path, item.sha);
      }

      // 6. Find entry file within basePath
      const basePath = parsed.path || '';
      const entryFile = findEntryFile(blobs, basePath);
      if (!entryFile) {
        throw new Error('이 경로에 HTML 파일이 없습니다');
      }

      // Save context for in-iframe navigation
      currentCtx = {
        api, owner: parsed.owner, repo: parsed.repo,
        fileTree, basePath,
      };

      // 7. Render the entry file
      await renderHtmlFile(entryFile, currentCtx);

      // 8. Update URL hash
      location.hash = '#' + encodeURIComponent(url);

    } catch (err) {
      showError(err.message);
    } finally {
      renderBtn.disabled = false;
      renderBtn.textContent = 'Render';
    }
  }

  /**
   * Fetch an HTML file from Git, resolve all resources, and display in iframe
   */
  async function renderHtmlFile(filePath, ctx) {
    showStatus(`리소스 로딩 중... (${filePath})`);
    showProgress();

    // Cleanup previous blob URLs
    ResourceResolver.cleanup();

    // Fetch the HTML file as text
    const sha = ctx.fileTree.get(filePath);
    if (!sha) {
      throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
    }

    const blobData = await ctx.api.getBlob(ctx.owner, ctx.repo, sha);
    let htmlText;
    if (blobData.raw) {
      htmlText = new TextDecoder('utf-8').decode(blobData.raw);
    } else {
      const binaryString = atob(blobData.content.replace(/\n/g, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      htmlText = new TextDecoder('utf-8').decode(bytes);
    }

    // Resolve all resource references to blob URLs
    const htmlDir = filePath.lastIndexOf('/') >= 0
      ? filePath.substring(0, filePath.lastIndexOf('/'))
      : '';

    const resolvedHtml = await ResourceResolver.resolveHtml(
      htmlText, htmlDir, ctx.fileTree, ctx.api, ctx.owner, ctx.repo,
      (loaded, total, path) => {
        updateProgress(loaded, total, path);
      }
    );

    // Create blob URL for the final HTML and set as iframe src
    const htmlBlob = new Blob([resolvedHtml], { type: 'text/html' });
    const htmlUrl = URL.createObjectURL(htmlBlob);

    welcomeScreen.classList.add('hidden');
    previewFrame.classList.remove('hidden');
    previewFrame.src = htmlUrl;

    showStatus(`렌더링 완료 (${filePath})`);
    setTimeout(() => {
      statusBar.classList.remove('visible');
    }, 1500);
  }

  /**
   * Handle navigation messages from within the iframe
   */
  async function handleIframeNavigation(href) {
    if (!currentCtx) return;

    try {
      // Resolve the href relative to basePath
      const targetPath = ResourceResolver.normalizePath(
        currentCtx.basePath ? currentCtx.basePath + '/' + href : href
      );

      if (!currentCtx.fileTree.has(targetPath)) {
        showError(`파일을 찾을 수 없습니다: ${targetPath}`);
        return;
      }

      renderBtn.disabled = true;
      renderBtn.textContent = '로딩...';
      await renderHtmlFile(targetPath, currentCtx);
    } catch (err) {
      showError(err.message);
    } finally {
      renderBtn.disabled = false;
      renderBtn.textContent = 'Render';
    }
  }

  function findEntryFile(blobs, basePath) {
    const candidates = ['index.html', 'index.htm', 'default.html'];
    const paths = blobs.map(b => b.path);

    for (const candidate of candidates) {
      const full = basePath ? `${basePath}/${candidate}` : candidate;
      if (paths.includes(full)) return full;
    }

    // Fallback: first HTML file in basePath
    const prefix = basePath ? basePath + '/' : '';
    const htmlFile = paths.find(p =>
      p.startsWith(prefix) && (p.endsWith('.html') || p.endsWith('.htm'))
    );
    return htmlFile || null;
  }

  // ── UI helpers ──

  function showStatus(text) {
    statusBar.classList.add('visible');
    statusText.textContent = text;
  }

  function showProgress() {
    progressFill.style.width = '0%';
  }

  function updateProgress(loaded, total, filePath) {
    if (total > 0) {
      const pct = Math.round((loaded / total) * 100);
      progressFill.style.width = pct + '%';
      statusText.textContent = `${loaded}/${total} ${filePath}`;
    }
  }

  function showError(msg) {
    errorPanel.classList.add('visible');
    errorMsg.textContent = msg;
    statusBar.classList.remove('visible');
  }

  function hideError() {
    errorPanel.classList.remove('visible');
  }

  // ── Start ──

  init();
})();
