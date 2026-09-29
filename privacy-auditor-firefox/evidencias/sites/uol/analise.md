# Identificação

- Site: UOL
- URL: https://www.uol.com.br/
- Data e horário: 28/09/2026; HAR de 19:15:51 a 19:18:48 (UTC−03:00); nova coleta do Privacy Auditor entre 23:15 e 23:17; uBlock entre 23:38:03 e 23:38:41; Blacklight informa 15:22 ET.
- Firefox: 156.0.1, conforme metadados do HAR.
- Proteção contra rastreamento: PENDENTE — não aparece nas evidências.
- Estado de login: PENDENTE — não pode ser inferido com segurança.
- Decisão sobre cookies: cookies aceitos, conforme informado durante a coleta manual.
- Tempo de observação: o HAR cobre aproximadamente 2 min 57 s; o período exato observado pelo popup é PENDENTE e não coincide com os 30 s planejados.
- Interações: PENDENTE — a rolagem prevista não é comprovável pelos arquivos.

# Privacy Auditor

- Total de requisições: 472.
- Domínios de terceiros: 37 domínios registráveis; a lista aparece parcialmente no print e inclui `adnxs.com`, `amazon-adsystem.com`, `criteo.com`, `doubleclick.net`, `google-analytics.com`, `googlesyndication.com` e `googletagmanager.com`.
- Cookies de primeira parte: 33 persistentes no resumo do score; cookies de sessão de primeira parte não aparecem.
- Cookies de terceiros: 11 persistentes no resumo do score; cookies de sessão de terceiro não aparecem.
- Cookies de sessão: nenhum indicado no resumo do score.
- Cookies persistentes: 44, sendo 33 de primeira parte e 11 de terceiros.
- localStorage: 3 origens; quantidade de chaves PENDENTE.
- sessionStorage: 3 origens; quantidade de chaves PENDENTE.
- IndexedDB: 2 origens; nomes e versões PENDENTE.
- Canvas fingerprinting: não detectado.
- Bounce tracking: não detectado.
- Cookie sync/query parameters: possível compartilhamento de identificador detectado.
- Indicadores de hijacking/hook: possível polling persistente detectado.
- Score: 39/100.
- Arquivo do print: 7 capturas em `plugin/`, entre `23.15.08` e `23.17.31`.

Observação: a nova captura comprova que o domínio principal passou a ser exibido
corretamente como `uol.com.br`.

# Blacklight

- Cookies de terceiros: 14.
- Ad trackers: 21.
- Canvas fingerprinting: PENDENTE — a seção não está visível no print.
- Session recording: não encontrado pelo Blacklight.
- Key logging: não encontrado pelo Blacklight.
- Pixels: Facebook aparece como detectado; outros pixels e a quantidade total estão PENDENTES porque a parte inferior do relatório não foi capturada.
- Outras observações: tracking que evade bloqueadores de cookies não foi encontrado; a lista expandida de trackers/domínios não foi capturada.
- Arquivo do print: `blacklight/Captura de Tela 2026-09-28 às 19.20.35.png`.

# uBlock Origin

- Total de requisições bloqueadas: 47 (11% das requisições da página).
- Domínios bloqueados: o Logger comprova bloqueios em `doubleclick.net`; a captura anterior da mesma coleta também mostra `youtube.com`. A lista completa não foi exportada.
- Tipos de recurso: `xhr` aparece nos bloqueios visíveis; demais tipos permanecem PENDENTES.
- Domínios conectados: 17 de 25.
- Arquivo do print: `ublock/Captura de Tela 2026-09-28 às 23.38.03.png` e `ublock/Captura de Tela 2026-09-28 às 23.38.41.png`.

# Evidências do HAR

- Total de requisições: 494.
- Domínios observados: 67 hosts únicos; 56 hosts e 33 domínios registráveis classificados heuristicamente como terceiros. A lista completa está em `har/uol.summary.md`.
- Requisições relevantes: 99 para `video47.mais.uol.com.br`, 67 para `conteudo.imguol.com.br`, 27 para `pagead2.googlesyndication.com`, 25 para `events.newsroom.bi`, 23 para `sb.scorecardresearch.com`, 19 para `fundingchoicesmessages.google.com`, 18 para `securepubads.g.doubleclick.net` e 15 para `ib.adnxs.com`.
- Redirecionamentos: 7; cinco respostas 302 em `scorecardresearch.com` e duas 307 em `adnxs.com`. Todos permanecem no mesmo domínio registrável e não sustentam, por si, bounce tracking entre domínios.
- Cookies: 65 respostas possuem `Set-Cookie`, totalizando 138 cabeçalhos em 10 hosts; foram identificados 19 nomes de cookies, sem expor valores.
- Parâmetros identificadores: 93 combinações heurísticas de domínio/nome/regra em 22 hosts. Entre os nomes estão `cid`, `id`, `ppid` e `sid`; valores permanecem mascarados. Isso comprova parâmetros candidatos, mas não comprova sozinho que o mesmo valor foi sincronizado.
- WebSockets: nenhum registrado no HAR.
- Possível polling: dois padrões — GET para `video47.mais.uol.com.br/live/4938.mpd` (33 chamadas, média de 5007 ms) e POST para `events.newsroom.bi/ingest.php` (17 chamadas, média de 15002 ms).
- Nome do arquivo HAR: `har/uol.har`; resumos `har/uol.summary.md` e `har/uol.summary.json`.

## Revisão de sensibilidade do HAR

O arquivo original contém valores sensíveis ou potencialmente identificadores:
246 cabeçalhos de requisição `Cookie`, 4514 ocorrências de objetos de cookie,
138 cabeçalhos `Set-Cookie`, 1974 parâmetros de query, 95 corpos POST, 487
cabeçalhos `Referer`, 353 corpos de resposta incorporados e 330 endereços de
servidor. Não há cabeçalho `Authorization` registrado. O HAR original não foi
alterado e deve ser revisado manualmente antes de compartilhamento público.

# Reconciliação

| Domínio ou indicador | Privacy Auditor | Blacklight | uBlock | Evidência no HAR | Explicação técnica |
| -------------------- | --------------- | ---------- | ------ | ---------------- | ------------------ |
| Terceiros | 37 domínios registráveis | 21 ad trackers | 17 de 25 domínios conectados | 33 possíveis domínios registráveis de terceiro | As métricas não são equivalentes: plugin e HAR observam execuções distintas; Blacklight conta trackers classificados; uBlock conta conexões permitidas dentro de uma navegação com bloqueio ativo. |
| Cookies de terceiros | 11 persistentes | 14 cookies | Não é uma métrica do Logger | `Set-Cookie` em 10 hosts, 65 respostas e 138 cabeçalhos | Plugin conta cookies no cookie jar; Blacklight aplica sua taxonomia; HAR conta eventos de resposta, inclusive repetições. O uBlock altera o tráfego antes que alguns cookies possam ser definidos. |
| `doubleclick.net` | Presente na lista de terceiros | A lista expandida não foi capturada | Bloqueio `xhr` visível no Logger | `securepubads.g.doubleclick.net` aparece no HAR | Concordância concreta entre plugin, uBlock e HAR para participação do domínio; o Blacklight comprova trackers publicitários, mas não expõe esse nome no print. |
| Possível cookie sync | Detectado | PENDENTE | Não é métrica do Logger | 93 parâmetros candidatos em 22 hosts, incluindo `cid`, `id`, `ppid` e `sid` | O HAR sustenta tráfego com identificadores potenciais, mas o resumo mascara valores e não prova a igualdade de hash observada pelo plugin. |
| Polling persistente | Detectado | Não é métrica apresentada no print | Logger mostra repetição de XHR para manifesto de vídeo, sem classificá-la como polling | Dois padrões regulares em `video47.mais.uol.com.br` e `events.newsroom.bi` | Há concordância entre a heurística do plugin, repetição visível no Logger e padrão temporal no HAR; a finalidade das chamadas não é comprovada. |
| Bounce tracking | Não detectado | PENDENTE | Não é métrica do Logger | 7 redirects, todos dentro do mesmo domínio registrável | Os redirects observados não formam a cadeia entre três domínios exigida pela heurística. |
| Canvas fingerprinting | Não detectado | PENDENTE | Não é métrica do Logger | HAR não registra chamadas JavaScript a canvas | Não é possível reconciliar Blacklight sem a seção correspondente; HAR não é evidência adequada para leitura de canvas. |
| Lista domínio a domínio | Lista parcial capturada | Lista não expandida | Exemplos visíveis: `doubleclick.net` e `youtube.com` | Lista completa disponível no resumo HAR | `doubleclick.net` é a concordância nominal comprovada entre plugin, Logger e HAR; a lista integral do uBlock não foi exportada. |

# Comparação crítica

- Pontos de concordância: o polling indicado pelo Privacy Auditor possui dois padrões temporais no HAR; plugin e Blacklight observam presença significativa de cookies de terceiros.
- Pontos de divergência: 37 domínios no plugin contra 33 possíveis domínios registráveis no HAR; 11 cookies persistentes de terceiros no plugin contra 14 no Blacklight; 472 requisições no plugin contra 494 no HAR.
- Motivos das divergências: janelas de captura diferentes, navegador remoto do Blacklight, bloqueio prévio pelo uBlock, definições diferentes de tracker/cookie e repetição de `Set-Cookie` no HAR.
- Limitações do teste: lista completa do Logger não exportada, lista do Blacklight não expandida, configuração de proteção/login não registrada e HAR com duração superior aos 30 segundos planejados.
