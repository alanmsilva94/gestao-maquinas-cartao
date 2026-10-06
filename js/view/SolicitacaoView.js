/* ==========================================================================
   SolicitacaoView.js – formulário (modal) e listagem das solicitações.
   ========================================================================== */
App.View.Solicitacao = (function () {
  'use strict';
  var UI = App.View.UI, U = App.Util;
  var $ = function (s, r) { return (r || document).querySelector(s); };

  /* ======================= FORMULÁRIO ======================= */
  /**
   * opts: { reg, novo, status[], problemas[], buscarMaquinas(q), aoEscolherMaquina(pdv),
   *         verificar(dados) -> [{tipo, texto, acao:{rotulo, campos}}], salvar(dados), excluir(), podeExcluir }
   */
  function abrirFormulario(opts) {
    var r = opts.reg;
    var outro = r.problema && opts.problemas.indexOf(r.problema) < 0;
    var statusLista = opts.status.slice();
    if (r.status && statusLista.indexOf(r.status) < 0) statusLista.push(r.status);

    var corpo =
      '<div data-avisos></div>' +
      '<div class="form-grid">' +
      '<div class="fieldset-tit">Máquina</div>' +
      campo('col-1', 'numero', 'Nº', true, '<input class="input mono" name="numero" value="' + U.esc(r.numero) + '" title="Igual ao PDV (ID da máquina)">', 'PDV da máquina') +
      '<div class="field col-3"><label>Nº de Série <span class="req">*</span></label><div class="ac">' +
        '<div class="input-icon ac-campo">' + UI.icon('search', 'icon-sm') + '<input class="input mono" name="serie" autocomplete="off" placeholder="Clique ou digite série, PDV, unidade" value="' + U.esc(r.serie) + '">' +
        '<button type="button" class="ac-toggle" data-ac-toggle title="Mostrar lista de máquinas" tabindex="-1">' + UI.icon('down', 'icon-sm') + '</button></div>' +
        '<div class="ac-lista" hidden></div></div><span class="hint">Clique no campo (ou na seta) para abrir a lista; digite para filtrar e escolha uma máquina para preencher os dados.</span></div>' +
      campo('col-2', 'modelo', 'Modelo', true, '<input class="input" name="modelo" value="' + U.esc(r.modelo) + '">') +
      '<div class="field col-3"><label>Problema Reportado <span class="req">*</span></label><select class="select" name="problemaSel">' +
        '<option value="">Selecione...</option>' +
        opts.problemas.map(function (p) { return '<option' + (p === r.problema ? ' selected' : '') + '>' + U.esc(p) + '</option>'; }).join('') +
        '<option value="__outro"' + (outro ? ' selected' : '') + '>Outro (descrever)</option></select></div>' +
      '<div class="field col-3" data-outro' + (outro ? '' : ' hidden') + '><label>Descreva o problema <span class="req">*</span></label>' +
        '<input class="input" name="problemaOutro" value="' + U.esc(outro ? r.problema : '') + '"></div>' +

      '<div class="fieldset-tit">Local de entrega</div>' +
      campo('col-1', 'estado', 'Estado', true, '<input class="input" name="estado" maxlength="2" value="' + U.esc(r.estado) + '">') +
      campo('col-2', 'cidade', 'Cidade', true, '<input class="input" name="cidade" value="' + U.esc(r.cidade) + '">') +
      campo('col-2', 'bairro', 'Bairro', false, '<input class="input" name="bairro" value="' + U.esc(r.bairro) + '">') +
      campo('col-1', 'cep', 'CEP', true, '<input class="input mono" name="cep" placeholder="00000-000" maxlength="9" value="' + U.esc(r.cep) + '">') +
      campo('col-4', 'endereco', 'Endereço', true, '<input class="input" name="endereco" value="' + U.esc(r.endereco) + '">') +
      campo('col-2', 'responsavel', 'Responsável', true, '<input class="input" name="responsavel" value="' + U.esc(r.responsavel) + '">') +
      campo('col-3', 'contato', 'Contato', true, '<input class="input" name="contato" value="' + U.esc(r.contato) + '">') +

      '<div class="fieldset-tit">Chamado</div>' +
      campo('col-3', 'protocolo', 'Protocolo', false, '<input class="input mono" name="protocolo" inputmode="numeric" value="' + U.esc(r.protocolo) + '">', 'Guardado como texto (sem perder dígitos)') +
      '<div class="field col-3"><label>Status <span class="req">*</span></label><select class="select" name="status">' +
        statusLista.map(function (s) { return '<option' + (s === r.status ? ' selected' : '') + '>' + U.esc(s) + '</option>'; }).join('') +
        '</select><span class="hint">Última alteração: <b data-status-data>' + U.esc(r.statusData || '—') + '</b>' +
        (r.statusOriginal && r.statusOriginal !== (r.statusData ? r.statusData + ' - ' + r.status : r.status) ? ' · texto original: "' + U.esc(r.statusOriginal) + '"' : '') + '</span></div>' +
      (r.historico && r.historico.length ? '<div class="field col-6"><label>Histórico de status</label><div class="historico">' +
        r.historico.slice().reverse().map(function (x) { return '<span>' + U.esc(x.data) + ' — ' + U.esc(x.status) + '</span>'; }).join('') + '</div></div>' : '') +
      '</div>';

    var rodape = (opts.podeExcluir ? '<button class="btn btn-danger" data-excluir>' + UI.icon('trash', 'icon-sm') + 'Excluir</button>' : '<span class="small muted">' +
      (r.chavePlanilha ? 'Registro da planilha' + (r.alteradoLocal ? ' · alterações ainda não gravadas' : ' · sincronizado') : 'Novo registro') + '</span>') +
      '<div class="dir"><button class="btn" data-fechar>Cancelar</button><button class="btn btn-primary" data-salvar>' + UI.icon('save', 'icon-sm') + 'Salvar solicitação</button></div>';

    var m = UI.modal({ titulo: opts.novo ? 'Nova Solicitação de Troca' : 'Solicitação Nº ' + r.numero, icone: 'swap',
      subtitulo: 'Campos da planilha "Solicitação de Troca de Maquinas" (aba Planilha2)', corpo: corpo, rodape: rodape, naoFecharFora: true });
    var f = m.raiz;
    var inp = function (n) { return f.querySelector('[name="' + n + '"]'); };

    /* ----- problema "Outro" ----- */
    inp('problemaSel').addEventListener('change', function () {
      var o = this.value === '__outro';
      $('[data-outro]', f).hidden = !o;
      if (o) inp('problemaOutro').focus();
    });

    /* ----- máscara de CEP ----- */
    inp('cep').addEventListener('input', function () {
      var d = this.value.replace(/\D/g, '').slice(0, 8);
      this.value = d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
    });
    inp('estado').addEventListener('input', function () { this.value = this.value.toUpperCase(); });

    /* ----- autocompletar do nº de série ----- */
    var lista = $('.ac-lista', f), itens = [], idx = -1;
    function mostrarLista(q) {
      var res = opts.buscarMaquinas(q || '');
      itens = res.itens;
      idx = -1;
      if (!res.total) {
        lista.innerHTML = '<div class="ac-vazio">Nenhuma máquina carregada. Importe as planilhas em <a href="importacao.html">Importar Bases</a>.</div>';
        lista.hidden = false; return;
      }
      var topo = '<div class="ac-topo">' + (U.texto(q)
        ? U.milhar(res.encontrados) + ' máquina(s) encontrada(s)' + (res.encontrados > itens.length ? ' · mostrando ' + itens.length + ', refine a busca' : '')
        : 'Mostrando ' + itens.length + ' de ' + U.milhar(res.total) + ' máquinas · digite para filtrar') + '</div>';
      lista.innerHTML = topo + (itens.length ? itens.map(function (x, i) {
        return '<div class="ac-item" data-i="' + i + '"><b>' + U.esc(x.serie || '(sem série)') + ' · PDV ' + U.esc(x.pdv) + '</b>' +
          '<span>' + U.esc(x.nome || 'Sem estabelecimento') + (x.municipio ? ' — ' + U.esc(x.municipio) + '/' + U.esc(x.estado) : '') + ' · ' + U.esc(x.modeloExib || '') + '</span></div>';
      }).join('') : '<div class="ac-vazio">Nenhuma máquina encontrada para "' + U.esc(q) + '".</div>');
      lista.hidden = false;
      lista.scrollTop = 0;
    }
    function escolher(i) {
      var x = itens[i]; if (!x) return;
      lista.hidden = true;
      preencher(opts.aoEscolherMaquina(x.pdv));
      verificar();
    }
    inp('serie').addEventListener('input', function () { mostrarLista(this.value); });
    inp('serie').addEventListener('focus', function () { mostrarLista(this.value); });
    inp('serie').addEventListener('click', function () { if (lista.hidden) mostrarLista(this.value); });
    f.querySelector('[data-ac-toggle]').addEventListener('mousedown', function (e) {
      e.preventDefault();
      if (lista.hidden) { inp('serie').focus(); mostrarLista(inp('serie').value); } else lista.hidden = true;
    });
    inp('serie').addEventListener('keydown', function (e) {
      if (lista.hidden) { if (e.key === 'ArrowDown') { e.preventDefault(); mostrarLista(this.value); } return; }
      var els = lista.querySelectorAll('.ac-item');
      if (e.key === 'ArrowDown') { idx = Math.min(els.length - 1, idx + 1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { idx = Math.max(0, idx - 1); e.preventDefault(); }
      else if (e.key === 'Enter') { e.preventDefault(); escolher(idx < 0 ? 0 : idx); return; }
      else if (e.key === 'Escape') { e.stopPropagation(); lista.hidden = true; return; }
      els.forEach(function (el, i) { el.classList.toggle('ativo', i === idx); });
      if (els[idx]) els[idx].scrollIntoView({ block: 'nearest' });
    });
    inp('serie').addEventListener('blur', function () { setTimeout(function () { lista.hidden = true; verificar(); }, 180); });
    lista.addEventListener('mousedown', function (e) { var it = e.target.closest('[data-i]'); if (it) { e.preventDefault(); escolher(parseInt(it.dataset.i, 10)); } });
    inp('numero').addEventListener('change', verificar);

    /** Preenche campos (todos continuam editáveis). */
    function preencher(d) {
      if (!d) return;
      Object.keys(d).forEach(function (k) { var e = inp(k); if (e) { e.value = d[k] || ''; e.classList.remove('invalido'); } });
    }

    /** Lê o formulário. */
    function dados() {
      var o = {};
      ['numero', 'serie', 'modelo', 'estado', 'cidade', 'bairro', 'endereco', 'cep', 'responsavel', 'contato', 'protocolo', 'status'].forEach(function (k) { o[k] = inp(k).value.trim(); });
      var ps = inp('problemaSel').value;
      o.problema = ps === '__outro' ? inp('problemaOutro').value.trim() : ps;
      return o;
    }

    /** Mostra avisos (solicitação aberta, série divergente…). */
    function verificar() {
      var avisos = opts.verificar(dados());
      var box = $('[data-avisos]', f);
      box.innerHTML = avisos.map(function (a, i) {
        return '<div class="alert ' + a.tipo + '">' + UI.icon(a.tipo === 'erro' ? 'error' : 'warning') + '<div class="alert-body"><span>' + a.texto + '</span>' +
          (a.acao ? '<div><button class="btn btn-sm btn-white" data-acao="' + i + '">' + U.esc(a.acao.rotulo) + '</button></div>' : '') + '</div></div>';
      }).join('');
      box.querySelectorAll('[data-acao]').forEach(function (b) {
        b.addEventListener('click', function () { preencher(avisos[b.dataset.acao].acao.campos); verificar(); });
      });
    }

    /* ----- salvar ----- */
    f.querySelector('[data-salvar]').addEventListener('click', function () {
      var d = dados();
      f.querySelectorAll('.invalido').forEach(function (e) { e.classList.remove('invalido'); });
      var erros = opts.validar(d);
      if (erros.length) {
        erros.forEach(function (e) {
          var m2 = e.match(/"(.+)"/);
          var mapa = { 'Nº': 'numero', 'Nº de Série': 'serie', 'Modelo': 'modelo', 'Problema Reportado': d.problema === '' && inp('problemaSel').value === '__outro' ? 'problemaOutro' : 'problemaSel',
            'Estado': 'estado', 'Cidade': 'cidade', 'Endereço': 'endereco', 'CEP': 'cep', 'Responsável': 'responsavel', 'Contato': 'contato', 'Status': 'status' };
          var n = m2 ? mapa[m2[1]] : (/CEP/.test(e) ? 'cep' : null);
          if (n && inp(n)) inp(n).classList.add('invalido');
        });
        UI.toast(erros[0] + (erros.length > 1 ? ' (+' + (erros.length - 1) + ' pendência' + (erros.length > 2 ? 's' : '') + ')' : ''), 'erro');
        var prim = f.querySelector('.invalido'); if (prim) prim.focus();
        return;
      }
      var btn = this; btn.disabled = true;
      opts.salvar(d).then(function (ok) { if (ok !== false) m.fechar(); else btn.disabled = false; })
        .catch(function (e) { btn.disabled = false; UI.toast(e.message || String(e), 'erro'); });
    });
    var bx = f.querySelector('[data-excluir]');
    if (bx) bx.addEventListener('click', function () { opts.excluir().then(function (ok) { if (ok) m.fechar(); }); });

    verificar();
    setTimeout(function () { (opts.novo && !r.serie ? inp('serie') : inp('problemaSel')).focus(); }, 60);
    return m;
  }

  function campo(col, nome, rotulo, obrig, input, hint) {
    return '<div class="field ' + col + '"><label>' + rotulo + (obrig ? ' <span class="req">*</span>' : '') + '</label>' + input +
      (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  }

  /* ======================= LISTAGEM ======================= */
  var h = {};
  function iniciarLista(handlers, status) {
    h = handlers;
    UI.opcoes($('#s-status'), [{ valor: '__abertas', rotulo: 'Somente abertas' }].concat(status), 'Status: Todos');
    $('#s-busca').addEventListener('input', U.debounce(function () { h.filtrar(); }, 180));
    $('#s-status').addEventListener('change', function () { h.filtrar(); });
    $('#s-pend').addEventListener('change', function () { h.filtrar(); });
    $('#btn-nova').addEventListener('click', function () { h.nova(); });
    $('#btn-exportar-sol').addEventListener('click', function () { h.exportar(); });
    $('#tabela-sol tbody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-editar]'); if (b) h.editar(b.dataset.editar);
      var c = e.target.closest('[data-corrigir]'); if (c) h.corrigirSerie(c.dataset.corrigir);
    });
    $('#tabela-sol tbody').addEventListener('change', function (e) {
      var s = e.target.closest('[data-status]'); if (s) h.mudarStatus(s.dataset.status, s.value, s);
    });
    // painel da planilha
    $('#btn-gravar').addEventListener('click', function () { h.gravar(); });
    $('#btn-vincular-sol').addEventListener('click', function () { h.vincular(); });
    $('#btn-desvincular-sol').addEventListener('click', function () { h.desvincular(); });
    $('#in-planilha-sol').addEventListener('change', function () { if (this.files[0]) h.importarPlanilha(this.files[0]); this.value = ''; });
  }

  function getFiltros() { return { busca: $('#s-busca').value, status: $('#s-status').value, pend: $('#s-pend').checked }; }

  function renderLista(regs, status) {
    var tb = $('#tabela-sol tbody');
    $('#s-contador').textContent = U.milhar(regs.length) + ' solicitaç' + (regs.length === 1 ? 'ão' : 'ões');
    if (!regs.length) { tb.innerHTML = '<tr><td colspan="9" class="vazio-tabela">Nenhuma solicitação encontrada.</td></tr>'; return; }
    tb.innerHTML = regs.map(function (r) {
      var lista = status.slice(); if (lista.indexOf(r.status) < 0) lista.push(r.status);
      var div = r._divergencia && r._divergencia.tipo === 'pdv';
      return '<tr>' +
        '<td class="td-id">' + U.esc(r.numero) + '</td>' +
        '<td class="nowrap"><span class="mono">' + U.esc(r.serie) + '</span>' +
          (div ? '<span class="sub"><span class="chip alerta" title="Série cadastrada para o PDV ' + U.esc(r.numero) + '">base: ' + U.esc(r._divergencia.serieBase) + '</span> ' +
            '<button class="btn btn-xs" data-corrigir="' + U.esc(r.uid) + '">Corrigir</button></span>' : '<span class="sub">' + U.esc(r.modelo) + '</span>') + '</td>' +
        '<td><select class="select st ' + UI.classeStatus(r.status) + '" data-status="' + U.esc(r.uid) + '">' +
          lista.map(function (s) { return '<option' + (s === r.status ? ' selected' : '') + '>' + U.esc(s) + '</option>'; }).join('') + '</select><span class="sub">desde ' + U.esc(r.statusData || '—') + '</span></td>' +
        '<td class="td-trunc" style="max-width:200px" title="' + U.esc(r.problema) + '">' + U.esc(r.problema) + '</td>' +
        '<td class="nowrap">' + U.esc(r.cidade) + ' / ' + U.esc(r.estado) + '<span class="sub">' + U.esc(r.bairro) + '</span></td>' +
        '<td class="nowrap">' + U.esc(r.responsavel) + '<span class="sub">' + U.esc(r.contato) + '</span></td>' +
        '<td class="mono nowrap">' + (U.esc(r.protocolo) || '<span class="muted">—</span>') + '</td>' +
        '<td>' + (r.alteradoLocal ? '<span class="chip alerta" title="Alterada no sistema e ainda não gravada na planilha">pendente</span>' : '<span class="chip ok">na planilha</span>') + '</td>' +
        '<td class="sticky-r"><button class="btn btn-sm" data-editar="' + U.esc(r.uid) + '">' + UI.icon('edit', 'icon-sm') + 'Editar</button></td></tr>';
    }).join('');
  }

  function renderPainelPlanilha(p) {
    $('#pl-nome').textContent = p.nome || 'Nenhuma planilha importada';
    $('#pl-data').textContent = p.data ? U.dataHora(p.data) : '—';
    $('#pl-modo').innerHTML = p.vinculado ? '<span class="chip ok">' + UI.icon('link', 'icon-sm') + 'Vinculada – grava direto no arquivo</span>'
      : (p.suportaFS ? '<span class="chip">Não vinculada – o arquivo será baixado</span>' : '<span class="chip">Navegador sem acesso direto – o arquivo será baixado</span>');
    $('#pl-pend').textContent = U.milhar(p.pendentes);
    $('#btn-vincular-sol').hidden = !p.suportaFS || p.vinculado;
    $('#btn-desvincular-sol').hidden = !p.vinculado;
    $('#btn-gravar').innerHTML = UI.icon(p.vinculado ? 'save' : 'download', 'icon-sm') + (p.vinculado ? 'Salvar na planilha' : 'Gerar planilha atualizada');
  }

  function statusSelectClasse(sel, status) { sel.className = 'select st ' + UI.classeStatus(status); }

  return { abrirFormulario: abrirFormulario, iniciarLista: iniciarLista, getFiltros: getFiltros, renderLista: renderLista,
    renderPainelPlanilha: renderPainelPlanilha, statusSelectClasse: statusSelectClasse };
})();
