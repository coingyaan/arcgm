export const CONTRACT_ADDRESS = "0x0E6d86a33FF7fB39BBc3F512f8A804E10295939f";

export const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arcTestnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.network"] } },
  blockExplorers: { default: { name: "ArcScan", url: "https://testnet.arcscan.app" } },
};

export const CONTRACT_ABI = [
  {
    "inputs": [{"name": "referrer", "type": "address"}],
    "name": "gm",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "restoreStreak",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getTotalGlobalGMs",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getUserCount",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getUTCDay",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "streak", "type": "uint256"}],
    "name": "getMultiplier",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "pure",
    "type": "function"
  },
  {
    "inputs": [{"name": "wallet", "type": "address"}],
    "name": "getRestoreCost",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "wallet", "type": "address"}],
    "name": "canRestore",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "w", "type": "address"}],
    "name": "getBadges",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "w", "type": "address"}, {"name": "id", "type": "uint8"}],
    "name": "hasBadge",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "w", "type": "address"}],
    "name": "getUserMain",
    "outputs": [
      {"name": "totalPoints", "type": "uint256"},
      {"name": "totalGMs", "type": "uint256"},
      {"name": "streak", "type": "uint256"},
      {"name": "canGMToday", "type": "bool"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "w", "type": "address"}],
    "name": "getUserStreak",
    "outputs": [
      {"name": "streak", "type": "uint256"},
      {"name": "longestStreak", "type": "uint256"},
      {"name": "missedDay", "type": "uint256"},
      {"name": "canRestoreStreak", "type": "bool"},
      {"name": "restoreCost", "type": "uint256"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{"name": "w", "type": "address"}],
    "name": "getUserReferral",
    "outputs": [
      {"name": "referralCount", "type": "uint256"},
      {"name": "referredBy", "type": "address"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "start", "type": "uint256"},
      {"name": "end", "type": "uint256"}
    ],
    "name": "getLeaderboardPage",
    "outputs": [
      {"name": "wallets", "type": "address[]"},
      {"name": "points", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "start", "type": "uint256"},
      {"name": "end", "type": "uint256"}
    ],
    "name": "getLeaderboardStats",
    "outputs": [
      {"name": "streaks", "type": "uint256[]"},
      {"name": "gms", "type": "uint256[]"},
      {"name": "badges", "type": "uint256[]"}
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "wallet", "type": "address"},
      {"name": "totalPoints", "type": "uint256"},
      {"name": "totalGMs", "type": "uint256"},
      {"name": "streak", "type": "uint256"},
      {"name": "longestStreak", "type": "uint256"}
    ],
    "name": "migrateUser",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "wallet", "type": "address"},
      {"name": "totalPoints", "type": "uint256"},
      {"name": "totalGMs", "type": "uint256"},
      {"name": "streak", "type": "uint256"},
      {"name": "longestStreak", "type": "uint256"}
    ],
    "name": "adminUpdateUser",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "newOwner", "type": "address"}],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": false, "name": "day", "type": "uint256"},
      {"indexed": false, "name": "streak", "type": "uint256"},
      {"indexed": false, "name": "points", "type": "uint256"}
    ],
    "name": "GMSent",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": false, "name": "badgeId", "type": "uint8"},
      {"indexed": false, "name": "points", "type": "uint256"}
    ],
    "name": "BadgeAwarded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {"indexed": true, "name": "user", "type": "address"},
      {"indexed": false, "name": "streak", "type": "uint256"},
      {"indexed": false, "name": "cost", "type": "uint256"}
    ],
    "name": "StreakRestored",
    "type": "event"
  }
];
