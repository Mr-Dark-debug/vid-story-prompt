FROM golang:1.24.4-alpine3.21 AS builder

ARG WARP_SOURCE_COMMIT=b59fab9526e8a76a12b31b02cfc24fbef603f5cd
RUN apk add --no-cache git \
    && git clone --filter=blob:none https://github.com/shahradelahi/cloudflare-warp.git /src \
    && cd /src \
    && git checkout --detach "$WARP_SOURCE_COMMIT" \
    && CGO_ENABLED=0 go build -trimpath -ldflags="-s -w -buildid=" -o /out/warp .

FROM alpine:3.20

RUN apk add --no-cache ca-certificates curl socat tini

COPY --from=builder /out/warp /usr/local/bin/warp
COPY THIRD_PARTY_NOTICES.md /usr/share/licenses/vidrial-warp/THIRD_PARTY_NOTICES.md
COPY entrypoint.sh healthcheck.sh health-response.sh /usr/local/bin/
RUN chmod 0755 /usr/local/bin/entrypoint.sh /usr/local/bin/healthcheck.sh /usr/local/bin/health-response.sh \
    && mkdir -p /var/lib/cloudflare-warp

ENV HTTP_PROXY_PORT=8080 \
    PORT=8081 \
    WARP_START_TIMEOUT_SECONDS=45

EXPOSE 8080 8081
VOLUME ["/var/lib/cloudflare-warp"]
HEALTHCHECK --interval=30s --timeout=7s --start-period=45s --retries=3 \
  CMD ["/usr/local/bin/healthcheck.sh"]

ENTRYPOINT ["/usr/bin/tini", "--", "/usr/local/bin/entrypoint.sh"]
