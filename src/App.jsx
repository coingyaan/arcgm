import { useState, useEffect, useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { injected } from "wagmi/connectors";
import { CONTRACT_ADDRESS, CONTRACT_ABI, arcTestnet } from "./config.js";

const fmt    = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : "";
const fmtPts = (n) => (Number(n)/1e18).toFixed(1);
const mTxt   = (s) => s>=15?"2x":s>=7?"1.5x":s>=3?"1.2x":"1x";
const mVal   = (s) => s>=15?200:s>=7?150:s>=3?120:100;

function useCountdown(ms) {
  const [s,setS]=useState(0);
  useEffect(()=>{
    const t=()=>setS(Math.max(0,Math.floor((ms-Date.now())/1000)));
    t();const id=setInterval(t,1000);return()=>clearInterval(id);
  },[ms]);
  return s;
}

function StreakRing({streak,max=30}) {
  const pct=Math.min(streak/max,1);
  const r=42,c=2*Math.PI*r;
  const color=streak>=15?"#4ade80":streak>=7?"#60a5fa":streak>=3?"#a78bfa":"#374151";
  return(
    <svg width={100} height={100} viewBox="0 0 100 100" style={{transform:"rotate(-90deg)"}}>
      <circle cx={50} cy={50} r={r} fill="none" stroke="#1f2937" strokeWidth={6}/>
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={c} strokeDashoffset={c*(1-pct)}
        strokeLinecap="round" style={{transition:"stroke-dashoffset 0.6s ease,stroke 0.4s ease"}}/>
    </svg>
  );
}

export default function App() {
  const {address,isConnected,chain}=useAccount();
  const {connect}=useConnect();
  const {disconnect}=useDisconnect();
  const [tab,setTab]=useState("home");
  const wrongNet=isConnected&&chain?.id!==arcTestnet.id;

  // READS
  const {data:uMain,refetch:rUser}  =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserMain",args:[address],enabled:!!address});
  const {data:uStreak,refetch:rStr} =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserStreak",args:[address],enabled:!!address});
  const {data:uMult}                =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getMultiplier",args:[address],enabled:!!address});
  const {data:gGMs,refetch:rGMs}    =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getTotalGlobalGMs"});
  const {data:lbPage}               =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardPage",args:[0n,50n]});
  const {data:lbStats}              =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardStats",args:[0n,50n]});
  const {data:firstGM}              =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getFirstGMToday"});
  const {data:userCount}            =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserCount"});

  // WRITES
  const {writeContract:wGM,data:gmH,isPending:gmP}=useWriteContract();
  const {isLoading:gmC,isSuccess:gmD}=useWaitForTransactionReceipt({hash:gmH});
  const {writeContract:wRes,data:resH,isPending:resP}=useWriteContract();
  const {isLoading:resC,isSuccess:resD}=useWaitForTransactionReceipt({hash:resH});

  const refAll=useCallback(()=>{rUser();rStr();rGMs();},[]);
  useEffect(()=>{if(gmD||resD)refAll();},[gmD,resD]);

  // PARSE
  const pts    = uMain?fmtPts(uMain[0]):"--";
  const myGMs  = uMain?Number(uMain[1]):0;
  const streak = uMain?Number(uMain[2]):0;
  const canGM  = uMain?uMain[3]:true;
  const longest= uStreak?Number(uStreak[1]):0;
  const canRes = uStreak?uStreak[3]:false;
  const resCost= uStreak?fmtPts(uStreak[4]):"0";
  const mult   = uMult?Number(uMult):100;
  const gCount = gGMs?Number(gGMs):0;
  const uCount = userCount?Number(userCount):0;

  const lb=(lbPage&&lbStats)?lbPage[0].map((w,i)=>({
    w,pts:Number(lbPage[1][i])/1e18,
    streak:Number(lbStats[0][i]),
    gms:Number(lbStats[1][i]),
    mult:Number(lbStats[2][i])
  })).sort((a,b)=>b.pts-a.pts).slice(0,20):[];
  const myRank=lb.findIndex(e=>e.w?.toLowerCase()===address?.toLowerCase())+1;

  const midnight=(()=>{const n=new Date();return Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1);})();
  const secsLeft=useCountdown(midnight);
  const h=Math.floor(secsLeft/3600),m=Math.floor((secsLeft%3600)/60),s=secsLeft%60;
  const countdownStr=`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;

  const doGM=()=>{if(!canGM||gmP||gmC||!isConnected)return;wGM({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"gm",chainId:arcTestnet.id});};
  const doRes=()=>wRes({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"restoreStreak",chainId:arcTestnet.id});
  const doSwitch=async()=>{try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x4cef52"}]});}catch{await window.ethereum.request({method:"wallet_addEthereumChain",params:[{chainId:"0x4cef52",chainName:"Arc Testnet",nativeCurrency:{name:"USDC",symbol:"USDC",decimals:18},rpcUrls:["https://rpc.testnet.arc.network"],blockExplorerUrls:["https://testnet.arcscan.app"]}]});}};

  const streakColor=streak>=15?"#4ade80":streak>=7?"#60a5fa":streak>=3?"#a78bfa":"#374151";

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,400;0,14..32,500;0,14..32,600;0,14..32,700;1,14..32,400&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{font-size:16px;-webkit-tap-highlight-color:transparent}
        body{font-family:'Inter',sans-serif;background:#0B0F14;color:#E6EDF3;min-height:100vh;-webkit-font-smoothing:antialiased}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
        @keyframes shimmer{0%{background-position:-200% 0}100%{background-position:200% 0}}
        @keyframes scaleIn{from{transform:scale(.96);opacity:0}to{transform:scale(1);opacity:1}}
        .fade{animation:fadeUp .25s ease both}
        .skel{background:linear-gradient(90deg,#11161D 25%,#161B22 50%,#11161D 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:4px}
      `}</style>

      {/* NAV */}
      <nav style={{position:"sticky",top:0,zIndex:100,background:"rgba(11,15,20,.85)",backdropFilter:"blur(16px)",borderBottom:"1px solid #1E2733"}}>
        <div style={{maxWidth:640,margin:"0 auto",padding:"0 16px",display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:26,height:26,borderRadius:6,background:"linear-gradient(135deg,#1a3550,#4DA2FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".6rem",fontWeight:700,color:"#fff",letterSpacing:".04em"}}>GM</div>
            <span style={{fontWeight:700,fontSize:".95rem",letterSpacing:"-.02em"}}>ArcGM</span>
            <span style={{fontSize:".65rem",color:"#374151",background:"#11161D",border:"1px solid #1E2733",borderRadius:3,padding:"1px 5px"}}>testnet</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            {isConnected&&streak>0&&(
              <div style={{fontSize:".7rem",fontWeight:500,color:streakColor,background:`${streakColor}14`,border:`1px solid ${streakColor}33`,borderRadius:4,padding:"2px 8px"}}>
                {streak}d {mTxt(streak)}
              </div>
            )}
            {!isConnected?(
              <button onClick={()=>connect({connector:injected()})} style={{background:"#4DA2FF",border:"none",borderRadius:6,color:"#fff",fontSize:".8rem",fontWeight:600,padding:"7px 16px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                Connect
              </button>
            ):wrongNet?(
              <button onClick={doSwitch} style={{background:"transparent",border:"1px solid #FC8181",borderRadius:6,color:"#FC8181",fontSize:".78rem",padding:"6px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                Wrong network
              </button>
            ):(
              <button onClick={()=>disconnect()} style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:6,color:"#718096",fontSize:".75rem",padding:"6px 12px",cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",alignItems:"center",gap:5}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#4ade80"}}/>
                {fmt(address)}
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* TAB BAR */}
      <div style={{position:"sticky",top:52,zIndex:99,background:"rgba(11,15,20,.9)",backdropFilter:"blur(12px)",borderBottom:"1px solid #1E2733"}}>
        <div style={{maxWidth:640,margin:"0 auto",padding:"0 16px",display:"flex"}}>
          {[["home","Home"],["leaderboard","Leaderboard"],["stats","My Stats"]].map(([id,l])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"12px 16px",background:"transparent",border:"none",borderBottom:tab===id?"2px solid #4DA2FF":"2px solid transparent",color:tab===id?"#E6EDF3":"#4A5568",fontSize:".82rem",fontWeight:tab===id?600:400,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"color .15s"}}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{maxWidth:640,margin:"0 auto",padding:"24px 16px 100px"}}>

        {/* ══ HOME TAB ══ */}
        {tab==="home"&&(
          <div style={{display:"flex",flexDirection:"column",gap:20}} className="fade">

            {/* Hero GM card */}
            <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:16,padding:"32px 24px",textAlign:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",inset:0,background:`radial-gradient(ellipse 60% 40% at 50% 0%,${streakColor}08,transparent)`,pointerEvents:"none"}}/>

              {isConnected?(
                <>
                  {/* Streak ring */}
                  <div style={{position:"relative",display:"inline-flex",alignItems:"center",justifyContent:"center",marginBottom:16}}>
                    <StreakRing streak={streak}/>
                    <div style={{position:"absolute",textAlign:"center"}}>
                      <div style={{fontSize:"1.6rem",fontWeight:700,color:streakColor,lineHeight:1,letterSpacing:"-.02em"}}>{streak}</div>
                      <div style={{fontSize:".6rem",color:"#4A5568",marginTop:2,letterSpacing:".06em"}}>DAYS</div>
                    </div>
                  </div>

                  {canGM?(
                    <>
                      <div style={{fontSize:"1.1rem",fontWeight:600,color:"#E6EDF3",marginBottom:6,letterSpacing:"-.01em"}}>Ready to say gm?</div>
                      <div style={{fontSize:".8rem",color:"#4A5568",marginBottom:24}}>
                        {streak>0?`${streak} day streak · ${mTxt(streak)} multiplier`:"Start your streak today"}
                      </div>
                      <button onClick={doGM} disabled={gmP||gmC}
                        style={{background:gmP||gmC?"#11161D":"#4DA2FF",border:`1px solid ${gmP||gmC?"#1E2733":"#4DA2FF"}`,borderRadius:12,color:gmP||gmC?"#4A5568":"#fff",fontSize:"1.1rem",fontWeight:700,padding:"16px 48px",cursor:gmP||gmC?"not-allowed":"pointer",fontFamily:"Inter,sans-serif",transition:"all .2s",letterSpacing:"-.01em",minWidth:180}}>
                        {gmP?"Confirming...":gmC?"On chain...":"gm"}
                      </button>
                      <div style={{fontSize:".72rem",color:"#374151",marginTop:12}}>One GM per wallet per UTC day</div>
                    </>
                  ):(
                    <>
                      <div style={{fontSize:"1.1rem",fontWeight:600,color:"#E6EDF3",marginBottom:4,letterSpacing:"-.01em"}}>gm sent</div>
                      <div style={{fontSize:".82rem",color:"#4A5568",marginBottom:20}}>{streak} day streak · {mTxt(streak)} multiplier active</div>
                      <div style={{background:"#0B0F14",border:"1px solid #1E2733",borderRadius:10,padding:"14px 20px",display:"inline-block"}}>
                        <div style={{fontSize:".65rem",color:"#4A5568",marginBottom:4,letterSpacing:".06em"}}>NEXT GM IN</div>
                        <div style={{fontFamily:"monospace",fontSize:"1.6rem",fontWeight:500,color:"#E6EDF3",letterSpacing:"-.01em"}}>{countdownStr}</div>
                      </div>
                    </>
                  )}

                  {/* Restore streak */}
                  {canRes&&(
                    <div style={{marginTop:20,background:"rgba(252,129,129,.06)",border:"1px solid rgba(252,129,129,.15)",borderRadius:10,padding:"14px 16px",textAlign:"left"}}>
                      <div style={{fontSize:".82rem",fontWeight:500,color:"#FC8181",marginBottom:4}}>Streak broken yesterday</div>
                      <div style={{fontSize:".75rem",color:"#718096",marginBottom:10}}>Restore for {resCost} pts — 24 hour window</div>
                      <button onClick={doRes} disabled={resP||resC} style={{background:"transparent",border:"1px solid rgba(252,129,129,.3)",borderRadius:6,color:"#FC8181",fontSize:".78rem",fontWeight:500,padding:"7px 16px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                        {resP||resC?"...":"Restore streak"}
                      </button>
                    </div>
                  )}
                </>
              ):(
                <>
                  <div style={{fontSize:"2rem",fontWeight:700,color:"#E6EDF3",marginBottom:8,letterSpacing:"-.03em",lineHeight:1.2}}>gm, Arc.</div>
                  <div style={{fontSize:".95rem",color:"#4A5568",marginBottom:28,lineHeight:1.6,maxWidth:320,margin:"0 auto 28px"}}>
                    Build streaks. Earn reputation.<br/>Climb the Arc ecosystem leaderboard.
                  </div>
                  <button onClick={()=>connect({connector:injected()})} style={{background:"#4DA2FF",border:"none",borderRadius:12,color:"#fff",fontSize:"1rem",fontWeight:600,padding:"14px 40px",cursor:"pointer",fontFamily:"Inter,sans-serif",letterSpacing:"-.01em"}}>
                    Start GMing
                  </button>
                  <div style={{fontSize:".72rem",color:"#374151",marginTop:12}}>
                    {gCount.toLocaleString()} GMs · {uCount} participants
                  </div>
                </>
              )}
            </div>

            {/* Stats row */}
            {isConnected&&(
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
                {[["Points",pts,"#4DA2FF"],["Rank",myRank>0?`#${myRank}`:"--","#E6EDF3"],["GMs",myGMs,"#E6EDF3"]].map(([l,v,c])=>(
                  <div key={l} style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:10,padding:"14px 12px",textAlign:"center"}}>
                    <div style={{fontSize:".65rem",color:"#4A5568",letterSpacing:".06em",marginBottom:4}}>{l.toUpperCase()}</div>
                    <div style={{fontSize:"1.3rem",fontWeight:600,color:c,letterSpacing:"-.01em",fontVariantNumeric:"tabular-nums"}}>{v}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Multiplier info */}
            {isConnected&&(
              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:"16px"}}>
                <div style={{fontSize:".72rem",color:"#4A5568",letterSpacing:".06em",marginBottom:12}}>STREAK MULTIPLIER</div>
                <div style={{display:"flex",gap:3,marginBottom:8}}>
                  {Array.from({length:15},(_,i)=>(
                    <div key={i} style={{flex:1,height:3,borderRadius:1,background:i<streak?(i<3?"#a78bfa":i<7?"#60a5fa":"#4ade80"):"#1E2733",transition:"background .3s"}}/>
                  ))}
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:8}}>
                  {[["1x","1–2d","#374151"],["1.2x","3–6d","#a78bfa"],["1.5x","7–14d","#60a5fa"],["2x","15d+","#4ade80"]].map(([m,l,c])=>(
                    <div key={m} style={{background:mTxt(streak)===m?"rgba(77,162,255,.06)":"transparent",border:`1px solid ${mTxt(streak)===m?"#4DA2FF33":"#1E2733"}`,borderRadius:6,padding:"8px",textAlign:"center"}}>
                      <div style={{fontSize:".85rem",fontWeight:600,color:c,marginBottom:2}}>{m}</div>
                      <div style={{fontSize:".62rem",color:"#4A5568"}}>{l}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Global stats */}
            <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:".72rem",color:"#4A5568",letterSpacing:".06em",marginBottom:12}}>ARC ECOSYSTEM ACTIVITY</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
                {[["Total GMs",gCount.toLocaleString()],["Participants",uCount.toLocaleString()]].map(([l,v])=>(
                  <div key={l}>
                    <div style={{fontSize:".72rem",color:"#4A5568",marginBottom:3}}>{l}</div>
                    <div style={{fontSize:"1.4rem",fontWeight:600,color:"#E6EDF3",letterSpacing:"-.01em",fontVariantNumeric:"tabular-nums"}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* How it works */}
            <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:"16px"}}>
              <div style={{fontSize:".72rem",color:"#4A5568",letterSpacing:".06em",marginBottom:14}}>HOW IT WORKS</div>
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {[
                  ["Say gm every day","One GM per wallet per UTC day. Simple."],
                  ["Build your streak","3 days unlocks 1.2x. 7 days 1.5x. 15 days 2x on all points."],
                  ["Climb the leaderboard","Points accumulate. Rank reflects ecosystem commitment."],
                  ["Prove your reputation","Every on-chain GM is permanent. Testnet history counts for airdrop."],
                ].map(([t,d],i)=>(
                  <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                    <div style={{width:22,height:22,borderRadius:6,background:"#161B22",border:"1px solid #1E2733",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".65rem",fontWeight:600,color:"#4A5568",flexShrink:0,marginTop:1}}>{i+1}</div>
                    <div>
                      <div style={{fontSize:".82rem",fontWeight:500,color:"#E6EDF3",marginBottom:2}}>{t}</div>
                      <div style={{fontSize:".75rem",color:"#4A5568",lineHeight:1.5}}>{d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Community */}
            <a href="https://x.com/mkoneth" target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:12,background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:"14px 16px",textDecoration:"none",transition:"border-color .15s"}}
              onMouseEnter={e=>e.currentTarget.style.borderColor="#4DA2FF33"}
              onMouseLeave={e=>e.currentTarget.style.borderColor="#1E2733"}>
              <div style={{width:36,height:36,borderRadius:"50%",background:"#000",border:"1px solid #1E2733",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".85rem",color:"#E6EDF3",fontWeight:600,flexShrink:0}}>X</div>
              <div>
                <div style={{fontSize:".85rem",fontWeight:500,color:"#E6EDF3"}}>@mkoneth</div>
                <div style={{fontSize:".72rem",color:"#4A5568",marginTop:1}}>Follow for ArcGM updates</div>
              </div>
              <div style={{marginLeft:"auto",fontSize:".75rem",color:"#4DA2FF"}}>Follow</div>
            </a>

          </div>
        )}

        {/* ══ LEADERBOARD TAB ══ */}
        {tab==="leaderboard"&&(
          <div className="fade">
            <div style={{marginBottom:16}}>
              <div style={{fontSize:"1.2rem",fontWeight:700,color:"#E6EDF3",letterSpacing:"-.02em",marginBottom:4}}>Leaderboard</div>
              <div style={{fontSize:".78rem",color:"#4A5568"}}>{uCount} participants · {gCount.toLocaleString()} total GMs on Arc testnet</div>
            </div>

            {/* Header */}
            <div style={{display:"grid",gridTemplateColumns:"28px 1fr 70px 50px 50px",gap:8,padding:"6px 12px",fontSize:".65rem",letterSpacing:".06em",color:"#374151",marginBottom:4}}>
              <div>#</div><div>WALLET</div><div style={{textAlign:"right"}}>PTS</div><div style={{textAlign:"center"}}>STK</div><div style={{textAlign:"right"}}>MULT</div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:2}}>
              {lb.length===0?(
                <div style={{textAlign:"center",padding:"40px 0",color:"#374151",fontSize:".85rem"}}>No activity yet. Be the first.</div>
              ):lb.map((e,i)=>{
                const isMe=e.w?.toLowerCase()===address?.toLowerCase();
                const sc=e.streak>=15?"#4ade80":e.streak>=7?"#60a5fa":e.streak>=3?"#a78bfa":"#374151";
                return(
                  <div key={e.w} style={{display:"grid",gridTemplateColumns:"28px 1fr 70px 50px 50px",gap:8,padding:"11px 12px",borderRadius:8,background:isMe?"rgba(77,162,255,.06)":"transparent",border:`1px solid ${isMe?"rgba(77,162,255,.2)":"transparent"}`,transition:"background .15s",animation:"fadeUp .3s ease both",animationDelay:`${i*.03}s`}}
                    onMouseEnter={e=>!isMe&&(e.currentTarget.style.background="#11161D")}
                    onMouseLeave={e=>!isMe&&(e.currentTarget.style.background="transparent")}>
                    <div style={{fontFamily:"monospace",fontSize:".75rem",fontWeight:500,color:i===0?"#F6C90E":i===1?"#9CA3AF":i===2?"#CD7F32":"#374151",textAlign:"center"}}>{i+1}</div>
                    <div style={{fontFamily:"monospace",fontSize:".78rem",color:"#E6EDF3"}}>
                      {fmt(e.w)}{isMe&&<span style={{marginLeft:6,fontSize:".62rem",color:"#4DA2FF",fontFamily:"Inter,sans-serif"}}>you</span>}
                    </div>
                    <div style={{fontFamily:"monospace",fontSize:".8rem",fontWeight:500,textAlign:"right",color:"#E6EDF3",fontVariantNumeric:"tabular-nums"}}>{e.pts.toFixed(1)}</div>
                    <div style={{fontFamily:"monospace",fontSize:".72rem",textAlign:"center",color:sc,fontVariantNumeric:"tabular-nums"}}>{e.streak}d</div>
                    <div style={{fontFamily:"monospace",fontSize:".72rem",textAlign:"right",color:sc,fontWeight:500}}>{mTxt(e.streak)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══ MY STATS TAB ══ */}
        {tab==="stats"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}} className="fade">
            {!isConnected?(
              <div style={{textAlign:"center",padding:"60px 0"}}>
                <div style={{fontSize:"1rem",fontWeight:500,color:"#E6EDF3",marginBottom:8}}>Connect wallet to view stats</div>
                <div style={{fontSize:".78rem",color:"#4A5568",marginBottom:20}}>See your streak, points and rank</div>
                <button onClick={()=>connect({connector:injected()})} style={{background:"#4DA2FF",border:"none",borderRadius:8,color:"#fff",fontSize:".85rem",fontWeight:600,padding:"10px 24px",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
                  Connect Wallet
                </button>
              </div>
            ):(
              <>
                {/* Profile header */}
                <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:16,padding:"24px",textAlign:"center"}}>
                  <div style={{width:48,height:48,borderRadius:"50%",background:"linear-gradient(135deg,#1a3550,#4DA2FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".75rem",fontWeight:700,color:"#fff",margin:"0 auto 12px",letterSpacing:".04em"}}>
                    {address?.slice(2,4).toUpperCase()}
                  </div>
                  <div style={{fontFamily:"monospace",fontSize:".85rem",color:"#718096",marginBottom:4}}>{fmt(address)}</div>
                  {myRank>0&&<div style={{fontSize:".75rem",color:"#4DA2FF",fontWeight:500}}>Rank #{myRank} on Arc testnet</div>}
                </div>

                {/* Stats grid */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  {[
                    ["Current Streak",`${streak} days`,streakColor],
                    ["Longest Streak",`${longest} days`,"#E6EDF3"],
                    ["Total Points",pts,"#4DA2FF"],
                    ["Total GMs",myGMs,"#E6EDF3"],
                    ["Multiplier",mTxt(streak),streakColor],
                    ["Rank",myRank>0?`#${myRank}`:"--","#E6EDF3"],
                  ].map(([l,v,c])=>(
                    <div key={l} style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:10,padding:"16px"}}>
                      <div style={{fontSize:".65rem",color:"#4A5568",letterSpacing:".06em",marginBottom:6}}>{l.toUpperCase()}</div>
                      <div style={{fontSize:"1.4rem",fontWeight:600,color:c,letterSpacing:"-.01em",fontVariantNumeric:"tabular-nums"}}>{v}</div>
                    </div>
                  ))}
                </div>

                {/* Streak progress */}
                <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:"16px"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                    <div style={{fontSize:".72rem",color:"#4A5568",letterSpacing:".06em"}}>STREAK PROGRESS</div>
                    <div style={{fontSize:".78rem",fontWeight:500,color:streakColor}}>{mTxt(streak)} active</div>
                  </div>
                  <div style={{display:"flex",gap:3,marginBottom:8}}>
                    {Array.from({length:15},(_,i)=>(
                      <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<streak?(i<3?"#a78bfa":i<7?"#60a5fa":"#4ade80"):"#1E2733",transition:"background .3s"}}/>
                    ))}
                  </div>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".65rem",color:"#374151"}}>
                    <span>1x start</span><span style={{color:"#a78bfa"}}>3d 1.2x</span><span style={{color:"#60a5fa"}}>7d 1.5x</span><span style={{color:"#4ade80"}}>15d 2x</span>
                  </div>
                </div>

                {/* Restore */}
                {canRes&&(
                  <div style={{background:"rgba(252,129,129,.06)",border:"1px solid rgba(252,129,129,.15)",borderRadius:12,padding:"16px"}}>
                    <div style={{fontSize:".85rem",fontWeight:500,color:"#FC8181",marginBottom:4}}>Streak broken yesterday</div>
                    <div style={{fontSize:".75rem",color:"#718096",marginBottom:12}}>Restore for {resCost} points — window closes in 24 hours</div>
                    <button onClick={doRes} disabled={resP||resC} style={{background:"transparent",border:"1px solid rgba(252,129,129,.3)",borderRadius:6,color:"#FC8181",fontSize:".82rem",fontWeight:500,padding:"9px 20px",cursor:"pointer",fontFamily:"Inter,sans-serif",width:"100%"}}>
                      {resP||resC?"...":"Restore streak"}
                    </button>
                  </div>
                )}

                {/* Points system */}
                <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:"16px"}}>
                  <div style={{fontSize:".72rem",color:"#4A5568",letterSpacing:".06em",marginBottom:12}}>POINTS SYSTEM</div>
                  {[["Daily GM","1 pt × multiplier"],["3 day streak","1.2x on all points"],["7 day streak","1.5x on all points"],["15 day streak","2x on all points"],["First GM of day","+2 bonus points"],["Streak restore","Costs points to use"]].map(([l,r])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #161B22",fontSize:".78rem"}}>
                      <span style={{color:"#718096"}}>{l}</span>
                      <span style={{fontFamily:"monospace",color:"#4DA2FF",fontWeight:500}}>{r}</span>
                    </div>
                  ))}
                </div>

                {/* Restore cost table */}
                <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:"16px"}}>
                  <div style={{fontSize:".72rem",color:"#4A5568",letterSpacing:".06em",marginBottom:12}}>RESTORE COSTS</div>
                  {[["1–7 days",25,streak>=1&&streak<=7],["8–15 days",50,streak>=8&&streak<=15],["16–30 days",75,streak>=16&&streak<=30],["30+ days",100,streak>30]].map(([l,c,a])=>(
                    <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #161B22",fontSize:".78rem"}}>
                      <span style={{color:a?"#FC8181":"#718096"}}>{a?"→ ":""}{l}</span>
                      <span style={{fontFamily:"monospace",color:a?"#FC8181":"#374151",fontWeight:a?500:400}}>{c} pts</span>
                    </div>
                  ))}
                  <div style={{fontSize:".68rem",color:"#374151",marginTop:8}}>24 hour window after missing a day</div>
                </div>

              </>
            )}
          </div>
        )}

      </div>

      {/* BOTTOM NAV — mobile */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"rgba(11,15,20,.95)",backdropFilter:"blur(16px)",borderTop:"1px solid #1E2733",zIndex:100,display:"flex",justifyContent:"center"}}>
        <div style={{maxWidth:640,width:"100%",display:"flex"}}>
          {[["home","Home"],["leaderboard","Board"],["stats","Stats"]].map(([id,l])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:"12px 0 14px",background:"transparent",border:"none",color:tab===id?"#4DA2FF":"#374151",fontSize:".72rem",fontWeight:tab===id?600:400,cursor:"pointer",fontFamily:"Inter,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",gap:3,transition:"color .15s"}}>
              <div style={{width:4,height:4,borderRadius:"50%",background:tab===id?"#4DA2FF":"transparent",marginBottom:1,transition:"background .15s"}}/>
              {l}
            </button>
          ))}
        </div>
      </div>

    </>
  );
}
