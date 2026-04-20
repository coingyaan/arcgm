import { useState, useEffect, useRef } from "react";

const MOCK_LEADERBOARD = [
  { address: "0xA1b2...3c4D", gms: 312, streak: 18, referrals: 5 },
  { address: "0xF9e8...7d6C", gms: 287, streak: 14, referrals: 5 },
  { address: "0x2B3a...1E0F", gms: 241, streak: 11, referrals: 4 },
  { address: "0x7C8D...9b0A", gms: 198, streak: 9, referrals: 3 },
  { address: "0x4E5F...6a7B", gms: 176, streak: 7, referrals: 5 },
  { address: "0x1D2E...3F4G", gms: 143, streak: 5, referrals: 2 },
  { address: "0x9A0B...1C2D", gms: 121, streak: 4, referrals: 1 },
  { address: "0x3E4F...5G6H", gms: 98, streak: 3, referrals: 0 },
];

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

  return <span className={className}>{display.toLocaleString()}</span>;
}

function Particle({ style }) {
  return <div style={style} className="particle" />;
}

export default function ArcGM() {
  const [globalGMs, setGlobalGMs] = useState(8_432_119);
  const [myGMs, setMyGMs] = useState(44);
  const [streak, setStreak] = useState(6);
  const [cooldown, setCooldown] = useState(null); // seconds until UTC midnight
  const [gmFired, setGmFired] = useState(false);
  const [particles, setParticles] = useState([]);
  const [leaderboard, setLeaderboard] = useState(MOCK_LEADERBOARD);
  const [referralCount, setReferralCount] = useState(2);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState("leaderboard");
  const myAddress = "0x81b2...0870";

  // Seconds remaining until next UTC midnight
  const getSecsToUTCMidnight = () => {
    const now = new Date();
    const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
    return Math.floor((midnight - now) / 1000);
  };

  // Countdown ticks every second; auto-clears when UTC day flips
  useEffect(() => {
    if (cooldown === null) return;
    if (cooldown <= 0) { setCooldown(null); return; }
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Ambient global counter drift
  useEffect(() => {
    const interval = setInterval(() => {
      setGlobalGMs(g => g + Math.floor(Math.random() * 3 + 1));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const formatCountdown = (s) => {
    if (!s) return null;
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
      }
    }));
    setParticles(p => [...p, ...newP]);
    setTimeout(() => setParticles(p => p.filter(x => !newP.find(n => n.id === x.id))), 1200);
  };

  const handleGM = () => {
    if (cooldown) return;
    setGmFired(true);
    spawnParticles();
    setMyGMs(g => g + 1);
    setGlobalGMs(g => g + 1);
    setStreak(s => s + 1);
    setCooldown(getSecsToUTCMidnight());
    setLeaderboard(prev => {
      const myEntry = { address: myAddress, gms: myGMs + 1, streak: streak + 1, referrals: referralCount };
      const filtered = prev.filter(e => e.address !== myAddress);
      return [...filtered, myEntry].sort((a, b) => b.gms - a.gms).slice(0, 10);
    });
    setTimeout(() => setGmFired(false), 800);
  };

  const handleCopyReferral = () => {
    if (referralCount >= MAX_REFERRALS) return;
    navigator.clipboard?.writeText(`https://gm.arcnetwork.xyz?ref=${myAddress}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const myRank = leaderboard.findIndex(e => e.address === myAddress) + 1;

  return (
    <>
      <style>{`
        
        * { box-sizing: border-box; margin: 0; padding: 0; }
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
          background-image:
            linear-gradient(rgba(0,229,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,229,255,0.5) 1px, transparent 1px);
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
        .logo-dot {
          width: 10px; height: 10px; border-radius: 50%;
          background: #00E5FF;
          box-shadow: 0 0 12px #00E5FF;
        }
        .logo-text { font-family: 'Syne', sans-serif; font-size: 1.2rem; color: #fff; letter-spacing: 0.05em; }
        .wallet-pill {
          background: rgba(123,47,255,0.2); border: 1px solid rgba(123,47,255,0.4);
          color: #b388ff; padding: 6px 14px; border-radius: 20px; font-size: 0.8rem;
          display: flex; align-items: center; gap: 6px;
        }
        .wallet-dot { width: 6px; height: 6px; border-radius: 50%; background: #00FF88; box-shadow: 0 0 6px #00FF88; }

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
          border-radius: 20px;
          padding: 24px;
          backdrop-filter: blur(20px);
          animation: fadeUp 0.6s ease both;
        }
        .panel-title {
          font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.15em;
          color: rgba(255,255,255,0.35); margin-bottom: 20px;
        }

        /* LEFT PANEL */
        .stat-item { margin-bottom: 24px; }
        .stat-label { font-size: 0.72rem; color: rgba(255,255,255,0.4); margin-bottom: 4px; }
        .stat-value {
          font-family: 'Syne', sans-serif;
          font-size: 2rem; font-weight: 800;
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

        .referral-section {}
        .ref-bar-wrap {
          background: rgba(255,255,255,0.05); border-radius: 6px; height: 6px;
          margin: 10px 0;
          overflow: hidden;
        }
        .ref-bar-fill {
          height: 100%; border-radius: 6px;
          background: linear-gradient(90deg, #7B2FFF, #00E5FF);
          transition: width 0.5s ease;
        }
        .ref-btn {
          width: 100%; padding: 10px;
          border-radius: 10px; border: 1px solid rgba(123,47,255,0.4);
          background: rgba(123,47,255,0.1);
          color: #b388ff; font-size: 0.8rem; cursor: pointer;
          font-family: 'Space Grotesk', sans-serif;
          transition: all 0.2s;
          margin-top: 10px;
        }
        .ref-btn:hover { background: rgba(123,47,255,0.2); border-color: #7B2FFF; }
        .ref-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .ref-cap-note { font-size: 0.68rem; color: rgba(255,255,255,0.3); margin-top: 6px; text-align: center; }

        /* CENTER */
        .center-col {
          display: flex; flex-direction: column; align-items: center;
          gap: 28px;
        }
        .gm-count-global {
          text-align: center;
        }
        .gm-count-label { font-size: 0.7rem; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 4px; }
        .gm-count-number {
          font-family: 'Syne', sans-serif; font-size: 3rem; font-weight: 800;
          background: linear-gradient(135deg, #00E5FF 0%, #7B2FFF 60%, #FF6B35 100%);
          background-size: 200% auto;
          -webkit-background-clip: text; -webkit-text-fill-color: transparent;
          animation: shimmer 3s linear infinite;
        }

        .gm-btn-wrap {
          position: relative;
          display: flex; align-items: center; justify-content: center;
        }
        .gm-btn {
          width: 180px; height: 180px; border-radius: 50%;
          border: none; cursor: pointer;
          background: linear-gradient(135deg, #7B2FFF, #00E5FF, #7B2FFF);
          background-size: 200% 200%;
          font-family: 'Syne', sans-serif;
          font-size: 2.2rem; font-weight: 800;
          color: #fff;
          letter-spacing: 0.08em;
          animation: pulse 3s ease-in-out infinite, bgShift 4s ease infinite;
          transition: transform 0.15s;
          position: relative; z-index: 2;
          box-shadow: 0 0 40px #7B2FFF88, 0 0 80px #00E5FF33;
        }
        .gm-btn:hover:not(:disabled) { transform: scale(1.06); }
        .gm-btn:disabled {
          background: linear-gradient(135deg, #2a1a4a, #1a2a3a);
          animation: none;
          box-shadow: none;
          cursor: not-allowed;
          opacity: 0.6;
        }
        .gm-btn.fired { animation: gmBounce 0.5s ease, pulse 3s ease-in-out 0.5s infinite, bgShift 4s ease infinite; }
        .gm-ring {
          position: absolute; border-radius: 50%;
          border: 2px solid rgba(0,229,255,0.3);
          animation: pulse 2s ease-in-out infinite;
          pointer-events: none;
        }
        .gm-ring-1 { width: 210px; height: 210px; animation-delay: 0s; }
        .gm-ring-2 { width: 240px; height: 240px; animation-delay: 0.4s; opacity: 0.5; }
        .gm-ring-3 { width: 270px; height: 270px; animation-delay: 0.8s; opacity: 0.25; }

        .countdown {
          text-align: center;
          background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px; padding: 14px 28px;
          animation: float 4s ease-in-out infinite;
        }
        .countdown-label { font-size: 0.65rem; letter-spacing: 0.15em; color: rgba(255,255,255,0.35); text-transform: uppercase; margin-bottom: 4px; }
        .countdown-time {
          font-family: 'Syne', sans-serif; font-size: 1.6rem; font-weight: 700;
          color: #00E5FF;
          text-shadow: 0 0 20px #00E5FF88;
        }
        .gm-ready {
          font-family: 'Syne', sans-serif; font-size: 1rem; color: #00FF88;
          text-shadow: 0 0 12px #00FF8888;
          animation: float 3s ease-in-out infinite;
        }

        /* RIGHT PANEL */
        .tabs { display: flex; gap: 4px; margin-bottom: 16px; background: rgba(255,255,255,0.04); border-radius: 10px; padding: 4px; }
        .tab-btn {
          flex: 1; padding: 6px; border: none; border-radius: 8px;
          background: transparent; color: rgba(255,255,255,0.4);
          font-family: 'Space Grotesk', sans-serif; font-size: 0.75rem; cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn.active { background: rgba(123,47,255,0.3); color: #fff; }

        .leaderboard-list { display: flex; flex-direction: column; gap: 8px; }
        .lb-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05);
          transition: border-color 0.2s;
        }
        .lb-row:hover { border-color: rgba(123,47,255,0.3); }
        .lb-row.me { border-color: rgba(0,229,255,0.3); background: rgba(0,229,255,0.04); }
        .lb-rank {
          font-family: 'Syne', sans-serif; font-size: 0.8rem; font-weight: 700;
          min-width: 22px;
          color: rgba(255,255,255,0.3);
        }
        .lb-rank.gold { color: #FFD700; }
        .lb-rank.silver { color: #C0C0C0; }
        .lb-rank.bronze { color: #CD7F32; }
        .lb-addr { flex: 1; font-size: 0.72rem; color: rgba(255,255,255,0.6); font-family: monospace; }
        .lb-gms {
          font-family: 'Syne', sans-serif; font-size: 0.85rem; font-weight: 700;
          color: #fff;
        }
        .lb-streak { font-size: 0.65rem; color: #FF6B35; margin-left: 4px; }

        .particle { position: absolute; }
        .particles-wrap { position: fixed; inset: 0; pointer-events: none; z-index: 200; }

        @media (max-width: 900px) {
          .main { grid-template-columns: 1fr; }
        }
      `}</style>

      <div className="root">
        <div className="bg-gradient" />
        <div className="orb orb-1" />
        <div className="orb orb-2" />
        <div className="orb orb-3" />
        <div className="grid-lines" />

        {/* Particles */}
        <div className="particles-wrap">
          {particles.map(p => <div key={p.id} style={p.style} />)}
        </div>

        {/* Header */}
        <div className="header">
          <div className="logo">
            <div className="logo-dot" />
            <span className="logo-text">GM · ARC NETWORK</span>
          </div>
          <div style={{ fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", letterSpacing: "0.1em" }}>
            TESTNET
          </div>
          <div className="wallet-pill">
            <div className="wallet-dot" />
            {myAddress}
          </div>
        </div>

        {/* Main Grid */}
        <div className="main">

          {/* LEFT */}
          <div className="panel" style={{ animationDelay: "0.1s" }}>
            <div className="panel-title">Your Stats</div>

            <div className="stat-item">
              <div className="stat-label">Your GMs</div>
              <AnimatedCounter value={myGMs} className="stat-value cyan" />
              <div>
                <span className="streak-badge">🔥 {streak} day streak</span>
              </div>
              {myRank > 0 && (
                <div><span className="rank-badge">🏆 Rank #{myRank}</span></div>
              )}
            </div>

            <div className="divider" />

            <div className="stat-item">
              <div className="stat-label">Global GMs Today</div>
              <AnimatedCounter value={globalGMs} className="stat-value" />
            </div>

            <div className="divider" />

            <div className="referral-section">
              <div className="stat-label" style={{ marginBottom: 8 }}>Referrals</div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "rgba(255,255,255,0.5)" }}>
                <span>{referralCount} / {MAX_REFERRALS} used</span>
                <span style={{ color: referralCount >= MAX_REFERRALS ? "#FF6B35" : "#00FF88" }}>
                  {referralCount >= MAX_REFERRALS ? "Capped" : `${MAX_REFERRALS - referralCount} left`}
                </span>
              </div>
              <div className="ref-bar-wrap">
                <div className="ref-bar-fill" style={{ width: `${(referralCount / MAX_REFERRALS) * 100}%` }} />
              </div>
              <button
                className="ref-btn"
                onClick={handleCopyReferral}
                disabled={referralCount >= MAX_REFERRALS}
              >
                {copied ? "✓ Copied!" : "📋 Copy Referral Link"}
              </button>
              <div className="ref-cap-note">Max {MAX_REFERRALS} referrals per wallet · Fair for all</div>
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
                disabled={!!cooldown}
              >
                GM
              </button>
            </div>

            {cooldown ? (
              <div className="countdown">
                <div className="countdown-label">Resets at UTC 00:00 in</div>
                <div className="countdown-time">{formatCountdown(cooldown)}</div>
              </div>
            ) : (
              <div className="gm-ready">✦ Tap to say GM ✦</div>
            )}

            <div style={{
              textAlign: "center", fontSize: "0.7rem",
              color: "rgba(255,255,255,0.2)", lineHeight: 1.6,
              maxWidth: 300
            }}>
              One GM per wallet per UTC day.<br />
              Resets at 00:00 UTC for everyone.
            </div>
          </div>

          {/* RIGHT */}
          <div className="panel" style={{ animationDelay: "0.2s" }}>
            <div className="tabs">
              <button className={`tab-btn${tab === "leaderboard" ? " active" : ""}`} onClick={() => setTab("leaderboard")}>
                Leaderboard
              </button>
              <button className={`tab-btn${tab === "activity" ? " active" : ""}`} onClick={() => setTab("activity")}>
                Activity
              </button>
            </div>

            {tab === "leaderboard" && (
              <div className="leaderboard-list">
                {leaderboard.map((entry, i) => (
                  <div key={entry.address} className={`lb-row${entry.address === myAddress ? " me" : ""}`}>
                    <div className={`lb-rank${i === 0 ? " gold" : i === 1 ? " silver" : i === 2 ? " bronze" : ""}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </div>
                    <div className="lb-addr">
                      {entry.address}
                      {entry.address === myAddress && (
                        <span style={{ color: "#00E5FF", marginLeft: 4, fontSize: "0.65rem" }}>(you)</span>
                      )}
                    </div>
                    <div>
                      <div className="lb-gms">{entry.gms}</div>
                      <div className="lb-streak">🔥{entry.streak}d</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === "activity" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { addr: "0xF9e8...7d6C", action: "Said GM", time: "2m ago" },
                  { addr: "0x2B3a...1E0F", action: "Said GM", time: "4m ago" },
                  { addr: "0x7C8D...9b0A", action: "Said GM", time: "7m ago" },
                  { addr: "0x4E5F...6a7B", action: "Joined via referral", time: "12m ago" },
                  { addr: "0x1D2E...3F4G", action: "Said GM", time: "18m ago" },
                  { addr: "0x9A0B...1C2D", action: "Said GM", time: "23m ago" },
                  { addr: "0xA1b2...3c4D", action: "Said GM", time: "31m ago" },
                  { addr: "0x3E4F...5G6H", action: "Said GM", time: "45m ago" },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "9px 12px", borderRadius: 10,
                    background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)"
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: `hsl(${i * 47}, 60%, 40%)`,
                      flexShrink: 0
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.72rem", color: "rgba(255,255,255,0.6)", fontFamily: "monospace" }}>{item.addr}</div>
                      <div style={{ fontSize: "0.68rem", color: item.action.includes("referral") ? "#00E5FF" : "#00FF88" }}>{item.action}</div>
                    </div>
                    <div style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.25)" }}>{item.time}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={{
              marginTop: 16, padding: "12px",
              background: "rgba(0,229,255,0.05)", border: "1px dashed rgba(0,229,255,0.15)",
              borderRadius: 12, textAlign: "center"
            }}>
              <div style={{ fontSize: "0.65rem", color: "rgba(0,229,255,0.5)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Coming Soon
              </div>
              <div style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.4)", marginTop: 4 }}>
                Bridge USDC → ARC Testnet
              </div>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
