# Identificação

- Site: Wikipedia em português
- URL: https://pt.wikipedia.org/wiki/Wikip%C3%A9dia:P%C3%A1gina_principal
- Data e horário: HAR de 28/09/2026, das 19:38:02 às 19:38:18 (America/Sao_Paulo); nova coleta do Privacy Auditor entre 23:24:11 e 23:24:56; uBlock entre 23:40:10 e 23:40:31; Blacklight às 16:53 ET
- Firefox: 156.0.1, conforme o HAR e confirmado durante a coleta manual
- Proteção contra rastreamento: PENDENTE
- Estado de login: PENDENTE
- Decisão sobre cookies: não houve aceite de cookies; nenhum banner foi aceito durante a coleta manual
- Tempo de observação: aproximadamente 15,9 segundos no HAR; duração correspondente ao popup: PENDENTE
- Interações: PENDENTE

# Privacy Auditor

- Total de requisições: 40
- Domínios de terceiros: 1 — `wikimedia.org`
- Cookies de primeira parte: 4 persistentes no resumo do score
- Cookies de terceiros: 9 persistentes e 1 de sessão no resumo do score
- Cookies de sessão: 1 de terceiro
- Cookies persistentes: 13 (4 de primeira parte e 9 de terceiros)
- localStorage: 0 chaves na origem principal
- sessionStorage: 0 chaves na origem principal
- IndexedDB: nenhum banco encontrado na origem principal
- Canvas fingerprinting: não detectado
- Bounce tracking: não detectado
- Cookie sync/query parameters: não detectado
- Indicadores de hijacking/hook: não detectados
- Score: 78/100
- Arquivo do print: 5 capturas em `plugin/`, entre `23.24.11` e `23.24.56`

# Blacklight

- Cookies de terceiros: 4
- Ad trackers: 0
- Canvas fingerprinting: PENDENTE; a seção correspondente não aparece no print
- Session recording: não detectado
- Key logging: não detectado
- Pixels: Facebook Pixel e TikTok Pixel não detectados; outros tipos de pixel: PENDENTE
- Outras observações: o Blacklight informou que não encontrou mecanismo que contornasse bloqueadores de cookies. A captura não contém todas as seções do relatório.
- Arquivo do print: `blacklight/Captura de Tela 2026-09-28 às 19.39.42.png`

# uBlock Origin

- Total de requisições bloqueadas: 0 (0%)
- Domínios bloqueados: nenhum
- Tipos de recurso bloqueados: nenhum; o Logger mostra recursos permitidos dos tipos `image` e `script`
- Domínios conectados: 2 de 2
- Arquivo do print: `ublock/Captura de Tela 2026-09-28 às 23.40.10.png` e `ublock/Captura de Tela 2026-09-28 às 23.40.31.png`

# Evidências do HAR

- Total de requisições: 38
- Domínios observados: 3 hostnames — `pt.wikipedia.org` (19), `upload.wikimedia.org` (17) e `meta.wikimedia.org` (2)
- Requisições relevantes: 19 para `pt.wikipedia.org`, 17 para `upload.wikimedia.org` e 2 para `meta.wikimedia.org`; pelos domínios registráveis, `wikimedia.org` é a única terceira parte em relação a `wikipedia.org`
- Redirecionamentos: 0
- Cookies: 2 respostas com `Set-Cookie`, somando 4 cabeçalhos, todas em `upload.wikimedia.org`; nomes observados: `GeoIP` e `NetworkProbeLimit`. Valores não foram reproduzidos.
- Parâmetros identificadores: 3 ocorrências heurísticas envolvendo os nomes `modules`, `image` e `title`; os nomes e o contexto são compatíveis com conteúdo/configuração, não bastando para comprovar identificadores
- WebSockets: 0
- Possível polling: nenhum padrão detectado
- Nome do arquivo HAR: `har/wikipedia.har`
- Resumos gerados: `har/wikipedia.summary.md` e `har/wikipedia.summary.json`

## Informações potencialmente sensíveis no HAR

- 15 requisições possuem o cabeçalho `Cookie`, com 80 objetos de cookie estruturados no total.
- Há 4 cabeçalhos `Set-Cookie` e 4 objetos de cookie de resposta.
- Foram encontrados 117 parâmetros de query; nenhum nome coincide exatamente com a lista de nomes sensíveis usada pelo analisador.
- O arquivo inclui 35 cabeçalhos `Referer`, 12 conteúdos de resposta incorporados e 9 endereços IP de servidores.
- Não foi encontrado cabeçalho `Authorization` e não há corpo de POST.

O HAR original não foi alterado. Antes de divulgação, ele precisa de revisão/redação porque cookies, URLs, referenciadores, respostas e IPs podem conter dados de sessão ou navegação.

# Reconciliação

| Domínio ou indicador | Privacy Auditor | Blacklight | uBlock | Evidência no HAR | Explicação técnica |
| -------------------- | --------------- | ---------- | ------ | ---------------- | ------------------ |
| Terceiros | 1 domínio: `wikimedia.org` | 0 ad trackers | 2 de 2 domínios conectados; 0 bloqueios | 1 domínio registrável de terceiro: `wikimedia.org` | Há concordância: Wikimedia foi acessado, mas não classificado/bloqueado como rastreador pelo Blacklight ou uBlock. “Terceiro” descreve relação de origem, não necessariamente rastreamento. |
| Cookies de terceiros | 9 persistentes e 1 de sessão | 4 cookies | Nenhuma requisição bloqueada | 4 `Set-Cookie` em `upload.wikimedia.org` | As contagens divergem porque são execuções distintas e métricas diferentes: estado/eventos vistos pelo plugin, visita remota do Blacklight e cabeçalhos no HAR. |
| `upload.wikimedia.org`, `meta.wikimedia.org` e `auth.wikimedia.org` | Agrupados sob `wikimedia.org`; cookies visíveis em `auth` e `meta` | Cookie atribuído à Wikimedia Foundation | Permitidos no Logger | HAR contém `upload` e `meta`; `auth` aparece apenas na nova coleta | Subdomínios distintos pertencem ao mesmo domínio registrável. A ausência de `auth` no HAR é explicada pelas diferentes execuções. |
| Cookies persistentes de terceiros | 9, além de 1 de sessão | 4 cookies de terceiros | O Logger não contabiliza cookies; 0 bloqueios | 4 cabeçalhos `Set-Cookie` em respostas de `upload.wikimedia.org`, com 2 nomes únicos | As ferramentas podem contar cookies únicos, gravações/regravações ou estado final. O plugin e o HAR também correspondem a execuções diferentes. |
| Ad trackers | Não há categoria equivalente no popup | 0 | 0 bloqueios | Não aparecem hosts publicitários externos; apenas domínios Wikipedia/Wikimedia | A concordância é forte para a coleta observada, mas um HAR curto não prova ausência universal. |
| Cookie sync/query parameters | Não detectado | PENDENTE | Não é métrica do Logger | 3 candidatos heurísticos (`modules`, `image`, `title`), sem evidência de identificador compartilhado entre terceiros | Os nomes descrevem conteúdo/configuração; não há base para classificá-los como cookie sync. |
| Canvas fingerprinting | Não detectado | PENDENTE | Não é métrica do Logger | HAR não observa chamadas JavaScript ao canvas | O HAR não é capaz de confirmar ou refutar leitura de canvas. |
| Facebook/TikTok Pixel | Não observado pelo plugin | Não detectados | Nenhum bloqueio | Nenhum hostname de Facebook ou TikTok no HAR | As quatro fontes não apresentam evidência desses pixels nesta coleta. |

# Comparação crítica

- Pontos de concordância: Privacy Auditor e HAR indicam uma única terceira parte por domínio registrável; Blacklight e HAR não apresentam evidência de ad trackers; não há redirecionamento, WebSocket nem polling no HAR.
- Pontos de divergência: o Privacy Auditor mostra 40 requisições, enquanto o HAR contém 38; o Privacy Auditor mostra 10 cookies de terceiro, o Blacklight relata 4 e o HAR contém 4 cabeçalhos `Set-Cookie` com 2 nomes únicos.
- Motivos das divergências: janelas de coleta diferentes, contagem de eventos versus cookies únicos, diferença entre hostname e domínio registrável, cache, requisições internas da extensão/DevTools e critérios próprios do Blacklight.
- Limitações do teste: o HAR cobre só 15,9 segundos, as execuções não são simultâneas, o print do Blacklight é parcial e configuração de proteção, login e interações não foram documentadas.
