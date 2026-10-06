/* ==========================================================================
   Util.js – funções utilitárias de normalização e formatação.
   Cria o namespace global App (não usamos import/export por causa do file://).
   ========================================================================== */
window.App = window.App || { Model: {}, View: {}, Controller: {} };

App.Util = (function () {
  'use strict';

  /** Converte qualquer valor em texto sem espaços nas pontas (null -> ''). */
  function texto(v) {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return numeroParaTexto(v);
    return String(v).replace(/ /g, ' ').trim();
  }

  /** Converte número em texto sem notação científica e sem separador de milhar. */
  function numeroParaTexto(n) {
    if (!isFinite(n)) return '';
    if (Number.isInteger(n)) return n.toLocaleString('fullwide', { useGrouping: false });
    return String(n);
  }

  /** Remove acentos e deixa em minúsculas – usado em buscas. */
  function semAcento(v) {
    return texto(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Chave de cabeçalho: sem acento, sem espaço, sem pontuação ("Desc.Região" -> "descregiao"). */
  function chaveCabecalho(v) {
    return texto(v).normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /** Tenta converter um ID para número inteiro; se não der, devolve o texto. */
  function id(v) {
    var t = texto(v);
    if (t === '') return '';
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (/^\d+\.0+$/.test(t)) return parseInt(t, 10);
    return t;
  }

  /** Valores "vazios" usados na base (ex.: "-", "0    -", "N/D"). */
  function ehVazio(v) {
    var t = texto(v);
    return t === '' || /^[-\s0]*-[-\s]*$/.test(t) || t === '-';
  }

  /** Formata CEP como 00000-000; se não tiver 8 dígitos, devolve o texto limpo. */
  function formatarCep(v) {
    if (ehVazio(v)) return '';
    var d = texto(v).replace(/\D/g, '');
    if (typeof v === 'number' && d.length < 8 && d.length >= 7) d = d.padStart(8, '0');
    if (d.length === 8) return d.slice(0, 5) + '-' + d.slice(5);
    return texto(v);
  }

  function cepValido(v) { return /^\d{5}-\d{3}$/.test(texto(v)); }

  /** Formata telefone brasileiro: (11) 91234-5678 / (11) 3000-0000. */
  function formatarTelefone(v) {
    if (ehVazio(v)) return '';
    var t = texto(v);
    var d = t.replace(/\D/g, '');
    if (d.length === 13 && d.indexOf('55') === 0) d = d.slice(2);
    if (d.length === 11) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
    if (d.length === 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    if (d.length < 8) return ''; // lixo como "X'", "M", números negativos
    return t;
  }

  /** Padroniza o modelo apenas para exibição (valor original é preservado). */
  function modeloExibicao(v) {
    var t = texto(v).toUpperCase().replace(/NEWLAND/g, '').replace(/\s+/g, '');
    if (!t) return '';
    var m = t.match(/^([A-Z]+\d+)(PRO)?$/);
    if (m) return m[1] + (m[2] ? ' Pro' : '');
    return texto(v);
  }

  /** Normaliza nº de série para comparação. */
  function chaveSerie(v) { return texto(v).toUpperCase().replace(/\s+/g, ''); }

  /** Data/hora atual formatada. */
  function dataHora(d) {
    d = d ? new Date(d) : new Date();
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  function hoje() { return new Date().toLocaleDateString('pt-BR'); }

  /** Número com separador de milhar pt-BR. */
  function milhar(n) { return Number(n || 0).toLocaleString('pt-BR'); }

  /** Escapa HTML para evitar injeção ao montar innerHTML. */
  function esc(v) {
    return texto(v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function emailValido(v) {
    var t = texto(v);
    if (!t) return true;
    return t.split(/[;,]/).every(function (p) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.trim()); });
  }

  /** Gera um ID interno único. */
  function uid() { return 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function debounce(fn, ms) {
    var t;
    return function () { var a = arguments, s = this; clearTimeout(t); t = setTimeout(function () { fn.apply(s, a); }, ms); };
  }

  /** Compara dois valores para ordenação (números e texto pt-BR). */
  function comparar(a, b) {
    var na = typeof a === 'number', nb = typeof b === 'number';
    if (na && nb) return a - b;
    if (a === '' || a === null || a === undefined) return 1;
    if (b === '' || b === null || b === undefined) return -1;
    return String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
  }

  /** Lista de valores únicos ordenada. */
  function unicos(lista) {
    var s = {};
    lista.forEach(function (v) { if (v !== '' && v !== null && v !== undefined) s[v] = 1; });
    return Object.keys(s).sort(comparar);
  }

  return {
    texto: texto, semAcento: semAcento, chaveCabecalho: chaveCabecalho, id: id, ehVazio: ehVazio,
    formatarCep: formatarCep, cepValido: cepValido, formatarTelefone: formatarTelefone,
    modeloExibicao: modeloExibicao, chaveSerie: chaveSerie, dataHora: dataHora, hoje: hoje,
    milhar: milhar, esc: esc, emailValido: emailValido, uid: uid, debounce: debounce,
    comparar: comparar, unicos: unicos, numeroParaTexto: numeroParaTexto
  };
})();
