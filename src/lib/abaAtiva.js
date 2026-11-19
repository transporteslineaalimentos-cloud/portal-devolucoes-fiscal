import { createContext, useContext, useEffect, useRef } from 'react';

/* As abas já visitadas ficam montadas (escondidas) para a troca entre elas ser instantânea.
   Este contexto diz se a aba do componente é a que está na tela. */
export const AbaAtivaContext = createContext(true);
export const useAbaAtiva = () => useContext(AbaAtivaContext);

/** Quando a aba volta para a tela, roda `fn` (atualização em segundo plano) se a última
 *  atualização tiver mais de `idadeMs`. Na primeira montagem não roda: cada tela já carrega sozinha. */
export function useAoVoltar(fn, idadeMs = 60000) {
  const ativa = useAbaAtiva();
  const fnRef = useRef(fn);
  useEffect(() => { fnRef.current = fn; });
  const estado = useRef({ antes: ativa, ultima: 0 });
  useEffect(() => {
    const e = estado.current;
    const agora = Date.now();
    if (!e.ultima) e.ultima = agora;
    if (ativa && !e.antes && agora - e.ultima > idadeMs) { e.ultima = agora; fnRef.current?.(); }
    e.antes = ativa;
  }, [ativa, idadeMs]);
}
