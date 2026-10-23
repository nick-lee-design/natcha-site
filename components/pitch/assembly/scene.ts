// @ts-nocheck -- a straight port of a standalone prototype; its untyped internals stay as written
// Living assembly: an MEP structure (steel frame, trays, pipes, ducts, sprinklers) that builds
// itself once, then explodes and contracts on a loop. Ported from the standalone prototype
// (Three.js r149 + GSAP) with the same geometry, shaders and timing. Differences:
// - three r186: linear output, physical light intensities, opaque_fragment
// - a small tween on the scene clock in place of GSAP, so nothing touches GSAP's global ticker
// - no click, keyboard, sound or custom cursor: a click on the slide moves the deck on.
//   Hover still tilts the rig, lights and opens the part under the pointer
// - the hold between moves is a loop (assembled, explode, exploded, contract) instead of idle triggers
// - a framing offset so the structure sits to the right of the cover text
// - a still mode that renders the assembled state once, for print and thumbnails
import * as THREE from 'three';

export type AssemblyOptions = {
  // Render the assembled state once instead of animating (the print image)
  still?: boolean;
  // Still only: the drawing buffer size in pixels
  size?: { width: number; height: number };
  // shift: fraction of the width the structure moves right. zoom: below 1 pulls back
  frame?: { shift: number; zoom: number };
  // Seconds assembled, or exploded, before the next move
  hold?: number;
  // Follows the hovered part (gets data-k="mid" | "cen" | "end" and the class "on")
  marker?: HTMLElement | null;
};

export type Assembly = { dispose(): void };

export function createAssembly(canvas: HTMLCanvasElement, opts: AssemblyOptions = {}): Assembly | null {
const STILL = !!opts.still;
const REDUCED = !STILL && matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = matchMedia('(pointer: fine)').matches;
const HOLD = opts.hold ?? 5;
const FRAME = opts.frame ?? { shift: 0, zoom: 1 };
const marker = opts.marker ?? null;

/* ---------------------------------------------------------------- utils */
let seed = 20261021;
function rnd(){ seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }
const clamp=(x,a,b)=>x<a?a:x>b?b:x;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const damp=(a,b,l,dt)=>a+(b-a)*(1-Math.exp(-l*dt));
const V3=THREE.Vector3, Q4=THREE.Quaternion;
const v=(x,y,z)=>new V3(x,y,z);
const X=v(1,0,0), Y=v(0,1,0), Z=v(0,0,1), Z0=v(0,0,0), ONE=v(1,1,1);

/* ---------------------------------------------------------------- renderer */
let renderer;
try{
  renderer = new THREE.WebGLRenderer({canvas, antialias:false, alpha:false, depth:true, stencil:false, powerPreference:'high-performance', preserveDrawingBuffer:STILL});
}catch(e){ return null; }
renderer.setClearColor(0x000000, 1);
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(30, 16/9, 0.1, 220);
const rig = new THREE.Group();
scene.add(rig);

/* ---------------------------------------------------------------- environment (procedural plant-room lighting) */
const envRT=(function makeEnv(){
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(26,13,26), new THREE.MeshBasicMaterial({color:0x000000, side:THREE.BackSide})));
  const panel=(w,h,pos,rot,i,tint)=>{
    const m = new THREE.MeshBasicMaterial({color:new THREE.Color().setHex(tint||0xffffff,THREE.LinearSRGBColorSpace).multiplyScalar(i), side:THREE.DoubleSide});
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w,h), m); p.position.copy(pos); p.rotation.set(rot[0],rot[1],rot[2]); s.add(p);
  };
  for (let i=-2;i<=2;i++) panel(0.5, 19, v(i*3.1, 6.2, 0), [Math.PI/2,0,0], 1.75);
  panel(24, 24, v(0, 6.4, 0), [Math.PI/2,0,0], 0.14);
  panel(7, 4.5, v(-12.8, 1.6, 6), [0,Math.PI/2,0], 1.2);
  panel(3.2, 8, v(12.8, 2.2, -5), [0,-Math.PI/2,0], 1.6, 0xd8e6ff);
  panel(24, 24, v(0, -6.4, 0), [-Math.PI/2,0,0], 0.1);
  panel(14, 1.1, v(0, -6.3, -7), [-Math.PI/2,0,0], 0.9, 0x2f7dff);
  panel(22, 5, v(0, 0.5, -12.8), [0,0,0], 0.14);
  panel(22, 7, v(0, 1.5, 12.8), [0,Math.PI,0], 0.3);
  panel(1.2, 9, v(6, 0.5, 12.7), [0,Math.PI,0], 1.4);
  panel(1.2, 9, v(-5, 0.5, 12.7), [0,Math.PI,0], 1.0);
  const pm = new THREE.PMREMGenerator(renderer);
  const rt = pm.fromScene(s, 0.035); scene.environment = rt.texture;
  pm.dispose();
  s.traverse(o=>{ if(o.isMesh){ o.geometry.dispose(); o.material.dispose(); } });
  return rt;
})();

const keyLight = new THREE.DirectionalLight(0xffffff, 0.75*Math.PI); keyLight.position.set(-6,10,8); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight(0xffffff, 0.32*Math.PI); fillLight.color.setHex(0x8fb8ff,THREE.LinearSRGBColorSpace); fillLight.position.set(5,-6,-4); scene.add(fillLight);
const cursorLight = new THREE.PointLight(0xffffff, 0, 7, 2); cursorLight.color.setHex(0x7fb6ff,THREE.LinearSRGBColorSpace); scene.add(cursorLight);

/* ---------------------------------------------------------------- materials palette (linear) */
const M = {
  steel:{c:[0.42,0.44,0.475], r:0.34},
  chrome:{c:[0.86,0.875,0.895], r:0.15},
  bright:{c:[0.93,0.94,0.95], r:0.11},
  galv:{c:[0.66,0.685,0.715], r:0.38},
  alu:{c:[0.58,0.60,0.635], r:0.44},
  dark:{c:[0.20,0.215,0.235], r:0.46},
  tank:{c:[0.40,0.415,0.44], r:0.48}
};

/* ---------------------------------------------------------------- geometry helpers (world space) */
const _m=new THREE.Matrix4(), _q=new Q4();
function gBox(cx,cy,cz,sx,sy,sz){ const g=new THREE.BoxGeometry(sx,sy,sz); g.translate(cx,cy,cz); return g; }
function gCyl(a,b,r,seg){ const d=new V3().subVectors(b,a); const L=d.length(); const g=new THREE.CylinderGeometry(r,r,L,seg||22,1,false); _q.setFromUnitVectors(Y,d.normalize()); _m.compose(new V3().addVectors(a,b).multiplyScalar(0.5),_q,ONE); g.applyMatrix4(_m); return g; }
function gTorus(c,u,w,R,r,start,arc,rs,ts){ const g=new THREE.TorusGeometry(R,r,rs||12,ts||18,arc); g.rotateZ(start); const n=new V3().crossVectors(u,w); _m.makeBasis(u,w,n); _m.setPosition(c); g.applyMatrix4(_m); return g; }
function gSphere(c,r,sx){ const g=new THREE.SphereGeometry(r,20,14); if(sx) g.scale(sx,1,1); g.translate(c.x,c.y,c.z); return g; }
function gCone(c,r,h){ const g=new THREE.ConeGeometry(r,h,14); g.rotateX(Math.PI); g.translate(c.x,c.y,c.z); return g; }
function circlePts(c,n,r,seg){ seg=seg||32; const a=Math.abs(n.y)<0.9?Y:X; const u=new V3().crossVectors(n,a).normalize(); const w=new V3().crossVectors(n,u); const out=[]; for(let i=0;i<=seg;i++){ const t=i/seg*Math.PI*2; out.push(c.clone().addScaledVector(u,Math.cos(t)*r).addScaledVector(w,Math.sin(t)*r)); } return out; }
function arcPts(c,u,w,R,start,arc,seg){ seg=seg||16; const out=[]; for(let i=0;i<=seg;i++){ const t=start+arc*i/seg; out.push(c.clone().addScaledVector(u,Math.cos(t)*R).addScaledVector(w,Math.sin(t)*R)); } return out; }
function squarePts(c,s,y){ return [v(c.x-s,y,c.z-s),v(c.x+s,y,c.z-s),v(c.x+s,y,c.z+s),v(c.x-s,y,c.z+s),v(c.x-s,y,c.z-s)]; }

/* ---------------------------------------------------------------- part registry */
const F={COL:0,BEAM:1,BRACE:2,TRAY:3,CABLE:4,PTRAP:5,PIPE:6,ELBOW:7,RISER:8,VALVE:9,PUMP:10,DUCT:11,DTRAP:12,UDUCT:13,DCAP:14,BRANCH:15,EQUIP:16,SPR:17,HEAD:18,JBOX:19,COND:20};
const parts=[]; let C=null;
function part(fam,o){ C=Object.assign({fam,solids:[],lines:[],axis:Y.clone(),dist:2,rAxis:Y.clone(),rAng:0,tA:5,layer:1,run:null,hx:1},o); C.i=parts.length; parts.push(C); return C; }
function S(g,m,sub,o){ C.solids.push({g,m,sub:sub||Z0,edges:!(o&&o.edges===false),eth:(o&&o.eth)||28,emis:(o&&o.emis)||0}); }
function L(pts,kind,sub){ C.lines.push({pts,kind:kind||0,sub:sub||Z0}); }

const COLX=[-7.5,-4.5,-1.5,1.5,4.5,7.5], COLZ=[-3,0,3], LEV=[-1.3,0.55,2.4], FLOOR=-2.92, TOP=2.62;
const sweep=x=>clamp((x+9)/18,0,1);
const outw=x=>Math.abs(x)/7.9;

/* ---------------------------------------------------------------- build the structure */
// columns, split at a splice so lower and upper sections meet in the middle
COLZ.forEach((z,zi)=>COLX.forEach((x,xi)=>{
  const sw=sweep(x), zo=zi/2, run='c'+xi+'_'+zi;
  part(F.COL,{axis:v(0,-1,0),dist:4.2,rAxis:Y,rAng:Math.PI/2,tA:1.6+sw*1.3+zo*0.22,layer:0,run,hx:0,upper:false});
  S(gCyl(v(x,FLOOR+0.04,z),v(x,0,z),0.085,22),M.steel);
  S(gBox(x,FLOOR+0.02,z,0.44,0.04,0.44),M.steel,v(0,-0.2,0));
  for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]) S(gCyl(v(x+dx*0.16,FLOOR+0.03,z+dz*0.16),v(x+dx*0.16,FLOOR+0.11,z+dz*0.16),0.014,8),M.bright,v(0,0.1,0),{edges:false});
  S(gCyl(v(x,-0.03,z),v(x,0,z),0.135,24),M.chrome,v(0,0.12,0));
  S(gCyl(v(x,LEV[0]-0.07,z),v(x,LEV[0]+0.07,z),0.108,22),M.steel,v(0,0.07,0));
  L([v(x,FLOOR-0.22,z),v(x,0.1,z)],1);
  part(F.COL,{axis:v(0,1,0),dist:3.3,rAxis:Y,rAng:-Math.PI/2,tA:1.95+sw*1.3+zo*0.22,layer:0,run,hx:0,upper:true});
  S(gCyl(v(x,0,z),v(x,TOP-0.03,z),0.085,22),M.steel);
  S(gCyl(v(x,0,z),v(x,0.03,z),0.135,24),M.chrome,v(0,-0.12,0));
  S(gBox(x,TOP-0.015,z,0.32,0.03,0.32),M.steel,v(0,0.2,0));
  for(const ly of [LEV[1],LEV[2]]) S(gCyl(v(x,ly-0.07,z),v(x,ly+0.07,z),0.108,22),M.steel,v(0,0.07,0));
  L([v(x,-0.1,z),v(x,TOP+0.28,z)],1);
}));

// I-beams: flanges, web and end plates are separate pieces so hover can open them up
function beam(a,b,y,c,dir,lev,zo){
  const s=a+0.105, e=b-0.105, len=e-s, m=(s+e)/2;
  const map=(al,yy,ac)=>dir==='x'?[al,yy,ac]:[ac,yy,al];
  const box=(al,yy,ac,ll,ly,lc)=>{ const p=map(al,yy,ac), q=map(ll,ly,lc); return gBox(p[0],p[1],p[2],q[0],q[1],q[2]); };
  const along=dir==='x'?X:Z;
  part(F.BEAM,{axis:dir==='x'?v(0,1,0):v(0,0,1),dist:dir==='x'?2.4:2.9,rAxis:dir==='x'?Z:X,rAng:dir==='x'?0.16:-0.12,
    tA:2.8+lev*0.85+sweep(dir==='x'?m:c)*1.2+(dir==='x'?0:0.3)+zo*0.08,layer:0,lev,run:'b'+dir+lev+'_'+c,dirX:dir==='x'});
  S(box(m,y+0.12,c,len,0.02,0.15),M.steel,v(0,0.085,0));
  S(box(m,y-0.12,c,len,0.02,0.15),M.steel,v(0,-0.085,0));
  S(box(m,y,c,len,0.22,0.012),M.steel);
  S(box(s+0.008,y,c,0.016,0.26,0.17),M.steel,along.clone().multiplyScalar(-0.13));
  S(box(e-0.008,y,c,0.016,0.26,0.17),M.steel,along.clone().multiplyScalar(0.13));
}
LEV.forEach((y,li)=>{
  COLZ.forEach((z,zi)=>{ for(let i=0;i<5;i++) beam(COLX[i],COLX[i+1],y,z,'x',li,zi/2); });
  COLX.forEach((x)=>{ for(let j=0;j<2;j++) beam(COLZ[j],COLZ[j+1],y,x,'z',li,j); });
});

// cross bracing rods with turnbuckles and gusset plates
function brace(p0,p1,plane,out,lev,tb){
  const d=new V3().subVectors(p1,p0).normalize();
  part(F.BRACE,{axis:out,dist:1.7,rAxis:out,rAng:0,tA:3.3+lev*0.85+sweep(p0.x)*0.6+0.5,layer:0,lev});
  S(gCyl(p0,p1,0.016,8),M.steel,Z0,{edges:false});
  const tp=p0.clone().lerp(p1,tb);
  S(gCyl(tp.clone().addScaledVector(d,-0.12),tp.clone().addScaledVector(d,0.12),0.034,12),M.chrome,Z0,{eth:40});
  const gs=plane==='z'?[0.15,0.15,0.012]:[0.012,0.15,0.15];
  S(gBox(p0.x,p0.y,p0.z,gs[0],gs[1],gs[2]),M.steel,d.clone().multiplyScalar(-0.09));
  S(gBox(p1.x,p1.y,p1.z,gs[0],gs[1],gs[2]),M.steel,d.clone().multiplyScalar(0.09));
  L([p0.clone().addScaledVector(d,-0.12),p1.clone().addScaledVector(d,0.12)],1);
}
[[0,0,0.3],[4,1,0.7]].forEach(([bx,lv,tb])=>{ const x0=COLX[bx]+0.15,x1=COLX[bx+1]-0.15,y0=LEV[lv]+0.16,y1=LEV[lv+1]-0.16;
  brace(v(x0,y0,-3),v(x1,y1,-3),'z',v(0,0,-1),lv,tb); brace(v(x0,y1,-3),v(x1,y0,-3),'z',v(0,0,-1),lv,1-tb); });
[[-7.5,-3,0,0],[7.5,0,3,1]].forEach(([x,z0,z1,lv])=>{ const a=z0+0.15,b=z1-0.15,y0=LEV[lv]+0.16,y1=LEV[lv+1]-0.16, o=v(Math.sign(x),0,0);
  brace(v(x,y0,a),v(x,y1,b),'x',o,lv,0.3); brace(v(x,y1,a),v(x,y0,b),'x',o,lv,0.7); });

// cable trays (level 0) and their cables drawn single-line
const TRZ=[-1.55,1.35], TY=LEV[0]+0.14, TW=0.5, TX0=-7.6, TX1=7.6, TN=10, TL=(TX1-TX0)/TN;
TRZ.forEach((z,ti)=>{ for(let s=0;s<TN;s++){ const a=TX0+s*TL+0.008, b=a+TL-0.016, m=(a+b)/2, len=b-a;
  part(F.TRAY,{axis:v(m<0?-1:1,0,0),dist:2.3,rAxis:X,rAng:Math.PI/2,tA:4.4+outw(m)*1.3+ti*0.15,run:'t'+ti,lev:0});
  S(gBox(m,TY+0.045,z-TW/2,len,0.09,0.014),M.alu,v(0,0,-0.1));
  S(gBox(m,TY+0.045,z+TW/2,len,0.09,0.014),M.alu,v(0,0,0.1));
  for(let k=0;k<6;k++){ const x=a+0.13+k*(len-0.26)/5; S(gBox(x,TY+0.01,z,0.035,0.02,TW-0.02),M.alu,v(0,-0.07,0)); }
}});
TRZ.forEach((z,ti)=>{ for(let i=0;i<5;i++){ const a=i===0?TX0+0.05:COLX[i], b=i===4?TX1-0.05:COLX[i+1], m=(a+b)/2;
  part(F.CABLE,{axis:v(m<0?-1:1,0,0),dist:2.1,rAxis:X,rAng:0,tA:5.3+outw(m)*1.0+ti*0.1,run:'k'+ti,lev:0});
  for(const dz of [-0.13,0,0.13]) L([v(a,TY+0.05,z+dz),v(b,TY+0.05,z+dz)],2);
}});

// pipe bundles (level 1): A turns up to the roof at the right, B turns down to the pumps at the left
const PIPES=[{z:-1.75,r:0.075,ys:-0.02,b:0},{z:-1.4,r:0.06,ys:-0.02,b:0},{z:-1.05,r:0.06,ys:-0.02,b:0},{z:-0.7,r:0.045,ys:-0.02,b:0},
             {z:1.0,r:0.1,ys:0.0,b:1},{z:1.4,r:0.075,ys:0.0,b:1},{z:1.8,r:0.055,ys:0.0,b:1}];
const PX0=-7.9, PX1=7.9, PN=10, PL=(PX1-PX0)/PN;
PIPES.forEach((pp,j)=>{ const yc=pp.ys+pp.r, z=pp.z, r=pp.r;
  for(let s=0;s<PN;s++){ const a=PX0+s*PL, b=a+PL, m=(a+b)/2;
    part(F.PIPE,{axis:v(m<0?-1:1,0,0),dist:1.7,rAxis:X,rAng:Math.PI/2,tA:5.0+outw(m)*1.5+j*0.06,run:'p'+j,lev:1,pipe:j});
    S(gCyl(v(a,yc,z),v(b-0.045,yc,z),r,22),M.chrome);
    S(gCyl(v(b-0.045,yc,z),v(b+0.045,yc,z),r*1.3,22),M.bright,v(0.1,0,0));
    if(s===0) S(gCyl(v(a-0.02,yc,z),v(a+0.025,yc,z),r*1.9,22),M.bright,v(-0.1,0,0));
    L([v(a-0.06,yc,z),v(b+0.06,yc,z)],1);
  }
});
// valves on bundle B
[[4,2],[5,3],[6,2],[4,7],[5,6],[6,7]].forEach(([j,s],k)=>{ const pp=PIPES[j], x=PX0+(s+0.5)*PL, y=pp.ys+pp.r, z=pp.z, r=pp.r, br=r*1.75;
  part(F.VALVE,{axis:v(0,1,0),dist:1.3,rAxis:Y,rAng:Math.PI,tA:6.9+sweep(x)*0.8+k*0.03,lev:1});
  S(gSphere(v(x,y,z),br),M.chrome,Z0,{edges:false});
  L(circlePts(v(x,y,z),X,br,36),0);
  S(gCyl(v(x-br-0.035,y,z),v(x-br+0.012,y,z),r*2.05,24),M.bright,v(-0.09,0,0));
  S(gCyl(v(x+br-0.012,y,z),v(x+br+0.035,y,z),r*2.05,24),M.bright,v(0.09,0,0));
  S(gCyl(v(x,y+br*0.8,z),v(x,y+br+0.16,z),r*0.42,14),M.steel,v(0,0.1,0),{eth:40});
  const wy=y+br+0.17;
  S(gTorus(v(x,wy,z),X,Z,0.1,0.011,0,Math.PI*2,8,32),M.bright,v(0,0.17,0));
  L([v(x-0.1,wy,z),v(x+0.1,wy,z)],0,v(0,0.17,0)); L([v(x,wy,z-0.1),v(x,wy,z+0.1)],0,v(0,0.17,0));
});
// elbows and risers
PIPES.forEach((pp,j)=>{ const yc=pp.ys+pp.r, z=pp.z, r=pp.r, R=0.32;
  if(pp.b===1){
    const c=v(PX0,yc-R,z);
    part(F.ELBOW,{axis:v(-1,0,0),dist:1.3,rAxis:Z,rAng:Math.PI/2,tA:6.5+(j-4)*0.08,run:'p'+j,lev:1});
    S(gTorus(c,X,Y,R,r,Math.PI/2,Math.PI/2,12,16),M.chrome);
    L(arcPts(c,X,Y,R,Math.PI/2,Math.PI/2,16),1);
    const top=v(PX0-R,yc-R,z), bot=v(PX0-R,FLOOR+0.52,z), mid=top.clone().lerp(bot,0.5);
    part(F.RISER,{axis:v(0,-1,0),dist:2.2,rAxis:Y,rAng:0,tA:6.75+(j-4)*0.08,lev:0});
    S(gCyl(top,bot,r,22),M.chrome);
    S(gCyl(mid.clone().add(v(0,-0.045,0)),mid.clone().add(v(0,0.045,0)),r*1.3,22),M.bright,v(0,0.1,0));
    S(gCyl(bot.clone().add(v(0,-0.02,0)),bot.clone().add(v(0,0.025,0)),r*1.9,22),M.bright,v(0,-0.1,0));
    L([top.clone().add(v(0,0.06,0)),bot.clone().add(v(0,-0.06,0))],1);
  } else {
    const c=v(PX1,yc+R,z);
    part(F.ELBOW,{axis:v(1,0,0),dist:1.3,rAxis:Z,rAng:-Math.PI/2,tA:6.5+j*0.08,run:'p'+j,lev:1});
    S(gTorus(c,X,Y,R,r,-Math.PI/2,Math.PI/2,12,16),M.chrome);
    L(arcPts(c,X,Y,R,-Math.PI/2,Math.PI/2,16),1);
    const bot=v(PX1+R,yc+R,z), top=v(PX1+R,TOP+0.75,z), mid=bot.clone().lerp(top,0.5);
    part(F.RISER,{axis:v(0,1,0),dist:2.2,rAxis:Y,rAng:0,tA:6.75+j*0.08,lev:2});
    S(gCyl(bot,top,r,22),M.chrome);
    S(gCyl(mid.clone().add(v(0,-0.045,0)),mid.clone().add(v(0,0.045,0)),r*1.3,22),M.bright,v(0,0.1,0));
    S(gCyl(top.clone().add(v(0,-0.025,0)),top.clone().add(v(0,0.02,0)),r*1.9,22),M.bright,v(0,0.1,0));
    L([bot.clone().add(v(0,-0.06,0)),top.clone().add(v(0,0.06,0))],1);
  }
});
// pump skid under bundle B risers
part(F.PUMP,{axis:v(-1,0,0),dist:2.0,rAxis:Y,rAng:Math.PI/2,tA:6.3,lev:0,layer:1});
S(gBox(-8.4,FLOOR+0.07,1.4,1.0,0.14,1.4),M.dark,v(0,-0.1,0));
PIPES.filter(p=>p.b===1).forEach(pp=>{ const x=PX0-0.32, z=pp.z;
  S(gCyl(v(x,FLOOR+0.14,z),v(x,FLOOR+0.5,z),0.13,22),M.galv);
  S(gCyl(v(x-0.14,FLOOR+0.3,z),v(x-0.56,FLOOR+0.3,z),0.095,18),M.steel,v(-0.14,0,0));
});
S(gBox(-8.86,FLOOR+0.17,0.82,0.04,0.04,0.006),M.dark,v(0,0,-0.05),{emis:1});
// pipe trapezes
COLX.forEach(x=>[0,1].forEach(bn=>{ const ps=PIPES.filter(p=>p.b===bn), ys=ps[0].ys;
  const z0=Math.min(...ps.map(p=>p.z-p.r))-0.16, z1=Math.max(...ps.map(p=>p.z+p.r))+0.16, zc=(z0+z1)/2;
  part(F.PTRAP,{axis:v(0,1,0),dist:0.9,rAxis:Y,rAng:0,tA:4.6+sweep(x)*1.0+bn*0.2,lev:1});
  S(gBox(x,ys-0.0225,zc,0.045,0.045,z1-z0),M.steel);
  for(const zz of [z0+0.03,z1-0.03]){
    S(gCyl(v(x,ys-0.045,zz),v(x,LEV[1]-0.13,zz),0.011,8),M.bright,v(0,0.06,0),{edges:false});
    S(gBox(x,ys-0.058,zz,0.034,0.022,0.034),M.bright,v(0,-0.05,0));
  }
}));

// ductwork (level 2): four walls plus flange frames, with cross-break lines on the faces
const DUCTS=[{z:-1.25,w:0.95,h:0.5,top:2.0},{z:1.3,w:0.75,h:0.42,top:2.0}];
const DX0=-7.6, DX1=7.6, DN=10, DLEN=(DX1-DX0)/DN, DT=0.016;
DUCTS.forEach((d,di)=>{ const cy=d.top-d.h/2;
  for(let s=0;s<DN;s++){ const a=DX0+s*DLEN, b=a+DLEN, m=(a+b)/2, len=DLEN-0.004;
    part(F.DUCT,{axis:v(m<0?-1:1,0,0),dist:2.1,rAxis:X,rAng:Math.PI/2,tA:6.25+outw(m)*1.6+di*0.2,run:'d'+di,lev:2});
    S(gBox(m,cy+d.h/2-DT/2,d.z,len,DT,d.w),M.galv,v(0,0.11,0));
    S(gBox(m,cy-d.h/2+DT/2,d.z,len,DT,d.w),M.galv,v(0,-0.11,0));
    S(gBox(m,cy,d.z-d.w/2+DT/2,len,d.h-2*DT,DT),M.galv,v(0,0,-0.11));
    S(gBox(m,cy,d.z+d.w/2-DT/2,len,d.h-2*DT,DT),M.galv,v(0,0,0.11));
    const yt=cy+d.h/2+0.002, yb=cy-d.h/2-0.002, za=d.z-d.w/2+0.03, zb=d.z+d.w/2-0.03, xa=a+0.05, xb=b-0.05;
    L([v(xa,yt,za),v(xb,yt,zb)],0,v(0,0.11,0)); L([v(xa,yt,zb),v(xb,yt,za)],0,v(0,0.11,0));
    L([v(xa,yb,za),v(xb,yb,zb)],0,v(0,-0.11,0)); L([v(xa,yb,zb),v(xb,yb,za)],0,v(0,-0.11,0));
    const frame=(xe,sx)=>{ const fw=0.035, ft=0.05, sv=v(sx,0,0);
      S(gBox(xe,cy+d.h/2+ft/2-0.012,d.z,fw,ft,d.w+0.09),M.steel,sv);
      S(gBox(xe,cy-d.h/2-ft/2+0.012,d.z,fw,ft,d.w+0.09),M.steel,sv);
      S(gBox(xe,cy,d.z-d.w/2-ft/2+0.012,fw,d.h,ft),M.steel,sv);
      S(gBox(xe,cy,d.z+d.w/2+ft/2-0.012,fw,d.h,ft),M.steel,sv); };
    frame(b-0.018,0.09); if(s===0) frame(a+0.018,-0.09);
  }
});
COLX.forEach(x=>DUCTS.forEach((d,di)=>{ const yb=d.top-d.h, z0=d.z-d.w/2-0.13, z1=d.z+d.w/2+0.13;
  part(F.DTRAP,{axis:v(0,1,0),dist:0.9,rAxis:Y,rAng:0,tA:5.7+sweep(x)*1.0+di*0.1,lev:2});
  S(gBox(x,yb-0.024,d.z,0.045,0.045,z1-z0),M.steel);
  for(const zz of [z0+0.03,z1-0.03]){
    S(gCyl(v(x,yb-0.05,zz),v(x,LEV[2]-0.13,zz),0.011,8),M.bright,v(0,0.06,0),{edges:false});
    S(gBox(x,yb-0.06,zz,0.034,0.022,0.034),M.bright,v(0,-0.05,0));
  }
}));
// end caps and the curved U return at the left end
DUCTS.forEach((d,di)=>{ const cy=d.top-d.h/2;
  part(F.DCAP,{axis:v(-1,0,0),dist:1.6,rAxis:X,rAng:Math.PI/2,tA:7.6+di*0.1,lev:2});
  S(gBox(DX0-0.015,cy,d.z,0.03,d.h+0.07,d.w+0.07),M.steel);
  S(gCyl(v(DX0-0.03,cy,d.z),v(DX0-0.14,cy,d.z),0.225,28),M.galv,v(-0.08,0,0));
});
{ const c=v(DX0,1.77,0.025), R=1.275;
  for(let k=0;k<3;k++){
    part(F.UDUCT,{axis:v(-1,0,0),dist:1.9,rAxis:Y,rAng:Math.PI/2*(k-1),tA:7.8+k*0.14,run:'u',lev:2});
    S(gTorus(c,v(-1,0,0),Z,R,0.2,-Math.PI/2+k*Math.PI/3,Math.PI/3,16,20),M.galv);
    L(arcPts(c,v(-1,0,0),Z,R,-Math.PI/2+k*Math.PI/3,Math.PI/3,14),1);
  }
}
// branch drops to square diffusers (drawn with the diffuser symbol)
[-6,-3,3,6].forEach(x=>{ const z=-1.25, yt=1.5, yb=1.02;
  part(F.BRANCH,{axis:v(0,-1,0),dist:0.9,rAxis:Y,rAng:Math.PI/2,tA:7.35+sweep(x)*0.8,lev:1});
  S(gCyl(v(x,yb+0.03,z),v(x,yt-0.05,z),0.13,24),M.galv);
  S(gCyl(v(x,yt-0.065,z),v(x,yt,z),0.15,24),M.steel,v(0,0.07,0));
  S(gBox(x,yb,z,0.56,0.05,0.56),M.galv,v(0,-0.14,0));
  const yy=yb-0.026, c=v(x,0,z), sub=v(0,-0.14,0);
  L(squarePts(c,0.2,yy),0,sub); L(squarePts(c,0.12,yy),0,sub);
  L([v(x-0.2,yy,z-0.2),v(x+0.2,yy,z+0.2)],0,sub); L([v(x-0.2,yy,z+0.2),v(x+0.2,yy,z-0.2)],0,sub);
});
// roof plant: AHU connection, AHU and a horizontal tank
part(F.BRANCH,{axis:v(0,1,0),dist:1.6,rAxis:Y,rAng:Math.PI/2,tA:8.0,lev:2,layer:2,conn:true});
S(gCyl(v(-3,2.03,-1.2),v(-3,2.58,-1.2),0.2,28),M.galv);
S(gCyl(v(-3,2.0,-1.2),v(-3,2.06,-1.2),0.225,28),M.steel,v(0,-0.06,0));
S(gCyl(v(-3,2.55,-1.2),v(-3,2.61,-1.2),0.225,28),M.steel,v(0,0.06,0));
{ const ax=-3.0, az=-1.2, ab=LEV[2]+0.13;
  part(F.EQUIP,{axis:v(0,1,0),dist:3.0,rAxis:Y,rAng:Math.PI/2,tA:8.35,layer:2,lev:2});
  S(gBox(ax,ab+0.04,az-0.6,3.4,0.08,0.12),M.steel,v(0,-0.12,0));
  S(gBox(ax,ab+0.04,az+0.6,3.4,0.08,0.12),M.steel,v(0,-0.12,0));
  S(gBox(ax,ab+0.58,az,3.4,1.0,1.5),M.dark);
  const fz=az+0.752;
  for(const xs of [-0.85,0,0.85]) L([v(ax+xs,ab+0.1,fz),v(ax+xs,ab+1.06,fz)],0);
  for(const xs of [-1.3,-0.45,0.4]) S(gBox(ax+xs,ab+0.6,fz+0.012,0.035,0.18,0.024),M.bright,v(0,0,0.06));
  for(const fx of [-0.8,0.8]){ const fc=v(ax+fx,ab+1.24,az), sub=v(0,0.22,0);
    S(gCyl(v(ax+fx,ab+1.08,az),fc,0.36,36),M.steel,sub);
    L(circlePts(fc.clone().add(v(0,0.003,0)),Y,0.26,32),0,sub); L(circlePts(fc.clone().add(v(0,0.003,0)),Y,0.14,24),0,sub);
    L([v(fc.x-0.33,fc.y+0.003,fc.z),v(fc.x+0.33,fc.y+0.003,fc.z)],0,sub); L([v(fc.x,fc.y+0.003,fc.z-0.33),v(fc.x,fc.y+0.003,fc.z+0.33)],0,sub);
  }
  S(gBox(ax+1.45,ab+0.92,fz+0.003,0.05,0.05,0.008),M.dark,v(0,0,0.04),{emis:1});
}
{ const tx=3.0, tz=1.3, tr=0.42, sb=LEV[2]+0.13, ty=sb+0.3+tr-0.1;
  part(F.EQUIP,{axis:v(0,1,0),dist:3.0,rAxis:Y,rAng:-Math.PI/2,tA:8.6,layer:2,lev:2});
  S(gCyl(v(tx-1.6,ty,tz),v(tx+1.6,ty,tz),tr,40),M.tank);
  S(gSphere(v(tx-1.6,ty,tz),tr,0.38),M.tank,v(-0.14,0,0),{edges:false});
  S(gSphere(v(tx+1.6,ty,tz),tr,0.38),M.tank,v(0.14,0,0),{edges:false});
  for(const sx of [1.5,4.5]) S(gBox(sx,sb+0.15,tz,0.14,0.3,0.72),M.steel,v(0,-0.12,0));
  for(const bx of [tx-0.8,tx+0.8]) S(gTorus(v(bx,ty,tz),Y,Z,tr+0.01,0.012,0,Math.PI*2,8,40),M.bright,Z0,{edges:false});
  S(gCyl(v(tx+0.4,ty+tr-0.05,tz),v(tx+0.4,ty+tr+0.17,tz),0.06,16),M.chrome,v(0,0.1,0));
  S(gCyl(v(tx+0.4,ty+tr+0.15,tz),v(tx+0.4,ty+tr+0.19,tz),0.1,20),M.bright,v(0,0.13,0));
  L([v(tx-2.0,ty,tz),v(tx+2.0,ty,tz)],1);
}
// sprinkler branches drawn as single lines, heads as small solids
const SPRX=[-6,-3,0,3,6], SPRZ=[-2.55,0.05,2.55], SPY=2.16, HDY=1.62;
SPRX.forEach(x=>{
  part(F.SPR,{axis:v(0,0,1),dist:2.4,rAxis:Y,rAng:0,tA:7.5+sweep(x)*1.0,lev:2});
  L([v(x,SPY,-2.85),v(x,SPY,2.85)],2);
  for(const z of SPRZ){ L([v(x,SPY,z),v(x,HDY,z)],2); L([v(x-0.06,SPY,z),v(x+0.06,SPY,z)],0); }
  L([v(x-0.05,SPY,-2.85),v(x+0.05,SPY,-2.85)],0);
});
SPRX.forEach((x,xi)=>SPRZ.forEach((z,k)=>{
  part(F.HEAD,{axis:v(0,-1,0),dist:0.7,rAxis:Y,rAng:Math.PI,tA:8.2+sweep(x)*1.0+k*0.05,lev:2});
  S(gCyl(v(x,HDY-0.035,z),v(x,HDY,z),0.022,12),M.steel,v(0,0.04,0),{eth:40});
  S(gCone(v(x,HDY-0.07,z),0.03,0.07),M.bright,Z0,{eth:40});
  S(gCyl(v(x,HDY-0.112,z),v(x,HDY-0.104,z),0.05,18),M.chrome,v(0,-0.05,0));
}));
// junction boxes on the front columns and their conduits (single line)
COLX.forEach((x,xi)=>{ const z=3+0.085+0.06, y=-1.95;
  part(F.JBOX,{axis:v(0,0,1),dist:1.0,rAxis:Y,rAng:Math.PI/2,tA:8.0+sweep(x)*0.8,lev:0});
  S(gBox(x,y,z,0.22,0.28,0.12),M.dark);
  S(gBox(x,y,z+0.068,0.24,0.3,0.014),M.galv,v(0,0,0.07));
  S(gBox(x+0.07,y-0.1,z+0.077,0.03,0.03,0.006),M.dark,v(0,0,0.07),{emis:(xi%2===0)?0.9:0});
  part(F.COND,{axis:v(0,-1,0),dist:1.2,rAxis:Y,rAng:0,tA:8.45+sweep(x)*0.8,lev:0});
  for(const dx of [-0.045,0.045]){
    const pts=[v(x+dx,y+0.14,z),v(x+dx,-1.15,z)];
    const ac=v(x+dx,-1.15,z-0.15);
    for(let i=1;i<=8;i++){ const t=i/8*Math.PI/2; pts.push(ac.clone().add(v(0,Math.sin(t)*0.15,Math.cos(t)*0.15))); }
    pts.push(v(x+dx,-1.0,TRZ[1]+TW/2+0.02));
    L(pts,2);
  }
});

/* ---------------------------------------------------------------- merge into GPU buffers */
const runs={};
let nS=0, nE=0;
for(const p of parts){
  const bb=new THREE.Box3();
  for(const s of p.solids){ s.g.computeBoundingBox(); bb.union(s.g.boundingBox); }
  for(const l of p.lines) for(const q of l.pts) bb.expandByPoint(q);
  p.H=bb.getCenter(new V3()); const sz=bb.getSize(new V3());
  const arr=[sz.x,sz.y,sz.z], ax=arr.indexOf(Math.max(...arr)); p.main=[X,Y,Z][ax];
  const half=arr[ax]/2, oth=arr.filter((_,i)=>i!==ax);
  p.rad=Math.max(0.03,Math.max(oth[0],oth[1])/2);
  const sh=Math.max(0,half-Math.min(p.rad,half*0.5));
  p.segA=p.main.clone().multiplyScalar(-sh); p.segB=p.main.clone().multiplyScalar(sh);
  p.tmin=-half; p.tlen=Math.max(arr[ax],1e-3); p.size=Math.max(...arr);
  for(const s of p.solids){ s.ng=s.g.index?s.g.toNonIndexed():s.g; nS+=s.ng.attributes.position.count; if(s.edges){ s.eg=new THREE.EdgesGeometry(s.g,s.eth); nE+=s.eg.attributes.position.count; } }
  for(const l of p.lines) nE+=(l.pts.length-1)*2;
  if(p.run){ (runs[p.run]=runs[p.run]||[]).push(p); }
}
const sPos=new Float32Array(nS*3), sNor=new Float32Array(nS*3), sCol=new Float32Array(nS*3), sSub=new Float32Array(nS*3), sPart=new Float32Array(nS), sRough=new Float32Array(nS), sEmis=new Float32Array(nS);
const ePos=new Float32Array(nE*3), gPos=new Float32Array(nE*3), eSub=new Float32Array(nE*3), ePart=new Float32Array(nE), eT=new Float32Array(nE), eKind=new Float32Array(nE), eL=new Float32Array(nE);
{ let o=0, k=0;
  const pushV=(p,x,y,z,sub,kind,Lv)=>{ const lx=x-p.H.x, ly=y-p.H.y, lz=z-p.H.z, i3=k*3;
    ePos[i3]=lx; ePos[i3+1]=ly; ePos[i3+2]=lz; gPos[i3]=x; gPos[i3+1]=y; gPos[i3+2]=z;
    eSub[i3]=sub.x; eSub[i3+1]=sub.y; eSub[i3+2]=sub.z; ePart[k]=p.i;
    eT[k]=clamp(((lx*p.main.x+ly*p.main.y+lz*p.main.z)-p.tmin)/p.tlen,0,1); eKind[k]=kind; eL[k]=Lv; k++; };
  for(const p of parts){
    for(const s of p.solids){
      const P=s.ng.attributes.position.array, N=s.ng.attributes.normal.array, cnt=s.ng.attributes.position.count;
      for(let i=0;i<cnt;i++){ const a=(o+i)*3, b=i*3;
        sPos[a]=P[b]-p.H.x; sPos[a+1]=P[b+1]-p.H.y; sPos[a+2]=P[b+2]-p.H.z;
        sNor[a]=N[b]; sNor[a+1]=N[b+1]; sNor[a+2]=N[b+2];
        sCol[a]=s.m.c[0]; sCol[a+1]=s.m.c[1]; sCol[a+2]=s.m.c[2];
        sSub[a]=s.sub.x; sSub[a+1]=s.sub.y; sSub[a+2]=s.sub.z;
        sPart[o+i]=p.i; sRough[o+i]=s.m.r; sEmis[o+i]=s.emis; }
      o+=cnt;
      if(s.eg){ const A=s.eg.attributes.position.array;
        for(let j=0;j<A.length;j+=6){ const len=Math.hypot(A[j+3]-A[j],A[j+4]-A[j+1],A[j+5]-A[j+2]);
          pushV(p,A[j],A[j+1],A[j+2],s.sub,0,0); pushV(p,A[j+3],A[j+4],A[j+5],s.sub,0,len); } }
    }
    for(const l of p.lines){ let acc=0;
      for(let j=0;j<l.pts.length-1;j++){ const a=l.pts[j], b=l.pts[j+1], len=a.distanceTo(b);
        pushV(p,a.x,a.y,a.z,l.sub,l.kind,acc); acc+=len; pushV(p,b.x,b.y,b.z,l.sub,l.kind,acc); } }
    for(const s of p.solids){ s.g.dispose(); if(s.ng!==s.g) s.ng.dispose(); if(s.eg) s.eg.dispose(); }
    p.solids=null; p.lines=null;
  }
}
const N=parts.length;

/* ---------------------------------------------------------------- per-part state texture */
const SW=256, SH=Math.max(1,Math.ceil(N*4/SW));
const sData=new Float32Array(SW*SH*4);
const sTex=new THREE.DataTexture(sData,SW,SH,THREE.RGBAFormat,THREE.FloatType);
sTex.magFilter=sTex.minFilter=THREE.NearestFilter; sTex.needsUpdate=true;
const U={ uState:{value:sTex}, uStateSize:{value:new THREE.Vector2(SW,SH)}, uTime:{value:0}, uScanX:{value:-99}, uScanAmt:{value:0}, uFlow:{value:REDUCED||STILL?0:1}, uDpr:{value:1}, uGrid:{value:0}, uAxis:{value:0} };
const COMMON=`
uniform sampler2D uState; uniform vec2 uStateSize;
vec4 st(float i){ float y=floor((i+0.5)/uStateSize.x); float x=i-y*uStateSize.x; return texture2D(uState,(vec2(x,y)+0.5)/uStateSize); }
vec3 qrot(vec4 q, vec3 v){ vec3 t=2.0*cross(q.xyz,v); return v+q.w*t+cross(q.xyz,t); }
`;

/* ---------------------------------------------------------------- solids: one draw, PBR metal with per-part transforms */
const solidGeo=new THREE.BufferGeometry();
solidGeo.setAttribute('position',new THREE.BufferAttribute(sPos,3));
solidGeo.setAttribute('normal',new THREE.BufferAttribute(sNor,3));
solidGeo.setAttribute('color',new THREE.BufferAttribute(sCol,3));
solidGeo.setAttribute('aSub',new THREE.BufferAttribute(sSub,3));
solidGeo.setAttribute('aPart',new THREE.BufferAttribute(sPart,1));
solidGeo.setAttribute('aRough',new THREE.BufferAttribute(sRough,1));
solidGeo.setAttribute('aEmis',new THREE.BufferAttribute(sEmis,1));
const solidMat=new THREE.MeshStandardMaterial({vertexColors:true,metalness:1,roughness:1,envMapIntensity:1.0,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});
solidMat.onBeforeCompile=(sh)=>{
  for(const k of ['uState','uStateSize','uTime','uScanX','uScanAmt']) sh.uniforms[k]=U[k];
  sh.vertexShader=sh.vertexShader
    .replace('#include <common>',`#include <common>
attribute float aPart; attribute vec3 aSub; attribute float aRough; attribute float aEmis;
varying float vMat; varying float vHeat; varying float vRough; varying float vEmis; varying float vNear; varying float vPartF; varying vec3 vLoc;
${COMMON}`)
    .replace('#include <beginnormal_vertex>',`
float bI=aPart*4.0;
vec4 s0=st(bI), s1=st(bI+1.0), s2=st(bI+2.0), s3=st(bI+3.0);
vec3 objectNormal=qrot(s1,normal);`)
    .replace('#include <begin_vertex>',`
vec3 transformed=qrot(s1,position+aSub*s2.x)+s0.xyz;
float visA=max(s2.z,s0.w);
transformed=mix(s0.xyz,transformed,step(0.0005,visA));
vMat=s2.z; vHeat=s2.y; vRough=aRough; vEmis=aEmis; vNear=s3.x; vPartF=aPart; vLoc=transformed;`);
  sh.fragmentShader=sh.fragmentShader
    .replace('#include <common>',`#include <common>
uniform float uTime; uniform float uScanX; uniform float uScanAmt;
varying float vMat; varying float vHeat; varying float vRough; varying float vEmis; varying float vNear; varying float vPartF; varying vec3 vLoc;`)
    .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
roughnessFactor=clamp(roughnessFactor*vRough,0.05,1.0);`)
    .replace('#include <opaque_fragment>',`
{
  vec3 Vd=normalize(vViewPosition);
  float fres=pow(1.0-clamp(abs(dot(normal,Vd)),0.0,1.0),2.5);
  vec3 blue=vec3(0.10,0.42,1.0);
  float present=smoothstep(0.0,0.25,vMat);
  outgoingLight*=vMat;
  outgoingLight+=blue*vHeat*(0.05+1.1*fres)*present;
  outgoingLight+=vec3(0.55,0.62,0.72)*fres*(0.04+0.12*vNear)*vMat;
  float scan=uScanAmt*exp(-pow((vLoc.x-uScanX)/0.45,2.0));
  outgoingLight+=blue*scan*fres*0.7*vMat;
  float blink=0.3+0.7*smoothstep(0.55,0.6,fract(uTime*0.23+fract(vPartF*0.6180339)));
  outgoingLight+=blue*vEmis*blink*7.0*present;
}
#include <opaque_fragment>`);
};
solidMat.customProgramCacheKey=()=>'la-solid';
const solids=new THREE.Mesh(solidGeo,solidMat); solids.frustumCulled=false; rig.add(solids);

/* ---------------------------------------------------------------- silver outlines (live) and blue blueprint (home) */
const edgeGeo=new THREE.BufferGeometry();
const aPartE=new THREE.BufferAttribute(ePart,1), aTE=new THREE.BufferAttribute(eT,1), aKindE=new THREE.BufferAttribute(eKind,1), aLE=new THREE.BufferAttribute(eL,1);
edgeGeo.setAttribute('position',new THREE.BufferAttribute(ePos,3));
edgeGeo.setAttribute('aSub',new THREE.BufferAttribute(eSub,3));
edgeGeo.setAttribute('aPart',aPartE); edgeGeo.setAttribute('aKind',aKindE); edgeGeo.setAttribute('aL',aLE);
const edgeMat=new THREE.ShaderMaterial({
  uniforms:{uState:U.uState,uStateSize:U.uStateSize,uTime:U.uTime,uScanX:U.uScanX,uScanAmt:U.uScanAmt,uFlow:U.uFlow},
  vertexShader:`
attribute float aPart; attribute vec3 aSub; attribute float aKind; attribute float aL;
uniform float uScanX; uniform float uScanAmt;
varying float vA; varying vec3 vCol; varying float vKind; varying float vL; varying float vPh;
${COMMON}
void main(){
  float bI=aPart*4.0;
  vec4 s0=st(bI), s1=st(bI+1.0), s2=st(bI+2.0), s3=st(bI+3.0);
  vec3 p=qrot(s1,position+aSub*s2.x)+s0.xyz;
  vec4 mv=modelViewMatrix*vec4(p,1.0);
  gl_Position=projectionMatrix*mv;
  float vis=s0.w;
  if(vis<0.001) gl_Position=vec4(0.0,0.0,-2.0,1.0);
  vec3 silver=vec3(0.50,0.54,0.60);
  vec3 blue=vec3(0.14,0.50,1.55);
  float heat=clamp(s2.y,0.0,1.6);
  float scan=uScanAmt*exp(-pow((p.x-uScanX)/0.5,2.0));
  float kindA=aKind<0.5?1.0:(aKind<1.5?0.5:0.85);
  vCol=mix(silver*(1.0+1.3*s3.x),blue*2.3,clamp(heat,0.0,1.0))+blue*max(heat-1.0,0.0)*1.5+blue*scan*1.6;
  float depthF=1.0-0.55*smoothstep(16.0,38.0,-mv.z);
  vA=vis*kindA*depthF*(0.55+0.45*clamp(heat+s3.x+scan,0.0,1.0));
  vKind=aKind; vL=aL; vPh=fract(aPart*0.6180339);
}`,
  fragmentShader:`
uniform float uTime; uniform float uFlow;
varying float vA; varying vec3 vCol; varying float vKind; varying float vL; varying float vPh;
void main(){
  float a=vA; vec3 col=vCol;
  if(vKind>0.5&&vKind<1.5){ float m=mod(vL,0.5); a*=(m<0.32||(m>0.38&&m<0.43))?1.0:0.0; }
  if(vKind>1.5){ float ph=fract(vL*0.16-uTime*0.12+vPh); float pk=smoothstep(0.0,0.012,ph)*(1.0-smoothstep(0.012,0.06,ph))*uFlow;
    col+=vec3(0.14,0.5,1.55)*pk*3.0; a=clamp(a+pk*0.6*step(0.001,vA),0.0,1.0); }
  if(a<0.004) discard;
  gl_FragColor=vec4(col,a);
}`,
  transparent:true, depthWrite:false
});
const edges=new THREE.LineSegments(edgeGeo,edgeMat); edges.frustumCulled=false; edges.renderOrder=3; rig.add(edges);

const ghostGeo=new THREE.BufferGeometry();
ghostGeo.setAttribute('position',new THREE.BufferAttribute(gPos,3));
ghostGeo.setAttribute('aPart',aPartE); ghostGeo.setAttribute('aT',aTE); ghostGeo.setAttribute('aKind',aKindE); ghostGeo.setAttribute('aL',aLE);
const ghostMat=new THREE.ShaderMaterial({
  uniforms:{uState:U.uState,uStateSize:U.uStateSize},
  vertexShader:`
attribute float aPart; attribute float aT; attribute float aKind; attribute float aL;
varying float vA; varying float vKind; varying float vL;
${COMMON}
void main(){
  float g=st(aPart*4.0+2.0).w;
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_Position=projectionMatrix*mv;
  if(g<0.002) gl_Position=vec4(0.0,0.0,-2.0,1.0);
  float reveal=smoothstep(aT-0.02,aT+0.06,g*1.14-0.06);
  float depthF=1.0-0.5*smoothstep(16.0,38.0,-mv.z);
  float kindA=aKind<0.5?1.0:(aKind<1.5?0.6:0.85);
  vA=reveal*sqrt(g)*0.5*depthF*kindA; vKind=aKind; vL=aL;
}`,
  fragmentShader:`
varying float vA; varying float vKind; varying float vL;
void main(){
  float a=vA;
  if(vKind>0.5&&vKind<1.5){ float m=mod(vL,0.5); a*=(m<0.32||(m>0.38&&m<0.43))?1.0:0.0; }
  if(a<0.004) discard;
  gl_FragColor=vec4(vec3(0.10,0.36,1.0)*1.25,a);
}`,
  transparent:true, depthWrite:false
});
const ghost=new THREE.LineSegments(ghostGeo,ghostMat); ghost.frustumCulled=false; ghost.renderOrder=2; rig.add(ghost);

/* ---------------------------------------------------------------- blueprint leaders, run connectors and markers */
const runList=Object.values(runs).filter(r=>r.length>1);
let NCON=0; runList.forEach(r=>NCON+=r.length-1);
const NL=N+NCON;
const lPos=new Float32Array(NL*6), lA=new Float32Array(NL*2), lL=new Float32Array(NL*2), lType=new Float32Array(NL*2);
for(let i=0;i<NL;i++){ lType[i*2]=lType[i*2+1]=(i<N)?0:1; }
const leadGeo=new THREE.BufferGeometry();
const lPosA=new THREE.BufferAttribute(lPos,3).setUsage(THREE.DynamicDrawUsage), lAA=new THREE.BufferAttribute(lA,1).setUsage(THREE.DynamicDrawUsage), lLA=new THREE.BufferAttribute(lL,1).setUsage(THREE.DynamicDrawUsage);
leadGeo.setAttribute('position',lPosA); leadGeo.setAttribute('aA',lAA); leadGeo.setAttribute('aL',lLA); leadGeo.setAttribute('aType',new THREE.BufferAttribute(lType,1));
const leadMat=new THREE.ShaderMaterial({
  uniforms:{uTime:U.uTime},
  vertexShader:`
attribute float aA; attribute float aL; attribute float aType;
varying float vA; varying float vL; varying float vT;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; if(aA<0.002) gl_Position=vec4(0.0,0.0,-2.0,1.0);
  vA=aA*(1.0-0.5*smoothstep(16.0,40.0,-mv.z)); vL=aL; vT=aType; }`,
  fragmentShader:`
uniform float uTime; varying float vA; varying float vL; varying float vT;
void main(){
  vec3 col; float a=vA;
  if(vT<0.5){ float d=step(0.45,fract(vL*5.0-uTime*1.1)); a*=0.3+0.7*d; col=vec3(0.12,0.42,1.25); }
  else { col=vec3(0.45,0.5,0.58); }
  if(a<0.003) discard;
  gl_FragColor=vec4(col,a);
}`,
  transparent:true, depthWrite:false
});
const leaders=new THREE.LineSegments(leadGeo,leadMat); leaders.frustumCulled=false; leaders.renderOrder=4; rig.add(leaders);

const mPos=new Float32Array(N*9), mA=new Float32Array(N*3), mS=new Float32Array(N*3), mType=new Float32Array(N*3);
for(let i=0;i<N;i++){ mType[i*3]=0; mType[i*3+1]=1; mType[i*3+2]=2; }
const markGeo=new THREE.BufferGeometry();
const mPosA=new THREE.BufferAttribute(mPos,3).setUsage(THREE.DynamicDrawUsage), mAA=new THREE.BufferAttribute(mA,1).setUsage(THREE.DynamicDrawUsage), mSA=new THREE.BufferAttribute(mS,1).setUsage(THREE.DynamicDrawUsage);
markGeo.setAttribute('position',mPosA); markGeo.setAttribute('aA',mAA); markGeo.setAttribute('aS',mSA); markGeo.setAttribute('aType',new THREE.BufferAttribute(mType,1));
const markMat=new THREE.ShaderMaterial({
  uniforms:{uDpr:U.uDpr},
  vertexShader:`
attribute float aA; attribute float aS; attribute float aType; uniform float uDpr;
varying float vA; varying float vT;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; if(aA<0.002) gl_Position=vec4(0.0,0.0,-2.0,1.0);
  gl_PointSize=aS*uDpr; vA=aA; vT=aType; }`,
  fragmentShader:`
varying float vA; varying float vT;
void main(){
  vec2 q=gl_PointCoord*2.0-1.0; float r=length(q); float a=0.0; vec3 col=vec3(0.12,0.45,1.3);
  if(vT<0.5){ a=smoothstep(0.55,0.68,r)*(1.0-smoothstep(0.8,0.95,r)); col=vec3(0.55,0.62,0.72); }
  else if(vT<1.5){ a=max(1.0-smoothstep(0.0,0.16,abs(q.x)),1.0-smoothstep(0.0,0.16,abs(q.y)))*step(r,1.0); }
  else { a=smoothstep(0.84,0.9,r)*(1.0-smoothstep(0.93,1.0,r)); col*=1.6; }
  a*=vA; if(a<0.004) discard; gl_FragColor=vec4(col,a);
}`,
  transparent:true, depthWrite:false
});
const markers=new THREE.Points(markGeo,markMat); markers.frustumCulled=false; markers.renderOrder=5; rig.add(markers);

/* ---------------------------------------------------------------- drafting plane and column grid */
const gridGeo=new THREE.PlaneGeometry(44,30,1,1); gridGeo.rotateX(-Math.PI/2); gridGeo.translate(0,FLOOR,0);
const gridMat=new THREE.ShaderMaterial({
  uniforms:{uGrid:U.uGrid},
  vertexShader:`varying vec3 vP; void main(){ vP=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader:`
uniform float uGrid; varying vec3 vP;
float ln(float c,float s,float o){ float d=abs(fract((c-o)/s+0.5)-0.5)*s; float w=fwidth(c); return 1.0-smoothstep(0.0,w*1.25,d); }
void main(){
  float minor=max(ln(vP.x,0.5,0.0),ln(vP.z,0.5,0.0));
  float major=max(ln(vP.x,3.0,1.5),ln(vP.z,3.0,0.0));
  float fade=1.0-smoothstep(4.0,13.0,length(vP.xz*vec2(0.6,1.2)));
  float a=(minor*0.045+major*0.1)*fade*uGrid;
  if(a<0.002) discard;
  gl_FragColor=vec4(vec3(0.5,0.56,0.64),a);
}`,
  transparent:true, depthWrite:false
});
const grid=new THREE.Mesh(gridGeo,gridMat); grid.renderOrder=0; grid.frustumCulled=false; rig.add(grid);

{ const pts=[], at=[], kd=[], al=[];
  const seg=(a,b,t0,t1,k,l0,l1)=>{ pts.push(a.x,a.y,a.z,b.x,b.y,b.z); at.push(t0,t1); kd.push(k,k); al.push(l0,l1); };
  const y=FLOOR+0.002;
  COLZ.forEach(z=>{ seg(v(-11.4,y,z),v(11.4,y,z),0,1,1,0,22.8); const c=circlePts(v(-11.8,y,z),Y,0.4,36); for(let i=0;i<c.length-1;i++) seg(c[i],c[i+1],1,1,0,0,0); });
  COLX.forEach(x=>{ seg(v(x,y,-6),v(x,y,6),0,1,1,0,12); const c=circlePts(v(x,y,6.4),Y,0.4,36); for(let i=0;i<c.length-1;i++) seg(c[i],c[i+1],1,1,0,0,0); });
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3)); g.setAttribute('aT',new THREE.Float32BufferAttribute(at,1));
  g.setAttribute('aKind',new THREE.Float32BufferAttribute(kd,1)); g.setAttribute('aL',new THREE.Float32BufferAttribute(al,1));
  const m=new THREE.ShaderMaterial({ uniforms:{uAxis:U.uAxis},
    vertexShader:`attribute float aT; attribute float aKind; attribute float aL; uniform float uAxis; varying float vA; varying float vK; varying float vL;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; vA=smoothstep(aT-0.05,aT+0.02,uAxis*1.1-0.05)*0.2*(1.0-0.6*smoothstep(18.0,40.0,-mv.z)); vK=aKind; vL=aL; }`,
    fragmentShader:`varying float vA; varying float vK; varying float vL;
void main(){ float a=vA; if(vK>0.5){ float m=mod(vL,0.9); a*=(m<0.6||(m>0.7&&m<0.78))?1.0:0.0; } if(a<0.003) discard; gl_FragColor=vec4(0.55,0.6,0.68,a); }`,
    transparent:true, depthWrite:false });
  const ax=new THREE.LineSegments(g,m); ax.renderOrder=1; ax.frustumCulled=false; rig.add(ax);
}

/* ---------------------------------------------------------------- per-part runtime state */
const CEN=v(0,0.3,0);
parts.forEach(p=>{
  p.P=p.H.clone(); p.V=v(0,0,0); p.Q=new Q4(); p.W=v(0,0,0);
  p.T=p.H.clone(); p.QT=new Q4();
  p.k=14; p.z=0.62; p.kr=14; p.mag=true;
  p.sep=0; p.sepT=0; p.sepH=0; p.heat=0; p.heatHold=0; p.heatH=0; p.mat=0; p.line=0;
  p.ghost=0; p.ghostT=0; p.ghostH=0; p.near=0; p.lensT=0; p.pulse=0;
  p.launched=false; p.arriving=false; p.introMat=false; p.float=false; p.ph=rnd()*6.283; p.lock=0; p.soft=false; p.snapped=false;
  p.ho=v(0,0,0);
  const o=p.H.clone().sub(CEN); o.y*=0.6; p.hAx=p.hx?(o.lengthSq()>1e-4?o.normalize():Y.clone()):v(0,0,0);
  p.tG=0.35+sweep(p.H.x)*1.6+p.layer*0.38+(p.H.y+3)*0.04;
});

/* exploded positions: systems separate into strata, everything spreads on a quantised lattice */
const qz=x=>Math.round(x/0.05)*0.05;
parts.forEach(p=>{
  const H=p.H, e=v(H.x*1.34,H.y*1.42+0.3,H.z*1.62);
  switch(p.fam){
    case F.COL: e.y=H.y+(p.upper?0.75:-0.7); break;
    case F.TRAY: case F.CABLE: e.y=H.y*1.42-0.85; e.z=H.z*2.05; break;
    case F.PTRAP: e.y-=0.55; break;
    case F.PIPE: case F.ELBOW: e.z=H.z*1.9; break;
    case F.VALVE: e.y+=0.85; e.z=H.z*1.9; break;
    case F.RISER: e.x=H.x*1.42; e.z=H.z*1.9; break;
    case F.DUCT: case F.DCAP: case F.UDUCT: case F.BRANCH: e.y+=1.9; break;
    case F.EQUIP: e.y+=1.25; break;
    case F.SPR: e.y-=0.35; break;
    case F.HEAD: e.y-=0.2; break;
    case F.JBOX: case F.COND: e.z=H.z*1.85; break;
    case F.PUMP: e.x=H.x*1.4; e.y-=0.4; e.z=H.z*1.9; break;
  }
  p.E=v(qz(e.x),qz(e.y),qz(e.z));
  const q=new Q4();
  switch(p.fam){
    case F.BEAM: q.setFromAxisAngle(p.dirX?X:Z,Math.PI/2); break;
    case F.DUCT: case F.TRAY: case F.VALVE: case F.HEAD: case F.JBOX: q.setFromAxisAngle(X,Math.PI/2); break;
    case F.PIPE: q.setFromAxisAngle(X,Math.PI/2); break;
    case F.COL: q.setFromAxisAngle(Y,Math.PI/4); break;
    case F.DTRAP: case F.PTRAP: q.setFromAxisAngle(Y,Math.PI/2); break;
  }
  p.QE=q;
});
const FAMO={}, RO={};
[[F.HEAD,0],[F.COND,0],[F.CABLE,0.3],[F.VALVE,0.5],[F.JBOX,0.5],[F.SPR,0.8],[F.EQUIP,1],[F.BRANCH,1.2],[F.UDUCT,1.3],[F.DCAP,1.3],[F.DUCT,1.5],[F.PIPE,1.8],[F.ELBOW,1.9],[F.RISER,2],[F.TRAY,2],[F.DTRAP,2.2],[F.PTRAP,2.2],[F.PUMP,2.2],[F.BRACE,2.6],[F.BEAM,3],[F.COL,3.4]].forEach(([f,o])=>FAMO[f]=o);
[[F.COL,0],[F.BEAM,1],[F.BRACE,1.6],[F.PTRAP,2],[F.DTRAP,2],[F.TRAY,2.4],[F.CABLE,3],[F.PIPE,2.8],[F.ELBOW,3.1],[F.RISER,3.1],[F.PUMP,3],[F.VALVE,3.6],[F.DUCT,3.2],[F.DCAP,3.6],[F.UDUCT,3.7],[F.BRANCH,3.8],[F.EQUIP,4.1],[F.SPR,4.2],[F.JBOX,4.3],[F.HEAD,4.5],[F.COND,4.6]].forEach(([f,o])=>RO[f]=o);
const ROUND=new Set([F.PIPE,F.RISER,F.ELBOW,F.COL,F.BRANCH,F.VALVE,F.HEAD,F.UDUCT,F.DCAP]);
const LINEAR=new Set([F.BEAM,F.BRACE,F.DUCT,F.TRAY,F.CABLE,F.SPR]);

/* ---------------------------------------------------------------- scene-time scheduler */
let T=0, epoch=0, mode='intro', modeT=0, pendingUntil=0, nextScan=0;
const queue=[];
function at(t,fn){ queue.push({t,fn,ep:epoch}); }
function runQueue(){
  for(let i=queue.length-1;i>=0;i--){ const e=queue[i];
    if(e.ep!==epoch){ queue[i]=queue[queue.length-1]; queue.pop(); continue; }
    if(e.t<=T){ queue[i]=queue[queue.length-1]; queue.pop(); e.fn(); } }
}
// The GSAP calls the prototype made, on the same clock: to, delay, ease, yoyo, repeat, repeatDelay
const inOut=f=>t=>t<0.5?f(t*2)/2:1-f((1-t)*2)/2;
const EASE={
  'power1.out':t=>1-(1-t)*(1-t), 'power2.out':t=>1-Math.pow(1-t,3),
  'power1.inOut':inOut(t=>t*t), 'power2.inOut':inOut(t=>t*t*t), 'power3.inOut':inOut(t=>t*t*t*t),
  'sine.inOut':t=>-(Math.cos(Math.PI*t)-1)/2,
};
const tweens=[];
function tween(obj,o){
  const {duration,delay=0,ease='power1.out',yoyo=false,repeat=0,repeatDelay=0,...to}=o;
  tweens.push({obj,to,from:null,start:T+delay,duration,ease:EASE[ease],yoyo,repeat,repeatDelay});
}
function killTweens(obj){ for(let i=tweens.length-1;i>=0;i--) if(tweens[i].obj===obj) tweens.splice(i,1); }
function runTweens(){
  for(let i=0;i<tweens.length;i++){ const tw=tweens[i]; if(T<tw.start) continue;
    if(!tw.from){ tw.from={}; for(const k in tw.to) tw.from[k]=tw.obj[k]; }
    const el=T-tw.start, cyc=tw.duration+tw.repeatDelay, total=(tw.repeat+1)*tw.duration+tw.repeat*tw.repeatDelay, done=el>=total;
    let n=done?tw.repeat:Math.floor(el/cyc), p=done?1:Math.min((el-n*cyc)/tw.duration,1);
    if(tw.yoyo&&n%2===1) p=1-p;
    const e=tw.ease(p);
    for(const k in tw.to) tw.obj[k]=tw.from[k]+(tw.to[k]-tw.from[k])*e;
    if(done){ tweens.splice(i,1); i--; }
  }
}
const G={dolly:0, bloom:0.78};
const CAM={px:5.4,py:-2.5,pz:13.2,tx:0.0,ty:-0.4,tz:0};
const CAM_END={px:9.1,py:-1.55,pz:18.6,tx:0.15,ty:0.5,tz:0};

/* ---------------------------------------------------------------- behaviours */
function startIntro(){
  if(REDUCED||STILL){ parts.forEach(settleNow); snappedCount=N; Object.assign(CAM,CAM_END); U.uGrid.value=1; U.uAxis.value=1; enterAssembled(); return; }
  tween(CAM,{...CAM_END,duration:11.5,ease:'power2.inOut'});
  tween(U.uGrid,{value:1,duration:2.4,ease:'power2.out'});
  tween(U.uAxis,{value:1,duration:2.8,delay:0.2,ease:'power3.inOut'});
  parts.forEach(p=>{ at(p.tG,()=>{ if(!p.launched) p.ghostT=1; }); at(p.tA-1.05,()=>launch(p)); });
}

function launch(p){
  p.launched=true; p.P.copy(p.H).addScaledVector(p.axis,p.dist); p.V.set(0,0,0);
  p.Q.setFromAxisAngle(p.rAxis,p.rAng); p.W.set(0,0,0);
  p.T.copy(p.H); p.QT.identity(); p.mag=true; p.k=12.5+rnd()*3; p.z=0.62; p.kr=15;
  p.arriving=true; p.introMat=true; p.heatHold=0.7; p.heat=Math.max(p.heat,0.7); p.ghostT=1;
}
function settleNow(p){
  p.launched=true; p.P.copy(p.H); p.V.set(0,0,0); p.Q.identity(); p.W.set(0,0,0); p.T.copy(p.H); p.QT.identity();
  p.mat=1; p.line=1; p.introMat=false; p.heatHold=0; p.arriving=false; p.snapped=true; p.ghostT=0;
}
let snappedCount=0;
function onSnap(p){
  p.arriving=false;
  if(!p.snapped){ p.snapped=true; snappedCount++; }
  p.introMat=false; p.heatHold=0;
  if(p.soft){ p.heat=Math.max(p.heat,0.55); p.pulse=Math.max(p.pulse,0.45); }
  else { p.heat=1.15; p.pulse=1; }
  const ep=epoch; at(T+0.18,()=>{ if(epoch===ep) p.ghostT=0; });
  p.soft=false;
}
function enterAssembled(){
  mode='assembled'; modeT=T;
  parts.forEach(p=>{ p.lock=0; p.float=false; });
  nextScan=T+0.6;
}
function explode(origin){
  epoch++; mode='exploding'; modeT=T; let maxD=0;
  parts.forEach(p=>{
    if(!p.launched) settleNow(p);
    p.arriving=false; p.sepT=0; p.lock=1e9; p.introMat=false; p.heatHold=0;
    const delay=p.H.distanceTo(origin)*0.045+FAMO[p.fam]*0.06+rnd()*0.05; maxD=Math.max(maxD,delay);
    at(T+delay,()=>{ p.T.copy(p.E); p.QT.copy(p.QE); p.mag=false; p.k=8.5+rnd()*4; p.z=0.86; p.kr=7; p.ghostT=1; p.heat=Math.max(p.heat,0.85); p.float=true; });
  });
  at(T+maxD+1.3,()=>{ mode='exploded'; modeT=T; });
  tween(G,{dolly:1,duration:2.6,ease:'power3.inOut'});
  tween(U.uGrid,{value:1.7,duration:2,ease:'power2.out'});
}
function reassemble(origin){
  epoch++; mode='reassembling'; modeT=T; let maxD=0;
  parts.forEach(p=>{
    if(!p.launched) settleNow(p);
    p.lock=1e9;
    const delay=RO[p.fam]*0.2+p.H.distanceTo(origin)*0.022+rnd()*0.05; maxD=Math.max(maxD,delay);
    at(T+delay,()=>{ p.T.copy(p.H); p.QT.identity(); p.mag=true; p.k=11+rnd()*3; p.z=0.6; p.kr=10; p.arriving=true; p.float=false; p.heat=Math.max(p.heat,0.6); });
  });
  pendingUntil=T+maxD+0.1;
  tween(G,{dolly:0,duration:3.0,delay:0.3,ease:'power3.inOut'});
  tween(U.uGrid,{value:1,duration:2.6,delay:0.6,ease:'power2.inOut'});
}
function scan(){
  const dir=rnd()<0.5?1:-1; killTweens(U.uScanX); killTweens(U.uScanAmt);
  U.uScanX.value=-12*dir; tween(U.uScanX,{value:12*dir,duration:4.6,ease:'power1.inOut'});
  tween(U.uScanAmt,{value:0.85,duration:0.9,yoyo:true,repeat:1,repeatDelay:2.8,ease:'sine.inOut'});
}

/* ---------------------------------------------------------------- pointer: hover only, a click belongs to the deck */
const ptr={x:0,y:0,sx:0,sy:0,inside:false,touch:false};
const sp={x:0,y:0};
let stageRect=canvas.getBoundingClientRect();
function setPtr(e){
  ptr.sx=e.clientX-stageRect.left; ptr.sy=e.clientY-stageRect.top;
  ptr.x=clamp(ptr.sx/stageRect.width*2-1,-1.2,1.2); ptr.y=clamp(-(ptr.sy/stageRect.height*2-1),-1.2,1.2);
  ptr.inside=ptr.sx>=0&&ptr.sy>=0&&ptr.sx<=stageRect.width&&ptr.sy<=stageRect.height;
}
const onMove=e=>{ ptr.touch=e.pointerType!=='mouse'; setPtr(e); };
const onLeave=()=>{ ptr.inside=false; };
if(!STILL){
  window.addEventListener('pointermove',onMove,{passive:true});
  document.addEventListener('pointerleave',onLeave);
  window.addEventListener('blur',onLeave);
}

/* ---------------------------------------------------------------- picking and the cursor lens */
/* ---------------------------------------------------------------- picking and the cursor lens */
let hovered=-1;
const lastProj=new Map();
const VP=new THREE.Matrix4(), _a=new V3(), _b=new V3(), _c=new V3();
const snapPos={x:0,y:0,tx:0,ty:0,on:false,k:'end'};
function project(x,y,z,out){ const e=VP.elements; const w=e[3]*x+e[7]*y+e[11]*z+e[15];
  out.x=((e[0]*x+e[4]*y+e[8]*z+e[12])/w*0.5+0.5)*stageRect.width; out.y=(0.5-(e[1]*x+e[5]*y+e[9]*z+e[13])/w*0.5)*stageRect.height; out.w=w; return out; }
const pa={x:0,y:0,w:1}, pb={x:0,y:0,w:1};
function pick(){
  VP.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse).multiply(rig.matrixWorld);
  const focal=(stageRect.height/2)/Math.tan(camera.fov*Math.PI/360);
  const active=ptr.inside&&FINE&&!ptr.touch&&mode!=='intro';
  const R=0.12*stageRect.width;
  let best=-1, bestW=1e9, nearI=-1, nearD=1e9, keepD=1e9;
  lastProj.clear();
  for(let i=0;i<N;i++){ const p=parts[i];
    _a.copy(p.segA).applyQuaternion(p.Q).add(p.P); _b.copy(p.segB).applyQuaternion(p.Q).add(p.P);
    project(_a.x,_a.y,_a.z,pa); project(_b.x,_b.y,_b.z,pb);
    p.sax=pa.x; p.say=pa.y; p.sbx=pb.x; p.sby=pb.y;
    lastProj.set(i,clamp(((pa.x+pb.x)/2)/stageRect.width*2-1,-1,1));
    if(!active||!p.launched||p.mat<0.5||pa.w<=0||pb.w<=0){ p.lensT=0; continue; }
    const dx=pb.x-pa.x, dy=pb.y-pa.y, l2=dx*dx+dy*dy;
    let t=l2>0?((ptr.sx-pa.x)*dx+(ptr.sy-pa.y)*dy)/l2:0; t=clamp(t,0,1);
    const qx=pa.x+dx*t, qy=pa.y+dy*t;
    p.sqx=qx; p.sqy=qy;
    const radPx=p.rad*focal/((pa.w+pb.w)*0.5);
    const dd=Math.max(0,Math.hypot(ptr.sx-qx,ptr.sy-qy)-radPx);
    p.lensT=Math.pow(1-smooth(0,R,dd),2);
    const wd=(pa.w+pb.w)*0.5;
    if(dd<=1.5&&wd<bestW){ best=i; bestW=wd; }
    if(dd<nearD){ nearD=dd; nearI=i; }
    if(i===hovered) keepD=dd;
  }
  if(best<0&&nearD<10) best=nearI;
  if(hovered>=0&&best!==hovered&&keepD<5&&active) best=hovered;
  hovered=active?best:-1;
  for(let i=0;i<N;i++){ const p=parts[i], sel=i===hovered, lens=p.lensT;
    p.ho.copy(p.hAx).multiplyScalar((sel?0.13:0)+lens*0.065);
    p.sepH=sel?1:lens*0.3; p.heatH=sel?0.45:0; p.ghostH=sel?0.85:0; }
  if(hovered>=0){ const p=parts[hovered];
    const k=LINEAR.has(p.fam)?'mid':ROUND.has(p.fam)?'cen':'end';
    if(k==='mid'){ snapPos.tx=(p.sax+p.sbx)/2; snapPos.ty=(p.say+p.sby)/2; }
    else if(k==='cen'){ snapPos.tx=p.sqx; snapPos.ty=p.sqy; }
    else { _c.copy(p.P); project(_c.x,_c.y,_c.z,pa); snapPos.tx=pa.x; snapPos.ty=pa.y; }
    if(!snapPos.on){ snapPos.x=ptr.sx; snapPos.y=ptr.sy; }
    snapPos.on=true; snapPos.k=k;
  } else snapPos.on=false;
}

/* ---------------------------------------------------------------- physics: springs with a magnetic snap */
const MAG=1.15, E2=0.01, MAGR=1.0, ER2=0.0225;
const _qe=new Q4(), _dq=new Q4(), _ax=new V3();
function physics(dt){
  const n=Math.max(1,Math.ceil(dt/(1/120))), h=dt/n;
  const floatOn=(mode==='exploding'||mode==='exploded');
  let reassembleDone=true;
  for(let i=0;i<N;i++){ const p=parts[i];
    if(!p.launched){ p.mat=0; p.line=0; p.ghost=damp(p.ghost,p.ghostT,3.0,dt); continue; }
    let tx=p.T.x+p.ho.x, ty=p.T.y+p.ho.y, tz=p.T.z+p.ho.z;
    if(floatOn&&p.float) ty+=Math.sin(T*0.6+p.ph)*0.035;
    let d=0;
    for(let s=0;s<n;s++){
      const dx=tx-p.P.x, dy=ty-p.P.y, dz=tz-p.P.z, d2=dx*dx+dy*dy+dz*dz;
      let k=p.k; if(p.mag) k+=MAG/Math.pow(d2+E2,1.5);
      const c=2*Math.sqrt(k)*p.z;
      p.V.x+=(k*dx-c*p.V.x)*h; p.V.y+=(k*dy-c*p.V.y)*h; p.V.z+=(k*dz-c*p.V.z)*h;
      p.P.x+=p.V.x*h; p.P.y+=p.V.y*h; p.P.z+=p.V.z*h;
      d=Math.sqrt(d2);
      _qe.copy(p.Q).invert().premultiply(p.QT); if(_qe.w<0){ _qe.x=-_qe.x; _qe.y=-_qe.y; _qe.z=-_qe.z; _qe.w=-_qe.w; }
      const ang=2*Math.acos(clamp(_qe.w,-1,1)), sn=Math.sqrt(Math.max(0,1-_qe.w*_qe.w));
      let ex=0,ey=0,ez=0; if(sn>1e-6){ ex=_qe.x/sn*ang; ey=_qe.y/sn*ang; ez=_qe.z/sn*ang; }
      let kr=p.kr; if(p.mag) kr+=MAGR/Math.pow(ang*ang+ER2,1.5);
      const cr=2*Math.sqrt(kr)*0.74;
      p.W.x+=(ex*kr-p.W.x*cr)*h; p.W.y+=(ey*kr-p.W.y*cr)*h; p.W.z+=(ez*kr-p.W.z*cr)*h;
      const wl=Math.hypot(p.W.x,p.W.y,p.W.z);
      if(wl*h>1e-7){ _ax.set(p.W.x/wl,p.W.y/wl,p.W.z/wl); _dq.setFromAxisAngle(_ax,wl*h); p.Q.premultiply(_dq).normalize(); }
      p.angErr=ang;
    }
    if(p.arriving&&d<0.012&&p.angErr<0.03) onSnap(p);
    if(p.arriving) reassembleDone=false;
    const dh=p.P.distanceTo(p.H);
    const matT=p.introMat?1-smooth(0.25,2.6,dh):1;
    p.mat=damp(p.mat,matT,6,dt);
    p.line=damp(p.line,1,9,dt);
    p.sep=damp(p.sep,Math.max(p.sepT,p.sepH),9,dt);
    const hb=Math.max(p.heatHold,p.heatH);
    p.heat=p.heat>hb?hb+(p.heat-hb)*Math.exp(-dt*1.7):damp(p.heat,hb,8,dt);
    p.ghost=damp(p.ghost,Math.max(p.ghostT,p.ghostH),3.0,dt);
    p.near=damp(p.near,p.lensT,8,dt);
    p.pulse=Math.max(0,p.pulse-dt*1.3);
  }
  if(mode==='intro'&&snappedCount>=N) enterAssembled();
  if(mode==='reassembling'&&T>pendingUntil&&(reassembleDone||T-modeT>9)){
    if(!reassembleDone) parts.forEach(p=>{ if(p.arriving) onSnap(p); });
    tween(U.uGrid,{value:1,duration:1.2}); enterAssembled();
  }
}

/* ---------------------------------------------------------------- write GPU state */
function writeState(){
  for(let i=0;i<N;i++){ const p=parts[i], o=i*16;
    sData[o]=p.P.x; sData[o+1]=p.P.y; sData[o+2]=p.P.z; sData[o+3]=p.line;
    sData[o+4]=p.Q.x; sData[o+5]=p.Q.y; sData[o+6]=p.Q.z; sData[o+7]=p.Q.w;
    sData[o+8]=p.sep; sData[o+9]=p.heat; sData[o+10]=p.mat; sData[o+11]=p.ghost;
    sData[o+12]=p.near; sData[o+13]=(i===hovered)?1:0; sData[o+14]=0; sData[o+15]=0; }
  sTex.needsUpdate=true;
  let k=0;
  for(let i=0;i<N;i++){ const p=parts[i], dist=p.P.distanceTo(p.H);
    const a=p.launched?p.ghost*smooth(0.12,0.7,dist)*0.42:0;
    lPos.set([p.P.x,p.P.y,p.P.z,p.H.x,p.H.y,p.H.z],k*6); lA[k*2]=a; lA[k*2+1]=a*0.35; lL[k*2]=0; lL[k*2+1]=dist; k++;
    const m=i*9; mPos[m]=p.P.x; mPos[m+1]=p.P.y; mPos[m+2]=p.P.z; mPos[m+3]=p.H.x; mPos[m+4]=p.H.y; mPos[m+5]=p.H.z; mPos[m+6]=p.H.x; mPos[m+7]=p.H.y; mPos[m+8]=p.H.z;
    const ma=p.launched?p.ghost*smooth(0.25,0.9,dist):0;
    mA[i*3]=ma*0.75; mS[i*3]=9; mA[i*3+1]=ma*0.6; mS[i*3+1]=7;
    mA[i*3+2]=p.pulse*p.pulse*0.9; mS[i*3+2]=8+46*(1-p.pulse);
  }
  for(const r of runList){ for(let j=0;j<r.length-1;j++){ const p=r[j], q=r[j+1];
    const dd=Math.max(p.P.distanceTo(p.H),q.P.distanceTo(q.H));
    const a=(p.launched&&q.launched)?Math.min(p.ghost,q.ghost)*smooth(0.25,0.9,dd)*0.22:0;
    lPos.set([p.P.x,p.P.y,p.P.z,q.P.x,q.P.y,q.P.z],k*6); lA[k*2]=a; lA[k*2+1]=a; lL[k*2]=0; lL[k*2+1]=0; k++; } }
  lPosA.needsUpdate=true; lAA.needsUpdate=true; lLA.needsUpdate=true; mPosA.needsUpdate=true; mAA.needsUpdate=true; mSA.needsUpdate=true;
}

/* ---------------------------------------------------------------- post: HDR bloom, ACES, grain, vignette */
const rtOpt={type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false,stencilBuffer:false};
const rtScene=new THREE.WebGLRenderTarget(4,4,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true,stencilBuffer:false,samples:STILL?8:4});
const rB=[0,1,2].map(()=>[new THREE.WebGLRenderTarget(4,4,rtOpt),new THREE.WebGLRenderTarget(4,4,rtOpt)]);
const fsScene=new THREE.Scene(), fsCam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const fsGeo=new THREE.BufferGeometry();
fsGeo.setAttribute('position',new THREE.Float32BufferAttribute([-1,-1,0,3,-1,0,-1,3,0],3));
fsGeo.setAttribute('uv',new THREE.Float32BufferAttribute([0,0,2,0,0,2],2));
const fsMesh=new THREE.Mesh(fsGeo); fsMesh.frustumCulled=false; fsScene.add(fsMesh);
const VS=`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }`;
const brightMat=new THREE.ShaderMaterial({uniforms:{tIn:{value:null},uTexel:{value:new THREE.Vector2()},uTh:{value:1.35},uKnee:{value:0.5}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tIn; uniform vec2 uTexel; uniform float uTh; uniform float uKnee; varying vec2 vUv;
void main(){ vec3 c=(texture2D(tIn,vUv+uTexel*vec2(-1.0,-1.0)).rgb+texture2D(tIn,vUv+uTexel*vec2(1.0,-1.0)).rgb+texture2D(tIn,vUv+uTexel*vec2(-1.0,1.0)).rgb+texture2D(tIn,vUv+uTexel*vec2(1.0,1.0)).rgb)*0.25;
  float l=max(c.r,max(c.g,c.b)); float s=clamp(l-uTh+uKnee,0.0,2.0*uKnee); s=s*s/(4.0*uKnee+1e-4); float w=max(s,l-uTh)/max(l,1e-4);
  gl_FragColor=vec4(min(c*w,vec3(24.0)),1.0); }`});
const downMat=new THREE.ShaderMaterial({uniforms:{tIn:{value:null},uTexel:{value:new THREE.Vector2()}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tIn; uniform vec2 uTexel; varying vec2 vUv;
void main(){ gl_FragColor=vec4((texture2D(tIn,vUv+uTexel*vec2(-1.0,-1.0)).rgb+texture2D(tIn,vUv+uTexel*vec2(1.0,-1.0)).rgb+texture2D(tIn,vUv+uTexel*vec2(-1.0,1.0)).rgb+texture2D(tIn,vUv+uTexel*vec2(1.0,1.0)).rgb)*0.25,1.0); }`});
const blurMat=new THREE.ShaderMaterial({uniforms:{tIn:{value:null},uDir:{value:new THREE.Vector2()}},vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tIn; uniform vec2 uDir; varying vec2 vUv;
void main(){ vec3 c=texture2D(tIn,vUv).rgb*0.2270270270;
  c+=texture2D(tIn,vUv+uDir*1.3846153846).rgb*0.3162162162; c+=texture2D(tIn,vUv-uDir*1.3846153846).rgb*0.3162162162;
  c+=texture2D(tIn,vUv+uDir*3.2307692308).rgb*0.0702702703; c+=texture2D(tIn,vUv-uDir*3.2307692308).rgb*0.0702702703;
  gl_FragColor=vec4(c,1.0); }`});
const compMat=new THREE.ShaderMaterial({uniforms:{tScene:{value:null},tB1:{value:null},tB2:{value:null},tB3:{value:null},uStrength:{value:0.9},uTime:{value:0},uAspect:{value:16/9},uRes:{value:new THREE.Vector2(1,1)},uGrain:{value:0.02},uCA:{value:0.0006}},
  vertexShader:VS,depthTest:false,depthWrite:false,
  fragmentShader:`uniform sampler2D tScene,tB1,tB2,tB3; uniform float uStrength,uTime,uAspect,uGrain,uCA; uniform vec2 uRes; varying vec2 vUv;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float hash(vec2 p){ p=fract(p*vec2(443.897,441.423)); p+=dot(p,p.yx+19.19); return fract((p.x+p.y)*p.x); }
void main(){
  vec2 c=vUv-0.5; vec2 ca=c*vec2(uAspect,1.0); float r2=dot(ca,ca);
  vec2 off=c*uCA*r2*4.0;
  vec3 col=vec3(texture2D(tScene,vUv-off).r,texture2D(tScene,vUv).g,texture2D(tScene,vUv+off).b);
  vec3 b=texture2D(tB1,vUv).rgb*0.5+texture2D(tB2,vUv).rgb*0.7+texture2D(tB3,vUv).rgb*0.95;
  col+=b*uStrength;
  vec2 q=(vUv-vec2(0.5,0.58))*vec2(uAspect,1.0);
  col+=vec3(0.0022,0.003,0.0048)*(1.0-smoothstep(0.0,1.05,length(q)));
  col=aces(col*0.82);
  col=pow(col,vec3(1.0/2.2));
  float vig=smoothstep(1.2,0.3,length(ca*vec2(0.86,1.0))*1.05); col*=mix(0.5,1.0,vig);
  col+=(hash(vUv*uRes+fract(uTime*7.13)*97.0)-0.5)*uGrain;
  gl_FragColor=vec4(max(col,0.0),1.0);
}`});
function pass(mat,target){ fsMesh.material=mat; renderer.setRenderTarget(target); renderer.render(fsScene,fsCam); }

let cssW=1, cssH=1, renderScale=1, dpr=1;
const MAX_PIX=1920*1080*1.6;
function resize(){
  stageRect=canvas.getBoundingClientRect();
  if(STILL){ cssW=opts.size?.width??2560; cssH=opts.size?.height??1440; dpr=1; }
  else {
    cssW=Math.max(2,Math.round(stageRect.width)); cssH=Math.max(2,Math.round(stageRect.height));
    dpr=Math.min(window.devicePixelRatio||1,2);
    dpr=Math.min(dpr,Math.sqrt(MAX_PIX/(cssW*cssH)))*renderScale; dpr=Math.max(0.5,dpr);
  }
  renderer.setPixelRatio(dpr); renderer.setSize(cssW,cssH,false);
  const w=Math.round(cssW*dpr), h=Math.round(cssH*dpr);
  rtScene.setSize(w,h);
  rB.forEach((pair,i)=>{ const s=2<<i; pair.forEach(rt=>rt.setSize(Math.max(2,Math.round(w/s)),Math.max(2,Math.round(h/s)))); });
  camera.aspect=cssW/cssH;
  // Slide the projection, not the camera, so the structure moves right without turning
  camera.setViewOffset(cssW,cssH,-FRAME.shift*cssW,0,cssW,cssH);
  camera.zoom=FRAME.zoom;
  camera.updateProjectionMatrix();
  compMat.uniforms.uAspect.value=cssW/cssH; compMat.uniforms.uRes.value.set(w,h);
  U.uDpr.value=dpr;
}
resize();

function render(){
  renderer.setRenderTarget(rtScene); renderer.render(scene,camera);
  brightMat.uniforms.tIn.value=rtScene.texture; brightMat.uniforms.uTexel.value.set(0.5/rtScene.width,0.5/rtScene.height);
  pass(brightMat,rB[0][0]);
  for(let i=0;i<3;i++){ const A=rB[i][0], B=rB[i][1];
    if(i>0){ downMat.uniforms.tIn.value=rB[i-1][0].texture; downMat.uniforms.uTexel.value.set(0.5/rB[i-1][0].width,0.5/rB[i-1][0].height); pass(downMat,A); }
    const reps=i===2?2:1;
    for(let r=0;r<reps;r++){
      blurMat.uniforms.tIn.value=A.texture; blurMat.uniforms.uDir.value.set(1/A.width,0); pass(blurMat,B);
      blurMat.uniforms.tIn.value=B.texture; blurMat.uniforms.uDir.value.set(0,1/A.height); pass(blurMat,A); }
  }
  compMat.uniforms.tScene.value=rtScene.texture; compMat.uniforms.tB1.value=rB[0][0].texture; compMat.uniforms.tB2.value=rB[1][0].texture; compMat.uniforms.tB3.value=rB[2][0].texture;
  compMat.uniforms.uStrength.value=G.bloom; compMat.uniforms.uTime.value=T;
  pass(compMat,null);
}

/* ---------------------------------------------------------------- frame */
const _lp=new V3(), _ray=new THREE.Raycaster(), _plane=new THREE.Plane(new V3(0,0,1),-1.5), _ndc=new THREE.Vector2();
const drift=REDUCED||STILL?0:1;
function step(dt){
  T+=dt; U.uTime.value=T;
  runTweens();
  runQueue();
  const tx=ptr.inside?ptr.x:0, ty=ptr.inside?ptr.y:0;
  sp.x=damp(sp.x,tx,2.4,dt); sp.y=damp(sp.y,ty,2.4,dt);
  const dl=1+0.5*G.dolly;
  camera.position.set(CAM.tx+(CAM.px-CAM.tx)*dl+sp.x*0.7, CAM.ty+(CAM.py-CAM.ty)*dl+sp.y*0.4+G.dolly*0.6, CAM.tz+(CAM.pz-CAM.tz)*dl);
  camera.lookAt(CAM.tx,CAM.ty+G.dolly*0.75,CAM.tz);
  rig.rotation.y=sp.x*0.1+Math.sin(T*0.07)*0.022*drift;
  rig.rotation.x=-sp.y*0.04+Math.sin(T*0.05+1.3)*0.007*drift;
  rig.updateMatrixWorld(); camera.updateMatrixWorld();
  pick();
  // cursor light glides to the pointer's position in the structure
  if(ptr.inside&&mode!=='intro'){
    _ndc.set(ptr.sx/stageRect.width*2-1,-(ptr.sy/stageRect.height*2-1)); _ray.setFromCamera(_ndc,camera);
    if(_ray.ray.intersectPlane(_plane,_lp)){ cursorLight.position.lerp(_lp,1-Math.exp(-dt*10)); }
    cursorLight.intensity=damp(cursorLight.intensity,1.6*Math.PI*2,4,dt);
  } else cursorLight.intensity=damp(cursorLight.intensity,0,3,dt);
  // The loop: hold assembled, explode, hold exploded, contract
  if(!REDUCED&&!STILL){
    if(mode==='assembled'){
      if(T>nextScan){ scan(); nextScan=T+9+rnd()*7; }
      if(T-modeT>HOLD) explode(CEN.clone());
    } else if(mode==='exploded'&&T-modeT>HOLD) reassemble(CEN.clone());
  }
  physics(dt);
  writeState();
  if(marker){
    if(snapPos.on){ snapPos.x=damp(snapPos.x,snapPos.tx,20,dt); snapPos.y=damp(snapPos.y,snapPos.ty,20,dt);
      marker.style.left=`${snapPos.x/stageRect.width*100}%`; marker.style.top=`${snapPos.y/stageRect.height*100}%`; marker.dataset.k=snapPos.k; }
    marker.classList.toggle('on',snapPos.on&&FINE&&!ptr.touch);
  }
}

function dispose(){
  cancelAnimationFrame(raf);
  window.removeEventListener('pointermove',onMove);
  document.removeEventListener('pointerleave',onLeave);
  window.removeEventListener('blur',onLeave);
  scene.traverse(o=>{ o.geometry?.dispose(); o.material?.dispose(); });
  [sTex,rtScene,...rB.flat(),brightMat,downMat,blurMat,compMat,fsGeo,envRT].forEach(d=>d.dispose());
  renderer.dispose();
  renderer.forceContextLoss();
}

// let the first frame compile shaders before the intro clock starts
let raf=0;
writeState(); render();
if(STILL){
  startIntro();
  for(let i=0;i<90;i++) step(1/60);
  render();
  return {dispose};
}

/* adaptive resolution: step down once if frames run long. The slide is scaled with a
   transform, which a ResizeObserver doesn't see, so the size is checked every frame */
let ftAcc=0, ftN=0, last=performance.now();
function tick(){
  raf=requestAnimationFrame(tick);
  const r=canvas.getBoundingClientRect();
  if(Math.abs(r.width-stageRect.width)>1||Math.abs(r.height-stageRect.height)>1) resize(); else stageRect=r;
  const now=performance.now(); let dt=(now-last)/1000; last=now;
  if(!(dt>0)) dt=1/60; dt=Math.min(dt,1/20);
  step(dt); render();
  ftAcc+=dt; ftN++;
  if(ftN>=120){ const avg=ftAcc/ftN; ftAcc=0; ftN=0; if(avg>0.024&&renderScale>0.62){ renderScale-=0.15; resize(); } }
}
raf=requestAnimationFrame(()=>{ raf=requestAnimationFrame(()=>{ startIntro(); last=performance.now(); raf=requestAnimationFrame(tick); }); });
return {dispose};
}
