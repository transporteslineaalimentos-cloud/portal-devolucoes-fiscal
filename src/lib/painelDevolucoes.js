/* Painel gerencial de devoluções em um único arquivo .html, que abre offline
   e continua interativo: mês a mês, área, motivo, canal, status e a lista das
   notas por trás de cada número. Nada sai daqui para a internet. */

export function gerarPainelDevolucoes({ dados, notas, periodo, ano, mesIni, mesFim, geradoPor }) {
  const enxuto = (notas || []).map((n) => ({
    nf: n.nf_numero, nfv: n.chave_nfe_referenciada ? String(parseInt(String(n.chave_nfe_referenciada).slice(25, 34), 10) || '') : '',
    d: String(n.dt_ref || n.dt_devolucao || n.dt_emissao || '').slice(0, 10),
    cl: n.nome_emitente || '—', uf: n.uf_emitente || '—',
    v: Math.round((Number(n.valor) || 0) * 100) / 100,
    t: n.devolucao_total ? 1 : 0,
    mo: n.motivo_devolucao || 'Sem motivo', ar: n.area_responsavel || 'Sem área',
    ca: n.centro_custo || 'Sem centro de custo', st: n.status_operacional || '',
    tr: n.transportador_cobranca || '—', lp: n.lancado_protheus ? 1 : 0, cd: n.retornou_cd ? 1 : 0,
    ve: n.vendedor || 'SEM VENDEDOR NO CADASTRO',
  }));
  // faturamento por vendedor e mês, para o índice (devolvido ÷ faturado)
  const vendFat = (dados?.vendedor || []).filter(v => Number(v.fat)).map(v => [v.nome, Number(v.mes), Math.round(Number(v.fat))]);

  const payload = {
    periodo, ano, mesIni, mesFim, geradoEm: new Date().toISOString(), geradoPor: geradoPor || '',
    meses: dados?.meses || [], area: dados?.area || [], motivo: dados?.motivo || [],
    canal: dados?.canal || [], status: dados?.status || [], pendente: dados?.pendente_transp || [],
    vendFat, notas: enxuto,
  };

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Devoluções · Linea Alimentos · ${String(periodo).replace(/[<>&]/g, '')}</title>
<style>${CSS}</style>
</head><body>
<div id="app"></div>
<script id="dados" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
<script>${JS}</script>
</body></html>`;
}

const CSS = `
:root{
  --bg:#F0F2F5;--surface:#fff;--surface-2:#F7F8FA;--surface-3:#EEF0F3;--border:#E2E6EC;
  --text:#0F1923;--text-2:#45515E;--text-3:#7A8694;--parcial:#1E4DB7;--total:#D9822B;
  --dim:rgba(30,77,183,.08);--shadow:0 1px 2px rgba(15,25,35,.06),0 1px 3px rgba(15,25,35,.04);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);
  font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.wrap{max-width:1600px;margin:0 auto;padding:20px 24px 48px;display:flex;flex-direction:column;gap:16px}
@media(max-width:640px){.wrap{padding:16px}}
header.topo{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.marca{display:flex;align-items:center;gap:11px}
.marca .mk{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#1C2130,#2D3A52);
  display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.marca h1{margin:0;font-size:19px;font-weight:700;letter-spacing:-.02em}
.marca .sub{font-size:12px;color:var(--text-3)}
.btn{border:1px solid var(--border);background:var(--surface);color:var(--text-2);border-radius:8px;
  padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit}
.btn:hover{background:var(--surface-2);color:var(--text)}
.btn.on{background:var(--parcial);border-color:var(--parcial);color:#fff}
select{font-family:inherit;font-size:12.5px;height:32px;padding:0 9px;border:1px solid var(--border);
  border-radius:8px;background:var(--surface);color:var(--text)}
.filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--dim);color:var(--parcial);
  border:none;border-radius:99px;padding:4px 11px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit}
.kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}
@media(max-width:1240px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:640px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:14px 16px;box-shadow:var(--shadow);min-width:0}
.kpi.forte{background:linear-gradient(145deg,#1C2130,#272F44);border-color:transparent}
.kpi .lb{font-size:11.5px;color:var(--text-2);display:flex;align-items:center;gap:6px}
.kpi.forte .lb{color:rgba(255,255,255,.65)}
.kpi .vl{font-size:22px;font-weight:700;margin-top:6px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi.forte .vl{color:#fff}
.kpi .nt{font-size:11px;color:var(--text-3);margin-top:3px}
.kpi.forte .nt{color:rgba(255,255,255,.5)}
.dot{width:8px;height:8px;border-radius:99px;flex:0 0 auto}
.card{background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow);overflow:hidden;min-width:0}
.card>h2{margin:0;padding:14px 18px 8px;font-size:14px;font-weight:700;letter-spacing:-.01em}
.card>.bd{padding:0 18px 16px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:16px}
.leg{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--text-2);padding:0 18px;margin-top:2px}
.leg span{display:inline-flex;align-items:center;gap:6px}
.leg i{width:10px;height:10px;border-radius:2px;display:inline-block}
table{width:100%;border-collapse:collapse}
th{padding:7px 8px;font-size:11px;font-weight:600;color:var(--text-3);text-align:right;white-space:nowrap;
  border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:1}
th.l,td.l{text-align:left}
td{padding:6px 8px;font-size:11.5px;text-align:right;white-space:nowrap;font-variant-numeric:tabular-nums;
  color:var(--text);border-top:1px solid var(--border)}
tbody tr:hover>td{background-image:linear-gradient(var(--dim),var(--dim))}
.fixa{position:sticky;left:0;background:var(--surface);z-index:2}
.clic{cursor:pointer}
.clic:hover{text-decoration:underline}
.barra{display:grid;grid-template-columns:minmax(120px,32%) minmax(0,1fr);gap:12px;align-items:center;
  padding:5px 4px;border-radius:7px;cursor:pointer}
.barra:hover{background:var(--surface-2)}
.barra.sel{background:var(--dim)}
.barra .nm{font-size:11.5px;color:var(--text-2);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.barra .num{font-size:11.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.tubo{height:14px;border-radius:0 3px 3px 0;flex:0 0 auto}
.rodape{font-size:11px;color:var(--text-3);text-align:center;padding-top:6px}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--border);border-radius:8px;
  box-shadow:0 4px 14px rgba(15,25,35,.14);padding:9px 11px;font-size:11.5px;font-variant-numeric:tabular-nums;z-index:50;min-width:190px}
.lin{display:flex;justify-content:space-between;gap:10px;color:var(--text-2);padding:1px 0;white-space:nowrap}
.lin b{color:var(--text)}
svg{display:block}
.rolagem{max-height:460px;overflow:auto}
@media print{body{background:#fff}.no-print{display:none}.card{break-inside:avoid;box-shadow:none}}
`;

const JS = String.raw`
(function(){
var D=JSON.parse(document.getElementById('dados').textContent);
var MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
var PARCIAL='var(--parcial)',TOTAL='var(--total)';
var f={mes:null,area:'',motivo:'',canal:'',status:'',uf:'',transp:'',vend:''};
var app=document.getElementById('app');

function brl(v){return 'R$ '+Math.round(Number(v)||0).toLocaleString('pt-BR');}
function brlK(v){var n=Number(v)||0;
  if(Math.abs(n)>=1e6)return 'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
  if(Math.abs(n)>=1e3)return 'R$ '+Math.round(n/1e3).toLocaleString('pt-BR')+' mil';
  return 'R$ '+Math.round(n).toLocaleString('pt-BR');}
function pct(a,b){return b?((a/b*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'):'—';}
function dataBR(s){return s?String(s).slice(0,10).split('-').reverse().join('/'):'—';}
function semAc(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function el(t,a,h){var e=document.createElement(t);if(a)for(var k in a){if(k==='cls')e.className=a[k];
  else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),a[k]);else e.setAttribute(k,a[k]);}if(h!=null)e.innerHTML=h;return e;}

function mesDaNota(n){var p=String(n.d).split('-');return p.length>1?parseInt(p[1],10):null;}
function ativos(){return D.notas.filter(function(n){
  if(f.mes&&mesDaNota(n)!==f.mes)return false;
  if(f.area&&n.ar!==f.area)return false;
  if(f.motivo&&n.mo!==f.motivo)return false;
  if(f.canal&&n.ca!==f.canal)return false;
  if(f.status&&n.st!==f.status)return false;
  if(f.uf&&n.uf!==f.uf)return false;
  if(f.transp&&n.tr!==f.transp)return false;
  if(f.vend&&n.ve!==f.vend)return false;
  return true;});}
function agrupa(l,k){var m={};l.forEach(function(n){var a=m[n[k]]||(m[n[k]]={v:0,q:0,p:0,t:0});
  a.v+=n.v;a.q++;a[n.t?'t':'p']+=n.v;});
  return Object.keys(m).map(function(k2){return {k:k2,v:m[k2].v,q:m[k2].q,p:m[k2].p,t:m[k2].t};}).sort(function(a,b){return b.v-a.v;});}

function chips(){var c=[];
  if(f.mes)c.push(['mes',MESES[f.mes-1]+'/'+String(D.ano).slice(2)]);
  if(f.area)c.push(['area',f.area]);
  if(f.motivo)c.push(['motivo',f.motivo]);
  if(f.canal)c.push(['canal',f.canal]);
  if(f.status)c.push(['status',f.status]);
  if(f.uf)c.push(['uf','UF '+f.uf]);
  if(f.transp)c.push(['transp',f.transp]);
  if(f.vend)c.push(['vend',f.vend]);
  return c;}

function render(){
  var l=ativos();
  var parc=l.filter(function(n){return !n.t;}),tot=l.filter(function(n){return n.t;});
  var somaP=parc.reduce(function(s,n){return s+n.v;},0),somaT=tot.reduce(function(s,n){return s+n.v;},0);
  var mesesSel=D.meses.filter(function(m){return m.mes>=D.mesIni&&m.mes<=D.mesFim&&(!f.mes||m.mes===f.mes);});
  var fat=mesesSel.reduce(function(s,m){return s+(Number(m.faturamento)||0);},0);

  app.innerHTML='';
  var w=el('div',{cls:'wrap'});

  var topo=el('header',{cls:'topo'});
  topo.appendChild(el('div',{cls:'marca'},
    '<div class="mk"><svg width="18" height="18" viewBox="0 0 22 22"><path d="M3 17V5h3l5 9 5-9h3v12h-2.5V9.5l-4.5 7.5h-3L5 9.5V17H3z" fill="#B8956A"/></svg></div>'+
    '<div><h1>Geração de retorno e devoluções</h1><div class="sub">Linea Alimentos · '+D.periodo+'</div></div>'));
  w.appendChild(topo);

  var fl=el('div',{cls:'filtros'});
  chips().forEach(function(c){fl.appendChild(el('button',{cls:'chip',onclick:function(){f[c[0]]=c[0]==='mes'?null:'';render();}},c[1]+' <span>×</span>'));});
  if(chips().length)fl.appendChild(el('button',{cls:'btn',onclick:function(){f={mes:null,area:'',motivo:'',canal:'',status:'',uf:'',transp:'',vend:''};render();}},'Limpar'));
  if(chips().length)w.appendChild(fl);

  var k=el('div',{cls:'kpis'});
  function kpi(lb,vl,nt,cor,forte){return el('div',{cls:'kpi'+(forte?' forte':'')},
    '<div class="lb">'+(cor?'<span class="dot" style="background:'+cor+'"></span>':'')+lb+'</div>'+
    '<div class="vl">'+vl+'</div>'+(nt?'<div class="nt">'+nt+'</div>':''));}
  k.appendChild(kpi('Devolução parcial',brlK(somaP),parc.length.toLocaleString('pt-BR')+' notas',PARCIAL));
  k.appendChild(kpi('Devolução total',brlK(somaT),tot.length.toLocaleString('pt-BR')+' notas',TOTAL));
  k.appendChild(kpi('Soma',brlK(somaP+somaT),l.length.toLocaleString('pt-BR')+' notas'));
  k.appendChild(kpi('% sobre o faturamento',pct(somaP+somaT,fat),'Faturamento '+brlK(fat),null,true));
  k.appendChild(kpi('Já lançadas no Protheus',l.filter(function(n){return n.lp;}).length.toLocaleString('pt-BR'),
    l.filter(function(n){return n.cd;}).length.toLocaleString('pt-BR')+' retornaram ao CD'));
  w.appendChild(k);

  w.appendChild(cardMensal());

  var g1=el('div',{cls:'grid2'});
  g1.appendChild(cardBarras('Abertura por área de responsabilidade',agrupa(l,'ar'),'area'));
  g1.appendChild(cardBarras('Abertura por canal',agrupa(l,'ca'),'canal'));
  w.appendChild(g1);

  w.appendChild(cardBarras('Abertura por motivo',agrupa(l,'mo').slice(0,15),'motivo'));

  w.appendChild(cardVendedor(l));

  var g2=el('div',{cls:'grid2'});
  g2.appendChild(cardBarras('Status operacional',agrupa(l.filter(function(n){return n.st;}),'st'),'status'));
  g2.appendChild(cardBarras('Por UF de origem',agrupa(l,'uf').slice(0,15),'uf'));
  w.appendChild(g2);

  w.appendChild(cardNotas(l));
  w.appendChild(el('div',{cls:'rodape'},'Gerado em '+new Date(D.geradoEm).toLocaleString('pt-BR')+
    (D.geradoPor?' por '+D.geradoPor:'')+' · Portal de Devoluções Fiscais · Linea Alimentos'));
  app.appendChild(w);
}

function cardMensal(){
  var c=el('div',{cls:'card'});
  c.appendChild(el('h2',null,'Mês a mês · clique em um mês para recortar o painel'));
  c.appendChild(el('div',{cls:'leg'},'<span><i style="background:'+PARCIAL+'"></i>Parcial</span><span><i style="background:'+TOTAL+'"></i>Total</span>'));
  var bd=el('div',{cls:'bd'});
  var m=D.meses.filter(function(x){return x.mes>=D.mesIni&&x.mes<=D.mesFim;});
  var W=Math.min(1500,Math.max(360,window.innerWidth-120)),H=260,pL=62,pR=12,pT=28,pB=30;
  var max=1;m.forEach(function(x){max=Math.max(max,(Number(x.parcial)||0)+(Number(x.total)||0));});
  var p=Math.pow(10,Math.floor(Math.log10(max)));var nice=Math.ceil(max/p)*p;
  var slot=(W-pL-pR)/Math.max(1,m.length),bw=Math.min(62,slot*.58);
  var X=function(i){return pL+slot*i+slot/2;},Y=function(v){return pT+(H-pT-pB)*(1-v/nice);};
  var s='<svg width="'+W+'" height="'+H+'">';
  [0,.25,.5,.75,1].forEach(function(t){var y=Y(t*nice);
    s+='<line x1="'+pL+'" x2="'+(W-pR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--surface-3)"/>'+
       '<text x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end" font-size="10.5" fill="var(--text-3)">'+brlK(t*nice).replace('R$ ','')+'</text>';});
  m.forEach(function(x,i){
    var pv=Number(x.parcial)||0,tv=Number(x.total)||0,soma=pv+tv,ff=Number(x.faturamento)||0;
    var yP=Y(pv),yT=Y(soma),sel=f.mes===x.mes,op=(f.mes&&!sel)?.35:1;
    s+='<g data-mes="'+x.mes+'" style="cursor:pointer" opacity="'+op+'">'+
       '<rect x="'+(X(i)-slot/2)+'" y="'+(pT-24)+'" width="'+slot+'" height="'+(H-pT-pB+24)+'" fill="'+(sel?'var(--dim)':'transparent')+'" rx="6"/>'+
       '<rect x="'+(X(i)-bw/2)+'" y="'+yP+'" width="'+bw+'" height="'+Math.max(0,Y(0)-yP)+'" fill="'+PARCIAL+'" rx="2"/>'+
       '<rect x="'+(X(i)-bw/2)+'" y="'+yT+'" width="'+bw+'" height="'+Math.max(0,yP-yT)+'" fill="'+TOTAL+'" rx="2"/>'+
       (soma>0&&ff?'<text x="'+X(i)+'" y="'+(yT-8)+'" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">'+pct(soma,ff)+'</text>':'')+
       '<text x="'+X(i)+'" y="'+(H-9)+'" text-anchor="middle" font-size="11" font-weight="'+(sel?700:400)+'" fill="'+(sel?'var(--text)':'var(--text-3)')+'">'+MESES[x.mes-1]+'</text></g>';});
  s+='</svg>';
  var box=el('div',{style:'position:relative;overflow-x:auto'},s);
  box.querySelectorAll('g[data-mes]').forEach(function(g){
    g.addEventListener('click',function(){var v=+g.dataset.mes;f.mes=(f.mes===v)?null:v;render();});
    g.addEventListener('mouseenter',function(e){
      var x=D.meses.filter(function(y){return y.mes==g.dataset.mes;})[0];if(!x)return;
      var pv=Number(x.parcial)||0,tv=Number(x.total)||0,ff=Number(x.faturamento)||0;
      tip(box,e,'<b>'+MESES[x.mes-1]+'/'+String(D.ano).slice(2)+'</b>'+
        lin('Parcial',brl(pv),pct(pv,ff),PARCIAL)+lin('Total',brl(tv),pct(tv,ff),TOTAL)+
        '<div style="border-top:1px solid var(--border);margin-top:5px;padding-top:5px">'+
        lin('Soma',brl(pv+tv),pct(pv+tv,ff))+lin('Faturamento',brlK(ff),'')+'</div>');});
    g.addEventListener('mouseleave',semTip);});
  bd.appendChild(box);
  bd.appendChild(tabelaMensal());
  c.appendChild(bd);return c;}

function lin(lb,v,p,cor){return '<div class="lin"><span>'+
  (cor?'<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+cor+';margin-right:5px"></i>':'')+lb+
  '</span><span><b>'+v+'</b>'+(p?' <span style="color:var(--text-3)">'+p+'</span>':'')+'</span></div>';}
function tip(box,e,html){semTip();var t=el('div',{cls:'tip'},html);document.body.appendChild(t);
  var r=box.getBoundingClientRect();
  t.style.left=Math.min(e.clientX+14,window.innerWidth-t.offsetWidth-12)+'px';
  t.style.top=(window.scrollY+Math.max(r.top+8,e.clientY-60))+'px';}
function semTip(){var t=document.querySelector('.tip');if(t)t.remove();}

function tabelaMensal(){
  var m=D.meses.filter(function(x){return x.mes>=D.mesIni&&x.mes<=D.mesFim;});
  var tp=0,tt=0,tf=0;
  var h='<thead><tr><th class="l fixa"></th>';
  m.forEach(function(x){h+='<th>'+MESES[x.mes-1]+'<span style="color:var(--text-3);font-weight:400">/'+String(D.ano).slice(2)+'</span></th>';});
  h+='<th style="border-left:1px solid var(--border);color:var(--text)">Período</th></tr></thead><tbody>';
  function linha(rot,fn,cor,forte){
    var soma=0,c='<tr><td class="l fixa" style="font-weight:600">'+
      (cor?'<span style="display:inline-block;width:8px;height:8px;border-radius:99px;background:'+cor+';margin-right:6px"></span>':'')+rot+'</td>';
    m.forEach(function(x){var v=fn(x);soma+=(typeof v==='number'?v:0);
      c+='<td'+(forte?' style="font-weight:600"':'')+'>'+(typeof v==='number'?brl(v):v)+'</td>';});
    c+='<td style="font-weight:700;border-left:1px solid var(--border)">'+brl(soma)+'</td></tr>';
    return {html:c,soma:soma};}
  var lp=linha('Parcial',function(x){return Number(x.parcial)||0;},PARCIAL);
  var lt=linha('Total',function(x){return Number(x.total)||0;},TOTAL);
  h+=lp.html+lt.html;
  tp=lp.soma;tt=lt.soma;
  m.forEach(function(x){tf+=Number(x.faturamento)||0;});
  h+='<tr><td class="l fixa" style="font-weight:700">Soma</td>';
  m.forEach(function(x){h+='<td style="font-weight:700">'+brl((Number(x.parcial)||0)+(Number(x.total)||0))+'</td>';});
  h+='<td style="font-weight:700;border-left:1px solid var(--border)">'+brl(tp+tt)+'</td></tr>';
  h+='<tr><td class="l fixa" style="font-weight:700">% sobre faturamento</td>';
  m.forEach(function(x){h+='<td style="font-weight:700">'+pct((Number(x.parcial)||0)+(Number(x.total)||0),Number(x.faturamento)||0)+'</td>';});
  h+='<td style="font-weight:700;border-left:1px solid var(--border)">'+pct(tp+tt,tf)+'</td></tr>';
  h+='<tr><td class="l fixa" style="color:var(--text-3)">Faturamento</td>';
  m.forEach(function(x){h+='<td style="color:var(--text-3)">'+(x.faturamento?brlK(x.faturamento):'—')+'</td>';});
  h+='<td style="color:var(--text-3);border-left:1px solid var(--border)">'+brlK(tf)+'</td></tr></tbody>';
  var t=el('table',{style:'margin-top:12px'},h);
  var d=el('div',{style:'overflow-x:auto'});d.appendChild(t);return d;}

function cardBarras(titulo,itens,campo){
  var c=el('div',{cls:'card'});
  c.appendChild(el('h2',null,titulo));
  c.appendChild(el('div',{cls:'leg'},'<span><i style="background:'+PARCIAL+'"></i>Parcial</span><span><i style="background:'+TOTAL+'"></i>Total</span>'));
  var bd=el('div',{cls:'bd'});
  var max=1;itens.forEach(function(i){max=Math.max(max,i.v);});
  var soma=itens.reduce(function(s,i){return s+i.v;},0);
  itens.forEach(function(i){
    var row=el('div',{cls:'barra'+(f[campo]===i.k?' sel':'')});
    row.addEventListener('click',function(){f[campo]=(f[campo]===i.k)?'':i.k;render();});
    row.appendChild(el('div',{cls:'nm',title:i.k},i.k));
    row.appendChild(el('div',null,'<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'+
      '<span class="tubo" style="display:flex;width:'+Math.max(2,(i.v/max)*52)+'%;overflow:hidden">'+
        '<i style="display:block;height:100%;width:'+(i.v?(i.p/i.v*100):0)+'%;background:'+PARCIAL+'"></i>'+
        '<i style="display:block;height:100%;flex:1;background:'+TOTAL+'"></i></span>'+
      '<span class="num"><b>'+brl(i.v)+'</b> <span style="color:var(--text-3)">· '+pct(i.v,soma)+' · '+i.q+' NF'+(i.q===1?'':'s')+'</span></span></div>'));
    bd.appendChild(row);});
  if(!itens.length)bd.appendChild(el('div',{style:'font-size:12px;color:var(--text-3);padding:8px 0'},'Nada neste recorte.'));
  c.appendChild(bd);return c;}

var vendModo='indice',vendTodos=false;
function cardVendedor(l){
  var c=el('div',{cls:'card'});
  c.appendChild(el('h2',null,'Devolução comercial por vendedor'));
  // só conta devolução com área responsável Comercial (o faturamento é o do vendedor inteiro)
  l=l.filter(function(n){return semAc(n.ar)==='comercial';});
  // o índice só faz sentido quando o recorte é de vendedor/mês: faturamento não se divide por área ou motivo
  var soMes=(!f.area||semAc(f.area)==='comercial')&&!f.motivo&&!f.canal&&!f.status&&!f.uf&&!f.transp;
  var fat={},fatG=0;
  (D.vendFat||[]).forEach(function(x){
    if(x[1]<D.mesIni||x[1]>D.mesFim||(f.mes&&x[1]!==f.mes))return;
    fat[x[0]]=(fat[x[0]]||0)+x[2];fatG+=x[2];});
  var g=agrupa(l,'ve').map(function(i){var fv=fat[i.k]||0;return {k:i.k,v:i.v,q:i.q,f:fv,ind:fv?i.v/fv:null};});
  var devG=g.reduce(function(s,i){return s+i.v;},0),media=fatG?devG/fatG:0;
  var modo=soMes?vendModo:'valor';
  var lista=g.filter(function(i){return i.k!=='SEM VENDEDOR NO CADASTRO';});
  if(modo==='indice')lista=lista.filter(function(i){return i.f>=50000;}).sort(function(a,b){return b.ind-a.ind;});
  else lista.sort(function(a,b){return b.v-a.v;});
  var vis=vendTodos?lista:lista.slice(0,15);

  var leg=el('div',{cls:'leg'});
  if(soMes){
    ['indice','valor'].forEach(function(m){
      var b=el('button',{cls:'btn',style:'height:24px;padding:0 9px;font-size:11px;'+(vendModo===m?'background:var(--text);color:#fff;border-color:var(--text)':''),
        onclick:function(){vendModo=m;render();}},m==='indice'?'% do faturado':'Valor devolvido');
      leg.appendChild(b);});
    leg.appendChild(el('span',null,'Só área Comercial · média: <b style="color:var(--text)">'+pct(devG,fatG)+'</b>'));
  }else leg.appendChild(el('span',null,'Só área Comercial. Com filtro de motivo, canal, status, UF ou transportador o índice não se aplica (o faturamento não se divide assim); mostrando o valor.'));
  c.appendChild(leg);

  var bd=el('div',{cls:'bd'});
  var max=0.000001;vis.forEach(function(i){max=Math.max(max,modo==='indice'?i.ind:i.v);});
  if(modo==='indice')max=Math.max(max,media);
  vis.forEach(function(i){
    var row=el('div',{cls:'barra'+(f.vend===i.k?' sel':'')});
    row.addEventListener('click',function(){f.vend=(f.vend===i.k)?'':i.k;render();});
    row.appendChild(el('div',{cls:'nm',title:i.k},i.k));
    var val=modo==='indice'?i.ind:i.v;
    var cor=(i.ind!=null&&i.ind>media)?'var(--total)':'var(--parcial)';
    var txt=modo==='indice'
      ?'<b>'+pct(i.v,i.f)+'</b> <span style="color:var(--text-3)">· '+brlK(i.v)+' de '+brlK(i.f)+'</span>'
      :'<b>'+brl(i.v)+'</b> <span style="color:var(--text-3)">· '+i.q+' NF'+(i.q===1?'':'s')+(soMes&&i.f?' · '+pct(i.v,i.f)+' do faturado':'')+'</span>';
    row.appendChild(el('div',null,'<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'+
      '<span class="tubo" style="display:block;width:'+Math.max(2,(val/max)*52)+'%;background:'+cor+'"></span>'+
      '<span class="num">'+txt+'</span></div>'));
    bd.appendChild(row);});
  if(!vis.length)bd.appendChild(el('div',{style:'font-size:12px;color:var(--text-3);padding:8px 0'},'Nada neste recorte.'));
  if(lista.length>15)bd.appendChild(el('button',{cls:'btn',style:'margin-top:8px',onclick:function(){vendTodos=!vendTodos;render();}},
    vendTodos?'Mostrar só os 15 primeiros':'Mostrar todos ('+lista.length+')'));
  var sem=g.filter(function(i){return i.k==='SEM VENDEDOR NO CADASTRO';})[0];
  if(sem)bd.appendChild(el('div',{style:'font-size:11px;color:var(--text-3);margin-top:8px'},'Sem vendedor no cadastro: '+brl(sem.v)+' · '+sem.q+' NF'+(sem.q===1?'':'s')));
  c.appendChild(bd);return c;}

function cardNotas(l){
  var c=el('div',{cls:'card'});
  c.appendChild(el('h2',null,'Notas do recorte · '+l.length.toLocaleString('pt-BR')+' · '+brl(l.reduce(function(s,n){return s+n.v;},0))));
  var bd=el('div',{cls:'bd',style:'padding:0 0 8px'});
  var ord=l.slice().sort(function(a,b){return b.v-a.v;}).slice(0,300);
  var h='<thead><tr><th class="l">NF</th><th class="l">Data</th><th class="l">Cliente</th><th class="l">UF</th>'+
    '<th class="l">Vendedor</th><th class="l">Tipo</th><th class="l">Motivo</th><th class="l">Área</th><th>Valor</th></tr></thead><tbody>';
  ord.forEach(function(n){
    h+='<tr><td class="l" style="font-weight:700">'+(n.nf||'—')+'</td><td class="l">'+dataBR(n.d)+'</td>'+
      '<td class="l" style="max-width:260px;overflow:hidden;text-overflow:ellipsis">'+n.cl+'</td><td class="l">'+n.uf+'</td>'+
      '<td class="l" style="max-width:180px;overflow:hidden;text-overflow:ellipsis">'+n.ve+'</td><td class="l">'+(n.t?'Total':'Parcial')+'</td><td class="l" style="max-width:220px;overflow:hidden;text-overflow:ellipsis">'+n.mo+'</td>'+
      '<td class="l">'+n.ar+'</td><td style="font-weight:600">'+brl(n.v)+'</td></tr>';});
  var d=el('div',{cls:'rolagem'});d.appendChild(el('table',null,h+'</tbody>'));
  bd.appendChild(d);
  if(l.length>300)bd.appendChild(el('div',{style:'font-size:11px;color:var(--text-3);padding:8px 18px'},'Mostrando as 300 de maior valor.'));
  c.appendChild(bd);return c;}

render();
window.addEventListener('resize',function(){clearTimeout(window.__r);window.__r=setTimeout(render,200);});
})();
`;
