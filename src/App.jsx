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

const MAX_REFERRALS = 5;

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

  const referrer = new URLSearchParams(window.location.search).get("ref") || "0x0000000000000000000000000000000000000000";

  // Read global GM count
  const { data: totalGMs, refetch: refetchTotal } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "totalGMs",
    watch: true,
  });

  // Read user data
  const { data: userData, refetch: refetchUser } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getUser",
    args: [address],
    enabled: !!address,
    watch: true,
  });

  // Read leaderboard
  const { data: leaderboardData, refetch: refetchLeaderboard } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: CONTRACT_ABI,
    functionName: "getLeaderboard",
    watch: true,
  });

  // Write GM
  const { writeContract, data: txHash, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  useEffect(() => {
    if (isConfirmed) {
      refetchTotal();
      refetchUser();
      refetchLeaderboard();
      setGmFired(false);
    }
  }, [isConfirmed]);

  const myGMs = userData ? Number(userData[0]) : 0;
  const myStreak = userData ? Number(userData[2]) : 0;
  const myReferralCount = userData ? Number(userData[4]) : 0;
  const canGMToday = userData ? userData[5] : true;
  const globalGMs = totalGMs ? Number(totalGMs) : 0;

  // Build leaderboard
  const leaderboard = leaderboardData
    ? leaderboardData[0]
        .map((wallet, i) => ({
          address: wallet,
          gms: Number(leaderboardData[1][i]),
          streak: Number(leaderboardData[2][i]),
        }))
        .sort((a, b) => b.gms - a.gms)
        .slice(0, 10)
    : [];

  const myRank = leaderboard.findIndex(
    (e) => e.address?.toLowerCase() === address?.toLowerCase()
  ) + 1;

  const formatAddress = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";

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

  const spawnParticles = () => {
    const newP = Array.from({ length: 24 }, (_, i) => ({
      id: Date.now() + i,
      style: {
        left: `${40 + Math.random() * 20}%`,
        top: `${40 + Math.random() * 20}%`,
        width: `${4 + Math.random() * 8}px`,
        height: `${4 + Math.random() * 8}px`,
        background: ["#00E5FF", "#7B2FFF", "#FF6B35", "#00FF88", "#FFD700"][Math.floor(Math.random() * 5)],
        borderRadius: "50%",
        position: "absolute",
        pointerEvents: "none",
        animation: `burst 1s ease-out forwards`,
        "--dx": `${(Math.random() - 0.5) * 300}px`,
        "--dy": `${(Math.random() - 0.5) * 300}px`,
        animationDelay: `${Math.random() * 0.2}s`,
        zIndex: 100,
      },
    }));
    setParticles((p) => [...p, ...newP]);
    setTimeout(() => setParticles((p) => p.filter((x) => !newP.find((n) => n.id === x.id))), 1200);
  };

  const handleGM = async () => {
    if (!canGMToday || isPending || isConfirming) return;
    spawnParticles();
    setGmFired(true);
    writeContract({
      address: CONTRACT_ADDRESS,
      abi: CONTRACT_ABI,
      functionName: "gm",
      args: [referrer],
      chainId: arcTestnet.id,
    });
  };

  const handleConnect = async () => {
    connect({ connector: injected() });
  };

  const handleCopyReferral = () => {
    if (myReferralCount >= MAX_REFERRALS) return;
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
    } catch (e) {
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
          33% { transform: translate(30px, -20px) scale(1.05); }
          66% { transform: translate(-20px, 15px) scale(0.97); }
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

        .root {
          min-height: 100vh;
          font-family: 'Space Grotesk', sans-serif;
          background: #0a0014;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .bg-gradient {
          position: absolute; inset: 0;
          background: radial-gradient(ellipse 80% 60% at 50% 30%, #1a0050 0%, #0a0014 60%);
          z-index: 0;
        }
        .orb {
          position: absolute; border-radius: 50%;
          filter: blur(80px); pointer-events: none; z-index: 0;
          animation: orb 8s ease-in-out infinite;
        }
        .orb-1 { width: 500px; height: 500px; background: #7B2FFF22; top: -100px; left: -100px; }
        .orb-2 { width: 400px; height: 400px; background: #00E5FF18; bottom: -80px; right: -80px; animation-delay: -4s; }
        .orb-3 { width: 300px; height: 300px; background: #FF6B3515; top: 40%; left: 30%; animation-delay: -2s; }
        .grid-lines {
          position: absolute; inset: 0; z-index: 0; opacity: 0.06;
          background-image: linear-gradient(rgba(0,229,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.5) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .header {
          position: relative; z-index: 10;
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 32px;
          border-bottom: 1px solid rgba(255,255,255,0.06);
          backdrop-filter: blur(10px);
        }
        .logo { display: flex; align-items: center; gap: 10px; }
        .logo-dot { width: 10px; height: 10px; border-radius: 50%; background: #00E5FF; box-shadow: 0 0 12px #00E5FF; }
        .logo-text { font-family: 'Syne', sans-serif; font-size: 1.2rem; color: #fff; letter-spacing: 0.05em; }
        .wallet-pill {
          background: rgba(123,47,255,0.2); border: 1px solid rgba(123,47,255,0.4);
          color: #b388ff; padding: 8px 16px; border-radius: 20px; font-size: 0.8rem;
          display: flex; align-items: center; gap: 6px; cursor: pointer;
          transition: all 0.2s;
        }
        .wallet-pill:hover { background: rgba(123,47,255,0.35); }
        .wallet-dot { width: 6px; height: 6px; border-radius: 50%; background: #00FF88; box-shadow: 0 0 6px #00FF88; }
        .connect-btn {
          background: linear-gradient(135deg, #7B2FFF, #00E5FF);
          border: none; color: #fff; padding: 10px 24px; border-radius: 20px;
          font-family: 'Space Grotesk', sans-serif; font-size: 0.85rem;
          font-weight: 600; cursor: pointer; transition: opacity 0.2s;
        }
        .connect-btn:hover { opacity: 0.85; }
        .wrong-network-btn {
          background: rgba(255,107,53,0.2); border: 1px solid #FF6B35;
          color: #FF6B35; padding: 8px 16px; border-radius: 20px;
          font-family: 'Space Grotesk', sans-serif; font-size: 0.8rem;
          cursor: pointer;
        }
        .main {
          position: relative; z-index: 5;
          display: grid;
          grid-template-columns: 280px 1fr 320px;
          gap: 24px;
          padding: 28px 32px;
          flex: 1;
          align-items: start;
        }
        .panel {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px; padding: 24px;
          backdrop-filter: blur(20px);
          animation: fadeUp 0.6s ease both;
        }
        .panel-title { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); margin-bottom: 20px; }
        .stat-item { margin-bottom: 24px; }
        .stat-label { font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
        .stat-value {
          font-family: 'Syne', sans-serif; font-size: 2rem; font-weight: 800;
          background: linear-gradient(135deg, #fff 30%, #b388ff);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .stat-value.cyan {
          background: linear-gradient(135deg, #00E5FF, #7B2FFF);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .streak-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(255,107,53,0.15); border: 1px solid rgba(255,107,53,0.3);
          border-radius: 8px; padding: 6px 12px; margin-top: 4px;
          font-size: 0.8rem; color: #FF6B35;
        }
        .rank-badge {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(0,229,255,0.1); border: 1px solid rgba(0,229,255,0.2);
          border-radius: 8px; padding: 6px 12px; margin-top: 8px;
          font-size: 0.8rem; color: #00E5FF;
        }
        .divider { height: 1px; background: rgba(255,255,255,0.06); margin: 20px 0; }
        .ref-bar-wrap { background: rgba(255,255,255,0.05); border-radius: 6px; height: 6px; margin: 10px 0; overflow: hidden; }
        .ref-bar-fill { height: 100%; border-radius: 6px; background: linear-gradient(90deg, #7B2FFF, #00E5FF); transition: width 0.5s ease; }
        .ref-btn {
          width: 100%; padding: 10px; border-radius: 10px;
          border: 1px solid rgba(123,47,255,0.4); background: rgba(123,47,255,0.1);
          color: #b388ff; font-size: 0.8rem; cursor: pointer;
          font-family: 'Space Grotesk', sans-serif; transition: all 0.2s; margin-top: 10px;
        }
        .ref-btn:hover { background: rgba(123,47,255,0.2); }
        .ref-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ref-cap-note { font-size: 0.68rem; color: rgba(255,255,255,0.3); margin-top: 6px; text-align: center; }
        .center-col { display: flex; flex-direction: column; align-items: center; gap: 28px; }
        .gm-count-global { text-align: center; }
        .gm-count-label { font-size: 0.7rem; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 4px; }
        .gm-count-number {
          font-family: 'Syne', sans-serif; font-size: 3rem; font-weight: 800;
          background: linear-gradient(135deg, #00E5FF 0%, #7B2FFF 60%, #FF6B35 100%);
          background-size: 200% auto; -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }
        .gm-btn-wrap { position: relative; display: flex; align-items: center; justify-content: center; }
        .gm-btn {
          width: 180px; height: 180px; border-radius: 50%; border: none; cursor: pointer;
          background: linear-gradient(135deg, #7B2FFF, #00E5FF, #7B2FFF);
          background-size: 200% 200%;
          font-family: 'Syne', sans-serif; font-size: 2.2rem; font-weight: 800; color: #fff;
          letter-spacing: 0.08em;
          animation: pulse 3s ease-in-out infinite, bgShift 4s ease infinite;
          transition: transform 0.15s; position: relative; z-index: 2;
          box-shadow: 0 0 40px #7B2FFF88, 0 0 80px #00E5FF33;
        }
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
        .lb-gms { font-family: 'Syne', sans-serif; font-size: 0.85rem; font-weight: 700; color: #fff; }
        .lb-streak { font-size: 0.65rem; color: #FF6B35; margin-left: 4px; }
        .not-connected {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          min-height: 60vh; gap: 20px; position: relative; z-index: 5;
        }
        .not-connected h2 { font-family: 'Syne', sans-serif; font-size: 2rem; color: #fff; }
        .not-connected p { color: rgba(255,255,255,0.4); font-size: 0.9rem; }
        .particles-wrap { position: fixed; inset: 0; pointer-events: none; z-index: 200; }
        .tx-status {
          font-size: 0.75rem; color: #00FF88; text-align: center;
          animation: float 2s ease-in-out infinite;
        }
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

        {/* Header */}
        <div className="header">
          <div className="logo">
            <div className="logo-dot" />
            <span className="logo-text">GM · ARC NETWORK</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}><div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>TESTNET</div><a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" style={{ fontSize: "0.75rem", color: "#00E5FF", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, background: "rgba(0,229,255,0.08)", border: "1px solid rgba(0,229,255,0.2)", padding: "4px 10px", borderRadius: 20 }}>🚰 Get test USDC</a></div>
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
              Connect MetaMask
            </button>
          </div>
        ) : (
          <div className="main">
            {/* LEFT */}
            <div className="panel">
              <div className="panel-title">Your Stats</div>
              <div className="stat-item">
                <div className="stat-label">Your GMs</div>
                <AnimatedCounter value={myGMs} className="stat-value cyan" />
                {myStreak > 0 && <div><span className="streak-badge">🔥 {myStreak} day streak</span></div>}
                {myRank > 0 && <div><span className="rank-badge">🏆 Rank #{myRank}</span></div>}
              </div>
              <div className="divider" />
              <div className="stat-item">
                <div className="stat-label">Global GMs</div>
                <AnimatedCounter value={globalGMs} className="stat-value" />
              </div>
              <div className="divider" />
              <div>
                <div className="stat-label" style={{ marginBottom: 8 }}>Referrals</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                  <span>{myReferralCount} / {MAX_REFERRALS} used</span>
                  <span style={{ color: myReferralCount >= MAX_REFERRALS ? "#FF6B35" : "#00FF88" }}>
                    {myReferralCount >= MAX_REFERRALS ? "Capped" : `${MAX_REFERRALS - myReferralCount} left`}
                  </span>
                </div>
                <div className="ref-bar-wrap">
                  <div className="ref-bar-fill" style={{ width: `${(myReferralCount / MAX_REFERRALS) * 100}%` }} />
                </div>
                <button className="ref-btn" onClick={handleCopyReferral} disabled={myReferralCount >= MAX_REFERRALS}>
                  {copied ? "✓ Copied!" : "📋 Copy Referral Link"}
                </button>
                <div className="ref-cap-note">Max {MAX_REFERRALS} referrals · Fair for all</div>
              </div>
            </div>

            {/* CENTER */}
            <div className="center-col">
              <div className="gm-count-global">
                <div className="gm-count-label">Global GM Count</div>
                <AnimatedCounter value={globalGMs} className="gm-count-number" />
              </div>
              <div className="gm-btn-wrap">
                <div className="gm-ring gm-ring-1" />
                <div className="gm-ring gm-ring-2" />
                <div className="gm-ring gm-ring-3" />
                <button
                  className={`gm-btn${gmFired ? " fired" : ""}`}
                  onClick={handleGM}
                  disabled={!canGMToday || isPending || isConfirming}
                >
                  {isPending ? "..." : isConfirming ? "⏳" : "GM"}
                </button>
              </div>

              {(isPending || isConfirming) && (
                <div className="tx-status">
                  {isPending ? "⏳ Confirm in MetaMask..." : "⛓ Confirming on chain..."}
                </div>
              )}

              {!canGMToday ? (
                <div className="countdown">
                  <div className="countdown-label">Resets at UTC 00:00 in</div>
                  <div className="countdown-time">{formatCountdown(countdown)}</div>
                </div>
              ) : (
                <div className="gm-ready">✦ Tap to say GM ✦</div>
              )}

              <div style={{ textAlign: "center", fontSize: "0.7rem", color: "rgba(255,255,255,0.2)", lineHeight: 1.6, maxWidth: 300 }}>
                One GM per wallet per UTC day.<br />Resets at 00:00 UTC for everyone.
              </div>
            </div>

            {/* RIGHT */}
            <div className="panel">
              <div className="tabs">
                <button className={`tab-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>Leaderboard</button>
                <button className={`tab-btn${tab === "activity" ? " active" : ""}`} onClick={() => setTab("activity")}>Activity</button>
              </div>

              {tab === "leaderboard" && (
                <div className="leaderboard-list">
                  {leaderboard.length === 0 ? (
                    <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", padding: "20px 0" }}>
                      No GMs yet. Be the first! 🌅
                    </div>
                  ) : (
                    leaderboard.map((entry, i) => (
                      <div key={entry.address} className={`lb-row${entry.address?.toLowerCase() === address?.toLowerCase() ? " me" : ""}`}>
                        <div className={`lb-rank${i === 0 ? " gold" : i === 1 ? " silver" : i === 2 ? " bronze" : ""}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </div>
                        <div className="lb-addr">
                          {formatAddress(entry.address)}
                          {entry.address?.toLowerCase() === address?.toLowerCase() && (
                            <span style={{ color: "#00E5FF", marginLeft: 4, fontSize: "0.65rem" }}>(you)</span>
                          )}
                        </div>
                        <div>
                          <div className="lb-gms">{entry.gms}</div>
                          <div className="lb-streak">🔥{entry.streak}d</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {tab === "activity" && (
                <div style={{ textAlign: "center", color: "rgba(255,255,255,0.3)", fontSize: "0.8rem", padding: "20px 0" }}>
                  Activity feed coming soon
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