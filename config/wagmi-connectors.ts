import { safe } from 'wagmi/connectors';

export function buildWalletConnectors() {
  return [
    safe({
      allowedDomains: [/app.safe.global$/],
    }),
  ];
}
