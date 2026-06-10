import { createClient } from '@supabase/supabase-js';

// Env vars do Vite (configuradas na Vercel) com fallback direto para garantir conexão
const SB_URL = import.meta.env.VITE_SB_URL || 'https://opcrtjdnpgqcjlksofjw.supabase.co';
const SB_KEY = import.meta.env.VITE_SB_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wY3J0amRucGdxY2psa3NvZmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMwODYsImV4cCI6MjA5MDAyOTA4Nn0.ojJMzaInCSD4mrZEWrU1d9ziDVyIcp7NRm6RHx2uTGA';

export { SB_URL, SB_KEY };

export const supabase = createClient(SB_URL, SB_KEY);

export function syncAuthToken() {
  try {
    const token   = localStorage.getItem('df_token');
    const refresh = localStorage.getItem('df_refresh');
    if (token && refresh) {
      supabase.auth.setSession({ access_token: token, refresh_token: refresh }).catch(() => {});
    }
  } catch { /* ignore */ }
}

export async function login(email, password) {
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const d = await res.json();
  if (d.error) throw new Error(d.error_description || d.error);
  if (!d.access_token) throw new Error('Resposta inválida');
  return { token: d.access_token, refresh: d.refresh_token, user: d.user };
}

export async function refreshToken() {
  const refresh = localStorage.getItem('df_refresh');
  if (!refresh) return null;
  const res = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'apikey': SB_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  });
  const d = await res.json();
  if (d.error || !d.access_token) return null;
  return { token: d.access_token, refresh: d.refresh_token, user: d.user };
}

async function safeQuery(promise, fallback = null) {
  try {
    const { data, error } = await promise;
    if (error) { console.warn('[SB]', error.message); return fallback; }
    return data ?? fallback;
  } catch (e) {
    console.warn('[SB catch]', e.message);
    return fallback;
  }
}

// Busca perfil EXCLUSIVO do portal fiscal
export async function dbGetUser(email) {
  syncAuthToken();
  return await safeQuery(
    supabase
      .from('dev_fiscal_usuarios')
      .select('*')
      .eq('email', email.toLowerCase())
      .eq('ativo', true)
      .single(),
    null
  );
}

const PAGE_SIZE = 40;

export async function dbListDevolucoes({ page = 0, filters = {} }) {
  syncAuthToken();
  const from = page * PAGE_SIZE;
  const to   = from + PAGE_SIZE - 1;

  let q = supabase
    .from('oobj_nfe_recebidas')
    .select(`
      id, chave_nfe, nf_numero, nf_serie, nome_emitente,
      municipio_emitente, uf_emitente, cnpj_emitente, cnpj_destinatario,
      nat_operacao, dt_emissao, valor, valor_produtos, valor_icms, valor_st,
      cfops, tipo, status_portal, xml_baixado, xml_path,
      chave_nfe_referenciada, itens, created_at,
      inf_complementar, motivo_devolucao, devolucao_total, lancamento_manual,
      nf_venda_localizada, area_responsavel, flag_emissao_entrega
    `, { count: 'exact' })
    .eq('tipo', 'devolucao')
    .gte('dt_emissao', '2026-01-01')
    .order('dt_emissao', { ascending: false })
    .range(from, to);

  if (filters.status)         q = q.eq('status_portal', filters.status);
  if (filters.cnpj_dest)      q = q.eq('cnpj_destinatario', filters.cnpj_dest);
  if (filters.uf)             q = q.eq('uf_emitente', filters.uf);
  if (filters.dt_inicio)      q = q.gte('dt_emissao', filters.dt_inicio);
  if (filters.dt_fim)         q = q.lte('dt_emissao', filters.dt_fim);
  if (filters.devolucao_total === 'total')    q = q.eq('devolucao_total', true);
  if (filters.devolucao_total === 'parcial')  q = q.eq('devolucao_total', false);
  if (filters.lancamento_manual === 'manual') q = q.eq('lancamento_manual', true);
  if (filters.nf_venda === 'localizada')      q = q.eq('nf_venda_localizada', true);
  if (filters.nf_venda === 'nao_localizada')  q = q.eq('nf_venda_localizada', false);
  if (filters.com_motivo === 'com')           q = q.not('motivo_devolucao', 'is', null);
  if (filters.com_motivo === 'sem')           q = q.is('motivo_devolucao', null);
  if (filters.flag_emissao === 'divergente')       q = q.eq('flag_emissao_entrega', 'divergente');
  if (filters.flag_emissao === 'no_ato')           q = q.eq('flag_emissao_entrega', 'no_ato');
  if (filters.flag_emissao === 'aguardando')        q = q.eq('flag_emissao_entrega', 'aguardando_entrega');

  // Busca — usa filtro separado encapsulado para não conflitar com outros filtros
  if (filters.search) {
    const s = filters.search.trim().replace(/\./g,'').replace(/\//g,'').replace(/-/g,'');
    const isNum = /^\d+$/.test(s);
    if (isNum && s.length <= 9) {
      // número curto = número da NF
      q = q.eq('nf_numero', parseInt(s, 10));
    } else if (isNum && s.length >= 10) {
      // número longo = CNPJ
      q = q.ilike('cnpj_emitente', `%${s}%`);
    } else {
      // texto = nome do emitente ou município
      q = q.or(`nome_emitente.ilike.%${filters.search.trim()}%,municipio_emitente.ilike.%${filters.search.trim()}%`);
    }
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: data || [], total: count || 0, pageSize: PAGE_SIZE };
}

export async function dbGetDevolucaoDetail(id) {
  syncAuthToken();
  const dev = await safeQuery(
    supabase.from('oobj_nfe_recebidas').select('*').eq('id', id).single(),
    null
  );
  if (!dev) return null;

  let nfVenda = null;
  if (dev.chave_nfe_referenciada) {
    // Fonte primária: active_webhooks
    const aw = await safeQuery(
      supabase
        .from('active_webhooks')
        .select('numero,serie,chave_nfe,destinatario_nome,destinatario_cnpj,remetente_cnpj,remetente_nome,natureza_operacao,cfop,data_emissao,data_entrega,valor_mercadoria,transportador_nome,transportador_cnpj,pedido,observacao,payload_raw')
        .eq('chave_nfe', dev.chave_nfe_referenciada)
        .eq('tipo', 'nota_fiscal')
        .limit(1)
        .single(),
      null
    );

    if (aw) {
      const payload = aw.payload_raw || {};
      const dest    = payload.DESTINATARIO || {};

      // data_entrega: primeiro tenta active_webhooks, depois busca na active_ocorrencias
      let dtEntrega = aw.data_entrega;
      if (!dtEntrega && aw.numero) {
        const ocorr = await safeQuery(
          supabase
            .from('active_ocorrencias')
            .select('data_entrega, data_ocorrencia, codigo_ocorrencia, descricao_ocorrencia, recebedor_nome')
            .eq('nf_numero', aw.numero)
            .not('data_entrega', 'is', null)
            .in('codigo_ocorrencia', ['01', '107', '1', '7'])  // códigos de entrega realizada
            .order('data_ocorrencia', { ascending: false })
            .limit(1)
            .single(),
          null
        );
        if (ocorr) dtEntrega = ocorr.data_entrega || ocorr.data_ocorrencia;
      }

      nfVenda = {
        nf_numero:          aw.numero,
        nf_serie:           aw.serie,
        nf_chave:           aw.chave_nfe,
        destinatario_nome:  aw.destinatario_nome,
        destinatario_cnpj:  aw.destinatario_cnpj,
        cidade_destino:     dest.CIDADE || null,
        uf_destino:         dest.UF     || null,
        transportador_nome: aw.transportador_nome,
        transportador_cnpj: aw.transportador_cnpj,
        valor_produtos:     aw.valor_mercadoria,
        pedido:             aw.pedido,
        centro_custo:       payload.CENTRO_CUSTO || aw.observacao || null,
        dt_emissao:         aw.data_emissao,
        dt_entrega:         dtEntrega,
        cfop:               aw.cfop,
        nat_operacao:       aw.natureza_operacao,
        fonte:              'active_webhooks',
      };
    } else {
      // Fallback: historico_nfs (legado jan–abr/2026)
      const hist = await safeQuery(
        supabase
          .from('historico_nfs')
          .select('nf_numero,nf_serie,nf_chave,destinatario_nome,destinatario_cnpj,cidade_destino,uf_destino,transportador_nome,transportador_cnpj,valor_produtos,pedido,centro_custo,dt_emissao,dt_entrega,cfop')
          .eq('nf_chave', dev.chave_nfe_referenciada)
          .limit(1)
          .single(),
        null
      );
      if (hist) nfVenda = { ...hist, fonte: 'historico_nfs' };
    }
  }

  return { dev, nfVenda };
}

export async function dbUpdateStatus(id, newStatus, obs, userName) {
  syncAuthToken();
  const current = await safeQuery(
    supabase.from('oobj_nfe_recebidas').select('raw_json').eq('id', id).single(),
    null
  );
  const raw  = current?.raw_json || {};
  const hist = Array.isArray(raw.obs_historico) ? raw.obs_historico : [];
  hist.push({ ts: new Date().toISOString(), status: newStatus, obs: obs || '', user: userName || '' });

  const { error } = await supabase
    .from('oobj_nfe_recebidas')
    .update({ status_portal: newStatus, raw_json: { ...raw, obs_historico: hist }, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
}

export async function dbGetXmlUrl(xmlPath) {
  if (!xmlPath) return null;
  const { data, error } = await supabase.storage
    .from('xmls-devolucoes')
    .createSignedUrl(xmlPath, 3600);
  if (error) throw new Error(error.message);
  return data?.signedUrl || null;
}

// Uma única chamada RPC que agrega tudo no banco (SECURITY DEFINER ignora RLS)
async function fetchDashboardRPC() {
  const { data, error } = await supabase.rpc('get_dashboard_data');
  if (error) throw new Error(error.message);
  return data;
}

export async function dbGetKpis() {
  const d = await fetchDashboardRPC();
  return d?.kpis || {
    total_count: 0, total_valor: 0,
    pendente_count: 0, pendente_valor: 0,
    analise_count: 0, concluida_count: 0,
  };
}

export async function dbGetDashboard() {
  const d = await fetchDashboardRPC();
  const evolucao = d?.evolucao || [];
  const mesAtual    = evolucao[evolucao.length - 1] || null;
  const mesAnterior = evolucao[evolucao.length - 2] || null;
  const piorMesQtd   = [...evolucao].sort((a, b) => b.qtd   - a.qtd)[0]   || null;
  const piorMesValor = [...evolucao].sort((a, b) => b.valor - a.valor)[0] || null;
  return {
    totais:        d?.totais       || { qtd: 0, valor: 0, ticket_medio: 0, clientes: 0 },
    evolucao,
    piorMesQtd,
    piorMesValor,
    mesAtual,
    mesAnterior,
    topClientes:   d?.top_clientes || [],
    topUfs:        d?.top_ufs      || [],
    cfops:         d?.cfops        || [],
  };
}

// Atualizar motivo e tipo (total/parcial) de uma devolução
export async function dbUpdateMotivo(id, { motivo_devolucao, devolucao_total, area_responsavel }) {
  syncAuthToken();
  const { error } = await supabase
    .from('oobj_nfe_recebidas')
    .update({ motivo_devolucao, devolucao_total, area_responsavel, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

// Lançar devolução total manual (sem NFD emitida pelo cliente)
export async function dbLancarDevolucaoManual(dados) {
  syncAuthToken();

  // Buscar dados da NF de venda na active_webhooks para preenchimento automático
  let nfVenda = null;
  if (dados.chave_nfe_referenciada) {
    const { data } = await supabase
      .from('active_webhooks')
      .select('numero,serie,chave_nfe,destinatario_nome,destinatario_cnpj,remetente_cnpj,data_emissao,valor_mercadoria,transportador_nome,pedido')
      .eq('chave_nfe', dados.chave_nfe_referenciada)
      .eq('tipo', 'nota_fiscal')
      .limit(1)
      .single();
    nfVenda = data;
  }

  const row = {
    chave_nfe:              `MANUAL-${Date.now()}`,   // chave fictícia única
    cnpj_destinatario:      dados.cnpj_destinatario || '05207076000297',
    cnpj_emitente:          nfVenda?.destinatario_cnpj || dados.cnpj_emitente || null,
    nome_emitente:          dados.nome_emitente || nfVenda?.destinatario_nome || null,
    uf_emitente:            dados.uf_emitente || null,
    municipio_emitente:     dados.municipio_emitente || null,
    dt_emissao:             dados.dt_emissao || new Date().toISOString().slice(0, 10),
    dt_recebimento_oobj:    new Date().toISOString(),
    valor:                  parseFloat(dados.valor) || nfVenda ? parseFloat(nfVenda?.valor_mercadoria || 0) : 0,
    valor_produtos:         parseFloat(dados.valor) || null,
    nat_operacao:           'DEVOLUCAO TOTAL - LANÇAMENTO MANUAL',
    cfops:                  ['6202'],  // CFOP padrão devolução interestadual
    tipo:                   'devolucao',
    status_portal:          'pendente',
    devolucao_total:        true,
    lancamento_manual:      true,
    motivo_devolucao:       dados.motivo_devolucao || null,
    inf_complementar:       dados.observacao || null,
    chave_nfe_referenciada: dados.chave_nfe_referenciada || null,
    nf_numero:              null,  // sem NFD emitida
    xml_baixado:            false,
    raw_json:               { lancado_por: dados.usuario, lancado_em: new Date().toISOString() },
  };

  const { data, error } = await supabase
    .from('oobj_nfe_recebidas')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

// Buscar motivos cadastrados da tabela (para o dropdown do drawer)
export async function dbGetMotivos() {
  const { data } = await supabase
    .from('motivos_devolucao')
    .select('motivo, area')
    .eq('ativo', true)
    .order('area')
    .order('motivo');
  return data || [];
}
