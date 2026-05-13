import { createConfig, http } from 'wagmi'
import { injected } from 'wagmi/connectors'

export const CONTRACT_ADDRESS = "0x4062bf4D6650bA60d46d6177F2d880020B84C3a6";
export const USDC_ADDRESS     = "0x3600000000000000000000000000000000000000";

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

export const USDC_ABI = [
  { inputs:[{name:"spender",type:"address"},{name:"amount",type:"uint256"}], name:"approve", outputs:[{type:"bool"}], stateMutability:"nonpayable", type:"function" },
  { inputs:[{name:"owner",type:"address"},{name:"spender",type:"address"}], name:"allowance", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"account",type:"address"}], name:"balanceOf", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
];

export const CONTRACT_ABI = [
  // GM
  { inputs:[], name:"gm", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[], name:"restoreStreak", outputs:[], stateMutability:"nonpayable", type:"function" },

  // Predict
  { inputs:[{name:"assetId",type:"uint8"},{name:"roundType",type:"uint8"},{name:"isUp",type:"bool"},{name:"amount",type:"uint256"}], name:"predict", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[{name:"roundId",type:"uint256"}], name:"finalizeRound", outputs:[], stateMutability:"nonpayable", type:"function" },
  { inputs:[{name:"roundId",type:"uint256"}], name:"claim", outputs:[], stateMutability:"nonpayable", type:"function" },

  // Read: price
  { inputs:[{name:"assetId",type:"uint8"}], name:"getCurrentPrice", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },

  // Read: round IDs
  { inputs:[{name:"assetId",type:"uint8"}], name:"get4hRoundId", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"assetId",type:"uint8"}], name:"get24hRoundId", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },

  // Read: round info
  { inputs:[{name:"roundId",type:"uint256"}], name:"getRoundInfo", outputs:[{name:"assetId",type:"uint8"},{name:"roundType",type:"uint8"},{name:"startTime",type:"uint256"},{name:"endTime",type:"uint256"},{name:"snapshotPrice",type:"uint256"},{name:"currentPrice",type:"uint256"},{name:"priceIsUp",type:"bool"},{name:"finalized",type:"bool"},{name:"resultUp",type:"bool"},{name:"noContest",type:"bool"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"roundId",type:"uint256"}], name:"getRoundPool", outputs:[{name:"totalUp",type:"uint256"},{name:"totalDown",type:"uint256"},{name:"totalPool",type:"uint256"},{name:"payoutPool",type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"roundId",type:"uint256"},{name:"wallet",type:"address"}], name:"getUserEntry", outputs:[{name:"amount",type:"uint256"},{name:"isUp",type:"bool"},{name:"claimed",type:"bool"},{name:"currentlyWinning",type:"bool"},{name:"estimatedPayout",type:"uint256"}], stateMutability:"view", type:"function" },

  // Read: user
  { inputs:[{name:"w",type:"address"}], name:"getUserMain", outputs:[{name:"totalPoints",type:"uint256"},{name:"totalGMs",type:"uint256"},{name:"streak",type:"uint256"},{name:"canGMToday",type:"bool"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"w",type:"address"}], name:"getUserStreak", outputs:[{name:"streak",type:"uint256"},{name:"longestStreak",type:"uint256"},{name:"missedDay",type:"uint256"},{name:"canRestoreStreak",type:"bool"},{name:"restoreCost",type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"w",type:"address"}], name:"getMultiplier", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },

  // Read: leaderboard
  { inputs:[{name:"start",type:"uint256"},{name:"end",type:"uint256"}], name:"getLeaderboardPage", outputs:[{name:"wallets",type:"address[]"},{name:"points",type:"uint256[]"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"start",type:"uint256"},{name:"end",type:"uint256"}], name:"getLeaderboardStats", outputs:[{name:"streaks",type:"uint256[]"},{name:"gms",type:"uint256[]"},{name:"multipliers",type:"uint256[]"}], stateMutability:"view", type:"function" },

  // Read: misc
  { inputs:[], name:"getTotalGlobalGMs", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"getUserCount", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"getUTCDay", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"winnersShare", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[], name:"minEntry", outputs:[{type:"uint256"}], stateMutability:"view", type:"function" },
  { inputs:[{name:"",type:"uint8"}], name:"assets", outputs:[{name:"name",type:"string"},{name:"storkId",type:"bytes32"},{name:"active",type:"bool"}], stateMutability:"view", type:"function" },

  // Events
  { anonymous:false, inputs:[{indexed:true,name:"user",type:"address"},{indexed:false,name:"day",type:"uint256"},{indexed:false,name:"streak",type:"uint256"},{indexed:false,name:"points",type:"uint256"}], name:"GMSent", type:"event" },
  { anonymous:false, inputs:[{indexed:true,name:"roundId",type:"uint256"},{indexed:true,name:"user",type:"address"},{indexed:false,name:"isUp",type:"bool"},{indexed:false,name:"amount",type:"uint256"}], name:"Predicted", type:"event" },
  { anonymous:false, inputs:[{indexed:true,name:"roundId",type:"uint256"},{indexed:true,name:"user",type:"address"},{indexed:false,name:"usdcAmount",type:"uint256"},{indexed:false,name:"points",type:"uint256"}], name:"Claimed", type:"event" },
];
