(function () {
  var T = window.TEMATICO;
  var COLORES = ['#e3eefb', '#b3d1f2', '#78aee6', '#2a78d6', '#154a8f'];
  var mapa = L.map('mapa', { scrollWheelZoom: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(mapa);

  function num(x, dec) {
    var s = x.toFixed(dec).split('.');
    s[0] = s[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return s.join(',');
  }
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  var selector = document.getElementById('tm-dato'), leyenda = document.getElementById('tm-leyenda'),
      explica = document.getElementById('tm-explica');
  var ind, cortes;

  function valor(p) {
    var v = p.v[ind.k];
    if (v === null) { return 'sin dato'; }
    return num(ind.k === 'renta_pp' ? Math.round(v / 100) * 100 : v, ind.dec) + ind.u;
  }
  function grupo(v) {
    var g = 0;
    while (g < cortes.length && v > cortes[g]) { g++; }
    return g;
  }
  function rotulo(p) {
    return '<strong>' + esc(p.n) + '</strong><br>' + esc(p.pob) + ' · ' + esc(p.arc) + '<br>' + esc(ind.n) + ': <strong>' + valor(p) + '</strong>'
      + (ind.mun ? '<br><small>Dato del municipio de ' + esc(p.mun) + '</small>' : '');
  }

  var limites = L.latLngBounds([]);
  var capas = T.parroquias.map(function (p) {
    var capa = L.polygon(p.poligonos, { color: '#4a5563', weight: 0.8, fillOpacity: 0.8 }).addTo(mapa);
    capa.bindTooltip(function () { return rotulo(p); }, { sticky: true, className: 'tm-rotulo' });
    capa.bindPopup(function () {
      return rotulo(p) + '<br><a href="' + encodeURI(p.url) + '">Ver la ficha de la parroquia</a>';
    });
    capa.on('mouseover', function () { capa.setStyle({ weight: 2.5, color: '#111' }); capa.bringToFront(); });
    capa.on('mouseout', function () { capa.setStyle({ weight: 0.8, color: '#4a5563' }); });
    limites.extend(capa.getBounds());
    return capa;
  });

  function pintar() {
    ind = T.indicadores.filter(function (i) { return i.k === selector.value; })[0];
    var vs = T.parroquias.map(function (p) { return p.v[ind.k]; }).filter(function (v) { return v !== null; })
      .sort(function (a, b) { return a - b; });
    // Límite superior de cada uno de los cuatro primeros grupos (quintiles)
    cortes = [1, 2, 3, 4].map(function (i) { return vs[Math.ceil(i * vs.length / 5) - 1]; });
    T.parroquias.forEach(function (p, i) {
      var v = p.v[ind.k];
      capas[i].setStyle({ fillColor: v === null ? '#cccccc' : COLORES[grupo(v)] });
    });
    var bordes = [vs[0]].concat(cortes, [vs[vs.length - 1]]);
    leyenda.innerHTML = COLORES.map(function (c, g) {
      var n = vs.filter(function (v) { return grupo(v) === g; }).length;
      return '<li><i style="background:' + c + '"></i>' + (g === 0 ? 'de ' : 'más de ') + num(bordes[g], ind.dec) + ' a '
        + num(bordes[g + 1], ind.dec) + ind.u + ' <small>(' + n + ')</small></li>';
    }).join('');
    explica.innerHTML = esc(ind.t) + '. En el conjunto de la diócesis: <strong>'
      + num(ind.k === 'renta_pp' ? Math.round(T.diocesis[ind.k] / 100) * 100 : T.diocesis[ind.k], ind.dec) + ind.u + '</strong>.';
  }

  // La dirección puede indicar el dato inicial: mapa/index.html#crec
  var pedido = location.hash.slice(1);
  if (T.indicadores.some(function (i) { return i.k === pedido; })) { selector.value = pedido; }
  selector.addEventListener('change', pintar);
  pintar();
  mapa.fitBounds(limites.pad(0.02));
})();
