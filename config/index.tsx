import { defaultWagmiConfig } from '@web3modal/wagmi/react/config';
import { cookieStorage, createStorage } from 'wagmi';
import { mainnet, base, arbitrum } from 'wagmi/chains';

export const projectId = process.env.NEXT_PUBLIC_PROJECT_ID;

if (!projectId) throw new Error('Project ID is not defined');

const metadata = {
  name: 'Morpheus Dashboard',
  description: 'Morpheus Dashboard',
  url: 'https://morpheus.reown.com',
  icons: ['https://morpheus.reown.com/favicon.ico']
};

const chains = [mainnet, base, arbitrum] as const;
export const config = defaultWagmiConfig({
  chains,
  projectId,
  metadata,
  ssr: true,
  storage: createStorage({
    storage: cookieStorage
  }),
  enableCoinbase: true,
  auth: {
    showWallets: true,
    walletFeatures: true,
    email: false,
    socials: [],
  },
});
