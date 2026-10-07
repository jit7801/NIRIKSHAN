#!/usr/bin/env node

/**
 * Unified Development Launcher for MPLADS Platform
 * Concurrently starts:
 * 1. FastAPI Python Analytical Engine (Port 8001)
 * 2. Vite React Frontend (Port 5173 with /api reverse-proxy to backend)
 */

import { spawn } from 'child_process';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.resolve(rootDir, 'backend');

// Colors for terminal output
const RESET = '\x1b[0m';
const CYAN = '\x1b[36m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const BOLD = '\x1b[1m';

function log(prefix, color, message) {
  const lines = message.toString().trim().split('\n');
  for (const line of lines) {
    if (line.trim()) {
      console.log(`${color}[${prefix}]${RESET} ${line}`);
    }
  }
}

function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port: port,
      path: '/api/v1/health',
      timeout: 800
    }, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function main() {
  console.log(`\n${BOLD}${CYAN}=== Starting MPLADS Risk Intelligence Platform ===${RESET}\n`);
  
  const processes = [];

  const cleanup = () => {
    console.log(`\n${YELLOW}Shutting down servers gracefully...${RESET}`);
    for (const proc of processes) {
      try {
        if (!proc.killed) {
          proc.kill('SIGTERM');
        }
      } catch (e) {
        // ignore
      }
    }
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // 1. Check if backend is already running
  const backendAlreadyRunning = await checkPort(8001);

  if (backendAlreadyRunning) {
    console.log(`${GREEN}[Backend]${RESET} Fast-API analytical engine already active on http://127.0.0.1:8001`);
  } else {
    console.log(`${CYAN}[Backend]${RESET} Launching FastAPI backend (port 8001)...`);
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    const backendProc = spawn(pythonCmd, ['-m', 'uvicorn', 'main:app', '--host', '0.0.0.0', '--port', '8001', '--reload'], {
      cwd: backendDir,
      env: { ...process.env, PYTHONUNBUFFERED: '1' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    backendProc.stdout.on('data', (d) => log('Backend', CYAN, d));
    backendProc.stderr.on('data', (d) => log('Backend', YELLOW, d));
    backendProc.on('error', (err) => {
      console.error(`${RED}[Backend Error]${RESET} Failed to start Python server: ${err.message}`);
    });

    processes.push(backendProc);
  }

  // 2. Launch frontend Vite server
  console.log(`${GREEN}[Frontend]${RESET} Launching Vite dev server (port 5173)...`);
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const frontendProc = spawn(npmCmd, ['--prefix', 'frontend', 'run', 'dev'], {
    cwd: rootDir,
    stdio: ['inherit', 'pipe', 'pipe']
  });

  frontendProc.stdout.on('data', (d) => log('Frontend', GREEN, d));
  frontendProc.stderr.on('data', (d) => log('Frontend', RED, d));
  frontendProc.on('error', (err) => {
    console.error(`${RED}[Frontend Error]${RESET} Failed to start Vite: ${err.message}`);
  });

  processes.push(frontendProc);
}

main().catch(err => {
  console.error(`${RED}Startup failed:${RESET}`, err);
  process.exit(1);
});
