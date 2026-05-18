import { useState, useEffect, useRef, useCallback } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { injected } from "wagmi/connectors";
import { parseUnits } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI, arcTestnet } from "./config.js";

// ── HELPERS ──
const fmt      = (a) => a ? `${a.slice(0,6)}...${a.slice(-4)}` : "";
const fmtPts   = (n) => (Number(n)/1e18).toFixed(1);
const fmtUsdc  = (n) => (Number(n)/1e6).toFixed(2);
const fmtPrice = (n) => "$"+(Number(n)/1e18).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDiff  = (cur,snap) => { if(!cur||!snap)return null; const d=Number(cur)-Number(snap); return{d,pct:(d/Number(snap))*100,up:d>=0}; };
const multTxt  = (m) => Number(m)>=200?"2x":Number(m)>=150?"1.5x":Number(m)>=120?"1.2x":"1x";

// ── CORRECT SELECTORS (verified with ethers.id) ──
const SEL_GET_USER_ENTRY = "0x37eaea2c"; // getUserEntry(uint256,address)
const SEL_GET_ROUND_INFO = "0x88c3ffb0"; // getRoundInfo(uint256)
const EV_PREDICTED       = "0xbf3cbd05bacafde21465fd778d0b9773b25f9c1c7b7ec49f1858e1e004fbc06d";

// ── LOGOS ──
const BtcLogo = ({s=40}) => (
  <div style={{width:s,height:s,borderRadius:"50%",background:"#F7931A",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
    <svg width={s*.54} height={s*.54} viewBox="0 0 26 26" fill="white">
      <path d="M18.6 11.3c.4-2.5-1.5-3.8-4.1-4.7l.8-3.4-2-.5-.8 3.3-1.6-.4.8-3.3-2-.5-.8 3.4-3.2-.8-.5 2.1s1.5.3 1.4.4c.8.2 1 .7.9 1.1l-2.2 8.7c-.1.3-.4.7-1.1.5 0 0-1.4-.4-1.4-.4l-1 2.3 3 .8.8-.2-.9 3.4 2 .5.9-3.4 1.6.4-.9 3.4 2 .5.9-3.5c3.4.6 5.9.4 7-2.7.9-2.5-.1-3.9-1.8-4.8 1.3-.3 2.2-1.1 2.4-2.8zm-4.4 6.2c-.6 2.5-5 1.2-6.4.8l1.1-4.6c1.4.4 5.9 1.1 5.3 3.8zm.7-6.2c-.6 2.3-4.2 1.1-5.4.8l1-4.1c1.2.3 5.1 1 4.4 3.3z"/>
    </svg>
  </div>
);
const EthLogo = ({s=40}) => (
  <div style={{width:s,height:s,borderRadius:"50%",background:"#627EEA",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
    <svg width={s*.5} height={s*.5} viewBox="0 0 24 24" fill="white">
      <path d="M12 1.75L5.75 12.25 12 15.5l6.25-3.25L12 1.75z" opacity=".6"/>
      <path d="M5.75 13.5L12 22.25l6.25-8.75L12 17l-6.25-3.5z" opacity=".6"/>
      <path d="M12 1.75v13.75l6.25-3.25L12 1.75z" opacity=".9"/>
      <path d="M12 15.5v6.75l6.25-8.75L12 15.5z" opacity=".9"/>
    </svg>
  </div>
);

function Countdown({ms}) {
  const [s,setS]=useState(0);
  useEffect(()=>{const t=()=>setS(Math.max(0,Math.floor((ms-Date.now())/1000)));t();const id=setInterval(t,1000);return()=>clearInterval(id);},[ms]);
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return <span style={{fontVariantNumeric:"tabular-nums"}}>{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(sec).padStart(2,"0")}</span>;
}

function TVChart({sym="BINANCE:BTCUSDT"}) {
  const ref=useRef(null);
  useEffect(()=>{
    if(!ref.current)return;
    ref.current.innerHTML="";
    const s=document.createElement("script");
    s.src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.async=true;
    s.innerHTML=JSON.stringify({autosize:true,symbol:sym,interval:"D",timezone:"Etc/UTC",theme:"dark",style:"1",locale:"en",backgroundColor:"rgba(17,22,29,1)",gridColor:"rgba(255,255,255,0.04)",hide_side_toolbar:true,allow_symbol_change:false,save_image:false,hide_volume:false,support_host:"https://www.tradingview.com"});
    ref.current.appendChild(s);
  },[sym]);
  return <div ref={ref} style={{height:"100%",width:"100%"}}/>;
}

function ShareModal({pos,onClose}) {
  const [theme,setTheme]=useState(0);
  const [hw,setHw]=useState(false);
  const themes=[{bg:"#0B0F14",border:"#1E2733",accent:"#E8F0FE",label:"Dark"},{bg:"#0A1628",border:"#1E3A5F",accent:"#4A9EFF",label:"Blue"},{bg:"#140A00",border:"#3D2000",accent:"#F7931A",label:"BTC"}];
  const t=themes[theme];
  const ticker=pos.asset===0?"BTC":"ETH";
  const shareToX=()=>{
    const text=`${ticker} ${pos.isUp?"UP":"DOWN"} on ArcGM\n${pos.winning?"Winning":"Open"} · ${pos.streak}d streak · ${multTxt(pos.mult)} boost\narcgm.vercel.app #ArcGM #ArcNetwork`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank");
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(4px)"}} onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:12,padding:24,width:520,maxWidth:"95vw",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:12,right:12,background:"none",border:"none",color:"#4A5568",cursor:"pointer",fontSize:"1.2rem",lineHeight:1}}>×</button>
        <div style={{fontSize:"0.95rem",fontWeight:600,color:"#E2E8F0",marginBottom:16}}>Share position</div>
        <div style={{display:"flex",gap:8,marginBottom:16}}>
          {themes.map((th,i)=>(
            <button key={i} onClick={()=>setTheme(i)} style={{flex:1,padding:"8px 0",borderRadius:6,border:`1px solid ${i===theme?th.accent:"#1E2733"}`,background:th.bg,color:i===theme?th.accent:"#4A5568",fontSize:"0.75rem",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>
              {th.label}
            </button>
          ))}
        </div>
        <div style={{background:t.bg,border:`1px solid ${t.border}`,borderRadius:8,padding:20,marginBottom:16}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{fontSize:"0.78rem",fontWeight:700,color:t.accent,letterSpacing:"0.08em"}}>ARCGM</div>
            <div style={{fontSize:"0.68rem",color:"#4A5568"}}>arcgm.vercel.app</div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
            {pos.asset===0?<BtcLogo s={32}/>:<EthLogo s={32}/>}
            <div>
              <div style={{fontSize:"0.72rem",color:"#718096"}}>Predicted</div>
              <div style={{fontSize:"1rem",fontWeight:600,color:pos.isUp?"#48BB78":"#FC8181"}}>{ticker} {pos.isUp?"UP":"DOWN"}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[["Snapshot",pos.snapshot?fmtPrice(pos.snapshot):"--"],["Status",pos.winning?"Winning":"Open"],["Streak",`${pos.streak}d ${multTxt(pos.mult)}`]].map(([l,v])=>(
              <div key={l} style={{background:"rgba(255,255,255,0.04)",borderRadius:4,padding:"8px 10px"}}>
                <div style={{fontSize:"0.58rem",color:"#4A5568",marginBottom:2}}>{l.toUpperCase()}</div>
                <div style={{fontSize:"0.78rem",fontWeight:600,color:"#E2E8F0"}}>{v}</div>
              </div>
            ))}
          </div>
          {!hw&&<div style={{marginTop:12,fontSize:"0.68rem",color:"#4A5568",fontFamily:"monospace"}}>{pos.wallet}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
          <span style={{fontSize:"0.78rem",color:"#718096"}}>Hide wallet</span>
          <div onClick={()=>setHw(!hw)} style={{width:36,height:20,background:hw?"#4A9EFF":"#1E2733",borderRadius:10,cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
            <div style={{width:16,height:16,background:"#fff",borderRadius:"50%",position:"absolute",top:2,left:hw?18:2,transition:"left 0.2s"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={shareToX} style={{flex:1,padding:"10px 0",borderRadius:6,border:"none",background:"#E2E8F0",color:"#0B0F14",fontSize:"0.85rem",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Share on X</button>
          <button onClick={onClose} style={{flex:1,padding:"10px 0",borderRadius:6,border:"1px solid #1E2733",background:"transparent",color:"#718096",fontSize:"0.85rem",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const {address,isConnected,chain}=useAccount();
  const {connect}=useConnect();
  const {disconnect}=useDisconnect();
  const [tab,setTab]=useState("predict");
  const [asset,setAsset]=useState(0);
  const [btab,setBtab]=useState("positions");
  const [amt,setAmt]=useState("5");
  const [sharePos,setSharePos]=useState(null);
  const [history,setHistory]=useState([]);
  const [hloading,setHloading]=useState(false);

  const wrongNet=isConnected&&chain?.id!==arcTestnet.id;
  const ROUND_TYPE=1; // always 24h

  // READS
  const {data:globalGMs,refetch:rGMs}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getTotalGlobalGMs"});
  const {data:btcPx,refetch:rBtc}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getCurrentPrice",args:[0]});
  const {data:ethPx}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getCurrentPrice",args:[1],enabled:false});
  const {data:r24Btc}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"get24hRoundId",args:[0]});
  const {data:r24Eth}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"get24hRoundId",args:[1]});
  const {data:ethAsset}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"assets",args:[1]});
  const ethActive=ethAsset?ethAsset[2]:false;
  const curRid=asset===0?r24Btc:r24Eth;
  const curPx=asset===0?btcPx:ethPx;

  const {data:rInfo,refetch:rRound}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getRoundInfo",args:[curRid],enabled:!!curRid});
  const {data:rPool,refetch:rPool2}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getRoundPool",args:[curRid],enabled:!!curRid});
  const {data:uMain,refetch:rUser}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserMain",args:[address],enabled:!!address});
  const {data:uStreak,refetch:rStreak}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserStreak",args:[address],enabled:!!address});
  const {data:uMult}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getMultiplier",args:[address],enabled:!!address});
  const {data:uEntry,refetch:rEntry}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserEntry",args:[curRid,address],enabled:!!curRid&&!!address});
  const {data:lbPage}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardPage",args:[0n,50n]});
  const {data:lbStats}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardStats",args:[0n,50n]});
  const {data:uBal}=useReadContract({address:USDC_ADDRESS,abi:USDC_ABI,functionName:"balanceOf",args:[address],enabled:!!address});
  const {data:uAllow,refetch:rAllow}=useReadContract({address:USDC_ADDRESS,abi:USDC_ABI,functionName:"allowance",args:[address,CONTRACT_ADDRESS],enabled:!!address});

  // WRITES
  const {writeContract:wGM,data:gmH,isPending:gmP}=useWriteContract();
  const {isLoading:gmC,isSuccess:gmD}=useWaitForTransactionReceipt({hash:gmH});
  const {writeContract:wRestore,data:resH,isPending:resP}=useWriteContract();
  const {isLoading:resC,isSuccess:resD}=useWaitForTransactionReceipt({hash:resH});
  const {writeContract:wApprove,data:appH,isPending:appP}=useWriteContract();
  const {isLoading:appC,isSuccess:appD}=useWaitForTransactionReceipt({hash:appH});
  const {writeContract:wPredict,data:predH,isPending:predP}=useWriteContract();
  const {isLoading:predC,isSuccess:predD}=useWaitForTransactionReceipt({hash:predH});
  const {writeContract:wClaim,data:clmH,isPending:clmP}=useWriteContract();
  const {isLoading:clmC,isSuccess:clmD}=useWaitForTransactionReceipt({hash:clmH});
  const {writeContract:wFin}=useWriteContract();

  const refAll=useCallback(()=>{rGMs();rBtc();rRound();rPool2();rUser();rStreak();rEntry();rAllow();},[]);
  useEffect(()=>{if(gmD||resD||predD||clmD||appD)refAll();},[gmD,resD,predD,clmD,appD]);
  useEffect(()=>{const id=setInterval(rBtc,30000);return()=>clearInterval(id);},[]);

  // RPC CALL
  const rpc=useCallback(async(method,params)=>{
    const r=await fetch("https://rpc.testnet.arc.network",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
    return r.json();
  },[]);

  // FETCH HISTORY — fixed selectors
  const fetchHistory=useCallback(async()=>{
    if(!address)return;
    setHloading(true);
    try{
      const padAddr="0x000000000000000000000000"+address.slice(2).toLowerCase();
      const logs=await rpc("eth_getLogs",[{address:CONTRACT_ADDRESS,fromBlock:"0x0",toBlock:"latest",topics:[EV_PREDICTED,null,padAddr]}]);
      if(!logs.result||logs.result.length===0){setHistory([]);setHloading(false);return;}
      const rids=[...new Set(logs.result.map(l=>BigInt(l.topics[1])))];
      const res=await Promise.all(rids.map(async rid=>{
        try{
          const r=rid.toString(16).padStart(64,"0");
          const a=address.slice(2).padStart(64,"0");
          const [eR,iR]=await Promise.all([
            rpc("eth_call",[{to:CONTRACT_ADDRESS,data:`${SEL_GET_USER_ENTRY}${r}${a}`},"latest"]),
            rpc("eth_call",[{to:CONTRACT_ADDRESS,data:`${SEL_GET_ROUND_INFO}${r}`},"latest"]),
          ]);
          const eH=eR.result?.slice(2)||"";
          const iH=iR.result?.slice(2)||"";
          if(eH.length<320||iH.length<600)return null;
          const amount=BigInt("0x"+eH.slice(0,64));
          if(amount===0n)return null;
          const isUp=eH.slice(64,128)!=="0".repeat(64);
          const claimed=eH.slice(128,192)!=="0".repeat(64);
          const estPay=BigInt("0x"+eH.slice(256,320));
          // getRoundInfo returns: assetId(uint8), roundType(uint8), startTime, endTime, snapshotPrice, currentPrice, priceIsUp, finalized, resultUp, noContest
          const assetId=Number(BigInt("0x"+iH.slice(0,64)));
          const endTime=Number(BigInt("0x"+iH.slice(192,256)));
          const snap=BigInt("0x"+iH.slice(256,320));
          const fin=iH.slice(448,512)!=="0".repeat(64);
          const resUp=iH.slice(512,576)!=="0".repeat(64);
          const noC=iH.slice(576,640)!=="0".repeat(64);
          const now=Math.floor(Date.now()/1000);
          const canFin=!fin&&endTime>0&&now>=endTime;
          const canClm=fin&&!claimed&&(noC||(isUp===resUp));
          const won=fin&&!noC&&isUp===resUp;
          const lost=fin&&!noC&&isUp!==resUp;
          return{rid,amount,isUp,claimed,estPay,endTime,snap,fin,resUp,noC,assetId,canFin,canClm,won,lost};
        }catch{return null;}
      }));
      setHistory(res.filter(Boolean).sort((a,b)=>Number(b.rid-a.rid)));
    }catch(e){console.error(e);}
    setHloading(false);
  },[address,rpc]);

  useEffect(()=>{if(address)fetchHistory();},[address,clmD,predD]);

  // PARSE
  const pts=uMain?fmtPts(uMain[0]):"--";
  const myGMs=uMain?Number(uMain[1]):0;
  const streak=uMain?Number(uMain[2]):0;
  const canGM=uMain?uMain[3]:true;
  const longest=uStreak?Number(uStreak[1]):0;
  const canRes=uStreak?uStreak[3]:false;
  const resCost=uStreak?fmtPts(uStreak[4]):"0";
  const mult=uMult?Number(uMult):100;
  const gGMs=globalGMs?Number(globalGMs):0;
  const snap=rInfo?rInfo[4]:null;
  const diff=fmtDiff(curPx,snap);
  const endMs=rInfo?Number(rInfo[3])*1000:0;
  const fin=rInfo?rInfo[7]:false;
  const tUp=rPool?Number(rPool[0])/1e6:0;
  const tDn=rPool?Number(rPool[1])/1e6:0;
  const tPl=tUp+tDn;
  const upPct=tPl>0?Math.round((tUp/tPl)*100):50;
  const dnPct=100-upPct;
  const hasE=uEntry&&Number(uEntry[0])>0;
  const eUp=uEntry?uEntry[1]:false;
  const eCl=uEntry?uEntry[2]:false;
  const eWin=uEntry?uEntry[3]:false;
  const eAmt=uEntry?fmtUsdc(uEntry[0]):"0";
  const ePay=uEntry?fmtUsdc(uEntry[4]):"0";
  const needApp=uAllow!==undefined&&Number(uAllow)<Number(parseUnits(amt||"1",6));
  const bal=uBal?fmtUsdc(uBal):"0";
  const lb=(lbPage&&lbStats)?lbPage[0].map((w,i)=>({w,pts:Number(lbPage[1][i])/1e18,streak:Number(lbStats[0][i]),mult:Number(lbStats[2][i])})).sort((a,b)=>b.pts-a.pts).slice(0,10):[];
  const myRank=lb.findIndex(e=>e.w?.toLowerCase()===address?.toLowerCase())+1;

  const ticker=asset===0?"BTC":"ETH";
  const tvSym=asset===0?"BINANCE:BTCUSDT":"BINANCE:ETHUSDT";
  const midnight=(()=>{const n=new Date();return Date.UTC(n.getUTCFullYear(),n.getUTCMonth(),n.getUTCDate()+1);})();

  // HANDLERS
  const doGM=()=>{if(!canGM||gmP||gmC)return;wGM({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"gm",chainId:arcTestnet.id});};
  const doRestore=()=>wRestore({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"restoreStreak",chainId:arcTestnet.id});
  const doApprove=()=>wApprove({address:USDC_ADDRESS,abi:USDC_ABI,functionName:"approve",args:[CONTRACT_ADDRESS,parseUnits("999999",6)],chainId:arcTestnet.id});
  const doPredict=(isUp)=>{if(!amt||Number(amt)<=0)return;wPredict({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"predict",args:[asset,ROUND_TYPE,isUp,parseUnits(amt,6)],chainId:arcTestnet.id});};
  const doClaim=(rid)=>wClaim({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"claim",args:[rid],chainId:arcTestnet.id});
  const doFin=(rid)=>wFin({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"finalizeRound",args:[rid],chainId:arcTestnet.id});
  const doSwitch=async()=>{try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x4cef52"}]});}catch{await window.ethereum.request({method:"wallet_addEthereumChain",params:[{chainId:"0x4cef52",chainName:"Arc Testnet",nativeCurrency:{name:"USDC",symbol:"USDC",decimals:18},rpcUrls:["https://rpc.testnet.arc.network"],blockExplorerUrls:["https://testnet.arcscan.app"]}]});}};

  // HISTORY ROW
  const HRow=({h})=>{
    const L=h.assetId===0?BtcLogo:EthLogo;
    const tk=h.assetId===0?"BTC":"ETH";
    return(
      <div style={{display:"grid",gridTemplateColumns:"32px 1fr auto auto",gap:12,alignItems:"center",padding:"12px 0",borderBottom:"1px solid #1E2733"}}>
        <L s={32}/>
        <div>
          <div style={{fontSize:"0.85rem",fontWeight:500,color:"#E2E8F0"}}>{tk} <span style={{color:h.isUp?"#48BB78":"#FC8181"}}>{h.isUp?"UP":"DOWN"}</span> <span style={{fontSize:"0.72rem",color:"#4A5568",fontWeight:400}}>24h</span></div>
          <div style={{fontSize:"0.72rem",color:"#4A5568",marginTop:2}}>Snapshot {fmtPrice(h.snap)} · ${fmtUsdc(h.amount)} USDC</div>
        </div>
        <div style={{textAlign:"right"}}>
          {!h.fin&&!h.canFin&&<div style={{fontSize:"0.75rem",color:"#D69E2E",fontWeight:500}}>Active</div>}
          {!h.fin&&h.canFin&&<div style={{fontSize:"0.72rem",color:"#D69E2E"}}>Awaiting finalize</div>}
          {h.won&&<div><div style={{fontSize:"0.75rem",color:"#48BB78",fontWeight:600}}>Won</div><div style={{fontSize:"0.68rem",color:"#48BB78"}}>+${fmtUsdc(h.estPay)} USDC</div></div>}
          {h.lost&&<div style={{fontSize:"0.75rem",color:"#FC8181",fontWeight:500}}>Lost</div>}
          {h.noC&&<div style={{fontSize:"0.75rem",color:"#718096"}}>Refunded</div>}
          {h.claimed&&<div style={{fontSize:"0.65rem",color:"#4A5568",marginTop:2}}>Claimed</div>}
        </div>
        <div style={{display:"flex",gap:6}}>
          {h.canFin&&<button onClick={()=>doFin(h.rid)} style={btnSm("#D69E2E")}>Finalize</button>}
          {h.canClm&&<button onClick={()=>doClaim(h.rid)} style={btnSm("#48BB78")}>Claim</button>}
          {(h.won||h.lost)&&<button onClick={()=>setSharePos({isUp:h.isUp,asset:h.assetId,snapshot:h.snap,current:null,winning:h.won,streak,mult,wallet:fmt(address)})} style={btnSm("#4A9EFF")}>Share</button>}
        </div>
      </div>
    );
  };

  const btnSm=(c)=>({background:"transparent",border:`1px solid ${c}33`,color:c,padding:"4px 10px",borderRadius:4,fontSize:"0.68rem",cursor:"pointer",fontFamily:"Inter,sans-serif",fontWeight:500});
  const btnPrim={padding:"10px 20px",borderRadius:6,border:"none",background:"#E2E8F0",color:"#0B0F14",fontSize:"0.85rem",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif"};
  const btnOut={padding:"10px 20px",borderRadius:6,border:"1px solid #1E2733",background:"transparent",color:"#718096",fontSize:"0.85rem",cursor:"pointer",fontFamily:"Inter,sans-serif"};

  return(
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#0B0F14;--s1:#11161D;--s2:#161B22;--b:#1E2733;--t:#E2E8F0;--t2:#718096;--t3:#4A5568;--g:#48BB78;--r:#FC8181;--y:#D69E2E;--a:#4A9EFF}
        html{font-size:15px}
        body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--t);min-height:100vh;-webkit-font-smoothing:antialiased}
        input[type=number]{background:var(--s2);border:1px solid var(--b);border-radius:6px;color:var(--t);font-size:0.9rem;font-family:'JetBrains Mono',monospace;padding:9px 12px;width:100%;outline:none;transition:border-color 0.15s}
        input[type=number]:focus{border-color:#4A9EFF}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        @keyframes fade{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}
        .fade{animation:fade 0.2s ease both}
        .row{display:flex;align-items:center}
        .mono{font-family:'JetBrains Mono',monospace}
      `}</style>

      <div style={{maxWidth:1080,margin:"0 auto",padding:"0 20px 60px"}}>

        {/* NAV */}
        <div style={{position:"sticky",top:0,zIndex:50,background:"rgba(11,15,20,0.85)",backdropFilter:"blur(12px)",borderBottom:"1px solid #1E2733",marginBottom:0}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",height:52}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#1a3a5c,#4A9EFF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",fontWeight:700,color:"#fff",letterSpacing:"0.05em"}}>GM</div>
              <span style={{fontWeight:700,fontSize:"0.95rem",letterSpacing:"-0.01em"}}>ArcGM</span>
              <span style={{fontSize:"0.68rem",color:"#4A5568",marginLeft:4}}>Testnet</span>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              {isConnected&&streak>0&&(
                <div style={{fontSize:"0.72rem",color:mult>=150?"#48BB78":"#D69E2E",background:mult>=150?"rgba(72,187,120,0.08)":"rgba(214,158,46,0.08)",border:`1px solid ${mult>=150?"rgba(72,187,120,0.2)":"rgba(214,158,46,0.2)"}`,borderRadius:4,padding:"3px 8px",fontFamily:"JetBrains Mono,monospace"}}>
                  {streak}d {multTxt(mult)}
                </div>
              )}
              <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" style={{fontSize:"0.72rem",color:"var(--a)",textDecoration:"none",border:"1px solid rgba(74,158,255,0.2)",borderRadius:4,padding:"3px 10px"}}>Get USDC</a>
              {!isConnected?(
                <button onClick={()=>connect({connector:injected()})} style={{...btnPrim,padding:"6px 16px",fontSize:"0.78rem"}}>Connect Wallet</button>
              ):wrongNet?(
                <button onClick={doSwitch} style={{padding:"6px 14px",borderRadius:4,border:"1px solid rgba(252,129,129,0.3)",background:"transparent",color:"#FC8181",fontSize:"0.75rem",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>Wrong Network</button>
              ):(
                <button onClick={()=>disconnect()} style={{...btnOut,padding:"5px 12px",fontSize:"0.72rem",display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:5,height:5,borderRadius:"50%",background:"#48BB78"}}/>
                  <span className="mono">{fmt(address)}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",gap:0,borderBottom:"1px solid #1E2733",marginBottom:24,marginTop:0}}>
          {[["predict","Predict"],["gm","Daily GM"],["leaderboard","Leaderboard"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:"12px 20px",fontSize:"0.82rem",fontWeight:tab===id?600:400,cursor:"pointer",color:tab===id?"#E2E8F0":"#4A5568",background:"transparent",border:"none",borderBottom:tab===id?"2px solid #4A9EFF":"2px solid transparent",fontFamily:"Inter,sans-serif",transition:"color 0.15s",letterSpacing:"-0.01em"}}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ PREDICT ══ */}
        {tab==="predict"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 280px",gap:20,alignItems:"start"}} className="fade">

            <div style={{display:"flex",flexDirection:"column",gap:16}}>

              {/* Multiplier notice */}
              {isConnected&&mult>100&&(
                <div style={{background:"rgba(72,187,120,0.06)",border:"1px solid rgba(72,187,120,0.15)",borderRadius:6,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontSize:"0.78rem",fontWeight:500,color:"#48BB78"}}>Streak boost active — {streak} day streak</div>
                    <div style={{fontSize:"0.72rem",color:"#718096",marginTop:2}}>Correct prediction earns {(10*mult/100).toFixed(0)} pts instead of 10</div>
                  </div>
                  <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:"1.2rem",fontWeight:500,color:"#48BB78"}}>{multTxt(mult)}</div>
                </div>
              )}

              {/* Asset selector */}
              <div style={{display:"flex",gap:8}}>
                {[[0,"Bitcoin","BTC"],[1,"Ethereum","ETH"]].map(([id,name,tk])=>(
                  <button key={id} onClick={()=>id===1&&!ethActive?null:setAsset(id)}
                    style={{display:"flex",alignItems:"center",gap:8,padding:"8px 16px",borderRadius:6,border:`1px solid ${asset===id?"#4A9EFF":"#1E2733"}`,background:asset===id?"rgba(74,158,255,0.06)":"transparent",cursor:id===1&&!ethActive?"not-allowed":"pointer",opacity:id===1&&!ethActive?0.4:1,fontFamily:"Inter,sans-serif",fontSize:"0.82rem",fontWeight:500,color:asset===id?"#E2E8F0":"#718096",transition:"all 0.15s"}}>
                    {id===0?<BtcLogo s={18}/>:<EthLogo s={18}/>}
                    {name}
                    {id===1&&!ethActive&&<span style={{fontSize:"0.65rem",color:"#4A5568",marginLeft:4}}>soon</span>}
                  </button>
                ))}
              </div>

              {/* Market header */}
              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:"16px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    {asset===0?<BtcLogo s={36}/>:<EthLogo s={36}/>}
                    <div>
                      <div style={{fontSize:"1rem",fontWeight:600,color:"#E2E8F0",letterSpacing:"-0.01em"}}>{ticker} Up or Down — 24h</div>
                      <div style={{fontSize:"0.72rem",color:"#4A5568",marginTop:2}}>Arc Testnet · Stork Oracle · Resets UTC 00:00</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:16,textAlign:"right"}}>
                    <div>
                      <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em"}}>Up chance</div>
                      <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:"0.9rem",fontWeight:500,color:"#48BB78"}}>{upPct}%</div>
                    </div>
                    <div>
                      <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em"}}>Volume</div>
                      <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:"0.9rem",fontWeight:500,color:"#E2E8F0"}}>${tPl.toFixed(0)}</div>
                    </div>
                  </div>
                </div>

                {/* Price row */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                  <div>
                    <div style={{display:"flex",gap:16,marginBottom:4}}>
                      <div style={{fontSize:"0.72rem",color:"#4A5568"}}>Snapshot <span className="mono" style={{color:"#718096"}}>{snap?fmtPrice(snap):"--"}</span></div>
                      <div style={{fontSize:"0.72rem",color:"#4A5568"}}>Current <span className="mono" style={{color:"#E2E8F0"}}>{curPx?fmtPrice(curPx):"--"}</span></div>
                    </div>
                    {diff&&(
                      <div style={{fontSize:"0.85rem",fontWeight:600,color:diff.up?"#48BB78":"#FC8181"}}>
                        {diff.up?"Above":"Below"} snapshot {diff.up?"+":""}{(diff.d/1e18).toFixed(0)} ({Math.abs(diff.pct).toFixed(2)}%)
                      </div>
                    )}
                    <div style={{marginTop:6,fontSize:"0.65rem",color:"#4A5568",background:"rgba(214,158,46,0.06)",border:"1px solid rgba(214,158,46,0.12)",borderRadius:4,padding:"3px 8px",display:"inline-block"}}>
                      Testnet oracle — prices may differ from live market
                    </div>
                  </div>
                  {endMs>0?(
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:"0.65rem",color:"#4A5568",marginBottom:2}}>Round closes in</div>
                      <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:"1.1rem",fontWeight:500,color:"#E2E8F0"}}><Countdown ms={endMs}/></div>
                    </div>
                  ):(
                    <div style={{fontSize:"0.72rem",color:"#4A5568"}}>First prediction starts round</div>
                  )}
                </div>
              </div>

              {/* Chart */}
              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,overflow:"hidden",height:280}}>
                <TVChart sym={tvSym}/>
              </div>

              {/* Entry */}
              {!isConnected?(
                <div style={{textAlign:"center",padding:"20px 0",color:"#4A5568",fontSize:"0.82rem"}}>Connect wallet to predict</div>
              ):!hasE?(
                <div style={{display:"flex",flexDirection:"column",gap:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.75rem",color:"#4A5568"}}>
                    <span>Amount (USDC)</span><span className="mono">Balance: {bal}</span>
                  </div>
                  <input type="number" value={amt} onChange={e=>setAmt(e.target.value)} placeholder="Min 1 USDC" min="1"/>
                  <div style={{display:"flex",gap:6}}>
                    {["1","5","10","25","50"].map(v=>(
                      <button key={v} onClick={()=>setAmt(v)} style={{flex:1,padding:"6px 0",border:`1px solid ${amt===v?"#4A9EFF":"#1E2733"}`,borderRadius:4,background:amt===v?"rgba(74,158,255,0.08)":"transparent",color:amt===v?"#4A9EFF":"#4A5568",fontSize:"0.72rem",cursor:"pointer",fontFamily:"JetBrains Mono,monospace"}}>
                        ${v}
                      </button>
                    ))}
                  </div>
                  {needApp?(
                    <button style={btnPrim} onClick={doApprove} disabled={appP||appC}>
                      {appP?"Confirming...":appC?"Approving...":"Approve USDC"}
                    </button>
                  ):(
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                      <button onClick={()=>doPredict(true)} disabled={predP||predC}
                        style={{padding:"14px 0",borderRadius:6,border:"1px solid rgba(72,187,120,0.3)",background:"rgba(72,187,120,0.06)",color:"#48BB78",fontSize:"0.95rem",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all 0.15s"}}>
                        <div>{ticker} UP</div>
                        <div style={{fontSize:"0.68rem",opacity:0.6,marginTop:3,fontWeight:400}}>{upPct}% · {(10*mult/100).toFixed(0)} pts if correct</div>
                      </button>
                      <button onClick={()=>doPredict(false)} disabled={predP||predC}
                        style={{padding:"14px 0",borderRadius:6,border:"1px solid rgba(252,129,129,0.3)",background:"rgba(252,129,129,0.06)",color:"#FC8181",fontSize:"0.95rem",fontWeight:600,cursor:"pointer",fontFamily:"Inter,sans-serif",transition:"all 0.15s"}}>
                        <div>{ticker} DOWN</div>
                        <div style={{fontSize:"0.68rem",opacity:0.6,marginTop:3,fontWeight:400}}>{dnPct}% · {(10*mult/100).toFixed(0)} pts if correct</div>
                      </button>
                    </div>
                  )}
                  {(predP||predC)&&<div style={{textAlign:"center",fontSize:"0.75rem",color:"#4A9EFF"}}>{predP?"Confirm in wallet...":"Confirming..."}</div>}
                </div>
              ):null}

              {/* Bottom tabs */}
              {isConnected&&(
                <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,overflow:"hidden"}}>
                  <div style={{display:"flex",borderBottom:"1px solid #1E2733"}}>
                    {[["positions","Positions"],["history","History"],["community","Community"]].map(([id,l])=>(
                      <button key={id} onClick={()=>setBtab(id)} style={{flex:1,padding:"10px 0",border:"none",background:"transparent",color:btab===id?"#E2E8F0":"#4A5568",fontSize:"0.78rem",fontWeight:btab===id?600:400,cursor:"pointer",fontFamily:"Inter,sans-serif",borderBottom:btab===id?"2px solid #4A9EFF":"2px solid transparent"}}>
                        {l}
                      </button>
                    ))}
                  </div>
                  <div style={{padding:16}}>

                    {btab==="positions"&&(
                      hasE?(
                        <div style={{display:"grid",gridTemplateColumns:"32px 1fr auto auto",gap:12,alignItems:"center"}}>
                          {asset===0?<BtcLogo s={32}/>:<EthLogo s={32}/>}
                          <div>
                            <div style={{fontSize:"0.85rem",fontWeight:500,color:"#E2E8F0"}}>
                              {ticker} <span style={{color:eUp?"#48BB78":"#FC8181"}}>{eUp?"UP":"DOWN"}</span>
                              <span style={{marginLeft:8,fontSize:"0.72rem",fontWeight:400,color:eWin?"#48BB78":"#FC8181"}}>{eWin?"Winning":"Losing"}</span>
                            </div>
                            <div style={{fontSize:"0.72rem",color:"#4A5568",marginTop:2}}>Staked ${eAmt} · Est. return ${ePay} USDC</div>
                          </div>
                          <div>
                            {fin&&!eCl&&<button onClick={()=>doClaim(curRid)} style={btnSm("#48BB78")} disabled={clmP||clmC}>{clmP||clmC?"...":"Claim"}</button>}
                            {!fin&&endMs>0&&Date.now()>endMs&&<button onClick={()=>doFin(curRid)} style={btnSm("#D69E2E")}>Finalize</button>}
                          </div>
                          <button onClick={()=>setSharePos({isUp:eUp,asset,snapshot:snap,current:curPx,winning:eWin,streak,mult,wallet:fmt(address)})} style={btnSm("#4A9EFF")}>Share</button>
                        </div>
                      ):(
                        <div style={{textAlign:"center",padding:"16px 0",fontSize:"0.78rem",color:"#4A5568"}}>No open position in this round</div>
                      )
                    )}

                    {btab==="history"&&(
                      <div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                          <div style={{fontSize:"0.72rem",color:"#4A5568"}}>All predictions from chain</div>
                          <button onClick={fetchHistory} style={{background:"none",border:"none",color:"#4A5568",fontSize:"0.72rem",cursor:"pointer",fontFamily:"Inter,sans-serif"}}>{hloading?"Loading...":"Refresh"}</button>
                        </div>
                        {hloading?<div style={{textAlign:"center",padding:"16px 0",fontSize:"0.75rem",color:"#4A5568"}}>Fetching from chain...</div>
                        :history.length===0?<div style={{textAlign:"center",padding:"16px 0",fontSize:"0.78rem",color:"#4A5568"}}>No predictions found</div>
                        :<div>{history.map(h=><HRow key={h.rid.toString()} h={h}/>)}</div>}
                      </div>
                    )}

                    {btab==="community"&&(
                      <div style={{display:"flex",flexDirection:"column",gap:10}}>
                        <a href="https://x.com/mkoneth" target="_blank" rel="noopener noreferrer"
                          style={{display:"flex",alignItems:"center",gap:10,padding:"12px",background:"#161B22",border:"1px solid #1E2733",borderRadius:6,textDecoration:"none",transition:"border-color 0.15s"}}
                          onMouseEnter={e=>e.currentTarget.style.borderColor="#4A9EFF33"}
                          onMouseLeave={e=>e.currentTarget.style.borderColor="#1E2733"}>
                          <div style={{width:32,height:32,borderRadius:"50%",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.9rem",flexShrink:0,color:"#fff"}}>X</div>
                          <div>
                            <div style={{fontSize:"0.82rem",fontWeight:500,color:"#E2E8F0"}}>@mkoneth</div>
                            <div style={{fontSize:"0.68rem",color:"#4A5568",marginTop:1}}>Follow for ArcGM updates</div>
                          </div>
                          <div style={{marginLeft:"auto",fontSize:"0.72rem",color:"#4A9EFF"}}>Follow</div>
                        </a>
                        <div style={{fontSize:"0.72rem",color:"#4A5568",lineHeight:1.6,padding:"8px 0"}}>Share your predictions on X with #ArcGM to grow the community.</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT SIDEBAR */}
            <div style={{display:"flex",flexDirection:"column",gap:12}}>

              {/* Pool breakdown */}
              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:16}}>
                <div style={{fontSize:"0.72rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Round Pool</div>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6,fontSize:"0.78rem"}}>
                  <span style={{color:"#4A5568"}}>Total staked</span>
                  <span className="mono" style={{fontWeight:500}}>${tPl.toFixed(2)}</span>
                </div>
                <div style={{height:4,borderRadius:2,background:"#161B22",overflow:"hidden",marginBottom:4}}>
                  <div style={{height:"100%",width:`${upPct}%`,background:"#48BB78",borderRadius:2,transition:"width 0.3s"}}/>
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.68rem",marginBottom:12}}>
                  <span style={{color:"#48BB78"}}>{upPct}% up · ${tUp.toFixed(2)}</span>
                  <span style={{color:"#FC8181"}}>${tDn.toFixed(2)} · {dnPct}% dn</span>
                </div>
                <div style={{height:1,background:"#1E2733",marginBottom:10}}/>
                <div style={{fontSize:"0.75rem",color:"#4A5568",display:"flex",flexDirection:"column",gap:5}}>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Min entry</span><span className="mono" style={{color:"#718096"}}>1 USDC</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Winners</span><span className="mono" style={{color:"#48BB78"}}>90% of pool</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Development</span><span className="mono" style={{color:"#718096"}}>3%</span></div>
                  <div style={{display:"flex",justifyContent:"space-between"}}><span>Marketing</span><span className="mono" style={{color:"#718096"}}>7%</span></div>
                </div>
              </div>

              {/* Your stats */}
              {isConnected&&(
                <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:16}}>
                  <div style={{fontSize:"0.72rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Your Stats</div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {[["Points",pts],["GM Streak",`${streak}d`],["Boost",multTxt(mult)],["Rank",myRank>0?`#${myRank}`:"--"]].map(([l,v])=>(
                      <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"0.78rem"}}>
                        <span style={{color:"#4A5568"}}>{l}</span>
                        <span className="mono" style={{fontWeight:500,color:l==="Boost"&&mult>=150?"#48BB78":"#E2E8F0"}}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* How it works */}
              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:16}}>
                <div style={{fontSize:"0.72rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>How it works</div>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {["Predict BTC direction by end of day","Winners share 90% of the pool weighted by stake","Correct prediction earns USDC + points","GM daily to build streak and multiply points"].map((t,i)=>(
                    <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start"}}>
                      <div style={{width:16,height:16,borderRadius:3,background:"#161B22",border:"1px solid #1E2733",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.6rem",color:"#4A5568",flexShrink:0,marginTop:1}}>{i+1}</div>
                      <div style={{fontSize:"0.75rem",color:"#718096",lineHeight:1.5}}>{t}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ GM TAB ══ */}
        {tab==="gm"&&(
          <div style={{display:"grid",gridTemplateColumns:"200px 1fr 220px",gap:20,alignItems:"start"}} className="fade">

            {/* Left stats */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {[["Total Points",pts,"#4A9EFF"],["GM Streak",`${streak} days`,"#E2E8F0"],["Total GMs",myGMs,"#E2E8F0"],["Longest Streak",`${longest} days`,"#718096"]].map(([l,v,c])=>(
                <div key={l} style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:"14px 16px"}}>
                  <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:5}}>{l}</div>
                  <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:"1.5rem",fontWeight:500,color:c}}>{v}</div>
                  {l==="GM Streak"&&myRank>0&&<div style={{fontSize:"0.68rem",color:"#4A9EFF",marginTop:4}}>Rank #{myRank}</div>}
                </div>
              ))}
              {canRes&&(
                <div style={{background:"rgba(252,129,129,0.05)",border:"1px solid rgba(252,129,129,0.15)",borderRadius:8,padding:14}}>
                  <div style={{fontSize:"0.75rem",color:"#FC8181",marginBottom:6}}>Streak broken</div>
                  <div style={{fontSize:"0.68rem",color:"#718096",marginBottom:10}}>Restore for {resCost} pts · 24h window</div>
                  <button onClick={doRestore} disabled={resP||resC} style={{...btnPrim,width:"100%",background:"rgba(252,129,129,0.1)",color:"#FC8181",border:"1px solid rgba(252,129,129,0.2)"}}>
                    {resP||resC?"...":"Restore Streak"}
                  </button>
                </div>
              )}
            </div>

            {/* Center GM */}
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20,paddingTop:20}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:6}}>Global GM Count</div>
                <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:"2.8rem",fontWeight:500,color:"#E2E8F0"}}>{gGMs.toLocaleString()}</div>
                <div style={{fontSize:"0.65rem",color:"#4A5568",marginTop:2}}>Arc Testnet</div>
              </div>

              <button onClick={doGM} disabled={!canGM||gmP||gmC||!isConnected}
                style={{width:120,height:120,borderRadius:"50%",border:`2px solid ${canGM&&isConnected?"#4A9EFF33":"#1E2733"}`,background:canGM&&isConnected?"rgba(74,158,255,0.06)":"#11161D",color:canGM&&isConnected?"#E2E8F0":"#4A5568",fontSize:"1.6rem",fontWeight:700,cursor:canGM&&isConnected?"pointer":"not-allowed",fontFamily:"Inter,sans-serif",letterSpacing:"-0.02em",transition:"all 0.2s"}}>
                {gmP||gmC?"...":"GM"}
              </button>

              {(gmP||gmC)&&<div style={{fontSize:"0.75rem",color:"#4A9EFF"}}>{gmP?"Confirm in wallet...":"Confirming..."}</div>}

              {!isConnected?<div style={{fontSize:"0.78rem",color:"#4A5568"}}>Connect wallet to GM</div>
              :canGM?<div style={{fontSize:"0.75rem",color:"#718096"}}>One GM per wallet per UTC day</div>
              :(
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:"0.65rem",color:"#4A5568",marginBottom:4}}>Next GM available in</div>
                  <div style={{fontFamily:"JetBrains Mono,monospace",fontSize:"1.2rem",fontWeight:500,color:"#E2E8F0"}}><Countdown ms={midnight}/></div>
                </div>
              )}

              <div style={{background:"rgba(214,158,46,0.05)",border:"1px solid rgba(214,158,46,0.12)",borderRadius:6,padding:"10px 14px",textAlign:"center",maxWidth:260}}>
                <div style={{fontSize:"0.72rem",color:"#D69E2E",fontWeight:500,marginBottom:2}}>First GM Bonus</div>
                <div style={{fontSize:"0.68rem",color:"#718096",lineHeight:1.5}}>First wallet to GM each UTC day earns +2 bonus points automatically</div>
              </div>
            </div>

            {/* Right multiplier */}
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:16}}>
                <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:12}}>Streak Multiplier</div>
                <div style={{display:"flex",gap:2,marginBottom:8}}>
                  {Array.from({length:15},(_,i)=>(
                    <div key={i} style={{flex:1,height:3,borderRadius:1,background:i<streak?(i<7?"#4A9EFF":"#48BB78"):"#1E2733",transition:"background 0.2s"}}/>
                  ))}
                </div>
                <div style={{fontSize:"0.65rem",color:"#4A5568",display:"flex",justifyContent:"space-between",marginBottom:14}}>
                  <span>1x</span><span>7d 1.5x</span><span>15d 2x</span>
                </div>
                {[["No streak","1x","10 pts/win"],["7 day streak","1.5x","15 pts/win"],["15 day streak","2x","20 pts/win"]].map(([l,m,p])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #1E2733",fontSize:"0.75rem"}}>
                    <span style={{color:"#718096"}}>{l}</span>
                    <span className="mono" style={{color:streak>=(l==="15 day streak"?15:l==="7 day streak"?7:0)?"#48BB78":"#4A5568"}}>{m} · {p}</span>
                  </div>
                ))}
              </div>

              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:16}}>
                <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Restore Cost</div>
                {[["1–7 days","25 pts",streak>=1&&streak<=7],["8–15 days","50 pts",streak>=8&&streak<=15],["16–30 days","75 pts",streak>=16&&streak<=30],["30+ days","100 pts",streak>30]].map(([l,c,a])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:"1px solid #1E2733",fontSize:"0.75rem"}}>
                    <span style={{color:a?"#FC8181":"#718096"}}>{a?"→ ":""}{l}</span>
                    <span className="mono" style={{color:a?"#FC8181":"#4A5568"}}>{c}</span>
                  </div>
                ))}
                <div style={{fontSize:"0.65rem",color:"#4A5568",marginTop:8}}>24h window to restore after missing</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ LEADERBOARD ══ */}
        {tab==="leaderboard"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 240px",gap:20}} className="fade">
            <div>
              <div style={{display:"grid",gridTemplateColumns:"28px 1fr 90px 70px 60px",gap:8,padding:"6px 12px",fontSize:"0.65rem",textTransform:"uppercase",letterSpacing:"0.06em",color:"#4A5568",marginBottom:4}}>
                <div>#</div><div>Wallet</div><div style={{textAlign:"right"}}>Points</div><div style={{textAlign:"center"}}>Streak</div><div style={{textAlign:"right"}}>Boost</div>
              </div>
              {lb.length===0?(
                <div style={{textAlign:"center",padding:"40px 0",color:"#4A5568",fontSize:"0.82rem"}}>No activity yet</div>
              ):lb.map((e,i)=>(
                <div key={e.w} style={{display:"grid",gridTemplateColumns:"28px 1fr 90px 70px 60px",gap:8,padding:"10px 12px",borderRadius:6,background:e.w?.toLowerCase()===address?.toLowerCase()?"rgba(74,158,255,0.05)":"transparent",border:`1px solid ${e.w?.toLowerCase()===address?.toLowerCase()?"rgba(74,158,255,0.15)":"transparent"}`,marginBottom:2,transition:"background 0.15s",animation:"fade 0.3s ease both",animationDelay:`${i*0.04}s`}}>
                  <div className="mono" style={{fontSize:"0.75rem",color:i===0?"#D69E2E":i===1?"#718096":i===2?"#8B6F47":"#4A5568",textAlign:"center",fontWeight:500}}>
                    {i+1}
                  </div>
                  <div className="mono" style={{fontSize:"0.75rem",color:"#E2E8F0"}}>
                    {fmt(e.w)}{e.w?.toLowerCase()===address?.toLowerCase()&&<span style={{color:"#4A9EFF",marginLeft:6,fontSize:"0.65rem"}}>you</span>}
                  </div>
                  <div className="mono" style={{fontSize:"0.8rem",fontWeight:500,textAlign:"right",color:"#E2E8F0"}}>{e.pts.toFixed(1)}</div>
                  <div className="mono" style={{fontSize:"0.72rem",color:"#D69E2E",textAlign:"center"}}>{e.streak}d</div>
                  <div className="mono" style={{fontSize:"0.72rem",textAlign:"right",color:e.mult>=200?"#48BB78":e.mult>=150?"#4A9EFF":"#4A5568",fontWeight:500}}>{multTxt(e.mult)}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {isConnected&&(
                <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:16}}>
                  <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Your Rank</div>
                  <div className="mono" style={{fontSize:"2.4rem",fontWeight:500,color:"#4A9EFF"}}>{myRank>0?`#${myRank}`:"--"}</div>
                  <div style={{fontSize:"0.72rem",color:"#718096",marginTop:4}}>{pts} pts · {streak}d streak · {multTxt(mult)}</div>
                </div>
              )}
              <div style={{background:"#11161D",border:"1px solid #1E2733",borderRadius:8,padding:16}}>
                <div style={{fontSize:"0.65rem",color:"#4A5568",textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:10}}>Points System</div>
                {[["Correct prediction","10 × mult"],["Wrong prediction","0"],["Daily GM","1 × mult"],["First GM of day","+2 bonus"],["7d streak","1.5x boost"],["15d streak","2x boost"]].map(([l,r])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #1E2733",fontSize:"0.75rem"}}>
                    <span style={{color:"#718096"}}>{l}</span>
                    <span className="mono" style={{color:"#4A9EFF",fontWeight:500}}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
      {sharePos&&<ShareModal pos={sharePos} onClose={()=>setSharePos(null)}/>}
    </>
  );
}
