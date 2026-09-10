import {
  mkdtemp,
  cp,
  mkdir,
  writeFile,
  readFile,
  symlink,
  rm,
} from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { spawnSync } from 'node:child_process';
const root = process.cwd();
await mkdir(join(root, 'work'), { recursive: true });
const stage = await mkdtemp(join(root, 'work/demo-build-'));
try {
  for (const dir of ['app', 'components', 'hooks', 'lib', 'public'])
    await cp(join(root, dir), join(stage, dir), { recursive: true });
  await rm(join(stage, 'app/api'), { recursive: true, force: true });
  for (const file of ['package.json', 'tsconfig.json', 'postcss.config.mjs'])
    await cp(join(root, file), join(stage, file));
  await symlink(join(root, 'node_modules'), join(stage, 'node_modules'), 'dir');
  await writeFile(
    join(stage, 'next.config.mjs'),
    "export default {output:'export',images:{unoptimized:true},trailingSlash:true,experimental:{cpus:2}};\n",
  );
  // Only explicitly needed public flags enter this build. No .env files are copied.
  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules/next/dist/bin/next'), 'build'],
    {
      cwd: stage,
      stdio: 'inherit',
      env: {
        PATH: process.env.PATH,
        HOME: process.env.HOME,
        NEXT_TELEMETRY_DISABLED: '1',
        NODE_ENV: 'production',
        NEXT_PUBLIC_DEMO_MODE: 'true',
      },
    },
  );
  if (result.status !== 0) throw Error('Demo build failed');
  await rm(join(root, 'out'), { recursive: true, force: true });
  await cp(join(stage, 'out'), join(root, 'out'), { recursive: true });
  console.log('Demo exported to out/; production API source is preserved.');
} finally {
  await rm(stage, { recursive: true, force: true });
}
