/* ==========================================================================
   SolicitacaoController.js – formulário de solicitação (usado também na
   tela de Estabelecimentos), listagem e gravação na planilha.
   ========================================================================== */
App.Controller.Solicitacao = (function () {
  'use strict';
  var U = App.Util, UI = App.View.UI, V = App.View.Solicitacao;
  var S = App.Model.Solicitacao, D = App.Model.Dados, X = App.Model.Excel;

  /* ======================= FORMULÁRIO ======================= */
  function abrirNova(pdv) {
    if (!App.estado.temBases) { UI.toast('Importe as bases de Máquinas e Unidades antes de registrar solicitações.', 'alerta'); }
    var r = S.novo();
    if (pdv !== undefined && pdv !== null && pdv !== '') Object.assign(r, dadosMaquina(pdv));
    abrir(r, true);
  }

  function abrirEditar(uid) {
    var r = App.estado.solicitacoes.filter(function (s) { return s.uid === uid; })[0];
    if (!r) { UI.toast('Solicitação não encontrada.', 'erro'); return; }
    abrir(JSON.parse(JSON.stringify(r)), false);
  }

  /** Dados de preenchimento automático a partir das bases cruzadas. */
  function dadosMaquina(pdv) {
    var m = App.estado.porPdv.get(U.id(pdv));
    if (!m) return null;
    return {
      numero: U.texto(m.pdv), serie: m.serie, modelo: m.modeloExib || m.modelo,
      estado: m.estado, cidade: m.municipio, bairro: m.bairro, endereco: m.endereco, cep: m.cep,
      responsavel: m.responsavel, contato: m.telefone
    };
  }

  /** Busca para o autocompletar: série, PDV ou nome da unidade. */
  function buscarMaquinas(q) {
    var t = U.semAcento(q).trim(), ts = U.chaveSerie(q), res = [], LIMITE = 50;
    var total = App.estado.porPdv.size;
    // campo vazio: mostra as primeiras máquinas (por PDV) para escolher direto
    if (!t) {
      var todas = Array.from(App.estado.porPdv.values()).sort(function (a, b) { return U.comparar(a.pdv, b.pdv); });
      return { itens: todas.slice(0, LIMITE), encontrados: total, total: total };
    }
    App.estado.porPdv.forEach(function (m) {
      var serie = U.chaveSerie(m.serie), pont = 0;
      if (serie && serie.indexOf(ts) === 0) pont = 4;
      else if (String(m.pdv) === t) pont = 5;
      else if (serie && serie.indexOf(ts) > 0) pont = 3;
      else if (String(m.pdv).indexOf(t) === 0) pont = 2;
      else if (m._busca.indexOf(t) >= 0) pont = 1;
      if (pont) res.push({ p: pont, m: m });
    });
    res.sort(function (a, b) { return b.p - a.p || a.m.pdv - b.m.pdv; });
    return { itens: res.slice(0, LIMITE).map(function (x) { return x.m; }), encontrados: res.length, total: total };
  }

  /** Avisos exibidos no formulário. */
  function verificar(reg) {
    return function (d) {
      var av = [], e = App.estado;
      if (!d.serie && !d.numero) return av;
      var abertas = S.abertaParaMaquina(e.solicitacoes, d.serie, d.numero, reg.uid);
      if (abertas.length) {
        av.push({ tipo: 'alerta', texto: '<b>Já existe solicitação aberta para esta máquina:</b> ' + abertas.map(function (a) {
          return 'Nº ' + U.esc(a.numero) + ' · ' + U.esc(a.status) + (a.protocolo ? ' · protocolo ' + U.esc(a.protocolo) : '') + ' (' + U.esc(a.statusData || '') + ')';
        }).join('; ') });
      }
      var ks = U.chaveSerie(d.serie), maqSerie = ks ? e.porSerie.get(ks) : null, maqPdv = e.porPdv.get(U.id(d.numero));
      if (maqSerie && d.numero && String(maqSerie.pdv) !== U.texto(d.numero)) {
        av.push({ tipo: 'alerta', texto: 'A série <b class="mono">' + U.esc(d.serie) + '</b> pertence ao PDV <b>' + maqSerie.pdv + '</b>, mas o Nº informado é ' + U.esc(d.numero) + '.',
          acao: { rotulo: 'Usar Nº ' + maqSerie.pdv, campos: { numero: String(maqSerie.pdv) } } });
      } else if (!maqSerie && maqPdv && d.serie) {
        av.push({ tipo: 'alerta', texto: 'A série informada (<b class="mono">' + U.esc(d.serie) + '</b>) é diferente da cadastrada para o PDV ' + maqPdv.pdv +
          ': <b class="mono">' + U.esc(maqPdv.serie || '(vazia)') + '</b>. Possível erro de digitação.',
          acao: maqPdv.serie ? { rotulo: 'Corrigir para ' + maqPdv.serie, campos: { serie: maqPdv.serie } } : null });
      } else if (!maqSerie && !maqPdv && d.serie) {
        av.push({ tipo: 'alerta', texto: 'Máquina não encontrada na base (nem pela série, nem pelo Nº/PDV).' });
      }
      var m = maqSerie || maqPdv;
      if (m && m.inativa) av.push({ tipo: 'info', texto: 'A unidade <b>' + U.esc(m.nome) + '</b> está com status <b>Inativo</b> na base.' });
      if (m && typeof m.idUnidade !== 'number') av.push({ tipo: 'info', texto: 'Esta máquina não está vinculada a nenhuma unidade (ID_Unidade = ' + U.esc(m.idUnidade || 'vazio') + '). Preencha o endereço manualmente.' });
      return av;
    };
  }

  function abrir(r, novo) {
    V.abrirFormulario({
      reg: r, novo: novo, status: S.STATUS, problemas: S.PROBLEMAS,
      buscarMaquinas: buscarMaquinas, aoEscolherMaquina: dadosMaquina, verificar: verificar(r), validar: S.validar,
      podeExcluir: !novo && !r.chavePlanilha,
      salvar: function (d) {
        var anterior = novo ? null : App.estado.solicitacoes.filter(function (s) { return s.uid === r.uid; })[0];
        var abertas = S.abertaParaMaquina(App.estado.solicitacoes, d.serie, d.numero, r.uid);
        var confirma = novo && abertas.length && S.aberta(d)
          ? UI.confirmar('Já existe solicitação aberta para esta máquina (Nº ' + abertas[0].numero + '). Deseja registrar outra mesmo assim?', { titulo: 'Solicitação duplicada', icone: 'warning', ok: 'Registrar mesmo assim' })
          : Promise.resolve(true);
        return confirma.then(function (ok) {
          if (!ok) return false;
          Object.assign(r, d);
          return S.salvar(r, anterior).then(function () {
            UI.toast('Solicitação Nº ' + r.numero + ' salva. Use "Salvar na planilha" para gravar no Excel.');
            return App.recarregar();
          });
        });
      },
      excluir: function () {
        return UI.confirmar('Excluir a solicitação Nº ' + r.numero + '? Ela ainda não foi gravada na planilha.', { titulo: 'Excluir', perigo: true, ok: 'Excluir', icone: 'trash' })
          .then(function (ok) {
            if (!ok) return false;
            return S.excluir(r).then(function () { UI.toast('Solicitação excluída.'); return App.recarregar(); }).then(function () { return true; });
          });
      }
    });
  }

  /* ======================= LISTAGEM (solicitacoes.html) ======================= */
  var filtradas = [];

  function iniciar() {
    V.iniciarLista({
      filtrar: renderLista, nova: function () { abrirNova(); }, editar: abrirEditar, exportar: exportarLista,
      mudarStatus: mudarStatus, corrigirSerie: corrigirSerie, gravar: gravar, vincular: vincular,
      desvincular: desvincular, importarPlanilha: importarPlanilha
    }, S.STATUS);
    window.addEventListener('hashchange', lerHash);
    atualizar();
    lerHash();
  }

  function lerHash() {
    var nova = location.hash.indexOf('#nova') === 0;
    App.View.Layout.ativar(nova ? 'nova' : 'solicitacoes');
    if (nova) {
      var m = location.hash.match(/pdv=([^&]+)/);
      history.replaceState(null, '', location.pathname + location.search);
      abrirNova(m ? decodeURIComponent(m[1]) : undefined);
    }
  }

  function atualizar() {
    renderLista();
    return Promise.all([D.getHandle('solicitacoes'), App.Model.DB.getMeta('planilhaSolicitacoes')]).then(function (r) {
      V.renderPainelPlanilha({
        nome: r[0] ? r[0].name : (r[1] ? r[1].nome : ''), data: r[1] ? r[1].data : null, vinculado: !!r[0],
        suportaFS: X.suportaFS(), pendentes: App.estado.solicitacoes.filter(function (s) { return s.alteradoLocal; }).length
      });
    });
  }

  function renderLista() {
    var f = V.getFiltros(), termos = U.semAcento(f.busca).split(/\s+/).filter(Boolean);
    filtradas = App.estado.solicitacoes.filter(function (r) {
      if (f.status === '__abertas' && !S.aberta(r)) return false;
      if (f.status && f.status !== '__abertas' && r.status !== f.status) return false;
      if (f.pend && !r.alteradoLocal) return false;
      if (!termos.length) return true;
      var t = U.semAcento([r.numero, r.serie, r.protocolo, r.cidade, r.estado, r.responsavel, r.problema, r.bairro].join(' '));
      return termos.every(function (x) { return t.indexOf(x) >= 0; });
    });
    V.renderLista(filtradas, S.STATUS);
  }

  function mudarStatus(uid, status, select) {
    var r = App.estado.solicitacoes.filter(function (s) { return s.uid === uid; })[0];
    if (!r) return;
    S.alterarStatus(r, status).then(function () {
      V.statusSelectClasse(select, status);
      UI.toast('Status da solicitação Nº ' + r.numero + ' alterado para "' + status + '".');
      return App.recarregar();
    }).catch(function (e) { UI.toast(e.message, 'erro'); });
  }

  function corrigirSerie(uid) {
    var r = App.estado.solicitacoes.filter(function (s) { return s.uid === uid; })[0];
    if (!r || !r._divergencia) return;
    var nova = r._divergencia.serieBase;
    UI.confirmar('Trocar o Nº de Série da solicitação Nº ' + r.numero + '\nde ' + r.serie + '\npara ' + nova + ' (cadastrada na base para o PDV ' + r.numero + ')?',
      { titulo: 'Corrigir nº de série', ok: 'Corrigir' }).then(function (ok) {
      if (!ok) return;
      var ant = Object.assign({}, r);
      r.serie = nova;
      return S.salvar(r, ant).then(function () { UI.toast('Série corrigida. Grave na planilha para aplicar no Excel.'); return App.recarregar(); });
    });
  }

  function exportarLista() {
    if (!filtradas.length) { UI.toast('Nada para exportar.', 'alerta'); return; }
    var linhas = filtradas.map(function (r) { var o = Object.assign({}, r); o.status = S.statusParaPlanilha(r); return o; });
    X.exportar(linhas, X.COLUNAS_SOLICITACAO, 'Solicitacoes_filtradas_' + new Date().toISOString().slice(0, 10) + '.xlsx', 'Planilha2');
  }

  /* ----- Planilha ----- */
  function gravar() {
    var pend = App.estado.solicitacoes.filter(function (s) { return s.alteradoLocal; }).length;
    Promise.all([D.getHandle('solicitacoes'), App.Model.DB.getMeta('planilhaSolicitacoes')]).then(function (r) {
      if (!r[0] && !r[1]) {
        return UI.confirmar('Nenhuma planilha de solicitações foi importada ou vinculada. Deseja gerar uma planilha nova apenas com as solicitações do sistema?\n\nRecomendado: importe/vincule antes a planilha existente para não perder linhas.',
          { titulo: 'Planilha não encontrada', icone: 'warning', ok: 'Gerar nova' });
      }
      if (!pend) return UI.confirmar('Não há alterações pendentes. Gerar a planilha mesmo assim?', { titulo: 'Sem pendências', ok: 'Gerar' });
      return true;
    }).then(function (ok) {
      if (!ok) return;
      UI.carregando('Gravando planilha de solicitações...');
      return D.gravarSolicitacoes().then(function (res) {
        UI.fimCarregando();
        if (res.vinculoPerdido) UI.toast('O arquivo vinculado não foi encontrado (movido, renomeado ou apagado). O vínculo foi removido: salve o arquivo baixado no lugar da planilha original e vincule-a novamente.', 'alerta', 10000);
        UI.toast(res.direto
          ? 'Planilha "' + res.nome + '" gravada: ' + res.gravados + ' linha(s) alterada(s)/incluída(s), ' + res.total + ' no total.'
          : 'Arquivo "' + res.nome + '" baixado (' + res.total + ' linhas). Substitua o original por ele.', 'ok', 7000);
        return App.recarregar();
      });
    }).catch(function (e) { UI.fimCarregando(); if (e && e.name === 'AbortError') return; UI.toast('Erro ao gravar: ' + (e.message || e), 'erro'); });
  }

  function vincular() {
    D.vincular('solicitacoes').then(function (res) {
      var r = res.info.resultado;
      UI.toast('Planilha vinculada. ' + r.novos + ' nova(s), ' + r.atualizados + ' atualizada(s)' + (r.conflitos ? ', ' + r.conflitos + ' com alteração local mantida' : '') + '.');
      return App.recarregar();
    }).catch(function (e) { if (e && e.name === 'AbortError') return; UI.toast(e.message || String(e), 'erro'); });
  }

  function desvincular() {
    D.removerHandle('solicitacoes').then(function () { UI.toast('Vínculo removido. A planilha passará a ser baixada.'); return App.recarregar(); });
  }

  function importarPlanilha(file) {
    UI.carregando('Lendo ' + file.name + '...').then(function () {
      return D.importar(file, 'solicitacoes');
    }).then(function (res) {
      UI.fimCarregando();
      var r = res.info.resultado;
      UI.toast('Planilha importada: ' + r.novos + ' nova(s), ' + r.atualizados + ' atualizada(s), ' + r.iguais + ' sem mudança' + (r.conflitos ? ', ' + r.conflitos + ' com alteração local mantida' : '') + '.');
      return App.recarregar();
    }).catch(function (e) { UI.fimCarregando(); UI.toast(e.message || String(e), 'erro'); });
  }

  return { iniciar: iniciar, atualizar: atualizar, abrirNova: abrirNova, abrirEditar: abrirEditar };
})();
