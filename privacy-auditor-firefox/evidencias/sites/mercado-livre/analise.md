# Identificação

- Site: Mercado Livre
- URL: https://www.mercadolivre.com.br/
- Data e horário: 28/09/2026; HAR de 19:33:13 a 19:33:16 (UTC−03:00); nova coleta do Privacy Auditor entre 23:20 e 23:22; uBlock entre 23:39:11 e 23:39:43; horário do Blacklight PENDENTE no print.
- Firefox: 156.0.1, conforme metadados do HAR.
- Proteção contra rastreamento: PENDENTE — não aparece nas evidências.
- Estado de login: PENDENTE — não pode ser inferido com segurança.
- Decisão sobre cookies: cookies aceitos, conforme informado durante a coleta manual. O cookie `hide-cookie-banner` presente no HAR é compatível com uma interação com o banner, mas, isoladamente, não comprovaria qual opção foi escolhida.
- Tempo de observação: o HAR cobre aproximadamente 3,8 s; o período observado pelo popup é PENDENTE e o HAR não atende aos 30 s planejados.
- Interações: PENDENTE — a rolagem prevista não é comprovável pelos arquivos.

# Privacy Auditor

- Total de requisições: 236.
- Domínios de terceiros: 9 — `google.com`, `gstatic.com`, `meli.com`, `mercadoclics.com`, `mercadolibre.com`, `mercadolivre.com`, `mercadopago.com`, `mercadopago.com.br` e `mlstatic.com`.
- Cookies de primeira parte: 8 persistentes e pelo menos 1 de sessão visível entre os preexistentes.
- Cookies de terceiros: 8 persistentes no resumo do score.
- Cookies de sessão: pelo menos 1 cookie de sessão de primeira parte (`_csrf`) visível.
- Cookies persistentes: 16 no resumo do score, sendo 8 de primeira parte e 8 de terceiros.
- localStorage: não observado no resumo do score.
- sessionStorage: 1 origem; quantidade de chaves PENDENTE.
- IndexedDB: não observado no resumo do score.
- Canvas fingerprinting: não detectado.
- Bounce tracking: não detectado.
- Cookie sync/query parameters: possível compartilhamento detectado; o print mostra o mesmo hash associado ao parâmetro `value` em domínios dos ecossistemas Mercado Livre e Mercado Pago.
- Indicadores de hijacking/hook: substituição de `fetch` e `XMLHttpRequest.open` detectada no frame principal.
- Score: 45/100.
- Arquivo do print: 7 capturas em `plugin/`, entre `23.20.46` e `23.22.57`.

Observação: a nova captura comprova que o domínio principal passou a ser exibido
corretamente como `mercadolivre.com.br`.

# Blacklight

- Cookies de terceiros: 16.
- Ad trackers: 11.
- Canvas fingerprinting: PENDENTE — a seção não está visível no print.
- Session recording: não encontrado pelo Blacklight.
- Key logging: não encontrado pelo Blacklight.
- Pixels: Facebook aparece como detectado; outros pixels e a quantidade total estão PENDENTES porque a parte inferior do relatório não foi capturada.
- Outras observações: tracking que evade bloqueadores de cookies não foi encontrado; a lista expandida de trackers/domínios não foi capturada. A URL mostrada pelo Blacklight possui query truncada no print.
- Arquivo do print: `blacklight/Captura de Tela 2026-09-28 às 19.34.35.png`.

# uBlock Origin

- Total de requisições bloqueadas: 53 (8% das requisições da página).
- Domínios bloqueados: o Logger comprova bloqueio de `mercadoclics.com`; a lista completa não foi exportada.
- Tipos de recurso: `xhr` aparece no bloqueio de rede visível. O Logger também mostra aplicação do scriptlet `prevent-clipboard-write`, que é modificação cosmética/comportamental e não uma requisição de rede bloqueada.
- Domínios conectados: 9 de 14.
- Arquivo do print: `ublock/Captura de Tela 2026-09-28 às 23.39.11.png` e `ublock/Captura de Tela 2026-09-28 às 23.39.43.png`.

# Evidências do HAR

- Total de requisições: 122.
- Domínios observados: 11 hosts únicos; 9 hosts e 7 domínios registráveis classificados heuristicamente como terceiros. Os sete são `google.com`, `gstatic.com`, `hotjar.com`, `meli.com`, `mercadoclics.com`, `mercadolibre.com` e `mlstatic.com`.
- Requisições relevantes: 86 para `http2.mlstatic.com`, 13 para `print1.mercadoclics.com`, 8 para `api.mercadolibre.com`, 4 para `accounts.google.com`, 3 para `o11y-proxy-otel-frontend.meli.com` e uma para cada host do Hotjar (`script.hotjar.com` e `static.hotjar.com`).
- Redirecionamentos: nenhum registrado.
- Cookies: 13 respostas possuem `Set-Cookie`, totalizando 15 cabeçalhos em `www.mercadolivre.com.br`, `o11y-proxy-otel-frontend.meli.com` e `print1.mercadoclics.com`; nomes observados: `_mldataSessionId`, `x-theme`, `hide-cookie-banner` e `_d2id`.
- Parâmetros identificadores: 8 combinações heurísticas em três hosts. Incluem `client_id`, `unique_id`, `channel_id` e outros valores longos; todos os valores estão mascarados.
- WebSockets: nenhum registrado no HAR.
- Possível polling: nenhum padrão atingiu os critérios da heurística.
- Nome do arquivo HAR: `har/mercadolivre.har`; resumos `har/mercadolivre.summary.md` e `har/mercadolivre.summary.json`.

## Revisão de sensibilidade do HAR

O arquivo original contém valores sensíveis ou potencialmente identificadores:
12 cabeçalhos de requisição `Cookie`, 48 ocorrências de objetos de cookie, 15
cabeçalhos `Set-Cookie`, 52 parâmetros de query, 12 corpos POST, 95 cabeçalhos
`Referer`, 82 corpos de resposta incorporados e 33 endereços de servidor. Não
há cabeçalho `Authorization` registrado. O HAR original não foi alterado e
deve ser revisado manualmente antes de compartilhamento público.

# Reconciliação

| Domínio ou indicador | Privacy Auditor | Blacklight | uBlock | Evidência no HAR | Explicação técnica |
| -------------------- | --------------- | ---------- | ------ | ---------------- | ------------------ |
| Terceiros | 9 domínios registráveis, com lista capturada | 11 ad trackers | 9 de 14 domínios conectados | 7 possíveis domínios registráveis de terceiro | A diferença decorre de execuções e taxonomias distintas. Plugin e HAR coincidem em `google.com`, `gstatic.com`, `meli.com`, `mercadoclics.com`, `mercadolibre.com` e `mlstatic.com`; a nova execução do plugin também alcançou domínios adicionais. |
| Cookies de terceiros | 8 persistentes | 16 cookies | Não é uma métrica do Logger | `Set-Cookie` em `meli.com`, `mercadoclics.com` e no domínio principal | A nova coleta elimina a antiga divergência “zero”, mas as contagens continuam diferentes porque Blacklight usa navegador remoto e o HAR registra eventos, enquanto o plugin observa o cookie jar. |
| `mercadoclics.com` | Presente entre os terceiros e com cookie `_d2id` observado | Pode integrar os 11 trackers, mas a lista não está expandida | Requisição `xhr` bloqueada no Logger | 13 requisições para `print1.mercadoclics.com` e `Set-Cookie` no HAR | Concordância concreta entre plugin, Logger e HAR para a participação do domínio. |
| Hotjar | Não aparece na lista da nova execução; hooks de `fetch` e XHR detectados | Session recording não encontrado | Não aparece no trecho visível do Logger | `script.hotjar.com` e `static.hotjar.com`, uma requisição cada | Carregar scripts do Hotjar no HAR não prova gravação de sessão; as execuções diferentes explicam a ausência nas demais capturas. |
| Substituição de API | `fetch` e `XMLHttpRequest.open` detectados | Não é métrica apresentada no print | Logger mostra aplicação de scriptlet, mas não confirma as mesmas substituições | HAR não registra identidade de funções JavaScript | São observações de execução JavaScript; o HAR não consegue confirmar ou refutar a substituição. |
| Cookie sync/query | Possível detecção pelo mesmo hash no parâmetro `value` entre domínios distintos | PENDENTE | Não é métrica do Logger | 8 parâmetros candidatos, sem correlação de hash no resumo | O plugin correlaciona valores localmente por hash; o resumo HAR apenas identifica candidatos e não preserva valores para comparação. |
| Canvas fingerprinting | Não detectado | PENDENTE | Não é métrica do Logger | HAR não registra chamadas JavaScript a canvas | A seção do Blacklight não foi capturada e o HAR não é evidência adequada. |
| Lista domínio a domínio | Lista completa de 9 domínios capturada | Lista não expandida | `mercadoclics.com` visível como bloqueado | Lista completa disponível no resumo HAR | `mercadoclics.com` é a concordância nominal comprovada entre plugin, Logger e HAR. |

# Comparação crítica

- Pontos de concordância: plugin e HAR compartilham seis domínios registráveis; `mercadoclics.com` também aparece bloqueado no uBlock; nenhum redirect, WebSocket ou polling foi observado nas evidências correspondentes.
- Pontos de divergência: 8 cookies persistentes de terceiros no plugin contra 16 no Blacklight e eventos `Set-Cookie` no HAR; 236 requisições no plugin contra 122 no HAR.
- Motivos das divergências: o HAR cobre apenas 3,8 s; Blacklight executa em ambiente remoto; bloqueio do uBlock altera o tráfego; tentativa `Set-Cookie` não equivale a cookie aceito.
- Limitações do teste: lista completa do Logger não exportada, seções inferiores do Blacklight ausentes, configuração de proteção/login não registrada e janela HAR muito menor que 30 s.
