# Privacy Auditor para Firefox

Extensão acadêmica de privacidade para Firefox. O popup apresenta as
requisições realizadas pela aba, os domínios registráveis de terceira parte e
um inventário de armazenamento HTML5 e cookies relacionado à navegação. Também
apresenta indicadores heurísticos de leitura de canvas, bounce tracking e
possível compartilhamento de identificadores.

## Funcionalidades atuais

- Registra metadados das requisições de rede separadamente por aba.
- Agrupa requisições por tipo de recurso.
- Identifica terceiros pelo domínio registrável, tratando subdomínios do mesmo
  domínio como primeira parte.
- Conta as chaves de `localStorage` e `sessionStorage` sem ler seus valores.
- Lista nomes e versões de bancos IndexedDB quando `indexedDB.databases()` está
  disponível.
- Inspeciona o frame principal e frames secundários acessíveis à extensão.
- Consulta cookies preexistentes dos domínios observados e acompanha alterações
  com `cookies.onChanged`.
- Separa cookies preexistentes dos criados, alterados ou removidos durante a
  navegação e os classifica por parte e duração.
- Detecta leituras de canvas por `toDataURL`, `toBlob` e `getImageData` no
  contexto principal da página, usando `Proxy` para preservar `this`,
  argumentos, retorno e propriedades da função original.
- Mantém a cadeia de redirects da navegação principal e sinaliza passagens
  automáticas e rápidas por um domínio intermediário distinto.
- Analisa parâmetros de URLs de terceiros e compara somente hashes SHA-256
  locais para encontrar o mesmo identificador em terceiros diferentes ou em
  cookie e URL.
- Oculta, nas URLs guardadas e exibidas, valores reconhecidos como possíveis
  identificadores, mantendo o nome do parâmetro e os demais componentes.
- Observa WebSockets de terceiros, polling regular por `fetch`/XHR,
  substituições das APIs monitoradas e scripts inseridos dinamicamente. Scripts
  dinâmicos são inventariados, mas não são classificados isoladamente como
  ataque.
- Mantém uma lista personalizada de domínios em `browser.storage.local`, com
  bloqueio opcional por `webRequestBlocking` e registros separados de
  correspondências detectadas e requisições efetivamente canceladas.
- Calcula um score heurístico por navegação e apresenta cada desconto aplicado.
- Não armazena valores de cookies, parâmetros identificadores,
  `localStorage`, `sessionStorage` ou conteúdo de canvas.

As detecções são indícios e podem ter falsos positivos. A extensão não altera
os dados das páginas e não envia os dados coletados para servidores externos.

## Metodologia do score

O score começa em 100 e cada categoria aplica um desconto limitado ao peso
máximo indicado. O resultado mínimo é zero. A lista personalizada de bloqueio
não muda o score: ele representa os sinais observados na página, não a
preferência de bloqueio do usuário.

| Categoria | Peso máximo | Critério de desconto |
| --- | ---: | --- |
| Domínios de terceira parte | 20 | 2 pontos por domínio registrável distinto |
| Cookies | 20 | 3 por cookie persistente de terceiro, 2 por cookie de sessão de terceiro e 1 por cookie persistente de primeira parte |
| Armazenamento HTML5 | 10 | Por origem: 2 por localStorage, 1 por sessionStorage e 3 por IndexedDB com dados |
| Canvas fingerprinting | 20 | 20 quando há tentativa de leitura do canvas |
| Bounce tracking e cookie sync | 15 | 7 por possível bounce tracking e 8 por possível compartilhamento de identificador |
| Hijacking e hooks | 15 | 8 por substituição de API, 4 por WebSocket de terceiro e 3 por polling persistente |

Os descontos de cada categoria são aplicados uma única vez até o seu limite,
mesmo que existam muitos eventos. O popup mostra os fatores que justificaram o
resultado. Trata-se de uma comparação acadêmica e heurística, não de uma
certificação de segurança ou privacidade.

Polling persistente requer ao menos quatro chamadas recentes ao mesmo endpoint,
com intervalos entre 250 ms e 60 s e desvio máximo de 35% em relação à média.
Bounce tracking usa uma janela de três segundos entre redirects automáticos.

## Carregar temporariamente no Firefox

1. Abra `about:debugging` no Firefox.
2. Selecione **Este Firefox**.
3. Clique em **Carregar extensão temporária…**.
4. Selecione o arquivo `extension/manifest.json` deste projeto.
5. Abra ou recarregue uma página HTTP/HTTPS.
6. Clique no ícone da extensão para consultar o relatório da aba.

A instalação temporária é removida quando o Firefox é fechado. Após recarregar
a extensão em `about:debugging`, recarregue também as páginas que deseja
inspecionar para que o content script seja executado novamente.

## Desenvolvimento

Instale as dependências:

```sh
npm install
```

Comandos disponíveis:

```sh
npm run lint
npm test
npm run run
npm run build
```

- `lint` valida a extensão com `web-ext`.
- `test` executa os testes unitários de domínios, cookies, parâmetros
  identificadores, bounce tracking, polling, bloqueio e score.
- `run` inicia uma instância temporária do Firefox com a extensão carregada.
- `build` gera o pacote em `web-ext-artifacts/`.
