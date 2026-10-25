const sharp=require('C:/Users/rysho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs=require('fs');
(async()=>{
 fs.copyFileSync('branding/source/derived/primary-color.png','public/assets/logo.png');
 fs.copyFileSync('branding/source/derived/mark-color.png','public/assets/mark.png');
 fs.copyFileSync('branding/web/icon-32.png','public/assets/favicon.png');
 const logo=await sharp('public/assets/logo.png').resize({width:1000}).toBuffer();
 await sharp({create:{width:1200,height:630,channels:4,background:'#ffffff'}}).composite([{input:logo,gravity:'center'}]).png().toFile('public/assets/social-preview-white.png');
 const a=await sharp('branding/source/approved-logo.png').ensureAlpha().raw().toBuffer();
 const b=await sharp('branding/source/approved-logo-orange.png').ensureAlpha().raw().toBuffer();
 let changed=0;for(let i=0;i<a.length;i+=4){if(a[i+3]!==b[i+3])throw Error('Alpha changed');if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++;}
 console.log('Verified every alpha pixel unchanged; recolored pixels:',changed);
})();
