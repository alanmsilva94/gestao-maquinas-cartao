/* ==========================================================================
   MaquinaModel.js – base de máquinas (Maquinas.xlsx), cruzamento com as
   unidades e detecção de inconsistências.
   ========================================================================== */
App.Model.Maquina = (function () {
  'use strict';
  var U = App.Util, DB = App.Model.DB;

  /** Tipos de inconsistência exibidos na aba separada. */
  var TIPOS = {
    sem_unidade: { rotulo: 'Sem estabelecimento (N/D)', descricao: 'ID_Unidade = N/D ou vazio' },
    unidade_inexistente: { rotulo: 'Unidade inexistente', descricao: 'ID_Unidade não encontrado na base de unidades' },
    unidade_inativa: { rotulo: 'Unidade inativa', descricao: 'Máquina vinculada a unidade com Status = Inativo' },
    serie_vazia: { rotulo: 'Nº de série vazio', descricao: 'Máquina sem número de série' },
    serie_duplicada: { rotulo: 'Nº de série duplicado', descricao: 'Mesmo número de série em mais de um PDV' },
    modelo_vazio: { rotulo: 'Modelo vazio', descricao: 'Máquina sem modelo informado' },
    solicitacao_serie: { rotulo: 'Série divergente em solicitação', descricao: 'Nº de série da solicitação diferente do cadastrado para o PDV' }
  };

  /** Converte as linhas brutas em registros de máquina. */
  function processar(linhas) {
    var lista = [], pdvs = {}, duplicados = 0;
    linhas.forEach(function (l) {
      var pdv = U.id(l.pdv);
      if (pdv === '') return;
      if (pdvs[pdv]) { duplicados++; return; }
      pdvs[pdv] = 1;
      var idUnidade = U.id(l.idUnidade);
      lista.push({
        pdv: pdv,
        serie: U.texto(l.serie).toUpperCase(),
        modelo: U.texto(l.modelo),                 // valor original
        modeloExib: U.modeloExibicao(l.modelo),    // valor padronizado p/ tela
        idUnidade: idUnidade                         // número ou texto (ex.: "N/D")
      });
    });
    return { lista: lista, duplicados: duplicados };
  }

  function salvar(lista, info) { return DB.put('bases', { chave: 'maquinas', linhas: lista, info: info }); }

  function carregar() {
    return DB.get('bases', 'maquinas').then(function (r) {
      return { lista: r ? r.linhas : [], info: r ? r.info : null };
    });
  }

  /**
   * Cruza máquinas × unidades (1 registro por máquina).
   * @returns { linhas: [...] (somente com unidade válida), inconsistencias: [...], porPdv, porSerie }
   */
  function cruzar(maquinas, mapaUnidades, emails) {
    var linhas = [], inc = [], porPdv = new Map(), porSerie = new Map(), contSerie = {};
    maquinas.forEach(function (m) {
      var k = U.chaveSerie(m.serie);
      if (k) contSerie[k] = (contSerie[k] || 0) + 1;
    });

    maquinas.forEach(function (m) {
      var ig = typeof m.idUnidade === 'number' ? mapaUnidades.get(m.idUnidade) : null;
      var base = {
        pdv: m.pdv, serie: m.serie, modelo: m.modelo, modeloExib: m.modeloExib, idUnidade: m.idUnidade,
        nome: ig ? ig.nome : '', regiao: ig ? ig.regiao : '', estado: ig ? ig.estado : '',
        municipio: ig ? ig.municipio : '', endereco: ig ? ig.endereco : '', cep: ig ? ig.cep : '',
        bairro: ig ? ig.bairro : '', telefone: ig ? ig.telefone : '',
        email: ig ? (emails.get(ig.id) || '') : '', responsavel: ig ? ig.responsavel : '',
        statusUnidade: ig ? ig.status : '', inativa: ig ? !App.Model.Unidade.ativa(ig) : false
      };
      // texto pré-normalizado para busca rápida
      base._busca = U.semAcento([m.pdv, m.serie, base.nome, base.municipio, base.idUnidade].join(' '));
      porPdv.set(m.pdv, base);
      var ks = U.chaveSerie(m.serie);
      if (ks) porSerie.set(ks, base);

      var semId = m.idUnidade === '' || typeof m.idUnidade !== 'number';
      if (semId) inc.push(item('sem_unidade', base, 'ID_Unidade = "' + (m.idUnidade === '' ? 'vazio' : m.idUnidade) + '"'));
      else if (!ig) inc.push(item('unidade_inexistente', base, 'ID ' + m.idUnidade + ' não existe em Unidades'));
      else {
        linhas.push(base);
        if (base.inativa) inc.push(item('unidade_inativa', base, 'Status da unidade: ' + (base.statusUnidade || 'Inativo')));
      }
      if (!ks) inc.push(item('serie_vazia', base, 'Série não informada'));
      else if (contSerie[ks] > 1) inc.push(item('serie_duplicada', base, ks + ' aparece ' + contSerie[ks] + ' vezes'));
      if (!m.modelo) inc.push(item('modelo_vazio', base, 'Modelo não informado'));
    });
    return { linhas: linhas, inconsistencias: inc, porPdv: porPdv, porSerie: porSerie };
  }

  function item(tipo, base, detalhe) {
    return { tipo: tipo, rotulo: TIPOS[tipo].rotulo, pdv: base.pdv, serie: base.serie, modelo: base.modeloExib,
      idUnidade: base.idUnidade, nome: base.nome, municipio: base.municipio, estado: base.estado, detalhe: detalhe };
  }

  return { TIPOS: TIPOS, processar: processar, salvar: salvar, carregar: carregar, cruzar: cruzar, item: item };
})();
