/* ==========================================================================
   app.js – inicialização: monta o layout, carrega os dados do IndexedDB
   e chama o controller da página (definida em <body data-page="...">).
   ========================================================================== */
(function () {
  'use strict';
  var UI = App.View.UI, L = App.View.Layout, D = App.Model.Dados, U = App.Util;

  var PAGINAS = {
    estabelecimentos: { titulo: 'Estabelecimentos', ctrl: function () { return App.Controller.Estabelecimento; } },
    solicitacoes: { titulo: 'Solicitações de Troca', ctrl: function () { return App.Controller.Solicitacao; } },
    importacao: { titulo: 'Importar Bases', ctrl: function () { return App.Controller.Importacao; } }
  };

  App.estado = null;

  /** Recarrega os dados e re-renderiza a página atual. */
  App.recarregar = function () {
    return D.carregarTudo().then(function (e) {
      App.estado = e;
      atualizarCabecalho();
      var c = App.paginaAtual && PAGINAS[App.paginaAtual].ctrl();
      if (c && c.atualizar) return c.atualizar();
    });
  };

  function atualizarCabecalho() {
    var e = App.estado, datas = [e.maqInfo, e.igInfo].filter(Boolean).map(function (i) { return i.data; }).sort();
    L.setAtualizacao(datas.length ? U.dataHora(datas[datas.length - 1]) : 'nunca');
    L.setBadge(e.inconsistencias.length);
  }

  /** Botão "Atualizar bases": recarrega arquivos vinculados ou leva à importação. */
  App.atualizarBases = function () {
    var naImportacao = App.paginaAtual === 'importacao';
    if (!App.Model.Excel.suportaFS()) {
      if (naImportacao) UI.toast('Este navegador não permite vincular arquivos. Selecione as planilhas novamente.', 'info');
      else location.href = 'importacao.html';
      return;
    }
    UI.carregando('Atualizando bases vinculadas...').then(function () {
      return D.atualizarVinculados();
    }).then(function (r) {
      UI.fimCarregando();
      if (r.semVinculo) {
        if (naImportacao) UI.toast('Nenhum arquivo vinculado. Use "Vincular arquivo" em Máquinas e Unidades.', 'info');
        else UI.confirmar('Nenhuma planilha está vinculada ainda. Ir para a tela de importação?', { titulo: 'Atualizar bases', ok: 'Ir para importação' })
          .then(function (ok) { if (ok) location.href = 'importacao.html'; });
        return;
      }
      (r.erros || []).forEach(function (m) { UI.toast(m, 'erro'); });
      if (r.pendentes && r.pendentes.length)
        UI.toast('O navegador precisa da sua autorização para: ' + r.pendentes.map(D.rotulo).join(', ') + '. Clique em "Atualizar bases" novamente.', 'alerta', 8000);
      if (r.resultados.length)
        UI.toast('Bases atualizadas: ' + r.resultados.map(function (x) { return D.rotulo(x.tipo) + ' (' + U.milhar(x.info.total) + ')'; }).join(', ') + '.');
      return App.recarregar();
    }).catch(function (e) { UI.fimCarregando(); UI.toast(e.message || String(e), 'erro'); });
  };

  function iniciar() {
    var pagina = document.body.dataset.page;
    App.paginaAtual = PAGINAS[pagina] ? pagina : null;
    L.montar(App.paginaAtual ? PAGINAS[pagina].titulo : '');
    L.onAtualizar(App.atualizarBases);

    if (!window.XLSX) UI.toast('A biblioteca js/lib/xlsx.full.min.js não foi carregada. Verifique a pasta do projeto.', 'erro', 15000);

    UI.carregando('Carregando dados salvos...').then(function () {
      return D.carregarTudo();
    }).then(function (e) {
      App.estado = e;
      atualizarCabecalho();
      UI.fimCarregando();
      if (App.paginaAtual) return PAGINAS[App.paginaAtual].ctrl().iniciar();
    }).catch(function (err) {
      UI.fimCarregando();
      console.error(err);
      UI.toast('Não foi possível abrir o banco de dados local: ' + (err.message || err) + '. Use Chrome ou Edge atualizados.', 'erro', 15000);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
