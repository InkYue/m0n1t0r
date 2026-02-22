# m0n1t0r-ui

Web dashboard for the m0n1t0r server, built with React, TypeScript, Vite, and Ant Design.

## Prerequisites

- [Bun](https://bun.sh/) (or Node.js with npm)

## Development

```bash
bun install
bun run dev
```

The dev server starts on `http://localhost:5173` and proxies `/api` requests to the m0n1t0r server at `http://localhost:10801`.

## Build

```bash
bun run build
```

Static assets are output to `dist/`. In production, these are served by nginx which also reverse-proxies API and WebSocket requests to the server.

## Lint

```bash
bun run lint
```

## Stack

- [React 19](https://react.dev/) + [React Router 7](https://reactrouter.com/)
- [Ant Design 6](https://ant.design/)
- [xterm.js](https://xtermjs.org/) — interactive terminal
- [Axios](https://axios-http.com/) — HTTP client
- [Vite 7](https://vite.dev/) — build tool
- [TypeScript 5.9](https://www.typescriptlang.org/)
