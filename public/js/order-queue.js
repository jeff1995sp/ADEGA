export const arrival=(a,b)=>(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||Number(a.order_no??a.number)-Number(b.order_no??b.number)||String(a.id).localeCompare(String(b.id));
export const orderedQueue=orders=>orders.filter(o=>['received','preparing','ready'].includes(o.status)).slice().sort(arrival);
export const nextOrder=rows=>rows.find(o=>o.status==='received'||o.status==='preparing')||rows[0]||null;
export const normalizeSearch=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
export function queueSearch(rows,filter,query){const q=normalizeSearch(query);return rows.filter(o=>(filter==='all'||(filter==='quick'?isQuickOrder(o):o.status===filter))&&(!q||normalizeSearch(String(o.order_no??o.number).padStart(3,'0')+' '+o.first_name+' '+o.last_name).includes(q)));}
export function needsPreparation(o){const items=o.order_items||[];return !items.length||items.some(i=>!i.category||['Doses','Whisky','Vodka','Gin','Batidas','Caipirinhas'].includes(i.category)||i.ice_option_id||i.energy_option_id||/\|\s*(?:Gelo:|Com álcool|Sem álcool)/i.test(i.product_name||''));}
export function tvQueue(orders){return {working:orderedQueue(orders).filter(o=>o.status!=='ready'),ready:orders.filter(o=>o.status==='ready').slice().sort((a,b)=>(Date.parse(a.ready_at)||0)-(Date.parse(b.ready_at)||0)||arrival(a,b))};}
export function stablePage(rows,previous=[],rotate=false,limit=6){
 const ids=rows.map(o=>o.id),valid=new Set(ids);if(!ids.length)return [];
 if(ids.length<=limit)return ids;
 const kept=previous.filter(id=>valid.has(id));
 if(rotate&&kept.length){const index=ids.indexOf(kept.at(-1));return Array.from({length:Math.min(limit,ids.length)},(_,i)=>ids[(index+1+i)%ids.length]);}
 return [...kept,...ids.filter(id=>!kept.includes(id))].slice(0,limit);
}
export const orderVoiceKey=o=>o.id+':'+o.status+(o.status==='ready'?':'+(o.ready_at||''):'');

export const isQuickOrder=o=>['received','preparing'].includes(o.status)&&!needsPreparation(o);
