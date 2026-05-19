import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { injected } from "wagmi/connectors";
import { CONTRACT_ADDRESS, CONTRACT_ABI, arcTestnet } from "./config.js";

const fmt    = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : "";
const fmtPts = (n) => (Number(n)/1e18).toFixed(1);
const mTxt   = (s) => s>=15?"2x":s>=7?"1.5x":"1x";

// Arc-style layered atmospheric background
function AmbientBg({ streak }) {
  // Arc brand blues shift with streak level
  const glowColor = streak>=15 ? "rgba(74,222,128,0.06)" : streak>=7 ? "rgba(96,165,250,0.07)" : "rgba(77,162,255,0.08)";
  const glowColor2 = streak>=15 ? "rgba(74,222,128,0.03)" : streak>=7 ? "rgba(77,162,255,0.04)" : "rgba(14,94,163,0.12)";
  return (
    <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden"}}>

      {/* Layer 1 — deep navy base */}
      <div style={{position:"absolute",inset:0,background:"linear-gradient(160deg,#040810 0%,#060c18 40%,#050912 70%,#030608 100%)"}}/>

      {/* Layer 2 — Arc blue atmospheric mesh, slow drift */}
      <div style={{position:"absolute",inset:"-20%",background:`radial-gradient(ellipse 70% 55% at 55% 15%,rgba(14,60,120,0.45) 0%,transparent 60%),radial-gradient(ellipse 50% 40% at 20% 60%,rgba(8,40,90,0.3) 0%,transparent 55%),radial-gradient(ellipse 40% 35% at 80% 75%,rgba(10,50,100,0.2) 0%,transparent 50%)`,animation:"meshDrift 18s ease-in-out infinite",transition:"opacity 2s ease"}}/>

      {/* Layer 3 — soft cyan glow top center (Arc accent) */}
      <div style={{position:"absolute",top:"-5%",left:"25%",right:"25%",height:"50%",background:`radial-gradient(ellipse 100% 80% at 50% 0%,${glowColor} 0%,transparent 70%)`,animation:"glowPulse 8s ease-in-out infinite",transition:"background 2.5s ease"}}/>

      {/* Layer 4 — secondary deep glow bottom right */}
      <div style={{position:"absolute",bottom:"-10%",right:"-5%",width:"60%",height:"60%",background:`radial-gradient(ellipse 80% 70% at 70% 80%,${glowColor2} 0%,transparent 65%)`,animation:"glowPulse 12s ease-in-out 4s infinite"}}/>

      {/* Layer 5 — Arc curved line SVG overlay */}
      <div style={{position:"absolute",inset:0,opacity:0.035,animation:"curveDrift 20s ease-in-out infinite"}}>
        <svg width="100%" height="100%" viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="600" cy="-80" rx="700" ry="400" stroke="rgba(77,162,255,0.6)" strokeWidth="0.8" filter="url(#blur1)"/>
          <ellipse cx="600" cy="-40" rx="500" ry="280" stroke="rgba(77,162,255,0.4)" strokeWidth="0.6" filter="url(#blur1)"/>
          <ellipse cx="1100" cy="700" rx="500" ry="300" stroke="rgba(77,162,255,0.3)" strokeWidth="0.5" filter="url(#blur1)"/>
          <defs><filter id="blur1"><feGaussianBlur stdDeviation="4"/></filter></defs>
        </svg>
      </div>

      {/* Layer 6 — grain/noise texture for premium feel */}
      <div style={{position:"absolute",inset:0,backgroundImage:"url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")",opacity:0.55,mixBlendMode:"overlay"}}/>

      {/* Layer 7 — vignette edges */}
      <div style={{position:"absolute",inset:0,background:"radial-gradient(ellipse 85% 80% at 50% 50%,transparent 40%,rgba(2,4,10,0.7) 100%)",pointerEvents:"none"}}/>

      {/* Layer 8 — very subtle top edge glow (cinematic) */}
      <div style={{position:"absolute",top:0,left:0,right:0,height:"1px",background:"linear-gradient(90deg,transparent,rgba(77,162,255,0.12),rgba(77,162,255,0.18),rgba(77,162,255,0.12),transparent)"}}/>

    </div>
  );
}

function useCountdown(ms) {
  const [s,setS]=useState(0);
  useEffect(()=>{
    const t=()=>setS(Math.max(0,Math.floor((ms-Date.now())/1000)));
    t();const id=setInterval(t,1000);return()=>clearInterval(id);
  },[ms]);
  return s;
}

// Live feed — pulls from GM events
function useFeed(rpcCall, contractAddress) {
  const [feed,setFeed]=useState([]);
  const fetch=useCallback(async()=>{
    try{
      const EV_GM="0x31fb3916a29c76d6577923408cb316e0019051546a781f4e084859323f833a68";
      const logs=await rpcCall("eth_getLogs",[{address:contractAddress,fromBlock:"0x0",toBlock:"latest",topics:[EV_GM]}]);
      if(!logs.result)return;
      const items=logs.result.slice(-20).reverse().map((l,i)=>{
        const wallet="0x"+l.topics[1].slice(26);
        const streak=Number(BigInt("0x"+l.data.slice(66,130)));
        return{id:i,wallet,streak,ago:Math.floor(Math.random()*30)+1+"m ago"};
      });
      setFeed(items.slice(0,8));
    }catch{}
  },[rpcCall,contractAddress]);
  useEffect(()=>{fetch();const id=setInterval(fetch,60000);return()=>clearInterval(id);},[]);
  return feed;
}

function Leaderboard({lb,address,onClose}) {
  return(
    <div style={{position:"fixed",inset:0,zIndex:500,backdropFilter:"blur(20px)",background:"rgba(5,5,8,0.85)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{position:"absolute",right:0,top:0,bottom:0,width:"min(380px,100vw)",background:"rgba(10,10,18,0.95)",borderLeft:"1px solid rgba(255,255,255,0.06)",display:"flex",flexDirection:"column",animation:"slideRight .25s ease"}}>
        <div style={{padding:"28px 24px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontSize:"1.1rem",fontWeight:700,color:"#fff",letterSpacing:"-.02em"}}>Leaderboard</div>
          <button onClick={onClose} style={{background:"none",border:"none",color:"rgba(255,255,255,0.3)",fontSize:"1.4rem",cursor:"pointer",lineHeight:1,padding:4}}>×</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"0 24px 24px"}}>
          {lb.map((e,i)=>{
            const isMe=e.w?.toLowerCase()===address?.toLowerCase();
            const sc=e.streak>=15?"#4ade80":e.streak>=7?"#60a5fa":"rgba(255,255,255,0.4)";
            return(
              <div key={e.w} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:"1px solid rgba(255,255,255,0.04)",animation:`fadeUp .3s ease ${i*.03}s both`}}>
                <div style={{width:20,textAlign:"right",fontSize:".75rem",fontWeight:600,color:i===0?"#F6C90E":i===1?"#9CA3AF":i===2?"#CD7F32":"rgba(255,255,255,0.2)",fontFamily:"monospace",flexShrink:0}}>{i+1}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:".82rem",color:isMe?"#a78bfa":"rgba(255,255,255,0.8)",fontFamily:"monospace",letterSpacing:".02em"}}>{fmt(e.w)}{isMe&&<span style={{marginLeft:6,fontSize:".6rem",color:"#a78bfa",fontFamily:"Inter,sans-serif"}}> you</span>}</div>
                  <div style={{fontSize:".68rem",color:"rgba(255,255,255,0.2)",marginTop:2}}>{e.streak}d · {mTxt(e.streak)}</div>
                </div>
                <div style={{fontSize:".88rem",fontWeight:600,color:"#fff",fontFamily:"monospace",fontVariantNumeric:"tabular-nums",flexShrink:0}}>{e.pts.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const {address,isConnected,chain}=useAccount();
  const {connect}=useConnect();
  const {disconnect}=useDisconnect();
  const [showLb,setShowLb]=useState(false);
  const [showProfile,setShowProfile]=useState(false);
  const wrongNet=isConnected&&chain?.id!==arcTestnet.id;

  const rpcCall=useCallback(async(method,params)=>{
    const r=await fetch("https://rpc.testnet.arc.network",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
    return r.json();
  },[]);

  const {data:uMain,refetch:rUser} =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserMain",args:[address],enabled:!!address});
  const {data:uStreak,refetch:rStr}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserStreak",args:[address],enabled:!!address});
  const {data:gGMs,refetch:rGMs}  =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getTotalGlobalGMs"});
  const {data:uCount}              =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserCount"});
  const {data:lbPage}              =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardPage",args:[0n,50n]});
  const {data:lbStats}             =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardStats",args:[0n,50n]});

  const {writeContract:wGM,data:gmH,isPending:gmP}=useWriteContract();
  const {isLoading:gmC,isSuccess:gmD}=useWaitForTransactionReceipt({hash:gmH});
  const {writeContract:wRes,data:resH,isPending:resP}=useWriteContract();
  const {isLoading:resC,isSuccess:resD}=useWaitForTransactionReceipt({hash:resH});

  const refAll=useCallback(()=>{rUser();rStr();rGMs();},[]);
  useEffect(()=>{if(gmD||resD)refAll();},[gmD,resD]);

  const pts    =uMain?fmtPts(uMain[0]):"0";
  const myGMs  =uMain?Number(uMain[1]):0;
  const streak =uMain?Number(uMain[2]):0;
  const canGM  =uMain?uMain[3]:true;
  const longest=uStreak?Number(uStreak[1]):0;
  const canRes =uStreak?uStreak[3]:false;
  const resCost=uStreak?fmtPts(uStreak[4]):"0";
  const gCount =gGMs?Number(gGMs):0;
  const uCountN=uCount?Number(uCount):0;

  const lb=(lbPage&&lbStats)?lbPage[0].map((w,i)=>({
    w,pts:Number(lbPage[1][i])/1e18,
    streak:Number(lbStats[0][i]),
  })).sort((a,b)=>b.pts-a.pts).slice(0,20):[];
  const myRank=lb.findIndex(e=>e.w?.toLowerCase()===address?.toLowerCase())+1;

  const midnight=(()=>{const n=new Date();return Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1);})();
  const secsLeft=useCountdown(midnight);
  const hh=Math.floor(secsLeft/3600);
  const mm=Math.floor((secsLeft%3600)/60);
  const ss=secsLeft%60;
  const pad=n=>String(n).padStart(2,"0");

  const doGM=()=>{if(!canGM||gmP||gmC||!isConnected)return;wGM({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"gm",chainId:arcTestnet.id});};
  const doRes=()=>wRes({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"restoreStreak",chainId:arcTestnet.id});
  const doSwitch=async()=>{try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x4cef52"}]});}catch{await window.ethereum.request({method:"wallet_addEthereumChain",params:[{chainId:"0x4cef52",chainName:"Arc Testnet",nativeCurrency:{name:"USDC",symbol:"USDC",decimals:18},rpcUrls:["https://rpc.testnet.arc.network"],blockExplorerUrls:["https://testnet.arcscan.app"]}]});}};

  const streakColor=streak>=15?"#4ade80":streak>=7?"#60a5fa":"#a78bfa";

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{height:100%;overflow-x:hidden;-webkit-tap-highlight-color:transparent}
        body{font-family:'Inter',sans-serif;background:#040810;color:#fff;min-height:100vh;-webkit-font-smoothing:antialiased}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideRight{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes breathe{0%,100%{opacity:.55}50%{opacity:.9}}
        @keyframes meshDrift{0%{transform:translate(0,0) rotate(0deg)}25%{transform:translate(1.5%,-1%) rotate(.3deg)}50%{transform:translate(-1%,1.5%) rotate(-.2deg)}75%{transform:translate(.8%,.8%) rotate(.15deg)}100%{transform:translate(0,0) rotate(0deg)}}
        @keyframes glowPulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes curveDrift{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-12px) scale(1.015)}}
        button,a{cursor:pointer;font-family:'Inter',sans-serif;text-decoration:none}
        ::-webkit-scrollbar{width:0}
      `}</style>

      <AmbientBg streak={streak}/>

      {/* FLOATING NAV */}
      <nav style={{position:"fixed",top:0,left:0,right:0,zIndex:100,padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{fontSize:".9rem",fontWeight:700,color:"rgba(255,255,255,0.7)",letterSpacing:"-.01em"}}>
          ArcGM <span style={{fontSize:".6rem",color:"rgba(255,255,255,0.2)",fontWeight:400,letterSpacing:".06em"}}>TESTNET</span>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <button onClick={()=>setShowLb(true)} style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:20,color:"rgba(255,255,255,0.45)",fontSize:".75rem",fontWeight:500,padding:"6px 14px",transition:"all .2s"}}
            onMouseEnter={e=>e.target.style.color="rgba(255,255,255,0.8)"}
            onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.45)"}>
            Leaderboard
          </button>
          <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" style={{background:"rgba(255,255,255,0.05)",borderRadius:20,color:"rgba(255,255,255,0.45)",fontSize:".75rem",fontWeight:500,padding:"6px 14px",transition:"all .2s"}}
            onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,0.8)"}
            onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.45)"}>
            Get USDC
          </a>
          {!isConnected?(
            <button onClick={()=>connect({connector:injected()})} style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:20,color:"rgba(255,255,255,0.8)",fontSize:".75rem",fontWeight:600,padding:"6px 16px",transition:"all .2s"}}
              onMouseEnter={e=>{e.target.style.background="rgba(255,255,255,0.14)";e.target.style.color="#fff"}}
              onMouseLeave={e=>{e.target.style.background="rgba(255,255,255,0.08)";e.target.style.color="rgba(255,255,255,0.8)"}}>
              Connect Wallet
            </button>
          ):wrongNet?(
            <button onClick={doSwitch} style={{background:"transparent",border:"1px solid rgba(252,129,129,0.3)",borderRadius:20,color:"#FC8181",fontSize:".75rem",padding:"6px 14px"}}>Wrong Network</button>
          ):(
            <button onClick={()=>setShowProfile(!showProfile)} style={{background:"rgba(255,255,255,0.05)",border:"none",borderRadius:20,color:"rgba(255,255,255,0.45)",fontSize:".72rem",padding:"6px 14px",display:"flex",alignItems:"center",gap:5,transition:"all .2s"}}
              onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,0.8)"}
              onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.45)"}>
              <div style={{width:5,height:5,borderRadius:"50%",background:"#4ade80",flexShrink:0}}/>
              {fmt(address)}
            </button>
          )}
        </div>
      </nav>

      {/* MAIN FULLSCREEN HERO */}
      <main style={{position:"relative",zIndex:10,minHeight:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"100px 24px 120px",textAlign:"center"}}>

        {/* Hero radial glow — illuminates text from behind */}
        <div style={{position:"absolute",top:"30%",left:"50%",transform:"translate(-50%,-50%)",width:"min(600px,90vw)",height:"min(400px,60vw)",background:`radial-gradient(ellipse 100% 100% at 50% 50%,rgba(77,162,255,0.06) 0%,rgba(14,60,120,0.04) 40%,transparent 70%)`,pointerEvents:"none",animation:"glowPulse 6s ease-in-out infinite",zIndex:0}}/>

        {!isConnected?(
          // NOT CONNECTED
          <div style={{animation:"fadeUp .6s ease",position:"relative",zIndex:1}}>
            <div style={{fontSize:"clamp(3rem,10vw,6.5rem)",fontWeight:900,color:"#fff",letterSpacing:"-.04em",lineHeight:.95,marginBottom:24,textShadow:"0 0 80px rgba(167,139,250,0.15)"}}>
              gm, Arc.
            </div>
            <div style={{fontSize:"clamp(.95rem,2.5vw,1.15rem)",color:"rgba(255,255,255,0.3)",fontWeight:300,lineHeight:1.7,marginBottom:48,maxWidth:400,margin:"0 auto 48px",letterSpacing:".01em"}}>
              Build streaks. Earn reputation.<br/>The daily social layer for the Arc ecosystem.
            </div>
            <button onClick={()=>connect({connector:injected()})}
              style={{background:"rgba(255,255,255,0.07)",border:"1px solid rgba(255,255,255,0.12)",borderRadius:12,color:"rgba(255,255,255,0.8)",fontSize:"1rem",fontWeight:600,padding:"14px 40px",letterSpacing:"-.01em",transition:"all .25s",backdropFilter:"blur(8px)"}}
              onMouseEnter={e=>{e.target.style.background="rgba(255,255,255,0.12)";e.target.style.color="#fff";e.target.style.borderColor="rgba(255,255,255,0.2)"}}
              onMouseLeave={e=>{e.target.style.background="rgba(255,255,255,0.07)";e.target.style.color="rgba(255,255,255,0.8)";e.target.style.borderColor="rgba(255,255,255,0.12)"}}>
              Connect to start
            </button>
            <div style={{marginTop:56,fontSize:".75rem",color:"rgba(255,255,255,0.15)",letterSpacing:".08em"}}>
              {gCount.toLocaleString()} GMs · {uCountN} participants
            </div>
          </div>

        ):canGM?(
          // CAN GM
          <div style={{animation:"fadeUp .5s ease",position:"relative",zIndex:1}}>
            {streak>0&&(
              <div style={{fontSize:"clamp(.7rem,1.5vw,.82rem)",color:streakColor,letterSpacing:".2em",textTransform:"uppercase",fontWeight:500,marginBottom:20,opacity:.7,animation:"breathe 3s ease infinite"}}>
                {streak} day streak
              </div>
            )}
            <button onClick={doGM} disabled={gmP||gmC}
              style={{fontSize:"clamp(4.5rem,14vw,9rem)",fontWeight:900,color:gmP||gmC?"rgba(255,255,255,0.2)":"#fff",background:"transparent",border:"none",letterSpacing:"-.04em",lineHeight:.9,cursor:gmP||gmC?"not-allowed":"pointer",transition:"all .3s",display:"block",marginBottom:20,textShadow:gmP||gmC?"none":`0 0 120px rgba(77,162,255,0.18), 0 0 40px rgba(255,255,255,0.06)`}}
              onMouseEnter={e=>{if(!gmP&&!gmC)e.target.style.textShadow="0 0 160px rgba(77,162,255,0.28), 0 0 60px rgba(255,255,255,0.1)"}}
              onMouseLeave={e=>{if(!gmP&&!gmC)e.target.style.textShadow="0 0 120px rgba(77,162,255,0.18), 0 0 40px rgba(255,255,255,0.06)"}}>
              {gmP?"...":gmC?"...":"gm"}
            </button>
            <div style={{fontSize:"clamp(.7rem,1.5vw,.8rem)",color:"rgba(255,255,255,0.18)",letterSpacing:".2em",textTransform:"uppercase",fontWeight:400,marginBottom:48}}>
              {gmP?"confirming":gmC?"on chain":"tap to gm on arc"}
            </div>

            {/* Bottom stats row — no boxes */}
            <div style={{display:"flex",gap:"clamp(20px,5vw,48px)",justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
              {[
                myRank>0?["Rank",`#${myRank}`]:null,
                ["Points",pts],
                ["GMs",myGMs],
                streak>0?["Boost",mTxt(streak)]:null,
              ].filter(Boolean).map(([l,v])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:"clamp(.6rem,1.2vw,.68rem)",color:"rgba(255,255,255,0.2)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>{l}</div>
                  <div style={{fontSize:"clamp(.95rem,2vw,1.1rem)",fontWeight:600,color:"rgba(255,255,255,0.65)",fontVariantNumeric:"tabular-nums"}}>{v}</div>
                </div>
              ))}
            </div>

            {/* Streak restore */}
            {canRes&&(
              <div style={{marginTop:40,animation:"fadeUp .4s ease"}}>
                <div style={{fontSize:".78rem",color:"rgba(252,129,129,0.6)",marginBottom:10,letterSpacing:".04em"}}>Streak broken yesterday — restore for {resCost} pts</div>
                <button onClick={doRes} disabled={resP||resC}
                  style={{background:"transparent",border:"1px solid rgba(252,129,129,0.2)",borderRadius:8,color:"rgba(252,129,129,0.7)",fontSize:".78rem",padding:"8px 24px",transition:"all .2s"}}
                  onMouseEnter={e=>e.target.style.borderColor="rgba(252,129,129,0.4)"}
                  onMouseLeave={e=>e.target.style.borderColor="rgba(252,129,129,0.2)"}>
                  {resP||resC?"...":"Restore streak"}
                </button>
              </div>
            )}
          </div>

        ):(
          // ALREADY GMed — COUNTDOWN
          <div style={{animation:"fadeUp .5s ease",position:"relative",zIndex:1}}>
            <div style={{fontSize:"clamp(.7rem,1.5vw,.82rem)",color:streakColor,letterSpacing:".2em",textTransform:"uppercase",fontWeight:500,marginBottom:24,opacity:.7}}>
              {streak} day streak · {mTxt(streak)} multiplier
            </div>
            <div style={{fontSize:"clamp(.65rem,1.2vw,.75rem)",color:"rgba(255,255,255,0.2)",letterSpacing:".2em",textTransform:"uppercase",marginBottom:12,fontWeight:400}}>
              next gm in
            </div>
            <div style={{fontSize:"clamp(3rem,10vw,6rem)",fontWeight:900,color:"#fff",letterSpacing:"-.03em",lineHeight:1,marginBottom:48,fontVariantNumeric:"tabular-nums",textShadow:"0 0 80px rgba(77,162,255,0.15)"}}>
              {pad(hh)}:{pad(mm)}:{pad(ss)}
            </div>

            {/* Streak progress — no box, just dots */}
            <div style={{display:"flex",gap:4,justifyContent:"center",marginBottom:48,maxWidth:240,margin:"0 auto 48px"}}>
              {Array.from({length:15},(_,i)=>(
                <div key={i} style={{width:i<streak?8:6,height:i<streak?8:6,borderRadius:"50%",background:i<streak?(i<7?"#a78bfa":"#4ade80"):"rgba(255,255,255,0.08)",transition:"all .4s ease",flexShrink:0}}/>
              ))}
            </div>

            {/* Stats row */}
            <div style={{display:"flex",gap:"clamp(20px,5vw,48px)",justifyContent:"center",alignItems:"center",flexWrap:"wrap"}}>
              {[
                myRank>0?["Rank",`#${myRank}`]:null,
                ["Points",pts],
                ["GMs",myGMs],
                ["Streak",`${streak}d`],
              ].filter(Boolean).map(([l,v])=>(
                <div key={l} style={{textAlign:"center"}}>
                  <div style={{fontSize:"clamp(.6rem,1.2vw,.68rem)",color:"rgba(255,255,255,0.2)",letterSpacing:".12em",textTransform:"uppercase",marginBottom:4}}>{l}</div>
                  <div style={{fontSize:"clamp(.95rem,2vw,1.1rem)",fontWeight:600,color:"rgba(255,255,255,0.65)",fontVariantNumeric:"tabular-nums"}}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM LEFT */}
      <div style={{position:"fixed",bottom:28,left:24,zIndex:50,display:"flex",flexDirection:"column",gap:10}}>
        <button onClick={()=>{const text=`${streak>0?`${streak} day streak on`:"saying gm on"} ArcGM — the daily social layer for Arc ecosystem.\narcgm.vercel.app\n#ArcGM #ArcNetwork`;window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank");}}
          style={{background:"none",border:"none",fontSize:".72rem",color:"rgba(255,255,255,0.25)",textAlign:"left",padding:0,display:"flex",alignItems:"center",gap:5,transition:"color .2s",letterSpacing:".04em"}}
          onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,0.6)"}
          onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}>
          <span style={{fontSize:".65rem",opacity:.6}}>✦</span> Share on X
        </button>
        <a href="https://x.com/mkoneth" target="_blank" rel="noopener noreferrer"
          style={{fontSize:".72rem",color:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",gap:5,transition:"color .2s",letterSpacing:".04em"}}
          onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,0.6)"}
          onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}>
          <span style={{fontSize:".65rem",opacity:.6}}>✦</span> Follow @mkoneth
        </a>
      </div>

      {/* BOTTOM RIGHT */}
      <div style={{position:"fixed",bottom:28,right:24,zIndex:50,display:"flex",flexDirection:"column",gap:10,alignItems:"flex-end"}}>
        <a href="https://testnet.arcscan.app/address/0x4062bf4D6650bA60d46d6177F2d880020B84C3a6" target="_blank" rel="noopener noreferrer"
          style={{fontSize:".72rem",color:"rgba(255,255,255,0.25)",transition:"color .2s",letterSpacing:".04em"}}
          onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,0.6)"}
          onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}>
          Explorer
        </a>
        <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
          style={{fontSize:".72rem",color:"rgba(255,255,255,0.25)",transition:"color .2s",letterSpacing:".04em"}}
          onMouseEnter={e=>e.currentTarget.style.color="rgba(255,255,255,0.6)"}
          onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}>
          Get USDC
        </a>
      </div>

      {/* PROFILE DROPDOWN */}
      {showProfile&&isConnected&&(
        <div style={{position:"fixed",top:52,right:20,zIndex:200,background:"rgba(8,8,16,0.95)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:14,padding:20,minWidth:220,backdropFilter:"blur(24px)",animation:"fadeIn .18s ease"}}
          onMouseLeave={()=>setShowProfile(false)}>
          <div style={{fontSize:".68rem",color:"rgba(255,255,255,0.2)",letterSpacing:".1em",marginBottom:14}}>PROFILE</div>
          {[
            ["Wallet",fmt(address)],
            ["Points",pts],
            ["Streak",`${streak}d · ${mTxt(streak)}`],
            ["Longest",`${longest}d`],
            ["Total GMs",myGMs],
            myRank>0?["Rank",`#${myRank}`]:null,
          ].filter(Boolean).map(([l,v])=>(
            <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid rgba(255,255,255,0.03)",fontSize:".78rem"}}>
              <span style={{color:"rgba(255,255,255,0.25)"}}>{l}</span>
              <span style={{color:"rgba(255,255,255,0.7)",fontFamily:"monospace"}}>{v}</span>
            </div>
          ))}
          {canRes&&(
            <div style={{marginTop:14,paddingTop:12,borderTop:"1px solid rgba(255,255,255,0.05)"}}>
              <div style={{fontSize:".72rem",color:"rgba(252,129,129,0.6)",marginBottom:8}}>Restore streak — {resCost} pts</div>
              <button onClick={()=>{doRes();setShowProfile(false);}} style={{width:"100%",background:"transparent",border:"1px solid rgba(252,129,129,0.15)",borderRadius:6,color:"rgba(252,129,129,0.6)",fontSize:".75rem",padding:"7px 0",transition:"all .2s"}}
                onMouseEnter={e=>e.target.style.borderColor="rgba(252,129,129,0.3)"}
                onMouseLeave={e=>e.target.style.borderColor="rgba(252,129,129,0.15)"}>
                Restore
              </button>
            </div>
          )}
          <button onClick={()=>{disconnect();setShowProfile(false);}} style={{width:"100%",marginTop:10,background:"transparent",border:"none",color:"rgba(255,255,255,0.15)",fontSize:".72rem",padding:"6px 0",letterSpacing:".04em",transition:"color .2s"}}
            onMouseEnter={e=>e.target.style.color="rgba(255,255,255,0.4)"}
            onMouseLeave={e=>e.target.style.color="rgba(255,255,255,0.15)"}>
            Disconnect
          </button>
        </div>
      )}

      {/* LEADERBOARD */}
      {showLb&&<Leaderboard lb={lb} address={address} onClose={()=>setShowLb(false)}/>}
    </>
  );
}
