import {photoStatusFor} from './shared.js?v=20261124-auth';
export function managementMetrics(products,options,orders,threshold){
 const out=p=>!p.unlimited&&!(p.stock>0);
 const ready=o=>Boolean(o.active&&(o.unlimited||o.stock>0));
 return {pending:orders.filter(o=>!['delivered','cancelled'].includes(o.status)).length,received:orders.filter(o=>o.status==='received').length,active:products.filter(p=>p.active).length,low:products.filter(p=>p.active&&!p.unlimited&&p.stock>0&&p.stock<=threshold).length,unpriced:products.filter(p=>!p.price_cents).length,out:products.filter(out).length,paused:products.filter(p=>!p.active).length,noPhoto:products.filter(p=>photoStatusFor(p)==='pending').length,options:options.filter(ready).length,optionsBlocked:options.filter(o=>!ready(o)).length};
}
