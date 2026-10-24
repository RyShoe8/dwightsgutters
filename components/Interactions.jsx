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
return ()=>controller.abort();
},[]);return null;}
