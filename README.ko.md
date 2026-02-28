# Git Renderer

한국어 | [English](README.md)

호스팅되지 않은 정적 웹페이지를 브라우저에서 바로 볼 수 있게 하고, 링크만으로 공유할 수 있게 해주는 프로젝트입니다.

Git 저장소의 웹 콘텐츠를 브라우저에서 바로 렌더링합니다 — 서버 불필요.

GitHub 또는 GitLab 저장소의 HTML/CSS/JS/이미지를 Git API로 가져와서, 모든 리소스 참조를 blob URL로 변환한 뒤 iframe에 렌더링하는 단일 HTML 파일입니다.

## 빠른 시작

1. `dist/git-renderer.html` **다운로드**
2. 브라우저에서 **열기**
3. Git 저장소 URL을 입력하고 **Render** 클릭

또는 해시 URL로 즉시 렌더링:

```
git-renderer.html#https://github.com/user/repo/tree/main/docs
```

## GitHub Pages 배포

1. `git-renderer.html`을 GitHub 저장소에 push
2. GitHub Pages 활성화 (Settings → Pages → Source: `main`)
3. 링크 공유:

```
https://username.github.io/repo/dist/git-renderer.html#https://github.com/target-user/target-repo
```

링크를 클릭하면 누구든 즉시 렌더링된 콘텐츠를 볼 수 있습니다. 백엔드 불필요.

## 지원 URL 형식

```
# GitHub
https://github.com/user/repo
https://github.com/user/repo/tree/main/docs

# GitLab
https://gitlab.example.com/group/project
https://gitlab.example.com/group/project/-/tree/main/docs
```

## 지원 콘텐츠

| 유형 | 지원 여부 |
|------|-----------|
| 정적 HTML/CSS/JS 사이트 | O |
| Hexo, Hugo (빌드된 결과물이 레포에 있는 경우) | O |
| 이미지, 폰트, 미디어 | O |
| 사이트 내 네비게이션 (페이지 간 링크 이동) | O |
| Jekyll/Hugo 소스 (빌드 필요) | X |

## 비공개 저장소

**Token** 버튼을 클릭하고 도메인별 API 토큰을 저장하세요:

- **GitHub**: Personal Access Token (`ghp_xxxx`)
- **GitLab**: Personal Access Token (`glpat-xxxx`)

토큰은 `localStorage`에 저장되며, 해당 Git API에만 전송됩니다. 어떤 데이터도 제3자에게 전송되지 않습니다.

## 사내 / 인트라넷 GitLab

git-renderer를 GitLab과 다른 도메인(예: GitHub Pages)에서 호스팅하면, 브라우저의 **CORS**(Cross-Origin Resource Sharing) 정책에 의해 API 요청이 차단됩니다.

**가장 간단한 해결법**: `git-renderer.html` 파일을 다운로드하여 로컬에서 열기(`file:///...`). 로컬 파일은 CORS 제한을 받지 않습니다.

자세한 내용과 다른 해결 방법은 [CORS 문제 해결 가이드](docs/cors-guide.ko.md)를 참고하세요.

## 동작 원리

1. Git URL을 파싱하여 provider, owner, repo, branch, path 추출
2. Git API로 파일 트리 조회
3. 엔트리 HTML 파일 탐색 (`index.html` 또는 첫 `.html` 파일)
4. HTML 콘텐츠를 가져와서 `DOMParser`로 파싱
5. 모든 리소스 참조 수집 (`<link>`, `<script>`, `<img>`, CSS `url()`, `@import`, 인라인 스타일 등)
6. Git API로 각 리소스 fetch → `Blob` 생성 → `URL.createObjectURL()`
7. CSS `url()` 및 `@import` 참조를 재귀적으로 해석
8. 원본 참조를 blob URL로 교체
9. iframe 내 링크 네비게이션을 위한 스크립트 주입
10. 최종 HTML을 blob URL로 만들어 `iframe.src`에 설정

## 보안

- **외부 의존성 제로**: CDN, 애널리틱스, 트래킹, 서드파티 스크립트 없음
- **토큰 격리**: API 토큰은 해당 Git 제공자 도메인에만 전송
- **iframe 샌드박싱**: 렌더링된 콘텐츠는 샌드박스된 iframe에서 실행
- **postMessage 검증**: 네비게이션 메시지는 프리뷰 iframe에서 온 것만 수락 (`e.source` 검증)
- **100% 클라이언트 사이드**: 모든 처리가 브라우저에서 수행됨. Git API 호출 외에 어떤 데이터도 외부로 나가지 않음.

## 빌드

```bash
bash build.sh
# → dist/git-renderer.html (단일 파일, ~36KB)
```

빌드 스크립트가 모든 CSS와 JS를 하나의 자체 완결적 HTML 파일로 인라인합니다.

## 개발

```
├── index.html              # 개발용 진입점 (별도 JS 파일 로드)
├── css/style.css           # 스타일
├── js/
│   ├── mime-types.js       # MIME 타입 매핑
│   ├── url-parser.js       # Git URL 파서 (GitHub/GitLab)
│   ├── git-api.js          # 통합 Git API 클라이언트
│   ├── resource-resolver.js # HTML/CSS 리소스 → blob URL 변환기
│   └── app.js              # 앱 오케스트레이터
├── build.sh                # 단일 파일 빌드 스크립트
└── dist/
    └── git-renderer.html   # 빌드 결과물 (이 파일을 배포)
```

## 라이선스

MIT
