/* ==========================================================================
   db.js – acesso ao IndexedDB do navegador.
   Stores:
     bases        -> { chave: 'maquinas' | 'unidades', linhas: [...], info: {...} }
     emails       -> { idUnidade, email, atualizadoEm }
     solicitacoes -> { uid, ...campos }
     meta         -> { chave, valor }  (handles de arquivos, bytes da planilha etc.)
   ========================================================================== */
App.Model.DB = (function () {
  'use strict';

  var NOME = 'GestaoMaquinasDB';
  var VERSAO = 1;
  var conexao = null;

  /** Abre (ou cria) o banco. */
  function abrir() {
    if (conexao) return Promise.resolve(conexao);
    return new Promise(function (resolve, reject) {
      if (!window.indexedDB) { reject(new Error('Este navegador não suporta IndexedDB.')); return; }
      var req = indexedDB.open(NOME, VERSAO);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('bases')) db.createObjectStore('bases', { keyPath: 'chave' });
        if (!db.objectStoreNames.contains('emails')) db.createObjectStore('emails', { keyPath: 'idUnidade' });
        if (!db.objectStoreNames.contains('solicitacoes')) db.createObjectStore('solicitacoes', { keyPath: 'uid' });
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'chave' });
      };
      req.onsuccess = function () { conexao = req.result; resolve(conexao); };
      req.onerror = function () { reject(req.error || new Error('Falha ao abrir o IndexedDB.')); };
    });
  }

  /** Executa uma operação dentro de uma transação e devolve uma Promise. */
  function transacao(store, modo, acao) {
    return abrir().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, modo);
        var os = tx.objectStore(store);
        var resultado;
        var req = acao(os);
        if (req) req.onsuccess = function () { resultado = req.result; };
        tx.oncomplete = function () { resolve(resultado); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Transação abortada (espaço insuficiente?).')); };
      });
    });
  }

  function get(store, chave) { return transacao(store, 'readonly', function (os) { return os.get(chave); }); }
  function getAll(store) { return transacao(store, 'readonly', function (os) { return os.getAll(); }); }
  function put(store, valor) { return transacao(store, 'readwrite', function (os) { return os.put(valor); }); }
  function del(store, chave) { return transacao(store, 'readwrite', function (os) { return os.delete(chave); }); }
  function limpar(store) { return transacao(store, 'readwrite', function (os) { return os.clear(); }); }

  /** Grava vários registros em uma única transação. */
  function putMany(store, lista) {
    return transacao(store, 'readwrite', function (os) { lista.forEach(function (v) { os.put(v); }); return null; });
  }

  /** Atalhos para a store "meta". */
  function getMeta(chave) { return get('meta', chave).then(function (r) { return r ? r.valor : undefined; }); }
  function setMeta(chave, valor) { return put('meta', { chave: chave, valor: valor }); }

  return { abrir: abrir, get: get, getAll: getAll, put: put, putMany: putMany, del: del, limpar: limpar, getMeta: getMeta, setMeta: setMeta };
})();
