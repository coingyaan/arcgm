import { useState, useEffect, useRef } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { CONTRACT_ADDRESS, CONTRACT_ABI, arcTestnet } from "./config.js";

// ── BADGE CONFIG ──
const BADGES = [
  { id: 0, emoji: "🌅", name: "First Light",  desc: "First ever GM",               pts: 5   },
  { id: 1, emoji: "🔥", name: "Week Warrior", desc: "7 day streak",                pts: 10  },
  { id: 2, emoji: "⚡", name: "Month Master", desc: "30 day streak",               pts: 30  },
  { id: 3, emoji: "💎", name: "Century",      desc: "100 day streak",              pts: 100 },
  { id: 4, emoji: "🏆", name: "OG",           desc: "First 100 wallets",           pts: 200 },
  { id: 5, emoji: "🕐", name: "Early Bird",   desc: "First GM of day 7 times",     pts: 15  },
  { id: 6, emoji: "📅", name: "Consistent",   desc: "GM every day for a month",    pts: 25  },
  { id: 7, emoji: "🎯", name: "Perfect Week", desc: "4 perfect weeks completed",   pts: 40  },
];

function hasBadge(bitmap, id) {
  if (!bitmap) return false;
  return (Number(bitmap) & (1 << id)) !== 0;
}

function AnimatedCounter({ value, className }) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    if (value === prev.current) return;
    const start = prev.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(start + (end - start) * ease));
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = end;
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span className={className}>{Number(display).toLocaleString()}</span>;
}

export default function ArcGM() {
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [tab, setTab] = useState("leaderboard");
  const [gmFired, setGmFired] = useState(false);
  const [particles, setParticles] = useState([]);
  const [copied, setCopied] = useState(false);
  const [showBadges, setShowBadges] = useState(false);

  const referrer = new URLSearchParams(window.location.search).get("ref") || "0x0000000000000000000000000000000000000000";

  // ── READ: Global GMs ──
  const { data: totalGMsData, refetch: refetchTotal } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getTotalGlobalGMs",
    watch: true,
  });

  // ── READ: User main stats ──
  const { data: userMain, refetch: refetchUserMain } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getUserMain",
    args: [address],
    enabled: !!address,
    watch: true,
  });

  // ── READ: User streak info ──
  const { data: userStreak, refetch: refetchUserStreak } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getUserStreak",
    args: [address],
    enabled: !!address,
    watch: true,
  });

  // ── READ: User referral info ──
  const { data: userReferral, refetch: refetchUserReferral } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getUserReferral",
    args: [address],
    enabled: !!address,
    watch: true,
  });

  // ── READ: Badges bitmap ──
  const { data: badgeBitmap, refetch: refetchBadges } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getBadges",
    args: [address],
    enabled: !!address,
    watch: true,
  });

  // ── READ: Leaderboard page ──
  const { data: lbPage, refetch: refetchLbPage } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getLeaderboardPage",
    args: [0, 50],
    watch: true,
  });

  // ── READ: Leaderboard stats ──
  const { data: lbStats, refetch: refetchLbStats } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getLeaderboardStats",
    args: [0, 50],
    watch: true,
  });

  // ── WRITE: GM ──
  const { writeContract: writeGM, data: gmTxHash, isPending: gmPending } = useWriteContract();
  const { isLoading: gmConfirming, isSuccess: gmConfirmed } = useWaitForTransactionReceipt({ hash: gmTxHash });

  // ── WRITE: Restore streak ──
  const { writeContract: writeRestore, data: restoreTxHash, isPending: restorePending } = useWriteContract();
  const { isLoading: restoreConfirming, isSuccess: restoreConfirmed } = useWaitForTransactionReceipt({ hash: restoreTxHash });

  const refetchAll = () => {
    refetchTotal();
    refetchUserMain();
    refetchUserStreak();
    refetchUserReferral();
    refetchBadges();
    refetchLbPage();
    refetchLbStats();
  };

  useEffect(() => { if (gmConfirmed) refetchAll(); }, [gmConfirmed]);
  useEffect(() => { if (restoreConfirmed) refetchAll(); }, [restoreConfirmed]);

  // ── PARSE USER DATA ──
  const totalPoints    = userMain ? Number(userMain[0]) / 1e18 : 0;
  const myGMs         = userMain ? Number(userMain[1]) : 0;
  const myStreak      = userMain ? Number(userMain[2]) : 0;
  const canGMToday    = userMain ? userMain[3] : true;
  const longestStreak = userStreak ? Number(userStreak[1]) : 0;
  const canRestore    = userStreak ? userStreak[3] : false;
  const restoreCost   = userStreak ? Number(userStreak[4]) / 1e18 : 0;
  const myReferrals   = userReferral ? Number(userReferral[0]) : 0;
  const globalGMs     = totalGMsData ? Number(totalGMsData) : 0;
  const MAX_REFERRALS = 3;

  // ── PARSE LEADERBOARD ──
  const leaderboard = (lbPage && lbStats)
    ? lbPage[0].map((wallet, i) => ({
        address: wallet,
        points:  Number(lbPage[1][i]) / 1e18,
        streak:  Number(lbStats[0][i]),
        gms:     Number(lbStats[1][i]),
        badges:  lbStats[2][i],
      }))
      .sort((a, b) => b.points - a.points)
      .slice(0, 10)
    : [];

  const myRank = leaderboard.findIndex(
    (e) => e.address?.toLowerCase() === address?.toLowerCase()
  ) + 1;

  // ── HELPERS ──
  const formatAddress = (addr) => addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

  const getSecsToUTCMidnight = () => {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.floor((midnight - now) / 1000);
  };

  const [countdown, setCountdown] = useState(getSecsToUTCMidnight());
  useEffect(() => {
    const t = setInterval(() => setCountdown(getSecsToUTCMidnight()), 1000);
    return () => clearInterval(t);
  }, []);

  const formatCountdown = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  // ── MULTIPLIER ──
  const getMultiplier = (streak) => {
    if (streak >= 15) return "2x";
    if (streak >= 7)  return "1.5x";
    if (streak >= 3)  return "1.2x";
    return "1x";
  };

  // ── PARTICLES ──
  const spawnParticles = () => {
    const newP = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i,
      style: {
        left: `${40 + Math.random() * 20}%`,
        top:  `${40 + Math.random() * 20}%`,
        width:  `${4 + Math.random() * 8}px`,
        height: `${4 + Math.random() * 8}px`,
        background: ["#00E5FF","#7B2FFF","#FF6B35","#00FF88","#FFD700"][Math.floor(Math.random() * 5)],
        borderRadius: "50%",
        position: "absolute",
        pointerEvents: "none",
        animation: "burst 1s ease-out forwards",
        "--dx": `${(Math.random() - 0.5) * 300}px`,
        "--dy": `${(Math.random() - 0.5) * 300}px`,
        animationDelay: `${Math.random() * 0.2}s`,
        zIndex: 100,
      },
    }));
    setParticles((p) => [...p, ...newP]);
    setTimeout(() => setParticles((p) => p.filter((x) => !newP.find((n) => n.id === x.id))), 1200);
  };

  // ── HANDLERS ──
  const handleGM = () => {
    if (!canGMToday || gmPending || gmConfirming) return;
    spawnParticles();
    setGmFired(true);
    writeGM({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "gm",
      args: [referrer],
      chainId: arcTestnet.id,
    });
  };

  const handleRestore = () => {
    if (!canRestore || restorePending || restoreConfirming) return;
    writeRestore({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "restoreStreak",
      args: [],
      chainId: arcTestnet.id,
    });
  };

  const handleConnect = () => connect({ connector: injected() });

  const handleCopyReferral = () => {
    if (myReferrals >= MAX_REFERRALS) return;
    navigator.clipboard?.writeText(`https://arcgm.vercel.app?ref=${address}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isWrongNetwork = isConnected && chain?.id !== arcTestnet.id;

  const handleSwitchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x4cef52" }],
      });
    } catch {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [{
          chainId: "0x4cef52",
          chainName: "Arc Testnet",
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          rpcUrls: ["https://rpc.testnet.arc.network"],
          blockExplorerUrls: ["https://testnet.arcscan.app"],
        }],
      });
    }
  };

  // ── MY BADGES ──
  const myBadges = BADGES.filter(b => hasBadge(badgeBitmap, b.id));

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0a0014; }

        @keyframes burst {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity: 0; }
        }
        @keyframes bgShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes orb {
          0%, 100% { transform: translate(0,0) scale(1); }
          33% { transform: translate(30px,-20px) scale(1.05); }
          66% { transform: translate(-20px,15px) scale(0.97); }
        }
        @keyframes pulse {
          0%, 100% { box-shadow: 0 0 30px #7B2FFF88, 0 0 60px #00E5FF44; }
          50% { box-shadow: 0 0 60px #7B2FFFCC, 0 0 120px #00E5FF88; }
        }
        @keyframes gmBounce {
          0% { transform: scale(1); }
          40% { transform: scale(0.88); }
          70% { transform: scale(1.12); }
          100% { transform: scale(1); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-8px); }
        }
        @keyframes badgePop {
          0% { transform: scale(0.8); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }

        .root { min-height: 100vh; font-family: 'Space Grotesk', sans-serif; background: #0a0014; position: relative; overflow: hidden; display: flex; flex-direction: column; }
        .bg-gradient { position: absolute; inset: 0; background: radial-gradient(ellipse 80% 60% at 50% 30%, #1a0050 0%, #0a0014 60%); z-index: 0; }
        .orb { position: absolute; border-radius: 50%; filter: blur(80px); pointer-events: none; z-index: 0; animation: orb 8s ease-in-out infinite; }
        .orb-1 { width: 500px; height: 500px; background: #7B2FFF22; top: -100px; left: -100px; }
        .orb-2 { width: 400px; height: 400px; background: #00E5FF18; bottom: -80px; right: -80px; animation-delay: -4s; }
        .orb-3 { width: 300px; height: 300px; background: #FF6B3515; top: 40%; left: 30%; animation-delay: -2s; }
        .grid-lines { position: absolute; inset: 0; z-index: 0; opacity: 0.06; background-image: linear-gradient(rgba(0,229,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.5) 1px, transparent 1px); background-size: 60px 60px; }

        .header { position: relative; z-index: 10; display: flex; align-items: center; justify-content: space-between; padding: 20px 32px; border-bottom: 1px solid rgba(255,255,255,0.06); backdrop-filter: blur(10px); }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-dot { width: 10px; height: 10px; border-radius: 50%; background: #00E5FF; box-shadow: 0 0 12px #00E5FF; }
        .logo-text { font-family: 'Syne', sans-serif; font-size: 1.2rem; color: #fff; letter-spacing: 0.05em; }
        .wallet-pill { background: rgba(123,47,255,0.2); border: 1px solid rgba(123,47,255,0.4); color: #b388ff; padding: 8px 16px; border-radius: 20px; font-size: 0.8rem; display: flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; }
        .wallet-pill:hover { background: rgba(123,47,255,0.35); }
        .wallet-dot { width: 6px; height: 6px; border-radius: 50%; background: #00FF88; box-shadow: 0 0 6px #00FF88; }
        .connect-btn { background: linear-gradient(135deg, #7B2FFF, #00E5FF); border: none; color: #fff; padding: 10px 24px; border-radius: 20px; font-family: 'Space Grotesk', sans-serif; font-size: 0.85rem; font-weight: 600; cursor: pointer; transition: opacity 0.2s; }
        .connect-btn:hover { opacity: 0.85; }
        .wrong-network-btn { background: rgba(255,107,53,0.2); border: 1px solid #FF6B35; color: #FF6B35; padding: 8px 16px; border-radius: 20px; font-family: 'Space Grotesk', sans-serif; font-size: 0.8rem; cursor: pointer; }

        .main { position: relative; z-index: 5; display: grid; grid-template-columns: 280px 1fr 320px; gap: 24px; padding: 28px 32px; flex: 1; align-items: start; }
        .panel { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; backdrop-filter: blur(20px); animation: fadeUp 0.6s ease both; }
        .panel-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); margin-bottom: 20px; }
        .stat-item { margin-bottom: 24px; }
        .stat-label { font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
        .stat-value { font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 800; background: linear-gradient(135deg, #fff 30%, #b388ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .stat-value.cyan { background: linear-gradient(135deg, #00E5FF, #7B2FFF); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .streak-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(255,107,53,0.15); border: 1px solid rgba(255,107,53,0.3); border-radius: 8px; padding: 6px 12px; margin-top: 4px; font-size: 0.8rem; color: #FF6B35; }
        .rank-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(0,229,255,0.1); border: 1px solid rgba(0,229,255,0.2); border-radius: 8px; padding: 6px 12px; margin-top: 8px; font-size: 0.8rem; color: #00E5FF; }
        .mult-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(0,255,136,0.1); border: 1px solid rgba(0,255,136,0.2); border-radius: 8px; padding: 4px 10px; margin-top: 6px; font-size: 0.75rem; color: #00FF88; }
        .pts-badge { display: inline-flex; align-items: center; gap: 6px; background: rgba(123,47,255,0.1); border: 1px solid rgba(123,47,255,0.2); border-radius: 8px; padding: 4px 10px; margin-top: 6px; margin-left: 4px; font-size: 0.75rem; color: #b388ff; }

        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 20px 0; }

        /* Badges */
        .badges-section { margin-top: 4px; }
        .badges-toggle { background: none; border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: rgba(255,255,255,0.4); font-size: 0.72rem; padding: 5px 10px; cursor: pointer; font-family: 'Space Grotesk', sans-serif; width: 100%; text-align: left; transition: all 0.2s; }
        .badges-toggle:hover { border-color: rgba(123,47,255,0.3); color: rgba(255,255,255,0.7); }
        .badges-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 8px; }
        .badge-item { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.07); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 3px; animation: badgePop 0.3s ease both; }
        .badge-item.earned { border-color: rgba(123,47,255,0.3); background: rgba(123,47,255,0.08); }
        .badge-emoji { font-size: 1.2rem; }
        .badge-name { font-size: 0.58rem; color: rgba(255,255,255,0.5); text-align: center; }
        .badge-pts { font-size: 0.55rem; color: #b388ff; }
        .badge-item.locked { opacity: 0.3; filter: grayscale(1); }

        /* Restore streak */
        .restore-btn { width: 100%; padding: 9px; border-radius: 10px; border: 1px solid rgba(255,107,53,0.4); background: rgba(255,107,53,0.1); color: #FF6B35; font-size: 0.78rem; cursor: pointer; font-family: 'Space Grotesk', sans-serif; transition: all 0.2s; margin-top: 10px; }
        .restore-btn:hover { background: rgba(255,107,53,0.2); }
        .restore-btn:disabled { opacity: 0.3; cursor: not-allowed; }

        /* Referral */
        .ref-bar-wrap { background: rgba(255,255,255,0.05); border-radius: 6px; height: 6px; margin: 10px 0; overflow: hidden; }
        .ref-bar-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #7B2FFF, #00E5FF); transition: width 0.5s ease; }
        .ref-btn { width: 100%; padding: 10px; border-radius: 10px; border: 1px solid rgba(123,47,255,0.4); background: rgba(123,47,255,0.1); color: #b388ff; font-size: 0.8rem; cursor: pointer; font-family: 'Space Grotesk', sans-serif; transition: all 0.2s; margin-top: 10px; }
        .ref-btn:hover { background: rgba(123,47,255,0.2); }
        .ref-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ref-cap-note { font-size: 0.68rem; color: rgba(255,255,255,0.3); margin-top: 6px; text-align: center; }

        /* Center */
        .center-col { display: flex; flex-direction: column; align-items: center; gap: 28px; }
        .gm-count-global { text-align: center; }
        .gm-count-label { font-size: 0.7rem; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 4px; }
        .gm-count-number { font-family: 'Syne', sans-serif; font-size: 3rem; font-weight: 800; background: linear-gradient(135deg, #00E5FF 0%, #7B2FFF 60%, #FF6B35 100%); background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: shimmer 3s linear infinite; }
        .gm-btn-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .gm-btn { width: 180px; height: 180px; border-radius: 50%; border: none; cursor: pointer; background: linear-gradient(135deg, #7B2FFF, #00E5FF, #7B2FFF); background-size: 200% 200%; font-family: 'Syne', sans-serif; font-size: 2.2rem; font-weight: 800; color: #fff; letter-spacing: 0.08em; animation: pulse 3s ease-in-out infinite, bgShift 4s ease infinite; transition: transform 0.15s; position: relative; z-index: 2; box-shadow: 0 0 40px #7B2FFF88, 0 0 80px #00E5FF33; }
        .gm-btn:hover:not(:disabled) { transform: scale(1.06); }
        .gm-btn:disabled { background: linear-gradient(135deg, #2a1a4a, #1a2a3a); animation: none; box-shadow: none; cursor: not-allowed; opacity: 0.6; }
        .gm-btn.fired { animation: gmBounce 0.5s ease, pulse 3s ease-in-out 0.5s infinite, bgShift 4s ease infinite; }
        .gm-ring { position: absolute; border-radius: 50%; border: 2px solid rgba(0,229,255,0.3); animation: pulse 2s ease-in-out infinite; pointer-events: none; }
        .gm-ring-1 { width: 210px; height: 210px; }
        .gm-ring-2 { width: 240px; height: 240px; animation-delay: 0.4s; opacity: 0.5; }
        .gm-ring-3 { width: 270px; height: 270px; animation-delay: 0.8s; opacity: 0.25; }
        .countdown { text-align: center; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 14px 28px; animation: float 4s ease-in-out infinite; }
        .countdown-label { font-size: 0.65rem; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 4px; }
        .countdown-time { font-family: 'Syne', sans-serif; font-size: 1.6rem; font-weight: 700; color: #00E5FF; text-shadow: 0 0 20px #00E5FF88; }
        .gm-ready { font-family: 'Syne', sans-serif; font-size: 1rem; color: #00FF88; text-shadow: 0 0 12px #00FF8888; animation: float 3s ease-in-out infinite; }
        .tx-status { font-size: 0.75rem; color: #00FF88; text-align: center; animation: float 2s ease-in-out infinite; }

        /* Leaderboard */
        .tabs { display: flex; gap: 4px; margin-bottom: 16px; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 4px; }
        .tab-btn { flex: 1; padding: 6px; border: none; border-radius: 8px; background: transparent; color: rgba(255,255,255,0.4); font-family: 'Space Grotesk', sans-serif; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; }
        .tab-btn.active { background: rgba(123,47,255,0.3); color: #fff; }
        .leaderboard-list { display: flex; flex-direction: column; gap: 8px; }
        .lb-row { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); transition: border-color 0.2s; }
        .lb-row:hover { border-color: rgba(123,47,255,0.3); }
        .lb-row.me { border-color: rgba(0,229,255,0.3); background: rgba(0,229,255,0.04); }
        .lb-rank { font-family: 'Syne', sans-serif; font-size: 0.8rem; font-weight: 700; min-width: 22px; color: rgba(255,255,255,0.3); }
        .lb-rank.gold { color: #FFD700; }
        .lb-rank.silver { color: #C0C0C0; }
        .lb-rank.bronze { color: #CD7F32; }
        .lb-addr { flex: 1; font-size: 0.72rem; color: rgba(255,255,255,0.6); font-family: monospace; }
        .lb-pts { font-family: 'Syne', sans-serif; font-size: 0.85rem; font-weight: 700; color: #fff; }
        .lb-streak { font-size: 0.65rem; color: #FF6B35; margin-left: 4px; }
        .lb-badges { font-size: 0.7rem; margin-top: 1px; }

        .not-connected { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 60vh; gap: 20px; position: relative; z-index: 5; }
        .not-connected h2 { font-family: 'Syne', sans-serif; font-size: 2rem; color: #fff; }
        .not-connected p { color: rgba(255,255,255,0.4); font-size: 0.9rem; }
        .particles-wrap { position: fixed; inset: 0; pointer-events: none; z-index: 200; }
      `}</style>

      <div className="root">
        <div className="bg-gradient" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="grid-lines" />
        <div className="particles-wrap">
          {particles.map((p) => <div key={p.id} style={p.style} />)}
        </div>

        {/* HEADER */}
        <div className="header">
          <div className="logo">
            <div className="logo-dot" />
            <span className="logo-text">GM · ARC NETWORK</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>TESTNET</div>
            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "#00E5FF", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", padding: "4px 10px", borderRadius: 20 }}>🚰 Get test USDC</a>
          </div>
          {!isConnected ? (
            <button className="connect-btn" onClick={handleConnect}>Connect Wallet</button>
          ) : isWrongNetwork ? (
            <button className="wrong-network-btn" onClick={handleSwitchNetwork}>⚠ Switch to Arc Testnet</button>
          ) : (
            <div className="wallet-pill" onClick={() => disconnect()}>
              <div className="wallet-dot" />
              {formatAddress(address)}
            </div>
          )}
        </div>

        {!isConnected ? (
          <div className="not-connected">
            <div className="logo-dot" style={{ width: 20, height: 20 }} />
            <h2>Welcome to ArcGM</h2>
            <p>Connect your wallet to say GM on Arc Testnet</p>
            <button className="connect-btn" style={{ fontSize: "1rem", padding: "14px 32px" }} onClick={handleConnect}>
              Connect Wallet
            </button>
          </div>
        ) : (
          <div className="main">

            {/* LEFT PANEL */}
            <div className="panel">
              <div className="panel-title">Your Stats</div>

              <div className="stat-item">
                <div className="stat-label">Total Points</div>
                <div className="stat-value cyan">{totalPoints.toFixed(1)}</div>
                {myRank > 0 && <div><span className="rank-badge">🏆 Rank #{myRank}</span></div>}
                {myStreak > 0 && (
                  <div style={{ marginTop: 6 }}>
                    <span className="streak-badge">🔥 {myStreak} day streak</span>
                    <span className="mult-badge">⚡ {getMultiplier(myStreak)} GM pts</span>
                  </div>
                )}
                {longestStreak > 0 && (
                  <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
                    Longest streak: {longestStreak} days
                  </div>
                )}
              </div>

              <div className="divider" />

              <div className="stat-item">
                <div className="stat-label">Your GMs</div>
                <AnimatedCounter value={myGMs} className="stat-value" />
              </div>

              <div className="divider" />

              {/* STREAK RESTORE */}
              {canRestore && (
                <>
                  <div style={{ background: "rgba(255,107,53,0.08)", border: "1px solid rgba(255,107,53,0.2)", borderRadius: 12, padding: "12px", marginBottom: 16 }}>
                    <div style={{ fontSize: "0.72rem", color: "#FF6B35", marginBottom: 6 }}>⚠ Streak broken yesterday</div>
                    <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
                      Restore for {restoreCost} pts · Window closes in 24h
                    </div>
                    <button
                      className="restore-btn"
                      onClick={handleRestore}
                      disabled={restorePending || restoreConfirming}
                    >
                      {restorePending ? "⏳ Confirm..." : restoreConfirming ? "⛓ Restoring..." : `🔄 Restore Streak (${restoreCost} pts)`}
                    </button>
                  </div>
                </>
              )}

              {/* BADGES */}
              <div className="badges-section">
                <button className="badges-toggle" onClick={() => setShowBadges(!showBadges)}>
                  {showBadges ? "▲" : "▼"} Badges · {myBadges.length}/{BADGES.length} earned
                </button>
                {showBadges && (
                  <div className="badges-grid">
                    {BADGES.map(b => {
                      const earned = hasBadge(badgeBitmap, b.id);
                      return (
                        <div key={b.id} className={`badge-item${earned ? " earned" : " locked"}`} title={b.desc}>
                          <div className="badge-emoji">{b.emoji}</div>
                          <div className="badge-name">{b.name}</div>
                          <div className="badge-pts">+{b.pts} pts</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="divider" />

              {/* REFERRAL */}
              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Referrals</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                  <span>{myReferrals} / {MAX_REFERRALS} used</span>
                  <span style={{ color: myReferrals >= MAX_REFERRALS ? "#FF6B35" : "#00FF88" }}>
                    {myReferrals >= MAX_REFERRALS ? "Capped" : `${MAX_REFERRALS - myReferrals} left`}
                  </span>
                </div>
                <div className="ref-bar-wrap">
                  <div className="ref-bar-fill" style={{ width: `${(myReferrals / MAX_REFERRALS) * 100}%` }} />
                </div>
                <button className="ref-btn" onClick={handleCopyReferral} disabled={myReferrals >= MAX_REFERRALS}>
                  {copied ? "✓ Copied!" : "📋 Copy Referral Link"}
                </button>
                <div className="ref-cap-note">Max {MAX_REFERRALS} referrals · Activates after 7 GMs</div>
              </div>
            </div>

            {/* CENTER */}
            <div className="center-col">
              <div className="gm-count-global">
                <div className="gm-count-label">Global GM Count · Arc Testnet</div>
                <AnimatedCounter value={globalGMs} className="gm-count-number" />
              </div>

              <div className="gm-btn-wrap">
                <div className="gm-ring gm-ring-1" />
                <div className="gm-ring gm-ring-2" />
                <div className="gm-ring gm-ring-3" />
                <button
                  className={`gm-btn${gmFired ? " fired" : ""}`}
                  onClick={handleGM}
                  disabled={!canGMToday || gmPending || gmConfirming}
                >
                  {gmPending ? "..." : gmConfirming ? "⏳" : "GM"}
                </button>
              </div>

              {(gmPending || gmConfirming) && (
                <div className="tx-status">
                  {gmPending ? "⏳ Confirm in wallet..." : "⛓ Confirming on chain..."}
                </div>
              )}

              {!canGMToday ? (
                <div className="countdown">
                  <div className="countdown-label">Resets at UTC 00:00 in</div>
                  <div className="countdown-time">{formatCountdown(countdown)}</div>
                </div>
              ) : (
                <div className="gm-ready">✦ Tap to say GM on Arc ✦</div>
              )}

              <div style={{ textAlign: "center", fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", lineHeight: 1.6, maxWidth: 300 }}>
                One GM per wallet per UTC day.<br />Resets at 00:00 UTC for everyone.<br />Streak multiplier applies to GM points only.
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="panel">
              <div className="tabs">
                <button className={`tab-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>Leaderboard</button>
                <button className={`tab-btn${tab === "badges" ? " active" : ""}`} onClick={() => setTab("badges")}>Badges</button>
              </div>

              {tab === "leaderboard" && (
                <div className="leaderboard-list">
                  {leaderboard.length === 0 ? (
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", padding: "20px 0" }}>
                      No GMs yet. Be the first! 🌅
                    </div>
                  ) : leaderboard.map((entry, i) => {
                    const entryBadges = BADGES.filter(b => hasBadge(entry.badges, b.id));
                    return (
                      <div key={entry.address} className={`lb-row${entry.address?.toLowerCase() === address?.toLowerCase() ? " me" : ""}`}>
                        <div className={`lb-rank${i === 0 ? " gold" : i === 1 ? " silver" : i === 2 ? " bronze" : ""}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div className="lb-addr">
                            {formatAddress(entry.address)}
                            {entry.address?.toLowerCase() === address?.toLowerCase() && (
                              <span style={{ color: "#00E5FF", marginLeft: 4, fontSize: "0.65rem" }}>(you)</span>
                            )}
                          </div>
                          {entryBadges.length > 0 && (
                            <div className="lb-badges">
                              {entryBadges.slice(0, 4).map(b => (
                                <span key={b.id} title={b.name}>{b.emoji}</span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="lb-pts">{entry.points.toFixed(1)}</div>
                          <div className="lb-streak">🔥{entry.streak}d</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {tab === "badges" && (
                <div>
                  <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.3)", marginBottom: 12 }}>
                    Badges reward consistent participation. Earned once only.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {BADGES.map(b => {
                      const earned = hasBadge(badgeBitmap, b.id);
                      return (
                        <div key={b.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: earned ? "rgba(123,47,255,0.08)" : "rgba(255,255,255,0.02)", border: `1px solid ${earned ? "rgba(123,47,255,0.3)" : "rgba(255,255,255,0.05)"}`, opacity: earned ? 1 : 0.45 }}>
                          <div style={{ fontSize: "1.4rem" }}>{b.emoji}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: "0.78rem", color: "#fff", fontWeight: 600 }}>{b.name}</div>
                            <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.4)" }}>{b.desc}</div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ fontSize: "0.72rem", color: "#b388ff", fontWeight: 700 }}>+{b.pts} pts</div>
                            <div style={{ fontSize: "0.6rem", color: earned ? "#00FF88" : "rgba(255,255,255,0.2)" }}>
                              {earned ? "✓ Earned" : "Locked"}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 16, padding: "12px", background: "rgba(0,229,255,0.05)", border: "1px dashed rgba(0,229,255,0.15)", borderRadius: 12, textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "rgba(0,229,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>Coming Soon</div>
                <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginTop: 4 }}>Bridge USDC → ARC Testnet</div>
              </div>
            </div>

          </div>
        )}
      </div>
    </>
  );
}
