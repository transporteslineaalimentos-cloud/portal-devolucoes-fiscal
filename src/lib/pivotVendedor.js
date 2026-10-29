import { useMemo } from 'react';

/* Agrupa o bloco 'vendedor' do painel (cod, nome, mes, valor, qtd, fat) por vendedor. */
export const SEM_COD = '—';
export const FAT_MINIMO = 50000;   // abaixo disso o índice oscila demais para ranquear

export function usePivotVendedor(linhas, ini, fim) {
  return useMemo(() => {
    const m = new Map();
    for (const r of linhas || []) {
      if (!m.has(r.cod)) m.set(r.cod, { cod: r.cod, nome: r.nome, dev: Array(12).fill(0), fat: Array(12).fill(0), qtd: Array(12).fill(0), devT: 0, fatT: 0, qT: 0 });
      const o = m.get(r.cod);
      const i = Number(r.mes) - 1;
      if (i < 0 || i > 11) continue;
      o.dev[i] += Number(r.valor) || 0; o.fat[i] += Number(r.fat) || 0; o.qtd[i] += Number(r.qtd) || 0;
      if (r.mes >= ini && r.mes <= fim) { o.devT += Number(r.valor) || 0; o.fatT += Number(r.fat) || 0; o.qT += Number(r.qtd) || 0; }
    }
    const todos = [...m.values()];
    const devG = todos.reduce((s, o) => s + o.devT, 0);
    const fatG = todos.reduce((s, o) => s + o.fatT, 0);
    return { todos, devG, fatG, media: fatG ? devG / fatG : 0, sem: m.get(SEM_COD) || null };
  }, [linhas, ini, fim]);
}

