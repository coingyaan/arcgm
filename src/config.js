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
  "function gm(address referrer) external",
  "function restoreStreak() external",
  "function getTotalGlobalGMs() view returns (uint256)",
  "function getUserCount() view returns (uint256)",
  "function getFirstGMToday() view returns (address)",
  "function getUTCDay() view returns (uint256)",
  "function getMultiplier(uint256 streak) view returns (uint256)",
  "function getRestoreCost(address wallet) view returns (uint256)",
  "function canRestore(address wallet) view returns (bool)",
  "function getBadges(address w) view returns (uint256)",
  "function hasBadge(address w, uint8 id) view returns (bool)",
  "function getUserMain(address w) view returns (uint256 totalPoints, uint256 totalGMs, uint256 streak, bool canGMToday)",
  "function getUserStreak(address w) view returns (uint256 streak, uint256 longestStreak, uint256 missedDay, bool canRestoreStreak, uint256 restoreCost)",
  "function getUserReferral(address w) view returns (uint256 referralCount, address referredBy)",
  "function getLeaderboardPage(uint256 start, uint256 end) view returns (address[] wallets, uint256[] points)",
  "function getLeaderboardStats(uint256 start, uint256 end) view returns (uint256[] streaks, uint256[] gms, uint256[] badges)",
  "function migrateUser(address wallet, uint256 totalPoints, uint256 totalGMs, uint256 streak, uint256 longestStreak) external",
  "function adminUpdateUser(address wallet, uint256 totalPoints, uint256 totalGMs, uint256 streak, uint256 longestStreak) external",
  "function transferOwnership(address newOwner) external",
];
