/* ==========================================================================
   LayoutView.js – menu lateral e cabeçalho comuns a todas as telas.
   ========================================================================== */
App.View.Layout = (function () {
  'use strict';
  var UI = App.View.UI, U = App.Util;

  var MENU = [
    { id: 'estabelecimentos', href: 'estabelecimentos.html', rotulo: 'Estabelecimentos', icone: 'store' },
    { id: 'solicitacoes', href: 'solicitacoes.html', rotulo: 'Solicitações de Troca', icone: 'swap' },
    { id: 'nova', href: 'solicitacoes.html#nova', rotulo: 'Nova Solicitação', icone: 'postadd' },
    { id: 'inconsistencias', href: 'estabelecimentos.html#inconsistencias', rotulo: 'Inconsistências', icone: 'warning', badge: true },
    { id: 'importacao', href: 'importacao.html', rotulo: 'Importar Bases', icone: 'upload' },
    { id: 'backup', href: 'importacao.html#backup', rotulo: 'Backup', icone: 'database' }
  ];

  var el = {};

  /** Insere menu + cabeçalho. `titulo` aparece no breadcrumb. */
  function montar(titulo) {
    var nav = MENU.map(function (m) {
      return '<a class="nav-link" data-menu="' + m.id + '" href="' + m.href + '"><span class="lbl">' + UI.icon(m.icone) +
        '<span>' + m.rotulo + '</span></span>' + (m.badge ? '<span class="nav-badge" data-badge hidden>0</span>' : '') + '</a>';
    }).join('');

    var side = UI.el('<aside class="sidebar">' +
      '<div><div class="sidebar-brand"><div class="sidebar-logo">' + UI.icon('pos', 'icon-lg') + '</div>' +
      '<div><strong>Gestão de Máquinas</strong><span>Painel Operacional</span></div></div>' +
      '<div class="sidebar-section">Navegação</div><nav>' + nav + '</nav></div>' +
      '<div class="sidebar-foot"><strong>Modo offline</strong><span data-foot>Dados salvos neste navegador</span></div></aside>');

    var top = UI.el('<header class="topbar">' +
      '<div class="breadcrumb"><button class="menu-toggle" type="button" title="Menu">' + UI.icon('menu') + '</button>' +
      '<span class="bc-root">Painel</span>' + UI.icon('right', 'icon-sm bc-root') + '<strong data-titulo>' + U.esc(titulo) + '</strong></div>' +
      '<div class="topbar-right"><div class="update-chip">' + UI.icon('clock', 'icon-sm') +
      '<span class="txt">Última atualização das bases:</span><b data-atualizacao>—</b></div>' +
      '<button class="btn btn-white" type="button" data-atualizar>' + UI.icon('sync') + '<span>Atualizar bases</span></button></div></header>');

    var overlay = UI.el('<div class="overlay-menu"></div>');
    document.body.insertBefore(overlay, document.body.firstChild);
    document.body.insertBefore(top, document.body.firstChild);
    document.body.insertBefore(side, document.body.firstChild);

    el.badge = side.querySelector('[data-badge]');
    el.atualizacao = top.querySelector('[data-atualizacao]');
    el.btnAtualizar = top.querySelector('[data-atualizar]');
    el.titulo = top.querySelector('[data-titulo]');

    top.querySelector('.menu-toggle').addEventListener('click', function () { document.body.classList.toggle('menu-aberto'); });
    overlay.addEventListener('click', function () { document.body.classList.remove('menu-aberto'); });
    side.querySelectorAll('.nav-link').forEach(function (a) { a.addEventListener('click', function () { document.body.classList.remove('menu-aberto'); }); });
  }

  /** Destaca o item de menu ativo. */
  function ativar(id) {
    document.querySelectorAll('.nav-link').forEach(function (a) { a.classList.toggle('ativo', a.dataset.menu === id); });
  }

  function setTitulo(t) { if (el.titulo) el.titulo.textContent = t; }
  function setAtualizacao(texto) { if (el.atualizacao) el.atualizacao.textContent = texto || '—'; }
  function setBadge(n) { if (!el.badge) return; el.badge.textContent = U.milhar(n); el.badge.hidden = !n; }
  function onAtualizar(fn) { el.btnAtualizar.addEventListener('click', fn); }

  return { montar: montar, ativar: ativar, setTitulo: setTitulo, setAtualizacao: setAtualizacao, setBadge: setBadge, onAtualizar: onAtualizar };
})();
