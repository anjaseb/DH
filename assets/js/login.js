import {supabase} from './supabase.js';
const f=document.querySelector('#login'),m=document.querySelector('#msg');
f.onsubmit=async e=>{e.preventDefault();m.className='notice';m.textContent='A entrar...';const {error}=await supabase.auth.signInWithPassword({email:f.email.value.trim(),password:f.password.value});if(error){m.className='notice error';m.textContent=error.message;return}location.href='dashboard.html'};
