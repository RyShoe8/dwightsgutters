// Only crop/recolor the supplied pixels; never redraw or regenerate the logo.
const sharp=require('C:/Users/rysho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const fs=require('fs');const path=require('path');const root=path.resolve(__dirname,'..');
(async()=>{
 const original=path.join(__dirname,'approved-logo-orange.png');
 const dir=path.join(__dirname,'derived');fs.mkdirSync(dir,{recursive:true});
 const regions={primary:{left:60,top:95,width:1940,height:580},mark:{left:60,top:95,width:590,height:580},wordmark:{left:660,top:130,width:1340,height:460},descriptor:{left:680,top:600,width:1300,height:75}};
 for(const [name,region] of Object.entries(regions)){
  const {data,info}=await sharp(original).extract(region).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  for(const mode of ['color','navy','white']){
   const pixels=Buffer.from(data);
   if(mode!=='color'){const color=mode==='white'?[255,255,255]:[20,45,78];for(let i=0;i<pixels.length;i+=4){pixels[i]=color[0];pixels[i+1]=color[1];pixels[i+2]=color[2];}}
   await sharp(pixels,{raw:{width:info.width,height:info.height,channels:4}}).png().toFile(path.join(dir,`${name}-${mode}.png`));
  }
 }
 console.log('Cropped approved pixels and made alpha-preserving color variants.');
})();
