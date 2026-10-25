// Recolor only the bright blue accent; retain original geometry, navy and alpha.
const sharp = require('C:/Users/rysho/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const path = require('node:path');
async function recolor(input, output) {
 const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(let i=0;i<data.length;i+=4){const [r,g,b]=[data[i],data[i+1],data[i+2]];
  if(b>100 && b>r*1.5 && (g>70 || b>150)){const shade=Math.min(1.06,b/205); data[i]=Math.min(255,Math.round(244*shade));data[i+1]=Math.min(255,Math.round(119*shade));data[i+2]=Math.round(33*shade);}
 }
 const result=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
 await require('node:fs/promises').writeFile(output,result);
}
(async()=>{
 await recolor(path.join(__dirname,'approved-logo.png'),path.join(__dirname,'approved-logo-orange.png'));
 console.log('Orange master created; original alpha and geometry retained.');
})();
