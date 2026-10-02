FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY server ./server
COPY supabase/functions ./supabase/functions
COPY public ./public
COPY deploy/build-server.mjs ./deploy/build-server.mjs
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN pnpm exec vite build && node deploy/build-server.mjs

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/hosted.mjs ./hosted.mjs
COPY --from=build --chown=node:node /app/node_modules ./node_modules
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=8080 CREATOR_MEDIA_BIN=/usr/bin CREATOR_DATA_DIR=/data
EXPOSE 8080
CMD ["node","hosted.mjs"]
