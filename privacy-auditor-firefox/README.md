# Privacy Auditor para Firefox

Estrutura inicial de uma extensão acadêmica de privacidade para Firefox. Nesta
etapa, a extensão apenas acompanha a URL, o domínio e o total de requisições de
cada aba. Ela ainda não inspeciona canvas ou cookies e não bloqueia requisições.

## Carregar temporariamente no Firefox

1. Abra `about:debugging` no Firefox.
2. Selecione **Este Firefox**.
3. Clique em **Carregar extensão temporária…**.
4. Selecione o arquivo `extension/manifest.json` deste projeto.
5. Navegue até uma página HTTP ou HTTPS e abra o ícone da extensão.

A instalação feita dessa forma é temporária e é removida quando o Firefox é
fechado.

## Desenvolvimento

Instale as dependências:

```sh
npm install
```

Comandos disponíveis:

```sh
npm run lint
npm run run
npm run build
```

- `lint` valida a extensão com `web-ext`.
- `run` inicia uma instância temporária do Firefox com a extensão carregada.
- `build` gera o pacote em `web-ext-artifacts/`.

