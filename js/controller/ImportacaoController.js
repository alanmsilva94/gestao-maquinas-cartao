/* ==========================================================================
   ImportacaoController.js – importação/atualização das bases, vínculos
   de arquivos e backup.
   ========================================================================== */
App.Controller.Importacao = (function () {
  'use strict';
  var U = App.Util, UI = App.View.UI, V = App.View.Importacao, D = App.Model.Dados, DB = App.Model.DB, X = App.Model.Excel;

  function iniciar() {
    V.iniciar({
      importar: importar, vincular: vincular, desvincular: desvincular, atualizarVinculados: App.atualizarBases,
      exportarBackup: exportarBackup, importarBackup: importarBackup, apagarTudo: apagarTudo
    }, X.suportaFS());
    window.addEventListener('hashchange', lerHash);
    lerHash();
    return atualizar();
  }

  function lerHash() {
    var bk = location.hash === '#backup';
    App.View.Layout.ativar(bk ? 'backup' : 'importacao');
    App.View.Layout.setTitulo(bk ? 'Backup' : 'Importar Bases');
    if (bk) setTimeout(function () { document.getElementById('secao-backup').scrollIntoView({ behavior: 'smooth' }); }, 50);
  }

  function atualizar() {
    return Promise.all([D.info(), D.estadoVinculos()]).then(function (r) {
      V.renderInfo(r[0], r[1]);
      V.renderBackup({ emails: App.estado.emails.size, solicitacoes: App.estado.solicitacoes.length });
    });
  }

  function textoResultado(res) {
    var i = res.info;
    var t = '<b>' + D.rotulo(res.tipo) + '</b> importada de "' + U.esc(i.arquivo) + '" (aba ' + U.esc(i.aba) + '): ' + U.milhar(i.total) + ' registros.';
    if (i.resultado) t += ' ' + i.resultado.novos + ' nova(s), ' + i.resultado.atualizados + ' atualizada(s), ' + i.resultado.iguais + ' sem mudança' +
      (i.resultado.conflitos ? ', ' + i.resultado.conflitos + ' mantida(s) porque foram alteradas no sistema e ainda não gravadas' : '') + '.';
    if (i.faltando && i.faltando.length) t += ' Colunas não encontradas: ' + U.esc(i.faltando.join(', ')) + '.';
    return t;
  }

  /** Importa um ou mais arquivos em sequência (o tipo é detectado pelos cabeçalhos). */
  function importar(arquivos, tipoEsperado) {
    var log = [];
    // Unidades por último (é a mais demorada)
    arquivos.sort(function (a, b) { return /unidade/i.test(a.name) - /unidade/i.test(b.name); });
    return arquivos.reduce(function (acc, f) {
      return acc.then(function () {
        var grande = f.size > 2e6 ? ' (arquivo grande, pode levar alguns segundos)' : '';
        return UI.carregando('Lendo "' + f.name + '"' + grande + '...');
      }).then(function () { return D.importar(f, tipoEsperado); })
        .then(function (res) { log.push({ ok: true, texto: textoResultado(res) }); })
        .catch(function (e) { log.push({ ok: false, texto: U.esc(e.message || String(e)) }); });
    }, Promise.resolve()).then(function () {
      UI.fimCarregando();
      V.renderLog(log);
      var ok = log.filter(function (l) { return l.ok; }).length;
      UI.toast(ok === log.length ? 'Importação concluída (' + ok + ' arquivo' + (ok > 1 ? 's' : '') + ').' : 'Importação com erros. Veja os detalhes.', ok === log.length ? 'ok' : 'erro');
      return App.recarregar();
    });
  }

  function vincular(tipo) {
    D.vincular(tipo).then(function (res) {
      V.renderLog([{ ok: true, texto: textoResultado(res) + ' Arquivo vinculado: use "Atualizar bases" para recarregar com um clique.' }]);
      UI.toast('Arquivo vinculado e importado.');
      return App.recarregar();
    }).catch(function (e) { if (e && e.name === 'AbortError') return; UI.toast(e.message || String(e), 'erro'); });
  }

  function desvincular(tipo) {
    D.removerHandle(tipo).then(function () { UI.toast('Vínculo removido. Os dados importados continuam salvos.'); return App.recarregar(); });
  }

  /* ---------------- Backup ---------------- */
  function exportarBackup() {
    D.gerarBackup().then(function (b) {
      X.baixar(JSON.stringify(b, null, 2), 'backup_gestao_maquinas_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
      DB.setMeta('ultimoBackup', new Date().toISOString());
      UI.toast('Backup gerado: ' + b.emails.length + ' e-mail(s) e ' + b.solicitacoes.length + ' solicitação(ões).');
    }).catch(function (e) { UI.toast(e.message, 'erro'); });
  }

  function importarBackup(file, modo) {
    file.text().then(function (txt) {
      var obj;
      try { obj = JSON.parse(txt); } catch (e) { throw new Error('O arquivo não é um JSON válido.'); }
      var msg = modo === 'substituir'
        ? 'Os e-mails e solicitações atuais serão APAGADOS e substituídos pelo backup (' + (obj.emails || []).length + ' e-mails, ' + (obj.solicitacoes || []).length + ' solicitações). Continuar?'
        : 'Mesclar o backup (' + (obj.emails || []).length + ' e-mails, ' + (obj.solicitacoes || []).length + ' solicitações) com os dados atuais? Registros com o mesmo identificador serão substituídos pelos do backup.';
      return UI.confirmar(msg, { titulo: 'Restaurar backup', perigo: modo === 'substituir', ok: 'Restaurar', icone: 'database' }).then(function (ok) {
        if (!ok) return;
        return D.restaurarBackup(obj, modo).then(function (r) {
          UI.toast('Backup restaurado: ' + r.emails + ' e-mail(s), ' + r.solicitacoes + ' solicitação(ões).');
          return App.recarregar();
        });
      });
    }).catch(function (e) { UI.toast(e.message || String(e), 'erro'); });
  }

  function apagarTudo() {
    UI.confirmar('Isto apaga deste navegador as bases importadas, os e-mails, as solicitações e os vínculos de arquivos. As planilhas originais não são alteradas.\n\nFaça um backup antes. Continuar?',
      { titulo: 'Apagar dados do navegador', perigo: true, ok: 'Apagar tudo', icone: 'trash' }).then(function (ok) {
      if (!ok) return;
      return Promise.all(['bases', 'emails', 'solicitacoes', 'meta'].map(DB.limpar)).then(function () {
        UI.toast('Dados apagados.');
        return App.recarregar();
      });
    });
  }

  return { iniciar: iniciar, atualizar: atualizar };
})();
