FROM node:22-bookworm-slim AS build
WORKDIR /worker
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim AS pot-provider
ARG BGUTIL_COMMIT=7608dd51ee813b48cf9a6d68c6e42cb197ce10e0
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && git clone --filter=blob:none https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /provider \
    && cd /provider \
    && git checkout --detach "${BGUTIL_COMMIT}"
WORKDIR /provider/server
RUN npm ci --no-audit --no-fund \
    && npx tsc \
    && npm prune --omit=dev

FROM golang:1.24.4-alpine3.21 AS warp-builder
ARG WARP_SOURCE_COMMIT=b59fab9526e8a76a12b31b02cfc24fbef603f5cd
RUN apk add --no-cache git \
    && git clone --filter=blob:none https://github.com/shahradelahi/cloudflare-warp.git /src \
    && cd /src \
    && git checkout --detach "${WARP_SOURCE_COMMIT}" \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -buildid=" -o /out/warp .

FROM node:22-bookworm-slim
ARG YTDLP_VERSION=2026.07.04
ARG YTDLP_SHA256=495be29ff4d9d4e9be7eabdfef225221e5d5282e77f2f505abc6dca80349f3fd
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-liberation python3 curl tini && rm -rf /var/lib/apt/lists/* \
    && curl -fsSL "https://github.com/yt-dlp/yt-dlp/releases/download/${YTDLP_VERSION}/yt-dlp" -o /usr/local/bin/yt-dlp \
    && echo "${YTDLP_SHA256}  /usr/local/bin/yt-dlp" | sha256sum -c - \
    && chmod +x /usr/local/bin/yt-dlp
WORKDIR /worker
ENV NODE_ENV=production FFMPEG_PATH=ffmpeg FFPROBE_PATH=ffprobe WORKER_TEMP_ROOT=/tmp/vidrial \
    YTDLP_POT_PROVIDER_URL=http://127.0.0.1:4416 ENABLE_EMBEDDED_WARP=true \
    EMBEDDED_WARP_PROXY_PORT=8080 EMBEDDED_WARP_START_TIMEOUT_SECONDS=60
COPY --from=build /worker/package.json ./
COPY --from=build /worker/node_modules ./node_modules
COPY --from=build /worker/dist ./dist
COPY --from=pot-provider /provider/server /opt/bgutil-ytdlp-pot-provider/server
COPY --from=pot-provider /provider/plugin/yt_dlp_plugins /etc/yt-dlp/plugins/bgutil/yt_dlp_plugins
COPY --from=warp-builder /out/warp /usr/local/bin/warp
COPY warp/THIRD_PARTY_NOTICES.md /usr/share/licenses/vidrial-warp/THIRD_PARTY_NOTICES.md
COPY start.sh /usr/local/bin/vidrial-worker-start
RUN chmod 0755 /usr/local/bin/vidrial-worker-start
USER node
EXPOSE 8080
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["/usr/local/bin/vidrial-worker-start"]
