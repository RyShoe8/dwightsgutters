from pathlib import Path
from html.parser import HTMLParser
import re,json,shutil
root=Path(__file__).parent
old=Path(r'D:\Dwights Gutters\website-mockups\dist')
(root/'app').mkdir(exist_ok=True);(root/'components').mkdir(exist_ok=True);(root/'public'/'assets').mkdir(parents=True,exist_ok=True)
routes={'index.html':'/','about.html':'/about/','services.html':'/services/','service-area.html':'/service-area/','book.html':'/book/','contact.html':'/contact/','terms.html':'/terms/'}
void={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
attrs={'class':'className','for':'htmlFor','tabindex':'tabIndex','autocomplete':'autoComplete','maxlength':'maxLength','fetchpriority':'fetchPriority','inputmode':'inputMode'}
class JSX(HTMLParser):
 def __init__(self):super().__init__(convert_charrefs=True);self.out=[]
 def handle_starttag(self,tag,aa):
  result=[]
  for k,v in aa:
   k=attrs.get(k,k)
   if k in ['href','src'] and v:
    for a,b in routes.items():
     if v.startswith(a):v=b+v[len(a):];break
    if v.startswith('assets/'):v='/'+v
   if k=='src' and v in ['/assets/logo.svg','/assets/logo-white.svg']:v=v.replace('.svg','.png')
   if k=='src' and v=='/assets/mark.svg':v='/assets/mark.png'
   if k=='value':k='defaultValue'
   result.append(k if v is None else f'{k}={json.dumps(v)}')
  self.out.append('<'+tag+(' '+' '.join(result) if result else '')+(' />' if tag in void else '>'))
 def handle_endtag(self,tag):
  if tag not in void:self.out.append('</'+tag+'>')
 def handle_data(self,data):self.out.append('{'+json.dumps(data)+'}')
def jsx(s):p=JSX();p.feed(s);return ''.join(p.out)
home=(old/'index.html').read_text(encoding='utf-8')
head=re.search(r'(<a class="skip".*?</header>)',home,re.S).group(1)
head=re.sub(r'aria-current="page" ','',head)
foot=re.search(r'(<footer>.*)</body>',home,re.S).group(1)
(root/'components'/'Header.jsx').write_text('export default function Header(){return <>'+jsx(head)+'</>;}',encoding='utf-8')
(root/'components'/'Footer.jsx').write_text('export default function Footer(){return <>'+jsx(foot)+'</>;}',encoding='utf-8')
for file,route in routes.items():
 s=(old/file).read_text(encoding='utf-8');body=re.search(r'<main id="main">(.*?)</main>',s,re.S).group(1)
 title=re.search(r'<title>(.*?)</title>',s).group(1);desc=re.search(r'<meta name="description" content="(.*?)">',s).group(1)
 folder=root/'app'/route.strip('/');folder.mkdir(parents=True,exist_ok=True)
 (folder/'page.jsx').write_text('export const metadata='+json.dumps({'title':title,'description':desc})+';\nexport default function Page(){return <main id="main">'+jsx(body)+'</main>;}',encoding='utf-8')
css=(old/'styles.css').read_text(encoding='utf-8')
css+='\n/* All logo placements use the supplied artwork, with its original proportions. */\n.brand img,.footer-brand img{height:auto;aspect-ratio:1940/580;object-fit:contain}.footer-brand img{width:230px}\n'
(root/'app'/'globals.css').write_text(css,encoding='utf-8')
script=(old/'app.js').read_text(encoding='utf-8')
# DOM enhancements are isolated to one client component; abort all listeners on cleanup.
script=script.replace("menu?.addEventListener('click',", "on(menu,'click',")
script=re.sub(r"([\w.]+|document\.querySelector\('#reset-booking'\))\.addEventListener\(",r'on(\1,',script)
script=script.replace("search?.addEventListener('input',", "on(search,'input',")
script="document.querySelectorAll('#main-nav a').forEach(a=>{if(new URL(a.href).pathname===location.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});\n"+script
(root/'components'/'Interactions.jsx').write_text('"use client";\nimport {useEffect} from "react";\nexport default function Interactions(){useEffect(()=>{\nconst controller=new AbortController();\nconst on=(el,event,handler)=>el?.addEventListener(event,handler,{signal:controller.signal});\n'+script+'\nreturn ()=>controller.abort();\n},[]);return null;}\n',encoding='utf-8')
for p in (old/'assets').iterdir():
 if p.name not in ['logo.svg','logo-white.svg','mark.svg','favicon.png']:shutil.copy2(p,root/'public'/'assets'/p.name)
(root/'public'/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
print('Migrated seven pages to native Next.js App Router JSX with shared header/footer and client interactions.')
