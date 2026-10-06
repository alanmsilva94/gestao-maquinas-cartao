/* ==========================================================================
   UnidadeModel.js – base de estabelecimentos (Unidades.xlsx) e e-mails do sistema.
   ========================================================================== */
App.Model.Unidade = (function () {
  'use strict';
  var U = App.Util, DB = App.Model.DB;

  /** Converte as linhas brutas da planilha em registros limpos. */
  function processar(linhas) {
    var vistos = {}, lista = [], duplicados = 0;
    linhas.forEach(function (l) {
      var id = U.id(l.id);
      if (id === '') return;
      if (vistos[id]) { duplicados++; return; }
      vistos[id] = 1;
      lista.push({
        id: id,
        nome: U.texto(l.nome),
        endereco: U.texto(l.endereco),
        bairro: U.texto(l.bairro),
        estado: U.texto(l.estado).toUpperCase(),
        cep: U.formatarCep(l.cep),
        municipio: U.texto(l.municipio),
        regiao: U.texto(l.regiao),
        status: U.texto(l.status),
        telefone: U.formatarTelefone(l.telefone),
        telefoneOriginal: U.texto(l.telefone),
        responsavel: U.texto(l.responsavel),          // Nome Responsavel (Responsável Local)
        respFinanceiro: U.texto(l.respFinanceiro)
      });
    });
    return { lista: lista, duplicados: duplicados };
  }

  /** Substitui a base inteira no IndexedDB. */
  function salvar(lista, info) {
    return DB.put('bases', { chave: 'unidades', linhas: lista, info: info });
  }

  /** Carrega a base e devolve { mapa: Map(id -> unidade), info }. */
  function carregar() {
    return DB.get('bases', 'unidades').then(function (r) {
      var mapa = new Map();
      if (r) r.linhas.forEach(function (i) { mapa.set(i.id, i); });
      return { mapa: mapa, info: r ? r.info : null };
    });
  }

  function ativa(unidade) { return !unidade || U.semAcento(unidade.status) !== 'inativo'; }

  /* ---------------- E-mails (campo exclusivo do sistema) ---------------- */
  /** Devolve um Map(idUnidade -> email). */
  function carregarEmails() {
    return DB.getAll('emails').then(function (lista) {
      var m = new Map();
      lista.forEach(function (e) { m.set(e.idUnidade, e.email); });
      return m;
    });
  }

  /** Salva (ou apaga, se vazio) o e-mail de uma unidade. */
  function salvarEmail(idUnidade, email) {
    email = U.texto(email);
    if (!U.emailValido(email)) return Promise.reject(new Error('E-mail inválido. Separe vários com ";".'));
    if (!email) return DB.del('emails', idUnidade);
    return DB.put('emails', { idUnidade: idUnidade, email: email, atualizadoEm: new Date().toISOString() });
  }

  return { processar: processar, salvar: salvar, carregar: carregar, ativa: ativa, carregarEmails: carregarEmails, salvarEmail: salvarEmail };
})();
