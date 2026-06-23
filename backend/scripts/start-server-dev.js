#!/usr/bin/env node
'use strict';

/**
 * Development server startup script.
 * Waits for the database, runs migrations, then starts tsx in watch mode.
 */
const path = require('path');
const { spawn } = require('child_process');
const { PrismaClient } = require('@prisma/client');

const appRoot = path.resolve(__dirname, '..');
const prisma = new PrismaClient();
const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 2000;

function logDatabaseTarget() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('[Backend:dev] ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  try {
    const parsed = new URL(databaseUrl);
    const dbName = parsed.pathname.replace(/^\//, '') || '(unknown)';
    console.log('[Backend:dev] Database target:');
    console.log(`  host: ${parsed.hostname}`);
    console.log(`  port: ${parsed.port || '5432'}`);
    console.log(`  database: ${dbName}`);
    console.log(`  user: ${parsed.username || '(unknown)'}`);
    console.log(`  sslmode: ${parsed.searchParams.get('sslmode') || '(default)'}`);
  } catch (e) {
    console.error('[Backend:dev] ERROR: DATABASE_URL is not a valid URL.');
    console.error('  Message:', e.message);
    process.exit(1);
  }
}

async function waitForDatabase() {
  console.log('[Backend:dev] Waiting for database...');

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      await prisma.$connect();
      await prisma.$disconnect();
      console.log('[Backend:dev] Database connection established.');
      return;
    } catch (e) {
      if (attempt === MAX_RETRIES) {
        console.error('[Backend:dev] ERROR: Failed to connect to database after retries.');
        console.error('  Last error:', e && e.message ? e.message : e);
        process.exit(1);
      }

      console.log(
        `[Backend:dev] Database not ready yet (${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY_MS / 1000}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}

function runCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      stdio: 'inherit',
      env: process.env,
    });

    child.on('error', (e) => {
      reject(e);
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${label} exited with code ${code ?? 'unknown'}`));
    });
  });
}

function runLongLivedCommand(command, args, label) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
      stdio: 'inherit',
      env: process.env,
    });

    const forwardSignal = (signal) => {
      if (!child.killed) {
        child.kill(signal);
      }
    };

    process.once('SIGTERM', forwardSignal);
    process.once('SIGINT', forwardSignal);

    const cleanup = () => {
      process.removeListener('SIGTERM', forwardSignal);
      process.removeListener('SIGINT', forwardSignal);
    };

    child.on('error', (e) => {
      cleanup();
      reject(e);
    });

    child.on('close', (code, signal) => {
      cleanup();
      if (code === 0 || signal) {
        resolve();
        return;
      }

      reject(new Error(`${label} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function runMigrations() {
  console.log('[Backend:dev] Running Prisma migrations...');
  try {
    await runCommand('./node_modules/.bin/prisma', ['migrate', 'deploy'], 'Prisma migrations');
    console.log('[Backend:dev] Prisma migrations finished.');
  } catch (e) {
    console.error('[Backend:dev] ERROR: Prisma migrations failed.');
    console.error('  Message:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

async function generatePrismaClient() {
  console.log('[Backend:dev] Generating Prisma client...');
  try {
    await runCommand('./node_modules/.bin/prisma', ['generate'], 'Prisma generate');
    console.log('[Backend:dev] Prisma client generated.');
  } catch (e) {
    console.error('[Backend:dev] ERROR: Prisma client generation failed.');
    console.error('  Message:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

async function main() {
  logDatabaseTarget();
  await waitForDatabase();
  await runMigrations();
  await generatePrismaClient();

  console.log('[Backend:dev] Starting server via tsx watch...');
  try {
    await runLongLivedCommand('./node_modules/.bin/tsx', ['watch', 'src/server.ts'], 'Server process');
  } catch (e) {
    console.error('[Backend:dev] ERROR: Failed to start server process.');
    console.error('  Message:', e && e.message ? e.message : e);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('[Backend:dev] ERROR: Startup failed.');
  console.error('  Message:', e && e.message ? e.message : e);
  process.exit(1);
});
