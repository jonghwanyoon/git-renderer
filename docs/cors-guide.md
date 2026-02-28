# CORS Troubleshooting Guide

## What is CORS?

Browsers enforce a security rule called the **Same-Origin Policy**.

Think of it like this:

```
You live in Apartment A (github.io) and want to
pick up a package from Apartment B's mailroom (company GitLab).

→ The security guard (browser) says "Residents from other buildings are not allowed."
→ This is a CORS block.
```

**CORS** (Cross-Origin Resource Sharing) is a browser security policy that restricts fetching data from a **different domain**. Unless the server explicitly allows it, the browser blocks the request.

## Why Does This Happen?

When git-renderer is deployed on GitHub Pages, the situation looks like this:

```
┌─────────────────┐          request          ┌───────────────────────┐
│  GitHub Pages   │  ──────────────────────►  │  Company Intranet     │
│  (Domain A)     │                           │  GitLab (Domain B)    │
│                 │  ◄── Browser blocks! ──   │                       │
└─────────────────┘                           └───────────────────────┘

  git-renderer                                  Requests data from
  runs here                                     GitLab API
```

The browser blocks requests from Domain A (github.io) to Domain B (company GitLab). This happens **even with a valid token** — CORS is a browser security policy independent of authentication.

## How to Identify CORS Errors

When a CORS issue occurs, git-renderer will display a message like:

> **Cannot connect to gitlab.company.com. Requests from a different domain (username.github.io) are blocked by browser security (CORS). Solution: Download the git-renderer.html file and open it locally.**

In the browser developer tools (F12), the console will show:

```
Access to fetch at 'https://gitlab.company.com/...' from origin
'https://username.github.io' has been blocked by CORS policy
```

## Solutions

### Solution 1: Open Locally (Simplest)

Download `git-renderer.html` and open it directly on your computer. No CORS issues.

```
1. Download git-renderer.html
2. Double-click to open in browser
3. Enter your company GitLab URL → It works!
```

**Why does this work?** Requests from a local file (`file:///...`) have no "origin", so the CORS policy does not apply.

**Pros**: Works immediately, no setup needed
**Cons**: Each user must download the file, cannot share links

### Solution 2: Deploy on an Intranet Web Server

Host `git-renderer.html` on your company's intranet web server to avoid CORS issues.

```
┌───────────────────────┐        request        ┌───────────────────────┐
│  Intranet web server  │  ──────────────────►  │  Intranet GitLab      │
│  (intra.company.com)  │                       │  (gitlab.company.com) │
│                       │  ◄── Can be allowed!  │                       │
└───────────────────────┘                       └───────────────────────┘
```

**How**:
1. Ask your IT team to deploy `git-renderer.html` on an intranet web server
2. Or place the file on a simple web server (nginx, Apache, etc.) within your team

**Pros**: All team members can access via a shared link
**Cons**: Requires IT team cooperation, server maintenance

> **Note**: Even on the same intranet, different domains can trigger CORS. Deploying on the same domain as the GitLab server is the most reliable approach.

### Solution 3: Request CORS Configuration from GitLab Admin

The GitLab server can be configured to allow requests from specific domains by adding CORS headers.

**What to request from your GitLab administrator**:

> Please add the following CORS headers to GitLab API responses:
> ```
> Access-Control-Allow-Origin: https://your-github-pages-domain.github.io
> Access-Control-Allow-Headers: Private-Token
> ```

**Pros**: Root cause fix, works directly from GitHub Pages
**Cons**: Requires GitLab admin access, security review needed

## FAQ

### Q: Will adding a token fix CORS?

**No.** CORS is independent of tokens. CORS prevents the browser from sending the request at all, so having a token makes no difference.

### Q: Will a VPN fix CORS?

**No.** A VPN solves network access issues, but CORS is a browser security policy, not a network restriction. Even if you can reach GitLab via VPN, the browser still blocks cross-origin requests.

### Q: Can I use a browser extension to bypass CORS?

There are browser extensions that disable CORS, but they are **not recommended for security reasons.** They disable CORS for all websites, making you vulnerable. Solution 1 (local file) is safer.

### Q: We're on the same network — why is it blocked?

CORS does not care about network location. The browser only checks the **domain (URL)**. `github.io` and `gitlab.company.com` are different domains, so requests are blocked regardless of network proximity.
