#!/bin/sh

mkdir -p /app/data/upload
npx prisma migrate deploy
node /app/.output/server/index.mjs