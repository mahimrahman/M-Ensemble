/**
 * Cuts the app's logo assets out of the master logo.png.
 *
 * The master is a 2000x2000 paletted PNG that is mostly empty canvas, with the
 * lockup sitting in a 1343x337 band. This trims to that band, drops the white
 * ground to transparency, and writes a second pair recoloured for the dark teal
 * gradient the auth screens and mastheads use.
 *
 *   node scripts/build-logo-assets.js
 *
 * Re-run it if logo.png is ever replaced. No dependencies - the PNG decode and
 * encode are inline, since the pipeline is one paletted image in, four RGBA out.
 */

const fs=require('fs'),zlib=require('zlib');
const b=fs.readFileSync('E:/M-Ensemble/logo.png');
let p=8,w=0,h=0,pal=null,trns=null,idat=[];
while(p<b.length){const len=b.readUInt32BE(p);const t=b.toString('ascii',p+4,p+8);const d=b.slice(p+8,p+8+len);
 if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);}
 if(t==='PLTE')pal=d; if(t==='tRNS')trns=d; if(t==='IDAT')idat.push(d); p+=12+len;}
const raw=zlib.inflateSync(Buffer.concat(idat));
const stride=w, idx=Buffer.alloc(w*h);
let prev=Buffer.alloc(stride);
for(let y=0;y<h;y++){
 const ft=raw[y*(stride+1)];const line=raw.slice(y*(stride+1)+1,(y+1)*(stride+1));
 const cur=Buffer.alloc(stride);
 for(let x=0;x<stride;x++){const a=x>=1?cur[x-1]:0,bb=prev[x],c=x>=1?prev[x-1]:0;let v=line[x];
  if(ft===1)v+=a;else if(ft===2)v+=bb;else if(ft===3)v+=(a+bb)>>1;
  else if(ft===4){const pp=a+bb-c,pa=Math.abs(pp-a),pb=Math.abs(pp-bb),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?bb:c);}
  cur[x]=v&255;}
 cur.copy(idx,y*stride);prev=cur;}

function crc32(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}
 let x=0xFFFFFFFF;for(const v of buf)x=t[(x^v)&255]^(x>>>8);return (x^0xFFFFFFFF)>>>0;}
function chunk(type,data){const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const td=Buffer.concat([Buffer.from(type,'ascii'),data]);const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td));
 return Buffer.concat([len,td,cr]);}
function writePNG(path,W,H,rgba){
 const r=Buffer.alloc(H*(W*4+1));
 for(let y=0;y<H;y++){r[y*(W*4+1)]=0;rgba.copy(r,y*(W*4+1)+1,y*W*4,(y+1)*W*4);}
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
 fs.writeFileSync(path,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(r,{level:9})),chunk('IEND',Buffer.alloc(0))]));
 console.log(path.split('/').pop(),W+'x'+H,Math.round(fs.statSync(path).size/1024)+'kb');}

function px(i){
 const a=trns&&i<trns.length?trns[i]:255;
 if(a<8) return [0,0,0,0];
 const r=pal[i*3],g=pal[i*3+1],bl=pal[i*3+2];
 if(Math.min(r,g,bl)>250) return [0,0,0,0];   // white canvas -> transparent
 return [r,g,bl,a];
}
/**
 * The four inks in the lockup, remapped for a dark ground:
 *   #000000 crescent      -> white          (the outline must hold the shape)
 *   #383838 grey figure   -> pale neutral   (stays a separate silhouette)
 *   #356057 slate figure  -> teal.200
 *   #0C6358 brand teal    -> teal.300       (the on-dark accent)
 *   #F3952F orange        -> unchanged, it already carries on dark
 */
function onDark(r,g,bl){
 // Nearest-of-four match, so antialiased pixels land on the right ink and the
 // ordering of the tests stops mattering.
 const SRC=[[0,0,0],[56,56,56],[53,96,87],[12,99,88],[243,149,47]];
 const DST=[[255,255,255],[176,199,196],[144,197,190],[223,244,241],[243,149,47]];
 let best=0,bd=Infinity;
 for(let i=0;i<SRC.length;i++){
  const d=(r-SRC[i][0])**2+(g-SRC[i][1])**2+(bl-SRC[i][2])**2;
  if(d<bd){bd=d;best=i;}}
 return DST[best];
}
function crop(x0,y0,x1,y1,recolor){
 const W=x1-x0+1,H=y1-y0+1,o=Buffer.alloc(W*H*4);
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  let [r,g,bl,a]=px(idx[(y+y0)*w+(x+x0)]);
  if(recolor&&a>0)[r,g,bl]=recolor(r,g,bl);
  const k=(y*W+x)*4;o[k]=r;o[k+1]=g;o[k+2]=bl;o[k+3]=a;}
 return {W,H,o};}

const OUT='E:/M-Ensemble/apps/mobile/assets/';
const LOCKUP=[218,829,1560,1165], MARK=[218,829,566,1165];
let c;
c=crop(...LOCKUP);             writePNG(OUT+'logo.png',c.W,c.H,c.o);
c=crop(...MARK);               writePNG(OUT+'logo-mark.png',c.W,c.H,c.o);
c=crop(...LOCKUP,onDark);      writePNG(OUT+'logo-on-dark.png',c.W,c.H,c.o);
c=crop(...MARK,onDark);        writePNG(OUT+'logo-mark-on-dark.png',c.W,c.H,c.o);
