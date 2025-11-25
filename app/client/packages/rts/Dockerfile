# syntax=docker/dockerfile:1
FROM node:20-alpine

WORKDIR /opt/appsmith/rts

# Copy the pre-built RTS bundle (run ./build.sh beforehand)
COPY dist ./dist

ENV NODE_ENV=production \
    RTS_PORT=8091

EXPOSE 8091

CMD ["node", "dist/bundle/server.js"]
