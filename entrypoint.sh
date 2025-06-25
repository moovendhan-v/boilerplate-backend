#!/bin/bash

echo "🧠 Running Prisma setup..."
npx prisma generate
npx prisma db push
node prisma/seed.mjs

echo "🚀 Starting the server..."
npm run dev
