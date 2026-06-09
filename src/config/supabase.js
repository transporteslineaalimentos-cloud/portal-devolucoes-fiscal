import { createClient } from '@supabase/supabase-js';

export const SB_URL = 'https://opcrtjdnpgqcjlksofjw.supabase.co';
export const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wY3J0amRucGdxY2psa3NvZmp3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTMwODYsImV4cCI6MjA5MDAyOTA4Nn0.ojJMzaInCSD4mrZEWrU1d9ziDVyIcp7NRm6RHx2uTGA';

export const supabase = createClient(SB_URL, SB_KEY);

// ── Auth helpers ──────────────────────────────────────────────────────────────
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

// ── DB helpers genéricos ──────────────────────────────────────────────────────
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

// ── Portal users (torre_usuarios reutilizados) ────────────────────────────────
export async function dbGetUser(email) {
  syncAuthToken();
  return await safeQuery(
    supabase.from('torre_usuarios').select('*').eq('email', email.toLowerCase()).single(),
    null
  );
}

// ── Devoluções fiscais ────────────────────────────────────────────────────────
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
      chave_nfe_referenciada, itens, created_at
    `, { count: 'exact' })
    .eq('tipo', 'devolucao')
    .order('dt_emissao', { ascending: false })
    .range(from, to);

  if (filters.status)    q = q.eq('status_portal', filters.status);
  if (filters.cnpj_dest) q = q.eq('cnpj_destinatario', filters.cnpj_dest);
  if (filters.uf)        q = q.eq('uf_emitente', filters.uf);
  if (filters.dt_inicio) q = q.gte('dt_emissao', filters.dt_inicio);
  if (filters.dt_fim)    q = q.lte('dt_emissao', filters.dt_fim);
  if (filters.search) {
    const s = filters.search.trim();
    q = q.or(`nome_emitente.ilike.%${s}%,nf_numero::text.ilike.%${s}%`);
  }

  const { data, error, count } = await q;
  if (error) throw new Error(error.message);
  return { rows: data || [], total: count || 0, pageSize: PAGE_SIZE };
}

export async function dbGetDevolucaoDetail(id) {
  syncAuthToken();
  // Busca a devolução completa
  const dev = await safeQuery(
    supabase.from('oobj_nfe_recebidas').select('*').eq('id', id).single(),
    null
  );
  if (!dev) return null;

  // Busca a NF original de venda via historico_nfs
  let nfVenda = null;
  if (dev.chave_nfe_referenciada) {
    nfVenda = await safeQuery(
      supabase.from('historico_nfs')
        .select('nf_numero,nf_serie,nf_chave,destinatario_nome,destinatario_cnpj,cidade_destino,uf_destino,transportador_nome,transportador_cnpj,valor_produtos,pedido,centro_custo,dt_emissao,dt_entrega,romaneio_numero,cfop')
        .eq('nf_chave', dev.chave_nfe_referenciada)
        .limit(1)
        .single(),
      null
    );
  }

  return { dev, nfVenda };
}

export async function dbUpdateStatus(id, newStatus, obs, userName) {
  syncAuthToken();
  // Busca raw_json atual para appender histórico
  const current = await safeQuery(
    supabase.from('oobj_nfe_recebidas').select('raw_json').eq('id', id).single(),
    null
  );
  const raw = current?.raw_json || {};
  const hist = Array.isArray(raw.obs_historico) ? raw.obs_historico : [];
  hist.push({
    ts: new Date().toISOString(),
    status: newStatus,
    obs: obs || '',
    user: userName || '',
  });

  const { error } = await supabase
    .from('oobj_nfe_recebidas')
    .update({
      status_portal: newStatus,
      raw_json: { ...raw, obs_historico: hist },
      updated_at: new Date().toISOString(),
    })
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

// ── KPIs ──────────────────────────────────────────────────────────────────────
export async function dbGetKpis() {
  syncAuthToken();
  const [total, pendentes, emAnalise, concluidas] = await Promise.all([
    supabase.from('oobj_nfe_recebidas').select('valor', { count: 'exact' }).eq('tipo', 'devolucao'),
    supabase.from('oobj_nfe_recebidas').select('valor', { count: 'exact' }).eq('tipo', 'devolucao').eq('status_portal', 'pendente'),
    supabase.from('oobj_nfe_recebidas').select('valor', { count: 'exact' }).eq('tipo', 'devolucao').eq('status_portal', 'em_analise'),
    supabase.from('oobj_nfe_recebidas').select('valor', { count: 'exact' }).eq('tipo', 'devolucao').in('status_portal', ['aprovada', 'rejeitada', 'concluida']),
  ]);

  const soma = (rows) => (rows?.data || []).reduce((s, r) => s + parseFloat(r.valor || 0), 0);

  return {
    total_count:    total.count     || 0,
    total_valor:    soma(total),
    pendente_count: pendentes.count || 0,
    pendente_valor: soma(pendentes),
    analise_count:  emAnalise.count || 0,
    concluida_count:concluidas.count|| 0,
  };
}
