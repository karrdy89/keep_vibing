# keep_vibing

로컬 PC에서 웹 서버를 띄워 브라우저로 Claude Code 개발환경에 접속하는 서비스

## Screenshot

![keep_vibing](docs/screenshot.png)

## Tech Stack

| Layer | Stack |
|-------|-------|
| Backend | FastAPI, WebSocket, Python 3.13 |
| Frontend | React, Vite, Monaco Editor, xterm.js |
| Auth | JWT (bcrypt + PyJWT) |
| Package | uv (Backend), npm (Frontend) |

## Features

- **JWT 로그인** - 로컬 PC 제어 권한 보호를 위한 인증
- **프로젝트 관리** - 디렉터리 기반 프로젝트 추가/삭제
- **파일 탐색기** - 트리 뷰, 파일/폴더 생성·삭제·이름변경, 컨텍스트 메뉴
- **코드 에디터** - Monaco Editor 기반, 탭 관리, 구문 강조, Markdown/이미지 뷰어
- **Claude Code 터미널** - claude CLI를 subprocess로 실행, stdin/stdout을 WebSocket으로 연결
- **테마 설정** - 다크/라이트 등 테마 전환

## Getting Started

### Prerequisites

- Python 3.13+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)

### Installation

```bash
# 저장소 클론
git clone https://github.com/karrdy89/keep_vibing.git
cd keep_vibing

# Backend 의존성 설치 (FastAPI, uvicorn, PyJWT, bcrypt 등)
uv sync

# Frontend 의존성 설치 (React, Monaco Editor, xterm.js, marked 등)
cd frontend && npm install
```

### Run

```bash
uv run python start.py
```

Backend(`:8000`)과 Frontend(`:11000`)가 동시에 실행됩니다.
브라우저에서 `http://localhost:11000`으로 접속하세요.

기본 계정: `admin` / `admin`

## Project Structure

```
keep_vibing/
├── backend/
│   ├── app.py               # FastAPI 앱 진입점
│   ├── api.py               # REST API 라우터
│   ├── ws.py                # WebSocket 라우터
│   ├── auth.py              # JWT 인증
│   ├── session_manager.py   # Claude CLI 세션 관리
│   ├── store.py             # 프로젝트/설정 영속 저장
│   └── tests/               # 백엔드 테스트
├── frontend/
│   ├── src/
│   │   ├── App.tsx           # 메인 레이아웃
│   │   ├── api.ts            # API 클라이언트
│   │   ├── Terminal.tsx      # xterm.js 터미널
│   │   ├── themes.ts         # 테마 정의
│   │   └── components/       # UI 컴포넌트
│   └── vite.config.ts
├── start.py                  # 개발 서버 실행 스크립트
└── pyproject.toml
```
