/* ==========================================================================
   ExcelService.js – leitura/escrita de .xlsx com SheetJS (js/lib) e
   acesso a arquivos (File System Access API ou seletor/download comum).
   ========================================================================== */
App.Model.Excel = (function () {
  'use strict';
  var U = App.Util;

  /* ---------- Definição das planilhas (cabeçalhos aceitos por campo) ---------- */
  var LAYOUTS = {
    maquinas: {
      aba: 'BD_Maquinas',
      colunas: {
        pdv: ['PDV'],
        serie: ['Nº de série', 'N de serie', 'Numero de serie', 'Serie'],
        modelo: ['Modelo'],
        idUnidade: ['ID_Unidade', 'ID Unidade']
      },
      obrigatorias: ['pdv', 'idUnidade']
    },
    unidades: {
      aba: 'Planilha1',
      colunas: {
        id: ['ID'], nome: ['Nome'], endereco: ['Endereco', 'Endereço'], bairro: ['Bairro'],
        estado: ['Estado', 'UF'], cep: ['CEP'], municipio: ['Municipio', 'Município'],
        regiao: ['Desc.Região', 'Desc Regiao'], status: ['Status'], telefone: ['Tel.Atualiz'],
        responsavel: ['Nome Responsavel'], respFinanceiro: ['Resp. Financ']
      },
      obrigatorias: ['id', 'nome', 'municipio']
    },
    solicitacoes: {
      aba: 'Planilha2',
      colunas: {
        numero: ['Nº'], serie: ['Nº de Série'], modelo: ['Modelo'], problema: ['Problema Reportado'],
        estado: ['Estado'], cidade: ['Cidade'], bairro: ['Bairro'], endereco: ['Endereço'], cep: ['CEP'],
        responsavel: ['Responsável'], contato: ['Contato'], protocolo: ['Protocolo'], status: ['Status']
      },
      obrigatorias: ['numero', 'serie', 'protocolo', 'status']
    }
  };

  /* Ordem e nomes EXATOS das colunas da planilha de solicitação. */
  var COLUNAS_SOLICITACAO = [
    ['numero', 'Nº'], ['serie', 'Nº de Série'], ['modelo', 'Modelo'], ['problema', 'Problema Reportado'],
    ['estado', 'Estado'], ['cidade', 'Cidade'], ['bairro', 'Bairro'], ['endereco', 'Endereço'], ['cep', 'CEP'],
    ['responsavel', 'Responsável'], ['contato', 'Contato'], ['protocolo', 'Protocolo'], ['status', 'Status']
  ];

  function exigirBiblioteca() {
    if (!window.XLSX) throw new Error('Biblioteca SheetJS não encontrada em js/lib/xlsx.full.min.js.');
  }

  /** Lê um File/Blob como ArrayBuffer. */
  function lerArquivo(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { res(fr.result); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsArrayBuffer(file);
    });
  }

  /** Converte o ArrayBuffer em workbook (modo "dense" = mais rápido/menos memória). */
  function lerWorkbook(buf, completo) {
    exigirBiblioteca();
    var opt = { type: 'array', cellHTML: false, cellFormula: false, cellText: false };
    if (!completo) opt.dense = true;
    else { opt.cellStyles = true; opt.cellDates = false; }
    return XLSX.read(new Uint8Array(buf), opt);
  }

  /** Acesso a uma célula independente do modo (dense 0.18, dense 0.20 ou sparse). */
  function celula(ws, r, c) {
    var linha;
    if (ws['!data']) { linha = ws['!data'][r]; return linha ? linha[c] : undefined; }
    if (Array.isArray(ws[r])) { linha = ws[r]; return linha[c]; }
    return ws[XLSX.utils.encode_cell({ r: r, c: c })];
  }

  function valor(ws, r, c) { var cel = celula(ws, r, c); return cel ? cel.v : null; }

  /** Localiza a linha de cabeçalho e o índice de cada campo pelo NOME da coluna. */
  function mapearColunas(ws, layout) {
    var ref = ws['!ref'];
    if (!ref) return null;
    var range = XLSX.utils.decode_range(ref);
    var alvo = {};
    Object.keys(layout.colunas).forEach(function (campo) {
      alvo[campo] = layout.colunas[campo].map(U.chaveCabecalho);
    });
    // procura o cabeçalho nas 15 primeiras linhas
    for (var r = range.s.r; r <= Math.min(range.e.r, range.s.r + 15); r++) {
      var mapa = {}, achados = 0;
      for (var c = range.s.c; c <= range.e.c; c++) {
        var k = U.chaveCabecalho(valor(ws, r, c));
        if (!k) continue;
        Object.keys(alvo).forEach(function (campo) {
          if (mapa[campo] === undefined && alvo[campo].indexOf(k) >= 0) { mapa[campo] = c; achados++; }
        });
      }
      var okObrig = layout.obrigatorias.every(function (f) { return mapa[f] !== undefined; });
      if (okObrig) return { linhaCabecalho: r, mapa: mapa, range: range, achados: achados };
    }
    return null;
  }

  /** Escolhe a aba: primeiro a de nome esperado, senão a primeira que tiver os cabeçalhos. */
  function localizarAba(wb, layout) {
    var nomes = wb.SheetNames.slice();
    var pref = nomes.filter(function (n) { return U.chaveCabecalho(n) === U.chaveCabecalho(layout.aba); });
    var ordem = pref.concat(nomes.filter(function (n) { return pref.indexOf(n) < 0; }));
    for (var i = 0; i < ordem.length; i++) {
      var m = mapearColunas(wb.Sheets[ordem[i]], layout);
      if (m) return { nome: ordem[i], ws: wb.Sheets[ordem[i]], map: m };
    }
    return null;
  }

  /** Descobre de qual planilha se trata (útil para arrastar vários arquivos). */
  function detectarTipo(wb) {
    var tipos = ['solicitacoes', 'maquinas', 'unidades'];
    for (var i = 0; i < tipos.length; i++) if (localizarAba(wb, LAYOUTS[tipos[i]])) return tipos[i];
    return null;
  }

  /** Extrai as linhas como objetos { campo: valorBruto } lendo SÓ as colunas necessárias. */
  function extrair(wb, tipo) {
    var layout = LAYOUTS[tipo];
    var aba = localizarAba(wb, layout);
    if (!aba) {
      var nomes = layout.obrigatorias.map(function (f) { return '"' + layout.colunas[f][0] + '"'; }).join(', ');
      throw new Error('Não encontrei as colunas obrigatórias (' + nomes + ') em nenhuma aba do arquivo.');
    }
    var ws = aba.ws, m = aba.map, campos = Object.keys(m.mapa), linhas = [];
    for (var r = m.linhaCabecalho + 1; r <= m.range.e.r; r++) {
      var obj = { _linha: r + 1 }, vazio = true;
      for (var i = 0; i < campos.length; i++) {
        var v = valor(ws, r, m.mapa[campos[i]]);
        if (v !== null && v !== undefined && v !== '') vazio = false;
        obj[campos[i]] = v === undefined ? null : v;
      }
      if (!vazio) linhas.push(obj);
    }
    var faltando = Object.keys(layout.colunas).filter(function (f) { return m.mapa[f] === undefined; });
    return { aba: aba.nome, linhas: linhas, faltando: faltando };
  }

  /* ---------------- Exportação de uma lista para .xlsx ---------------- */
  /** colunas: [[campo, 'Título'], ...] */
  function exportar(linhas, colunas, nomeArquivo, nomeAba) {
    exigirBiblioteca();
    var aoa = [colunas.map(function (c) { return c[1]; })];
    linhas.forEach(function (l) { aoa.push(colunas.map(function (c) { var v = l[c[0]]; return v === undefined ? '' : v; })); });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = colunas.map(function (c, i) {
      var max = String(c[1]).length;
      for (var k = 1; k < Math.min(aoa.length, 300); k++) max = Math.max(max, String(aoa[k][i] || '').length);
      return { wch: Math.min(Math.max(max + 2, 8), 60) };
    });
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, nomeAba || 'Dados');
    XLSX.writeFile(wb, nomeArquivo);
  }

  /* ---------- Gravação da planilha de solicitações com a MESMA estrutura ---------- */
  /**
   * Gera um novo .xlsx a partir do arquivo original: mantém todas as abas,
   * substitui apenas o conteúdo da aba Planilha2 (mesmo cabeçalho/ordem).
   * @param buf ArrayBuffer do arquivo original (ou null para criar do zero)
   * @param linhasFinais array de objetos { numero, serie, ... } já na ordem final
   */
  function gerarPlanilhaSolicitacoes(buf, linhasFinais) {
    exigirBiblioteca();
    var wb, nomeAba = LAYOUTS.solicitacoes.aba, cols = null, filtro = null;
    if (buf) {
      wb = lerWorkbook(buf, true);
      var aba = localizarAba(wb, LAYOUTS.solicitacoes);
      if (aba) { nomeAba = aba.nome; cols = aba.ws['!cols']; filtro = aba.ws['!autofilter']; }
    } else {
      wb = XLSX.utils.book_new();
    }
    var aoa = [COLUNAS_SOLICITACAO.map(function (c) { return c[1]; })];
    linhasFinais.forEach(function (l) {
      aoa.push(COLUNAS_SOLICITACAO.map(function (c) { return paraCelula(c[0], l[c[0]]); }));
    });
    var ws = XLSX.utils.aoa_to_sheet(aoa);
    // Protocolo: número inteiro com formato "0" (igual ao original) quando couber sem perder precisão
    var colProt = 11;
    for (var r = 1; r < aoa.length; r++) {
      var ref = XLSX.utils.encode_cell({ r: r, c: colProt });
      if (ws[ref] && ws[ref].t === 'n') ws[ref].z = '0';
    }
    ws['!cols'] = cols || [8, 16, 12, 40, 8, 18, 16, 36, 11, 22, 20, 18, 26].map(function (w) { return { wch: w }; });
    // mantém o filtro automático só se a planilha original já tinha
    if (filtro) ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: 12 } }) };
    if (wb.Sheets[nomeAba]) wb.Sheets[nomeAba] = ws;
    else XLSX.utils.book_append_sheet(wb, ws, nomeAba);
    return XLSX.write(wb, { bookType: 'xlsx', type: 'array', compression: true });
  }

  /** Converte o valor do sistema para o tipo de célula adequado. */
  function paraCelula(campo, v) {
    var t = U.texto(v);
    if (t === '') return '';
    if (campo === 'numero' && /^\d+$/.test(t)) return parseInt(t, 10);
    if (campo === 'protocolo' && /^\d{1,15}$/.test(t)) return Number(t); // 15 dígitos = precisão garantida
    return t;
  }

  /* ---------------- Arquivos: File System Access API ---------------- */
  function suportaFS() { return typeof window.showOpenFilePicker === 'function'; }

  var TIPOS_XLSX = [{ description: 'Planilhas Excel', accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } }];

  /** Abre o seletor nativo e devolve o handle do arquivo escolhido. */
  function escolherHandle() {
    return window.showOpenFilePicker({ types: TIPOS_XLSX, multiple: false }).then(function (hs) { return hs[0]; });
  }

  /** Garante permissão (precisa ser chamado a partir de um clique do usuário). */
  function garantirPermissao(handle, escrita) {
    var opt = { mode: escrita ? 'readwrite' : 'read' };
    return handle.queryPermission(opt).then(function (p) {
      if (p === 'granted') return true;
      return handle.requestPermission(opt).then(function (p2) { return p2 === 'granted'; });
    });
  }

  /** Lê o arquivo apontado por um handle. */
  function lerHandle(handle) {
    return garantirPermissao(handle, false).then(function (ok) {
      if (!ok) throw new Error('Permissão negada para ler "' + handle.name + '".');
      return handle.getFile();
    });
  }

  /** Grava bytes no arquivo apontado pelo handle. */
  function gravarHandle(handle, dados) {
    return garantirPermissao(handle, true).then(function (ok) {
      if (!ok) throw new Error('Permissão de escrita negada para "' + handle.name + '".');
      return handle.createWritable();
    }).then(function (w) {
      return w.write(dados).then(function () { return w.close(); });
    }).catch(function (e) {
      if (e && e.name === 'NotFoundError')
        throw new Error('O arquivo "' + handle.name + '" não foi encontrado (movido, renomeado ou apagado). Clique em "Vincular" e escolha a planilha novamente.');
      if (e && (e.name === 'NoModificationAllowedError' || e.name === 'InvalidStateError'))
        throw new Error('Não foi possível gravar: feche o arquivo no Excel e tente novamente.');
      throw e;
    });
  }

  /** Baixa bytes como arquivo (fallback sem File System Access API). */
  function baixar(dados, nome, tipo) {
    var blob = new Blob([dados], { type: tipo || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nome;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  return {
    LAYOUTS: LAYOUTS, COLUNAS_SOLICITACAO: COLUNAS_SOLICITACAO,
    lerArquivo: lerArquivo, lerWorkbook: lerWorkbook, detectarTipo: detectarTipo, extrair: extrair,
    exportar: exportar, gerarPlanilhaSolicitacoes: gerarPlanilhaSolicitacoes,
    suportaFS: suportaFS, escolherHandle: escolherHandle, lerHandle: lerHandle, gravarHandle: gravarHandle,
    garantirPermissao: garantirPermissao, baixar: baixar
  };
})();
