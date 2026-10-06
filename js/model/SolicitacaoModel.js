/* ==========================================================================
   SolicitacaoModel.js – regras das solicitações de troca, sincronização
   com a planilha "Solicitação de Troca de Maquinas.xlsx" (aba Planilha2).
   ========================================================================== */
App.Model.Solicitacao = (function () {
  'use strict';
  var U = App.Util, DB = App.Model.DB, X = App.Model.Excel;

  var STATUS = ['Aguardando abertura', 'Chamado aberto', 'Em andamento', 'Máquina enviada', 'Resolvido', 'Cancelado'];
  var FECHADOS = ['Resolvido', 'Cancelado'];
  var PROBLEMAS = [
    'Não carrega nem conecta',
    'Erro de conexão e não processa o pagamento',
    'Não imprime comprovante',
    'Não lê cartões',
    'Não realiza transações (Crédito, Débito, Pix)',
    'Erro “Failed to open port. Tamper - 1”',
    'Apresenta erro “Contatar suporte”'
  ];
  var CAMPOS = X.COLUNAS_SOLICITACAO.map(function (c) { return c[0]; });

  /* ---------------- Status ---------------- */
  /** Interpreta textos livres ("30/06/2026 - Chamado aberto") em status padronizado + data. */
  function interpretarStatus(bruto) {
    var t = U.texto(bruto), data = '', resto = t;
    var m = t.match(/^\s*(\d{1,2}\/\d{1,2}\/\d{2,4})\s*[-–]\s*(.*)$/);
    if (m) { data = m[1]; resto = m[2]; }
    var n = U.semAcento(resto), status = null;
    if (/resolvid|conclu|finaliz/.test(n)) status = 'Resolvido';
    else if (/cancel/.test(n)) status = 'Cancelado';
    else if (/enviad|envio|despach/.test(n)) status = 'Máquina enviada';
    else if (/andamento|analise/.test(n)) status = 'Em andamento';
    else if (/novo chamado|abrir|aguard/.test(n)) status = 'Aguardando abertura';
    else if (/aberto/.test(n)) status = 'Chamado aberto';
    return { status: status || U.texto(resto) || 'Chamado aberto', data: data, padronizado: !!status, original: t };
  }

  /** Texto gravado na planilha: "dd/mm/aaaa - Status". */
  function statusParaPlanilha(r) { return r.statusData ? r.statusData + ' - ' + r.status : r.status; }

  function aberta(r) { return FECHADOS.indexOf(r.status) < 0; }

  /* ---------------- Chave de sincronização ---------------- */
  /** Identifica uma linha da planilha: Protocolo, ou Nº + Série se não houver protocolo. */
  function chaveLinha(o) {
    var p = U.texto(o.protocolo);
    if (p) return 'P:' + p;
    return 'N:' + U.texto(o.numero) + '|S:' + U.chaveSerie(o.serie);
  }

  /* ---------------- CRUD ---------------- */
  function listar() {
    return DB.getAll('solicitacoes').then(function (l) {
      return l.sort(function (a, b) { return U.comparar(Number(a.numero) || a.numero, Number(b.numero) || b.numero); });
    });
  }

  function novo() {
    var r = { uid: U.uid(), origem: 'sistema', chavePlanilha: null, alteradoLocal: true, historico: [] };
    CAMPOS.forEach(function (c) { r[c] = ''; });
    r.status = 'Chamado aberto';
    r.statusData = U.hoje();
    return r;
  }

  /** Valida o registro; devolve lista de mensagens de erro. */
  function validar(r) {
    var erros = [];
    var obrig = { numero: 'Nº', serie: 'Nº de Série', modelo: 'Modelo', problema: 'Problema Reportado', estado: 'Estado',
      cidade: 'Cidade', endereco: 'Endereço', cep: 'CEP', responsavel: 'Responsável', contato: 'Contato', status: 'Status' };
    Object.keys(obrig).forEach(function (k) { if (!U.texto(r[k])) erros.push('Preencha o campo "' + obrig[k] + '".'); });
    if (U.texto(r.cep) && !U.cepValido(r.cep)) erros.push('CEP deve estar no formato 00000-000.');
    if (U.texto(r.protocolo) && !/^[\w.\-\/ ]+$/.test(U.texto(r.protocolo))) erros.push('Protocolo contém caracteres inválidos.');
    return erros;
  }

  /** Salva o registro (marca como alterado para gravar na planilha depois). */
  function salvar(r, anterior) {
    r.atualizadoEm = new Date().toISOString();
    if (!r.criadoEm) r.criadoEm = r.atualizadoEm;
    r.historico = r.historico || [];
    if (!anterior || anterior.status !== r.status) {
      r.statusData = U.hoje();
      r.historico.push({ status: r.status, data: U.dataHora() });
    }
    r.alteradoLocal = true;
    Object.keys(r).forEach(function (k) { if (k.charAt(0) === '_') delete r[k]; }); // campos calculados não são gravados
    CAMPOS.forEach(function (c) { r[c] = U.texto(r[c]); });
    return DB.put('solicitacoes', r).then(function () { return r; });
  }

  /** Muda somente o status (atalho da listagem). */
  function alterarStatus(r, status) {
    var ant = Object.assign({}, r);
    r.status = status;
    return salvar(r, ant);
  }

  /** Só permite excluir o que ainda não foi gravado na planilha. */
  function excluir(r) {
    if (r.chavePlanilha) return Promise.reject(new Error('Esta solicitação já está na planilha. Use o status "Cancelado".'));
    return DB.del('solicitacoes', r.uid);
  }

  /** Procura solicitação aberta para a mesma máquina (série ou Nº). */
  function abertaParaMaquina(lista, serie, numero, excetoUid) {
    var ks = U.chaveSerie(serie), n = U.texto(numero);
    return lista.filter(function (r) {
      if (r.uid === excetoUid || !aberta(r)) return false;
      return (ks && U.chaveSerie(r.serie) === ks) || (n && U.texto(r.numero) === n);
    });
  }

  /** Série divergente: Nº (= PDV) existe, mas a série cadastrada é outra. */
  function divergencia(r, porPdv, porSerie) {
    var ks = U.chaveSerie(r.serie);
    if (ks && porSerie.has(ks)) return null; // série existe na base: ok
    var pdv = U.id(r.numero), maq = porPdv.get(pdv);
    if (maq && maq.serie && U.chaveSerie(maq.serie) !== ks) return { serieBase: maq.serie, pdv: pdv, tipo: 'pdv' };
    if (!maq) return { serieBase: '', pdv: pdv, tipo: 'inexistente' };
    return null;
  }

  /* ---------------- Sincronização com a planilha ---------------- */
  /** Converte uma linha bruta da planilha em registro do sistema. */
  function deLinha(l) {
    var r = novo();
    r.origem = 'planilha';
    CAMPOS.forEach(function (c) { r[c] = U.texto(l[c]); });
    var st = interpretarStatus(l.status);
    r.status = st.status; r.statusData = st.data; r.statusOriginal = st.original;
    r.chavePlanilha = chaveLinha(l);
    r.alteradoLocal = false;
    r.criadoEm = r.atualizadoEm = new Date().toISOString();
    return r;
  }

  /**
   * Importa as linhas da planilha: acrescenta novas e atualiza as que não
   * foram alteradas no sistema desde a última sincronização.
   */
  function importarLinhas(linhas) {
    return DB.getAll('solicitacoes').then(function (atuais) {
      var porChave = {};
      atuais.forEach(function (r) { if (r.chavePlanilha) porChave[r.chavePlanilha] = r; });
      var semChave = atuais.filter(function (r) { return !r.chavePlanilha; });
      var gravar = [], st = { novos: 0, atualizados: 0, conflitos: 0, iguais: 0 };
      linhas.forEach(function (l) {
        var k = chaveLinha(l), r = porChave[k];
        if (!r) { // talvez criada no sistema e já gravada por outro caminho
          r = semChave.filter(function (s) { return chaveLinha(s) === k; })[0];
          if (r) { r.chavePlanilha = k; }
        }
        var nova = deLinha(l);
        if (!r) { gravar.push(nova); st.novos++; return; }
        if (r.alteradoLocal) { st.conflitos++; gravar.push(r); return; }
        var mudou = CAMPOS.some(function (c) { return c !== 'status' && U.texto(r[c]) !== nova[c]; }) || r.statusOriginal !== nova.statusOriginal;
        if (!mudou) { st.iguais++; return; }
        nova.uid = r.uid; nova.historico = r.historico || []; nova.criadoEm = r.criadoEm;
        gravar.push(nova); st.atualizados++;
      });
      return DB.putMany('solicitacoes', gravar).then(function () { return st; });
    });
  }

  /**
   * Monta as linhas finais da planilha: mantém a ordem original, troca as
   * linhas alteradas no sistema e acrescenta as novas no final.
   * @returns { linhas, gravados: [registros sincronizados] }
   */
  function montarPlanilha(linhasPlanilha, registros) {
    var porChave = {}, usados = {}, saida = [], gravados = [];
    registros.forEach(function (r) { if (r.chavePlanilha) porChave[r.chavePlanilha] = r; });
    linhasPlanilha.forEach(function (l) {
      var r = porChave[chaveLinha(l)];
      if (r && !usados[r.uid]) {
        usados[r.uid] = 1;
        if (r.alteradoLocal) { saida.push(paraLinha(r)); gravados.push(r); }
        else saida.push(l); // linha intacta: grava exatamente como estava
      } else saida.push(l);  // linha criada direto no Excel: preservada
    });
    registros.forEach(function (r) {
      if (usados[r.uid]) return;
      if (!r.chavePlanilha || r.alteradoLocal) { saida.push(paraLinha(r)); gravados.push(r); }
    });
    return { linhas: saida, gravados: gravados };
  }

  function paraLinha(r) {
    var o = {};
    CAMPOS.forEach(function (c) { o[c] = r[c]; });
    o.status = statusParaPlanilha(r);
    return o;
  }

  /** Após gravar: marca como sincronizado e atualiza a chave. */
  function marcarSincronizados(gravados) {
    gravados.forEach(function (r) { Object.keys(r).forEach(function (k) { if (k.charAt(0) === '_') delete r[k]; }); r.chavePlanilha = chaveLinha(r); r.alteradoLocal = false; r.statusOriginal = statusParaPlanilha(r); });
    return DB.putMany('solicitacoes', gravados);
  }

  return {
    STATUS: STATUS, PROBLEMAS: PROBLEMAS, CAMPOS: CAMPOS, interpretarStatus: interpretarStatus,
    statusParaPlanilha: statusParaPlanilha, aberta: aberta, chaveLinha: chaveLinha, listar: listar, novo: novo,
    validar: validar, salvar: salvar, alterarStatus: alterarStatus, excluir: excluir,
    abertaParaMaquina: abertaParaMaquina, divergencia: divergencia, importarLinhas: importarLinhas,
    montarPlanilha: montarPlanilha, marcarSincronizados: marcarSincronizados
  };
})();
