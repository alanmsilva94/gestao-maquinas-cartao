/* ==========================================================================
   UI.js – componentes visuais reutilizáveis (ícones SVG, toast, modal,
   confirmação, carregando, paginação). Apenas DOM, sem regra de negócio.
   ========================================================================== */
App.View.UI = (function () {
  'use strict';
  var U = App.Util;

  /* Ícones em SVG inline (traço), para funcionar offline sem fontes externas. */
  var P = {
    store: 'M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6',
    sync: 'M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2M21 4v5h-5M3 20v-5h5',
    swap: 'M16 3l4 4-4 4M20 7H4M8 21l-4-4 4-4M4 17h16',
    plus: 'M12 5v14M5 12h14',
    postadd: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M12 12v6M9 15h6',
    warning: 'M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    database: 'M4 5c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3',
    search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3',
    filteroff: 'M22 3H2l8 9.5V19l4 2v-8.5zM17 17l4 4M21 17l-4 4',
    table: 'M3 3h18v18H3zM3 9h18M3 15h18M9 3v18',
    edit: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    close: 'M18 6L6 18M6 6l12 12',
    check: 'M20 6L9 17l-5-5',
    ok: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4L12 14l-3-3',
    left: 'M15 18l-6-6 6-6',
    down: 'M6 9l6 6 6-6',
    right: 'M9 18l6-6-6-6',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
    pos: 'M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zM8 5h8v5H8zM9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01M15 17h.01',
    building: 'M3 21h18M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2',
    pending: 'M9 3h6v3H9zM9 4.5H6a1 1 0 0 0-1 1V21h14V5.5a1 1 0 0 0-1-1h-3M9 12h6M9 16h4',
    info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
    error: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 8v4M12 16h.01',
    link: 'M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7',
    unlink: 'M18.8 13.2l1.7-1.7a5 5 0 0 0-7-7l-1.7 1.7M5.2 10.8l-1.7 1.7a5 5 0 0 0 7 7l1.7-1.7M8 2v3M2 8h3M16 22v-3M22 16h-3',
    trash: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5',
    save: 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2zM17 21v-8H7v8M7 3v5h8',
    menu: 'M3 6h18M3 12h18M3 18h18',
    file: 'M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6',
    mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z'
  };

  function icon(nome, cls) {
    return '<svg class="icon ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + (P[nome] || P.info) + '"/></svg>';
  }

  /** Cria um elemento a partir de HTML. */
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  /* ---------------- Toast ---------------- */
  function toast(msg, tipo, ms) {
    var box = document.querySelector('.toasts');
    if (!box) { box = el('<div class="toasts" role="status" aria-live="polite"></div>'); document.body.appendChild(box); }
    var ic = { erro: 'error', alerta: 'warning', info: 'info' }[tipo] || 'ok';
    var t = el('<div class="toast ' + (tipo || 'ok') + '">' + icon(ic) + '<span>' + U.esc(msg) + '</span></div>');
    box.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('visivel'); });
    setTimeout(function () { t.classList.remove('visivel'); setTimeout(function () { t.remove(); }, 300); }, ms || (tipo === 'erro' ? 7000 : 4000));
  }

  /* ---------------- Modal ---------------- */
  /**
   * Abre um modal. opts: { titulo, subtitulo, icone, corpo (HTML), rodape (HTML), pequeno, aoFechar }
   * Retorna { raiz, corpo, fechar }.
   */
  function modal(opts) {
    var bg = el('<div class="modal-bg" role="dialog" aria-modal="true">' +
      '<div class="modal ' + (opts.pequeno ? 'pequeno' : '') + '">' +
      '<div class="modal-head"><div class="tit">' + (opts.icone ? '<div class="ico">' + icon(opts.icone, 'icon-lg') + '</div>' : '') +
      '<div><h3>' + U.esc(opts.titulo) + '</h3>' + (opts.subtitulo ? '<p>' + U.esc(opts.subtitulo) + '</p>' : '') + '</div></div>' +
      '<button type="button" class="btn btn-ghost btn-icon" data-fechar title="Fechar">' + icon('close') + '</button></div>' +
      '<div class="modal-body">' + (opts.corpo || '') + '</div>' +
      (opts.rodape ? '<div class="modal-foot">' + opts.rodape + '</div>' : '') +
      '</div></div>');
    document.body.appendChild(bg);
    requestAnimationFrame(function () { bg.classList.add('aberto'); });
    var fechado = false;
    function fechar() {
      if (fechado) return; fechado = true;
      bg.classList.remove('aberto');
      document.removeEventListener('keydown', esc);
      setTimeout(function () { bg.remove(); }, 180);
      if (opts.aoFechar) opts.aoFechar();
    }
    function esc(e) { if (e.key === 'Escape' && bg === document.querySelector('.modal-bg:last-of-type')) fechar(); }
    document.addEventListener('keydown', esc);
    bg.addEventListener('mousedown', function (e) { if (e.target === bg && !opts.naoFecharFora) fechar(); });
    bg.querySelectorAll('[data-fechar]').forEach(function (b) { b.addEventListener('click', fechar); });
    return { raiz: bg, corpo: bg.querySelector('.modal-body'), fechar: fechar };
  }

  /** Caixa de confirmação. Retorna Promise<boolean>. */
  function confirmar(msg, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var ok = false;
      var m = modal({
        titulo: opts.titulo || 'Confirmar', icone: opts.icone || 'info', pequeno: true,
        corpo: '<p>' + U.esc(msg).replace(/\n/g, '<br>') + '</p>',
        rodape: '<div class="dir"><button class="btn" data-fechar>' + (opts.cancelar || 'Cancelar') + '</button>' +
          '<button class="btn ' + (opts.perigo ? 'btn-danger' : 'btn-primary') + '" data-ok>' + (opts.ok || 'Confirmar') + '</button></div>',
        aoFechar: function () { resolve(ok); }
      });
      var b = m.raiz.querySelector('[data-ok]');
      b.addEventListener('click', function () { ok = true; m.fechar(); });
      setTimeout(function () { b.focus(); }, 50);
    });
  }

  /* ---------------- Carregando ---------------- */
  var loadingEl = null;
  function carregando(msg) {
    if (!loadingEl) { loadingEl = el('<div class="loading"><div class="spinner"></div><div class="msg"></div></div>'); document.body.appendChild(loadingEl); }
    loadingEl.querySelector('.msg').textContent = msg || 'Carregando...';
    loadingEl.hidden = false;
    // devolve Promise que resolve após o navegador pintar a tela (antes de processamento pesado)
    return new Promise(function (r) { requestAnimationFrame(function () { setTimeout(r, 30); }); });
  }
  function fimCarregando() { if (loadingEl) loadingEl.hidden = true; }

  /* ---------------- Paginação ---------------- */
  /** Monta a lista de páginas com reticências. */
  function paginasVisiveis(atual, total) {
    var out = [], i;
    if (total <= 7) { for (i = 1; i <= total; i++) out.push(i); return out; }
    out.push(1);
    var ini = Math.max(2, atual - 1), fim = Math.min(total - 1, atual + 1);
    if (atual <= 3) { ini = 2; fim = 4; }
    if (atual >= total - 2) { ini = total - 3; fim = total - 1; }
    if (ini > 2) out.push('…');
    for (i = ini; i <= fim; i++) out.push(i);
    if (fim < total - 1) out.push('…');
    out.push(total);
    return out;
  }

  /** Renderiza o rodapé da tabela (contador, itens por página e páginas). */
  function rodapeTabela(container, total, pagina, porPagina, aoMudar) {
    var nPag = Math.max(1, Math.ceil(total / porPagina));
    var ini = total ? (pagina - 1) * porPagina + 1 : 0, fim = Math.min(total, pagina * porPagina);
    var html = '<div class="nowrap">Mostrando <b>' + U.milhar(ini) + '–' + U.milhar(fim) + '</b> de <b>' + U.milhar(total) + '</b> registros' +
      ' &nbsp;|&nbsp; Itens por página: <select class="select" data-pp>' +
      [25, 50, 100, 200].map(function (n) { return '<option' + (n === porPagina ? ' selected' : '') + '>' + n + '</option>'; }).join('') +
      '</select></div><div class="paginacao">' +
      '<button class="pg" data-p="' + (pagina - 1) + '"' + (pagina <= 1 ? ' disabled' : '') + ' title="Anterior">' + icon('left', 'icon-sm') + '</button>' +
      paginasVisiveis(pagina, nPag).map(function (p) {
        return p === '…' ? '<span class="reticencias">…</span>' : '<button class="pg' + (p === pagina ? ' ativo' : '') + '" data-p="' + p + '">' + p + '</button>';
      }).join('') +
      '<button class="pg" data-p="' + (pagina + 1) + '"' + (pagina >= nPag ? ' disabled' : '') + ' title="Próxima">' + icon('right', 'icon-sm') + '</button></div>';
    container.innerHTML = html;
    container.querySelectorAll('[data-p]').forEach(function (b) {
      b.addEventListener('click', function () { aoMudar({ pagina: parseInt(b.dataset.p, 10) }); });
    });
    container.querySelector('[data-pp]').addEventListener('change', function (e) { aoMudar({ pagina: 1, porPagina: parseInt(e.target.value, 10) }); });
  }

  /** Preenche um <select> mantendo o valor selecionado, se ainda existir. */
  function opcoes(select, valores, rotuloTodos) {
    var atual = select.value;
    select.innerHTML = '<option value="">' + U.esc(rotuloTodos) + '</option>' +
      valores.map(function (v) {
        var val = typeof v === 'object' ? v.valor : v, rot = typeof v === 'object' ? v.rotulo : v;
        return '<option value="' + U.esc(val) + '">' + U.esc(rot) + '</option>';
      }).join('');
    if (atual && valores.some(function (v) { return (typeof v === 'object' ? v.valor : v) == atual; })) select.value = atual;
  }

  /** Classe CSS de status da solicitação. */
  function classeStatus(s) {
    return { 'Aguardando abertura': 'st-aguardando', 'Chamado aberto': 'st-aberto', 'Em andamento': 'st-andamento',
      'Máquina enviada': 'st-enviada', 'Resolvido': 'st-resolvido', 'Cancelado': 'st-cancelado' }[s] || 'st-outro';
  }

  return { icon: icon, el: el, toast: toast, modal: modal, confirmar: confirmar, carregando: carregando,
    fimCarregando: fimCarregando, rodapeTabela: rodapeTabela, opcoes: opcoes, classeStatus: classeStatus };
})();
