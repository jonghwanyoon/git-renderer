/**
 * Resource Resolver - resolves HTML/CSS resource references to blob URLs
 * Fetches resources via Git API and replaces references with blob: URLs
 */

const ResourceResolver = (function () {
  // Cache: "owner/repo/sha" → blob URL
  const blobUrlCache = new Map();

  /**
   * Normalize a file path (resolve . and ..)
   */
  function normalizePath(path) {
    const parts = path.split('/');
    const normalized = [];
    for (const part of parts) {
      if (part === '.' || part === '') continue;
      if (part === '..') {
        normalized.pop();
      } else {
        normalized.push(part);
      }
    }
    return normalized.join('/');
  }

  /**
   * Resolve a relative URL against a base directory path
   */
  function resolveUrl(ref, baseDir) {
    if (ref.startsWith('/')) {
      return normalizePath(ref.slice(1));
    }
    if (baseDir) {
      return normalizePath(baseDir + '/' + ref);
    }
    return normalizePath(ref);
  }

  /**
   * Get directory portion of a path
   */
  function dirName(path) {
    const idx = path.lastIndexOf('/');
    return idx >= 0 ? path.substring(0, idx) : '';
  }

  /**
   * Decode a Git blob response into an ArrayBuffer
   */
  function decodeBlobData(blobData) {
    if (blobData.raw) {
      // GitLab: already an ArrayBuffer
      return blobData.raw;
    }
    // GitHub: base64-encoded
    const binaryString = atob(blobData.content.replace(/\n/g, ''));
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Fetch a file from Git and return a blob URL
   */
  async function fetchAsBlobUrl(filePath, fileTree, api, owner, repo) {
    const sha = fileTree.get(filePath);
    if (!sha) return null;

    const cacheKey = `${owner}/${repo}/${sha}`;
    if (blobUrlCache.has(cacheKey)) {
      return blobUrlCache.get(cacheKey);
    }

    const blobData = await api.getBlob(owner, repo, sha);
    const buffer = decodeBlobData(blobData);
    const mime = getMimeType(filePath);
    const blob = new Blob([buffer], { type: mime });
    const url = URL.createObjectURL(blob);

    blobUrlCache.set(cacheKey, url);
    return url;
  }

  /**
   * Fetch a file as text from Git
   */
  async function fetchAsText(filePath, fileTree, api, owner, repo) {
    const sha = fileTree.get(filePath);
    if (!sha) return null;

    const blobData = await api.getBlob(owner, repo, sha);
    const buffer = decodeBlobData(blobData);
    return new TextDecoder('utf-8').decode(buffer);
  }

  /**
   * Resolve CSS url() and @import references to blob URLs
   */
  async function resolveCss(cssText, cssDir, fileTree, api, owner, repo) {
    // Collect all url(...) references
    const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    const imports = [];
    const urlRefs = [];
    let match;

    // Collect @import
    const importRegex = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*;/g;
    while ((match = importRegex.exec(cssText)) !== null) {
      const ref = match[2] || match[4];
      if (ref && !ref.startsWith('data:') && !ref.startsWith('http://') && !ref.startsWith('https://')) {
        imports.push({ full: match[0], ref });
      }
    }

    // Resolve @import recursively
    for (const imp of imports) {
      const resolved = resolveUrl(imp.ref, cssDir);
      const importedCss = await fetchAsText(resolved, fileTree, api, owner, repo);
      if (importedCss) {
        const importDir = dirName(resolved);
        const resolvedCss = await resolveCss(importedCss, importDir, fileTree, api, owner, repo);
        cssText = cssText.replace(imp.full, resolvedCss);
      }
    }

    // Collect url() references (after import resolution)
    while ((match = urlRegex.exec(cssText)) !== null) {
      const ref = match[2];
      if (ref && !ref.startsWith('data:') && !ref.startsWith('blob:') && !ref.startsWith('http://') && !ref.startsWith('https://') && !ref.startsWith('#')) {
        urlRefs.push({ full: match[0], quote: match[1], ref });
      }
    }

    // Resolve url() references
    for (const urlRef of urlRefs) {
      const resolved = resolveUrl(urlRef.ref, cssDir);
      const blobUrl = await fetchAsBlobUrl(resolved, fileTree, api, owner, repo);
      if (blobUrl) {
        cssText = cssText.replace(urlRef.full, `url(${urlRef.quote}${blobUrl}${urlRef.quote})`);
      }
    }

    return cssText;
  }

  /**
   * Resolve all resource references in an HTML string to blob URLs
   *
   * @param {string} htmlString - Raw HTML content
   * @param {string} basePath - Directory path of the HTML file in the repo
   * @param {Map} fileTree - Map of path → sha
   * @param {GitAPI} api - Git API client
   * @param {string} owner - Repo owner
   * @param {string} repo - Repo name
   * @param {function} onProgress - Progress callback(loaded, total, path)
   * @returns {string} HTML with all references replaced by blob URLs
   */
  async function resolveHtml(htmlString, basePath, fileTree, api, owner, repo, onProgress) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');

    // Collect all resource elements
    const tasks = [];

    // <link rel="stylesheet" href="..."> and <link rel="icon" href="...">
    doc.querySelectorAll('link[href]').forEach(el => {
      const rel = (el.getAttribute('rel') || '').toLowerCase();
      if (rel === 'stylesheet' || rel === 'icon' || rel === 'shortcut icon' || rel === 'preload') {
        const href = el.getAttribute('href');
        if (href && !href.startsWith('data:') && !href.startsWith('http://') && !href.startsWith('https://')) {
          tasks.push({ el, attr: 'href', ref: href, isCSS: rel === 'stylesheet' });
        }
      }
    });

    // <script src="...">
    doc.querySelectorAll('script[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        tasks.push({ el, attr: 'src', ref: src, isCSS: false });
      }
    });

    // <img src="...">
    doc.querySelectorAll('img[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        tasks.push({ el, attr: 'src', ref: src, isCSS: false });
      }
    });

    // <video src="...">, <audio src="...">, <source src="...">
    doc.querySelectorAll('video[src], audio[src], source[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:') && !src.startsWith('http://') && !src.startsWith('https://')) {
        tasks.push({ el, attr: 'src', ref: src, isCSS: false });
      }
    });

    // <img srcset="...">
    doc.querySelectorAll('img[srcset], source[srcset]').forEach(el => {
      // srcset handled separately below
      tasks.push({ el, attr: 'srcset', ref: el.getAttribute('srcset'), isCSS: false, isSrcset: true });
    });

    const total = tasks.length;
    let loaded = 0;

    // Process CSS in <style> tags
    const styleTags = doc.querySelectorAll('style');
    for (const styleEl of styleTags) {
      if (styleEl.textContent.trim()) {
        styleEl.textContent = await resolveCss(styleEl.textContent, basePath, fileTree, api, owner, repo);
      }
    }

    // Process each resource
    for (const task of tasks) {
      try {
        if (task.isSrcset) {
          // Handle srcset: "img1.png 1x, img2.png 2x"
          const srcsetParts = task.ref.split(',').map(s => s.trim());
          const resolvedParts = [];
          for (const part of srcsetParts) {
            const [ref, ...descriptor] = part.split(/\s+/);
            if (ref && !ref.startsWith('data:') && !ref.startsWith('http://') && !ref.startsWith('https://')) {
              const resolved = resolveUrl(ref, basePath);
              const blobUrl = await fetchAsBlobUrl(resolved, fileTree, api, owner, repo);
              if (blobUrl) {
                resolvedParts.push([blobUrl, ...descriptor].join(' '));
              } else {
                resolvedParts.push(part);
              }
            } else {
              resolvedParts.push(part);
            }
          }
          task.el.setAttribute('srcset', resolvedParts.join(', '));
        } else if (task.isCSS) {
          // CSS: fetch as text, resolve internal url() references, then make blob URL
          const resolved = resolveUrl(task.ref, basePath);
          const cssText = await fetchAsText(resolved, fileTree, api, owner, repo);
          if (cssText) {
            const cssDir = dirName(resolved);
            const resolvedCss = await resolveCss(cssText, cssDir, fileTree, api, owner, repo);
            const blob = new Blob([resolvedCss], { type: 'text/css' });
            task.el.setAttribute(task.attr, URL.createObjectURL(blob));
          }
        } else {
          const resolved = resolveUrl(task.ref, basePath);
          const blobUrl = await fetchAsBlobUrl(resolved, fileTree, api, owner, repo);
          if (blobUrl) {
            task.el.setAttribute(task.attr, blobUrl);
          }
        }
      } catch (e) {
        console.warn(`Failed to resolve resource: ${task.ref}`, e);
      }

      loaded++;
      if (onProgress) onProgress(loaded, total, task.ref);
    }

    // Resolve inline style="...url(...)..." attributes
    const styledEls = doc.querySelectorAll('[style]');
    for (const el of styledEls) {
      const style = el.getAttribute('style');
      if (style && style.includes('url(')) {
        const resolvedStyle = await resolveCssInline(style, basePath, fileTree, api, owner, repo);
        el.setAttribute('style', resolvedStyle);
      }
    }

    // Inject navigation script for iframe link interception
    const navScript = doc.createElement('script');
    navScript.textContent = `
      document.addEventListener('click', function(e) {
        var a = e.target.closest('a[href]');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href || href.startsWith('http://') || href.startsWith('https://') ||
            href.startsWith('mailto:') || href.startsWith('#') || href.startsWith('javascript:')) return;
        e.preventDefault();
        if (parent !== window) {
          parent.postMessage({ type: 'navigate', href: href }, '*');
        }
      });
    `;
    doc.body.appendChild(navScript);

    // Serialize back to HTML string
    return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
  }

  /**
   * Resolve url() in an inline style attribute
   */
  async function resolveCssInline(styleStr, baseDir, fileTree, api, owner, repo) {
    const urlRegex = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
    let match;
    let result = styleStr;

    while ((match = urlRegex.exec(styleStr)) !== null) {
      const ref = match[2];
      if (ref && !ref.startsWith('data:') && !ref.startsWith('blob:') && !ref.startsWith('http://') && !ref.startsWith('https://')) {
        const resolved = resolveUrl(ref, baseDir);
        const blobUrl = await fetchAsBlobUrl(resolved, fileTree, api, owner, repo);
        if (blobUrl) {
          result = result.replace(match[0], `url(${match[1]}${blobUrl}${match[1]})`);
        }
      }
    }

    return result;
  }

  /**
   * Clean up all cached blob URLs
   */
  function cleanup() {
    for (const url of blobUrlCache.values()) {
      URL.revokeObjectURL(url);
    }
    blobUrlCache.clear();
  }

  return {
    resolveHtml,
    resolveCss,
    cleanup,
    normalizePath,
  };
})();
