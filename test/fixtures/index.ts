import * as fs from 'fs';
import { ICompilerResult, LLParse } from 'llparse';
import { Dot } from 'llparse-dot';
import {
  Fixture, FixtureResult, IFixtureBuildOptions,
} from 'llparse-test-fixture';
import * as path from 'path';

import * as llhttp from '../../src/llhttp';

export type TestType = 'request' | 'response' | 'none' | 'url';

export { FixtureResult };

const BUILD_DIR = path.join(__dirname, '..', 'tmp');
const CHEADERS_FILE = path.join(BUILD_DIR, 'cheaders.h');

const cheaders = new llhttp.CHeaders().build();
try {
  fs.mkdirSync(BUILD_DIR);
} catch (e) {
  // no-op
}
fs.writeFileSync(CHEADERS_FILE, cheaders);

const fixtures = new Fixture({
  buildDir: path.join(__dirname, '..', 'tmp'),
  extra: [
    '-DLLHTTP__TEST',
    '-DLLPARSE__ERROR_PAUSE=' + llhttp.constants.ERROR.PAUSED,
    '-include', CHEADERS_FILE,
    path.join(__dirname, 'extra.c'),
  ],
  maxParallel: process.env.LLPARSE_DEBUG ? 1 : undefined,
});

const cache: Map<any, ICompilerResult> = new Map();

export function build(llparse: LLParse, node: any, outFile: string,
                      options: IFixtureBuildOptions = {},
                      ty: TestType = 'none'): FixtureResult {
  const dot = new Dot();
  fs.writeFileSync(path.join(BUILD_DIR, outFile + '.dot'),
    dot.build(node));

  let artifacts: ICompilerResult;
  if (cache.has(node)) {
    artifacts = cache.get(node)!;
  } else {
    artifacts = llparse.build(node, {
      c: { header: outFile },
      debug: process.env.LLPARSE_DEBUG ? 'llparse__debug' : undefined,
    });
    cache.set(node, artifacts);
  }

  const extra = options.extra === undefined ? [] : options.extra.slice();
  if (ty === 'request' || ty === 'response') {
    extra.push(`-DLLPARSE__TEST_INIT=llhttp__test_init_${ty}`);
  }

  return fixtures.build(artifacts, outFile, Object.assign(options, {
    extra,
  }));
}
