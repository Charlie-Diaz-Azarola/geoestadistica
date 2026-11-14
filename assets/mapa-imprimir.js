(function () {
  var D = window.ARC;
  var mapa = L.map('mapa', { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false,
                             boxZoom: false, keyboard: false, touchZoom: false, zoomSnap: 0.05, attributionControl: false,
                             fadeAnimation: false, zoomAnimation: false });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, crossOrigin: true }).addTo(mapa);
  var limites = L.latLngBounds([]);
  D.parroquias.forEach(function (p) {
    var capa = L.polygon(p.poligonos, { color: p.color, weight: 3, fillColor: p.color, fillOpacity: 0.16, interactive: false }).addTo(mapa);
    limites.extend(capa.getBounds());
  });
  D.parroquias.forEach(function (p) {
    L.circleMarker([p.lat, p.lng], { radius: 5, color: '#fff', weight: 2, fillColor: '#111', fillOpacity: 1, interactive: false }).addTo(mapa);
    L.marker(p.et, { interactive: false, keyboard: false,
                     icon: L.divIcon({ className: 'imp-rotulo', html: '<span>' + p.num + '</span>', iconSize: [34, 24], iconAnchor: [17, 12] }) })
      .addTo(mapa);
  });
  L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 220 }).addTo(mapa);
  mapa.fitBounds(limites, { padding: [14, 14] });
})();
