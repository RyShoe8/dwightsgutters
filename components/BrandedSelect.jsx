 'use client';
import {useEffect,useId,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
// Keep the native field for form submission and validation; present choices in our dialog.
export default function BrandedSelect({children,onChange,value,defaultValue,disabled,...props}) {
 const field=useRef(null),trigger=useRef(null),dialog=useRef(null),id=useId();
 const [open,setOpen]=useState(false),[label,setLabel]=useState('Choose an option'),[options,setOptions]=useState([]),[selected,setSelected]=useState(''),[invalid,setInvalid]=useState(false);
 useEffect(()=>{
  const select=field.current;
  setOptions(Array.from(select.options,o=>({value:o.value,label:o.text,disabled:o.disabled})));
  setSelected(select.value);
  const parent=trigger.current.closest('label');
  if(parent)setLabel(Array.from(parent.childNodes).filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()||'Choose an option');
 },[children,value,defaultValue]);
 useEffect(()=>{
  if(!open)return;
  const modal=dialog.current;modal.showModal();
  const original=document.body.style.overflow;document.body.style.overflow='hidden';
  (modal.querySelector('[aria-checked="true"]')||modal.querySelector('.choice-option:not(:disabled)')||modal.querySelector('button')).focus();
  return ()=>{modal.close();document.body.style.overflow=original;trigger.current?.focus();};
 },[open]);
 const pick=option=>{
  const select=field.current;select.value=option.value;
  select.dispatchEvent(new Event('change',{bubbles:true}));
  setSelected(select.value);setInvalid(false);setOpen(false);
 };
 function keyboard(e){
  const buttons=Array.from(dialog.current.querySelectorAll('.choice-option:not(:disabled)'));
  const index=buttons.indexOf(document.activeElement);
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
   e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;buttons[next]?.focus();
  }
 }
 return <span className="branded-select">
  <button ref={trigger} type="button" className="select-trigger" disabled={disabled} aria-label={`${label}: ${options.find(o=>o.value===selected)?.label||'Choose an option'}`} aria-haspopup="dialog" aria-expanded={open} aria-controls={id} aria-invalid={invalid||undefined} onClick={()=>setOpen(true)}><span>{options.find(o=>o.value===selected)?.label||'Choose an option'}</span><span aria-hidden="true">⌄</span></button>
  <select {...props} ref={field} className="select-native" tabIndex={-1} aria-hidden="true" disabled={disabled} value={value} defaultValue={defaultValue} onInvalid={e=>{e.preventDefault();setInvalid(true);setOpen(true);}} onChange={e=>{setSelected(e.target.value);onChange?.(e);}}>{children}</select>
  {open&&createPortal(<dialog ref={dialog} id={id} className="brand-dialog choice-dialog" aria-labelledby={`${id}-title`} onCancel={e=>{e.preventDefault();setOpen(false);}} onClick={e=>{if(e.target===e.currentTarget)setOpen(false);}} onKeyDown={keyboard}><div className="brand-dialog-head"><div><p className="eyebrow">DWIGHT’S GUTTERS</p><h2 id={`${id}-title`}>{label}</h2></div><button type="button" className="dialog-close" aria-label="Close choices" onClick={()=>setOpen(false)}>×</button></div>{invalid&&<p className="notice" role="alert">Please choose an option to continue.</p>}<div className="choice-options" role="radiogroup" aria-label={label}>{options.map((o,i)=><button key={o.value+i} type="button" className="choice-option" role="radio" aria-checked={selected===o.value} disabled={o.disabled} onClick={()=>pick(o)}><span>{o.label}</span><span className="choice-check" aria-hidden="true">{selected===o.value?'✓':''}</span></button>)}</div><p className="choice-hint">Select an option to continue.</p></dialog>,document.body)}
 </span>;
}
