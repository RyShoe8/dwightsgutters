 'use client';
import {useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
function ConfirmDialog({message,finish}){
 const dialog=useRef(null),cancel=useRef(null);
 useEffect(()=>{const previous=document.activeElement;const overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current.showModal();cancel.current.focus();return ()=>{document.body.style.overflow=overflow;previous?.focus();};},[]);
 return <dialog ref={dialog} className="brand-dialog confirm-dialog" aria-labelledby="confirmation-title" onCancel={e=>{e.preventDefault();finish(false);}}><div className="brand-dialog-head"><div><p className="eyebrow">DWIGHT’S GUTTERS</p><h2 id="confirmation-title">Please confirm</h2></div><button type="button" className="dialog-close" aria-label="Close confirmation" onClick={()=>finish(false)}>×</button></div><p className="confirmation-message">{message}</p><div className="dialog-actions"><button ref={cancel} type="button" className="dialog-secondary" onClick={()=>finish(false)}>Go back</button><button type="button" className="button" onClick={()=>finish(true)}>Confirm</button></div></dialog>;
}
export function confirmAction(message){
 return new Promise(resolve=>{const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);let done=false;const finish=value=>{if(done)return;done=true;root.unmount();host.remove();resolve(value);};root.render(<ConfirmDialog message={message} finish={finish}/>);});
}
