#!/bin/sh
set -e

echo "========================================="
echo " PastelPulse Server Starting Up"
echo "========================================="

echo "Waiting for PostgreSQL database to be reachable..."
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function check() {
  for (let i = 0; i < 30; i++) {
    try {
      await prisma.\$queryRaw\`SELECT 1\`;
      console.log('✓ Database connection confirmed.');
      process.exit(0);
    } catch (e) {
      console.log('Waiting for database (attempt ' + (i + 1) + '/30)...');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.error('Database connection timed out.');
  process.exit(1);
}
check();
"

echo "Applying Prisma database migrations/schema..."
npx prisma db push --skip-generate

echo "Executing deterministic seed data..."
npx tsx prisma/seed.ts

echo "Starting PastelPulse backend API..."
exec node dist/index.js
