import { createConfig, http } from "wagmi";
import { defineChain } from "viem";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 18,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

export const CONTRACT_ADDRESS = "0x5B538f515174a11b6c38B26d00dDeD5d6E99E6fC";

export const CONTRACT_ABI = [
  {
    inputs: [{ name: "referrer", type: "address" }],
    name: "gm",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [],
    name: "totalGMs",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "wallet", type: "address" }],
    name: "getUser",
    outputs: [
      { name: "_totalGMs", type: "uint256" },
      { name: "_lastGMDay", type: "uint256" },
      { name: "_streak", type: "uint256" },
      { name: "_referredBy", type: "address" },
      { name: "_referralCount", type: "uint256" },
      { name: "_gmAvailableToday", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getLeaderboard",
    outputs: [
      { name: "wallets", type: "address[]" },
      { name: "gms", type: "uint256[]" },
      { name: "streaks", type: "uint256[]" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "getUserCount",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export const wagmiConfig = createConfig({
  chains: [arcTestnet],
  transports: {
    [arcTestnet.id]: http(),
  },
});