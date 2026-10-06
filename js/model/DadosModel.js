/* ==========================================================================
   DadosModel.js – orquestra o carregamento das bases do IndexedDB,
   a importação das planilhas e os arquivos vinculados (File System Access).
   ========================================================================== */
App.Model.Dados = (function () {
  'use strict';
  var U = App.Util, DB = App.Model.DB, X = App.Model.Excel;
  var M = App.Model.Maquina, I = App.Model.Unidade, S = App.Model.Solicitacao;

  var NOMES = { maquinas: 'Maquinas.xlsx', unidades: 'Unidades.xlsx', solicitacoes: 'Solicitação de Troca de Maquinas.xlsx' };

  /** Carrega tudo o que as telas precisam, já cruzado. */
  function carregarTudo() {
    return Promise.all([M.carregar(), I.carregar(), I.carregarEmails(), S.listar()]).then(function (r) {
      var maq = r[0], ig = r[1], emails = r[2], sols = r[3];
      var cruz = M.cruzar(maq.lista, ig.mapa, emails);
      // solicitações com série divergente entram na lista de inconsistências
      sols.forEach(function (s) {
        var d = S.divergencia(s, cruz.porPdv, cruz.porSerie);
        s._divergencia = d;
        if (d && d.tipo === 'pdv') {
          cruz.inconsistencias.push({ tipo: 'solicitacao_serie', rotulo: M.TIPOS.solicitacao_serie.rotulo, pdv: s.numero,
            serie: s.serie, modelo: s.modelo, idUnidade: '', nome: '', municipio: s.cidade, estado: s.estado,
            detalhe: 'Na base o PDV ' + d.pdv + ' é ' + d.serieBase, uidSolicitacao: s.uid });
        }
      });
      var ordem = Object.keys(M.TIPOS);
      cruz.inconsistencias.sort(function (a, b) { return ordem.indexOf(a.tipo) - ordem.indexOf(b.tipo) || U.comparar(a.pdv, b.pdv); });
      return {
        maquinas: maq.lista, maqInfo: maq.info, unidades: ig.mapa, igInfo: ig.info, emails: emails,
        linhas: cruz.linhas, inconsistencias: cruz.inconsistencias, porPdv: cruz.porPdv, porSerie: cruz.porSerie,
        solicitacoes: sols, temBases: !!(maq.info && ig.info)
      };
    });
  }

  /**
   * Importa um arquivo .xlsx. Descobre o tipo pelo conteúdo (ou usa o esperado),
   * processa e SUBSTITUI a base correspondente.
   * @param arquivo File (ou Blob com .name)
   */
  function importar(arquivo, tipoEsperado) {
    return X.lerArquivo(arquivo).then(function (buf) {
      var wb = X.lerWorkbook(buf);
      var tipo = X.detectarTipo(wb);
      if (!tipo) throw new Error('"' + arquivo.name + '" não parece ser nenhuma das planilhas esperadas (cabeçalhos não reconhecidos).');
      if (tipoEsperado && tipo !== tipoEsperado)
        throw new Error('"' + arquivo.name + '" parece ser a planilha de ' + rotulo(tipo) + ', não de ' + rotulo(tipoEsperado) + '.');
      var ext = X.extrair(wb, tipo);
      var info = { arquivo: arquivo.name, data: new Date().toISOString(), aba: ext.aba, faltando: ext.faltando };

      if (tipo === 'maquinas') {
        var pm = M.processar(ext.linhas);
        info.total = pm.lista.length; info.descartados = pm.duplicados;
        return M.salvar(pm.lista, info).then(function () { return { tipo: tipo, info: info }; });
      }
      if (tipo === 'unidades') {
        var pi = I.processar(ext.linhas);
        info.total = pi.lista.length; info.descartados = pi.duplicados;
        return I.salvar(pi.lista, info).then(function () { return { tipo: tipo, info: info }; });
      }
      // solicitações: guarda o arquivo original (para regravar com a mesma estrutura) e mescla
      return S.importarLinhas(ext.linhas).then(function (st) {
        info.total = ext.linhas.length; info.resultado = st;
        return DB.setMeta('planilhaSolicitacoes', { nome: arquivo.name, bytes: buf, data: info.data })
          .then(function () { return DB.setMeta('info_solicitacoes', info); })
          .then(function () { return { tipo: tipo, info: info }; });
      });
    });
  }

  function rotulo(t) { return { maquinas: 'Máquinas', unidades: 'Unidades', solicitacoes: 'Solicitações' }[t] || t; }

  /* ---------------- Arquivos vinculados ---------------- */
  function getHandle(tipo) { return DB.getMeta('handle_' + tipo); }
  function setHandle(tipo, h) { return DB.setMeta('handle_' + tipo, h); }
  function removerHandle(tipo) { return DB.del('meta', 'handle_' + tipo); }

  /** Vincula um arquivo (abre o seletor nativo) e já importa. */
  function vincular(tipo) {
    var handle;
    return X.escolherHandle().then(function (h) {
      handle = h;
      return h.getFile();
    }).then(function (f) {
      return importar(f, tipo);
    }).then(function (res) {
      return setHandle(tipo, handle).then(function () { return res; });
    });
  }

  /**
   * Recarrega as bases vinculadas (Máquinas e Unidades). Precisa de clique do usuário.
   * Se o navegador negar a permissão de algum arquivo, ele volta em "pendentes"
   * para que a tela peça um novo clique.
   */
  function atualizarVinculados() {
    var tipos = ['maquinas', 'unidades'];
    return Promise.all(tipos.map(getHandle)).then(function (hs) {
      var pend = [];
      tipos.forEach(function (t, i) { if (hs[i]) pend.push({ tipo: t, handle: hs[i] }); });
      if (!pend.length) return { semVinculo: true, resultados: [], pendentes: [] };
      var res = [], pendentes = [], erros = [], liberados = [];
      // 1º) pede as permissões em sequência, enquanto o clique do usuário ainda vale
      return pend.reduce(function (acc, p) {
        return acc.then(function () {
          return X.garantirPermissao(p.handle, false).then(function (ok) {
            if (ok) liberados.push(p); else pendentes.push(p.tipo);
          }).catch(function () { pendentes.push(p.tipo); });
        });
      }, Promise.resolve()).then(function () {
        // 2º) lê e importa os arquivos liberados
        return liberados.reduce(function (acc, p) {
          return acc.then(function () {
            return p.handle.getFile().then(function (f) { return importar(f, p.tipo); }).then(function (r) { res.push(r); })
              .catch(function (e) {
                if (e && e.name === 'NotFoundError') erros.push('Arquivo de ' + rotulo(p.tipo) + ' não encontrado (foi movido ou renomeado?). Vincule novamente.');
                else erros.push(e.message || String(e));
              });
          });
        }, Promise.resolve());
      }).then(function () {
        return { semVinculo: false, resultados: res, pendentes: pendentes, erros: erros };
      });
    });
  }

  /** Estado dos vínculos para a tela de importação. */
  function estadoVinculos() {
    return Promise.all(['maquinas', 'unidades', 'solicitacoes'].map(getHandle)).then(function (hs) {
      return { maquinas: hs[0] || null, unidades: hs[1] || null, solicitacoes: hs[2] || null };
    });
  }

  function info() {
    return Promise.all([M.carregar(), DB.get('bases', 'unidades'), DB.getMeta('info_solicitacoes'), DB.getMeta('planilhaSolicitacoes')])
      .then(function (r) {
        return { maquinas: r[0].info, unidades: r[1] ? r[1].info : null, solicitacoes: r[2] || null,
          planilha: r[3] ? { nome: r[3].nome, data: r[3].data } : null };
      });
  }

  /* ---------------- Gravação da planilha de solicitações ---------------- */
  /**
   * Gera o .xlsx atualizado. Usa o arquivo vinculado (lido na hora) ou a
   * última cópia importada. Com vínculo grava direto; sem vínculo baixa.
   */
  function gravarSolicitacoes() {
    var handle, nome, bufOriginal, vinculoPerdido = false;
    function daCopiaLocal() {
      return DB.getMeta('planilhaSolicitacoes').then(function (m) { nome = m ? m.nome : NOMES.solicitacoes; return m ? m.bytes : null; });
    }
    return getHandle('solicitacoes').then(function (h) {
      handle = h;
      // pede leitura+escrita logo no início, enquanto o clique do usuário ainda vale
      if (handle) return X.garantirPermissao(handle, true).then(function (ok) {
        if (!ok) throw new Error('Permissão de escrita negada para "' + handle.name + '".');
        return handle.getFile();
      }).then(function (f) { nome = f.name; return X.lerArquivo(f); }).catch(function (e) {
        if (!e || e.name !== 'NotFoundError') throw e;
        // arquivo vinculado foi movido/renomeado/apagado: descarta o vínculo e usa a última cópia importada
        vinculoPerdido = true;
        var antigo = handle.name;
        handle = null;
        return removerHandle('solicitacoes').then(daCopiaLocal).then(function (b) { nome = nome || antigo; return b; });
      });
      return daCopiaLocal();
    }).then(function (buf) {
      bufOriginal = buf;
      var linhasPlanilha = [];
      if (buf) {
        var wb = X.lerWorkbook(buf);
        linhasPlanilha = X.extrair(wb, 'solicitacoes').linhas;
        // traz primeiro o que mudou direto no Excel, depois grava
        return S.importarLinhas(linhasPlanilha).then(function () { return linhasPlanilha; });
      }
      return linhasPlanilha;
    }).then(function (linhasPlanilha) {
      return S.listar().then(function (regs) {
        var m = S.montarPlanilha(linhasPlanilha, regs);
        var bytes = X.gerarPlanilhaSolicitacoes(bufOriginal, m.linhas);
        var destino = handle ? X.gravarHandle(handle, bytes) : Promise.resolve(X.baixar(bytes, nome));
        return destino.then(function () {
          return S.marcarSincronizados(m.gravados);
        }).then(function () {
          return DB.setMeta('planilhaSolicitacoes', { nome: nome, bytes: bytes.buffer || bytes, data: new Date().toISOString() });
        }).then(function () {
          return { total: m.linhas.length, gravados: m.gravados.length, direto: !!handle, nome: nome, vinculoPerdido: vinculoPerdido };
        });
      });
    });
  }

  /* ---------------- Backup ---------------- */
  function gerarBackup() {
    return Promise.all([DB.getAll('emails'), DB.getAll('solicitacoes')]).then(function (r) {
      return { sistema: 'GestaoMaquinas', versao: 1, geradoEm: new Date().toISOString(), emails: r[0], solicitacoes: r[1] };
    });
  }

  /** Restaura backup. modo 'mesclar' (padrão) ou 'substituir'. */
  function restaurarBackup(obj, modo) {
    if (!obj || obj.sistema !== 'GestaoMaquinas' || !Array.isArray(obj.emails) || !Array.isArray(obj.solicitacoes))
      return Promise.reject(new Error('Arquivo de backup inválido.'));
    var limpar = modo === 'substituir' ? Promise.all([DB.limpar('emails'), DB.limpar('solicitacoes')]) : Promise.resolve();
    return limpar.then(function () {
      return DB.putMany('emails', obj.emails.filter(function (e) { return e && e.idUnidade !== undefined; }));
    }).then(function () {
      return DB.getAll('solicitacoes');
    }).then(function (atuais) {
      // evita duplicar: se a mesma linha da planilha já existe com outro ID interno
      // (ex.: planilha reimportada após limpar o cache), fica a versão do backup
      var porChave = {};
      atuais.forEach(function (r) { if (r.chavePlanilha) porChave[r.chavePlanilha] = r; });
      var novos = obj.solicitacoes.filter(function (s) { return s && s.uid; });
      var remover = [];
      novos.forEach(function (s) {
        var ex = s.chavePlanilha && porChave[s.chavePlanilha];
        if (ex && ex.uid !== s.uid) remover.push(ex.uid);
      });
      return Promise.all(remover.map(function (u) { return DB.del('solicitacoes', u); }))
        .then(function () { return DB.putMany('solicitacoes', novos); });
    }).then(function () { return { emails: obj.emails.length, solicitacoes: obj.solicitacoes.length }; });
  }

  return {
    NOMES: NOMES, carregarTudo: carregarTudo, importar: importar, vincular: vincular, getHandle: getHandle,
    setHandle: setHandle, removerHandle: removerHandle, atualizarVinculados: atualizarVinculados,
    estadoVinculos: estadoVinculos, info: info, gravarSolicitacoes: gravarSolicitacoes,
    gerarBackup: gerarBackup, restaurarBackup: restaurarBackup, rotulo: rotulo
  };
})();
