# Metodologia padronizada para os testes em sites reais

Esta metodologia deve ser repetida separadamente para UOL, Mercado Livre e
Wikipedia. Nenhum campo deve ser preenchido por inferência: todo resultado
depende do print, log ou HAR correspondente.

## Controles do experimento

- Registrar URL exata, data, horário e versão do Firefox.
- Usar uma janela normal, sem autenticação no site.
- Registrar a configuração da Proteção Aprimorada contra Rastreamento.
- Registrar a escolha realizada no banner de cookies.
- Manter o tempo de observação em 30 segundos e repetir a mesma interação.
- Não clicar em anúncios, produtos ou links.
- Não executar Privacy Auditor e uBlock Origin no mesmo perfil de teste.
- Nomear os arquivos com data e ferramenta, sem sobrescrever evidências anteriores.

## Teste com Privacy Auditor

1. Usar um perfil do Firefox somente com o Privacy Auditor.
2. Não estar autenticado no site.
3. Abrir a página inicial.
4. Abrir o DevTools e a aba **Network/Rede**.
5. Limpar as requisições anteriores.
6. Ativar a persistência dos logs.
7. Recarregar a página.
8. Aguardar 30 segundos.
9. Rolar a página uma vez até aproximadamente a metade.
10. Não clicar em anúncios, produtos ou links.
11. Registrar a decisão tomada no banner de cookies.
12. Abrir o popup da extensão e tirar um print completo.
13. Exportar todas as requisições como HAR.
14. Colocar o print em `plugin/` e o HAR em `har/` no diretório do site.
15. Executar o analisador local e guardar os arquivos de resumo junto ao HAR:

```sh
node scripts/analyze-har.js evidencias/sites/SITE/har/ARQUIVO.har
```

## Teste com uBlock Origin

1. Usar outro perfil do Firefox, somente com uBlock Origin.
2. Abrir o Logger do uBlock Origin.
3. Limpar os registros anteriores.
4. Abrir a mesma URL usada no teste do Privacy Auditor.
5. Aguardar 30 segundos.
6. Fazer a mesma rolagem até aproximadamente a metade.
7. Tirar um print do Logger.
8. Registrar os domínios e requisições bloqueados.
9. Colocar o print em `ublock/` no diretório do site.

## Teste no Blacklight

1. Analisar exatamente o mesmo domínio.
2. Tirar prints do relatório.
3. Registrar cookies de terceiros.
4. Registrar ad trackers.
5. Registrar canvas fingerprinting.
6. Registrar session recording.
7. Registrar key logging.
8. Registrar pixels encontrados.
9. Registrar data e horário.
10. Colocar os prints em `blacklight/` no diretório do site.

## Reconciliação

1. Preencher `analise.md` somente depois de conferir as evidências salvas.
2. Para cada domínio ou indicador, indicar a ferramenta que o observou.
3. Vincular a afirmação ao nome do print, HAR ou resumo analisado.
4. Explicar divergências considerando escopo, momento da coleta, proteção do
   Firefox, consentimento de cookies e bloqueio anterior ao carregamento.
5. Manter `PENDENTE` quando a evidência não estiver disponível ou for
   insuficiente.

As classificações do analisador de HAR e do Privacy Auditor são heurísticas e
não comprovam, isoladamente, rastreamento ou ataque.

## Desvios observados nesta coleta

- Os testes do uBlock foram registrados em perfil separado, com popup e Logger.
  As capturas comprovam totais e exemplos visíveis, mas não constituem uma
  exportação completa de todos os domínios e tipos bloqueados.
- A duração coberta pelos HARs não foi uniforme: aproximadamente 176,7 s no
  UOL, 3,8 s no Mercado Livre e 15,9 s na Wikipedia. Portanto, as contagens
  absolutas não representam janelas equivalentes de 30 segundos.
- Os prints do popup foram produzidos em horários diferentes do intervalo de
  cada HAR. Eles permitem comparação indicativa, mas não uma correspondência
  evento a evento.
- Configuração da proteção contra rastreamento, login e interações não possuem
  comprovação nos arquivos disponíveis e continuam
  `PENDENTE`.
