/* ==========================================================================
   EstabelecimentoController.js – liga a tela de Estabelecimentos/
   Inconsistências aos dados (filtros, ordenação, paginação, exportação).
   ========================================================================== */
App.Controller.Estabelecimento = (function () {
  'use strict';
  var U = App.Util, UI = App.View.UI, V = App.View.Estabelecimento;
  var M = App.Model.Maquina, I = App.Model.Unidade, S = App.Model.Solicitacao, X = App.Model.Excel;

  var st = { ordem: { campo: 'pdv', asc: true }, pagina: 1, porPagina: 50, filtrados: [], incTipo: '', aba: 'maquinas' };

  function iniciar() {
    V.iniciar({
      filtrar: function (origem) { st.pagina = 1; if (origem === '#f-estado' || origem === '#f-regiao') opcoesMunicipio(); aplicar(); },
      ordenar: ordenar, paginar: paginar, exportar: exportar,
      solicitar: function (pdv) { App.Controller.Solicitacao.abrirNova(pdv); },
      salvarEmail: salvarEmail, trocarAba: function (a) { location.hash = a === 'inconsistencias' ? 'inconsistencias' : ''; abrirAba(a); },
      incTipo: function (t) { st.incTipo = t; renderInc(); }, incFiltrar: renderInc, incExportar: incExportar,
      abrirSolicitacao: function (uid) { App.Controller.Solicitacao.abrirEditar(uid); }
    });
    window.addEventListener('hashchange', lerHash);
    atualizar();
    lerHash();
  }

  function lerHash() { abrirAba(location.hash === '#inconsistencias' ? 'inconsistencias' : 'maquinas'); }

  function abrirAba(a) {
    st.aba = a;
    V.mostrarAba(a);
    App.View.Layout.ativar(a === 'inconsistencias' ? 'inconsistencias' : 'estabelecimentos');
    App.View.Layout.setTitulo(a === 'inconsistencias' ? 'Inconsistências' : 'Estabelecimentos');
  }

  /** Re-renderiza tudo a partir de App.estado (chamado após qualquer mudança). */
  function atualizar() {
    var e = App.estado;
    V.semBases(!e.temBases);
    if (!e.temBases) return;
    var estab = new Set(e.linhas.map(function (l) { return l.idUnidade; })).size;
    V.renderKpis({
      maquinas: e.maquinas.length, vinculadas: e.linhas.length, estabelecimentos: estab,
      cobertura: estab ? (e.linhas.length / estab).toFixed(1).replace('.', ',') + ' máq./unidade' : '',
      abertas: e.solicitacoes.filter(S.aberta).length, inconsistencias: e.inconsistencias.length
    });
    V.setOpcoes({
      estados: U.unicos(e.linhas.map(function (l) { return l.estado; })),
      regioes: U.unicos(e.linhas.map(function (l) { return l.regiao; })),
      modelos: U.unicos(e.maquinas.map(function (m) { return m.modeloExib; }))
    });
    opcoesMunicipio();
    V.setContagemAba(e.inconsistencias.length);
    aplicar();
    renderInc();
  }

  /** Municípios dependem do Estado/Região escolhidos. */
  function opcoesMunicipio() {
    var f = V.getFiltros();
    var l = App.estado.linhas.filter(function (x) { return (!f.estado || x.estado === f.estado) && (!f.regiao || x.regiao === f.regiao); });
    V.setOpcoes({ municipios: U.unicos(l.map(function (x) { return x.municipio; })) });
  }

  /** Aplica busca + filtros + ordenação e renderiza a página atual. */
  function aplicar() {
    var f = V.getFiltros();
    var termos = U.semAcento(f.busca).split(/\s+/).filter(Boolean);
    var lista = App.estado.linhas.filter(function (l) {
      if (f.estado && l.estado !== f.estado) return false;
      if (f.regiao && l.regiao !== f.regiao) return false;
      if (f.municipio && l.municipio !== f.municipio) return false;
      if (f.modelo && l.modeloExib !== f.modelo) return false;
      for (var i = 0; i < termos.length; i++) if (l._busca.indexOf(termos[i]) < 0) return false;
      return true;
    });
    var c = st.ordem.campo, dir = st.ordem.asc ? 1 : -1;
    lista.sort(function (a, b) { return U.comparar(a[c], b[c]) * dir || (a.pdv - b.pdv); });
    st.filtrados = lista;
    var nPag = Math.max(1, Math.ceil(lista.length / st.porPagina));
    if (st.pagina > nPag) st.pagina = nPag;
    var ini = (st.pagina - 1) * st.porPagina;
    var abertas = new Set();
    App.estado.solicitacoes.forEach(function (s) { if (S.aberta(s)) abertas.add(U.id(s.numero)); });
    V.renderTabela(lista.slice(ini, ini + st.porPagina), st.ordem, abertas);
    V.renderRodape(lista.length, st.pagina, st.porPagina);
  }

  function ordenar(campo) {
    if (st.ordem.campo === campo) st.ordem.asc = !st.ordem.asc; else st.ordem = { campo: campo, asc: true };
    aplicar();
  }

  function paginar(p) {
    if (p.porPagina) st.porPagina = p.porPagina;
    st.pagina = p.pagina;
    aplicar();
    var t = document.querySelector('#tabela-maquinas'); if (t) t.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function exportar() {
    if (!st.filtrados.length) { UI.toast('Não há registros para exportar.', 'alerta'); return; }
    try {
      X.exportar(st.filtrados, V.COLUNAS.map(function (c) { return [c.campo, c.titulo]; }),
        'Estabelecimentos_com_Maquina_' + new Date().toISOString().slice(0, 10) + '.xlsx', 'Estabelecimentos');
      UI.toast('Planilha exportada com ' + U.milhar(st.filtrados.length) + ' registros.');
    } catch (e) { UI.toast('Erro ao exportar: ' + e.message, 'erro'); }
  }

  /** Salva o e-mail e reflete em todas as máquinas da mesma unidade. */
  function salvarEmail(idUnidade, email) {
    return I.salvarEmail(idUnidade, email).then(function () {
      if (email) App.estado.emails.set(idUnidade, email); else App.estado.emails.delete(idUnidade);
      App.estado.linhas.forEach(function (l) { if (l.idUnidade === idUnidade) l.email = email; });
      UI.toast(email ? 'E-mail salvo para a unidade ID ' + idUnidade + '.' : 'E-mail removido.', 'ok');
    }).catch(function (e) { UI.toast(e.message, 'erro'); throw e; });
  }

  /* ---------------- Inconsistências ---------------- */
  function incFiltradas() {
    var termos = U.semAcento(V.getIncBusca()).split(/\s+/).filter(Boolean);
    return App.estado.inconsistencias.filter(function (i) {
      if (st.incTipo && i.tipo !== st.incTipo) return false;
      if (!termos.length) return true;
      var t = U.semAcento([i.pdv, i.serie, i.nome, i.idUnidade, i.municipio, i.detalhe].join(' '));
      return termos.every(function (x) { return t.indexOf(x) >= 0; });
    });
  }

  function renderInc() {
    var cont = {};
    App.estado.inconsistencias.forEach(function (i) { cont[i.tipo] = (cont[i.tipo] || 0) + 1; });
    V.renderIncCards(M.TIPOS, cont, st.incTipo, App.estado.inconsistencias.length);
    V.renderIncTabela(incFiltradas());
  }

  function incExportar() {
    var l = incFiltradas();
    if (!l.length) { UI.toast('Nada para exportar.', 'alerta'); return; }
    X.exportar(l, [['rotulo', 'Tipo'], ['pdv', 'ID_Maquina'], ['serie', 'Nº de série'], ['modelo', 'Modelo'], ['idUnidade', 'ID_Unidade'],
      ['nome', 'Nome Unidade'], ['municipio', 'Município'], ['estado', 'Estado'], ['detalhe', 'Detalhe']],
      'Inconsistencias_' + new Date().toISOString().slice(0, 10) + '.xlsx', 'Inconsistencias');
    UI.toast('Exportadas ' + U.milhar(l.length) + ' inconsistências.');
  }

  return { iniciar: iniciar, atualizar: atualizar };
})();
