import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import { Copyparty } from '../server/copyparty.js';

// Opt-in against the actual server implementation, not a mocked search parser.
test(
  'real Copyparty: navigation, auth, recursive boundaries and literal special characters',
  { skip: !process.env.COPYPARTY_SOURCE, timeout: 60_000 },
  async () => {
    const fixture = await mkdtemp(join(tmpdir(), 'partyfinder-integration-'));
    const socket = createServer();
    await new Promise<void>((resolve) => socket.listen(0, '127.0.0.1', resolve));
    const port = (socket.address() as { port: number }).port;
    await new Promise<void>((resolve) => socket.close(() => resolve()));
    const filenames = [
      'movies/xyz.txt',
      'movies/action/xyz report.txt',
      'movies-old/xyz.txt',
      'movies/xyz folder/note.txt',
      'movies/100%_done.txt',
      'movies/100XXdone.txt',
      'movies/with "quotes".txt',
      'movies/literal*star.txt',
      'movies/back\\slash.txt',
      'movies/backslash-end\\',
      'movies/hash # and ?.txt',
      'movies/foo bar.txt',
      'movies/foo gap bar.txt',
      'wild_%/xyz.txt',
      'wildXX/xyz.txt',
    ];
    for (const filename of filenames) {
      await mkdir(join(fixture, 'media', filename, '..'), { recursive: true });
      await writeFile(join(fixture, 'media', filename), 'fixture content\n');
    }
    await mkdir(join(fixture, 'media/movies/empty'), { recursive: true });
    const child = spawn(
      process.env.COPYPARTY_PYTHON || 'python3',
      [
        '-m',
        'copyparty',
        '-i',
        '127.0.0.1',
        '-p',
        String(port),
        '-v',
        `${join(fixture, 'media')}:/media:r`,
        '-a',
        'tester:fixture-password',
        '-e2dsa',
        '--no-crt',
        '--no-ansi',
        '--no-voldump',
        '--no-bauth',
      ],
      {
        cwd: fixture,
        env: { ...process.env, PYTHONPATH: process.env.COPYPARTY_SOURCE },
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    let logs = '';
    child.stdout.on('data', (chunk) => {
      logs = (logs + chunk).slice(-12000);
    });
    child.stderr.on('data', (chunk) => {
      logs = (logs + chunk).slice(-12000);
    });
    const client = new Copyparty(`http://127.0.0.1:${port}/`);
    try {
      let ready = false;
      for (let n = 0; n < 80; n++) {
        if (child.exitCode !== null) throw new Error('Copyparty exited: ' + logs);
        try {
          const result = await client.search('/media/movies', 'xyz', true, 250, 'fixture-password');
          if (result.entries.length === 2) {
            ready = true;
            break;
          }
        } catch {
          /* wait for listener/index startup */
        }
        await delay(250);
      }
      assert.equal(ready, true, logs);
      const root = await client.list('/', 'fixture-password');
      assert.equal(root.account, 'tester');
      assert.equal(root.entries[0].path, '/media');
      const listing = await client.list('/media/movies', 'fixture-password');
      assert.ok(listing.entries.some((e) => e.name === 'empty' && e.kind === 'directory'));
      assert.ok(listing.entries.some((e) => e.name === 'hash # and ?.txt'));
      const direct = await client.search('/media/movies', 'xyz', false, 250, 'fixture-password');
      assert.deepEqual(direct.entries.map((e) => e.name).sort(), ['xyz folder', 'xyz.txt']);
      const recursive = await client.search('/media/movies', 'xyz', true, 250, 'fixture-password');
      assert.deepEqual(recursive.entries.map((e) => e.path).sort(), [
        '/media/movies/action/xyz report.txt',
        '/media/movies/xyz.txt',
      ]);
      for (const [phrase, expected] of [
        ['%_', '100%_done.txt'],
        ['"quotes"', 'with "quotes".txt'],
        ['*', 'literal*star.txt'],
        ['\\slash', 'back\\slash.txt'],
        ['end\\', 'backslash-end\\'],
        ['foo bar', 'foo bar.txt'],
      ] as const) {
        const result = await client.search('/media/movies', phrase, true, 250, 'fixture-password');
        assert.deepEqual(
          result.entries.map((e) => e.name),
          [expected],
          `literal phrase: ${phrase}`,
        );
      }
      const specialPath = await client.search(
        '/media/wild_%',
        'xyz',
        true,
        250,
        'fixture-password',
      );
      assert.deepEqual(
        specialPath.entries.map((e) => e.path),
        ['/media/wild_%/xyz.txt'],
      );
    } finally {
      child.kill('SIGTERM');
      await new Promise<void>((resolve) => {
        if (child.exitCode !== null) resolve();
        else child.once('exit', () => resolve());
      });
      await rm(fixture, { recursive: true, force: true });
    }
  },
);
