// Três cliques em Fazer pedido levam ao login administrativo, sem substituir a autenticação real.
// Não definir senha no frontend: a API de login usa Supabase para autenticar o proprietário.
const links=document.querySelectorAll('.header-buy, .concept-link-top');
let count=0,last=0;
function shortcutAdmin(event){
  const now=Date.now();
  count=now-last<=1200?count+1:1;
  last=now;
  if(count!==3)return;
  count=0;
  event.preventDefault();
  event.stopImmediatePropagation();
  window.location.assign('/admin.html');
}
links.forEach(a=>a.addEventListener('click',shortcutAdmin,true));
