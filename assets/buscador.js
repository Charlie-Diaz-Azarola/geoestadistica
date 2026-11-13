(function () {
  // Buscador de direcciones de la página «Arciprestazgos y parroquias».
  // 1. Sugerencias de calles y coordenadas de la dirección: CartoCiudad (IGN), https://www.cartociudad.es/
  // 2. Parroquia: se mira en qué territorio cae el punto. Con el rectángulo de cada parroquia (DATOS.parroquias[].bb)
  //    se eligen las candidatas y solo de ellas se descarga el territorio.js de su ficha (polígono sin simplificar).
  var D = window.DATOS, M = window.MAPA;
  var form = document.getElementById('buscador');
  if (!form || !D || !M || !window.fetch) { return; }
  var mapa = M.mapa;
  var API = 'https://www.cartociudad.es/geocoder/api/geocoder/';
  var NO = 'toponimo,poblacion,municipio,expendeduria,punto_recarga_electrica,ngbe,provincia,comunidad autonoma,Codpost';
  var POR_CP = { 'El Álamo': '28607' };   // municipios que CartoCiudad no filtra por nombre: se filtran por código postal
  var CERCA = 25;    // metros: por debajo se avisa de que la dirección está junto a un límite
  var HUECO = 20;    // metros: un punto que no cae en ningún territorio se asigna al más próximo si está más cerca
  var DEM = '../informacion-demografica/';

  function $(id) { return document.getElementById(id); }
  var calle = $('b-calle'), numero = $('b-numero'), pob = $('b-poblacion'), lista = $('b-sugerencias'),
      res = $('b-resultado'), boton = form.querySelector('button[type=submit]'), borrar = $('b-borrar');

  var munis = [], enDiocesis = {};
  D.parroquias.forEach(function (p) {
    if (!enDiocesis[p.mun]) { enDiocesis[p.mun] = true; munis.push(p.mun); }
  });
  var munisNombre = munis.filter(function (m) { return !POR_CP[m]; }).join(',');

  // ------------------------------------------------------------ CartoCiudad
  function pedir(servicio, par) {
    var q = Object.keys(par).map(function (k) { return k + '=' + encodeURIComponent(par[k]); }).join('&');
    return fetch(API + servicio + '?' + q).then(function (r) {
      if (!r.ok) { throw new Error('HTTP ' + r.status); }
      return r.text();
    }).then(function (t) {
      if (!t.trim()) { return []; }
      var d = JSON.parse(t);
      return Array.isArray(d) ? d : [d];
    });
  }
  function valido(x) { return x && x.provinceCode === '28' && enDiocesis[x.muni]; }

  // Candidatos (calles o portales) en un municipio o, si mun está vacío, en toda la diócesis
  function candidatos(q, mun, limite) {
    function una(filtro) {
      var par = { q: q, limit: limite, no_process: NO };
      Object.keys(filtro).forEach(function (k) { par[k] = filtro[k]; });
      return pedir('candidates', par);
    }
    var tandas;
    if (mun) {
      tandas = [una(POR_CP[mun] ? { cod_postal_filter: POR_CP[mun] } : { municipio_filter: mun })];
    } else {
      tandas = [una({ municipio_filter: munisNombre })].concat(
        Object.keys(POR_CP).map(function (m) { return una({ cod_postal_filter: POR_CP[m] }); }));
    }
    return Promise.all(tandas).then(function (rs) {
      return [].concat.apply([], rs).filter(valido);
    });
  }

  // ------------------------------------------------------------ textos
  var PARTICULAS = /^(de|del|la|las|los|el|y|e|a|al|en)$/;
  function bonito(s) {
    return String(s).toLowerCase().split(' ').map(function (w, i) {
      if (i > 0 && PARTICULAS.test(w)) { return w; }
      return w.replace(/^([(«"]?)(.)/, function (_, a, b) { return a + b.toUpperCase(); });
    }).join(' ');
  }
  // «CALLE TORIBIO ORGAZ (DE)» -> «CALLE DE TORIBIO ORGAZ»
  function ordenar(via) {
    var m = via.match(/^(\S+) (.+) \((DE|DEL|DE LA|DE LAS|DE LOS|LA|LAS|LOS|EL)\)$/);
    return m ? m[1] + ' ' + m[3] + ' ' + m[2] : via;
  }
  function lugarDe(x) {
    return x.poblacion && x.poblacion !== x.muni ? x.poblacion + ' (' + x.muni + ')' : x.muni;
  }
  // Separa un candidato en vía, número y lugar. Formas de «address»: «VÍA [N], Lugar», «VÍA [N], Entidad (Municipio)»
  // y «VÍA [N] (Municipio)».
  function partes(c) {
    var a = c.address, via = a, i = a.lastIndexOf(', '), m, num = '';
    if (i >= 0) {
      via = a.slice(0, i);
    } else if ((m = a.match(/^(.*) \(([^()]*)\)$/)) && m[2] === c.muni) {
      via = m[1];
    }
    if (c.type === 'portal' && c.portalNumber != null) {
      i = via.lastIndexOf(' ' + c.portalNumber);
      if (i > 0) { num = via.slice(i + 1); via = via.slice(0, i); }
    }
    return { via: via, num: num, lugar: lugarDe(c),
             consulta: via.replace(/ \([^()]*\)$/, ''),       // sin «(DE)»: para preguntar a CartoCiudad
             texto: bonito(ordenar(via)) };
  }
  function cpDe(x) { return /^\d{5}$/.test(x.postalCode || '') ? x.postalCode + ' ' : ''; }
  function etiquetaCandidato(c) {
    var p = partes(c);
    return p.texto + (p.num ? ' ' + p.num : '') + ', ' + cpDe(c) + p.lugar;
  }
  // Resultado de «find»: «address» trae solo el nombre y «tip_via» el tipo
  function etiquetaFind(x) {
    var via = bonito(ordenar(((x.tip_via || '') + ' ' + x.address).trim()));
    var num = x.portalNumber != null ? ' ' + x.portalNumber + (x.extension ? ' ' + x.extension : '') : '';
    return via + num + ', ' + cpDe(x) + lugarDe(x);
  }

  // ------------------------------------------------------------ sugerencias
  var elegida = null, items = [], activo = -1, turno = 0, espera = null;
  function munElegido() {
    var o = pob.options[pob.selectedIndex];
    return o && o.value ? o.getAttribute('data-mun') : '';
  }
  function cerrar() {
    lista.hidden = true; lista.innerHTML = ''; items = []; activo = -1;
    calle.setAttribute('aria-expanded', 'false'); calle.removeAttribute('aria-activedescendant');
  }
  function marcar(i) {
    activo = i;
    [].forEach.call(lista.children, function (li, k) { li.setAttribute('aria-selected', k === i ? 'true' : 'false'); });
    if (i >= 0) {
      calle.setAttribute('aria-activedescendant', 'b-sug-' + i);
      lista.children[i].scrollIntoView({ block: 'nearest' });
    } else {
      calle.removeAttribute('aria-activedescendant');
    }
  }
  function elegir(c) {
    var p = partes(c);
    elegida = { c: c, p: p };
    calle.value = p.texto;
    if (p.num) { numero.value = p.num; }
    var destino = [c.poblacion, c.muni];
    for (var k = 0; k < destino.length; k++) {
      var o = destino[k] && pob.querySelector('option[value="' + String(destino[k]).replace(/"/g, '\\"') + '"]');
      if (o) { pob.value = o.value; break; }
    }
    cerrar();
    if (!numero.value) { numero.focus(); }
  }
  function pintar(cs) {
    var vistos = {};
    items = cs.filter(function (c) {
      var t = etiquetaCandidato(c);
      if (vistos[t]) { return false; }
      vistos[t] = true; return true;
    }).slice(0, 8);
    lista.innerHTML = '';
    items.forEach(function (c, i) {
      var p = partes(c), li = document.createElement('li'), s = document.createElement('small');
      li.id = 'b-sug-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
      li.textContent = p.texto + (p.num ? ' ' + p.num : '');
      s.textContent = p.lugar;
      li.appendChild(s);
      li.addEventListener('mousedown', function (ev) { ev.preventDefault(); elegir(c); });
      lista.appendChild(li);
    });
    activo = -1;
    lista.hidden = !items.length;
    calle.setAttribute('aria-expanded', items.length ? 'true' : 'false');
  }
  function sugerir() {
    var t = calle.value.trim(), mio = ++turno;
    if (t.length < 3) { cerrar(); return; }
    candidatos(t, munElegido(), 10).then(function (cs) {
      if (mio !== turno || document.activeElement !== calle) { return; }
      var elegidaPob = pob.value;
      cs.sort(function (a, b) {   // primero, las de la población elegida (Perales del Río es del municipio de Getafe)
        return (b.poblacion === elegidaPob) - (a.poblacion === elegidaPob);
      });
      pintar(cs);
    }).catch(function () { if (mio === turno) { cerrar(); } });
  }
  calle.addEventListener('input', function () {
    if (elegida && calle.value !== elegida.p.texto) { elegida = null; }
    clearTimeout(espera);
    espera = setTimeout(sugerir, 280);
  });
  calle.addEventListener('keydown', function (ev) {
    if (lista.hidden) { return; }
    if (ev.key === 'ArrowDown') { ev.preventDefault(); marcar((activo + 1) % items.length); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); marcar((activo + items.length - (activo < 0 ? 0 : 1)) % items.length); }
    else if (ev.key === 'Enter' && activo >= 0) { ev.preventDefault(); elegir(items[activo]); }
    else if (ev.key === 'Escape') { cerrar(); }
  });
  calle.addEventListener('blur', function () { turno++; clearTimeout(espera); setTimeout(cerrar, 120); });
  pob.addEventListener('change', function () {
    if (elegida && munElegido() && elegida.c.muni !== munElegido()) { elegida = null; }
  });

  // ------------------------------------------------------------ geometría
  function enAnillo(a, lat, lng) {
    var dentro = false;
    for (var i = 0, j = a.length - 1; i < a.length; j = i++) {
      var yi = a[i][0], xi = a[i][1], yj = a[j][0], xj = a[j][1];
      if ((yi > lat) !== (yj > lat) && lng < (xj - xi) * (lat - yi) / (yj - yi) + xi) { dentro = !dentro; }
    }
    return dentro;
  }
  function dentroDe(poligonos, lat, lng) {
    return poligonos.some(function (p) {
      return enAnillo(p[0], lat, lng) && !p.slice(1).some(function (h) { return enAnillo(h, lat, lng); });
    });
  }
  // Distancia en metros del punto al borde más próximo (proyección plana local: basta para decenas de metros)
  function distancia(poligonos, lat, lng) {
    var kx = 111320 * Math.cos(lat * Math.PI / 180), ky = 110574, min = Infinity;
    poligonos.forEach(function (p) {
      p.forEach(function (a) {
        for (var i = 0; i < a.length - 1; i++) {
          var x1 = (a[i][1] - lng) * kx, y1 = (a[i][0] - lat) * ky, x2 = (a[i + 1][1] - lng) * kx, y2 = (a[i + 1][0] - lat) * ky;
          var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
          var t = l2 ? Math.max(0, Math.min(1, -(x1 * dx + y1 * dy) / l2)) : 0;
          var d = Math.sqrt(Math.pow(x1 + t * dx, 2) + Math.pow(y1 + t * dy, 2));
          if (d < min) { min = d; }
        }
      });
    });
    return min;
  }
  function territorio(p) {
    if (!p.pol) {
      p.pol = fetch(p.url.replace(/index\.html$/, 'territorio.js')).then(function (r) {
        if (!r.ok) { throw new Error('HTTP ' + r.status); }
        return r.text();
      }).then(function (t) {
        return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)).parroquias[0].poligonos;
      });
      p.pol.catch(function () { p.pol = null; });
    }
    return p.pol;
  }
  // Devuelve {p, pol, vecina, dVecina, dHueco}; p es null si el punto está fuera de la diócesis
  function parroquiaDe(lat, lng) {
    var m = 0.0008;   // margen del rectángulo: unos 70-90 m
    var cs = D.parroquias.filter(function (p) {
      return lat >= p.bb[0] - m && lat <= p.bb[2] + m && lng >= p.bb[1] - m && lng <= p.bb[3] + m;
    });
    return Promise.all(cs.map(territorio)).then(function (pols) {
      var r = { p: null, pol: null, vecina: null, dVecina: Infinity, dHueco: 0 }, k, d;
      for (k = 0; k < cs.length; k++) {
        if (dentroDe(pols[k], lat, lng)) { r.p = cs[k]; r.pol = pols[k]; break; }
      }
      if (!r.p) {   // en ningún territorio: el más próximo, si está a pocos metros (resquicio entre polígonos)
        for (k = 0; k < cs.length; k++) {
          d = distancia(pols[k], lat, lng);
          if (d < HUECO && (!r.p || d < r.dHueco)) { r.p = cs[k]; r.pol = pols[k]; r.dHueco = d; }
        }
        if (!r.p) { return r; }
      }
      for (k = 0; k < cs.length; k++) {
        if (cs[k] !== r.p) {
          d = distancia(pols[k], lat, lng);
          if (d < r.dVecina) { r.dVecina = d; r.vecina = cs[k]; }
        }
      }
      return r;
    });
  }

  // ------------------------------------------------------------ resultado
  var capa = L.layerGroup().addTo(mapa);
  function el(etiqueta, attrs, hijos) {
    var n = document.createElement(etiqueta);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    (hijos || []).forEach(function (h) { n.appendChild(typeof h === 'string' ? document.createTextNode(h) : h); });
    return n;
  }
  function mensaje(texto, clase) {
    res.innerHTML = '';
    res.appendChild(el('p', clase ? { 'class': clase } : {}, [texto]));
  }
  function ocupado(si) { boton.disabled = si; boton.textContent = si ? 'Buscando…' : 'Buscar'; }
  function urlArc(nombre) {
    for (var i = 0; i < D.arciprestazgos.length; i++) {
      if (D.arciprestazgos[i].nombre === nombre) { return D.arciprestazgos[i].url; }
    }
    return '';
  }

  // punto = {lat, lng, etiqueta, pulsado}; avisos = [textos]; otras = [{etiqueta, ir}] (direcciones parecidas).
  // pulsado: el punto se ha señalado en el mapa (no es una dirección buscada); no se mueve la página.
  var vez = 0;
  function mostrar(punto, avisos, otras) {
    var mio = ++vez, sujeto = punto.pulsado ? 'El punto' : 'La dirección';
    return parroquiaDe(punto.lat, punto.lng).then(function (r) {
      if (mio !== vez) { return; }   // se ha pedido otro punto mientras tanto
      capa.clearLayers();
      res.innerHTML = '';
      var marca = L.marker([punto.lat, punto.lng], {
        icon: L.divIcon({ className: 'marca-direccion', html: '<span></span>', iconSize: [28, 28], iconAnchor: [14, 33], popupAnchor: [0, -32] }),
        keyboard: false, zIndexOffset: 1000
      });
      res.appendChild(el('p', {}, [el('strong', {}, [punto.pulsado ? 'Punto señalado en el mapa: ' : 'Dirección situada en el mapa: ']),
                                   punto.etiqueta]));
      if (!r.p) {
        res.appendChild(el('p', { 'class': 'aviso' }, [(punto.pulsado ? 'Este punto' : 'Esta dirección') +
          ' queda fuera del territorio de las parroquias de la Diócesis de Getafe.']));
        marca.bindPopup(el('span', {}, [punto.pulsado ? 'Fuera del territorio de la diócesis' : punto.etiqueta]));
        marca.addTo(capa).openPopup();
        if (!punto.pulsado) { mapa.setView([punto.lat, punto.lng], 15); }
      } else {
        var p = r.p, uArc = urlArc(p.arc);
        marca.bindPopup(punto.pulsado ?
          el('span', {}, [el('a', { href: p.url }, [p.n]), el('br'), 'Arciprestazgo de ' + p.arc]) :
          el('span', {}, [punto.etiqueta]));
        var uPob = p.url.replace(/[^/]+\/index\.html$/, 'index.html');
        res.appendChild(el('dl', {}, [
          el('dt', {}, ['Parroquia']),
          el('dd', { 'class': 'principal' }, [
            el('a', { href: p.url }, [p.n]),
            el('small', {}, [p.dir + ', ' + p.cp + ' ' + p.pob])]),
          el('dt', {}, ['Arciprestazgo']),
          el('dd', {}, [el('a', { href: uArc }, [p.arc])]),
          el('dt', {}, ['Información demográfica']),
          el('dd', {}, [
            el('a', { href: DEM + p.url }, ['De la parroquia']), ' · ',
            el('a', { href: DEM + uPob }, ['De la población (' + p.pob + ')']), ' · ',
            el('a', { href: DEM + uArc }, ['Del arciprestazgo (' + p.arc + ')'])])
        ]));
        if (r.dHueco) {
          avisos = avisos.concat([sujeto + ' cae justo en el límite del territorio (a unos ' + Math.max(1, Math.round(r.dHueco)) +
            ' m): la asignación es orientativa.']);
        }
        if (r.vecina && r.dVecina < CERCA) {
          res.appendChild(el('p', { 'class': 'nota' }, [sujeto + ' está junto al límite con la parroquia ',
            el('a', { href: r.vecina.url }, [r.vecina.n]), ' (' + r.vecina.pob + '), a unos ' + Math.max(1, Math.round(r.dVecina)) +
            ' m. Cuando el límite va por el centro de una calle, cada acera pertenece a una parroquia: puede comprobarlo en el ' +
            'mapa y en los límites según decreto de las dos fichas.']));
        }
        var poligono = L.polygon(r.pol, { color: p.color, weight: 3.5, fillColor: p.color, fillOpacity: 0.3, interactive: false }).addTo(capa);
        marca.addTo(capa);
        // Al pulsar en el mapa solo se acerca la vista si se está viendo de lejos
        if (!punto.pulsado || mapa.getZoom() < 13) { mapa.fitBounds(poligono.getBounds().pad(0.15), { maxZoom: 16 }); }
        marca.openPopup();
      }
      avisos.forEach(function (a) { res.appendChild(el('p', { 'class': 'aviso' }, [a])); });
      if (otras && otras.length) {
        var caja = el('p', { 'class': 'otras' }, ['Otras direcciones parecidas: ']);
        otras.slice(0, 5).forEach(function (o) {
          var b = el('button', { type: 'button' }, [o.etiqueta]);
          b.addEventListener('click', o.ir);
          caja.appendChild(b);
        });
        res.appendChild(caja);
      }
      if (!punto.pulsado && res.getBoundingClientRect().top < 0) { res.scrollIntoView({ block: 'start' }); }
    });
  }

  // ------------------------------------------------------------ búsqueda
  function puntoCandidato(c) { return { lat: c.lat, lng: c.lng, etiqueta: etiquetaCandidato(c) }; }
  function claveVia(c) { var p = partes(c); return p.via + '|' + c.muni; }
  function irA(c) {   // botón de «otras direcciones parecidas»
    return function () { elegir(c); buscar(); };
  }

  // Sitúa una calle (candidato de tipo «callejero»): con número, el portal que proponga CartoCiudad; sin él, su centro
  function situarCalle(c, n, otras) {
    var p = partes(c);
    var centro = function (avisos) {
      return pedir('find', { q: c.address, type: 'callejero', id: c.id }).then(function (rs) {
        var x = rs[0];
        if (!x || !x.lat) { mensaje('No se ha podido situar la calle en el mapa.', 'aviso'); return; }
        return mostrar({ lat: x.lat, lng: x.lng, etiqueta: p.texto + ', ' + p.lugar }, avisos, otras);
      });
    };
    var larga = 'Se muestra el punto medio de la calle; una calle larga puede pertenecer a varias parroquias.';
    if (!n) { return centro(['No ha indicado el número. ' + larga]); }
    return pedir('find', { q: p.consulta + ' ' + n + ', ' + c.muni }).then(function (rs) {
      var x = rs[0];
      var misma = x && x.type === 'portal' && x.lat && x.muni === c.muni &&
        p.consulta.indexOf(String(x.address).replace(/ \([^()]*\)$/, '')) >= 0;
      if (!misma) { return centro(['CartoCiudad no tiene el número ' + n + ' de esta calle. ' + larga]); }
      var avisos = String(x.portalNumber) === String(parseInt(n, 10)) && !/\D/.test(n) ? [] :
        ['CartoCiudad no tiene exactamente el número ' + n + ' de esta calle; se muestra el n.º ' + x.portalNumber +
         (x.extension ? ' ' + x.extension : '') + ', el que propone como aproximación.'];
      return mostrar({ lat: x.lat, lng: x.lng, etiqueta: etiquetaFind(x) }, avisos, otras);
    });
  }

  function buscar() {
    var t = calle.value.trim(), n = numero.value.trim(), nNum = parseInt(n, 10);
    cerrar(); turno++;
    if (!t) { mensaje('Escriba el nombre de la calle.', 'aviso'); calle.focus(); return; }
    if (/^s\/?n\.?$/i.test(n)) { n = ''; nNum = NaN; }
    var usar = elegida && calle.value === elegida.p.texto ? elegida : null;
    var base = usar ? usar.p.consulta : t;
    var mun = usar ? usar.c.muni : munElegido();
    ocupado(true);
    var tarea;
    if (usar && usar.c.type === 'portal' && usar.c.lat && n === usar.p.num) {
      tarea = mostrar(puntoCandidato(usar.c), [], []);
    } else {
      tarea = (isNaN(nNum) ? Promise.resolve([]) : candidatos(base + ' ' + n, mun, 15)).then(function (cs) {
        var portales = cs.filter(function (c) { return c.type === 'portal' && c.lat && c.portalNumber === nNum; });
        if (usar) {
          var mismos = portales.filter(function (c) { return partes(c).via === usar.p.via; });
          if (mismos.length) { portales = mismos; }
        }
        var exactos = portales.filter(function (c) { return partes(c).num.toUpperCase() === n.toUpperCase(); });
        if (exactos.length) { portales = exactos.concat(portales.filter(function (c) { return exactos.indexOf(c) < 0; })); }
        if (portales.length) {
          var primero = portales[0], vistas = {};
          vistas[claveVia(primero)] = true;
          var otras = portales.slice(1).filter(function (c) {
            var k = claveVia(c);
            if (vistas[k]) { return false; }
            vistas[k] = true; return true;
          }).map(function (c) { return { etiqueta: etiquetaCandidato(c), ir: irA(c) }; });
          var avisos = partes(primero).num.toUpperCase() === n.toUpperCase() ? [] :
            ['Se muestra el número ' + partes(primero).num + ' (CartoCiudad no distingue «' + n + '»).'];
          return mostrar(puntoCandidato(primero), avisos, otras);
        }
        // Sin portal con ese número (o sin número): se busca la calle
        var calles = usar && usar.c.type === 'callejero' ? Promise.resolve([usar.c]) : candidatos(base, mun, 10);
        return calles.then(function (vs) {
          vs = vs.filter(function (c) { return c.type === 'callejero'; });
          if (!vs.length) {
            mensaje('No se ha encontrado esa calle' + (mun ? ' en ' + mun : ' en los municipios de la diócesis') +
                    '. Revise el nombre y la población, o elija una de las sugerencias que aparecen al escribir.', 'aviso');
            capa.clearLayers();
            return;
          }
          var otras = vs.slice(1).map(function (c) { return { etiqueta: etiquetaCandidato(c), ir: irA(c) }; });
          return situarCalle(vs[0], n, otras);
        });
      });
    }
    tarea.catch(function () {
      mensaje('No se ha podido consultar el servicio de direcciones (CartoCiudad) o los territorios. Compruebe la conexión e inténtelo de nuevo.', 'aviso');
    }).then(function () { ocupado(false); });
  }

  // ------------------------------------------------------------ pulsar en el mapa
  // No se consulta CartoCiudad: basta el punto pulsado y los territorios.
  function grados(v, pos, neg) { return Math.abs(v).toFixed(5).replace('.', ',') + '° ' + (v < 0 ? neg : pos); }
  M.pulsar = function (ll) {
    cerrar();
    mostrar({ lat: ll.lat, lng: ll.lng, pulsado: true, etiqueta: grados(ll.lat, 'N', 'S') + ', ' + grados(ll.lng, 'E', 'O') }, [], [])
      .catch(function () {
        mensaje('No se han podido consultar los territorios. Compruebe la conexión e inténtelo de nuevo.', 'aviso');
      });
  };
  mapa.on('click', function (ev) { M.pulsar(ev.latlng); });

  form.addEventListener('submit', function (ev) { ev.preventDefault(); buscar(); });
  borrar.addEventListener('click', function () {
    form.reset(); elegida = null; cerrar(); res.innerHTML = ''; capa.clearLayers();
    mapa.closePopup(); mapa.fitBounds(M.todo); calle.focus();
  });
})();
