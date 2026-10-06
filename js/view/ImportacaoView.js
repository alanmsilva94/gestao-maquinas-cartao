/* ==========================================================================
   ImportacaoView.js – tela de importação/atualização das bases e backup.
   ========================================================================== */
App.View.Importacao = (function () {
  'use strict';
  var UI = App.View.UI, U = App.Util;
  var $ = function (s) { return document.querySelector(s); };

  var CARDS = [
    { tipo: 'maquinas', titulo: 'Máquinas', arquivo: 'Maquinas.xlsx', aba: 'BD_Maquinas', icone: 'pos' },
    { tipo: 'unidades', titulo: 'Unidades', arquivo: 'Unidades.xlsx', aba: 'Planilha1', icone: 'building' },
    { tipo: 'solicitacoes', titulo: 'Solicitações de Troca', arquivo: 'Solicitação de Troca de Maquinas.xlsx', aba: 'Planilha2', icone: 'swap' }
  ];

  function iniciar(h, suportaFS) {
    $('#cards-bases').innerHTML = CARDS.map(function (c) {
      return '<div class="card base-card" data-card="' + c.tipo + '">' +
        '<div class="topo"><div class="ico">' + UI.icon(c.icone, 'icon-lg') + '</div><div><h3>' + c.titulo + '</h3>' +
        '<span class="small muted">' + c.arquivo + ' · aba ' + c.aba + '</span></div></div>' +
        '<dl data-info><dt>Situação</dt><dd>Não importada</dd></dl>' +
        '<div class="btn-group">' +
        '<label class="btn btn-sm btn-primary">' + UI.icon('upload', 'icon-sm') + 'Selecionar arquivo<input type="file" accept=".xlsx" hidden data-input="' + c.tipo + '"></label>' +
        (suportaFS ? '<button class="btn btn-sm" data-vincular="' + c.tipo + '">' + UI.icon('link', 'icon-sm') + 'Vincular arquivo</button>' +
          '<button class="btn btn-sm btn-ghost" data-desvincular="' + c.tipo + '" hidden>' + UI.icon('unlink', 'icon-sm') + 'Desvincular</button>' : '') +
        '</div></div>';
    }).join('');

    $('#fs-aviso').hidden = suportaFS;
    $('#btn-atualizar-vinc').hidden = !suportaFS;

    document.querySelectorAll('[data-input]').forEach(function (i) {
      i.addEventListener('change', function () { if (i.files[0]) h.importar([i.files[0]], i.dataset.input); i.value = ''; });
    });
    document.querySelectorAll('[data-vincular]').forEach(function (b) { b.addEventListener('click', function () { h.vincular(b.dataset.vincular); }); });
    document.querySelectorAll('[data-desvincular]').forEach(function (b) { b.addEventListener('click', function () { h.desvincular(b.dataset.desvincular); }); });
    $('#btn-atualizar-vinc').addEventListener('click', function () { h.atualizarVinculados(); });

    // área de arrastar e soltar (aceita vários arquivos; tipo detectado pelos cabeçalhos)
    var dz = $('#dropzone'), inp = $('#in-multi');
    dz.addEventListener('click', function () { inp.click(); });
    dz.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inp.click(); } });
    inp.addEventListener('change', function () { if (inp.files.length) h.importar(Array.prototype.slice.call(inp.files)); inp.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add('arrastando'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove('arrastando'); }); });
    dz.addEventListener('drop', function (e) {
      var fs = Array.prototype.slice.call(e.dataTransfer.files).filter(function (f) { return /\.xlsx$/i.test(f.name); });
      if (!fs.length) { UI.toast('Solte arquivos .xlsx.', 'alerta'); return; }
      h.importar(fs);
    });
    // evita que soltar fora da área abra o arquivo no navegador
    window.addEventListener('dragover', function (e) { e.preventDefault(); });
    window.addEventListener('drop', function (e) { e.preventDefault(); });

    // backup
    $('#btn-backup').addEventListener('click', function () { h.exportarBackup(); });
    $('#in-backup').addEventListener('change', function () { if (this.files[0]) h.importarBackup(this.files[0], $('#bk-modo').value); this.value = ''; });
    $('#btn-apagar').addEventListener('click', function () { h.apagarTudo(); });
  }

  /** Atualiza as informações de cada base. */
  function renderInfo(info, vinculos) {
    CARDS.forEach(function (c) {
      var card = document.querySelector('[data-card="' + c.tipo + '"]');
      var i = info[c.tipo], v = vinculos[c.tipo];
      var html;
      if (!i) html = '<dt>Situação</dt><dd><span class="chip alerta">Não importada</span></dd>';
      else {
        html = '<dt>Arquivo</dt><dd>' + U.esc(i.arquivo) + '</dd>' +
          '<dt>Atualizada em</dt><dd class="mono">' + U.dataHora(i.data) + '</dd>' +
          '<dt>Registros</dt><dd>' + U.milhar(i.total) + (i.descartados ? ' <span class="chip alerta">' + i.descartados + ' ID(s) duplicado(s) ignorado(s)</span>' : '') + '</dd>' +
          '<dt>Aba lida</dt><dd>' + U.esc(i.aba) + '</dd>' +
          (i.faltando && i.faltando.length ? '<dt>Colunas ausentes</dt><dd><span class="chip erro">' + U.esc(i.faltando.join(', ')) + '</span></dd>' : '') +
          (i.resultado ? '<dt>Última mescla</dt><dd>' + i.resultado.novos + ' nova(s), ' + i.resultado.atualizados + ' atualizada(s)' +
            (i.resultado.conflitos ? ', <span class="chip alerta">' + i.resultado.conflitos + ' mantida(s) com alteração local</span>' : '') + '</dd>' : '');
      }
      html += '<dt>Vínculo</dt><dd>' + (v ? '<span class="chip ok">' + UI.icon('link', 'icon-sm') + U.esc(v.name) + '</span>' : '<span class="muted">—</span>') + '</dd>';
      card.querySelector('[data-info]').innerHTML = html;
      var bv = card.querySelector('[data-vincular]'), bd = card.querySelector('[data-desvincular]');
      if (bv) bv.innerHTML = UI.icon('link', 'icon-sm') + (v ? 'Trocar vínculo' : 'Vincular arquivo');
      if (bd) bd.hidden = !v;
    });
  }

  function renderBackup(n) {
    $('#bk-info').textContent = U.milhar(n.emails) + ' e-mail(s) personalizado(s) e ' + U.milhar(n.solicitacoes) + ' solicitação(ões) guardadas neste navegador.';
  }

  /** Lista o resultado da última importação. */
  function renderLog(itens) {
    var box = $('#log-importacao');
    box.hidden = !itens.length;
    box.innerHTML = itens.map(function (i) {
      return '<div class="alert ' + (i.ok ? 'ok' : 'erro') + '">' + UI.icon(i.ok ? 'ok' : 'error') + '<div class="alert-body">' + i.texto + '</div></div>';
    }).join('');
  }

  return { iniciar: iniciar, renderInfo: renderInfo, renderBackup: renderBackup, renderLog: renderLog };
})();
