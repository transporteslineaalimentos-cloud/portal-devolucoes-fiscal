/* Gera um painel de custos de frete em um único arquivo .html,
   que abre offline e continua interativo: filtros, cliques nos gráficos,
   busca de CT-e e detalhe das notas. Nada sai daqui para a internet. */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function gerarPainelFrete({ data, ctes, periodo, filtros, geradoPor }) {
  /* A mesma transportadora aparece com grafias diferentes em cada filial.
     O grupo é a raiz do CNPJ, e o nome exibido é o canônico do painel
     (ou o primeiro visto, para quem está fora do top 40). */
  const nomePorRaiz = (lista, campoRaiz, campoNome) => {
    const m = new Map();
    (data[lista] || []).forEach((i) => { if (i.raiz) m.set(i.raiz, i.nome); });
    (ctes || []).forEach((c) => {
      const r = c[campoRaiz];
      if (r && !m.has(r)) m.set(r, c[campoNome] || '—');
    });
    return m;
  };
  const nTransp = nomePorRaiz('por_transportador', 'transp_raiz', 'transp_nome');
  const nDest = nomePorRaiz('por_destinatario', 'dest_raiz', 'dest_nome');
  const nomeDe = (mapa, raiz, fallback) => mapa.get(raiz) || fallback || '—';

  const dic = { tr: [], dr: [], ci: [], tp: [], uf: [] };
  const ix = { tr: new Map(), dr: new Map(), ci: new Map(), tp: new Map(), uf: new Map() };
  const id = (k, v) => {
    const s = v || '—';
    if (!ix[k].has(s)) { ix[k].set(s, dic[k].length); dic[k].push(s); }
    return ix[k].get(s);
  };
  const enxuto = (ctes || []).map((c) => ({
    c: c.cte_numero, d: c.dt, dn: String(c.dt_nf).slice(0, 7),
    t: id('tp', c.tipo), g: c.categoria === 'FRETE VENDA' ? 1 : 0,
    tr: id('tr', nomeDe(nTransp, c.transp_raiz, c.transp_nome)),
    dr: id('dr', nomeDe(nDest, c.dest_raiz, c.dest_nome)),
    u: id('uf', c.uf), ci: id('ci', c.cidade),
    v: Math.round(Number(c.valor) * 100) / 100,
    o: c.operacao === 'VENDA' ? 0 : 1,
    n: (c.nfs || []).map((n) => n.nf).join(' '),
    nv: Math.round(Number(c.valor_nfs || 0) * 100) / 100,
  }));

  const payload = {
    periodo, filtros: filtros || [], geradoEm: new Date().toISOString(), geradoPor: geradoPor || '',
    kpis: data.kpis, mensal: data.mensal, por_tipo: data.por_tipo,
    por_transportador: data.por_transportador, por_destinatario: data.por_destinatario,
    por_uf: data.por_uf, cobertura: data.cobertura, dic, ctes: enxuto,
  };

  return `<!doctype html>
<html lang="pt-BR"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Custos de Frete · Linea Alimentos · ${esc(periodo)}</title>
<style>${CSS}</style>
</head><body>
<div id="app"></div>
<script id="dados" type="application/json">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>
<script>${JS}</script>
</body></html>`;
}

/* ─── estilo ─────────────────────────────────────────────── */
const CSS = `
:root{
  --bg:#F0F2F5;--surface:#fff;--surface-2:#F7F8FA;--surface-3:#EEF0F3;--border:#E2E6EC;
  --text:#0F1923;--text-2:#45515E;--text-3:#7A8694;--venda:#1E4DB7;--extra:#D9822B;
  --dim:rgba(30,77,183,.08);--shadow:0 1px 2px rgba(15,25,35,.06),0 1px 3px rgba(15,25,35,.04);
  --radius:12px;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);
  font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Arial,sans-serif;
  -webkit-font-smoothing:antialiased}
.wrap{max-width:1600px;margin:0 auto;padding:20px 24px 48px;display:flex;flex-direction:column;gap:16px}
@media(max-width:640px){.wrap{padding:16px}}
header.topo{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.marca{display:flex;align-items:center;gap:11px}
.marca .mk{width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#1C2130,#2D3A52);
  display:flex;align-items:center;justify-content:center;flex:0 0 auto}
.marca h1{margin:0;font-size:19px;font-weight:700;letter-spacing:-.02em}
.marca .sub{font-size:12px;color:var(--text-3)}
.acoes{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.btn{border:1px solid var(--border);background:var(--surface);color:var(--text-2);border-radius:8px;
  padding:7px 12px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:inherit}
.btn:hover{background:var(--surface-2);color:var(--text)}
.btn.on{background:var(--venda);border-color:var(--venda);color:#fff}
select,input{font-family:inherit;font-size:12.5px;height:32px;padding:0 9px;border:1px solid var(--border);
  border-radius:8px;background:var(--surface);color:var(--text)}
input{padding:0 11px}
.filtros{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
.chip{display:inline-flex;align-items:center;gap:6px;background:var(--dim);color:var(--venda);
  border:none;border-radius:99px;padding:4px 11px;font-size:11.5px;font-weight:600;cursor:pointer;font-family:inherit}
.kpis{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:12px}
@media(max-width:1360px){.kpis{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:640px){.kpis{grid-template-columns:repeat(2,minmax(0,1fr))}}
.kpi{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  padding:14px 16px;box-shadow:var(--shadow);min-width:0}
.kpi.forte{background:linear-gradient(145deg,#1C2130,#272F44);border-color:transparent}
.kpi .lb{font-size:11.5px;color:var(--text-2);display:flex;align-items:center;gap:6px}
.kpi.forte .lb{color:rgba(255,255,255,.65)}
.kpi .vl{font-size:22px;font-weight:700;margin-top:6px;letter-spacing:-.02em;font-variant-numeric:tabular-nums;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.kpi.forte .vl{color:#fff}
.kpi .nt{font-size:11px;color:var(--text-3);margin-top:3px}
.kpi.forte .nt{color:rgba(255,255,255,.5)}
.dot{width:8px;height:8px;border-radius:99px;flex:0 0 auto}
.card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);
  box-shadow:var(--shadow);overflow:hidden;min-width:0}
.card>h2{margin:0;padding:14px 18px 2px;font-size:14px;font-weight:700;letter-spacing:-.01em}
.card>.sb{padding:0 18px;font-size:11.5px;color:var(--text-3)}
.card>.bd{padding:10px 18px 16px}
.grid2{display:grid;grid-template-columns:repeat(auto-fit,minmax(440px,1fr));gap:16px}
.leg{display:flex;gap:14px;flex-wrap:wrap;font-size:11.5px;color:var(--text-2);padding:0 18px;margin-top:6px}
.leg span{display:inline-flex;align-items:center;gap:6px}
.leg i{width:10px;height:10px;border-radius:2px;display:inline-block}
.barra{display:grid;grid-template-columns:minmax(120px,30%) minmax(0,1fr);gap:12px;align-items:center;
  padding:5px 4px;border-radius:7px;cursor:pointer}
.barra:hover{background:var(--surface-2)}
.barra.sel{background:var(--dim)}
.barra .nm{font-size:11.5px;color:var(--text-2);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.barra.sel .nm{font-weight:700;color:var(--text)}
.barra .tubo{display:flex;height:14px;border-radius:0 3px 3px 0;overflow:hidden;flex:0 0 auto}
.barra .num{font-size:11.5px;font-variant-numeric:tabular-nums;white-space:nowrap}
.barra .num b{color:var(--text)}
.barra .det{font-size:10.5px;color:var(--text-3);font-variant-numeric:tabular-nums;margin-top:1px}
table{width:100%;border-collapse:collapse}
.periodo{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text-3)}
th{padding:8px 10px;font-size:10.5px;font-weight:700;color:var(--text-3);text-align:left;
  white-space:nowrap;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--surface);z-index:1}
td{padding:7px 10px;font-size:12px;color:var(--text-2);border-bottom:1px solid var(--border)}
td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
tr.cte{cursor:pointer}
tr.cte:hover td{background:var(--dim)}
.vazio{padding:28px;text-align:center;color:var(--text-3);font-size:12.5px}
.rodape{font-size:11px;color:var(--text-3);text-align:center;padding-top:6px}
.tip{position:absolute;pointer-events:none;background:var(--surface);border:1px solid var(--border);
  border-radius:8px;box-shadow:0 4px 14px rgba(15,25,35,.14);padding:9px 11px;font-size:11.5px;
  font-variant-numeric:tabular-nums;z-index:50;min-width:190px}
.tip b{color:var(--text)}
.lin{display:flex;justify-content:space-between;gap:10px;color:var(--text-2);padding:1px 0}
svg{display:block}
`;

/* ─── comportamento do arquivo exportado ─────────────────── */
const JS = String.raw`
(function(){
var D=JSON.parse(document.getElementById('dados').textContent);
var MESES=['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
var VENDA='var(--venda)',EXTRA='var(--extra)';
var MM=(D.mensal||[]).map(function(m){return m.mes;});
var f={transp:'',uf:'',tipo:'',dest:'',mes:'',busca:'',de:MM[0]||'',ate:MM[MM.length-1]||''};
function opMeses(sel){return MM.map(function(m){return '<option value="'+m+'"'+(m===sel?' selected':'')+'>'+mesLb(m)+'</option>';}).join('');}
function mesesNoRange(){return MM.filter(function(m){return m>=f.de&&m<=f.ate;});}
var DT=D.dic.tr,DD=D.dic.dr,DC=D.dic.ci,DP=D.dic.tp,DU=D.dic.uf;
D.ctes.forEach(function(c){c.TR=DT[c.tr];c.DR=DD[c.dr];c.U=DU[c.u];c.CI=DC[c.ci];c.T=DP[c.t];});
var ufModo='valor';
var app=document.getElementById('app');

function brl(v){return 'R$ '+Math.round(Number(v)||0).toLocaleString('pt-BR');}
function brlC(v){return 'R$ '+(Number(v)||0).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});}
function brlK(v){var n=Number(v)||0;
  if(Math.abs(n)>=1e6)return 'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:2})+' mi';
  if(Math.abs(n)>=1e3)return 'R$ '+Math.round(n/1e3).toLocaleString('pt-BR')+' mil';
  return 'R$ '+Math.round(n).toLocaleString('pt-BR');}
function pct(a,b){return b?((a/b*100).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})+'%'):'—';}
function mesLb(m){var p=m.split('-');return MESES[+p[1]-1]+'/'+p[0].slice(2);}
function dataBR(s){return s?String(s).slice(0,10).split('-').reverse().join('/'):'';}
function titulo(s){if(!s)return '';return String(s).toLowerCase().replace(/(^|[\s\/(-])([a-zà-ú])/g,function(m,p,c){return p+c.toUpperCase();})
  .replace(/\b(Ltda|S\/a|S\.a\.?|Eireli|Me|Epp)\b/gi,function(m){return m.toUpperCase();});}
function semAc(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function el(t,a,h){var e=document.createElement(t);if(a)for(var k in a){if(k==='cls')e.className=a[k];else if(k.slice(0,2)==='on')e.addEventListener(k.slice(2),a[k]);else e.setAttribute(k,a[k]);}if(h!=null)e.innerHTML=h;return e;}

function ativos(){return D.ctes.filter(function(c){
  if(f.transp&&c.TR!==f.transp)return false;
  if(f.uf&&c.U!==f.uf)return false;
  if(f.dest&&c.DR!==f.dest)return false;
  if(f.tipo&&c.T!==f.tipo)return false;
  if(c.dn<f.de||c.dn>f.ate)return false;
  if(f.mes&&c.dn!==f.mes)return false;
  if(f.busca){var q=semAc(f.busca);if(semAc(c.c+' '+c.TR+' '+c.DR+' '+c.U+' '+c.CI+' '+c.T+' '+c.n).indexOf(q)<0)return false;}
  return true;});}
function soma(l,g){return l.reduce(function(s,c){return s+(g==null||c.g===g?c.v:0);},0);}
function agrupa(l,k){var m={};l.forEach(function(c){var a=m[c[k]]||(m[c[k]]={v:0,fv:0,ce:0,q:0,nv:0});
  a.v+=c.v;a[c.g?'fv':'ce']+=c.v;a.q++;a.nv+=c.nv;});
  return Object.keys(m).map(function(k2){return {k:k2,v:m[k2].v,fv:m[k2].fv,ce:m[k2].ce,q:m[k2].q,nv:m[k2].nv};})
    .sort(function(a,b){return b.v-a.v;});}
function baseDe(lista,chave,valor){
  var o=(D[lista]||[]).filter(function(i){return (i[chave]||'—')===valor;})[0];
  return o?Number(o.base_nf)||0:0;}

function chips(){
  var c=[];
  if(f.mes)c.push(['mes','Mês '+mesLb(f.mes)]);
  if(f.transp)c.push(['transp',titulo(f.transp)]);
  if(f.dest)c.push(['dest',titulo(f.dest)]);
  if(f.uf)c.push(['uf','UF '+f.uf]);
  if(f.tipo)c.push(['tipo',titulo(f.tipo)]);
  if(f.busca)c.push(['busca','"'+f.busca+'"']);
  return c;}

function render(){
  var l=ativos();
  var fv=soma(l,1),ce=soma(l,0),ft=fv+ce;
  var semFiltro=!f.transp&&!f.uf&&!f.dest&&!f.tipo&&!f.busca;
  var mesesSel=f.mes?[f.mes]:mesesNoRange();
  var fat=(D.mensal||[]).reduce(function(s,m){return s+(mesesSel.indexOf(m.mes)>=0?Number(m.faturamento):0);},0);
  var nfsSel=(D.mensal||[]).length&&mesesSel.length===MM.length?(Number(D.kpis.qtd_nfs)||0):null;
  var baseNf=semFiltro?null:l.reduce(function(s,c){return s+c.nv;},0);

  app.innerHTML='';
  var w=el('div',{cls:'wrap'});

  /* topo */
  var topo=el('header',{cls:'topo'});
  topo.appendChild(el('div',{cls:'marca'},
    '<div class="mk"><svg width="18" height="18" viewBox="0 0 22 22"><path d="M3 17V5h3l5 9 5-9h3v12h-2.5V9.5l-4.5 7.5h-3L5 9.5V17H3z" fill="#B8956A"/></svg></div>'+
    '<div><h1>Custos de Frete</h1><div class="sub">Linea Alimentos · '+D.periodo+
    (D.filtros&&D.filtros.length?' · '+D.filtros.join(' · '):'')+'</div></div>'));
  var ac=el('div',{cls:'acoes'});
  ac.appendChild(el('div',{cls:'periodo'},
    '<span>Período</span>'+
    '<select id="mDe">'+opMeses(f.de)+'</select><span>até</span><select id="mAte">'+opMeses(f.ate)+'</select>'));
  topo.appendChild(ac);w.appendChild(topo);
  ac.querySelector('#mDe').addEventListener('change',function(e){f.de=e.target.value;if(f.de>f.ate)f.ate=f.de;f.mes='';render();});
  ac.querySelector('#mAte').addEventListener('change',function(e){f.ate=e.target.value;if(f.ate<f.de)f.de=f.ate;f.mes='';render();});

  /* filtros */
  var fl=el('div',{cls:'filtros'});
  chips().forEach(function(c){fl.appendChild(el('button',{cls:'chip',onclick:function(){f[c[0]]='';render();}},c[1]+' <span>×</span>'));});
  if(chips().length)fl.appendChild(el('button',{cls:'btn',onclick:function(){
    f.transp='';f.uf='';f.tipo='';f.dest='';f.mes='';f.busca='';render();}},'Limpar'));
  w.appendChild(fl);

  /* kpis */
  var k=el('div',{cls:'kpis'});
  function kpi(lb,vl,nt,cor,forte){
    return el('div',{cls:'kpi'+(forte?' forte':'')},
      '<div class="lb">'+(cor?'<span class="dot" style="background:'+cor+'"></span>':'')+lb+'</div>'+
      '<div class="vl">'+vl+'</div>'+(nt?'<div class="nt">'+nt+'</div>':''));}
  k.appendChild(kpi('Faturamento',brlK(fat),nfsSel!=null?nfsSel.toLocaleString('pt-BR')+' NFs de venda':'Notas emitidas no período'));
  k.appendChild(kpi('Frete venda',brlK(fv),'CT-es de entrega normal',VENDA));
  k.appendChild(kpi('Custo extra',brlK(ce),'Dedicado, descarga, pallet e demais',EXTRA));
  k.appendChild(kpi('% Frete total × faturamento',pct(ft,fat),brlK(ft)+' · '+l.length.toLocaleString('pt-BR')+' CT-es',null,true));
  k.appendChild(kpi('% Frete venda × faturamento',pct(fv,fat),'',VENDA));
  k.appendChild(kpi('% Custo extra × faturamento',pct(ce,fat),'',EXTRA));
  w.appendChild(k);
  if(baseNf!=null&&baseNf>0)
    w.appendChild(el('div',{style:'font-size:11.5px;color:var(--text-3);margin-top:-8px'},
      'Neste recorte, o frete é '+pct(ft,baseNf)+' do valor das notas atendidas ('+brlK(baseNf)+').'));

  /* mensal */
  w.appendChild(cardMensal());

  /* transportador + tipo */
  var g1=el('div',{cls:'grid2'});
  g1.appendChild(cardBarras('Frete pago por transportador','',
    agrupa(l,'TR'),'transp','por_transportador','nome'));
  g1.appendChild(cardTipos(l));
  w.appendChild(g1);

  /* destinatário + UF */
  var g2=el('div',{cls:'grid2'});
  g2.appendChild(cardBarras('Frete por destinatário','',
    agrupa(l,'DR'),'dest','por_destinatario','nome'));
  g2.appendChild(cardUF(l));
  w.appendChild(g2);

  /* tabela */
  w.appendChild(el('div',{cls:'rodape'},'Mostrando '+mesLb(f.de)+' a '+mesLb(f.ate)+' · gerado em '+new Date(D.geradoEm).toLocaleString('pt-BR')+
    (D.geradoPor?' por '+D.geradoPor:'')+' · dados do portal de Devoluções Fiscais · Linea Alimentos'));
  app.appendChild(w);
}

function cardMensal(){
  var c=el('div',{cls:'card'});
  c.appendChild(el('h2',null,'Custo de frete por mês e % sobre o faturamento'));
  c.appendChild(el('div',{cls:'leg'},'<span><i style="background:'+VENDA+'"></i>Frete venda</span><span><i style="background:'+EXTRA+'"></i>Custo extra</span>'));
  var bd=el('div',{cls:'bd'});
  var m=(D.mensal||[]).filter(function(x){return mesesNoRange().indexOf(x.mes)>=0;}),W=Math.min(1500,Math.max(360,window.innerWidth-120)),H=270,pL=60,pR=12,pT=28,pB=30;
  var max=1;m.forEach(function(x){max=Math.max(max,Number(x.frete_venda)+Number(x.custo_extra));});
  var p=Math.pow(10,Math.floor(Math.log10(max)));var nice=Math.ceil(max/p)*p;
  var slot=(W-pL-pR)/Math.max(1,m.length),bw=Math.min(62,slot*.58);
  var X=function(i){return pL+slot*i+slot/2;},Y=function(v){return pT+(H-pT-pB)*(1-v/nice);};
  var s='<svg width="'+W+'" height="'+H+'">';
  [0,.25,.5,.75,1].forEach(function(t){var y=Y(t*nice);
    s+='<line x1="'+pL+'" x2="'+(W-pR)+'" y1="'+y+'" y2="'+y+'" stroke="var(--surface-3)"/>'+
       '<text x="'+(pL-8)+'" y="'+(y+4)+'" text-anchor="end" font-size="10.5" fill="var(--text-3)">'+brlK(t*nice).replace('R$ ','')+'</text>';});
  m.forEach(function(x,i){
    var fvv=Number(x.frete_venda),cee=Number(x.custo_extra),tot=fvv+cee,yV=Y(fvv),yT=Y(tot);
    var sel=f.mes===x.mes,op=(f.mes&&!sel)?.4:1;
    s+='<g data-mes="'+x.mes+'" style="cursor:pointer" opacity="'+op+'">'+
       '<rect x="'+(X(i)-slot/2)+'" y="'+(pT-24)+'" width="'+slot+'" height="'+(H-pT-pB+24)+'" fill="'+(sel?'var(--dim)':'transparent')+'" rx="6"/>'+
       '<rect x="'+(X(i)-bw/2)+'" y="'+yV+'" width="'+bw+'" height="'+Math.max(0,Y(0)-yV)+'" fill="'+VENDA+'" rx="2"/>'+
       '<rect x="'+(X(i)-bw/2)+'" y="'+yT+'" width="'+bw+'" height="'+Math.max(0,yV-yT)+'" fill="'+EXTRA+'" rx="2"/>'+
       (tot>0?'<text x="'+X(i)+'" y="'+(yT-8)+'" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text)">'+pct(tot,Number(x.faturamento))+'</text>':'')+
       '<text x="'+X(i)+'" y="'+(H-9)+'" text-anchor="middle" font-size="11" fill="var(--text-3)">'+mesLb(x.mes)+'</text></g>';});
  s+='</svg>';
  var box=el('div',{style:'position:relative;overflow-x:auto'},s);
  box.querySelectorAll('g[data-mes]').forEach(function(g){
    g.addEventListener('click',function(){f.mes=(f.mes===g.dataset.mes)?'':g.dataset.mes;render();});
    g.addEventListener('mouseenter',function(e){
      var x=(D.mensal||[]).filter(function(y){return y.mes===g.dataset.mes;})[0];if(!x)return;
      var fvv=Number(x.frete_venda),cee=Number(x.custo_extra),t=fvv+cee,ff=Number(x.faturamento);
      mostraTip(box,e,'<b>'+mesLb(x.mes)+'</b> · '+x.qtd_ctes+' CT-es'+
        lin('Frete venda',brl(fvv),pct(fvv,ff),VENDA)+lin('Custo extra',brl(cee),pct(cee,ff),EXTRA)+
        '<div style="border-top:1px solid var(--border);margin-top:5px;padding-top:5px">'+
        lin('Frete total',brl(t),pct(t,ff))+lin('Faturamento',brlK(ff),'')+'</div>');});
    g.addEventListener('mouseleave',escondeTip);});
  bd.appendChild(box);
  bd.appendChild(tabelaMensal());
  c.appendChild(bd);return c;}

function lin(lb,v,p,cor){
  return '<div class="lin"><span>'+(cor?'<i style="display:inline-block;width:8px;height:8px;border-radius:2px;background:'+cor+';margin-right:5px"></i>':'')+lb+
    '</span><span><b>'+v+'</b>'+(p?' <span style="color:var(--text-3)">'+p+'</span>':'')+'</span></div>';}

function mostraTip(box,e,html){
  escondeTip();var t=el('div',{cls:'tip'},html);document.body.appendChild(t);
  var r=box.getBoundingClientRect();
  t.style.left=Math.min(e.clientX+14,window.innerWidth-t.offsetWidth-12)+'px';
  t.style.top=(window.scrollY+Math.max(r.top+8,e.clientY-60))+'px';}
function escondeTip(){var t=document.querySelector('.tip');if(t)t.remove();}

function tabelaMensal(){
  var t=el('table',{style:'margin-top:12px'}),h='<thead><tr><th>Mês</th><th class="n">Faturamento</th><th class="n">Frete venda</th>'+
    '<th class="n">Custo extra</th><th class="n">Frete total</th><th class="n">% total</th><th class="n">% venda</th><th class="n">% extra</th></tr></thead><tbody>';
  var tf=0,tv=0,te=0;
  (D.mensal||[]).filter(function(x){return mesesNoRange().indexOf(x.mes)>=0;}).forEach(function(m){
    var ff=Number(m.faturamento),v=Number(m.frete_venda),e=Number(m.custo_extra);tf+=ff;tv+=v;te+=e;
    h+='<tr><td style="font-weight:600;color:var(--text)">'+mesLb(m.mes)+'</td><td class="n">'+brlK(ff)+'</td>'+
       '<td class="n" style="color:'+VENDA+'">'+brl(v)+'</td><td class="n" style="color:'+EXTRA+'">'+brl(e)+'</td>'+
       '<td class="n" style="font-weight:700;color:var(--text)">'+brl(v+e)+'</td><td class="n" style="font-weight:700;color:var(--text)">'+pct(v+e,ff)+'</td>'+
       '<td class="n">'+pct(v,ff)+'</td><td class="n">'+pct(e,ff)+'</td></tr>';});
  h+='<tr style="background:var(--surface-2)"><td style="font-weight:700;color:var(--text)">Período</td><td class="n">'+brlK(tf)+'</td>'+
     '<td class="n">'+brl(tv)+'</td><td class="n">'+brl(te)+'</td><td class="n" style="font-weight:700;color:var(--text)">'+brl(tv+te)+'</td>'+
     '<td class="n" style="font-weight:700;color:var(--text)">'+pct(tv+te,tf)+'</td><td class="n">'+pct(tv,tf)+'</td><td class="n">'+pct(te,tf)+'</td></tr>';
  t.innerHTML=h+'</tbody>';
  return el('div',{style:'overflow-x:auto'}).appendChild(t).parentNode;}

function cardBarras(titulo_,sub,itens,campo,lista,chave){
  var c=el('div',{cls:'card'});
  c.appendChild(el('h2',null,titulo_));
  c.appendChild(el('div',{cls:'leg'},'<span><i style="background:'+VENDA+'"></i>Venda</span><span><i style="background:'+EXTRA+'"></i>Extra</span>'));
  var bd=el('div',{cls:'bd'});
  var max=1;itens.forEach(function(i){max=Math.max(max,i.v);});
  var lim=12,mostra=itens.slice(0,lim);
  function desenha(todos){
    bd.innerHTML='';
    (todos?itens:mostra).forEach(function(i){
      var base=i.nv||baseDe(lista,chave,i.k);
      var row=el('div',{cls:'barra'+(f[campo]===i.k?' sel':'')});
      row.addEventListener('click',function(){f[campo]=(f[campo]===i.k)?'':i.k;render();});
      row.appendChild(el('div',{cls:'nm',title:titulo(i.k)},titulo(i.k)));
      var dir=el('div');
      dir.innerHTML='<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'+
        '<span class="tubo" style="width:'+Math.max(2,(i.v/max)*48)+'%"><i style="display:block;height:100%;width:'+
          (i.v?(i.fv/i.v*100):0)+'%;background:'+VENDA+'"></i><i style="display:block;height:100%;flex:1;background:'+EXTRA+'"></i></span>'+
        '<span class="num"><b>'+brl(i.v)+'</b>'+(base?' <span style="color:var(--text-3)">· '+pct(i.v,base)+' da NF</span>':'')+'</span></div>'+
        '<div class="det">Venda '+brl(i.fv)+' · Extra '+brl(i.ce)+' · '+i.q.toLocaleString('pt-BR')+' CT-es'+
          (base?' · NFs '+brlK(base):'')+'</div>';
      row.appendChild(dir);bd.appendChild(row);});
    if(itens.length>lim){
      bd.appendChild(el('button',{cls:'btn',style:'margin-top:8px',onclick:function(){desenha(!todos);}},
        todos?'Mostrar menos':'Ver todos ('+itens.length+')'));}
    if(!itens.length)bd.appendChild(el('div',{cls:'vazio'},'Sem CT-es neste recorte.'));}
  desenha(false);c.appendChild(bd);return c;}

function cardTipos(l){
  var c=el('div',{cls:'card'});
  c.appendChild(el('h2',null,'Custo por tipo de CT-e'));
  var bd=el('div',{cls:'bd'}),itens=agrupa(l,'T'),tot=itens.reduce(function(s,i){return s+i.v;},0),max=1;
  itens.forEach(function(i){max=Math.max(max,i.v);});
  itens.forEach(function(i){
    var row=el('div',{cls:'barra'+(f.tipo===i.k?' sel':'')});
    row.addEventListener('click',function(){f.tipo=(f.tipo===i.k)?'':i.k;render();});
    row.appendChild(el('div',{cls:'nm'},titulo(i.k)));
    row.appendChild(el('div',null,'<div style="display:flex;align-items:center;gap:9px;flex-wrap:wrap">'+
      '<span class="tubo" style="width:'+Math.max(2,(i.v/max)*48)+'%;background:'+(i.fv>i.ce?VENDA:EXTRA)+'"></span>'+
      '<span class="num"><b>'+brl(i.v)+'</b> <span style="color:var(--text-3)">· '+pct(i.v,tot)+' do frete</span></span></div>'+
      '<div class="det">'+i.q.toLocaleString('pt-BR')+' CT-es'+(i.nv?' · NFs '+brlK(i.nv):'')+'</div>'));
    bd.appendChild(row);});
  if(!itens.length)bd.appendChild(el('div',{cls:'vazio'},'Sem CT-es neste recorte.'));
  c.appendChild(bd);return c;}

function cardUF(l){
  var c=el('div',{cls:'card'});
  var h=el('div',{style:'display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap'});
  h.appendChild(el('div',null,'<h2 style="padding-bottom:0">Frete por UF de destino</h2>'));
  var tg=el('div',{cls:'acoes',style:'padding:14px 18px 0'});
  ['valor','pct'].forEach(function(m){
    tg.appendChild(el('button',{cls:'btn'+(ufModo===m?' on':''),onclick:function(){ufModo=m;render();}},m==='valor'?'R$':'% da NF'));});
  h.appendChild(tg);
  h.firstChild.style.padding='14px 0 0 18px';
  c.appendChild(h);
  var bd=el('div',{cls:'bd'}),itens=agrupa(l,'U');
  itens=itens.map(function(i){var base=i.nv||baseDe('por_uf','uf',i.k);
    return {k:i.k,v:i.v,fv:i.fv,ce:i.ce,q:i.q,base:base,p:base?i.v/base:0};});
  if(ufModo==='pct')itens=itens.filter(function(i){return i.base>0;}).sort(function(a,b){return b.p-a.p;});
  var W=Math.min(900,Math.max(320,window.innerWidth-120)),H=230,pT=24,pB=26;
  var max=ufModo==='pct'?0.0001:1;itens.forEach(function(i){max=Math.max(max,ufModo==='pct'?i.p:i.v);});
  var slot=W/Math.max(1,itens.length),bw=Math.min(34,slot*.64);
  var Y=function(v){return pT+(H-pT-pB)*(1-v/max);};
  var s='<svg width="'+W+'" height="'+H+'"><line x1="0" x2="'+W+'" y1="'+Y(0)+'" y2="'+Y(0)+'" stroke="var(--border)"/>';
  itens.forEach(function(i,k){
    var v=ufModo==='pct'?i.p:i.v,cx=slot*k+slot/2,sel=f.uf===i.k;
    s+='<g data-uf="'+i.k+'" style="cursor:pointer" opacity="'+((f.uf&&!sel)?.45:1)+'">'+
       '<rect x="'+(slot*k)+'" y="'+(pT-18)+'" width="'+slot+'" height="'+(H-pT+18)+'" fill="'+(sel?'var(--dim)':'transparent')+'"/>'+
       '<rect x="'+(cx-bw/2)+'" y="'+Y(v)+'" width="'+bw+'" height="'+Math.max(1,Y(0)-Y(v))+'" rx="2" fill="'+(ufModo==='pct'?EXTRA:VENDA)+'"/>'+
       (k<9?'<text x="'+cx+'" y="'+(Y(v)-6)+'" text-anchor="middle" font-size="10.5" font-weight="600" fill="var(--text-2)">'+
          (ufModo==='pct'?(i.p*100).toFixed(1).replace('.',',')+'%':brlK(i.v).replace('R$ ',''))+'</text>':'')+
       '<text x="'+cx+'" y="'+(H-7)+'" text-anchor="middle" font-size="11" font-weight="'+(sel?700:500)+'" fill="var(--text-2)">'+i.k+'</text></g>';});
  s+='</svg>';
  var box=el('div',{style:'position:relative;overflow-x:auto'},s);
  box.querySelectorAll('g[data-uf]').forEach(function(g){
    g.addEventListener('click',function(){f.uf=(f.uf===g.dataset.uf)?'':g.dataset.uf;render();});
    g.addEventListener('mouseenter',function(e){
      var i=itens.filter(function(x){return x.k===g.dataset.uf;})[0];if(!i)return;
      mostraTip(box,e,'<b>'+i.k+'</b>'+lin('Frete venda',brl(i.fv),'',VENDA)+lin('Custo extra',brl(i.ce),'',EXTRA)+
        lin('Frete total',brl(i.v),'')+(i.base?lin('Valor das NFs',brlK(i.base),pct(i.v,i.base)):'')+
        '<div style="color:var(--text-3);margin-top:4px">'+i.q.toLocaleString('pt-BR')+' CT-es · clique para filtrar</div>');});
    g.addEventListener('mouseleave',escondeTip);});
  bd.appendChild(box);
  if(!itens.length)bd.appendChild(el('div',{cls:'vazio'},'Sem CT-es neste recorte.'));
  c.appendChild(bd);return c;}

render();
window.addEventListener('resize',function(){clearTimeout(window.__r);window.__r=setTimeout(render,200);});
})();
`;
