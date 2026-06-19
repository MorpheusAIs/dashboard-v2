import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';

const projectRoot = process.cwd();
const connectorsPath = join(projectRoot, 'config/wagmi-connectors.ts');
const connectorsSource = readFileSync(connectorsPath, 'utf8');
const wagmiConfigSource = readFileSync(join(projectRoot, 'config/index.tsx'), 'utf8');
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8'));

assert.match(
  connectorsSource,
  /safe\s*\(/,
  'Safe connector should be included in the dashboard wallet connector list.',
);

assert.match(
  wagmiConfigSource,
  /enableWalletConnect:\s*true/,
  'Wagmi config should keep Web3Modal WalletConnect defaults enabled.',
);

assert.match(
  wagmiConfigSource,
  /enableInjected:\s*true/,
  'Wagmi config should keep Web3Modal injected wallet defaults enabled.',
);

assert.match(
  wagmiConfigSource,
  /enableEIP6963:\s*true/,
  'Wagmi config should keep EIP-6963 discovery enabled.',
);

assert.doesNotMatch(
  connectorsSource,
  /walletConnect\s*\(|injected\s*\(|coinbaseWallet\s*\(/,
  'Safe connector helper should not duplicate Web3Modal default connectors.',
);

assert.match(
  wagmiConfigSource,
  /connectors:\s*buildWalletConnectors\s*\(\s*\)/,
  'Wagmi config should use the Safe-aware connector builder.',
);

assert.ok(
  packageJson.dependencies['@safe-global/safe-apps-provider'],
  'Safe Apps provider dependency should be declared directly.',
);

assert.ok(
  packageJson.dependencies['@safe-global/safe-apps-sdk'],
  'Safe Apps SDK dependency should be declared directly.',
);

console.log('Safe wallet connector config adds Safe while preserving Web3Modal wallet defaults.');
