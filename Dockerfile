# JIRAN: API + web app in one container.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Install workspace dependencies first so Docker can cache this layer.
COPY package.json package-lock.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci --include=dev

# Build the web app into apps/web/dist; the server serves it.
COPY . .
RUN npm run build

ENV PORT=8787 \
    JIRAN_DB=/data/jiran.sqlite
EXPOSE 8787
CMD ["npm", "start", "-w", "@jiran/server"]
