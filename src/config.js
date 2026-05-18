import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

export const CONTRACT_ADDRESS = "0x3a61Aa19b56421bE3d6f7F72a9B7af4358591eC0";

export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arcTestnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
};

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  connectors: [injected()],
  transports: { [arcTestnet.id]: http("https://rpc.testnet.arc.network") },
});

export const CONTRACT_ABI = [
  { inputs:[], name:"gm", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[], name:"restoreStreak", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[{name:"w",type:"address"}], name:"getUserMain", outputs:[{name:"totalPoints",type:"uint256"},{name:"totalGMs",type:"uint256"},{name:"streak",type:"uint256"},{name:"canGMToday",type:"bool"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"w",type:"address"}], name:"getUserStreak", outputs:[{name:"streak",type:"uint256"},{name:"longestStreak",type:"uint256"},{name:"missedDay",type:"uint256"},{name:"canRestoreStreak",type:"bool"},{name:"restoreCost",type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"w",type:"address"}], name:"getMultiplier", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"getTotalGlobalGMs", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"getUserCount", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"getFirstGMToday", outputs:[{type:"address"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"start",type:"uint256"},{name:"end",type:"uint256"}], name:"getLeaderboardPage", outputs:[{name:"wallets",type:"address[]"},{name:"points",type:"uint256[]"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"start",type:"uint256"},{name:"end",type:"uint256"}], name:"getLeaderboardStats", outputs:[{name:"streaks",type:"uint256[]"},{name:"gms",type:"uint256[]"},{name:"multipliers",type:"uint256[]"}], stateMutability:"view", type:"function" },
  { anonymous:false, inputs:[{indexed:true,name:"user",type:"address"},{indexed:false,name:"day",type:"uint256"},{indexed:false,name:"streak",type:"uint256"},{indexed:false,name:"points",type:"uint256"}], name:"GMSent", type:"event" },
  { anonymous:false, inputs:[{indexed:true,name:"user",type:"address"},{indexed:false,name:"streak",type:"uint256"},{indexed:false,name:"cost",type:"uint256"}], name:"StreakRestored", type:"event" },
];
