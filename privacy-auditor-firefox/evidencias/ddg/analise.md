# Relatório dos testes DuckDuckGo Privacy Test Pages

## Identificação

- Data das capturas: 28/09/2026
- Navegador e versão: PENDENTE
- Perfil utilizado: perfil de teste do Privacy Auditor
- Proteção contra rastreamento do Firefox: PENDENTE
- Versão/identificador da extensão: PENDENTE

## Tabela de resultados

Os resultados abaixo descrevem somente o que está comprovado pelos arquivos em
`evidencias/ddg/prints`. “Detectado” significa que a heurística da extensão foi
acionada; não constitui prova de rastreamento ou ataque.

| Teste | Resultado esperado pela página | Resultado observado no Privacy Auditor | Comparação e explicação técnica | Evidência |
| --- | --- | --- | --- | --- |
| Tracker Reporting — 1 major tracker via script | Carregar um rastreador conhecido por meio de `script src`. | 3 requisições, 1 domínio de terceiro (`doubleclick.net`), incluindo 1 requisição do tipo `script`; score 98/100. | Concordância no nível de rede: o recurso de terceiro foi observado. A página usa uma lista de reputação para chamá-lo de “major tracker”; o Privacy Auditor classifica primeira/terceira parte e não atribui essa reputação ao domínio. | [Popup — visão geral](<prints/TrackerReporting/ViaScript/Captura de Tela 2026-09-28 às 21.49.20.png>) e [domínio/tipos](<prints/TrackerReporting/ViaScript/Captura de Tela 2026-09-28 às 21.49.36.png>) |
| Storage Blocking | Tentar gravar e recuperar dados em mecanismos de armazenamento de terceiros. A página exibiu `90` para localStorage, sessionStorage, IndexedDB, Cache API e Cookie Store; WebSQL não estava disponível. | 63 requisições e 2 domínios de terceiro. Foram observadas 3 origens com localStorage, 3 com sessionStorage, 2 com IndexedDB e 24 cookies criados/alterados. | O Firefox permitiu recuperar os mecanismos suportados nessa execução. A extensão inventaria chaves e bancos por origem/frame, sem ler valores, mas não afirma que o armazenamento foi bloqueado. WebSQL, Cache API e Cookie Store estão fora do inventário HTML5 atual do popup. | [Resultado da página](<prints/PrivacyProtections/StorageBlocking/Captura de Tela 2026-09-28 às 21.54.32.png>), [resumo](<prints/PrivacyProtections/StorageBlocking/Captura de Tela 2026-09-28 às 21.55.15.png>) e [storage](<prints/PrivacyProtections/StorageBlocking/Captura de Tela 2026-09-28 às 21.56.40.png>) |
| Fingerprinting | Coletar diversos atributos do navegador que podem compor uma impressão digital. | 9 requisições, nenhum domínio de terceiro e score 67/100. O Privacy Auditor detectou 10 leituras de canvas por `getImageData` e `toDataURL`, relacionadas a `fingerprinting/helpers/tests.js`. | Concordância parcial: a extensão comprova leituras de canvas, mas não monitora todos os demais atributos coletados pela página. Os 7 cookies preexistentes visíveis vieram do teste anterior no mesmo site e não devem ser atribuídos ao fingerprinting. | [Visão geral](<prints/PrivacyProtections/FingerPrinting/Captura de Tela 2026-09-28 às 22.01.24.png>), [score](<prints/PrivacyProtections/FingerPrinting/Captura de Tela 2026-09-28 às 22.01.31.png>) e [canvas](<prints/PrivacyProtections/FingerPrinting/Captura de Tela 2026-09-28 às 22.02.59.png>) |
| Canvas Verification | Executar operações de renderização e leitura do canvas. | Possível canvas fingerprinting detectado, com 127 leituras por `getImageData` e `toDataURL`; origem no frame principal e referência a `fingerprinting/canvas.js`. | Concordância: os wrappers registraram a leitura do conteúdo, que é o comportamento relevante para a heurística. A extensão não armazena pixels nem conteúdo do canvas. O número alto representa chamadas, não 127 rastreadores distintos. | [Contagem e métodos](<prints/PrivacyProtections/CanvasVerification/Captura de Tela 2026-09-28 às 22.06.54.png>) |
| Tracker Blocking | Após incluir `bad.third-party.site` na lista, os recursos desse domínio devem falhar ou deixar de carregar. | Bloqueio ativo, domínio presente na lista e 22 requisições correspondentes exibidas como detectadas. O resultado exportado pela página contém 10 recursos `not loaded`, 12 `failed` e 1 `loaded` (`serviceworker-fetch`). | Há forte concordância com o bloqueio: 22 dos 23 mecanismos não carregaram normalmente. Entretanto, o print não mostra a contagem da subseção “Bloqueadas”; portanto, a correspondência exata entre as 22 falhas e cancelamentos efetuados pela extensão permanece PENDENTE. O único carregamento por Service Worker é uma limitação/divergência concreta do teste. | [Configuração e detectadas](<prints/PrivacyProtections/TrackerBlocking/Captura de Tela 2026-09-28 às 22.18.07.png>) e [resultado JSON](prints/PrivacyProtections/TrackerBlocking/request-blocking-results.json) |
| Storage Partitioning | Verificar se dados gravados em contexto de terceiro ficam isolados por site de primeira parte. A página marcou como recuperados vários mecanismos; WebSQL ficou indisponível e Prefetch Cache apresentou erro. | 26 requisições, 1 domínio de terceiro, 10 cookies e uma origem reportada para localStorage, sessionStorage e IndexedDB; score 72/100. | A página testa isolamento e equivalência entre contextos; a extensão apenas inventaria quantidades por origem/frame. Por isso, o popup não permite concluir sozinho se houve particionamento. Os cookies preexistentes visíveis podem ter sido herdados de testes anteriores. | [Resultado da página](<prints/PrivacyProtections/StoragePartioning/Captura de Tela 2026-09-28 às 22.20.16.png>), [visão geral](<prints/PrivacyProtections/StoragePartioning/Captura de Tela 2026-09-28 às 22.20.46.png>) e [score](<prints/PrivacyProtections/StoragePartioning/Captura de Tela 2026-09-28 às 22.20.53.png>) |
| Query Parameters | Remover parâmetros conhecidos de rastreamento, preservando parâmetros funcionais. | Não há captura do popup do Privacy Auditor para esse teste. A página preservou `utm_source` no caso 1, preservou `utm_source` e `utm_medium` no caso 2, preservou `fbclid` e `fb_source` no caso 3 e manteve corretamente `q` e `id` no caso 4. Resultado da extensão: PENDENTE. | A página avalia remoção de parâmetros pelo navegador/extensão. O Privacy Auditor foi projetado para detectar possíveis identificadores, não para removê-los; logo, a permanência dos parâmetros não demonstra falha da heurística. Sem o popup, não é possível comprovar quais parâmetros ele sinalizou. | [Caso 1](<prints/PrivacyProtections/QueryParameters/Captura de Tela 2026-09-28 às 22.26.57.png>), [caso 2](<prints/PrivacyProtections/QueryParameters/Captura de Tela 2026-09-28 às 22.27.34.png>), [caso 3](<prints/PrivacyProtections/QueryParameters/Captura de Tela 2026-09-28 às 22.27.51.png>) e [caso 4](<prints/PrivacyProtections/QueryParameters/Captura de Tela 2026-09-28 às 22.28.09.png>) |
| Bounce Tracking | Passar automaticamente por um domínio intermediário e chegar ao destino, possibilitando reconhecer uma navegação de curta duração entre domínios distintos. | Nas quatro capturas anteriores à correção, o popup exibiu somente o destino final e “Não detectado”. Novo resultado após a correção: PENDENTE. | Divergência comprovada na execução antiga: a cadeia era reinicializada entre requisições de navegação, perdendo o intermediário. A implementação foi corrigida, mas é necessária uma nova execução para provar o comportamento; o relatório não presume que a correção funcionou no Firefox. | [Execução antiga — exemplo](<prints/PrivacyProtections/BounceTracking/Captura de Tela 2026-09-28 às 22.31.35.png>) |
| JavaScript leaks / hijacking e hooks | Exercitar comportamentos relacionados a scripts e alterações de APIs monitoradas. | PENDENTE — não existem capturas desse conjunto de páginas. | Não há evidência suficiente para preencher o resultado. | PENDENTE |

## Pendências para fechar esta seção

1. Registrar a versão exata do Firefox, a configuração de proteção contra
   rastreamento e a versão da extensão.
2. Repetir Bounce Tracking depois da correção e capturar a página de destino e
   a seção completa “Bounce tracking” do popup, com cadeia e justificativa.
3. Repetir Query Parameters e capturar a seção “Cookie sync/query parameters”
   do popup para cada caso relevante.
4. No Tracker Blocking, tirar um print que mostre simultaneamente o bloqueio
   ativo, o domínio configurado e a lista/contagem “Bloqueadas”.
5. Executar e documentar as páginas de JavaScript leaks usadas para validar
   WebSocket, polling, scripts dinâmicos e substituição de APIs.
6. Para evitar contaminação entre testes, limpar cookies e dados do site ou
   iniciar um perfil limpo antes de cada caso e registrar isso na metodologia.

## Limitações da comparação

- As páginas do DuckDuckGo testam proteção ou bloqueio; várias funções do
  Privacy Auditor são de observação e auditoria, portanto nem todas as linhas
  são comparações binárias de “passou/falhou”.
- As detecções de canvas, bounce, query/cookie sync e hooks são heurísticas e
  podem produzir falsos positivos ou falsos negativos.
- Cookies preexistentes entre testes prejudicam a atribuição causal quando o
  mesmo perfil e o mesmo domínio são reutilizados sem limpar os dados.
- Uma captura da interface comprova o estado mostrado naquele instante, mas não
  substitui logs do console ou tráfego de rede quando é necessário explicar a
  causa de uma divergência.
