export const API=import.meta.env.VITE_API_URL||'http://localhost:8000';
export async function api(path:string, options:RequestInit={}){const token=localStorage.getItem('token'); const r=await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{}) ,...(options.headers||{})}}); if(!r.ok) throw new Error(await r.text()); return r.json()}
