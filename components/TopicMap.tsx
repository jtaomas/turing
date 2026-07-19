import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowRight, X, Settings, TrendingUp, Clock, Target, AlertTriangle, Zap, BookOpen, Award, Hash, BarChart3 } from 'lucide-react';
import { getAuthToken, getCurrentUser } from '../services/api';

interface N3 { id:string; label:string; depth:number; x:number; y:number; z:number; cat:string; mastered:number; opacity:number; parentId?:string; _hasData?:boolean; }
interface E3 { source:string; target:string; shared?:boolean; }

type CourseCombo = 'adv'|'adv_x1'|'x1_x2';

function courseToCombo(course: string): CourseCombo {
  const c = (course || '').toLowerCase();
  if (c.includes('extension 2') || c.includes('mx2')) return 'x1_x2';
  if (c.includes('extension 1') || c.includes('mx1')) return 'adv_x1';
  return 'adv';
}

function fibSphere(i:number, total:number, radius:number):{x:number;y:number;z:number} {
  const phi = Math.acos(1 - 2*(i+0.5)/total);
  const theta = Math.PI*(1+Math.sqrt(5))*i;
  return {
    x: radius*Math.cos(theta)*Math.sin(phi),
    y: radius*Math.sin(theta)*Math.sin(phi)*0.7, 
    z: radius*Math.cos(phi),
  };
}

function buildTree(combo:CourseCombo):{nodes:N3[];edges:E3[]} {
  const nodes:N3[]=[]; const edges:E3[]=[];
  const includes=(c:string)=>combo==='x1_x2'?c==='x1'||c==='x2':combo==='adv_x1'?c==='adv'||c==='x1':c==='adv';

  const hubZ:Record<string,number>={adv:-160,x1:-40,x2:120};
  if(includes('adv')) nodes.push({id:'HUB_ADV',label:'Advanced',depth:0,x:0,y:0,z:hubZ.adv,cat:'adv',mastered:0.7,opacity:1});
  if(includes('x1')) nodes.push({id:'HUB_X1',label:'Extension 1',depth:0,x:0,y:0,z:hubZ.x1,cat:'x1',mastered:0.4,opacity:1});
  if(includes('x2')) nodes.push({id:'HUB_X2',label:'Extension 2',depth:0,x:0,y:0,z:hubZ.x2,cat:'x2',mastered:0.15,opacity:1});

  const hubs=nodes.filter(n=>n.depth===0);
  const cx = hubs.reduce((s,n)=>s+n.x,0)/hubs.length;
  const cy = hubs.reduce((s,n)=>s+n.y,0)/hubs.length;
  const cz = hubs.reduce((s,n)=>s+n.z,0)/hubs.length;
  for (const n of nodes) { n.x -= cx; n.y -= cy; n.z -= cz; }
  for(let i=1;i<hubs.length;i++) edges.push({source:hubs[i-1].id,target:hubs[i].id});

  const advTopics=[{id:'FUN',label:'Functions',cat:'adv',m:0.05},{id:'TRI',label:'Trig & Angles',cat:'adv',m:0.05},{id:'CAL',label:'Differentiation',cat:'adv',m:0.05},{id:'EXP',label:'Exp & Log',cat:'adv',m:0.05},{id:'STA',label:'Probability',cat:'adv',m:0.05},{id:'FIN',label:'Seq & Series',cat:'adv',m:0.05}];
  const x1Topics=[{id:'FUN2',label:'Further Functions',cat:'x1',m:0.05,link:'FUN'},{id:'TRI2',label:'Further Trig',cat:'x1',m:0.05,link:'TRI'},{id:'CAL2',label:'Combinatorics',cat:'x1',m:0.05,link:'CAL'},{id:'COM',label:'Induction',cat:'x1',m:0.05},{id:'IND',label:'Vectors',cat:'x1',m:0.05},{id:'VEC',label:'Inverse Trig',cat:'x1',m:0.05},{id:'INT',label:'Further Calc',cat:'x1',m:0.05,link:'CAL'},{id:'BIN',label:'Binomial Dist',cat:'x1',m:0.05,link:'STA'}];
  const x2Topics=[{id:'PRF',label:'Proof',cat:'x2',m:0.05,link:'IND'},{id:'CPX',label:'Complex Nums',cat:'x2',m:0.05,link:'TRI2'},{id:'VEC2',label:'3D Vectors',cat:'x2',m:0.05,link:'VEC'},{id:'CAL3',label:'Integration',cat:'x2',m:0.05,link:'INT'},{id:'MEC',label:'Mechanics',cat:'x2',m:0.05,link:'CAL'}];

  const allTopics=[...(includes('adv')?advTopics:[]),...(includes('x1')?x1Topics:[]),...(includes('x2')?x2Topics:[])];
  const catHub:Record<string,string>={adv:'HUB_ADV',x1:'HUB_X1',x2:'HUB_X2'};

  let seed=combo.length*137;
  const rng=()=>{seed=(seed*16807+0)%2147483647;return(seed-1)/2147483646;};

  for(let i=0;i<allTopics.length;i++){
    const t=allTopics[i];
    const hub=nodes.find(n=>n.id===catHub[t.cat])!;
    const a=(i/allTopics.length)*Math.PI*2+0.5;
    const r=200+(t.cat==='x2'?90:t.cat==='x1'?55:0);
    const topicNode:N3={
      id:t.id,label:t.label,depth:1,
      x:Math.cos(a)*r,
      y:Math.sin(a)*r*1.2+(t.cat==='x2'?50:t.cat==='x1'?15:-45),
      z:hub.z+Math.sin(a*2.3)*90,
      cat:t.cat,mastered:t.m,opacity:1,
    };
    nodes.push(topicNode);
    edges.push({source:hub.id,target:t.id});
    if((t as any).link&&nodes.find(n=>n.id===(t as any).link)) edges.push({source:(t as any).link,target:t.id,shared:true});

    const numD2=8+Math.floor(rng()*4);
    for(let j=0;j<numD2;j++){
      const sphere=fibSphere(j,numD2,55+rng()*45);
      const d2id=`${t.id}_d2_${j}`;
      const d2m=Math.max(0.02,t.m*(0.25+rng()*0.55));
      const d2Node:N3={
        id:d2id,label:'',depth:2,
        x:topicNode.x+sphere.x,
        y:topicNode.y+sphere.y*1.4,
        z:topicNode.z+sphere.z,
        cat:t.cat,mastered:d2m,opacity:0.5+rng()*0.4,parentId:t.id,
      };
      nodes.push(d2Node);
      edges.push({source:t.id,target:d2id});

      const numD3=1+Math.floor(rng()*3);
      for(let k=0;k<numD3;k++){
        const leaf=fibSphere(k,Math.max(1,numD3),30+rng()*30);
        const d3id=`${d2id}_d3_${k}`;
        nodes.push({
          id:d3id,label:'',depth:3,
          x:d2Node.x+leaf.x*0.7,
          y:d2Node.y+leaf.y,
          z:d2Node.z+leaf.z*0.7,
          cat:t.cat,mastered:Math.max(0.01,rng()*d2m*0.7),
          opacity:0.18+rng()*0.35,parentId:d2id,
        });
        edges.push({source:d2id,target:d3id});
      }
    }
  }

  return {nodes,edges};
}

const CAT_COLORS:Record<string,string>={adv:'#10b981',x1:'#a78bfa',x2:'#f472b6'};
const CAT_RGB:Record<string,[number,number,number]>={adv:[16,185,129],x1:[167,139,250],x2:[244,114,182]};

function rot(p:{x:number;y:number;z:number},rx:number,ry:number,rz:number){
  let{x,y,z}=p;
  const cx=Math.cos(ry),sx=Math.sin(ry),x1=x*cx-z*sx,z1=x*sx+z*cx;
  const cy=Math.cos(rx),sy=Math.sin(rx),y1=y*cy-z1*sy,z2=y*sy+z1*cy;
  const cz=Math.cos(rz),sz=Math.sin(rz),x2=x1*cz-y1*sz,y2=x1*sz+y1*cz;
  return{x:x2,y:y2,z:z2};
}
function proj(p:{x:number;y:number;z:number},cx:number,cy:number,zm:number,d:number){
  const zz=p.z+d;const s=zm/(zz>1?zz:1);return{x:cx+p.x*s,y:cy-p.y*s,z:zz,scale:s};
}

const TOPIC_ICONS:Record<string,string>={
  HUB_ADV:'⊕',HUB_X1:'⊗',HUB_X2:'⊘',
  FUN:'𝑓',TRI:'△',CAL:'∫',EXP:'𝑒',STA:'σ',FIN:'$',
  FUN2:'𝑓⁺',TRI2:'△⁺',CAL2:'∂',COM:'∁',IND:'⊢',VEC:'𝑣⃗',INT:'∬',BIN:'β',
  PRF:'□',CPX:'𝑖',VEC2:'𝑣³',CAL3:'∭',MEC:'⚙',
};
function topicIcon(id:string):string{return TOPIC_ICONS[id]||'●';}

function rgba(rgb:[number,number,number],alpha:number):string{
  return `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${alpha.toFixed(2)})`;
}

const TopicMap:React.FC=()=>{
  const cRef=useRef<HTMLCanvasElement>(null);
  const boxRef=useRef<HTMLDivElement>(null);
  const [dim,setDim]=useState({w:1200,h:750});
  const [combo,setCombo]=useState<CourseCombo>('x1_x2');
  const [tree,setTree]=useState(()=>buildTree('x1_x2'));
  const rxRef=useRef(0.4);const ryRef=useRef(1.2);const rzRef=useRef(0.15);
  const zoomRef=useRef(600);const dragRef=useRef(false);const lastRef=useRef({x:0,y:0});
  const mouseRef=useRef({x:0,y:0});const [hovered,setHovered]=useState<string|null>(null);
  const [popup,setPopup]=useState<any>(null);
  const [popupPos,setPopupPos] = useState<{x:number;y:number}|null>(null);
  const focusRef=useRef<string|null>(null);const orbitRef=useRef(false);
  const orbitT=useRef({rx:0,ry:0,rz:0,zm:600});const userActive=useRef(false);
  const [showCombo,setShowCombo]=useState(false);

  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    (async () => {
      try {
        const data = await getCurrentUser();
        const c = courseToCombo(data.user?.course || '');
        setCombo(c);
      } catch {
        const saved = localStorage.getItem('turing_onboarding_course') || '';
        setCombo(courseToCombo(saved));
      }
    })();
  }, []);

  useEffect(()=>{setTree(buildTree(combo))},[combo]);

  const [userProgress, setUserProgress] = useState<Record<string,number>>({});
  const [trainedNodes, setTrainedNodes] = useState<Set<string>>(new Set());
  useEffect(() => {
    const token = getAuthToken();
    if (!token) return;
    (async () => {
      try {
        const resp = await fetch('/api/problems/topic-progress', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          setUserProgress(data.progress || {});
          setTrainedNodes(new Set(data.trained_nodes || []));
        }
      } catch { /* silently fail — use defaults */ }
    })();
  }, [combo]);

  useEffect(() => {
    setTree(prev => {
      const hasAnyProgress = Object.keys(userProgress).length > 0;
      const updated = {
        nodes: prev.nodes.map(n => {
          const p = userProgress[n.id];
          const hasRealData = hasAnyProgress && trainedNodes.has(n.id) && p !== undefined;
          if (hasRealData) {
            const m = Math.max(0.05, p);
            return { ...n, mastered: m, opacity: 0.35 + m * 0.65, _hasData: true };
          }
          return { ...n, mastered: n.depth > 1 ? Math.max(0.01, n.mastered * 0.3) : 0.04, opacity: n.depth > 1 ? 0.12 : 0.2, _hasData: false };
        }),
        edges: prev.edges,
      };
      return updated;
    });
  }, [userProgress, trainedNodes]);

  useEffect(()=>{
    const r=()=>{if(boxRef.current){const b=boxRef.current.getBoundingClientRect();setDim({w:b.width,h:Math.max(650,b.height)})}};
    r();window.addEventListener('resize',r);
    return()=>window.removeEventListener('resize',r);
  },[]);

  useEffect(()=>{
    const cv=cRef.current;if(!cv)return;const ctx=cv.getContext('2d');if(!ctx)return;
    const motion = {
      t: Math.random()*1000,
      velRx: 0, velRy: 0, velRz: 0,
      targetRyBase: 0.0025,
      phase: Math.random()*Math.PI*2,
    };

    const loop=()=>{
      const{w,h}=dim;cv.width=w;cv.height=h;const fw=w,fh=h;const cxW=fw/2,cyH=fh/2;

      if(!userActive.current){
        motion.t += 1;
        const t = motion.t;

        const targetRy = motion.targetRyBase*0.6 + Math.sin(t*0.0003+0.4)*0.0004 + Math.cos(t*0.00055)*0.0003;
        const targetRx = Math.sin(t*0.00035+motion.phase)*0.0004 + Math.cos(t*0.0007)*0.0002;
        const targetRz = Math.cos(t*0.0004+1.2)*0.0002 + Math.sin(t*0.0006)*0.00015;

        motion.velRx += (targetRx - motion.velRx) * 0.008;
        motion.velRy += (targetRy - motion.velRy) * 0.008;
        motion.velRz += (targetRz - motion.velRz) * 0.008;

        rxRef.current += motion.velRx;
        ryRef.current += motion.velRy;
        rzRef.current += motion.velRz;

        rxRef.current = Math.max(-0.6, Math.min(0.6, rxRef.current));
        rzRef.current = Math.max(-0.35, Math.min(0.35, rzRef.current));

        const baseZoom = 620;
        const targetZoom = baseZoom + Math.sin(t * 0.00012) * 80;
        zoomRef.current += (targetZoom - zoomRef.current) * 0.005;
      }

      if(focusRef.current&&orbitRef.current){
        rxRef.current+=(orbitT.current.rx-rxRef.current)*0.04;
        ryRef.current+=(orbitT.current.ry-ryRef.current)*0.04;
        rzRef.current+=(orbitT.current.rz-rzRef.current)*0.04;
        zoomRef.current+=(orbitT.current.zm-zoomRef.current)*0.04;
      }

      const rx=rxRef.current,ry=ryRef.current,rz=rzRef.current,zm=zoomRef.current;

      const projected=tree.nodes.map(n=>{
        const rt=rot(n,rx,ry,rz);
        const p=proj(rt,cxW,cyH,zm,450);
        return{...n,px:p.x,py:p.y,pz:p.z,scale:p.scale};
      }).sort((a,b)=>b.pz-a.pz);

      ctx.fillStyle='#07080a';ctx.fillRect(0,0,fw,fh);

      for(const e of tree.edges){
        const s=projected.find(n=>n.id===e.source),t=projected.find(n=>n.id===e.target);
        if(!s||!t)continue;
        const isFoc=!focusRef.current||e.source===focusRef.current||e.target===focusRef.current;
        const dist=Math.hypot(t.px-s.px,t.py-s.py);
        if(dist>fw*0.85)continue;
        ctx.beginPath();ctx.moveTo(s.px,s.py);ctx.lineTo(t.px,t.py);
        const edgeAlpha=isFoc?0.08:0.025;
        const catRgb=e.shared?[167,139,250]:[56,189,248];
        ctx.strokeStyle=`rgba(${catRgb[0]},${catRgb[1]},${catRgb[2]},${edgeAlpha})`;
        ctx.lineWidth=e.shared?0.5:0.3;ctx.stroke();
      }

      let hovId:string|null=null;
      for(const n of projected){
        const isHov=hovered===n.id,isSel=popup?.id===n.id;
        const baseR=n.depth===0?30:n.depth===1?20:n.depth===2?13:n.depth===3?7:5;
        const scaledR=baseR*Math.max(0.4,n.scale*0.03);
        const mastered=n.mastered||0;
        const hasData = (n as any)._hasData !== false; 
        const rgb=CAT_RGB[n.cat]||[16,185,129];
        const isGhost=mastered<0.03&&n.depth>1;
        const hb=isHov||isSel?1.4:1;
        const mFactor = hasData ? Math.max(0.15, mastered) : 0.08;

        const glowR=scaledR*hb*(n.depth===0?6:n.depth===1?5:4);
        const glowIntensity = hasData ? (n.depth===0?0.5:n.depth===1?0.35*mFactor:0.22*mFactor) : 0.04;
        const gg=ctx.createRadialGradient(n.px,n.py,scaledR*hb*0.4,n.px,n.py,glowR);
        gg.addColorStop(0,rgba(rgb,glowIntensity));
        gg.addColorStop(0.4,rgba(rgb,glowIntensity*0.35));
        gg.addColorStop(0.75,rgba(rgb,glowIntensity*0.08));
        gg.addColorStop(1,'transparent');
        ctx.fillStyle=gg;ctx.beginPath();ctx.arc(n.px,n.py,glowR,0,Math.PI*2);ctx.fill();

        const sr=scaledR*hb;
        const sg=ctx.createRadialGradient(n.px-sr*0.25,n.py-sr*0.3,sr*0.05,n.px,n.py,sr);
        if(n.depth===0){
          sg.addColorStop(0,'#ffffff');
          sg.addColorStop(0.08,`rgb(${Math.min(255,rgb[0]+80)},${Math.min(255,rgb[1]+80)},${Math.min(255,rgb[2]+80)})`);
          sg.addColorStop(0.25,rgba(rgb,0.9));
          sg.addColorStop(0.55,rgba(rgb,0.5));
          sg.addColorStop(0.8,rgba(rgb,0.12));
          sg.addColorStop(1,'rgba(0,0,0,0)');
        }else if(isGhost||!hasData){
          sg.addColorStop(0,'rgba(63,63,70,0.25)');
          sg.addColorStop(0.5,'rgba(63,63,70,0.04)');
          sg.addColorStop(1,'rgba(0,0,0,0)');
        }else if(n.depth===1){
          const bright = Math.min(1, mFactor + 0.1);
          sg.addColorStop(0,'#ffffff');
          sg.addColorStop(0.08,`rgb(${Math.min(255,rgb[0]+80)},${Math.min(255,rgb[1]+80)},${Math.min(255,rgb[2]+80)})`);
          sg.addColorStop(0.25,rgba(rgb,0.85*bright));
          sg.addColorStop(0.5,rgba(rgb,0.4*bright));
          sg.addColorStop(0.8,rgba(rgb,0.06*bright));
          sg.addColorStop(1,'rgba(0,0,0,0)');
        }else{
          const bright = Math.min(1, mFactor + 0.08);
          sg.addColorStop(0,rgba(rgb,0.65*bright));
          sg.addColorStop(0.3,rgba(rgb,0.3*bright));
          sg.addColorStop(0.65,rgba(rgb,0.05*bright));
          sg.addColorStop(1,'rgba(0,0,0,0)');
        }
        ctx.fillStyle=sg;ctx.beginPath();ctx.arc(n.px,n.py,sr,0,Math.PI*2);ctx.fill();

        if(n.depth===0){
          ctx.strokeStyle='rgba(255,255,255,0.25)';ctx.lineWidth=1.2;
          ctx.beginPath();ctx.arc(n.px,n.py,sr+3,0,Math.PI*2);ctx.stroke();
          ctx.strokeStyle='rgba(255,255,255,0.08)';ctx.lineWidth=0.5;
          ctx.beginPath();ctx.arc(n.px,n.py,sr+8,0,Math.PI*2);ctx.stroke();
        }

        if(n.depth<=1||isHov||isSel){
          ctx.fillStyle=n.depth===0?'#fff':'#c4c4cc';
          const fontSize=n.depth===0?12:isHov||isSel?10:8;
          ctx.font=`${fontSize}px Inter,sans-serif`;ctx.textAlign='center';
          ctx.fillText(n.label,n.px,n.py+scaledR*hb+(n.depth===0?16:11));
        }

        const mx=mouseRef.current.x,my=mouseRef.current.y;
        const hitR=scaledR*hb+(n.depth<=1?8:4);
        if(!hovId&&mx&&Math.abs(mx-n.px)<hitR&&Math.abs(my-n.py)<hitR)hovId=n.id;
      }
      if(hovId!==hovered)setHovered(p=>p!==hovId?hovId:p);
      requestAnimationFrame(loop);
    };
    const id=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(id);
  },[dim,tree,hovered,popup]);

  const onMove=(e:React.MouseEvent)=>{
    const r=cRef.current?.getBoundingClientRect();if(!r)return;
    mouseRef.current={x:e.clientX-r.left,y:e.clientY-r.top};
    if(dragRef.current){
      userActive.current=true;orbitRef.current=false;
      const dx=e.clientX-lastRef.current.x,dy=e.clientY-lastRef.current.y;
      ryRef.current+=dx*0.005;
      rxRef.current=Math.max(-1.5,Math.min(1.5,rxRef.current-dy*0.005));
      lastRef.current={x:e.clientX,y:e.clientY};
    }
  };
  const onDown=(e:React.MouseEvent)=>{
    dragRef.current=true;lastRef.current={x:e.clientX,y:e.clientY};
    userActive.current=true;orbitRef.current=false;
  };
  const onUp=()=>{dragRef.current=false;setTimeout(()=>{userActive.current=false},3000);};
  const onWheel=(e:React.WheelEvent)=>{
    e.preventDefault();userActive.current=true;orbitRef.current=false;
    zoomRef.current=Math.max(80,Math.min(1500,zoomRef.current+(e.deltaY>0?40:-40)));
    setTimeout(()=>{userActive.current=false},3000);
  };
  const onLeave=()=>{dragRef.current=false;setHovered(null);};

  const handleClick=(e:React.MouseEvent)=>{
    const r=cRef.current?.getBoundingClientRect();if(!r)return;
    const mx=e.clientX-r.left,my=e.clientY-r.top;
    const rx=rxRef.current,ry=ryRef.current,rz=rzRef.current,zm=zoomRef.current,cxW=dim.w/2,cyH=dim.h/2;
    let found:any=null; let foundPx=0, foundPy=0;

    for(const n of tree.nodes){
      if(n.depth>1)continue;
      const rt=rot(n,rx,ry,rz);const p=proj(rt,cxW,cyH,zm,450);
      if(Math.abs(mx-p.x)<14&&Math.abs(my-p.y)<14){
        found={id:n.id,label:n.label,mastered:n.mastered,cat:n.cat,depth:n.depth};foundPx=p.x;foundPy=p.y;break;
      }
    }
    if(found){
      const node=tree.nodes.find(n=>n.id===found.id);
      if(node){
        const dist = Math.sqrt(node.x*node.x+node.y*node.y+node.z*node.z)+1;
        orbitT.current={
          rx: -Math.atan2(node.y, Math.sqrt(node.x*node.x+node.z*node.z))*0.45,
          ry: Math.atan2(node.x, node.z)*0.5 + 1.5,
          rz: 0.05,
          zm: Math.max(200, Math.min(400, 250 + dist*0.3))  
        };
        focusRef.current=node.id;orbitRef.current=true;userActive.current=false;
      }
      setPopupPos({x:foundPx,y:foundPy});
      setPopup(found);
    }else{
      setPopup(null);setPopupPos(null);focusRef.current=null;orbitRef.current=false;
    }
  };

  const popupStyle: React.CSSProperties | undefined = popupPos ? {
    position: 'absolute',
    left: popupPos.x > dim.w / 2 ? '24px' : 'auto',
    right: popupPos.x <= dim.w / 2 ? '24px' : 'auto',
    top: Math.max(80, Math.min(dim.h - 340, popupPos.y - 160)),
  } : undefined;

  const urgency = (m:number)=>{
    if(m>=0.7)return {label:'On Track',color:'text-emerald-400',bg:'bg-emerald-400/10',icon:TrendingUp};
    if(m>=0.35)return {label:'Needs Work',color:'text-amber-400',bg:'bg-amber-400/10',icon:Clock};
    return {label:'Urgent',color:'text-rose-400',bg:'bg-rose-400/10',icon:AlertTriangle};
  };
  const estHours = (m:number)=>Math.max(1,Math.ceil((1-m)*15));
  const daysUntilExam = 90;

  return(
    <div ref={boxRef} className="w-full h-full min-h-screen relative bg-[#07080a] overflow-hidden">
      <canvas ref={cRef} width={dim.w} height={dim.h}
        onMouseMove={onMove} onMouseDown={onDown} onMouseUp={onUp}
        onMouseLeave={onLeave} onWheel={onWheel} onClick={handleClick}
        className="cursor-crosshair"
      />


      <div className="absolute top-4 right-4 z-10">
        <button onClick={()=>setShowCombo(!showCombo)} className="flex items-center gap-1.5 bg-[#0b0c10]/90 border border-white/[0.06] px-3 py-1.5 text-[10px] text-neutral-400 hover:text-white transition-colors">
          <Settings size={12}/> {{adv:'Advanced only',adv_x1:'Adv + Ext 1',x1_x2:'Ext 1 + Ext 2'}[combo]}
        </button>
        <AnimatePresence>
          {showCombo&&(
            <motion.div initial={{opacity:0,y:-5}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-5}} className="absolute top-full right-0 mt-2 bg-[#0b0c10]/95 backdrop-blur-xl border border-white/[0.08] rounded-xl p-2 shadow-2xl flex flex-col gap-1 min-w-[180px]">
              {([['adv','Advanced only'],['adv_x1','Advanced + Ext 1'],['x1_x2','Ext 1 + Ext 2']] as [CourseCombo,string][]).map(([v,label])=>(
                <button key={v} onClick={()=>{setCombo(v);setShowCombo(false)}} className={`text-left px-3 py-2 text-xs transition-colors border-0 ${combo===v?'bg-white/[0.06] text-white':'text-neutral-400 hover:text-white'}`}>{label}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>


      <div className="absolute top-4 left-4 flex flex-wrap gap-1.5 pointer-events-none">
        {[{c:'adv',l:'Advanced',col:'#10b981'},{c:'x1',l:'Ext 1',col:'#a78bfa'},{c:'x2',l:'Ext 2',col:'#f472b6'}].filter(x=>combo==='x1_x2'?x.c!=='adv':combo==='adv_x1'?x.c!=='x2':x.c==='adv').map(x=>(
          <div key={x.c} className="flex items-center gap-2 bg-[#0b0c10]/90 border border-white/[0.05] px-3 py-1.5 text-[10px]">
            <div className="w-2.5 h-2.5" style={{background:x.col}}/><span className="text-neutral-400">{x.l}</span>
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-4 text-[9px] text-neutral-700 pointer-events-none">
        {tree.nodes.length.toLocaleString()} nodes · {tree.edges.length.toLocaleString()} edges · Drag · Scroll · Click
      </div>


      <AnimatePresence>
        {popup&&popupStyle&&(
          <motion.div
            initial={{opacity:0,scale:0.85,y:12}} animate={{opacity:1,scale:1,y:0}} exit={{opacity:0,scale:0.85,y:12}}
            style={popupStyle}
            className="absolute z-20 min-w-[280px] max-w-[320px]"
          >

            <div className="absolute inset-0 rounded-sm opacity-30 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at 30% 20%, ${CAT_COLORS[popup.cat]||'#10b981'}20 0%, transparent 70%)`,
              }}
            />

            <div className="relative bg-[#0a0a0c] border border-white/[0.06] p-5"
              style={{
                boxShadow: `0 0 40px ${CAT_COLORS[popup.cat]||'#10b981'}08, 0 0 80px rgba(0,0,0,0.6)`,
              }}>

            <button onClick={()=>{setPopup(null);setPopupPos(null);focusRef.current=null;orbitRef.current=false;}}
              className="absolute top-3 right-3 text-neutral-600 hover:text-white border-0 bg-transparent p-0.5 transition-colors">
              <X size={13}/>
            </button>


            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 flex items-center justify-center text-lg font-bold"
                style={{background:`${CAT_COLORS[popup.cat]||'#10b981'}12`,color:CAT_COLORS[popup.cat]||'#10b981'}}>
                {topicIcon(popup.id)}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white leading-tight">{popup.label}</h3>
                <p className="text-[10px] text-neutral-500">{(()=>{const m:Record<string,string>={adv:'Advanced',x1:'Extension 1',x2:'Extension 2',hub:'Course Hub'};return m[popup.cat];})()}</p>
              </div>
            </div>


            {(()=>{const u=urgency(popup.mastered);const Icon=u.icon;return(
              <div className={`flex items-center gap-2 ${u.bg} px-3 py-2 mb-3`}>
                <Icon size={13} className={u.color}/>
                <span className={`text-[11px] font-semibold ${u.color}`}>{u.label}</span>
                <span className="text-[10px] text-neutral-500 ml-auto">{daysUntilExam}d until trials</span>
              </div>
            )})()}


            <div className="space-y-1.5 mb-3">
              <div className="flex justify-between text-[10px]">
                <span className="text-neutral-500">Mastery</span>
                <span className="text-white font-semibold">{(popup.mastered*100).toFixed(0)}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.05] overflow-hidden">
                <motion.div className="h-full" initial={{width:0}}
                  animate={{width:`${popup.mastered*100}%`}}
                  style={{background:`linear-gradient(90deg, ${CAT_COLORS[popup.cat]||'#10b981'}80, ${CAT_COLORS[popup.cat]||'#10b981'})`}}/>
              </div>
            </div>


            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="bg-white/[0.02] border border-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Clock size={11} className="text-neutral-500" />
                  <p className="text-[9px] text-neutral-500">Est. Study</p>
                </div>
                <p className="text-xs font-semibold text-white">{estHours(popup.mastered)} hrs needed</p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Award size={11} className="text-neutral-500" />
                  <p className="text-[9px] text-neutral-500">Band Target</p>
                </div>
                <p className="text-xs font-semibold text-white">{popup.mastered>0.7?'E4':popup.mastered>0.35?'E3':'E2'}</p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Hash size={11} className="text-neutral-500" />
                  <p className="text-[9px] text-neutral-500">Questions</p>
                </div>
                <p className="text-xs font-semibold text-white">{Math.floor(popup.mastered*40)} / 40 done</p>
              </div>
              <div className="bg-white/[0.02] border border-white/[0.03] px-3 py-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <BarChart3 size={11} className="text-neutral-500" />
                  <p className="text-[9px] text-neutral-500">HSC Weight</p>
                </div>
                <p className="text-xs font-semibold text-white">{popup.cat==='adv'?'~12%':popup.cat==='x1'?'~8%':'~6%'}</p>
              </div>
            </div>


            <button onClick={()=>{
              const b=document.querySelector('[data-nav="marking"]') as HTMLElement;if(b)b.click();
            }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-white hover:bg-neutral-200 text-black text-xs font-semibold transition-all border-0">
              Practice Now <ArrowRight size={13}/>
            </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TopicMap;
