# Production deployment

Production runs on one Japanese VPS (Tokyo, `216.23.82.211`):

- Web, API, authentication, PostgreSQL, quota, and sync;
- browser-direct realtime STT through iFlytek;
- LLM proxy.

Clients talk to a single API origin (`https://kibotalk.superpowerlulu.win`).
Session start uses the current origin; there is no node picker.

Pushes to `main` and manual workflow dispatches run
`.github/workflows/deploy-production.yml`. The workflow validates the Tokyo
provider configuration, runs typecheck and tests, uploads the API and bundled
on-device models, activates the release, and verifies the public endpoints.

## Environment

The server keeps its environment at `/opt/kibotalk/.env`. iFlytek realtime STT
uses:

```dotenv
STT_ACTIVE=iflytek-realtime
STT_IFLYTEK_WS_URL=wss://office-api-ast-dx.iflyaisol.com/ast/communicate/v1
```

The app id, API key, and signing secret are stored as GitHub Actions secrets
`STT_IFLYTEK_APP_ID`, `STT_IFLYTEK_API_KEY`, and `STT_IFLYTEK_API_SECRET`.
The browser requests a signed URL from the API, then sends PCM directly to
iFlytek; the Japanese server never carries STT audio.

LLM and DashScope WebSocket traffic use the same origin: cookie or desktop
Bearer for HTTP, and `POST /api/auth/ws-ticket` for DashScope WS.

## Verification

The workflow verifies:

```bash
curl --fail https://kibotalk.superpowerlulu.win/health
curl --fail https://kibotalk.superpowerlulu.win/models/onnx-community/wespeaker-voxceleb-resnet34-LM/config.json
```

It also checks the model binary before reporting success. The landing page is
not deployed to production.

The models directory is swapped as a whole (`mv`), so every release recreates
the Caddy container afterwards to re-establish the `/srv/models` bind mount.
