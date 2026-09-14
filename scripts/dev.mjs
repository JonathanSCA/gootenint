import { spawn, execFileSync } from 'node:child_process';

const frontendCommand = process.env.FRONTEND_PORT === '80'
  ? 'npm run dev:public'
  : 'npm run dev';

const commands = [
  { name: 'api', command: 'npm run server', env: { PORT: process.env.API_PORT || '3001' } },
  { name: 'vite', command: frontendCommand }
];

let shuttingDown = false;

const children = commands.map(({ name, command, env }) => {
  const child = spawnCommand(command, {
    stdio: 'pipe',
    env: {
      ...process.env,
      ...env
    }
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    console.error(`[${name}] exited with ${signal || code}`);
    shutdown(code || 1);
  });

  return child;
});

function shutdown(code = 0) {
  shuttingDown = true;
  for (const child of children) {
    stopProcessTree(child);
  }
  process.exit(code);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

function spawnCommand(command, options) {
  if (process.platform === 'win32') {
    return spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command], options);
  }

  return spawn('sh', ['-c', command], options);
}

function stopProcessTree(child) {
  if (child.killed) return;

  if (process.platform === 'win32') {
    try {
      execFileSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
      return;
    } catch {
      // Fall back to the normal signal path below.
    }
  }

  child.kill();
}
