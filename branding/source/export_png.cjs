const fs=require('fs');
const path=require('path');
const sharp=require('C:/Users/rysho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
 const assets=JSON.parse(fs.readFileSync(path.join(__dirname,'exports.json')));
 for(const a of assets){
  const input=path.join(root,a.svg),out=path.join(root,a.png);
  await sharp(input,{density:300}).resize({width:a.width}).png().withMetadata({density:a.svg.includes('business-card')?600:300}).toFile(out);
  const meta=await sharp(out).metadata();
  a.pixels=[meta.width,meta.height]; a.alpha=meta.hasAlpha;
 }
 for(const size of [16,32,48,180,192,512]){
  await sharp(path.join(root,'web/favicon.svg'),{density:600}).resize(size,size).png().toFile(path.join(root,`web/icon-${size}.png`));
 }
 fs.writeFileSync(path.join(root,'asset-manifest.json'),JSON.stringify(assets,null,2));
 console.log(`Rendered ${assets.length} PNG assets and six web icons.`);
})();
