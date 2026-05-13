import { useState, useEffect, useRef, useCallback } from "react";
import {
  useAccount, useConnect, useDisconnect,
  useReadContract, useWriteContract, useWaitForTransactionReceipt,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { parseUnits, formatUnits } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI, arcTestnet } from "./config.js";

// ── HELPERS ──
const fmt  = (addr) => addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : "";
const fmtPts  = (n) => (Number(n) / 1e18).toFixed(1);
const fmtUsdc = (n) => (Number(n) / 1e6).toFixed(2);
const fmtPrice = (n) => {
  const p = Number(n) / 1e18;
  return "$" + p.toLocaleString("en-US", { minimumFractionDigits:2, maximumFractionDigits:2 });
};
const fmtPriceDiff = (cur, snap) => {
  if (!cur || !snap) return null;
  const diff = Number(cur) - Number(snap);
  const pct  = (diff / Number(snap)) * 100;
  return { diff, pct, up: diff >= 0 };
};
const getMultText = (m) => {
  const n = Number(m);
  if (n >= 200) return "2x";
  if (n >= 150) return "1.5x";
  if (n >= 120) return "1.2x";
  return "1x";
};

function useCountdown(target) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.floor((target - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [target]);
  return secs;
}

function CountdownBoxes({ targetMs }) {
  const secs = useCountdown(targetMs);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      {[["hours",h],["mins",m],["secs",s]].map(([unit,val],i) => (
        <div key={unit} style={{ display:"flex", alignItems:"center", gap:6 }}>
          {i>0 && <span style={{ color:"#3D4F68", fontFamily:"DM Mono,monospace", fontSize:"1.3rem", opacity:0.6 }}>:</span>}
          <div style={{ background:"#111722", border:"1px solid #1A2235", borderRadius:8, padding:"8px 14px", textAlign:"center", minWidth:58 }}>
            <div style={{ fontFamily:"DM Mono,monospace", fontSize:"1.4rem", fontWeight:500, color:"#DDE4F0", lineHeight:1 }}>{String(val).padStart(2,"0")}</div>
            <div style={{ fontSize:"0.55rem", textTransform:"uppercase", letterSpacing:"0.1em", color:"#3D4F68", marginTop:3 }}>{unit}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TradingViewChart({ interval, setInterval: setTF }) {
  const ref = useRef(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.innerHTML = "";
    const s = document.createElement("script");
    s.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.async = true;
    s.innerHTML = JSON.stringify({
      autosize: true,
      symbol: "BINANCE:BTCUSDT",
      interval,
      timezone: "Etc/UTC",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(13,17,25,1)",
      gridColor: "rgba(26,34,53,0.5)",
      hide_side_toolbar: true,
      allow_symbol_change: false,
      save_image: false,
      hide_volume: true,
      support_host: "https://www.tradingview.com",
    });
    ref.current.appendChild(s);
  }, [interval, key]);

  const tfs = [["1","1m"],["5","5m"],["15","15m"],["60","1h"],["240","4h"],["D","1D"]];

  return (
    <div style={{ background:"#0D1119", border:"1px solid #1A2235", borderRadius:14, overflow:"hidden" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", borderBottom:"1px solid #1A2235" }}>
        <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:"0.78rem", fontWeight:600, color:"#DDE4F0" }}>
          <div style={{ width:18, height:18, borderRadius:"50%", background:"#F7931A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.6rem", fontWeight:800, color:"#fff" }}>₿</div>
          BTC / USD
        </div>
        <div style={{ display:"flex", gap:3 }}>
          {tfs.map(([val,label]) => (
            <button key={val} onClick={() => setTF(val)}
              style={{ padding:"3px 9px", border:"none", borderRadius:5, background: interval===val ? "#1A2235" : "transparent", color: interval===val ? "#DDE4F0" : "#3D4F68", fontSize:"0.68rem", cursor:"pointer", fontFamily:"Outfit,sans-serif" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ height:280 }}>
        <div className="tradingview-widget-container" ref={ref} style={{ height:"100%", width:"100%" }} />
      </div>
    </div>
  );
}

function ShareModal({ position, onClose }) {
  const [theme, setTheme] = useState(0);
  const [hideWallet, setHideWallet] = useState(false);
  const themes = [
    { bg:"linear-gradient(135deg,#0a0f1a,#0d1525)", border:"#1A2235", accent:"#00D4FF", label:"Dark Minimal" },
    { bg:"linear-gradient(135deg,#001a2e,#003d5c)", border:"#004d7a", accent:"#00D4FF", label:"Arc Blue" },
    { bg:"linear-gradient(135deg,#1a0800,#2d1200)", border:"#3d2000", accent:"#F7931A", label:"BTC Orange" },
  ];
  const t = themes[theme];

  const shareToX = () => {
    const dir = position.isUp ? "▲ UP" : "▼ DOWN";
    const status = position.winning ? "currently winning" : "in open position";
    const text = `I predicted BTC ${dir} on ArcGM 🎯\n${status} · ${position.streak}d GM streak · ${getMultText(position.mult)} multiplier\narcgm.vercel.app\n#ArcGM #ArcNetwork #Predict`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(8px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"#0D1119", border:"1px solid #1A2235", borderRadius:18, padding:28, width:640, maxWidth:"95vw", position:"relative" }}>
        <button onClick={onClose} style={{ position:"absolute", top:14, right:14, background:"rgba(255,255,255,0.06)", border:"none", color:"rgba(255,255,255,0.5)", width:30, height:30, borderRadius:"50%", cursor:"pointer", fontSize:"1rem" }}>×</button>
        <div style={{ fontSize:"1rem", fontWeight:700, color:"#DDE4F0", marginBottom:4 }}>Share your position</div>
        <div style={{ fontSize:"0.7rem", color:"#3D4F68", marginBottom:18 }}>Choose a theme and share on X</div>

        {/* Theme picker */}
        <div style={{ fontSize:"0.6rem", textTransform:"uppercase", letterSpacing:"0.15em", color:"#3D4F68", marginBottom:8 }}>Theme</div>
        <div style={{ display:"flex", gap:8, marginBottom:18 }}>
          {themes.map((th,i) => (
            <div key={i} onClick={() => setTheme(i)} style={{ cursor:"pointer", borderRadius:8, width:100, height:64, background:th.bg, border:`2px solid ${i===theme ? th.accent : "#1A2235"}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.62rem", color:th.accent, transition:"border-color 0.2s" }}>
              {th.label}
            </div>
          ))}
        </div>

        {/* Card preview */}
        <div style={{ borderRadius:12, padding:20, background:t.bg, border:`1px solid ${t.border}`, position:"relative", overflow:"hidden", marginBottom:14 }}>
          <div style={{ position:"absolute", top:0, left:0, right:0, height:2, background:`linear-gradient(90deg,transparent,${t.accent},transparent)` }} />
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
              <div style={{ width:26, height:26, borderRadius:6, background:"linear-gradient(135deg,#003D5C,#00D4FF)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.58rem", fontWeight:800, color:"#fff" }}>GM</div>
              <div style={{ fontSize:"0.82rem", fontWeight:700, color:"#DDE4F0" }}>Arc<span style={{ color:t.accent }}>GM</span></div>
            </div>
            <div style={{ fontSize:"0.58rem", color:"#3D4F68" }}>arcgm.vercel.app</div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
            <div style={{ width:36, height:36, borderRadius:"50%", background:"#F7931A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1rem", fontWeight:800, color:"#fff" }}>₿</div>
            <div>
              <div style={{ fontSize:"0.7rem", color:"#8A9BB0" }}>I predicted</div>
              <div style={{ fontSize:"0.95rem", fontWeight:700, color:"#DDE4F0" }}>BTC <span style={{ color: position.isUp ? "#00E87A" : "#FF4561" }}>{position.isUp ? "▲ UP" : "▼ DOWN"}</span></div>
            </div>
          </div>
          <div style={{ display:"flex", gap:16, padding:"10px 12px", background:"rgba(255,255,255,0.03)", borderRadius:8, marginBottom:12 }}>
            <div><div style={{ fontSize:"0.55rem", color:"#3D4F68", marginBottom:2 }}>Snapshot</div><div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.75rem", color:"#DDE4F0" }}>{fmtPrice(position.snapshot)}</div></div>
            <div><div style={{ fontSize:"0.55rem", color:"#3D4F68", marginBottom:2 }}>Current</div><div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.75rem", color: position.winning ? "#00E87A" : "#FF4561" }}>{fmtPrice(position.current)}</div></div>
            <div><div style={{ fontSize:"0.55rem", color:"#3D4F68", marginBottom:2 }}>GM Streak</div><div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.75rem", color:"#FFB800" }}>🔥 {position.streak}d · {getMultText(position.mult)}</div></div>
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            {!hideWallet && <div style={{ fontSize:"0.62rem", color:"#3D4F68", fontFamily:"DM Mono,monospace" }}>{position.wallet}</div>}
            <div style={{ fontSize:"0.6rem", color:"#3D4F68", marginLeft:"auto" }}>#ArcGM #ArcNetwork</div>
          </div>
        </div>

        {/* Settings */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"10px 14px", background:"rgba(255,255,255,0.03)", borderRadius:8, marginBottom:14 }}>
          <span style={{ fontSize:"0.75rem", color:"#8A9BB0" }}>Hide wallet address</span>
          <div onClick={() => setHideWallet(!hideWallet)}
            style={{ width:36, height:20, background: hideWallet ? "#00D4FF" : "#1A2235", borderRadius:10, cursor:"pointer", position:"relative", transition:"background 0.2s" }}>
            <div style={{ width:16, height:16, background: hideWallet ? "#fff" : "#3D4F68", borderRadius:"50%", position:"absolute", top:2, left: hideWallet ? 18 : 2, transition:"left 0.2s" }} />
          </div>
        </div>

        <div style={{ display:"flex", gap:10 }}>
          <button onClick={shareToX} style={{ flex:1, padding:12, borderRadius:10, border:"none", background:"#DDE4F0", color:"#07090F", fontSize:"0.85rem", fontWeight:700, cursor:"pointer", fontFamily:"Outfit,sans-serif" }}>𝕏 Share on X</button>
          <button onClick={onClose} style={{ flex:1, padding:12, borderRadius:10, border:"1px solid #1A2235", background:"rgba(255,255,255,0.04)", color:"#DDE4F0", fontSize:"0.85rem", fontWeight:600, cursor:"pointer", fontFamily:"Outfit,sans-serif" }}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ArcGM() {
  const { address, isConnected, chain } = useAccount();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const [tab, setTab] = useState("predict");
  const [chartInterval, setChartInterval] = useState("5");
  const [roundType, setRoundType] = useState(0); // 0=4h, 1=24h
  const [entryAmount, setEntryAmount] = useState("5");
  const [sharePos, setSharePos] = useState(null);
  const [particles, setParticles] = useState([]);
  const [gmFired, setGmFired] = useState(false);

  const isWrongNetwork = isConnected && chain?.id !== arcTestnet.id;

  // ── READS ──
  const { data: globalGMs, refetch: rgGMs } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getTotalGlobalGMs" });
  const { data: btcPrice, refetch: rPrice } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getCurrentPrice", args:[0] });
  const { data: round4hId } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"get4hRoundId", args:[0] });
  const { data: round24hId } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"get24hRoundId", args:[0] });
  const currentRoundId = roundType === 0 ? round4hId : round24hId;

  const { data: roundInfo, refetch: rRound } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getRoundInfo", args:[currentRoundId], enabled:!!currentRoundId });
  const { data: roundPool, refetch: rPool } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getRoundPool", args:[currentRoundId], enabled:!!currentRoundId });
  const { data: userMain, refetch: rUser } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getUserMain", args:[address], enabled:!!address });
  const { data: userStreak, refetch: rStreak } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getUserStreak", args:[address], enabled:!!address });
  const { data: userMult } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getMultiplier", args:[address], enabled:!!address });
  const { data: userEntry, refetch: rEntry } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getUserEntry", args:[currentRoundId, address], enabled:!!currentRoundId && !!address });
  const { data: lbPage } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getLeaderboardPage", args:[0n, 50n] });
  const { data: lbStats } = useReadContract({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"getLeaderboardStats", args:[0n, 50n] });
  const { data: usdcBalance } = useReadContract({ address:USDC_ADDRESS, abi:USDC_ABI, functionName:"balanceOf", args:[address], enabled:!!address });
  const { data: usdcAllowance, refetch: rAllow } = useReadContract({ address:USDC_ADDRESS, abi:USDC_ABI, functionName:"allowance", args:[address, CONTRACT_ADDRESS], enabled:!!address });

  // ── WRITES ──
  const { writeContract: writeGM, data: gmHash, isPending: gmPending } = useWriteContract();
  const { isLoading: gmConfirming, isSuccess: gmDone } = useWaitForTransactionReceipt({ hash: gmHash });
  const { writeContract: writeRestore, data: restoreHash, isPending: restorePending } = useWriteContract();
  const { isLoading: restoreConfirming, isSuccess: restoreDone } = useWaitForTransactionReceipt({ hash: restoreHash });
  const { writeContract: writeApprove, data: approveHash, isPending: approvePending } = useWriteContract();
  const { isLoading: approveConfirming, isSuccess: approveDone } = useWaitForTransactionReceipt({ hash: approveHash });
  const { writeContract: writePredict, data: predictHash, isPending: predictPending } = useWriteContract();
  const { isLoading: predictConfirming, isSuccess: predictDone } = useWaitForTransactionReceipt({ hash: predictHash });
  const { writeContract: writeClaim, data: claimHash, isPending: claimPending } = useWriteContract();
  const { isLoading: claimConfirming, isSuccess: claimDone } = useWaitForTransactionReceipt({ hash: claimHash });
  const { writeContract: writeFinalize } = useWriteContract();

  const refetchAll = useCallback(() => {
    rgGMs(); rPrice(); rRound(); rPool(); rUser(); rStreak(); rEntry(); rAllow();
  }, []);

  useEffect(() => { if (gmDone || restoreDone || predictDone || claimDone || approveDone) refetchAll(); }, [gmDone, restoreDone, predictDone, claimDone, approveDone]);

  // auto-refresh price every 30s
  useEffect(() => { const id = setInterval(rPrice, 30000); return () => clearInterval(id); }, []);

  // ── PARSE DATA ──
  const totalPts    = userMain ? fmtPts(userMain[0]) : "0.0";
  const myGMs       = userMain ? Number(userMain[1]) : 0;
  const myStreak    = userMain ? Number(userMain[2]) : 0;
  const canGMToday  = userMain ? userMain[3] : true;
  const longestStreak = userStreak ? Number(userStreak[1]) : 0;
  const canRestore  = userStreak ? userStreak[3] : false;
  const restoreCost = userStreak ? fmtPts(userStreak[4]) : "0";
  const multVal     = userMult ? Number(userMult) : 100;
  const multText    = getMultText(multVal);
  const globalGMsNum = globalGMs ? Number(globalGMs) : 0;

  const snapshotPrice = roundInfo ? roundInfo[4] : null;
  const currentPrice  = btcPrice || null;
  const priceDiff     = fmtPriceDiff(currentPrice, snapshotPrice);
  const roundEndTime  = roundInfo ? Number(roundInfo[3]) * 1000 : 0;
  const roundStarted  = roundInfo && roundInfo[2] > 0n;
  const roundFinalized = roundInfo ? roundInfo[7] : false;

  const totalUp   = roundPool ? Number(roundPool[0]) / 1e6 : 0;
  const totalDown = roundPool ? Number(roundPool[1]) / 1e6 : 0;
  const totalPool = totalUp + totalDown;
  const upPct     = totalPool > 0 ? Math.round((totalUp / totalPool) * 100) : 50;
  const downPct   = 100 - upPct;

  const hasEntry        = userEntry && Number(userEntry[0]) > 0;
  const entryIsUp       = userEntry ? userEntry[1] : false;
  const entryClaimed    = userEntry ? userEntry[2] : false;
  const entryWinning    = userEntry ? userEntry[3] : false;
  const entryAmt        = userEntry ? fmtUsdc(userEntry[0]) : "0";
  const estimatedPayout = userEntry ? fmtUsdc(userEntry[4]) : "0";

  const needsApproval = usdcAllowance !== undefined && Number(usdcAllowance) < Number(parseUnits(entryAmount || "1", 6));
  const usdcBal = usdcBalance ? fmtUsdc(usdcBalance) : "0";

  // leaderboard
  const leaderboard = (lbPage && lbStats)
    ? lbPage[0].map((w, i) => ({
        address: w,
        points: Number(lbPage[1][i]) / 1e18,
        streak: Number(lbStats[0][i]),
        gms: Number(lbStats[1][i]),
        mult: Number(lbStats[2][i]),
      })).sort((a,b) => b.points - a.points).slice(0, 10)
    : [];

  const myRank = leaderboard.findIndex(e => e.address?.toLowerCase() === address?.toLowerCase()) + 1;

  // ── HANDLERS ──
  const handleGM = () => {
    if (!canGMToday || gmPending || gmConfirming) return;
    spawnParticles();
    setGmFired(true);
    writeGM({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"gm", chainId:arcTestnet.id });
  };

  const handleRestore = () => {
    writeRestore({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"restoreStreak", chainId:arcTestnet.id });
  };

  const handleApprove = () => {
    writeApprove({ address:USDC_ADDRESS, abi:USDC_ABI, functionName:"approve", args:[CONTRACT_ADDRESS, parseUnits("999999", 6)], chainId:arcTestnet.id });
  };

  const handlePredict = (isUp) => {
    if (!entryAmount || Number(entryAmount) <= 0) return;
    const amt = parseUnits(entryAmount, 6);
    writePredict({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"predict", args:[0, roundType, isUp, amt], chainId:arcTestnet.id });
  };

  const handleClaim = () => {
    writeClaim({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"claim", args:[currentRoundId], chainId:arcTestnet.id });
  };

  const handleFinalize = () => {
    writeFinalize({ address:CONTRACT_ADDRESS, abi:CONTRACT_ABI, functionName:"finalizeRound", args:[currentRoundId], chainId:arcTestnet.id });
  };

  const handleSwitchNetwork = async () => {
    try {
      await window.ethereum.request({ method:"wallet_switchEthereumChain", params:[{ chainId:"0x4cef52" }] });
    } catch {
      await window.ethereum.request({ method:"wallet_addEthereumChain", params:[{ chainId:"0x4cef52", chainName:"Arc Testnet", nativeCurrency:{ name:"USDC", symbol:"USDC", decimals:18 }, rpcUrls:["https://rpc.testnet.arc.network"], blockExplorerUrls:["https://testnet.arcscan.app"] }] });
    }
  };

  const spawnParticles = () => {
    const newP = Array.from({ length:20 }, (_,i) => ({
      id: Date.now()+i,
      style: { left:`${40+Math.random()*20}%`, top:`${40+Math.random()*20}%`, width:`${4+Math.random()*8}px`, height:`${4+Math.random()*8}px`, background:["#00D4FF","#00E87A","#FFB800","#F7931A"][Math.floor(Math.random()*4)], borderRadius:"50%", position:"absolute", pointerEvents:"none", animation:"burst 1s ease-out forwards", "--dx":`${(Math.random()-0.5)*300}px`, "--dy":`${(Math.random()-0.5)*300}px`, animationDelay:`${Math.random()*0.2}s`, zIndex:100 }
    }));
    setParticles(p => [...p, ...newP]);
    setTimeout(() => setParticles(p => p.filter(x => !newP.find(n => n.id===x.id))), 1200);
  };

  // UTC midnight countdown
  const utcMidnight = (() => {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()+1);
  })();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        :root {
          --bg:#07090F; --surface:#0D1119; --surface2:#111722; --border:#1A2235;
          --arc:#00D4FF; --green:#00E87A; --red:#FF4561; --gold:#FFB800; --btc:#F7931A;
          --text:#DDE4F0; --muted:#3D4F68;
        }
        body { font-family:'Outfit',sans-serif; background:var(--bg); color:var(--text); min-height:100vh; }
        body::before { content:''; position:fixed; inset:0; background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px); background-size:44px 44px; opacity:0.2; pointer-events:none; z-index:0; }
        @keyframes burst { 0%{transform:translate(0,0) scale(1);opacity:1} 100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0} }
        @keyframes glow { 0%,100%{box-shadow:0 0 24px rgba(0,212,255,0.25)} 50%{box-shadow:0 0 48px rgba(0,212,255,0.5),0 0 80px rgba(0,212,255,0.15)} }
        @keyframes shimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-5px)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .app { max-width:1140px; margin:0 auto; padding:0 20px 48px; position:relative; z-index:1; }
        .panel { background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:16px; }
        .label { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.15em; color:var(--muted); margin-bottom:10px; }
        input[type=number] { background:var(--surface2); border:1px solid var(--border); border-radius:8px; color:var(--text); font-size:0.9rem; font-family:'DM Mono',monospace; padding:10px 14px; width:100%; outline:none; }
        input[type=number]:focus { border-color:var(--arc); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance:none; }
        .btn { border:none; border-radius:10px; font-family:'Outfit',sans-serif; font-weight:600; cursor:pointer; transition:all 0.2s; }
        .btn-up { background:rgba(0,232,122,0.1); border:1.5px solid rgba(0,232,122,0.25); color:var(--green); }
        .btn-up:hover { background:rgba(0,232,122,0.2); transform:translateY(-2px); }
        .btn-down { background:rgba(255,69,97,0.1); border:1.5px solid rgba(255,69,97,0.25); color:var(--red); }
        .btn-down:hover { background:rgba(255,69,97,0.2); transform:translateY(-2px); }
        .btn-arc { background:linear-gradient(135deg,#003D5C,#00D4FF); color:#fff; }
        .btn-arc:hover { opacity:0.85; }
        .lb-row { display:grid; grid-template-columns:28px 1fr 80px 60px 60px; gap:8px; align-items:center; padding:10px 12px; border-radius:10px; background:var(--surface); border:1px solid var(--border); animation:fadeUp 0.4s ease both; }
        .lb-row.me { border-color:rgba(0,212,255,0.3); background:rgba(0,212,255,0.04); }
        .lb-row:hover { border-color:rgba(0,212,255,0.2); }
        .particles-wrap { position:fixed; inset:0; pointer-events:none; z-index:200; }
      `}</style>

      <div className="app">
        <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:200 }}>
          {particles.map(p => <div key={p.id} style={p.style} />)}
        </div>

        {/* HEADER */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 0", borderBottom:"1px solid var(--border)", marginBottom:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34, height:34, borderRadius:8, background:"linear-gradient(135deg,#003D5C,#00D4FF)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"0.65rem", fontWeight:800, color:"#fff", boxShadow:"0 0 16px rgba(0,212,255,0.3)" }}>GM</div>
            <div>
              <div style={{ fontSize:"1rem", fontWeight:700, letterSpacing:"0.04em" }}>Arc<span style={{ color:"var(--arc)" }}>GM</span></div>
              <div style={{ fontSize:"0.58rem", color:"var(--muted)", letterSpacing:"0.1em" }}>PREDICT · GM · EARN</div>
            </div>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            {isConnected && myStreak > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--surface)", border:"1px solid var(--border)", borderRadius:20, padding:"6px 14px" }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--green)", boxShadow:"0 0 8px var(--green)", animation:"pulse 2s infinite" }} />
                <span style={{ fontSize:"0.78rem", fontWeight:600, color:"var(--green)" }}>🔥 {myStreak}d streak</span>
                <span style={{ fontSize:"0.68rem", color:"var(--muted)" }}>· {multText}</span>
              </div>
            )}
            {isConnected && (
              <div style={{ background:"rgba(0,212,255,0.08)", border:"1px solid rgba(0,212,255,0.2)", borderRadius:20, padding:"5px 12px", fontSize:"0.72rem", color:"var(--arc)", fontWeight:600 }}>
                ⚡ {multText} multiplier
              </div>
            )}
          </div>

          <div>
            {!isConnected ? (
              <button className="btn btn-arc" style={{ padding:"10px 24px", fontSize:"0.85rem" }} onClick={() => connect({ connector:injected() })}>Connect Wallet</button>
            ) : isWrongNetwork ? (
              <button onClick={handleSwitchNetwork} style={{ background:"rgba(255,107,53,0.2)", border:"1px solid #FF6B35", color:"#FF6B35", padding:"8px 16px", borderRadius:20, fontFamily:"Outfit,sans-serif", fontSize:"0.8rem", cursor:"pointer" }}>⚠ Switch to Arc</button>
            ) : (
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", color:"var(--muted)", padding:"7px 14px", borderRadius:20, fontSize:"0.7rem", fontFamily:"DM Mono,monospace", display:"flex", alignItems:"center", gap:6, cursor:"pointer" }} onClick={() => disconnect()}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--green)" }} />
                {fmt(address)}
              </div>
            )}
          </div>
        </div>

        {/* TABS */}
        <div style={{ display:"flex", borderBottom:"1px solid var(--border)", marginBottom:24 }}>
          {[["predict","🔮 Predict"],["gm","🌅 Daily GM"],["leaderboard","🏆 Leaderboard"]].map(([id,label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ padding:"14px 28px", fontSize:"0.82rem", fontWeight:600, cursor:"pointer", color: tab===id ? "var(--text)" : "var(--muted)", background:"transparent", border:"none", borderBottom: tab===id ? "2px solid var(--arc)" : "2px solid transparent", fontFamily:"Outfit,sans-serif", transition:"all 0.2s" }}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ PREDICT TAB ══ */}
        {tab === "predict" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 290px", gap:16, alignItems:"start" }}>
            <div style={{ display:"flex", flexDirection:"column", gap:14 }}>

              {/* Multiplier banner */}
              {isConnected && multVal > 100 && (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", background:"linear-gradient(135deg,rgba(0,212,255,0.06),rgba(0,212,255,0.02))", border:"1px solid rgba(0,212,255,0.15)", borderRadius:10, padding:"11px 16px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <span style={{ fontSize:"1.1rem" }}>⚡</span>
                    <div>
                      <div style={{ fontSize:"0.78rem", fontWeight:600, color:"var(--arc)" }}>GM Streak Boost Active</div>
                      <div style={{ fontSize:"0.65rem", color:"var(--muted)", marginTop:1 }}>{myStreak} day streak · boosts all prediction points</div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontFamily:"DM Mono,monospace", fontSize:"1.4rem", fontWeight:500, color:"var(--arc)" }}>{multText}</div>
                    <div style={{ fontSize:"0.6rem", color:"var(--muted)" }}>multiplier</div>
                  </div>
                </div>
              )}

              {/* Market header */}
              <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:14, padding:"20px 24px", position:"relative", overflow:"hidden" }}>
                <div style={{ position:"absolute", top:0, left:0, right:0, height:1, background:"linear-gradient(90deg,transparent,rgba(247,147,26,0.5),transparent)" }} />
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <div style={{ width:48, height:48, borderRadius:"50%", background:"#F7931A", display:"flex", alignItems:"center", justifyContent:"center", fontSize:"1.4rem", fontWeight:800, color:"#fff", boxShadow:"0 0 20px rgba(247,147,26,0.35)", fontFamily:"Arial,sans-serif" }}>₿</div>
                    <div>
                      <div style={{ fontSize:"1.1rem", fontWeight:700, color:"var(--text)" }}>Bitcoin Up or Down</div>
                      <div style={{ fontSize:"0.68rem", color:"var(--muted)", marginTop:2 }}>
                        {roundType===0 ? "4 Hour Round" : "24 Hour Round"} · Arc Testnet · Powered by Stork Oracle
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:20 }}>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:"0.6rem", textTransform:"uppercase", letterSpacing:"0.1em", color:"var(--muted)" }}>UP Chance</div>
                      <div style={{ fontSize:"0.9rem", fontWeight:700, color:"var(--green)", fontFamily:"DM Mono,monospace" }}>{upPct}%</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:"0.6rem", textTransform:"uppercase", letterSpacing:"0.1em", color:"var(--muted)" }}>Pool</div>
                      <div style={{ fontSize:"0.9rem", fontWeight:700, color:"var(--text)", fontFamily:"DM Mono,monospace" }}>${totalPool.toFixed(0)}</div>
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ display:"flex", alignItems:"flex-end", justifyContent:"space-between" }}>
                  <div>
                    <div style={{ display:"flex", alignItems:"center", gap:16, marginBottom:6 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.7rem", color:"var(--muted)" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", border:"2px solid var(--muted)" }} /> Target (Snapshot)
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:5, fontSize:"0.7rem", color:"var(--gold)" }}>
                        <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--gold)" }} /> Current
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"baseline", gap:16 }}>
                      <div style={{ fontFamily:"DM Mono,monospace", fontSize:"1.1rem", color:"var(--muted)" }}>
                        {snapshotPrice ? fmtPrice(snapshotPrice) : "--"}
                      </div>
                      <div style={{ fontFamily:"DM Mono,monospace", fontSize:"2rem", fontWeight:500, color:"var(--gold)" }}>
                        {currentPrice ? fmtPrice(currentPrice) : "--"}
                        {priceDiff && (
                          <span style={{ fontSize:"0.85rem", fontWeight:600, color: priceDiff.up ? "var(--green)" : "var(--red)", marginLeft:6 }}>
                            {priceDiff.up ? "▲" : "▼"} ${Math.abs(priceDiff.diff / 1e18).toFixed(0)}
                          </span>
                        )}
                      </div>
                    </div>
                    {priceDiff && (
                      <div style={{ marginTop:6, fontSize:"0.8rem", fontWeight:700, color: priceDiff.up ? "var(--green)" : "var(--red)" }}>
                        {priceDiff.up ? "▲ ABOVE target" : "▼ BELOW target"} · {Math.abs(priceDiff.pct).toFixed(2)}%
                      </div>
                    )}
                  </div>

                  {/* Countdown boxes */}
                  {roundEndTime > 0 ? (
                    <CountdownBoxes targetMs={roundEndTime} />
                  ) : (
                    <div style={{ fontSize:"0.72rem", color:"var(--muted)" }}>No active round</div>
                  )}
                </div>
              </div>

              {/* Chart */}
              <TradingViewChart interval={chartInterval} setInterval={setChartInterval} />

              {/* Round toggle */}
              <div style={{ display:"flex", background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:3, gap:3 }}>
                {[[0,"⏱ 4 Hour Round"],[1,"📅 24 Hour Round"]].map(([rt,label]) => (
                  <button key={rt} onClick={() => setRoundType(rt)}
                    style={{ flex:1, padding:8, border:"none", borderRadius:6, background: roundType===rt ? "rgba(0,212,255,0.1)" : "transparent", color: roundType===rt ? "var(--text)" : "var(--muted)", fontSize:"0.75rem", fontWeight:600, cursor:"pointer", fontFamily:"Outfit,sans-serif" }}>
                    {label}
                  </button>
                ))}
              </div>

              {/* Entry or position */}
              {!isConnected ? (
                <div style={{ textAlign:"center", padding:20, color:"var(--muted)", fontSize:"0.8rem" }}>Connect wallet to predict</div>
              ) : hasEntry ? (
                <div style={{ background:"var(--surface)", border:`1px solid ${entryWinning ? "rgba(0,232,122,0.2)" : "rgba(255,69,97,0.2)"}`, borderRadius:12, padding:16 }}>
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:12 }}>
                    <div style={{ fontSize:"0.72rem", fontWeight:600, color: entryWinning ? "var(--green)" : "var(--red)" }}>
                      {entryWinning ? "✓ Currently Winning" : "✗ Currently Losing"}
                    </div>
                    <button onClick={() => setSharePos({ isUp:entryIsUp, snapshot:snapshotPrice, current:currentPrice, winning:entryWinning, streak:myStreak, mult:multVal, wallet:fmt(address) })}
                      style={{ background:"rgba(0,212,255,0.1)", border:"1px solid rgba(0,212,255,0.25)", color:"var(--arc)", padding:"6px 14px", borderRadius:8, fontSize:"0.72rem", fontWeight:600, cursor:"pointer", fontFamily:"Outfit,sans-serif" }}>
                      📤 Share
                    </button>
                  </div>
                  <div style={{ display:"flex", gap:20 }}>
                    <div><div style={{ fontSize:"0.58rem", color:"var(--muted)", marginBottom:2 }}>Direction</div><div style={{ fontSize:"0.82rem", fontWeight:700, color: entryIsUp ? "var(--green)" : "var(--red)" }}>{entryIsUp ? "▲ UP" : "▼ DOWN"}</div></div>
                    <div><div style={{ fontSize:"0.58rem", color:"var(--muted)", marginBottom:2 }}>Your stake</div><div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.82rem", color:"var(--text)" }}>${entryAmt} USDC</div></div>
                    <div><div style={{ fontSize:"0.58rem", color:"var(--muted)", marginBottom:2 }}>Est. payout</div><div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.82rem", color:"var(--arc)" }}>${estimatedPayout} USDC</div></div>
                  </div>
                  {roundFinalized && !entryClaimed && (
                    <button className="btn btn-arc" style={{ width:"100%", padding:12, marginTop:12, fontSize:"0.85rem" }} onClick={handleClaim}
                      disabled={claimPending || claimConfirming}>
                      {claimPending ? "⏳ Confirm..." : claimConfirming ? "⛓ Claiming..." : "💰 Claim Payout + Points"}
                    </button>
                  )}
                  {roundFinalized && entryClaimed && (
                    <div style={{ textAlign:"center", marginTop:12, fontSize:"0.75rem", color:"var(--green)" }}>✓ Claimed</div>
                  )}
                  {!roundFinalized && roundEndTime > 0 && Date.now() > roundEndTime && (
                    <button className="btn" style={{ width:"100%", padding:10, marginTop:12, fontSize:"0.78rem", background:"rgba(255,184,0,0.1)", border:"1px solid rgba(255,184,0,0.2)", color:"var(--gold)" }} onClick={handleFinalize}>
                      Finalize Round
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.7rem", color:"var(--muted)" }}>
                      <span>Entry Amount (USDC)</span>
                      <span>Balance: ${usdcBal} USDC</span>
                    </div>
                    <input type="number" value={entryAmount} onChange={e => setEntryAmount(e.target.value)} placeholder="Min 1 USDC" min="1" step="1" />
                    <div style={{ display:"flex", gap:6 }}>
                      {["1","5","10","25","50"].map(v => (
                        <button key={v} onClick={() => setEntryAmount(v)}
                          style={{ flex:1, padding:"5px 0", border:"1px solid var(--border)", borderRadius:6, background: entryAmount===v ? "rgba(0,212,255,0.1)" : "var(--surface2)", color: entryAmount===v ? "var(--arc)" : "var(--muted)", fontSize:"0.68rem", cursor:"pointer", fontFamily:"Outfit,sans-serif" }}>
                          ${v}
                        </button>
                      ))}
                    </div>
                  </div>

                  {needsApproval ? (
                    <button className="btn btn-arc" style={{ width:"100%", padding:14, fontSize:"0.9rem" }} onClick={handleApprove} disabled={approvePending || approveConfirming}>
                      {approvePending ? "⏳ Confirm approval..." : approveConfirming ? "⛓ Approving..." : "Approve USDC to Predict"}
                    </button>
                  ) : (
                    <div style={{ display:"flex", gap:10 }}>
                      <button className="btn btn-up" style={{ flex:1, padding:18, fontSize:"1rem" }} onClick={() => handlePredict(true)} disabled={predictPending || predictConfirming}>
                        <div>📈 UP</div>
                        <div style={{ fontSize:"0.68rem", opacity:0.7, marginTop:4 }}>{upPct}% predicting up</div>
                        <div style={{ fontSize:"0.62rem", opacity:0.5, marginTop:2 }}>Win: 10 × {multText} pts + USDC</div>
                      </button>
                      <button className="btn btn-down" style={{ flex:1, padding:18, fontSize:"1rem" }} onClick={() => handlePredict(false)} disabled={predictPending || predictConfirming}>
                        <div>📉 DOWN</div>
                        <div style={{ fontSize:"0.68rem", opacity:0.7, marginTop:4 }}>{downPct}% predicting down</div>
                        <div style={{ fontSize:"0.62rem", opacity:0.5, marginTop:2 }}>Win: 10 × {multText} pts + USDC</div>
                      </button>
                    </div>
                  )}
                  {(predictPending || predictConfirming) && (
                    <div style={{ textAlign:"center", fontSize:"0.75rem", color:"var(--green)", animation:"float 2s ease-in-out infinite" }}>
                      {predictPending ? "⏳ Confirm in wallet..." : "⛓ Confirming on chain..."}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* SIDEBAR */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {isConnected && (
                <div style={{ background:"linear-gradient(135deg,rgba(0,212,255,0.07),rgba(0,212,255,0.02))", border:"1px solid rgba(0,212,255,0.18)", borderRadius:12, padding:14 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                    <div>
                      <div style={{ fontSize:"0.75rem", fontWeight:600, color:"var(--arc)" }}>⚡ GM Streak Boost</div>
                      <div style={{ fontSize:"0.62rem", color:"var(--muted)", marginTop:1 }}>{myStreak} day streak active</div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontFamily:"DM Mono,monospace", fontSize:"2rem", fontWeight:500, color:"var(--arc)" }}>{multText}</div>
                    </div>
                  </div>
                  <div style={{ background:"rgba(0,212,255,0.06)", borderRadius:6, padding:"8px 10px", fontSize:"0.68rem" }}>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}><span style={{ color:"var(--muted)" }}>Base win pts</span><span style={{ fontFamily:"DM Mono,monospace", color:"var(--arc)" }}>10 pts</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}><span style={{ color:"var(--muted)" }}>Your boost</span><span style={{ fontFamily:"DM Mono,monospace", color:"var(--arc)" }}>× {multText}</span></div>
                    <div style={{ display:"flex", justifyContent:"space-between" }}><span style={{ color:"var(--muted)" }}>You earn</span><span style={{ fontFamily:"DM Mono,monospace", color:"var(--green)", fontWeight:700 }}>{(10 * multVal / 100).toFixed(0)} pts</span></div>
                  </div>
                </div>
              )}

              <div className="panel">
                <div className="label">Round Pool</div>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6, fontSize:"0.72rem" }}><span style={{ color:"var(--muted)" }}>Total staked</span><span style={{ fontFamily:"DM Mono,monospace", fontWeight:600 }}>${totalPool.toFixed(2)} USDC</span></div>
                <div style={{ height:6, borderRadius:3, overflow:"hidden", background:"var(--surface2)", margin:"8px 0" }}>
                  <div style={{ display:"flex", height:"100%" }}>
                    <div style={{ width:`${upPct}%`, background:"var(--green)" }} />
                    <div style={{ width:`${downPct}%`, background:"var(--red)" }} />
                  </div>
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.62rem", marginBottom:10 }}>
                  <span style={{ color:"var(--green)" }}>▲ {upPct}% · ${totalUp.toFixed(2)}</span>
                  <span style={{ color:"var(--red)" }}>{downPct}% · ${totalDown.toFixed(2)} ▼</span>
                </div>
                <div style={{ height:1, background:"var(--border)", margin:"8px 0" }} />
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.72rem", marginBottom:4 }}><span style={{ color:"var(--muted)" }}>Min entry</span><span style={{ fontFamily:"DM Mono,monospace" }}>1 USDC</span></div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.72rem" }}><span style={{ color:"var(--muted)" }}>Winners share</span><span style={{ fontFamily:"DM Mono,monospace", color:"var(--green)" }}>85%</span></div>
                <div style={{ background:"var(--surface2)", borderRadius:8, padding:"10px 12px", marginTop:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.68rem", marginBottom:3 }}><span style={{ color:"var(--muted)" }}>Winners</span><span style={{ fontFamily:"DM Mono,monospace", color:"var(--green)" }}>85%</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.68rem", marginBottom:3 }}><span style={{ color:"var(--muted)" }}>Dev</span><span style={{ fontFamily:"DM Mono,monospace" }}>5%</span></div>
                  <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.68rem" }}><span style={{ color:"var(--muted)" }}>Marketing</span><span style={{ fontFamily:"DM Mono,monospace" }}>10%</span></div>
                </div>
              </div>

              <div style={{ background:"rgba(0,232,122,0.04)", border:"1px solid rgba(0,232,122,0.12)", borderRadius:10, padding:12, fontSize:"0.68rem" }}>
                <div style={{ color:"var(--green)", fontWeight:600, marginBottom:4 }}>How it works</div>
                <div style={{ color:"var(--muted)", lineHeight:1.6 }}>
                  Predict BTC direction by round end. Winners share 85% of the pool weighted by stake. Plus earn {(10 * multVal / 100).toFixed(0)} pts per correct prediction.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ GM TAB ══ */}
        {tab === "gm" && (
          <div style={{ display:"grid", gridTemplateColumns:"240px 1fr 240px", gap:16, alignItems:"start" }}>

            {/* LEFT */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {[
                ["Total Points", <span style={{ fontFamily:"DM Mono,monospace", fontSize:"2rem", fontWeight:500, color:"var(--arc)" }}>{totalPts}</span>, myRank > 0 ? <div style={{ marginTop:5, display:"inline-flex", alignItems:"center", gap:4, background:"rgba(0,232,122,0.1)", border:"1px solid rgba(0,232,122,0.2)", borderRadius:6, padding:"3px 8px", fontSize:"0.65rem", color:"var(--green)" }}>🏆 Rank #{myRank}</div> : null],
                ["GM Streak", <span style={{ fontFamily:"DM Mono,monospace", fontSize:"2rem", fontWeight:500, color:"var(--text)" }}>{myStreak}</span>, <div style={{ fontSize:"0.65rem", color:"var(--muted)", marginTop:4 }}>Longest: {longestStreak} days</div>],
                ["Total GMs", <span style={{ fontFamily:"DM Mono,monospace", fontSize:"2rem", fontWeight:500, color:"var(--text)" }}>{myGMs}</span>, null],
              ].map(([label, val, sub]) => (
                <div key={label} className="panel">
                  <div style={{ fontSize:"0.6rem", textTransform:"uppercase", letterSpacing:"0.12em", color:"var(--muted)", marginBottom:5 }}>{label}</div>
                  {val}{sub}
                </div>
              ))}
              {canRestore && (
                <div style={{ background:"rgba(255,107,53,0.05)", border:"1px solid rgba(255,107,53,0.2)", borderRadius:10, padding:14 }}>
                  <div style={{ fontSize:"0.72rem", color:"#FF6B35", marginBottom:6 }}>⚠ Streak broken yesterday</div>
                  <div style={{ fontSize:"0.65rem", color:"var(--muted)", marginBottom:8 }}>Restore for {restoreCost} pts</div>
                  <button className="btn" style={{ width:"100%", padding:9, background:"rgba(255,107,53,0.1)", border:"1px solid rgba(255,107,53,0.4)", color:"#FF6B35", fontSize:"0.78rem" }}
                    onClick={handleRestore} disabled={restorePending || restoreConfirming}>
                    {restorePending ? "⏳ Confirm..." : restoreConfirming ? "⛓ Restoring..." : `🔄 Restore (${restoreCost} pts)`}
                  </button>
                </div>
              )}
            </div>

            {/* CENTER */}
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:20 }}>
              <div style={{ textAlign:"center" }}>
                <div style={{ fontSize:"0.6rem", textTransform:"uppercase", letterSpacing:"0.15em", color:"var(--muted)", marginBottom:4 }}>Global GM Count · Arc Testnet</div>
                <div style={{ fontFamily:"DM Mono,monospace", fontSize:"3rem", fontWeight:500, background:"linear-gradient(135deg,var(--arc),#7B9EFF)", backgroundSize:"200% auto", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", animation:"shimmer 4s linear infinite" }}>
                  {globalGMsNum.toLocaleString()}
                </div>
              </div>

              <div style={{ position:"relative", display:"flex", alignItems:"center", justifyContent:"center", width:200, height:200 }}>
                {[196,166].map((size,i) => (
                  <div key={i} style={{ position:"absolute", width:size, height:size, borderRadius:"50%", border:"1px solid rgba(0,212,255,0.12)", animation:`pulse ${3+i}s ease-in-out ${i*0.6}s infinite` }} />
                ))}
                <button style={{ width:126, height:126, borderRadius:"50%", border:"none", cursor: canGMToday ? "pointer" : "not-allowed", background: canGMToday ? "linear-gradient(135deg,#002840,#005580,#00D4FF)" : "linear-gradient(135deg,#1a2235,#2a3545)", fontFamily:"Outfit,sans-serif", fontSize:"1.8rem", fontWeight:800, color:"#fff", letterSpacing:"0.08em", animation: canGMToday ? "glow 3s ease-in-out infinite" : "none", transition:"transform 0.15s", zIndex:2, position:"relative", opacity: canGMToday ? 1 : 0.5 }}
                  onClick={handleGM} disabled={!canGMToday || gmPending || gmConfirming}
                  onMouseEnter={e => canGMToday && (e.target.style.transform="scale(1.06)")}
                  onMouseLeave={e => (e.target.style.transform="scale(1)")}>
                  {gmPending ? "..." : gmConfirming ? "⏳" : "GM"}
                </button>
              </div>

              {(gmPending || gmConfirming) && (
                <div style={{ fontSize:"0.75rem", color:"var(--green)", animation:"float 2s ease-in-out infinite" }}>
                  {gmPending ? "⏳ Confirm in wallet..." : "⛓ Confirming on chain..."}
                </div>
              )}

              {!isConnected ? (
                <div style={{ fontSize:"0.78rem", color:"var(--muted)" }}>Connect wallet to GM</div>
              ) : canGMToday ? (
                <div style={{ fontSize:"0.78rem", color:"var(--green)", opacity:0.7, letterSpacing:"0.08em", animation:"float 3s ease-in-out infinite" }}>✦ tap to say gm on arc ✦</div>
              ) : (
                <div style={{ textAlign:"center", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:10, padding:"11px 24px" }}>
                  <div style={{ fontSize:"0.58rem", textTransform:"uppercase", letterSpacing:"0.15em", color:"var(--muted)", marginBottom:3 }}>Resets at UTC 00:00 in</div>
                  <CountdownBoxes targetMs={utcMidnight} />
                </div>
              )}

              <div style={{ fontSize:"0.64rem", color:"var(--muted)", textAlign:"center", lineHeight:1.7, maxWidth:260 }}>
                One GM per wallet per UTC day<br />Streak multiplier applies to GM and prediction points
              </div>
            </div>

            {/* RIGHT */}
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              <div className="panel">
                <div className="label">Streak Multiplier</div>
                <div style={{ display:"flex", gap:3, margin:"8px 0" }}>
                  {Array.from({length:15},(_,i) => (
                    <div key={i} style={{ flex:1, height:4, borderRadius:2, background: i < myStreak ? (i < 7 ? "var(--arc)" : i < 15 ? "var(--gold)" : "var(--green)") : "#1A2235" }} />
                  ))}
                </div>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:"0.58rem", color:"var(--muted)", marginBottom:10 }}>
                  <span>1x</span><span>7d→<span style={{ color:"var(--arc)", fontWeight:700 }}>1.5x</span></span><span>15d→<span style={{ color:"var(--green)", fontWeight:700 }}>2x</span></span>
                </div>
                {[["No streak","1x","10 pts/win","var(--muted)"],["7 day streak","1.5x","15 pts/win","var(--arc)"],["15 day streak","2x","20 pts/win","var(--green)"]].map(([label,mult,pts,color]) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.7rem", padding:"6px 9px", background: myStreak >= (label==="7 day streak"?7:label==="15 day streak"?15:0) && myStreak < (label==="7 day streak"?15:label==="No streak"?7:999) ? "rgba(0,212,255,0.05)" : "var(--surface2)", borderRadius:6, marginBottom:4, border: myStreak >= (label==="7 day streak"?7:label==="15 day streak"?15:0) && myStreak < (label==="7 day streak"?15:label==="No streak"?7:999) ? "1px solid rgba(0,212,255,0.15)" : "1px solid transparent" }}>
                    <span style={{ color:"var(--muted)" }}>{label}</span>
                    <span style={{ fontFamily:"DM Mono,monospace", fontWeight:600, color }}>{mult} · {pts}</span>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="label">Streak Restore Cost</div>
                {[["1 to 7 days","25 pts",myStreak>=1&&myStreak<=7],["8 to 15 days","50 pts",myStreak>=8&&myStreak<=15],["16 to 30 days","75 pts",myStreak>=16&&myStreak<=30],["30+ days","100 pts",myStreak>30]].map(([label,cost,active]) => (
                  <div key={label} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"7px 0", borderBottom:"1px solid var(--border)", fontSize:"0.72rem" }}>
                    <span style={{ color: active ? "rgba(255,107,53,0.7)" : "var(--muted)" }}>{active ? "→ " : ""}{label}</span>
                    <span style={{ fontFamily:"DM Mono,monospace", fontWeight:600, color: active ? "rgba(255,107,53,0.9)" : "var(--text)" }}>{cost}</span>
                  </div>
                ))}
                <div style={{ fontSize:"0.62rem", color:"var(--muted)", marginTop:8 }}>24h window · Points deducted</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ LEADERBOARD TAB ══ */}
        {tab === "leaderboard" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 260px", gap:16 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <div style={{ display:"grid", gridTemplateColumns:"28px 1fr 80px 60px 60px", gap:8, padding:"6px 12px", fontSize:"0.58rem", textTransform:"uppercase", letterSpacing:"0.1em", color:"var(--muted)" }}>
                <div /><div>Wallet</div><div style={{ textAlign:"right" }}>Points</div><div style={{ textAlign:"center" }}>Streak</div><div style={{ textAlign:"right" }}>Boost</div>
              </div>
              {leaderboard.length === 0 ? (
                <div style={{ textAlign:"center", padding:40, color:"var(--muted)", fontSize:"0.8rem" }}>No activity yet. Be the first! 🌅</div>
              ) : leaderboard.map((e, i) => (
                <div key={e.address} className={`lb-row${e.address?.toLowerCase()===address?.toLowerCase()?" me":""}`} style={{ animationDelay:`${i*0.05}s` }}>
                  <div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.72rem", color: i===0?"var(--gold)":i===1?"#8A9BB0":i===2?"#8B6F47":"var(--muted)", textAlign:"center" }}>
                    {i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}
                  </div>
                  <div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.68rem", color:"var(--text)" }}>
                    {fmt(e.address)}
                    {e.address?.toLowerCase()===address?.toLowerCase() && <span style={{ color:"var(--arc)", marginLeft:4, fontSize:"0.6rem" }}>(you)</span>}
                  </div>
                  <div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.8rem", fontWeight:600, textAlign:"right" }}>{e.points.toFixed(1)}</div>
                  <div style={{ fontSize:"0.68rem", color:"var(--gold)", textAlign:"center" }}>🔥{e.streak}d</div>
                  <div style={{ fontFamily:"DM Mono,monospace", fontSize:"0.68rem", fontWeight:600, textAlign:"right", color: e.mult>=200?"var(--green)":e.mult>=150?"var(--arc)":e.mult>=120?"rgba(0,212,255,0.5)":"var(--muted)" }}>
                    {getMultText(e.mult)}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {isConnected && (
                <div style={{ background:"linear-gradient(135deg,rgba(0,212,255,0.08),rgba(0,212,255,0.02))", border:"1px solid rgba(0,212,255,0.18)", borderRadius:12, padding:16, textAlign:"center" }}>
                  <div style={{ fontSize:"0.58rem", textTransform:"uppercase", letterSpacing:"0.15em", color:"rgba(0,212,255,0.4)", marginBottom:6 }}>Your Rank</div>
                  <div style={{ fontFamily:"DM Mono,monospace", fontSize:"2.8rem", fontWeight:500, color:"var(--arc)" }}>{myRank > 0 ? `#${myRank}` : "--"}</div>
                  <div style={{ fontSize:"0.7rem", color:"var(--muted)", marginTop:4 }}>{totalPts} pts · {myStreak}d streak</div>
                  <div style={{ display:"inline-flex", alignItems:"center", gap:4, background:"rgba(0,232,122,0.1)", border:"1px solid rgba(0,232,122,0.2)", borderRadius:6, padding:"3px 10px", fontSize:"0.68rem", color:"var(--green)", marginTop:6 }}>
                    ⚡ {multText} multiplier active
                  </div>
                </div>
              )}

              <div className="panel">
                <div className="label">Points System</div>
                {[["Correct prediction","10 × mult"],["Wrong prediction","0 pts"],["Daily GM","1 × mult"],["7 day streak","1.5x boost"],["15 day streak","2x boost"]].map(([l,r]) => (
                  <div key={l} style={{ display:"flex", justifyContent:"space-between", fontSize:"0.7rem", padding:"5px 0", borderBottom:"1px solid var(--border)" }}>
                    <span style={{ color:"var(--muted)" }}>{l}</span>
                    <span style={{ fontFamily:"DM Mono,monospace", fontWeight:600, color:"var(--arc)" }}>{r}</span>
                  </div>
                ))}
              </div>

              <div style={{ background:"rgba(0,232,122,0.04)", border:"1px solid rgba(0,232,122,0.1)", borderRadius:10, padding:12, fontSize:"0.68rem", color:"var(--muted)", lineHeight:1.6 }}>
                <div style={{ color:"var(--green)", fontWeight:600, marginBottom:4 }}>💡 Tip</div>
                GM every day to keep your streak. Your streak multiplier boosts BOTH prediction points and GM points. Miss a day and you can restore within 24h.
              </div>
            </div>
          </div>
        )}
      </div>

      {sharePos && <ShareModal position={sharePos} onClose={() => setSharePos(null)} />}
    </>
  );
}
