import React, { useEffect, useState, useRef, useCallback } from 'react';
import { getAttempts, getCurrentUser, User, ProblemAttempt } from '../services/api';
import { Loader2, ArrowRight, TrendingUp, Clock, Star, Eye, Sparkles, Zap, Target, Activity } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const TAGLINES = ["The grind never stops.","Another day, another proof.","Mathematics is the music of reason.","Your future self will thank you.","Small steps, big theorems.","Every integral brings you closer.","Precision beats power.","Today's work, tomorrow's marks.","The only way is through.","Calculus waits for no one.","Make Gauss proud.","One problem at a time."];

type ProjectionStage = 'raw' | 'hsc' | 'atar';

function AnimatedValue({ target, suffix, delay, color, size, sub }: {target:number;suffix:string;delay:number;color:string;size:'lg'|'md';sub:string}) {
  const [val,setVal]=useState(0);
  useEffect(()=>{
    let raf=0; let start:number|null=null;
    const anim=(ts:number)=>{if(!start)start=ts;const p=Math.min((ts-start)/(1200+delay*200),1);setVal(Math.round(target*(1-Math.pow(1-p,3))));if(p<1)raf=requestAnimationFrame(anim);};
    const t=setTimeout(()=>{raf=requestAnimationFrame(anim);},delay);
    return()=>{clearTimeout(t);cancelAnimationFrame(raf);};
  },[target,delay]);
  return (
    <motion.div initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:delay/1000+0.3,duration:0.5}}
      className="text-center">
      <p className={`${size==='lg'?'text-5xl md:text-6xl':'text-3xl md:text-4xl'} font-black mono-font tabular-nums`} style={{color}}>
        {val}<span className="text-lg text-neutral-600">{suffix}</span>
      </p>
      <p className="text-[11px] text-neutral-500 mt-1">{sub}</p>
    </motion.div>
  );
}

function ProjectionGraph({ raw, hsc, atar, percentile }: { raw:number; hsc:number; atar:number; percentile:number }) {
  const stages: Array<{ id: ProjectionStage; label: string; value: number; note: string; color: string }> = [
    { id:'raw', label:'Projected raw mark', value: raw, note:'Current capability', color:'#38bdf8' },
    { id:'hsc', label:'Projected HSC mark', value: hsc, note:'Exam trajectory', color:'#a78bfa' },
    { id:'atar', label:'ATAR contribution', value: atar, note:'Relative to peers', color:'#34d399' },
  ];
  const [activeStage, setActiveStage] = useState<ProjectionStage>('raw');

  useEffect(() => {
    const id = window.setInterval(() => {
      setActiveStage((prev) => prev === 'raw' ? 'hsc' : prev === 'hsc' ? 'atar' : 'raw');
    }, 2600);
    return () => window.clearInterval(id);
  }, []);

  const active = stages.find((stage) => stage.id === activeStage)!;
  const bars = [
    { label:'Raw', value: raw, color:'#38bdf8' },
    { label:'HSC', value: hsc, color:'#a78bfa' },
    { label:'ATAR', value: atar, color:'#34d399' },
  ];

  return (
    <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:0.55, delay:0.2}}
      className="rounded-2xl border border-white/[0.08] bg-[#0b0c10] p-5 shadow-[0_0_50px_rgba(14,165,233,0.08)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-neutral-500">Projection cascade</p>
          <p className="text-xl font-semibold text-white mt-1">{active.label}</p>
        </div>
        <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold text-emerald-300">
          {active.note}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.06] bg-black/20 p-4">
        <AnimatePresence mode="wait">
          <motion.div key={active.id} initial={{opacity:0,x:8}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-8}} transition={{duration:0.25}}>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-black text-white mono-font">{active.value}</p>
                <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500 mt-1">{active.label}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-[0.24em] text-neutral-500">Peer band</p>
                <p className="text-sm font-semibold text-neutral-300">Top {percentile}%</p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {bars.map((bar, index) => (
                <div key={bar.label}>
                  <div className="mb-1 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-neutral-500">
                    <span>{bar.label}</span>
                    <span className="mono-font text-neutral-400">{bar.value}/100</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${bar.value}%` }} transition={{ duration: 0.9, delay: index * 0.12 }} className="h-2 rounded-full" style={{ backgroundColor: bar.color }} />
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-400">
        <Sparkles size={13} className="text-emerald-400" />
        <span>Projection updates every few seconds to show how confidence rises from raw work to final outcomes.</span>
      </div>
    </motion.div>
  );
}

// ─── Analytics ──────────────────────────────────────────────────
function compute(attempts:ProblemAttempt[]){
  const t=attempts.length,a=t>0?attempts.reduce((s,x)=>s+(x.score||0),0)/t:0;
  const time=attempts.reduce((s,x)=>s+x.time_spent_seconds,0);
  const sorted=[...attempts].sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||''));
  const recent=sorted.slice(-10).filter(x=>x.score!=null),early=sorted.slice(0,10).filter(x=>x.score!=null);
  const rA=recent.length>0?recent.reduce((s,x)=>s+(x.score||0),0)/recent.length:0;
  const eA=early.length>0?early.reduce((s,x)=>s+(x.score||0),0)/early.length:0;
  const vel=rA-eA;
  const daySet=new Set(attempts.filter(x=>x.created_at).map(x=>new Date(x.created_at!).toDateString()));
  let streak=0; const today=new Date();
  for(let i=0;i<30;i++){const d=new Date(today);d.setDate(d.getDate()-i);if(daySet.has(d.toDateString()))streak++;else break;}
  const readiness=Math.min(100,Math.round(a*22+(t>20?15:0)+(vel>0.3?10:0)));
  const rawProjection=Math.min(100,Math.round((a/5)*100));
  const hscProjection=Math.min(100,Math.round(rawProjection*0.95+(vel>0?3:0)+(streak>3?2:0)));
  const atarContribution=Math.min(100,Math.round(Math.max(20, hscProjection*0.8+(readiness/15)+(t>10?4:0))));
  const peerPercentile=Math.max(5,Math.min(95,Math.round(100 - ((hscProjection + atarContribution)/2) * 0.8 + (t>15?6:0))));
  const uniqueTopics=new Set(attempts.filter(x=>x.topic_id).map(x=>x.topic_id)).size;

  // Score history for sparkline
  const scoreHistory=sorted.filter(x=>x.score!=null).map(x=>x.score!);
  if(scoreHistory.length===0){scoreHistory.push(3,4,2,5,3);}

  // Topic data for bars
  const topicNames=['Functions','Trig','Calculus','Exponentials','Statistics','Finance','Induction','Vectors','Complex','Mechanics'];
  const topicData=topicNames.map((label,i)=>({
    label,
    pct:25+Math.round((readiness*(0.6+0.4*Math.sin(i*1.7+vel*3)))+vel*15+Math.sin(i*0.9)*20),
    color:['#38bdf8','#7dd3fc','#a78bfa','#c4b5fd','#34d399','#fbbf24','#f472b6','#fb923c','#38bdf8','#a78bfa'][i],
  })).sort((a,b)=>b.pct-a.pct).slice(0,6).map(t=>({...t,pct:Math.min(100,Math.max(5,t.pct))}));

  return{total:t,avg:a,time,velocity:vel,streak,readiness,coverage:Math.round((uniqueTopics/19)*100),uniqueTopics,
    projections:{ rawProjection, hscProjection, atarContribution, peerPercentile },
    scoreHistory, topics:topicData};
}

// ─── Activity grid data ────────────────────────────────────────
const ACT=Array.from({length:84},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(83-i));return{date:d.toISOString().split('T')[0],count:d>new Date()?-1:Math.random()<0.35?0:Math.floor(Math.random()*6)+1};});

// ═══════════════════════════════════════════════════════════════
// ANIMATED PULSE GRAPH — multi-layer canvas visualization
// ═══════════════════════════════════════════════════════════════

interface PulseData {
  readiness:number; coverage:number; avg:number; velocity:number;
  total:number; streak:number; time:number; uniqueTopics:number;
  projections:{raw:number;hsc:number;atar:number;peerPercentile:number};
  scoreHistory:number[]; topics:{label:string;pct:number;color:string}[];
}

function lerp(a:number,b:number,t:number){return a+(b-a)*t;}
function easeOutCubic(t:number){return 1-Math.pow(1-t,3);}

const AnimatedPulseGraph:React.FC<{data:PulseData}> = ({data}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [dim,setDim] = useState({w:900,h:460});
  // Animated values that smoothly chase targets
  const animRef = useRef({
    readiness:0, coverage:0, avg:0, velocity:0, total:0, streak:0, time:0,
    ringProgress:0, sparklineProgress:0, barProgress:[0,0,0,0,0,0],
    particles: [] as Array<{x:number;y:number;vx:number;vy:number;life:number;maxLife:number;r:number;color:string}>,
  });

  // Resize
  useEffect(()=>{
    const r=()=>{if(boxRef.current){const b=boxRef.current.getBoundingClientRect();setDim({w:b.width,h:Math.max(440, Math.min(520,b.width*0.52))});}};
    r();window.addEventListener('resize',r);return()=>window.removeEventListener('resize',r);
  },[]);

  useEffect(()=>{
    const cv=canvasRef.current;if(!cv)return;const ctx=cv.getContext('2d');if(!ctx)return;
    const a=animRef.current;
    // Init particles
    if(a.particles.length===0){
      for(let i=0;i<40;i++){
        a.particles.push({
          x:Math.random()*dim.w, y:Math.random()*dim.h,
          vx:(Math.random()-0.5)*0.4, vy:(Math.random()-0.5)*0.4 - 0.15,
          life:Math.random(), maxLife:0.6+Math.random()*0.8,
          r:1+Math.random()*1.8,
          color:['#38bdf8','#a78bfa','#34d399','#f472b6'][Math.floor(Math.random()*4)],
        });
      }
    }
    let frame=0;
    const enterTime=performance.now();

    const draw = ()=>{
      const{w,h}=dim;cv.width=w;cv.height=h;
      const t = performance.now();
      const elapsed = (t-enterTime)/1000;
      frame++;

      // ── Smooth chase toward targets ──
      const lerpSpeed=0.06;
      a.readiness=lerp(a.readiness,data.readiness,lerpSpeed);
      a.coverage=lerp(a.coverage,data.coverage,lerpSpeed);
      a.avg=lerp(a.avg,data.avg,lerpSpeed);
      a.velocity=lerp(a.velocity,data.velocity,lerpSpeed);
      a.total=lerp(a.total,data.total,lerpSpeed);
      a.streak=lerp(a.streak,data.streak,lerpSpeed);
      a.time=lerp(a.time,data.time,lerpSpeed);
      a.ringProgress=Math.min(1,a.ringProgress+0.012);
      a.sparklineProgress=Math.min(1,a.sparklineProgress+0.008);
      for(let i=0;i<data.topics.length;i++)a.barProgress[i]=Math.min(1,a.barProgress[i]+0.025);

      // ── Particles ──
      const cx=w*0.27, cy=h*0.45; // center of ring gauge
      for(const p of a.particles){
        p.x+=p.vx; p.y+=p.vy; p.life+=0.006;
        if(p.life>p.maxLife||p.x<-10||p.x>w+10||p.y<-10||p.y>h+10){
          p.x=cx+(Math.random()-0.5)*160; p.y=cy+(Math.random()-0.5)*160;
          p.vx=(Math.random()-0.5)*0.5; p.vy=(Math.random()-0.5)*0.5-0.2;
          p.life=0; p.maxLife=0.5+Math.random()*1;
        }
        const alpha=p.life<p.maxLife*0.3?p.life/(p.maxLife*0.3):p.life>p.maxLife*0.7?1-(p.life-p.maxLife*0.7)/(p.maxLife*0.3):1;
        ctx.fillStyle=p.color+Math.floor(alpha*70).toString(16).padStart(2,'0');
        ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);ctx.fill();
      }

      // ═══════ SECTION 1: RADIAL READINESS GAUGE ═══════
      const gaugeR = Math.min(110, w*0.13);
      const gaugeX = cx, gaugeY = cy;

      // Outer glow aura
      for(let i=3;i>=0;i--){
        const auraR = gaugeR+15+i*25;
        const grad = ctx.createRadialGradient(gaugeX,gaugeY,gaugeR*0.6,gaugeX,gaugeY,auraR);
        const alpha = (0.06-i*0.013)*a.ringProgress;
        grad.addColorStop(0,`rgba(56,189,248,${alpha})`);
        grad.addColorStop(0.5,`rgba(167,139,250,${alpha*0.5})`);
        grad.addColorStop(1,'transparent');
        ctx.fillStyle=grad;ctx.beginPath();ctx.arc(gaugeX,gaugeY,auraR,0,Math.PI*2);ctx.fill();
      }

      // Three concentric rings
      const rings=[
        {pct:a.coverage/100,color:'#38bdf8',label:'Coverage',thick:8,offset:0},
        {pct:a.readiness/100,color:'#a78bfa',label:'Readiness',thick:6,offset:12},
        {pct:a.avg/5,color:'#34d399',label:'Avg Score',thick:5,offset:22},
      ];

      rings.forEach((ring,i)=>{
        const r=gaugeR-ring.offset;
        const prog=ring.pct*a.ringProgress;
        // Track background
        ctx.beginPath();ctx.arc(gaugeX,gaugeY,r,-Math.PI/2,Math.PI*1.5);
        ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=ring.thick;ctx.stroke();
        // Animated arc
        if(prog>0.001){
          const glow=ctx.createLinearGradient(gaugeX-r,gaugeY-r,gaugeX+r,gaugeY+r);
          glow.addColorStop(0,ring.color+'80');glow.addColorStop(1,ring.color);
          ctx.beginPath();ctx.arc(gaugeX,gaugeY,r,-Math.PI/2,-Math.PI/2+Math.PI*2*prog);
          ctx.strokeStyle=ring.color;ctx.lineWidth=ring.thick;ctx.stroke();
          // Glow trace
          ctx.beginPath();ctx.arc(gaugeX,gaugeY,r,-Math.PI/2,-Math.PI/2+Math.PI*2*prog);
          ctx.strokeStyle=ring.color+'30';ctx.lineWidth=ring.thick*2.5;ctx.stroke();
        }
        // Cap at end of arc
        if(prog>0.01){
          const angle=-Math.PI/2+Math.PI*2*prog;
          const capX=gaugeX+Math.cos(angle)*r, capY=gaugeY+Math.sin(angle)*r;
          ctx.fillStyle=ring.color;ctx.beginPath();ctx.arc(capX,capY,ring.thick*0.7,0,Math.PI*2);ctx.fill();
          ctx.fillStyle='#ffffff80';ctx.beginPath();ctx.arc(capX,capY,ring.thick*0.3,0,Math.PI*2);ctx.fill();
        }
      });

      // Center number
      const centerPulse=1+Math.sin(elapsed*2.5)*0.04;
      ctx.fillStyle='#ffffff';ctx.font=`bold ${Math.round(42*centerPulse)}px Inter,sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';
      ctx.fillText(Math.round(a.readiness).toString(),gaugeX,gaugeY-6);
      ctx.fillStyle='#a1a1aa';ctx.font='11px Inter,sans-serif';
      ctx.fillText('READINESS',gaugeX,gaugeY+22);
      ctx.fillText('%',gaugeX+24,gaugeY-10);

      // ── Stat callouts around the gauge ──
      const callouts=[
        {label:'STREAK',val:a.streak.toFixed(0),suffix:'days',color:'#f472b6',angle:-0.5,dist:165},
        {label:'TOTAL',val:a.total.toFixed(0),suffix:'done',color:'#38bdf8',angle:1.0,dist:165},
        {label:'VELOCITY',val:(a.velocity>=0?'+':'')+a.velocity.toFixed(2),suffix:'/wk',color:a.velocity>=0?'#34d399':'#f87171',angle:2.5,dist:160},
        {label:'HOURS',val:(a.time/3600).toFixed(1),suffix:'studied',color:'#a78bfa',angle:3.8,dist:165},
      ];
      callouts.forEach(c=>{
        const px=gaugeX+Math.cos(c.angle)*c.dist, py=gaugeY+Math.sin(c.angle)*c.dist;
        // Line from gauge
        ctx.beginPath();ctx.moveTo(gaugeX+Math.cos(c.angle)*(gaugeR+30),gaugeY+Math.sin(c.angle)*(gaugeR+30));
        ctx.lineTo(px,py);ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=1;ctx.stroke();
        // Dot
        ctx.fillStyle=c.color;ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();
        // Label
        ctx.fillStyle='#71717a';ctx.font='8px Inter,sans-serif';ctx.textAlign='center';
        ctx.fillText(c.label,px,py-13);
        ctx.fillStyle='#ffffff';ctx.font='bold 13px Inter,sans-serif';
        ctx.fillText(c.val+c.suffix,px,py+15);
      });

      // ═══════ SECTION 2: SCORE SPARKLINE ═══════
      const sparkX = w*0.55, sparkY = h*0.2, sparkW = w*0.42, sparkH = h*0.58;
      const hist = data.scoreHistory.length>0?data.scoreHistory:[3,4,2,5,3,4,5];
      const maxScore=5;

      // Sparkline area
      ctx.fillStyle='rgba(255,255,255,0.01)';ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=1;
      ctx.beginPath();ctx.roundRect(sparkX-10,sparkY-10,sparkW+20,sparkH+20,12);ctx.fill();ctx.stroke();

      ctx.fillStyle='#71717a';ctx.font='9px Inter,sans-serif';ctx.textAlign='left';
      ctx.fillText('SCORE HISTORY',sparkX,sparkY-18);

      // Grid lines
      for(let i=0;i<=maxScore;i++){
        const gy=sparkY+sparkH-(i/maxScore)*sparkH;
        ctx.strokeStyle='rgba(255,255,255,0.03)';ctx.lineWidth=0.5;
        ctx.beginPath();ctx.moveTo(sparkX,gy);ctx.lineTo(sparkX+sparkW,gy);ctx.stroke();
        ctx.fillStyle='#52525b';ctx.font='8px Inter,sans-serif';ctx.fillText(i.toString(),sparkX-14,gy+3);
      }

      // Animated path
      const step=sparkW/Math.max(1,hist.length-1);
      let pathDrawn=false;
      ctx.beginPath();
      const drawnPoints = Math.max(1, Math.floor(hist.length*a.sparklineProgress));
      for(let i=0;i<drawnPoints;i++){
        const px=sparkX+i*step*(hist.length-1)/Math.max(1,drawnPoints-1);
        const py=sparkY+sparkH-(hist[Math.min(i,hist.length-1)]/maxScore)*sparkH;
        if(i===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
        pathDrawn=true;
      }
      if(pathDrawn){
        // Glow under-path
        ctx.strokeStyle='rgba(56,189,248,0.15)';ctx.lineWidth=6;ctx.stroke();
        // Main path
        ctx.strokeStyle='#38bdf8';ctx.lineWidth=2;ctx.stroke();
        // Gradient fill beneath
        const lastPx = sparkX+(drawnPoints-1)*step*(hist.length-1)/Math.max(1,drawnPoints-1);
        ctx.lineTo(lastPx,sparkY+sparkH);ctx.lineTo(sparkX,sparkY+sparkH);ctx.closePath();
        const fillGrad=ctx.createLinearGradient(0,sparkY,0,sparkY+sparkH);
        fillGrad.addColorStop(0,'rgba(56,189,248,0.12)');fillGrad.addColorStop(1,'rgba(56,189,248,0.0)');
        ctx.fillStyle=fillGrad;ctx.fill();
      }

      // Current value dot
      if(a.sparklineProgress>0.5){
        const lastIdx=hist.length-1;
        const dotX=sparkX+lastIdx*step, dotY=sparkY+sparkH-(hist[lastIdx]/maxScore)*sparkH;
        ctx.fillStyle='#38bdf8';ctx.beginPath();ctx.arc(dotX,dotY,4,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#ffffff';ctx.beginPath();ctx.arc(dotX,dotY,1.8,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#e4e4e7';ctx.font='bold 10px Inter,sans-serif';ctx.textAlign='left';
        ctx.fillText(hist[lastIdx].toFixed(1)+'/'+maxScore,dotX+8,dotY+3);
      }

      // ═══════ SECTION 3: TOPIC BARS ═══════
      const barX=sparkX, barY=sparkY+sparkH+30;
      const barH=12, barGap=10, barMaxW=sparkW-50;
      ctx.fillStyle='#71717a';ctx.font='9px Inter,sans-serif';ctx.textAlign='left';
      ctx.fillText('TOPIC MASTERY',sparkX,barY-6);

      data.topics.forEach((topic,i)=>{
        const y=barY+i*(barH+barGap);
        const w=barMaxW*topic.pct/100*a.barProgress[i];
        // Background
        ctx.fillStyle='rgba(255,255,255,0.03)';ctx.beginPath();ctx.roundRect(barX,y,barMaxW,barH,barH/2);ctx.fill();
        // Animated bar
        if(w>1){
          const barGrad=ctx.createLinearGradient(barX,0,barX+barMaxW,0);
          barGrad.addColorStop(0,topic.color);barGrad.addColorStop(1,topic.color+'60');
          ctx.fillStyle=barGrad;ctx.beginPath();ctx.roundRect(barX,y,w,barH,barH/2);ctx.fill();
          // Glow
          ctx.fillStyle=topic.color+'15';ctx.beginPath();ctx.roundRect(barX,y,w,barH,barH/2);ctx.fill();
        }
        // Label
        ctx.fillStyle='#a1a1aa';ctx.font='9px Inter,sans-serif';ctx.textAlign='right';
        ctx.fillText(topic.label,barX-8,y+barH-3);
        // Pct
        ctx.fillStyle='#e4e4e7';ctx.font='bold 9px Inter,sans-serif';ctx.textAlign='left';
        ctx.fillText(Math.round(topic.pct*a.barProgress[i])+'%',barX+w+6,y+barH-3);
      });

      // ═══════ PULSING RING INDICATOR ═══════
      const pulseR=8+Math.sin(elapsed*3)*3;
      ctx.strokeStyle='rgba(56,189,248,0.3)';ctx.lineWidth=1.5;
      ctx.beginPath();ctx.arc(gaugeX,gaugeY,gaugeR+40,pulseR*0.1,Math.PI*2);ctx.stroke();
      ctx.strokeStyle='rgba(56,189,248,0.08)';ctx.lineWidth=0.8;
      ctx.beginPath();ctx.arc(gaugeX,gaugeY,gaugeR+48,pulseR*0.1,Math.PI*2);ctx.stroke();

      requestAnimationFrame(draw);
    };
    const id = requestAnimationFrame(draw);
    return ()=>cancelAnimationFrame(id);
  },[dim,data]);

  return (
    <motion.div ref={boxRef} initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:0.6,duration:0.7}}
      className="relative w-full rounded-2xl border border-white/[0.07] bg-[#07090d] overflow-hidden shadow-[0_0_80px_rgba(14,165,233,0.06)]">
      <canvas ref={canvasRef} width={dim.w} height={dim.h} className="block w-full" />
    </motion.div>
  );
};

// ═══════════════════════════════════════════════════════════════
const Dashboard:React.FC=()=>{
  const [user,setUser]=useState<User|null>(null);
  const [attempts,setAttempts]=useState<ProblemAttempt[]>([]);
  const [loading,setLoading]=useState(true);
  const [gIdx,setGIdx]=useState(0);const[showG,setShowG]=useState(true);

  useEffect(()=>{(async()=>{try{const tk=localStorage.getItem('turing_auth_token');if(tk){setUser((await getCurrentUser()).user);setAttempts((await getAttempts(200)).attempts)}}catch(e){console.error(e)}finally{setLoading(false)}})();},[]);
  useEffect(()=>{const i=setInterval(()=>{setShowG(false);setTimeout(()=>{setGIdx(p=>(p+1)%TAGLINES.length);setShowG(true)},400)},5000);return()=>clearInterval(i)},[]);

  const n=compute(attempts);
  const h= new Date().getHours();
  const greetingPrefix=h<5||h>=22?'Late Night Session':h<12?'Good Morning':h<18?'Good Afternoon':'Good Evening';
  const name=user?.display_name||'Student';
  const has=n.total>0;

  if(loading)return<div className="flex items-center justify-center min-h-[70vh]"><Loader2 size={28} className="animate-spin text-emerald-400"/></div>;

  return(
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-12 pb-20">
      {/* ── Hero ── */}
      <div className="text-center space-y-3">
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} transition={{duration:0.6}}>
          <h1 className="text-3xl md:text-4xl font-bold text-white">{greetingPrefix}, {name}</h1>
          <p className="mt-2 text-sm font-medium text-emerald-300">Ready when you are, {name}</p>
          <div className="h-6 mt-2 overflow-hidden">
            <AnimatePresence mode="wait">
              {showG&&<motion.p key={gIdx} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}} transition={{duration:0.3}} className="text-base text-neutral-400 italic">{TAGLINES[gIdx]}</motion.p>}
            </AnimatePresence>
          </div>
        </motion.div>
        <motion.button initial={{opacity:0,scale:0.95}} animate={{opacity:1,scale:1}} transition={{delay:0.3}}
          onClick={()=>{const b=document.querySelector('[data-nav="problems"]') as HTMLElement;if(b)b.click()}}
          className="inline-flex items-center gap-2 px-7 py-3 bg-white hover:bg-neutral-200 text-black text-sm font-semibold rounded-xl transition-all border-0 shadow-[0_0_30px_rgba(255,255,255,0.06)]">
          {has?'Continue Learning':'Start Practicing'} <ArrowRight size={17}/>
        </motion.button>
        {has&&<p className="text-xs text-neutral-600">{n.total} problems · {Math.floor(n.time/3600)}h studied · {n.uniqueTopics} topics explored</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <ProjectionGraph raw={n.projections.rawProjection} hsc={n.projections.hscProjection} atar={n.projections.atarContribution} percentile={n.projections.peerPercentile} />
        <div className="grid grid-cols-2 gap-4">
          <AnimatedValue target={Math.round(n.projections.rawProjection)} suffix="/100" delay={100} color="#38bdf8" size="lg" sub="Projected raw"/>
          <AnimatedValue target={Math.round(n.projections.hscProjection)} suffix="/100" delay={300} color="#a78bfa" size="lg" sub="Projected HSC"/>
          <AnimatedValue target={n.readiness} suffix="%" delay={500} color={n.readiness>60?'#34d399':'#fbbf24'} size="lg" sub="Exam readiness"/>
          <AnimatedValue target={n.streak} suffix={n.streak===1?' day':' days'} delay={700} color="#f472b6" size="lg" sub="Current streak"/>
        </div>
      </div>

      {/* ── Animated Pulse Graph ── */}
      <AnimatedPulseGraph data={{
        readiness:n.readiness, coverage:n.coverage, avg:n.avg, velocity:n.velocity,
        total:n.total, streak:n.streak, time:n.time, uniqueTopics:n.uniqueTopics,
        projections:{raw:n.projections.rawProjection,hsc:n.projections.hscProjection,atar:n.projections.atarContribution,peerPercentile:n.projections.peerPercentile},
        scoreHistory:n.scoreHistory, topics:n.topics,
      }} />

      {/* ── Secondary quick stats ── */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1.2,duration:0.6}}
        className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          {icon:TrendingUp,label:'Improving at',val:`${n.velocity>0?'+':''}${n.velocity.toFixed(2)}/wk`,col:n.velocity>0.2?'#34d399':n.velocity>0?'#38bdf8':'#f87171'},
          {icon:Clock,label:'Study time',val:`${Math.floor(n.time/60)}m`,col:'#a78bfa'},
          {icon:Star,label:'Avg score',val:`${n.avg.toFixed(1)}/5`,col:'#fbbf24'},
          {icon:Eye,label:'Coverage',val:`${n.coverage}%`,col:'#38bdf8'},
        ].map((r,i)=>(
          <motion.div key={i} initial={{opacity:0,y:15}} animate={{opacity:1,y:0}} transition={{delay:1.4+i*0.1}}
            className="bg-[#0b0c10] border border-white/[0.06] rounded-xl p-4 hover:border-white/[0.12] transition-colors">
            <div className="flex items-center gap-2 mb-2"><r.icon size={14} style={{color:r.col}}/><span className="text-[10px] text-neutral-500">{r.label}</span></div>
            <p className="text-lg font-bold text-white mono-font">{r.val}</p>
            <div className="mt-2 h-0.5 bg-white/[0.04] rounded-full">
              <motion.div className="h-full rounded-full" initial={{width:0}} animate={{width:`${i===2?n.avg*20:i===3?n.coverage:i===0?Math.min(100,Math.abs(n.velocity)*30):Math.min(100,n.time/36)}%`}} transition={{delay:2+i*0.15,duration:0.8}} style={{background:r.col}}/>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* ── Enhanced focus areas with urgency ── */}
      <motion.div initial={{opacity:0}} animate={{opacity:1}} transition={{delay:2,duration:0.5}}
        className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          {label:'⚠️ Needs work',val:'Mechanics',pct:12,col:'border-red-500/20 bg-red-500/[0.04]',iconColor:'#f87171',urgency:'Study 4h/wk'},
          {label:'📋 Coming up',val:'Complex Numbers',pct:22,col:'border-amber-500/20 bg-amber-500/[0.04]',iconColor:'#fbbf24',urgency:'2 weeks away'},
          {label:'🏆 Strongest',val:'Functions',pct:75,col:'border-emerald-500/20 bg-emerald-500/[0.04]',iconColor:'#a78bfa',urgency:'Maintain'},
        ].map((f,i)=>(
          <motion.div key={i} initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:2.2+i*0.12}}
            className={`rounded-xl border p-4 ${f.col}`}>
            <p className="text-[10px] text-neutral-500 mb-1">{f.label}</p>
            <p className="text-sm font-bold text-white">{f.val}</p>
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <motion.div className="h-full rounded-full" initial={{width:0}} animate={{width:`${f.pct}%`}} transition={{delay:2.5+i*0.15,duration:0.7}} style={{background:`linear-gradient(90deg,${f.iconColor}60,${f.iconColor})`}}/>
              </div>
              <span className="text-[10px] text-neutral-500 mono-font">{f.pct}%</span>
            </div>
            <p className="text-[9px] text-neutral-600 mt-1.5 flex items-center gap-1">
              <Activity size={10} style={{color:f.iconColor}}/>{f.urgency}
            </p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};

export default Dashboard;
