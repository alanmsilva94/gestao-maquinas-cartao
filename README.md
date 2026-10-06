# Gestão de Máquinas de Cartão

Sistema **offline** em **HTML, CSS e JavaScript puros** para consultar o parque de máquinas de cartão (POS) cruzado com a base de unidades e registrar **solicitações de troca**, gravando de volta em planilha Excel. Não precisa de internet, servidor nem instalação: os dados ficam no navegador (IndexedDB).

> **Dados 100% fictícios.** As planilhas de exemplo são geradas por script; unidades, endereços, telefones, séries e protocolos são inventados e não têm vínculo com nenhuma instituição real.

## Funcionalidades

- **Estabelecimentos com máquina**: uma linha por máquina vinculada a uma unidade válida, com busca, filtros (Estado, Região, Município e Modelo), ordenação, paginação e **exportação para Excel** da visão filtrada.
- **E-mail por unidade**: edição direta na célula; fica ligado à unidade e aparece em todas as máquinas dela.
- **Solicitações de troca**: formulário preenchido a partir da máquina escolhida, com validações (CEP, campos obrigatórios), aviso de solicitação já aberta para a mesma máquina, de série divergente e de unidade inativa. Status padronizado e gravado como `dd/mm/aaaa - Status`.
- **Inconsistências**: máquinas sem unidade (N/D), unidade inexistente ou inativa, série vazia ou duplicada, modelo vazio e série divergente em solicitação.
- **Importar bases**: arraste as planilhas; o sistema reconhece cada arquivo pelos **cabeçalhos**, não pelo nome. Suporta vincular arquivos (Chrome/Edge) para atualizar com um clique.
- **Salvar na planilha**: regrava a aba de solicitações mantendo ordem, colunas e linhas existentes.
- **Backup (.json)** de e-mails e solicitações, com opção de mesclar ou substituir.

## Como executar

1. Baixe o repositório e abra `index.html` no **Chrome** ou **Edge**.
2. Gere as planilhas de exemplo:

   ```bash
   pip install openpyxl
   python gerar_dados_exemplo.py     # cria dados_exemplo/*.xlsx
   ```

   (Já existe uma cópia pronta em `dados_exemplo/`.)
3. Em **Importar Bases**, arraste `Unidades.xlsx`, `Maquinas.xlsx` e, se quiser, `Solicitação de Troca de Maquinas.xlsx`.

> Os dados importados ficam no navegador e no perfil usados. Limpar os dados de navegação apaga o que foi salvo: use o **Backup** com frequência.

## Planilhas esperadas

| Arquivo | Aba | Colunas usadas |
|---|---|---|
| `Maquinas.xlsx` | `BD_Maquinas` | `PDV`, `Nº de série`, `Modelo`, `ID_Unidade` |
| `Unidades.xlsx` | `Planilha1` | `ID`, `Nome`, `Endereco`, `Bairro`, `Estado`, `CEP`, `Municipio`, `Desc.Região`, `Status`, `Tel.Atualiz`, `Nome Responsavel`, `Resp. Financ` |
| `Solicitação de Troca de Maquinas.xlsx` | `Planilha2` | `Nº`, `Nº de Série`, `Modelo`, `Problema Reportado`, `Estado`, `Cidade`, `Bairro`, `Endereço`, `CEP`, `Responsável`, `Contato`, `Protocolo`, `Status` |

## Arquitetura (MVC)

```
index.html                 abre html/estabelecimentos.html
html/                      telas (estabelecimentos, solicitações, importação)
style/                     base.css (tokens), layout.css, components.css
js/lib/xlsx.full.min.js    SheetJS (local, para funcionar offline)
js/model/                  Util, db (IndexedDB), ExcelService, Unidade/Maquina/Solicitacao, DadosModel
js/view/                   UI (ícones, modal, toast), Layout, Estabelecimento, Solicitacao, Importacao
js/controller/             Estabelecimento, Solicitacao, Importacao
js/app.js                  inicialização e navegação
gerar_dados_exemplo.py     gera planilhas fictícias
dados_exemplo/             planilhas fictícias prontas
```

Os scripts são clássicos (sem módulos ES nem `fetch`), carregados em ordem e ligados pelo namespace global `window.App`, o que permite abrir o projeto direto do disco (`file://`).

## Limitações

- Chrome e Edge têm suporte completo; Firefox e Safari não permitem vincular arquivos nem gravar direto (usa-se seletor e download).
- O SheetJS gratuito preserva dados, abas, larguras e filtros, mas não cores, bordas e fontes ao regravar a planilha.
- Se a planilha estiver aberta no Excel, a gravação direta falha.

## Tecnologias

HTML5 · CSS3 · JavaScript (ES5/ES2015, sem frameworks) · IndexedDB · File System Access API · [SheetJS](https://sheetjs.com/) (Apache-2.0) · Python 3 + openpyxl (apenas para gerar dados de exemplo)

## Licença

MIT — veja [LICENSE](LICENSE). A biblioteca `js/lib/xlsx.full.min.js` é de terceiros (SheetJS, Apache-2.0) e mantém seu aviso de copyright no próprio arquivo.
