/**
 * Git URL Parser - GitLab/GitHub auto-detection based on hostname
 *
 * Supported URL formats:
 *   GitLab: https://gitlab.company.com/group/project/-/tree/main/docs
 *   GitLab: https://gitlab.company.com/group/subgroup/project/-/tree/main
 *   GitLab: https://gitlab.company.com/group/project (root)
 *   GitHub: https://github.com/user/repo/tree/main/docs
 *   GitHub: https://github.com/user/repo (root)
 */

function parseGitUrl(url) {
  url = url.trim();
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    throw new Error('올바른 Git 저장소 URL을 입력하세요');
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('올바른 Git 저장소 URL을 입력하세요');
  }

  const origin = parsed.origin;
  const hostname = parsed.hostname;
  const provider = hostname.includes('github.com') ? 'github' : 'gitlab';
  const pathParts = parsed.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);

  if (pathParts.length < 2) {
    throw new Error('올바른 Git 저장소 URL을 입력하세요');
  }

  if (provider === 'github') {
    return parseGitHubUrl(origin, pathParts);
  }
  return parseGitLabUrl(origin, pathParts);
}

function parseGitHubUrl(origin, parts) {
  // Format: /owner/repo[/tree/branch/path...]
  const owner = parts[0];
  const repo = parts[1];
  let branch = null;
  let path = '';

  if (parts.length > 3 && parts[2] === 'tree') {
    branch = parts[3];
    path = parts.slice(4).join('/');
  } else if (parts.length > 3 && parts[2] === 'blob') {
    branch = parts[3];
    path = parts.slice(4).join('/');
  }

  return { provider: 'github', origin, owner, repo, branch, path };
}

function parseGitLabUrl(origin, parts) {
  // GitLab URLs can have nested groups: /group/subgroup/.../project[/-/tree/branch/path]
  const treeIdx = parts.indexOf('-');

  if (treeIdx >= 2) {
    // Has /-/tree/branch/path or /-/blob/branch/path
    const owner = parts.slice(0, treeIdx - 1).join('/');
    const repo = parts[treeIdx - 1];
    let branch = null;
    let path = '';

    if (parts.length > treeIdx + 2 && (parts[treeIdx + 1] === 'tree' || parts[treeIdx + 1] === 'blob')) {
      branch = parts[treeIdx + 2];
      path = parts.slice(treeIdx + 3).join('/');
    }

    return { provider: 'gitlab', origin, owner, repo, branch, path };
  }

  // No /-/ marker: /group[/subgroup...]/project
  const owner = parts.slice(0, -1).join('/');
  const repo = parts[parts.length - 1];

  return { provider: 'gitlab', origin, owner, repo, branch: null, path: '' };
}
