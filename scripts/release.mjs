import { appendFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import semanticRelease from 'semantic-release';

// Tags stay on the tested commit (no generated version-bump commits). This also
// allows a failed Docker push to be retried after semantic-release created a tag.
const result = await semanticRelease();
const version = result
  ? result.nextRelease.version
  : execFileSync('git', ['tag', '--points-at', 'HEAD', '--sort=-version:refname'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n')
      .find((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
      ?.slice(1);
if (process.env.GITHUB_OUTPUT) {
  await appendFile(
    process.env.GITHUB_OUTPUT,
    `released=${Boolean(version)}\n${version ? `version=${version}\n` : ''}`,
  );
}
