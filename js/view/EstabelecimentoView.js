/* ==========================================================================
   EstabelecimentoView.js – renderização da tela de Estabelecimentos com
   Máquina e da aba de Inconsistências. Só DOM e eventos.
   ========================================================================== */
App.View.Estabelecimento = (function () {
  'use strict';
  var UI = App.View.UI, U = App.Util;
  var $ = function (s) { return document.querySelector(s); };
  var h = {}; // handlers definidos pelo controller

  /* Colunas da tabela principal (ordem exigida). */
  var COLUNAS = [
    { campo: 'pdv', titulo: 'ID_Maquina' },
    { campo: 'serie', titulo: 'Número de Série_Maquina' },
    { campo: 'nome', titulo: 'Nome Unidade' },
    { campo: 'regiao', titulo: 'Desc.Região' },
    { campo: 'estado', titulo: 'Estado' },
    { campo: 'municipio', titulo: 'Município' },
    { campo: 'endereco', titulo: 'Endereço' },
    { campo: 'cep', titulo: 'CEP' },
    { campo: 'bairro', titulo: 'Bairro' },
    { campo: 'telefone', titulo: 'Telefone' },
    { campo: 'email', titulo: 'E-mail' },
    { campo: 'responsavel', titulo: 'Responsável Local' }
  ];

  function iniciar(handlers) {
    h = handlers;
    // cabeçalho da tabela
    $('#tabela-maquinas thead').innerHTML = '<tr>' + COLUNAS.map(function (c) {
      return '<th class="ordenavel" data-ordem="' + c.campo + '">' + c.titulo + ' <span class="sort"></span></th>';
    }).join('') + '<th class="sticky-r">Ações</th></tr>';

    $('#tabela-maquinas thead').addEventListener('click', function (e) {
      var th = e.target.closest('[data-ordem]'); if (th) h.ordenar(th.dataset.ordem);
    });
    var filtrar = U.debounce(function () { h.filtrar(); }, 180);
    $('#f-busca').addEventListener('input', filtrar);
    ['#f-estado', '#f-regiao', '#f-municipio', '#f-modelo'].forEach(function (s) { $(s).addEventListener('change', function () { h.filtrar(s); }); });
    $('#btn-limpar').addEventListener('click', function () { limparFiltros(); h.filtrar(); });
    $('#btn-exportar').addEventListener('click', function () { h.exportar(); });

    // ações nas linhas (delegação)
    $('#tabela-maquinas tbody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-solicitar]');
      if (b) { h.solicitar(U.id(b.dataset.solicitar)); return; }
      var em = e.target.closest('[data-email]');
      if (em) editarEmail(em);
    });

    // abas
    document.querySelectorAll('[data-tab]').forEach(function (t) {
      t.addEventListener('click', function () { h.trocarAba(t.dataset.tab); });
    });

    // inconsistências
    $('#inc-cards').addEventListener('click', function (e) {
      var c = e.target.closest('[data-inc]'); if (c) h.incTipo(c.dataset.inc);
    });
    $('#inc-busca').addEventListener('input', U.debounce(function () { h.incFiltrar(); }, 180));
    $('#btn-inc-exportar').addEventListener('click', function () { h.incExportar(); });
    $('#tabela-inc tbody').addEventListener('click', function (e) {
      var b = e.target.closest('[data-abrir-sol]'); if (b) h.abrirSolicitacao(b.dataset.abrirSol);
    });
  }

  /* ---------------- Estado vazio / KPIs ---------------- */
  function semBases(sim) {
    $('#sem-bases').hidden = !sim;
    $('#conteudo-bases').hidden = sim;
  }

  function renderKpis(k) {
    $('#kpis').innerHTML = [
      kpi('Máquinas Cadastradas', U.milhar(k.maquinas), 'pos', 'azul', U.milhar(k.vinculadas) + ' vinculadas a unidades', ''),
      kpi('Estabelecimentos c/ Máquina', U.milhar(k.estabelecimentos), 'building', 'marinho', 'Unidades distintas com POS', k.cobertura),
      kpi('Solicitações Abertas', U.milhar(k.abertas), 'swap', 'neutro', 'Pedidos de troca em andamento', ''),
      kpi('Inconsistências', U.milhar(k.inconsistencias), 'warning', 'erro', 'Cadastros com dados divergentes', k.inconsistencias ? 'Atenção' : '', true)
    ].join('');
  }
  function kpi(tit, val, ic, cor, sub, chip, erro) {
    return '<div class="card kpi"><div class="kpi-top"><span>' + tit + '</span><div class="kpi-ico ' + cor + '">' + UI.icon(ic) + '</div></div>' +
      '<div class="kpi-val"><b class="' + (erro && val !== '0' ? 'erro' : '') + '">' + val + '</b>' +
      (chip ? '<span class="chip ' + (erro ? 'erro' : 'azul') + '">' + U.esc(chip) + '</span>' : '') + '</div><small>' + sub + '</small></div>';
  }

  /* ---------------- Filtros ---------------- */
  function getFiltros() {
    return { busca: $('#f-busca').value, estado: $('#f-estado').value, regiao: $('#f-regiao').value,
      municipio: $('#f-municipio').value, modelo: $('#f-modelo').value };
  }
  function limparFiltros() { ['#f-busca', '#f-estado', '#f-regiao', '#f-municipio', '#f-modelo'].forEach(function (s) { $(s).value = ''; }); }
  function setOpcoes(o) {
    if (o.estados) UI.opcoes($('#f-estado'), o.estados, 'Estado: Todos');
    if (o.regioes) UI.opcoes($('#f-regiao'), o.regioes, 'Região: Todas');
    if (o.municipios) UI.opcoes($('#f-municipio'), o.municipios, 'Município: Todos');
    if (o.modelos) UI.opcoes($('#f-modelo'), o.modelos, 'Modelo: Todos');
  }

  /* ---------------- Tabela ---------------- */
  function renderTabela(linhas, ordem, abertasPorPdv) {
    document.querySelectorAll('#tabela-maquinas th[data-ordem] .sort').forEach(function (s) {
      s.textContent = s.parentNode.dataset.ordem === ordem.campo ? (ordem.asc ? '▲' : '▼') : '';
    });
    var tb = $('#tabela-maquinas tbody');
    if (!linhas.length) {
      tb.innerHTML = '<tr><td class="vazio-tabela" colspan="' + (COLUNAS.length + 1) + '">Nenhum registro encontrado com os filtros atuais.</td></tr>';
      return;
    }
    tb.innerHTML = linhas.map(function (l) {
      var aberta = abertasPorPdv.has(l.pdv);
      return '<tr class="' + (l.inativa ? 'linha-inativa' : '') + '">' +
        '<td class="td-id">#' + U.esc(l.pdv) + '</td>' +
        '<td class="nowrap"><span class="mono">' + (U.esc(l.serie) || '<span class="chip alerta">sem série</span>') + '</span>' +
          '<span class="sub">' + U.esc(l.modeloExib || '—') + (aberta ? ' · <span class="chip alerta" title="Há solicitação de troca em aberto">troca aberta</span>' : '') + '</span></td>' +
        '<td class="td-nome">' + U.esc(l.nome) + (l.inativa ? ' <span class="chip alerta">Inativa</span>' : '') + '<span class="sub">ID ' + U.esc(l.idUnidade) + '</span></td>' +
        '<td><span class="tag">' + U.esc(l.regiao) + '</span></td>' +
        '<td class="text-center"><span class="uf">' + U.esc(l.estado) + '</span></td>' +
        '<td class="nowrap">' + U.esc(l.municipio) + '</td>' +
        '<td class="td-trunc muted" title="' + U.esc(l.endereco) + '">' + U.esc(l.endereco) + '</td>' +
        '<td class="mono nowrap">' + U.esc(l.cep) + '</td>' +
        '<td class="nowrap">' + U.esc(l.bairro) + '</td>' +
        '<td class="mono nowrap">' + U.esc(l.telefone) + '</td>' +
        '<td>' + celulaEmail(l) + '</td>' +
        '<td class="nowrap">' + U.esc(l.responsavel) + '</td>' +
        '<td class="sticky-r"><button class="btn btn-secondary btn-sm" data-solicitar="' + U.esc(l.pdv) + '">' + UI.icon('swap', 'icon-sm') + 'Solicitar troca</button></td>' +
        '</tr>';
    }).join('');
  }

  function celulaEmail(l) {
    if (!l.email) return '<button class="email-cell email-add" data-email="' + U.esc(l.idUnidade) + '" data-valor="">' + UI.icon('plus', 'icon-sm') + 'Adicionar e-mail</button>';
    return '<button class="email-cell" data-email="' + U.esc(l.idUnidade) + '" data-valor="' + U.esc(l.email) + '" title="' + U.esc(l.email) + '"><span class="txt">' +
      U.esc(l.email) + '</span>' + UI.icon('edit', 'icon-sm') + '</button>';
  }

  /** Transforma a célula em campo de edição (Enter salva, Esc cancela). */
  function editarEmail(botao) {
    var td = botao.parentNode, idUnidade = U.id(botao.dataset.email), original = botao.dataset.valor;
    td.innerHTML = '<div class="email-edit"><input class="input" type="email" placeholder="email@exemplo.com" value="' + U.esc(original) + '">' +
      '<button class="btn btn-primary btn-sm btn-icon" data-ok title="Salvar">' + UI.icon('check', 'icon-sm') + '</button>' +
      '<button class="btn btn-sm btn-icon" data-cancel title="Cancelar">' + UI.icon('close', 'icon-sm') + '</button></div>';
    var inp = td.querySelector('input'), salvando = false;
    inp.focus(); inp.select();
    function restaurar(valor) { td.innerHTML = celulaEmail({ idUnidade: idUnidade, email: valor }); }
    function salvar() {
      if (salvando) return;
      var v = inp.value.trim();
      if (v === original) { restaurar(original); return; }
      if (!U.emailValido(v)) { inp.classList.add('invalido'); UI.toast('E-mail inválido. Para mais de um, separe com ";".', 'erro'); inp.focus(); return; }
      salvando = true;
      h.salvarEmail(idUnidade, v).then(function () { restaurar(v); }).catch(function () { salvando = false; inp.focus(); });
    }
    inp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); salvar(); }
      if (e.key === 'Escape') { e.stopPropagation(); restaurar(original); }
    });
    td.querySelector('[data-ok]').addEventListener('mousedown', function (e) { e.preventDefault(); salvar(); });
    td.querySelector('[data-cancel]').addEventListener('mousedown', function (e) { e.preventDefault(); restaurar(original); });
  }

  function renderRodape(total, pagina, porPagina) {
    UI.rodapeTabela($('#rodape-maquinas'), total, pagina, porPagina, h.paginar);
    $('#contador').textContent = U.milhar(total) + ' resultado' + (total === 1 ? '' : 's');
  }

  /* ---------------- Abas ---------------- */
  function mostrarAba(id) {
    document.querySelectorAll('[data-tab]').forEach(function (t) { t.classList.toggle('ativo', t.dataset.tab === id); });
    $('#painel-maquinas').hidden = id !== 'maquinas';
    $('#painel-inconsistencias').hidden = id !== 'inconsistencias';
    var inc = id === 'inconsistencias';
    $('#titulo-pagina').textContent = inc ? 'Inconsistências das bases' : 'Estabelecimentos com Máquina';
    $('#sub-pagina').textContent = inc ? 'Máquinas sem unidade, unidades inexistentes ou inativas, séries vazias/duplicadas e solicitações com série divergente.'
      : 'Parque de terminais cruzado com a base de unidades. Clique no e-mail para editar.';
  }
  function setContagemAba(n) { $('#tab-inc-count').textContent = U.milhar(n); }

  /* ---------------- Inconsistências ---------------- */
  function renderIncCards(tipos, contagem, ativo, total) {
    var cards = [{ id: '', rotulo: 'Todas', descricao: 'Todas as ocorrências', n: total }].concat(Object.keys(tipos).map(function (k) {
      return { id: k, rotulo: tipos[k].rotulo, descricao: tipos[k].descricao, n: contagem[k] || 0 };
    }));
    $('#inc-cards').innerHTML = cards.map(function (c) {
      return '<button class="inc-card ' + (c.id === ativo ? 'ativo ' : '') + (c.n ? '' : 'zero') + '" data-inc="' + c.id + '" title="' + U.esc(c.descricao) + '">' +
        '<b>' + U.milhar(c.n) + '</b><strong>' + U.esc(c.rotulo) + '</strong><span>' + U.esc(c.descricao) + '</span></button>';
    }).join('');
  }
  function getIncBusca() { return $('#inc-busca').value; }

  function renderIncTabela(lista) {
    var tb = $('#tabela-inc tbody');
    if (!lista.length) { tb.innerHTML = '<tr><td colspan="8" class="vazio-tabela">Nenhuma inconsistência nesta categoria. ' + UI.icon('ok', 'icon-sm') + '</td></tr>'; return; }
    tb.innerHTML = lista.slice(0, 1000).map(function (i) {
      var chip = i.tipo === 'unidade_inativa' || i.tipo === 'modelo_vazio' ? 'alerta' : 'erro';
      return '<tr><td><span class="chip ' + chip + '">' + U.esc(i.rotulo) + '</span></td>' +
        '<td class="td-id">#' + U.esc(i.pdv) + '</td><td class="mono">' + (U.esc(i.serie) || '—') + '</td>' +
        '<td>' + U.esc(i.modelo || '—') + '</td><td class="mono">' + U.esc(i.idUnidade) + '</td>' +
        '<td>' + U.esc(i.nome || '—') + '</td><td class="nowrap">' + U.esc([i.municipio, i.estado].filter(Boolean).join(' / ') || '—') + '</td>' +
        '<td>' + U.esc(i.detalhe) + (i.uidSolicitacao ? ' <button class="btn btn-xs" data-abrir-sol="' + U.esc(i.uidSolicitacao) + '">Abrir solicitação</button>' : '') + '</td></tr>';
    }).join('') + (lista.length > 1000 ? '<tr><td colspan="8" class="vazio-tabela">Mostrando 1.000 de ' + U.milhar(lista.length) + '. Exporte para ver todas.</td></tr>' : '');
  }

  return { COLUNAS: COLUNAS, iniciar: iniciar, semBases: semBases, renderKpis: renderKpis, getFiltros: getFiltros,
    setOpcoes: setOpcoes, renderTabela: renderTabela, renderRodape: renderRodape, mostrarAba: mostrarAba,
    setContagemAba: setContagemAba, renderIncCards: renderIncCards, renderIncTabela: renderIncTabela, getIncBusca: getIncBusca };
})();
