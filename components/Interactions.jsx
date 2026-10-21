"use client";
import {useEffect} from "react";
export default function Interactions(){useEffect(()=>{
const controller=new AbortController();
const on=(el,event,handler)=>el?.addEventListener(event,handler,{signal:controller.signal});
document.querySelectorAll('#main-nav a').forEach(a=>{if(new URL(a.href).pathname===location.pathname)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')});
const menu=document.querySelector('.menu-toggle');
on(menu,'click',()=>{const expanded=menu.getAttribute('aria-expanded')==='true';menu.setAttribute('aria-expanded',String(!expanded));document.querySelector('#main-nav').classList.toggle('open',!expanded)});
on(document,'keydown',e=>{if(e.key==='Escape'&&menu?.getAttribute('aria-expanded')==='true'){menu.click();menu.focus()}});
const search=document.querySelector('#city-search');
on(search,'input',()=>{const query=search.value.trim().toLowerCase();let count=0;document.querySelectorAll('.zone').forEach(el=>{const match=el.dataset.cities.includes(query);el.hidden=!match;if(match)count++});document.querySelector('#no-cities').hidden=count>0;document.querySelector('#city-results').textContent=`${count} matching service-area sections`;});
const form=document.querySelector('#booking-form');
if(form){
 let step=1;const panels=[...form.querySelectorAll('fieldset')];
 const date=form.elements.date;const today=new Date();date.min=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
 const params=new URLSearchParams(location.search);if([...form.elements.service.options].some(o=>o.value===params.get('service')))form.elements.service.value=params.get('service');
 const cities={austin:'Austin',north:'Round Rock',northwest:'Cedar Park',west:'Lakeway',south:'Buda'};if(cities[params.get('area')])form.elements.city.value=cities[params.get('area')];
 function valid(){for(const el of panels[step-1].querySelectorAll('input,select,textarea')){if(!el.reportValidity())return false}if(step===1&&form.elements.contact.value==='Phone'&&!form.elements.phone.value.trim()){form.elements.phone.setCustomValidity('Please enter a phone number or choose email.');form.elements.phone.reportValidity();return false}return true}
 on(form.elements.phone,'input',()=>form.elements.phone.setCustomValidity(''));on(form.elements.contact,'change',()=>form.elements.phone.setCustomValidity(''));
 function show(n){step=n;panels.forEach((p,i)=>p.hidden=i!==n-1);document.querySelectorAll('[data-step-label]').forEach(el=>el.classList.toggle('active',Number(el.dataset.stepLabel)===n));if(n===3){const summary=document.querySelector('#request-summary');summary.replaceChildren();const fields=[['Name','name'],['Email','email'],['Phone','phone'],['Contact by','contact'],['Address','address'],['City','city'],['ZIP','zip'],['Stories','stories'],['Service','service'],['Guards','guards'],['Date','date'],['Notes','notes']];for(const [label,name] of fields){const row=document.createElement('div');row.className='summary-row';const key=document.createElement('span');key.textContent=label;const value=document.createElement('span');value.textContent=form.elements[name].value||'Not provided';row.append(key,value);summary.append(row)}}const legend=panels[n-1].querySelector('legend');legend.tabIndex=-1;legend.focus({preventScroll:true});}
 form.querySelectorAll('.next').forEach(b=>on(b,'click',()=>{if(valid())show(step+1)}));form.querySelectorAll('.back').forEach(b=>on(b,'click',()=>show(step-1)));
 form.noValidate=true;on(form,'submit',e=>{e.preventDefault();if(step<3){if(valid())show(step+1);return}if(!valid())return;panels.forEach(p=>p.hidden=true);const success=document.querySelector('#booking-success');success.hidden=false;success.focus();form.reset();document.querySelector('#request-summary').replaceChildren()});
 on(document.querySelector('#reset-booking'),'click',()=>{document.querySelector('#booking-success').hidden=true;form.reset();show(1)});
}

return ()=>controller.abort();
},[]);return null;}
