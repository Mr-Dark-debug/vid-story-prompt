FROM node:22-bookworm-slim AS build
WORKDIR /worker
COPY package.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates fonts-liberation && rm -rf /var/lib/apt/lists/*
WORKDIR /worker
ENV NODE_ENV=production FFMPEG_PATH=ffmpeg FFPROBE_PATH=ffprobe WORKER_TEMP_ROOT=/tmp/vidrial
COPY --from=build /worker/package.json ./
COPY --from=build /worker/node_modules ./node_modules
COPY --from=build /worker/dist ./dist
USER node
EXPOSE 8080
CMD ["node", "dist/index.js"]
