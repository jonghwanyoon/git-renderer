/**
 * Unified Git API client for GitLab and GitHub
 */
class GitAPI {
  constructor(provider, origin, token) {
    this.provider = provider;
    this.origin = origin;
    this.token = token;
    this._projectId = null; // GitLab project ID cache
    this._rateLimitRemaining = null;
    this._rateLimitReset = null;
  }

  _headers() {
    const h = {};
    if (this.token) {
      if (this.provider === 'github') {
        h['Authorization'] = `Bearer ${this.token}`;
      } else {
        h['Private-Token'] = this.token;
      }
    }
    return h;
  }

  async _fetch(url) {
    let resp;
    try {
      resp = await fetch(url, { headers: this._headers() });
    } catch (e) {
      // CORS or network error — fetch throws TypeError on CORS failure
      const targetHost = new URL(url).hostname;
      const currentHost = location.hostname;
      if (currentHost && currentHost !== targetHost) {
        throw new ApiError(
          `${targetHost}에 연결할 수 없습니다. ` +
          `다른 도메인(${currentHost})에서 요청하면 브라우저 보안(CORS)에 의해 차단됩니다. ` +
          `해결: git-renderer.html 파일을 다운로드하여 로컬에서 열어보세요.`,
          0
        );
      }
      throw new ApiError(`${targetHost}에 연결할 수 없습니다. 네트워크를 확인하세요.`, 0);
    }

    // Track rate limit info
    if (resp.headers.has('x-ratelimit-remaining')) {
      this._rateLimitRemaining = parseInt(resp.headers.get('x-ratelimit-remaining'), 10);
    }
    if (resp.headers.has('x-ratelimit-reset')) {
      this._rateLimitReset = parseInt(resp.headers.get('x-ratelimit-reset'), 10);
    }

    if (!resp.ok) {
      if (resp.status === 401 || resp.status === 403) {
        throw new ApiError(`토큰이 필요합니다. 설정에서 ${new URL(url).hostname}의 토큰을 입력하세요`, resp.status);
      }
      if (resp.status === 404) {
        throw new ApiError('저장소를 찾을 수 없습니다', resp.status);
      }
      if (resp.status === 429) {
        const resetTime = this._rateLimitReset
          ? new Date(this._rateLimitReset * 1000).toLocaleTimeString()
          : '잠시';
        throw new ApiError(`API 요청 제한 도달. ${resetTime} 후 재시도`, resp.status);
      }
      throw new ApiError(`API 오류: ${resp.status} ${resp.statusText}`, resp.status);
    }

    return resp;
  }

  // ── GitLab helpers ──

  async _getGitLabProjectId(owner, repo) {
    if (this._projectId) return this._projectId;
    const encodedPath = encodeURIComponent(`${owner}/${repo}`);
    const resp = await this._fetch(`${this.origin}/api/v4/projects/${encodedPath}`);
    const data = await resp.json();
    this._projectId = data.id;
    return data.id;
  }

  async _getGitLabTree(owner, repo, branch) {
    const projectId = await this._getGitLabProjectId(owner, repo);
    const items = [];
    let page = 1;

    while (true) {
      const url = `${this.origin}/api/v4/projects/${projectId}/repository/tree?recursive=true&ref=${encodeURIComponent(branch)}&per_page=100&page=${page}`;
      const resp = await this._fetch(url);
      const data = await resp.json();
      if (data.length === 0) break;

      for (const item of data) {
        items.push({
          path: item.path,
          sha: item.id,
          type: item.type === 'tree' ? 'tree' : 'blob',
        });
      }

      // Check pagination
      const nextPage = resp.headers.get('x-next-page');
      if (!nextPage || nextPage === '') break;
      page = parseInt(nextPage, 10);
    }

    return items;
  }

  async _getGitLabBlob(owner, repo, sha) {
    const projectId = await this._getGitLabProjectId(owner, repo);
    const url = `${this.origin}/api/v4/projects/${projectId}/repository/blobs/${sha}/raw`;
    const resp = await this._fetch(url);
    const buffer = await resp.arrayBuffer();
    return { raw: buffer };
  }

  // ── GitHub helpers ──

  async _getGitHubTree(owner, repo, branch) {
    const url = `${this.origin.replace('github.com', 'api.github.com')}/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
    const resp = await this._fetch(url);
    const data = await resp.json();

    if (data.truncated) {
      console.warn('GitHub tree response was truncated — some files may be missing');
    }

    return (data.tree || []).map(item => ({
      path: item.path,
      sha: item.sha,
      type: item.type === 'tree' ? 'tree' : 'blob',
      size: item.size,
    }));
  }

  async _getGitHubBlob(owner, repo, sha) {
    const url = `${this.origin.replace('github.com', 'api.github.com')}/repos/${owner}/${repo}/git/blobs/${sha}`;
    const resp = await this._fetch(url);
    const data = await resp.json();
    // GitHub returns base64-encoded content
    return { content: data.content, encoding: data.encoding };
  }

  // ── Public interface ──

  async getDefaultBranch(owner, repo) {
    if (this.provider === 'gitlab') {
      const projectId = await this._getGitLabProjectId(owner, repo);
      const resp = await this._fetch(`${this.origin}/api/v4/projects/${projectId}`);
      const data = await resp.json();
      return data.default_branch;
    }

    // GitHub
    const apiOrigin = this.origin.replace('github.com', 'api.github.com');
    const resp = await this._fetch(`${apiOrigin}/repos/${owner}/${repo}`);
    const data = await resp.json();
    return data.default_branch;
  }

  async getTree(owner, repo, branch) {
    if (this.provider === 'gitlab') {
      return this._getGitLabTree(owner, repo, branch);
    }
    return this._getGitHubTree(owner, repo, branch);
  }

  async getBlob(owner, repo, sha) {
    if (this.provider === 'gitlab') {
      return this._getGitLabBlob(owner, repo, sha);
    }
    return this._getGitHubBlob(owner, repo, sha);
  }

  getRateLimitInfo() {
    return {
      remaining: this._rateLimitRemaining,
      resetAt: this._rateLimitReset ? new Date(this._rateLimitReset * 1000) : null,
    };
  }
}

class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
