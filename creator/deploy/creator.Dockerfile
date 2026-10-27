FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY index.html tsconfig.json vite.config.ts ./
COPY src ./src
COPY server ./server
COPY render ./render
COPY supabase/functions ./supabase/functions
COPY public ./public
COPY deploy/build-server.mjs ./deploy/build-server.mjs
ARG VITE_SUPABASE_URL=https://meihyxdibqbqggogseon.supabase.co
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_EDIT_STUDIO=true
ENV VITE_EDIT_STUDIO=$VITE_EDIT_STUDIO
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
RUN pnpm exec vite build && node deploy/build-server.mjs

FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates chromium chromium-sandbox python3 python3-venv && rm -rf /var/lib/apt/lists/*
RUN python3 -m venv /opt/thumbnail-python && /opt/thumbnail-python/bin/pip install --no-cache-dir numpy==2.2.6 Pillow==11.3.0 onnxruntime==1.22.1
COPY deploy/thumbnail-model.py /tmp/thumbnail-model.py
RUN python3 /tmp/thumbnail-model.py
COPY deploy/matte-model.py /tmp/matte-model.py
RUN python3 /tmp/matte-model.py
WORKDIR /app
COPY --chown=node:node licenses ./licenses
COPY --chown=node:node server/avatar-thumbnail.py ./server/avatar-thumbnail.py
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/hosted.mjs ./hosted.mjs
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/render ./render
COPY --from=build --chown=node:node /app/src/components/EditComposition.tsx ./src/components/EditComposition.tsx
COPY --from=build --chown=node:node /app/src/components/RichEditComposition.tsx ./src/components/RichEditComposition.tsx
COPY --from=build --chown=node:node /app/src/domain ./src/domain
RUN mkdir /data && chown node:node /data
USER node
ENV NODE_ENV=production PORT=8080 CREATOR_MEDIA_BIN=/usr/bin CREATOR_DATA_DIR=/data
ENV CREATOR_CHROMIUM_PATH=/usr/bin/chromium
ENV CREATOR_PYTHON=/opt/thumbnail-python/bin/python CREATOR_PERSON_MODEL=/opt/creator-models/u2net_human_seg.onnx
ENV CREATOR_MATTE_MODEL=/opt/creator-models/modnet.onnx
EXPOSE 8080
CMD ["node","hosted.mjs"]
