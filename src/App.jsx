import { useState, useEffect, useRef, useCallback } from "react";
import {
  useAccount, useConnect, useDisconnect,
  useReadContract, useWriteContract, useWaitForTransactionReceipt,
} from "wagmi";
import { injected } from "wagmi/connectors";
import { parseUnits } from "viem";
import { CONTRACT_ADDRESS, CONTRACT_ABI, USDC_ADDRESS, USDC_ABI, arcTestnet } from "./config.js";

const fmt      = (addr) => addr ? `${addr.slice(0,6)}...${addr.slice(-4)}` : "";
const fmtPts   = (n)    => (Number(n) / 1e18).toFixed(1);
const fmtUsdc  = (n)    => (Number(n) / 1e6).toFixed(2);
const fmtPrice = (n)    => "$" + (Number(n)/1e18).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtDiff  = (cur,snap) => {
  if (!cur||!snap) return null;
  const diff = Number(cur)-Number(snap);
  return { diff, pct:(diff/Number(snap))*100, up:diff>=0 };
};
const mText = (m) => Number(m)>=200?"2x":Number(m)>=150?"1.5x":Number(m)>=120?"1.2x":"1x";

// ── CORRECT EVENT TOPIC HASH ──
// keccak256("Predicted(uint256,address,bool,uint256)")
const PREDICTED_TOPIC = "0xbf3cbd05bacafde21465fd778d0b9773b25f9c1c7b7ec49f1858e1e004fbc06d";

const BtcLogo = ({ size=48 }) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:"#F7931A",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(247,147,26,0.4)",flexShrink:0}}>
    <svg width={size*0.54} height={size*0.54} viewBox="0 0 26 26" fill="white">
      <path d="M18.6 11.3c.4-2.5-1.5-3.8-4.1-4.7l.8-3.4-2-.5-.8 3.3-1.6-.4.8-3.3-2-.5-.8 3.4-3.2-.8-.5 2.1s1.5.3 1.4.4c.8.2 1 .7.9 1.1l-2.2 8.7c-.1.3-.4.7-1.1.5 0 0-1.4-.4-1.4-.4l-1 2.3 3 .8.8-.2-.9 3.4 2 .5.9-3.4 1.6.4-.9 3.4 2 .5.9-3.5c3.4.6 5.9.4 7-2.7.9-2.5-.1-3.9-1.8-4.8 1.3-.3 2.2-1.1 2.4-2.8zm-4.4 6.2c-.6 2.5-5 1.2-6.4.8l1.1-4.6c1.4.4 5.9 1.1 5.3 3.8zm.7-6.2c-.6 2.3-4.2 1.1-5.4.8l1-4.1c1.2.3 5.1 1 4.4 3.3z"/>
    </svg>
  </div>
);

const EthLogo = ({ size=48 }) => (
  <div style={{width:size,height:size,borderRadius:"50%",background:"#627EEA",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(98,126,234,0.4)",flexShrink:0}}>
    <svg width={size*0.5} height={size*0.5} viewBox="0 0 24 24" fill="white">
      <path d="M12 1.75L5.75 12.25 12 15.5l6.25-3.25L12 1.75z" opacity="0.6"/>
      <path d="M5.75 13.5L12 22.25l6.25-8.75L12 17l-6.25-3.5z" opacity="0.6"/>
      <path d="M12 1.75v13.75l6.25-3.25L12 1.75z" opacity="0.9"/>
      <path d="M12 15.5v6.75l6.25-8.75L12 15.5z" opacity="0.9"/>
    </svg>
  </div>
);

function CountdownBoxes({ targetMs }) {
  const [secs,setSecs]=useState(0);
  useEffect(()=>{
    const tick=()=>setSecs(Math.max(0,Math.floor((targetMs-Date.now())/1000)));
    tick();const id=setInterval(tick,1000);return()=>clearInterval(id);
  },[targetMs]);
  const h=Math.floor(secs/3600),m=Math.floor((secs%3600)/60),s=secs%60;
  return (
    <div style={{display:"flex",alignItems:"center",gap:6}}>
      {[["hours",h],["mins",m],["secs",s]].map(([unit,val],i)=>(
        <div key={unit} style={{display:"flex",alignItems:"center",gap:6}}>
          {i>0&&<span style={{color:"#3D4F68",fontFamily:"DM Mono,monospace",fontSize:"1.2rem",opacity:0.5}}>:</span>}
          <div style={{background:"#111722",border:"1px solid #1A2235",borderRadius:8,padding:"8px 12px",textAlign:"center",minWidth:54}}>
            <div style={{fontFamily:"DM Mono,monospace",fontSize:"1.3rem",fontWeight:500,color:"#DDE4F0",lineHeight:1}}>{String(val).padStart(2,"0")}</div>
            <div style={{fontSize:"0.52rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"#3D4F68",marginTop:2}}>{unit}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TradingViewChart({ symbol="BINANCE:BTCUSDT" }) {
  const ref=useRef(null);
  useEffect(()=>{
    if(!ref.current)return;
    ref.current.innerHTML="";
    const s=document.createElement("script");
    s.src="https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    s.async=true;
    s.innerHTML=JSON.stringify({
      autosize:true,symbol,interval:"D",
      timezone:"Etc/UTC",theme:"dark",style:"1",locale:"en",
      backgroundColor:"rgba(13,17,25,1)",gridColor:"rgba(26,34,53,0.5)",
      hide_side_toolbar:true,allow_symbol_change:false,
      save_image:false,hide_volume:true,
      support_host:"https://www.tradingview.com",
    });
    ref.current.appendChild(s);
  },[symbol]);
  return (
    <div style={{background:"#0D1119",border:"1px solid #1A2235",borderRadius:14,overflow:"hidden"}}>
      <div style={{padding:"10px 14px",borderBottom:"1px solid #1A2235",display:"flex",alignItems:"center",gap:8}}>
        {symbol.includes("BTC")?<BtcLogo size={20}/>:<EthLogo size={20}/>}
        <span style={{fontSize:"0.78rem",fontWeight:600,color:"#DDE4F0"}}>{symbol.includes("BTC")?"BTC / USD":"ETH / USD"} · 24h Chart</span>
      </div>
      <div style={{height:300}}>
        <div ref={ref} style={{height:"100%",width:"100%"}}/>
      </div>
    </div>
  );
}

function ShareModal({ position, onClose }) {
  const [theme,setTheme]=useState(0);
  const [hideWallet,setHideWallet]=useState(false);
  const themes=[
    {bg:"linear-gradient(135deg,#0a0f1a,#0d1525)",border:"#1A2235",accent:"#00D4FF",label:"Dark Minimal"},
    {bg:"linear-gradient(135deg,#001a2e,#003d5c)",border:"#004d7a",accent:"#00D4FF",label:"Arc Blue"},
    {bg:"linear-gradient(135deg,#1a0800,#2d1200)",border:"#3d2000",accent:"#F7931A",label:"BTC Orange"},
  ];
  const t=themes[theme];
  const AssetLogo=position.asset===0?BtcLogo:EthLogo;
  const assetName=position.asset===0?"BTC":"ETH";
  const shareToX=()=>{
    const dir=position.isUp?"▲ UP":"▼ DOWN";
    const text=`I predicted ${assetName} ${dir} on ArcGM 🎯\n${position.winning?"currently winning":"open position"} · ${position.streak}d GM streak · ${mText(position.mult)} multiplier\narcgm.vercel.app\n#ArcGM #ArcNetwork #Predict`;
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`,"_blank");
  };
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",backdropFilter:"blur(8px)"}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:"#0D1119",border:"1px solid #1A2235",borderRadius:18,padding:28,width:580,maxWidth:"95vw",position:"relative"}}>
        <button onClick={onClose} style={{position:"absolute",top:14,right:14,background:"rgba(255,255,255,0.06)",border:"none",color:"rgba(255,255,255,0.5)",width:30,height:30,borderRadius:"50%",cursor:"pointer",fontSize:"1rem"}}>×</button>
        <div style={{fontSize:"1rem",fontWeight:700,color:"#DDE4F0",marginBottom:4}}>Share your position</div>
        <div style={{fontSize:"0.7rem",color:"#3D4F68",marginBottom:18}}>Choose a theme and share on X</div>
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {themes.map((th,i)=>(
            <div key={i} onClick={()=>setTheme(i)} style={{cursor:"pointer",borderRadius:8,width:100,height:56,background:th.bg,border:`2px solid ${i===theme?th.accent:"#1A2235"}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.62rem",color:th.accent}}>
              {th.label}
            </div>
          ))}
        </div>
        <div style={{borderRadius:12,padding:20,background:t.bg,border:`1px solid ${t.border}`,position:"relative",overflow:"hidden",marginBottom:14}}>
          <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:`linear-gradient(90deg,transparent,${t.accent},transparent)`}}/>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:12}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:24,height:24,borderRadius:6,background:"linear-gradient(135deg,#003D5C,#00D4FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.55rem",fontWeight:800,color:"#fff"}}>GM</div>
              <span style={{fontSize:"0.82rem",fontWeight:700,color:"#DDE4F0"}}>Arc<span style={{color:t.accent}}>GM</span></span>
            </div>
            <span style={{fontSize:"0.58rem",color:"#3D4F68"}}>arcgm.vercel.app</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
            <AssetLogo size={36}/>
            <div>
              <div style={{fontSize:"0.7rem",color:"#8A9BB0"}}>I predicted</div>
              <div style={{fontSize:"0.95rem",fontWeight:700,color:"#DDE4F0"}}>{assetName} <span style={{color:position.isUp?"#00E87A":"#FF4561"}}>{position.isUp?"▲ UP":"▼ DOWN"}</span></div>
            </div>
          </div>
          <div style={{display:"flex",gap:16,padding:"10px 12px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:10}}>
            <div><div style={{fontSize:"0.55rem",color:"#3D4F68",marginBottom:2}}>Snapshot</div><div style={{fontFamily:"DM Mono,monospace",fontSize:"0.75rem",color:"#DDE4F0"}}>{position.snapshot?fmtPrice(position.snapshot):"--"}</div></div>
            <div><div style={{fontSize:"0.55rem",color:"#3D4F68",marginBottom:2}}>Status</div><div style={{fontSize:"0.75rem",color:position.winning?"#00E87A":"#FF4561",fontWeight:600}}>{position.winning?"✓ Winning":"✗ Losing"}</div></div>
            <div><div style={{fontSize:"0.55rem",color:"#3D4F68",marginBottom:2}}>GM Streak</div><div style={{fontFamily:"DM Mono,monospace",fontSize:"0.75rem",color:"#FFB800"}}>🔥 {position.streak}d · {mText(position.mult)}</div></div>
          </div>
          {!hideWallet&&<div style={{fontSize:"0.62rem",color:"#3D4F68",fontFamily:"DM Mono,monospace"}}>{position.wallet}</div>}
        </div>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 14px",background:"rgba(255,255,255,0.03)",borderRadius:8,marginBottom:14}}>
          <span style={{fontSize:"0.75rem",color:"#8A9BB0"}}>Hide wallet address</span>
          <div onClick={()=>setHideWallet(!hideWallet)} style={{width:36,height:20,background:hideWallet?"#00D4FF":"#1A2235",borderRadius:10,cursor:"pointer",position:"relative",transition:"background 0.2s"}}>
            <div style={{width:16,height:16,background:hideWallet?"#fff":"#3D4F68",borderRadius:"50%",position:"absolute",top:2,left:hideWallet?18:2,transition:"left 0.2s"}}/>
          </div>
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={shareToX} style={{flex:1,padding:12,borderRadius:10,border:"none",background:"#DDE4F0",color:"#07090F",fontSize:"0.85rem",fontWeight:700,cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>𝕏 Share on X</button>
          <button onClick={onClose} style={{flex:1,padding:12,borderRadius:10,border:"1px solid #1A2235",background:"rgba(255,255,255,0.04)",color:"#DDE4F0",fontSize:"0.85rem",fontWeight:600,cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>✕ Close</button>
        </div>
      </div>
    </div>
  );
}

export default function ArcGM() {
  const {address,isConnected,chain}=useAccount();
  const {connect}=useConnect();
  const {disconnect}=useDisconnect();
  const [tab,setTab]=useState("predict");
  const [asset,setAsset]=useState(0); // 0=BTC, 1=ETH (inactive until admin activates)
  const [entryAmount,setEntryAmount]=useState("5");
  const [sharePos,setSharePos]=useState(null);
  const [particles,setParticles]=useState([]);
  const [bottomTab,setBottomTab]=useState("positions");
  const [history,setHistory]=useState([]);
  const [historyLoading,setHistoryLoading]=useState(false);

  const isWrongNetwork=isConnected&&chain?.id!==arcTestnet.id;

  // ── READS ──
  // Always use roundType=1 (24h only)
  const ROUND_TYPE = 1;

  const {data:globalGMs,refetch:rgGMs}   =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getTotalGlobalGMs"});
  const {data:btcPrice,refetch:rBtcPrice}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getCurrentPrice",args:[0]});
  const {data:ethPrice,refetch:rEthPrice}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getCurrentPrice",args:[1],enabled:false}); // ETH inactive
  const {data:round24hIdBtc}             =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"get24hRoundId",args:[0]});
  const {data:round24hIdEth}             =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"get24hRoundId",args:[1]});
  const {data:btcAsset}                  =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"assets",args:[0]});
  const {data:ethAsset}                  =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"assets",args:[1]});

  const ethActive = ethAsset ? ethAsset[2] : false;
  const currentAssetId = asset;
  const currentRoundId = asset===0 ? round24hIdBtc : round24hIdEth;
  const currentPrice   = asset===0 ? btcPrice : ethPrice;

  const {data:roundInfo,refetch:rRound}  =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getRoundInfo",args:[currentRoundId],enabled:!!currentRoundId});
  const {data:roundPool,refetch:rPool}   =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getRoundPool",args:[currentRoundId],enabled:!!currentRoundId});
  const {data:userMain,refetch:rUser}    =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserMain",args:[address],enabled:!!address});
  const {data:userStreak,refetch:rStreak}=useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserStreak",args:[address],enabled:!!address});
  const {data:userMult}                  =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getMultiplier",args:[address],enabled:!!address});
  const {data:userEntry,refetch:rEntry}  =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getUserEntry",args:[currentRoundId,address],enabled:!!currentRoundId&&!!address});
  const {data:lbPage}                    =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardPage",args:[0n,50n]});
  const {data:lbStats}                   =useReadContract({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"getLeaderboardStats",args:[0n,50n]});
  const {data:usdcBal}                   =useReadContract({address:USDC_ADDRESS,abi:USDC_ABI,functionName:"balanceOf",args:[address],enabled:!!address});
  const {data:usdcAllow,refetch:rAllow}  =useReadContract({address:USDC_ADDRESS,abi:USDC_ABI,functionName:"allowance",args:[address,CONTRACT_ADDRESS],enabled:!!address});

  // ── WRITES ──
  const {writeContract:writeGM,data:gmHash,isPending:gmPending}=useWriteContract();
  const {isLoading:gmConfirming,isSuccess:gmDone}=useWaitForTransactionReceipt({hash:gmHash});
  const {writeContract:writeRestore,data:restoreHash,isPending:restorePending}=useWriteContract();
  const {isLoading:restoreConfirming,isSuccess:restoreDone}=useWaitForTransactionReceipt({hash:restoreHash});
  const {writeContract:writeApprove,data:approveHash,isPending:approvePending}=useWriteContract();
  const {isLoading:approveConfirming,isSuccess:approveDone}=useWaitForTransactionReceipt({hash:approveHash});
  const {writeContract:writePredict,data:predictHash,isPending:predictPending}=useWriteContract();
  const {isLoading:predictConfirming,isSuccess:predictDone}=useWaitForTransactionReceipt({hash:predictHash});
  const {writeContract:writeClaim,data:claimHash,isPending:claimPending}=useWriteContract();
  const {isLoading:claimConfirming,isSuccess:claimDone}=useWaitForTransactionReceipt({hash:claimHash});
  const {writeContract:writeFinalize}=useWriteContract();

  const refetchAll=useCallback(()=>{rgGMs();rBtcPrice();rRound();rPool();rUser();rStreak();rEntry();rAllow();},[]);
  useEffect(()=>{if(gmDone||restoreDone||predictDone||claimDone||approveDone)refetchAll();},[gmDone,restoreDone,predictDone,claimDone,approveDone]);
  useEffect(()=>{const id=setInterval(rBtcPrice,30000);return()=>clearInterval(id);},[]);

  // ── HISTORY FROM CHAIN EVENTS ──
  const rpcCall=useCallback(async(method,params)=>{
    const res=await fetch("https://rpc.testnet.arc.network",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method,params})});
    return res.json();
  },[]);

  const fetchHistory=useCallback(async()=>{
    if(!address)return;
    setHistoryLoading(true);
    try{
      const paddedAddr="0x000000000000000000000000"+address.slice(2).toLowerCase();
      const logsData=await rpcCall("eth_getLogs",[{
        address:CONTRACT_ADDRESS,
        fromBlock:"0x0",
        toBlock:"latest",
        topics:[PREDICTED_TOPIC,null,paddedAddr]
      }]);
      if(!logsData.result||logsData.result.length===0){setHistory([]);setHistoryLoading(false);return;}
      const roundIds=[...new Set(logsData.result.map(log=>BigInt(log.topics[1])))];
      const results=await Promise.all(roundIds.map(async(roundId)=>{
        try{
          const rid=roundId.toString(16).padStart(64,"0");
          const addr=address.slice(2).padStart(64,"0");
          const [entryRes,infoRes]=await Promise.all([
            rpcCall("eth_call",[{to:CONTRACT_ADDRESS,data:`0x37eaea2c${rid}${addr}`},"latest"]),
            rpcCall("eth_call",[{to:CONTRACT_ADDRESS,data:`0xc57f2dfd${rid}`},"latest"]),
          ]);
          const eHex=entryRes.result?.slice(2)||"";
          const iHex=infoRes.result?.slice(2)||"";
          if(eHex.length<320||iHex.length<640)return null;
          const amount=BigInt("0x"+eHex.slice(0,64));
          if(amount===0n)return null;
          const isUp=eHex.slice(64,128)!=="0".repeat(64);
          const claimed=eHex.slice(128,192)!=="0".repeat(64);
          const estPayout=BigInt("0x"+eHex.slice(256,320));
          const assetId=Number(BigInt("0x"+iHex.slice(0,64)));
          const endTime=Number(BigInt("0x"+iHex.slice(192,256)));
          const snapPrice=BigInt("0x"+iHex.slice(256,320));
          const finalized=iHex.slice(448,512)!=="0".repeat(64);
          const resultUp=iHex.slice(512,576)!=="0".repeat(64);
          const noContest=iHex.slice(576,640)!=="0".repeat(64);
          const now=Math.floor(Date.now()/1000);
          const canFinalize=!finalized&&endTime>0&&now>=endTime;
          const canClaim=finalized&&!claimed&&(noContest||(isUp===resultUp));
          const won=finalized&&!noContest&&isUp===resultUp;
          const lost=finalized&&!noContest&&isUp!==resultUp;
          return{roundId,amount,isUp,claimed,estPayout,endTime,snapPrice,finalized,resultUp,noContest,assetId,canFinalize,canClaim,won,lost};
        }catch{return null;}
      }));
      setHistory(results.filter(Boolean).sort((a,b)=>Number(b.roundId-a.roundId)));
    }catch(e){console.error("History error:",e);}
    setHistoryLoading(false);
  },[address,rpcCall]);

  useEffect(()=>{if(address)fetchHistory();},[address,claimDone,predictDone]);

  // ── PARSE DATA ──
  const totalPts=userMain?fmtPts(userMain[0]):"0.0";
  const myGMs=userMain?Number(userMain[1]):0;
  const myStreak=userMain?Number(userMain[2]):0;
  const canGMToday=userMain?userMain[3]:true;
  const longestStreak=userStreak?Number(userStreak[1]):0;
  const canRestore=userStreak?userStreak[3]:false;
  const restoreCost=userStreak?fmtPts(userStreak[4]):"0";
  const multVal=userMult?Number(userMult):100;
  const globalGMsNum=globalGMs?Number(globalGMs):0;
  const snapshotPrice=roundInfo?roundInfo[4]:null;
  const pDiff=fmtDiff(currentPrice,snapshotPrice);
  const roundEndTime=roundInfo?Number(roundInfo[3])*1000:0;
  const roundFinalized=roundInfo?roundInfo[7]:false;
  const totalUp=roundPool?Number(roundPool[0])/1e6:0;
  const totalDown=roundPool?Number(roundPool[1])/1e6:0;
  const totalPool=totalUp+totalDown;
  const upPct=totalPool>0?Math.round((totalUp/totalPool)*100):50;
  const downPct=100-upPct;
  const hasEntry=userEntry&&Number(userEntry[0])>0;
  const entryIsUp=userEntry?userEntry[1]:false;
  const entryClaimed=userEntry?userEntry[2]:false;
  const entryWinning=userEntry?userEntry[3]:false;
  const entryAmt=userEntry?fmtUsdc(userEntry[0]):"0";
  const estPayout=userEntry?fmtUsdc(userEntry[4]):"0";
  const needsApproval=usdcAllow!==undefined&&Number(usdcAllow)<Number(parseUnits(entryAmount||"1",6));
  const usdcBalance=usdcBal?fmtUsdc(usdcBal):"0";
  const leaderboard=(lbPage&&lbStats)?lbPage[0].map((w,i)=>({address:w,points:Number(lbPage[1][i])/1e18,streak:Number(lbStats[0][i]),mult:Number(lbStats[2][i])})).sort((a,b)=>b.points-a.points).slice(0,10):[];
  const myRank=leaderboard.findIndex(e=>e.address?.toLowerCase()===address?.toLowerCase())+1;

  // ── HANDLERS ──
  const handleGM=()=>{if(!canGMToday||gmPending||gmConfirming)return;spawnParticles();writeGM({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"gm",chainId:arcTestnet.id});};
  const handleRestore=()=>writeRestore({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"restoreStreak",chainId:arcTestnet.id});
  const handleApprove=()=>writeApprove({address:USDC_ADDRESS,abi:USDC_ABI,functionName:"approve",args:[CONTRACT_ADDRESS,parseUnits("999999",6)],chainId:arcTestnet.id});
  const handlePredict=(isUp)=>{if(!entryAmount||Number(entryAmount)<=0)return;writePredict({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"predict",args:[currentAssetId,ROUND_TYPE,isUp,parseUnits(entryAmount,6)],chainId:arcTestnet.id});};
  const handleClaim=(rid)=>writeClaim({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"claim",args:[rid],chainId:arcTestnet.id});
  const handleFinalize=(rid)=>writeFinalize({address:CONTRACT_ADDRESS,abi:CONTRACT_ABI,functionName:"finalizeRound",args:[rid],chainId:arcTestnet.id});
  const handleSwitch=async()=>{try{await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x4cef52"}]});}catch{await window.ethereum.request({method:"wallet_addEthereumChain",params:[{chainId:"0x4cef52",chainName:"Arc Testnet",nativeCurrency:{name:"USDC",symbol:"USDC",decimals:18},rpcUrls:["https://rpc.testnet.arc.network"],blockExplorerUrls:["https://testnet.arcscan.app"]}]});}};

  const spawnParticles=()=>{
    const newP=Array.from({length:20},(_,i)=>({id:Date.now()+i,style:{left:`${40+Math.random()*20}%`,top:`${40+Math.random()*20}%`,width:`${4+Math.random()*8}px`,height:`${4+Math.random()*8}px`,background:["#00D4FF","#00E87A","#FFB800","#F7931A"][Math.floor(Math.random()*4)],borderRadius:"50%",position:"absolute",pointerEvents:"none",animation:"burst 1s ease-out forwards","--dx":`${(Math.random()-0.5)*300}px`,"--dy":`${(Math.random()-0.5)*300}px`,animationDelay:`${Math.random()*0.2}s`,zIndex:100}}));
    setParticles(p=>[...p,...newP]);
    setTimeout(()=>setParticles(p=>p.filter(x=>!newP.find(n=>n.id===x.id))),1200);
  };

  const utcMidnight=(()=>{const now=new Date();return Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()+1);})();
  const AssetLogo=asset===0?BtcLogo:EthLogo;
  const assetName=asset===0?"Bitcoin":"Ethereum";
  const assetTicker=asset===0?"BTC":"ETH";
  const tvSymbol=asset===0?"BINANCE:BTCUSDT":"BINANCE:ETHUSDT";

  const HistoryItem=({h})=>{
    const HLogo=h.assetId===0?BtcLogo:EthLogo;
    const hTicker=h.assetId===0?"BTC":"ETH";
    return (
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"#111722",borderRadius:10,border:`1px solid ${h.won?"rgba(0,232,122,0.2)":h.lost?"rgba(255,69,97,0.15)":"#1A2235"}`}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <HLogo size={32}/>
          <div>
            <div style={{fontSize:"0.75rem",fontWeight:600,color:"#DDE4F0"}}>
              {hTicker} <span style={{color:h.isUp?"#00E87A":"#FF4561"}}>{h.isUp?"▲ UP":"▼ DOWN"}</span>
              <span style={{color:"#3D4F68",marginLeft:6,fontSize:"0.62rem"}}>24h</span>
            </div>
            <div style={{fontSize:"0.6rem",color:"#3D4F68",marginTop:2}}>Snapshot: {fmtPrice(h.snapPrice)} · Stake: ${fmtUsdc(h.amount)} USDC</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{textAlign:"right"}}>
            {!h.finalized&&!h.canFinalize&&<div style={{fontSize:"0.7rem",color:"#FFB800",fontWeight:600}}>⏳ Active</div>}
            {!h.finalized&&h.canFinalize&&<div style={{fontSize:"0.68rem",color:"#FFB800"}}>Needs finalize</div>}
            {h.won&&<div><div style={{fontSize:"0.72rem",fontWeight:700,color:"#00E87A"}}>✓ Won</div><div style={{fontSize:"0.6rem",color:"#00E87A"}}>+${fmtUsdc(h.estPayout)} USDC</div></div>}
            {h.lost&&<div style={{fontSize:"0.72rem",fontWeight:700,color:"#FF4561"}}>✗ Lost</div>}
            {h.noContest&&<div style={{fontSize:"0.72rem",color:"#3D4F68"}}>↩ Refunded</div>}
            {h.claimed&&<div style={{fontSize:"0.6rem",color:"#3D4F68",marginTop:2}}>✓ Claimed</div>}
          </div>
          {h.canFinalize&&<button onClick={()=>handleFinalize(h.roundId)} style={{background:"rgba(255,184,0,0.1)",border:"1px solid rgba(255,184,0,0.2)",color:"#FFB800",padding:"5px 10px",borderRadius:7,fontSize:"0.65rem",fontWeight:600,cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>Finalize</button>}
          {h.canClaim&&<button onClick={()=>handleClaim(h.roundId)} style={{background:"rgba(0,232,122,0.1)",border:"1px solid rgba(0,232,122,0.2)",color:"#00E87A",padding:"5px 10px",borderRadius:7,fontSize:"0.65rem",fontWeight:600,cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>Claim</button>}
          {(h.won||h.lost)&&<button onClick={()=>setSharePos({isUp:h.isUp,asset:h.assetId,snapshot:h.snapPrice,current:null,winning:h.won,streak:myStreak,mult:multVal,wallet:fmt(address)})} style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.15)",color:"#00D4FF",padding:"5px 10px",borderRadius:7,fontSize:"0.65rem",cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>📤</button>}
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@400;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        :root{--bg:#07090F;--surface:#0D1119;--s2:#111722;--border:#1A2235;--arc:#00D4FF;--green:#00E87A;--red:#FF4561;--gold:#FFB800;--text:#DDE4F0;--muted:#3D4F68}
        body{font-family:'Outfit',sans-serif;background:var(--bg);color:var(--text);min-height:100vh}
        body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(var(--border) 1px,transparent 1px),linear-gradient(90deg,var(--border) 1px,transparent 1px);background-size:44px 44px;opacity:0.2;pointer-events:none;z-index:0}
        @keyframes burst{0%{transform:translate(0,0) scale(1);opacity:1}100%{transform:translate(var(--dx),var(--dy)) scale(0);opacity:0}}
        @keyframes glow{0%,100%{box-shadow:0 0 24px rgba(0,212,255,0.25)}50%{box-shadow:0 0 48px rgba(0,212,255,0.5)}}
        @keyframes shimmer{0%{background-position:-200% center}100%{background-position:200% center}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
        .app{max-width:1100px;margin:0 auto;padding:0 20px 48px;position:relative;z-index:1}
        .panel{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px}
        .lbl{font-size:0.6rem;text-transform:uppercase;letter-spacing:0.15em;color:var(--muted);margin-bottom:10px}
        input[type=number]{background:var(--s2);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.9rem;font-family:'DM Mono',monospace;padding:10px 14px;width:100%;outline:none}
        input[type=number]:focus{border-color:var(--arc)}
        input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none}
        .btn-up{background:rgba(0,232,122,0.1);border:1.5px solid rgba(0,232,122,0.25);color:#00E87A;border-radius:10px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:600;transition:all 0.2s}
        .btn-up:hover:not(:disabled){background:rgba(0,232,122,0.2);transform:translateY(-2px)}
        .btn-down{background:rgba(255,69,97,0.1);border:1.5px solid rgba(255,69,97,0.25);color:#FF4561;border-radius:10px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:600;transition:all 0.2s}
        .btn-down:hover:not(:disabled){background:rgba(255,69,97,0.2);transform:translateY(-2px)}
        .btn-arc{background:linear-gradient(135deg,#003D5C,#00D4FF);color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:'Outfit',sans-serif;font-weight:600}
        .btn-arc:hover{opacity:0.85}
        .lb-row{display:grid;grid-template-columns:28px 1fr 80px 60px 60px;gap:8px;align-items:center;padding:10px 12px;border-radius:10px;background:var(--surface);border:1px solid var(--border);animation:fadeUp 0.4s ease both}
        .lb-row.me{border-color:rgba(0,212,255,0.3);background:rgba(0,212,255,0.04)}
        .lb-row:hover{border-color:rgba(0,212,255,0.2)}
      `}</style>

      <div className="app">
        <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:200}}>
          {particles.map(p=><div key={p.id} style={p.style}/>)}
        </div>

        {/* HEADER */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 0",borderBottom:"1px solid var(--border)"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:8,background:"linear-gradient(135deg,#003D5C,#00D4FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.65rem",fontWeight:800,color:"#fff",boxShadow:"0 0 16px rgba(0,212,255,0.3)"}}>GM</div>
            <div>
              <div style={{fontSize:"1rem",fontWeight:700}}>Arc<span style={{color:"var(--arc)"}}>GM</span></div>
              <div style={{fontSize:"0.58rem",color:"var(--muted)",letterSpacing:"0.1em"}}>PREDICT · GM · EARN</div>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            {isConnected&&myStreak>0&&(
              <div style={{display:"flex",alignItems:"center",gap:6,background:"var(--surface)",border:"1px solid var(--border)",borderRadius:20,padding:"6px 14px"}}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"var(--green)",boxShadow:"0 0 8px var(--green)",animation:"pulse 2s infinite"}}/>
                <span style={{fontSize:"0.78rem",fontWeight:600,color:"var(--green)"}}>🔥 {myStreak}d streak</span>
                <span style={{fontSize:"0.68rem",color:"var(--muted)"}}>· {mText(multVal)}</span>
              </div>
            )}
            {isConnected&&<div style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",borderRadius:20,padding:"5px 12px",fontSize:"0.72rem",color:"var(--arc)",fontWeight:600}}>⚡ {mText(multVal)}</div>}
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer"
              style={{fontSize:"0.75rem",color:"var(--arc)",textDecoration:"none",display:"flex",alignItems:"center",gap:4,background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.2)",padding:"6px 12px",borderRadius:20}}>
              🚰 Get USDC
            </a>
            {!isConnected?(
              <button className="btn-arc" style={{padding:"10px 24px",fontSize:"0.85rem"}} onClick={()=>connect({connector:injected()})}>Connect Wallet</button>
            ):isWrongNetwork?(
              <button onClick={handleSwitch} style={{background:"rgba(255,107,53,0.2)",border:"1px solid #FF6B35",color:"#FF6B35",padding:"8px 16px",borderRadius:20,fontFamily:"Outfit,sans-serif",fontSize:"0.8rem",cursor:"pointer"}}>⚠ Switch to Arc</button>
            ):(
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",color:"var(--muted)",padding:"7px 14px",borderRadius:20,fontSize:"0.7rem",fontFamily:"DM Mono,monospace",display:"flex",alignItems:"center",gap:6,cursor:"pointer"}} onClick={()=>disconnect()}>
                <div style={{width:6,height:6,borderRadius:"50%",background:"var(--green)"}}/>
                {fmt(address)}
              </div>
            )}
          </div>
        </div>

        {/* TABS */}
        <div style={{display:"flex",borderBottom:"1px solid var(--border)",marginBottom:24}}>
          {[["predict","🔮 Predict"],["gm","🌅 Daily GM"],["leaderboard","🏆 Leaderboard"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{padding:"14px 28px",fontSize:"0.82rem",fontWeight:600,cursor:"pointer",color:tab===id?"var(--text)":"var(--muted)",background:"transparent",border:"none",borderBottom:tab===id?"2px solid var(--arc)":"2px solid transparent",fontFamily:"Outfit,sans-serif",transition:"all 0.2s"}}>
              {label}
            </button>
          ))}
        </div>

        {/* ══ PREDICT TAB ══ */}
        {tab==="predict"&&(
          <div style={{display:"flex",flexDirection:"column",gap:14}}>

            {/* Multiplier banner */}
            {isConnected&&multVal>100&&(
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:"linear-gradient(135deg,rgba(0,212,255,0.06),rgba(0,212,255,0.02))",border:"1px solid rgba(0,212,255,0.15)",borderRadius:10,padding:"10px 16px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span>⚡</span>
                  <div>
                    <div style={{fontSize:"0.78rem",fontWeight:600,color:"var(--arc)"}}>GM Streak Boost Active · {myStreak} day streak</div>
                    <div style={{fontSize:"0.62rem",color:"var(--muted)"}}>Correct prediction earns {(10*multVal/100).toFixed(0)} pts instead of 10</div>
                  </div>
                </div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:"1.4rem",fontWeight:500,color:"var(--arc)"}}>{mText(multVal)}</div>
              </div>
            )}

            {/* Asset toggle — BTC always, ETH when active */}
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setAsset(0)}
                style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:10,border:`2px solid ${asset===0?"#F7931A":"var(--border)"}`,background:asset===0?"rgba(247,147,26,0.08)":"var(--s2)",cursor:"pointer",fontFamily:"Outfit,sans-serif",fontWeight:600,color:asset===0?"#F7931A":"var(--muted)",transition:"all 0.2s"}}>
                <BtcLogo size={20}/> Bitcoin
              </button>
              {ethActive?(
                <button onClick={()=>setAsset(1)}
                  style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:10,border:`2px solid ${asset===1?"#627EEA":"var(--border)"}`,background:asset===1?"rgba(98,126,234,0.08)":"var(--s2)",cursor:"pointer",fontFamily:"Outfit,sans-serif",fontWeight:600,color:asset===1?"#627EEA":"var(--muted)",transition:"all 0.2s"}}>
                  <EthLogo size={20}/> Ethereum
                </button>
              ):(
                <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 20px",borderRadius:10,border:"2px solid var(--border)",background:"var(--s2)",opacity:0.4,cursor:"not-allowed",fontFamily:"Outfit,sans-serif",fontWeight:600,color:"var(--muted)"}}>
                  <EthLogo size={20}/> Ethereum <span style={{fontSize:"0.6rem",marginLeft:4}}>Coming soon</span>
                </div>
              )}
            </div>

            {/* Market header */}
            <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,padding:"20px 24px",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:0,left:0,right:0,height:1,background:`linear-gradient(90deg,transparent,${asset===0?"rgba(247,147,26,0.5)":"rgba(98,126,234,0.5)"},transparent)`}}/>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <AssetLogo size={48}/>
                  <div>
                    <div style={{fontSize:"1.1rem",fontWeight:700,color:"var(--text)"}}>{assetName} Up or Down</div>
                    <div style={{fontSize:"0.68rem",color:"var(--muted)",marginTop:2}}>24 Hour Round · Arc Testnet · Powered by Stork Oracle</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:20}}>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"0.6rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--muted)"}}>Chance UP</div>
                    <div style={{fontSize:"0.9rem",fontWeight:700,color:"var(--green)",fontFamily:"DM Mono,monospace"}}>{upPct}%</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:"0.6rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--muted)"}}>Volume</div>
                    <div style={{fontSize:"0.9rem",fontWeight:700,color:"var(--text)",fontFamily:"DM Mono,monospace"}}>${totalPool.toFixed(0)}</div>
                  </div>
                </div>
              </div>

              {/* Price display */}
              <div style={{display:"flex",alignItems:"flex-end",justifyContent:"space-between"}}>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:6}}>
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:"0.7rem",color:"var(--muted)"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",border:"2px solid var(--muted)"}}/> Target (Snapshot)
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:5,fontSize:"0.7rem",color:"var(--gold)"}}>
                      <div style={{width:8,height:8,borderRadius:"50%",background:"var(--gold)"}}/> Current
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"baseline",gap:12}}>
                    <div style={{fontFamily:"DM Mono,monospace",fontSize:"1.1rem",color:"var(--muted)"}}>{snapshotPrice?fmtPrice(snapshotPrice):"--"}</div>
                    <div style={{fontFamily:"DM Mono,monospace",fontSize:"2rem",fontWeight:500,color:"var(--gold)"}}>
                      {currentPrice?fmtPrice(currentPrice):"--"}
                      {pDiff&&<span style={{fontSize:"0.85rem",fontWeight:600,color:pDiff.up?"var(--green)":"var(--red)",marginLeft:6}}>{pDiff.up?"▲":"▼"} ${Math.abs(pDiff.diff/1e18).toFixed(0)}</span>}
                    </div>
                  </div>
                  {pDiff&&<div style={{marginTop:4,fontSize:"0.78rem",fontWeight:700,color:pDiff.up?"var(--green)":"var(--red)"}}>{pDiff.up?"▲ ABOVE target":"▼ BELOW target"} · {Math.abs(pDiff.pct).toFixed(2)}%</div>}
                  <div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:6,background:"rgba(255,184,0,0.06)",border:"1px solid rgba(255,184,0,0.15)",borderRadius:6,padding:"4px 10px",fontSize:"0.6rem",color:"rgba(255,184,0,0.7)"}}>
                    ⚠ Testnet oracle prices may differ from live market · Chart shows Binance reference
                  </div>
                </div>
                {roundEndTime>0?<CountdownBoxes targetMs={roundEndTime}/>:<div style={{fontSize:"0.72rem",color:"var(--muted)"}}>No active round · First prediction starts it</div>}
              </div>
            </div>

            {/* Chart — shows 24h daily candles */}
            <TradingViewChart symbol={tvSymbol}/>

            {/* Predict entry */}
            {!isConnected?(
              <div style={{textAlign:"center",padding:20,color:"var(--muted)",fontSize:"0.8rem"}}>Connect wallet to predict</div>
            ):!hasEntry?(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",color:"var(--muted)"}}>
                  <span>Entry Amount (USDC)</span><span>Balance: ${usdcBalance} USDC</span>
                </div>
                <input type="number" value={entryAmount} onChange={e=>setEntryAmount(e.target.value)} placeholder="Min 1 USDC" min="1" step="1"/>
                <div style={{display:"flex",gap:6}}>
                  {["1","5","10","25","50"].map(v=>(
                    <button key={v} onClick={()=>setEntryAmount(v)}
                      style={{flex:1,padding:"5px 0",border:"1px solid var(--border)",borderRadius:6,background:entryAmount===v?"rgba(0,212,255,0.1)":"var(--s2)",color:entryAmount===v?"var(--arc)":"var(--muted)",fontSize:"0.68rem",cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>
                      ${v}
                    </button>
                  ))}
                </div>
                {needsApproval?(
                  <button className="btn-arc" style={{width:"100%",padding:14,fontSize:"0.9rem"}} onClick={handleApprove} disabled={approvePending||approveConfirming}>
                    {approvePending?"⏳ Confirm approval...":approveConfirming?"⛓ Approving...":"Approve USDC to Predict"}
                  </button>
                ):(
                  <div style={{display:"flex",gap:10}}>
                    <button className="btn-up" style={{flex:1,padding:18,fontSize:"1rem"}} onClick={()=>handlePredict(true)} disabled={predictPending||predictConfirming}>
                      <div>📈 {assetTicker} UP</div>
                      <div style={{fontSize:"0.68rem",opacity:0.7,marginTop:4}}>{upPct}% predicting up</div>
                      <div style={{fontSize:"0.62rem",opacity:0.5,marginTop:2}}>Win: 10 × {mText(multVal)} pts + USDC</div>
                    </button>
                    <button className="btn-down" style={{flex:1,padding:18,fontSize:"1rem"}} onClick={()=>handlePredict(false)} disabled={predictPending||predictConfirming}>
                      <div>📉 {assetTicker} DOWN</div>
                      <div style={{fontSize:"0.68rem",opacity:0.7,marginTop:4}}>{downPct}% predicting down</div>
                      <div style={{fontSize:"0.62rem",opacity:0.5,marginTop:2}}>Win: 10 × {mText(multVal)} pts + USDC</div>
                    </button>
                  </div>
                )}
                {(predictPending||predictConfirming)&&<div style={{textAlign:"center",fontSize:"0.75rem",color:"var(--green)",animation:"float 2s ease-in-out infinite"}}>{predictPending?"⏳ Confirm in wallet...":"⛓ Confirming on chain..."}</div>}
              </div>
            ):null}

            {/* BOTTOM TABS */}
            {isConnected&&(
              <div style={{background:"var(--surface)",border:"1px solid var(--border)",borderRadius:14,overflow:"hidden"}}>
                <div style={{display:"flex",borderBottom:"1px solid var(--border)"}}>
                  {[["positions","Positions"],["history","History"],["community","Community"]].map(([id,label])=>(
                    <button key={id} onClick={()=>setBottomTab(id)}
                      style={{flex:1,padding:"12px 0",border:"none",background:"transparent",color:bottomTab===id?"var(--text)":"var(--muted)",fontSize:"0.78rem",fontWeight:600,cursor:"pointer",fontFamily:"Outfit,sans-serif",borderBottom:bottomTab===id?"2px solid var(--arc)":"2px solid transparent"}}>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{padding:16}}>

                  {/* POSITIONS */}
                  {bottomTab==="positions"&&(
                    hasEntry?(
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",background:"var(--s2)",borderRadius:10,border:`1px solid ${entryWinning?"rgba(0,232,122,0.2)":"rgba(255,69,97,0.15)"}`}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <AssetLogo size={36}/>
                          <div>
                            <div style={{fontSize:"0.75rem",fontWeight:600,color:"var(--text)"}}>
                              {assetTicker} <span style={{color:entryIsUp?"var(--green)":"var(--red)"}}>{entryIsUp?"▲ UP":"▼ DOWN"}</span>
                              <span style={{marginLeft:8,fontSize:"0.65rem",fontWeight:600,color:entryWinning?"var(--green)":"var(--red)"}}>{entryWinning?"✓ Winning":"✗ Losing"}</span>
                            </div>
                            <div style={{fontSize:"0.62rem",color:"var(--muted)",marginTop:2}}>Stake: ${entryAmt} USDC · Est: <span style={{color:"var(--arc)"}}>${estPayout} USDC</span></div>
                          </div>
                        </div>
                        <div style={{display:"flex",gap:8}}>
                          {roundFinalized&&!entryClaimed&&<button onClick={()=>handleClaim(currentRoundId)} style={{background:"rgba(0,232,122,0.1)",border:"1px solid rgba(0,232,122,0.2)",color:"var(--green)",padding:"7px 14px",borderRadius:8,fontSize:"0.72rem",fontWeight:600,cursor:"pointer",fontFamily:"Outfit,sans-serif"}} disabled={claimPending||claimConfirming}>{claimPending?"⏳":claimConfirming?"⛓":"💰 Claim"}</button>}
                          {!roundFinalized&&roundEndTime>0&&Date.now()>roundEndTime&&<button onClick={()=>handleFinalize(currentRoundId)} style={{background:"rgba(255,184,0,0.1)",border:"1px solid rgba(255,184,0,0.2)",color:"var(--gold)",padding:"7px 14px",borderRadius:8,fontSize:"0.72rem",fontWeight:600,cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>Finalize</button>}
                          <button onClick={()=>setSharePos({isUp:entryIsUp,asset,snapshot:snapshotPrice,current:currentPrice,winning:entryWinning,streak:myStreak,mult:multVal,wallet:fmt(address)})} style={{background:"rgba(0,212,255,0.08)",border:"1px solid rgba(0,212,255,0.15)",color:"var(--arc)",padding:"7px 14px",borderRadius:8,fontSize:"0.72rem",fontWeight:600,cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>📤 Share</button>
                        </div>
                      </div>
                    ):(
                      <div style={{textAlign:"center",padding:"20px 0",fontSize:"0.75rem",color:"var(--muted)"}}>No open position. Make a prediction above.</div>
                    )
                  )}

                  {/* HISTORY */}
                  {bottomTab==="history"&&(
                    <div>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                        <div style={{fontSize:"0.7rem",color:"var(--muted)"}}>All predictions fetched from chain · today and all time</div>
                        <button onClick={fetchHistory} style={{background:"none",border:"none",color:"var(--muted)",fontSize:"0.68rem",cursor:"pointer",fontFamily:"Outfit,sans-serif"}}>{historyLoading?"⏳ Loading...":"↻ Refresh"}</button>
                      </div>
                      {historyLoading?(
                        <div style={{textAlign:"center",padding:"20px 0",fontSize:"0.75rem",color:"var(--muted)"}}>⏳ Fetching from chain...</div>
                      ):history.length===0?(
                        <div style={{textAlign:"center",padding:"20px 0",fontSize:"0.75rem",color:"var(--muted)"}}>No predictions yet.</div>
                      ):(
                        <div style={{display:"flex",flexDirection:"column",gap:8}}>
                          {history.map(h=><HistoryItem key={h.roundId.toString()} h={h}/>)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* COMMUNITY */}
                  {bottomTab==="community"&&(
                    <div style={{display:"flex",flexDirection:"column",gap:12}}>
                      <div style={{fontSize:"0.75rem",color:"var(--muted)",lineHeight:1.6}}>Follow ArcGM updates and connect with other players.</div>
                      <a href="https://x.com/mkoneth" target="_blank" rel="noopener noreferrer"
                        style={{display:"flex",alignItems:"center",gap:12,padding:"14px 16px",background:"var(--s2)",border:"1px solid var(--border)",borderRadius:10,textDecoration:"none"}}
                        onMouseEnter={e=>e.currentTarget.style.borderColor="rgba(0,212,255,0.2)"}
                        onMouseLeave={e=>e.currentTarget.style.borderColor="var(--border)"}>
                        <div style={{width:36,height:36,borderRadius:"50%",background:"#000",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>𝕏</div>
                        <div>
                          <div style={{fontSize:"0.82rem",fontWeight:600,color:"var(--text)"}}>@mkoneth</div>
                          <div style={{fontSize:"0.65rem",color:"var(--muted)",marginTop:2}}>Follow for ArcGM updates and predictions</div>
                        </div>
                        <div style={{marginLeft:"auto",fontSize:"0.7rem",color:"var(--arc)"}}>Follow →</div>
                      </a>
                      <div style={{fontSize:"0.65rem",color:"var(--muted)",padding:"10px 12px",background:"rgba(0,212,255,0.04)",borderRadius:8,lineHeight:1.6}}>
                        💡 Share your winning predictions on X. Tag @mkoneth and use #ArcGM
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ GM TAB ══ */}
        {tab==="gm"&&(
          <div style={{display:"grid",gridTemplateColumns:"240px 1fr 240px",gap:16,alignItems:"start"}}>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div className="panel">
                <div style={{fontSize:"0.6rem",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--muted)",marginBottom:5}}>Total Points</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:"2rem",fontWeight:500,color:"var(--arc)"}}>{totalPts}</div>
                {myRank>0&&<div style={{marginTop:5,display:"inline-flex",alignItems:"center",gap:4,background:"rgba(0,232,122,0.1)",border:"1px solid rgba(0,232,122,0.2)",borderRadius:6,padding:"3px 8px",fontSize:"0.65rem",color:"var(--green)"}}>🏆 Rank #{myRank}</div>}
              </div>
              <div className="panel">
                <div style={{fontSize:"0.6rem",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--muted)",marginBottom:5}}>GM Streak</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:"2rem",fontWeight:500,color:"var(--text)"}}>{myStreak}</div>
                <div style={{fontSize:"0.65rem",color:"var(--muted)",marginTop:4}}>Longest: {longestStreak} days</div>
              </div>
              <div className="panel">
                <div style={{fontSize:"0.6rem",textTransform:"uppercase",letterSpacing:"0.12em",color:"var(--muted)",marginBottom:5}}>Total GMs</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:"2rem",fontWeight:500,color:"var(--text)"}}>{myGMs}</div>
              </div>
              {canRestore&&(
                <div style={{background:"rgba(255,107,53,0.05)",border:"1px solid rgba(255,107,53,0.2)",borderRadius:10,padding:14}}>
                  <div style={{fontSize:"0.72rem",color:"#FF6B35",marginBottom:6}}>⚠ Streak broken yesterday</div>
                  <div style={{fontSize:"0.65rem",color:"var(--muted)",marginBottom:8}}>Restore for {restoreCost} pts · 24h window</div>
                  <button style={{width:"100%",padding:9,background:"rgba(255,107,53,0.1)",border:"1px solid rgba(255,107,53,0.4)",color:"#FF6B35",fontSize:"0.78rem",borderRadius:8,cursor:"pointer",fontFamily:"Outfit,sans-serif",fontWeight:600}}
                    onClick={handleRestore} disabled={restorePending||restoreConfirming}>
                    {restorePending?"⏳":restoreConfirming?"⛓":`🔄 Restore (${restoreCost} pts)`}
                  </button>
                </div>
              )}
            </div>

            <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
              <div style={{textAlign:"center"}}>
                <div style={{fontSize:"0.6rem",textTransform:"uppercase",letterSpacing:"0.15em",color:"var(--muted)",marginBottom:4}}>Global GM Count · Arc Testnet</div>
                <div style={{fontFamily:"DM Mono,monospace",fontSize:"3rem",fontWeight:500,background:"linear-gradient(135deg,var(--arc),#7B9EFF)",backgroundSize:"200% auto",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",animation:"shimmer 4s linear infinite"}}>{globalGMsNum.toLocaleString()}</div>
              </div>
              <div style={{position:"relative",display:"flex",alignItems:"center",justifyContent:"center",width:200,height:200}}>
                {[196,166].map((size,i)=>(
                  <div key={i} style={{position:"absolute",width:size,height:size,borderRadius:"50%",border:"1px solid rgba(0,212,255,0.12)",animation:`pulse ${3+i}s ease-in-out ${i*0.6}s infinite`}}/>
                ))}
                <button style={{width:126,height:126,borderRadius:"50%",border:"none",cursor:canGMToday?"pointer":"not-allowed",background:canGMToday?"linear-gradient(135deg,#002840,#005580,#00D4FF)":"linear-gradient(135deg,#1a2235,#2a3545)",fontFamily:"Outfit,sans-serif",fontSize:"1.8rem",fontWeight:800,color:"#fff",letterSpacing:"0.08em",animation:canGMToday?"glow 3s ease-in-out infinite":"none",transition:"transform 0.15s",zIndex:2,position:"relative",opacity:canGMToday?1:0.5}}
                  onClick={handleGM} disabled={!canGMToday||gmPending||gmConfirming}
                  onMouseEnter={e=>canGMToday&&(e.target.style.transform="scale(1.06)")}
                  onMouseLeave={e=>(e.target.style.transform="scale(1)")}>
                  {gmPending?"...":gmConfirming?"⏳":"GM"}
                </button>
              </div>
              {(gmPending||gmConfirming)&&<div style={{fontSize:"0.75rem",color:"var(--green)",animation:"float 2s ease-in-out infinite"}}>{gmPending?"⏳ Confirm in wallet...":"⛓ Confirming on chain..."}</div>}
              {!isConnected?<div style={{fontSize:"0.78rem",color:"var(--muted)"}}>Connect wallet to GM</div>
              :canGMToday?<div style={{fontSize:"0.78rem",color:"var(--green)",opacity:0.7,letterSpacing:"0.08em",animation:"float 3s ease-in-out infinite"}}>✦ tap to say gm on arc ✦</div>
              :(
                <div style={{textAlign:"center",background:"var(--surface)",border:"1px solid var(--border)",borderRadius:10,padding:"11px 24px"}}>
                  <div style={{fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.15em",color:"var(--muted)",marginBottom:6}}>Resets at UTC 00:00 in</div>
                  <CountdownBoxes targetMs={utcMidnight}/>
                </div>
              )}
              <div style={{fontSize:"0.64rem",color:"var(--muted)",textAlign:"center",lineHeight:1.7,maxWidth:260}}>One GM per wallet per UTC day<br/>Streak multiplier applies to GM and prediction points</div>
              <div style={{background:"rgba(255,184,0,0.06)",border:"1px solid rgba(255,184,0,0.15)",borderRadius:10,padding:"10px 14px",textAlign:"center",maxWidth:280}}>
                <div style={{fontSize:"0.68rem",color:"var(--gold)",fontWeight:600,marginBottom:3}}>🌅 First GM Bonus · +2 pts</div>
                <div style={{fontSize:"0.62rem",color:"rgba(255,184,0,0.6)",lineHeight:1.6}}>First wallet to GM each UTC day earns +2 bonus points automatically. Race to be first every day.</div>
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              <div className="panel">
                <div className="lbl">Streak Multiplier</div>
                <div style={{display:"flex",gap:3,margin:"8px 0"}}>
                  {Array.from({length:15},(_,i)=>(
                    <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<myStreak?(i<7?"var(--arc)":"var(--gold)"):"#1A2235"}}/>
                  ))}
                </div>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.58rem",color:"var(--muted)",marginBottom:10}}>
                  <span>1x</span><span>7d→<span style={{color:"var(--arc)",fontWeight:700}}>1.5x</span></span><span>15d→<span style={{color:"var(--green)",fontWeight:700}}>2x</span></span>
                </div>
                {[["No streak","1x","10 pts","var(--muted)"],["7 day streak","1.5x","15 pts","var(--arc)"],["15 day streak","2x","20 pts","var(--green)"]].map(([label,mult,pts,color])=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",padding:"6px 9px",background:"var(--s2)",borderRadius:6,marginBottom:4}}>
                    <span style={{color:"var(--muted)"}}>{label}</span>
                    <span style={{fontFamily:"DM Mono,monospace",fontWeight:600,color}}>{mult} · {pts}/win</span>
                  </div>
                ))}
              </div>
              <div className="panel">
                <div className="lbl">Streak Restore Cost</div>
                {[["1 to 7 days","25 pts",myStreak>=1&&myStreak<=7],["8 to 15 days","50 pts",myStreak>=8&&myStreak<=15],["16 to 30 days","75 pts",myStreak>=16&&myStreak<=30],["30+ days","100 pts",myStreak>30]].map(([label,cost,active])=>(
                  <div key={label} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid var(--border)",fontSize:"0.72rem"}}>
                    <span style={{color:active?"rgba(255,107,53,0.7)":"var(--muted)"}}>{active?"→ ":""}{label}</span>
                    <span style={{fontFamily:"DM Mono,monospace",fontWeight:600,color:active?"rgba(255,107,53,0.9)":"var(--text)"}}>{cost}</span>
                  </div>
                ))}
                <div style={{fontSize:"0.62rem",color:"var(--muted)",marginTop:8}}>24h window · Points deducted</div>
              </div>
            </div>
          </div>
        )}

        {/* ══ LEADERBOARD TAB ══ */}
        {tab==="leaderboard"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 260px",gap:16}}>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              <div style={{display:"grid",gridTemplateColumns:"28px 1fr 80px 60px 60px",gap:8,padding:"6px 12px",fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.1em",color:"var(--muted)"}}>
                <div/><div>Wallet</div><div style={{textAlign:"right"}}>Points</div><div style={{textAlign:"center"}}>Streak</div><div style={{textAlign:"right"}}>Boost</div>
              </div>
              {leaderboard.length===0?(
                <div style={{textAlign:"center",padding:40,color:"var(--muted)",fontSize:"0.8rem"}}>No activity yet. Be the first! 🌅</div>
              ):leaderboard.map((e,i)=>(
                <div key={e.address} className={`lb-row${e.address?.toLowerCase()===address?.toLowerCase()?" me":""}`} style={{animationDelay:`${i*0.05}s`}}>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:"0.72rem",color:i===0?"var(--gold)":i===1?"#8A9BB0":i===2?"#8B6F47":"var(--muted)",textAlign:"center"}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":`#${i+1}`}</div>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:"0.68rem",color:"var(--text)"}}>
                    {fmt(e.address)}{e.address?.toLowerCase()===address?.toLowerCase()&&<span style={{color:"var(--arc)",marginLeft:4,fontSize:"0.6rem"}}>(you)</span>}
                  </div>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:"0.8rem",fontWeight:600,textAlign:"right"}}>{e.points.toFixed(1)}</div>
                  <div style={{fontSize:"0.68rem",color:"var(--gold)",textAlign:"center"}}>🔥{e.streak}d</div>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:"0.68rem",fontWeight:600,textAlign:"right",color:e.mult>=200?"var(--green)":e.mult>=150?"var(--arc)":"var(--muted)"}}>{mText(e.mult)}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {isConnected&&(
                <div style={{background:"linear-gradient(135deg,rgba(0,212,255,0.08),rgba(0,212,255,0.02))",border:"1px solid rgba(0,212,255,0.18)",borderRadius:12,padding:16,textAlign:"center"}}>
                  <div style={{fontSize:"0.58rem",textTransform:"uppercase",letterSpacing:"0.15em",color:"rgba(0,212,255,0.4)",marginBottom:6}}>Your Rank</div>
                  <div style={{fontFamily:"DM Mono,monospace",fontSize:"2.8rem",fontWeight:500,color:"var(--arc)"}}>{myRank>0?`#${myRank}`:"--"}</div>
                  <div style={{fontSize:"0.7rem",color:"var(--muted)",marginTop:4}}>{totalPts} pts · {myStreak}d streak</div>
                  <div style={{display:"inline-flex",alignItems:"center",gap:4,background:"rgba(0,232,122,0.1)",border:"1px solid rgba(0,232,122,0.2)",borderRadius:6,padding:"3px 10px",fontSize:"0.68rem",color:"var(--green)",marginTop:6}}>⚡ {mText(multVal)} active</div>
                </div>
              )}
              <div className="panel">
                <div className="lbl">Points System</div>
                {[["Correct prediction","10 × mult"],["Wrong prediction","0 pts"],["Daily GM","1 × mult"],["First GM of day","+2 pts bonus"],["7 day streak","1.5x boost"],["15 day streak","2x boost"]].map(([l,r])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",padding:"5px 0",borderBottom:"1px solid var(--border)"}}>
                    <span style={{color:"var(--muted)"}}>{l}</span>
                    <span style={{fontFamily:"DM Mono,monospace",fontWeight:600,color:"var(--arc)"}}>{r}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
      {sharePos&&<ShareModal position={sharePos} onClose={()=>setSharePos(null)}/>}
    </>
  );
}
