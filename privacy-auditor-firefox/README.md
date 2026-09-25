# Privacy Auditor para Firefox

Extensão acadêmica de privacidade para Firefox. O popup apresenta as
requisições realizadas pela aba, os domínios registráveis de terceira parte e
um inventário de armazenamento HTML5 e cookies relacionado à navegação.

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
- Não armazena os valores de cookies, `localStorage` ou `sessionStorage`.

O projeto ainda não inspeciona canvas, não calcula score e não bloqueia
requisições.

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
- `test` executa os testes unitários de classificação de domínios e cookies.
- `run` inicia uma instância temporária do Firefox com a extensão carregada.
- `build` gera o pacote em `web-ext-artifacts/`.
