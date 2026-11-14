(function () {
  var tabla = document.getElementById('t-parroquias');
  if (!tabla) { return; }
  var cuerpo = tabla.tBodies[0];
  var filas = Array.prototype.slice.call(cuerpo.rows);
  var cabeceras = Array.prototype.slice.call(tabla.tHead.rows[0].cells);
  var arc = document.getElementById('t-arc'), texto = document.getElementById('t-texto'), cuenta = document.getElementById('t-cuenta');

  function plano(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  function ordenar(col, th) {
    var esTexto = th.querySelector('button').dataset.tipo === 'texto';
    var actual = th.getAttribute('aria-sort');
    // Los números, primero de mayor a menor; los nombres, por orden alfabético
    var sentido = actual ? (actual === 'ascending' ? 'descending' : 'ascending') : (esTexto ? 'ascending' : 'descending');
    cabeceras.forEach(function (c) { c.removeAttribute('aria-sort'); });
    th.setAttribute('aria-sort', sentido);
    var k = sentido === 'ascending' ? 1 : -1;
    filas.sort(function (a, b) {
      var x = a.cells[col].dataset.v, y = b.cells[col].dataset.v;
      if (esTexto) { return k * x.localeCompare(y, 'es'); }
      if (x === '') { return 1; }      // sin dato: siempre al final
      if (y === '') { return -1; }
      return k * (parseFloat(x) - parseFloat(y));
    });
    filas.forEach(function (f) { cuerpo.appendChild(f); });
  }

  function filtrar() {
    var a = arc.value, t = plano(texto.value.trim()), n = 0;
    filas.forEach(function (f) {
      var ver = (!a || f.dataset.arc === a) && (!t || plano(f.cells[0].textContent).indexOf(t) >= 0);
      f.hidden = !ver;
      if (ver) { n++; }
    });
    var u = tabla.dataset.unidad || 'parroquias';
    cuenta.textContent = n === filas.length ? filas.length + ' ' + u : n + ' de ' + filas.length + ' ' + u;
  }

  cabeceras.forEach(function (th, col) {
    th.querySelector('button').addEventListener('click', function () { ordenar(col, th); });
  });
  arc.addEventListener('change', filtrar);
  texto.addEventListener('input', filtrar);
  filtrar();
})();
