import {supabase} from './supabase.js';
export async function requireUser(){const {data:{user}}=await supabase.auth.getUser();if(!user){location.href='login.html';return null}return user}
export async function profile(user){const {data,error}=await supabase.from('profiles').select('*').eq('id',user.id).single();if(error)throw error;return data}
