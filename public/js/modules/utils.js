export const formatNaira = amount => new Intl.NumberFormat("en-NG",{style:"currency",currency:"NGN",maximumFractionDigits:0}).format(Number(amount)||0);
export const escapeText = value => String(value ?? "");
export async function api(path, options={}) {
  const response = await fetch(`${window.AMADEE_API_URL || "/api"}${path}`, {
    credentials:"include", headers:{"Content-Type":"application/json",...(options.headers||{})}, ...options
  });
  const data = await response.json().catch(()=>({message:"Unexpected server response"}));
  if(!response.ok) throw new Error(data.message || "Request failed");
  return data;
}
export const byId = id => document.getElementById(id);
export const safeText = (tag,text,className) => { const node=document.createElement(tag); node.textContent=String(text??""); if(className) node.className=className; return node; };
