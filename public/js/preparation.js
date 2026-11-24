import {catalogCategory,isDoseProduct} from './shared.js?v=20261124-auth';
export function preparationSummary(orders){
 const pending=orders.filter(o=>['received','preparing'].includes(o.status)).sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at)||Number(a.order_no)-Number(b.order_no));
 const groups=new Map();let itemCount=0;
 for(const o of pending)for(const item of o.order_items||[]){
  const quantity=Number(item.quantity);if(!Number.isSafeInteger(quantity)||quantity<=0)continue;
  const name=String(item.product_name||'Produto sem identificação'),category=catalogCategory({category:item.category})||'';
  const prep=isDoseProduct({category:item.category})||['Batidas','Caipirinhas'].includes(category)||Boolean(item.ice_option_id||item.energy_option_id)||/ \| (?:Com álcool|Sem álcool|Gelo:)/.test(name);
  const section=prep?'prepare':category?'separate':'review',key=JSON.stringify([section,item.product_id||'',name,item.ice_option_id||'',item.energy_option_id||'']);
  let g=groups.get(key);if(!g){g={name,category,section,quantity:0,orders:[]};groups.set(key,g);}
  g.quantity+=quantity;itemCount+=quantity;const prev=g.orders.find(x=>x.id===o.id);
  if(prev)prev.quantity+=quantity;else g.orders.push({id:o.id,number:o.order_no,name:[o.first_name,o.last_name].filter(Boolean).join(' '),status:o.status,quantity});
 }
 const sections={prepare:[],separate:[],review:[]};for(const g of groups.values())sections[g.section].push(g);
 for(const rows of Object.values(sections))rows.sort((a,b)=>b.quantity-a.quantity||a.name.localeCompare(b.name,'pt-BR'));
 return {orderCount:pending.length,itemCount,sections};
}
