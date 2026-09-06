/**
 * Downscales apps/mobile/assets/posters/*.png to their 1200x675 display size.
 *
 * The masters in 'event posters/' are exported at 2x for print; bundling them
 * at that size cost 5.8MB for artwork the app never shows above 1200px wide.
 * Box-filtered, re-encoded without an alpha channel since every poster is
 * opaque.
 *
 *   cp 'event posters'/*.png apps/mobile/assets/posters/ && node scripts/build-poster-assets.js
 *
 * Idempotent only in the sense that re-running on already-shrunk files is a
 * no-op resize; re-copy the masters first if you need to redo it.
 *
 * **Three posters ship as JPEG and this script does not produce them.**
 * `quran-classes`, `self-defence` and `soccer` are photographs: as PNG they
 * were 2.6MB between them and are 262KB as JPEG, indistinguishable at the size
 * they render. This only reads `*.png`, so it leaves them alone - but if you
 * re-copy the masters it will write PNGs beside the JPEGs, while `Poster.tsx`
 * goes on requiring the JPEGs. After a full rebuild, re-convert those three
 * with any encoder at quality ~88 and delete the PNGs it made.
 */
const fs=require('fs'),zlib=require('zlib'),path=require('path');
function readPNG(p){const b=fs.readFileSync(p);let q=8,w=0,h=0,bd=0,ct=0,pal=null,trns=null,idat=[];
 while(q<b.length){const l=b.readUInt32BE(q),t=b.toString('ascii',q+4,q+8),d=b.slice(q+8,q+8+l);
  if(t==='IHDR'){w=d.readUInt32BE(0);h=d.readUInt32BE(4);bd=d[8];ct=d[9];}
  if(t==='PLTE')pal=d;if(t==='tRNS')trns=d;if(t==='IDAT')idat.push(d);q+=12+l;}
 if(bd!==8)throw new Error(p+': bit depth '+bd);
 const ch={0:1,2:3,3:1,4:2,6:4}[ct];if(!ch)throw new Error(p+': colour type '+ct);
 const raw=zlib.inflateSync(Buffer.concat(idat)),st=w*ch,px=Buffer.alloc(w*h*4);
 let pv=Buffer.alloc(st);
 for(let y=0;y<h;y++){const ft=raw[y*(st+1)],ln=raw.slice(y*(st+1)+1,(y+1)*(st+1)),cu=Buffer.alloc(st);
  for(let x=0;x<st;x++){const a=x>=ch?cu[x-ch]:0,bb=pv[x],c=x>=ch?pv[x-ch]:0;let v=ln[x];
   if(ft===1)v+=a;else if(ft===2)v+=bb;else if(ft===3)v+=(a+bb)>>1;
   else if(ft===4){const pp=a+bb-c,pa=Math.abs(pp-a),pb=Math.abs(pp-bb),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?bb:c);}
   cu[x]=v&255;}
  for(let x=0;x<w;x++){const s=x*ch,k=(y*w+x)*4;
   if(ct===3){const i=cu[s];px[k]=pal[i*3];px[k+1]=pal[i*3+1];px[k+2]=pal[i*3+2];px[k+3]=trns&&i<trns.length?trns[i]:255;}
   else if(ct===0){px[k]=px[k+1]=px[k+2]=cu[s];px[k+3]=255;}
   else if(ct===4){px[k]=px[k+1]=px[k+2]=cu[s];px[k+3]=cu[s+1];}
   else if(ct===2){px[k]=cu[s];px[k+1]=cu[s+1];px[k+2]=cu[s+2];px[k+3]=255;}
   else{px[k]=cu[s];px[k+1]=cu[s+1];px[k+2]=cu[s+2];px[k+3]=cu[s+3];}}
  pv=cu;}
 return {w,h,px};}
function crc32(buf){let c,t=[];for(let n=0;n<256;n++){c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c;}
 let x=0xFFFFFFFF;for(const v of buf)x=t[(x^v)&255]^(x>>>8);return (x^0xFFFFFFFF)>>>0;}
function chunk(ty,d){const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(ty,'ascii'),d]);
 const cr=Buffer.alloc(4);cr.writeUInt32BE(crc32(td));return Buffer.concat([l,td,cr]);}
function writeRGB(p,W,H,px){ // opaque posters -> colour type 2, no alpha channel
 const st=W*3,raw=Buffer.alloc(H*(st+1));
 for(let y=0;y<H;y++){raw[y*(st+1)]=0;
  for(let x=0;x<W;x++){const k=(y*W+x)*4,j=y*(st+1)+1+x*3;raw[j]=px[k];raw[j+1]=px[k+1];raw[j+2]=px[k+2];}}
 const ih=Buffer.alloc(13);ih.writeUInt32BE(W,0);ih.writeUInt32BE(H,4);ih[8]=8;ih[9]=2;
 fs.writeFileSync(p,Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR',ih),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]));}
function box(src,w,h,W,H){const o=Buffer.alloc(W*H*4),fx=w/W,fy=h/H;
 for(let y=0;y<H;y++)for(let x=0;x<W;x++){
  const x0=Math.floor(x*fx),x1=Math.min(w,Math.ceil((x+1)*fx)),y0=Math.floor(y*fy),y1=Math.min(h,Math.ceil((y+1)*fy));
  let r=0,g=0,b=0,a=0,n=0;
  for(let sy=y0;sy<y1;sy++)for(let sx=x0;sx<x1;sx++){const k=(sy*w+sx)*4;r+=src[k];g+=src[k+1];b+=src[k+2];a+=src[k+3];n++;}
  const k=(y*W+x)*4;o[k]=r/n;o[k+1]=g/n;o[k+2]=b/n;o[k+3]=a/n;}
 return o;}
const DIR='E:/M-Ensemble/apps/mobile/assets/posters/';
let before=0,after=0;
for(const f of fs.readdirSync(DIR).filter(f=>f.endsWith('.png'))){
 const p=DIR+f;before+=fs.statSync(p).size;
 const {w,h,px}=readPNG(p);const W=1200,H=Math.round(h*W/w);
 writeRGB(p,W,H,box(px,w,h,W,H));
 after+=fs.statSync(p).size;
 console.log(f.padEnd(22),w+'x'+h,'->',W+'x'+H,Math.round(fs.statSync(p).size/1024)+'kb');}
console.log('total',Math.round(before/1048576*10)/10+'MB ->',Math.round(after/1048576*10)/10+'MB');
