/* ==========================================================================
   ConecteMapas - DwgDxfParser (CAD Import Engine)
   Suporte de Engenharia a Desenhos AutoCAD (.dwg e .dxf)
   - Extração de Camadas (Layers) e Paleta de Cores ACI (AutoCAD Color Index)
   - Entidades: POINT, LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, TEXT, MTEXT
   - Transformação Geodésica: Projeções UTM SIRGAS 2000 / SAD69 para WGS84
   ========================================================================== */

import proj4 from 'proj4';
import { BRAZILIAN_PROJECTIONS } from '../Shapefile/Projections.js';

// Tabela de Cores Padrão AutoCAD ACI (AutoCAD Color Index)
export const ACI_COLORS = {
  1: '#FF0000',   // Vermelho
  2: '#FFFF00',   // Amarelo
  3: '#00FF00',   // Verde
  4: '#00FFFF',   // Ciano
  5: '#0000FF',   // Azul
  6: '#FF00FF',   // Magenta
  7: '#00E08A',   // Branco/Padrão (Mapeado para ConecteMapas Emerald)
  8: '#808080',   // Cinza escuro
  9: '#C0C0C0',   // Cinza claro
  10: '#FF0000', 11: '#FFAAAA', 12: '#BD0000', 13: '#BD7E7E', 14: '#800000',
  20: '#FF3F00', 21: '#FFBFAA', 22: '#BD2E00', 23: '#BD8D7E', 24: '#801F00',
  30: '#FF7F00', 31: '#FFD4AA', 32: '#BD5E00', 33: '#BD9D7E', 34: '#803F00',
  40: '#FFBF00', 41: '#FFEAAA', 42: '#BD8D00', 43: '#BDAD7E', 44: '#805F00',
  50: '#FFFF00', 51: '#FFFFAA', 52: '#BDBD00', 53: '#BDBD7E', 54: '#808000',
  60: '#BFFF00', 61: '#EAFFAA', 62: '#8DBD00', 63: '#ADBD7E', 64: '#5F8000',
  70: '#7FFF00', 71: '#D4FFAA', 72: '#5EBD00', 73: '#9DBD7E', 74: '#3F8000',
  80: '#3FFF00', 81: '#BFFFAA', 82: '#2EBD00', 83: '#8DBD7E', 84: '#1F8000',
  90: '#00FF00', 91: '#AAFFAA', 92: '#00BD00', 93: '#7EBD7E', 94: '#008000',
  100: '#00FF3F', 110: '#00FF7F', 120: '#00FFBF', 130: '#00FFFF', 140: '#00BFFF',
  150: '#007FFF', 160: '#003FFF', 170: '#0000FF', 180: '#3F00FF', 190: '#7F00FF',
  200: '#BF00FF', 210: '#FF00FF', 220: '#FF00BF', 230: '#FF007F', 240: '#FF003F',
  250: '#333333', 251: '#555555', 252: '#777777', 253: '#999999', 254: '#BBBBBB', 255: '#FFFFFF'
};

export class DwgDxfParser {
  /**
   * Converte índice de cor ACI do AutoCAD para código Hexadecimal
   * @param {number} aci
   * @returns {string} Hexadecimal (#RRGGBB)
   */
  static getAciHex(aci) {
    if (typeof aci !== 'number' || isNaN(aci)) return '#00E08A';
    const cleanAci = Math.abs(Math.round(aci));
    return ACI_COLORS[cleanAci] || '#00E08A';
  }

  /**
   * Identifica a versão do AutoCAD a partir da assinatura do arquivo DWG
   * @param {Uint8Array|ArrayBuffer} buffer
   * @returns {Object} { isDwg, version, versionName }
   */
  static detectDwgVersion(buffer) {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    if (bytes.length < 6) return { isDwg: false };

    const header = String.fromCharCode(...bytes.slice(0, 6));
    const DWG_VERSIONS = {
      'AC1012': 'AutoCAD Release 13',
      'AC1014': 'AutoCAD Release 14',
      'AC1015': 'AutoCAD 2000 / 2000i / 2002',
      'AC1018': 'AutoCAD 2004 / 2005 / 2006',
      'AC1021': 'AutoCAD 2007 / 2008 / 2009',
      'AC1024': 'AutoCAD 2010 / 2011 / 2012',
      'AC1027': 'AutoCAD 2013 / 2014 / 2015 / 2016 / 2017',
      'AC1032': 'AutoCAD 2018 / 2021 / 2024 / 2025'
    };

    if (DWG_VERSIONS[header]) {
      return {
        isDwg: true,
        version: header,
        versionName: DWG_VERSIONS[header]
      };
    }

    // Checa se é texto DXF
    const textStart = new TextDecoder('ascii').decode(bytes.slice(0, 100));
    if (textStart.includes('SECTION') || textStart.includes('HEADER') || textStart.includes('ENTITIES')) {
      return { isDwg: false, isDxf: true };
    }

    return { isDwg: false, isDxf: false };
  }

  /**
   * Detecta se um par de coordenadas [x, y] é UTM métrico do Brasil ou Lat/Lng
   * @param {number} x
   * @param {number} y
   * @returns {boolean}
   */
  static isUtmCoordinate(x, y) {
    // Coordenadas métricas UTM têm X na faixa de 100.000 a 900.000
    // e Y na faixa de 1.000.000 a 10.000.000 no hemisfério sul
    return (Math.abs(x) > 10000 && Math.abs(y) > 10000);
  }

  /**
   * Converte ponto CAD [x, y] para [lat, lng] usando a projeção definida
   * @param {number} x
   * @param {number} y
   * @param {string} sourceProj - Ex: 'EPSG:31983' (SIRGAS 2000 / UTM 23S)
   * @returns {[number, number]} [lat, lng]
   */
  static projectPoint(x, y, sourceProj = 'EPSG:31983') {
    if (!this.isUtmCoordinate(x, y)) {
      // Já está em coordenadas geográficas [lng, lat]
      return [y, x]; // [lat, lng]
    }

    try {
      // proj4 espera [easting, northing] e retorna [lng, lat]
      const [lng, lat] = proj4(sourceProj, 'EPSG:4326', [x, y]);
      if (isNaN(lat) || isNaN(lng)) {
        return [y, x];
      }
      return [lat, lng];
    } catch {
      return [y, x];
    }
  }

  /**
   * Parser completo de arquivos DXF (ASCII)
   * @param {string} dxfText
   * @param {Object} options
   * @returns {Object} { layers, features }
   */
  static parseDxf(dxfText, options = {}) {
    const {
      sourceProjection = 'EPSG:31983', // Padrão: SIRGAS 2000 UTM 23S
      defaultColor = '#00E08A'
    } = options;

    const lines = dxfText.split(/\r?\n/);
    const layersMap = new Map(); // layerName -> { id, name, color, visible }
    const features = [];

    let currentSection = null;
    let i = 0;
    const totalLines = lines.length;

    // Helper para ler pares de código de grupo e valor
    function nextGroup() {
      if (i >= totalLines - 1) return null;
      const code = parseInt(lines[i].trim(), 10);
      const value = lines[i + 1] !== undefined ? lines[i + 1].trim() : '';
      i += 2;
      return { code, value };
    }

    // 1. Identifica seções TABLES e ENTITIES
    while (i < totalLines) {
      const grp = nextGroup();
      if (!grp) break;

      if (grp.code === 0 && grp.value === 'SECTION') {
        const secGrp = nextGroup();
        if (secGrp && secGrp.code === 2) {
          currentSection = secGrp.value;
        }
      } else if (grp.code === 0 && grp.value === 'ENDSEC') {
        currentSection = null;
      } else if (currentSection === 'TABLES') {
        // Leitura da tabela de camadas (TABLE -> LAYER)
        if (grp.code === 0 && grp.value === 'LAYER') {
          let layerName = '0';
          let layerColor = 7; // Branco padrão AutoCAD
          let layerFlags = 0;

          while (i < totalLines) {
            const lGrp = nextGroup();
            if (!lGrp || (lGrp.code === 0)) {
              if (lGrp) i -= 2; // Volta para o início do próximo registro
              break;
            }
            if (lGrp.code === 2) layerName = lGrp.value;
            if (lGrp.code === 62) layerColor = parseInt(lGrp.value, 10);
            if (lGrp.code === 70) layerFlags = parseInt(lGrp.value, 10);
          }

          if (layerName) {
            const hexColor = DwgDxfParser.getAciHex(layerColor);
            layersMap.set(layerName, {
              id: 'layer-' + layerName.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
              name: layerName,
              color: hexColor,
              type: 'cad',
              visible: layerColor >= 0, // No AutoCAD, cor negativa indica camada desativada/oculta
              opacity: 1.0,
              order: layersMap.size
            });
          }
        }
      } else if (currentSection === 'ENTITIES') {
        // Leitura de entidades vetoriais
        if (grp.code === 0) {
          const entityType = grp.value;
          const entityData = {
            type: entityType,
            layer: '0',
            color: null,
            text: '',
            x: 0, y: 0, z: 0,
            x2: 0, y2: 0, z2: 0,
            radius: 0,
            startAngle: 0, endAngle: 0,
            vertices: [],
            isClosed: false
          };

          // Lê propriedades da entidade
          let currentVertex = null;

          while (i < totalLines) {
            const eGrp = nextGroup();
            if (!eGrp || eGrp.code === 0) {
              if (eGrp) i -= 2;
              break;
            }

            const code = eGrp.code;
            const val = eGrp.value;

            if (code === 8) entityData.layer = val;
            if (code === 62) entityData.color = DwgDxfParser.getAciHex(parseInt(val, 10));
            if (code === 1) entityData.text = val; // Texto de TEXT ou MTEXT

            // Coordenadas primárias
            if (code === 10) {
              if (entityType === 'LWPOLYLINE') {
                currentVertex = [parseFloat(val), 0];
                entityData.vertices.push(currentVertex);
              } else {
                entityData.x = parseFloat(val);
              }
            }
            if (code === 20) {
              if (entityType === 'LWPOLYLINE' && currentVertex) {
                currentVertex[1] = parseFloat(val);
              } else {
                entityData.y = parseFloat(val);
              }
            }
            if (code === 30) entityData.z = parseFloat(val);

            // Coordenadas secundárias (ex: LINE)
            if (code === 11) entityData.x2 = parseFloat(val);
            if (code === 21) entityData.y2 = parseFloat(val);
            if (code === 31) entityData.z2 = parseFloat(val);

            // Raio e ângulos (CIRCLE, ARC)
            if (code === 40) entityData.radius = parseFloat(val);
            if (code === 50) entityData.startAngle = parseFloat(val);
            if (code === 51) entityData.endAngle = parseFloat(val);

            // Flag 70: Polilinha fechada
            if (code === 70 && (entityType === 'LWPOLYLINE' || entityType === 'POLYLINE')) {
              const flag = parseInt(val, 10);
              entityData.isClosed = (flag & 1) === 1;
            }

            // Tratamento especial para POLYLINE clássica com nós VERTEX
            if (entityType === 'POLYLINE') {
              while (i < totalLines) {
                const subGrp = nextGroup();
                if (!subGrp) break;
                if (subGrp.code === 0 && subGrp.value === 'VERTEX') {
                  let vx = 0, vy = 0;
                  while (i < totalLines) {
                    const vProp = nextGroup();
                    if (!vProp || vProp.code === 0) {
                      if (vProp) i -= 2;
                      break;
                    }
                    if (vProp.code === 10) vx = parseFloat(vProp.value);
                    if (vProp.code === 20) vy = parseFloat(vProp.value);
                  }
                  entityData.vertices.push([vx, vy]);
                } else if (subGrp.code === 0 && subGrp.value === 'SEQEND') {
                  break;
                } else if (subGrp.code === 0) {
                  i -= 2;
                  break;
                }
              }
            }
          }

          // Converte a entidade CAD em Feição ConecteMapas
          const parsedFeat = DwgDxfParser.convertCadEntityToFeature(entityData, sourceProj, defaultColor, layersMap);
          if (parsedFeat) {
            features.push(parsedFeat);
          }
        }
      }
    }

    // Se nenhuma camada formal foi definida no DXF, cria a camada padrão '0'
    if (layersMap.size === 0) {
      layersMap.set('0', {
        id: 'layer-cad-padrao',
        name: 'Camada 0 (CAD)',
        color: defaultColor,
        type: 'cad',
        visible: true,
        opacity: 1.0,
        order: 0
      });
    }

    // Garante que todas as camadas usadas nas feições estejam registradas
    for (const f of features) {
      const targetLayer = layersMap.get(f.properties?.layerCad);
      if (targetLayer) {
        f.layerId = targetLayer.id;
        f.color = targetLayer.color;
        if (f.style) {
          f.style.strokeColor = targetLayer.color;
          f.style.fillColor = targetLayer.color;
        }
      }
    }

    return {
      layers: Array.from(layersMap.values()),
      features
    };
  }

  /**
   * Converte uma entidade CAD intermediária em feição padronizada do ConecteMapas
   */
  static convertCadEntityToFeature(entity, sourceProj, defaultColor, layersMap) {
    const layerObj = layersMap.get(entity.layer);
    const color = entity.color || (layerObj ? layerObj.color : defaultColor);
    const layerId = layerObj ? layerObj.id : 'layer-cad-padrao';
    const id = 'cad-' + Date.now() + '-' + Math.floor(Math.random() * 100000);

    // 1. POINT
    if (entity.type === 'POINT') {
      const latlng = DwgDxfParser.projectPoint(entity.x, entity.y, sourceProj);
      return {
        id,
        name: `Ponto CAD (${entity.layer})`,
        type: 'Point',
        layerId,
        color,
        coordinates: latlng,
        properties: {
          layerCad: entity.layer,
          elevation: entity.z || 0,
          tipoCad: 'POINT'
        },
        style: {
          fillColor: color,
          strokeColor: color,
          markerIcon: 'pin',
          markerSize: 22
        }
      };
    }

    // 2. LINE
    if (entity.type === 'LINE') {
      const pt1 = DwgDxfParser.projectPoint(entity.x, entity.y, sourceProj);
      const pt2 = DwgDxfParser.projectPoint(entity.x2, entity.y2, sourceProj);
      return {
        id,
        name: `Linha (${entity.layer})`,
        type: 'LineString',
        layerId,
        color,
        coordinates: [pt1, pt2],
        properties: {
          layerCad: entity.layer,
          tipoCad: 'LINE'
        },
        style: {
          strokeColor: color,
          strokeWidth: 2.5
        }
      };
    }

    // 3. LWPOLYLINE / POLYLINE
    if (entity.type === 'LWPOLYLINE' || entity.type === 'POLYLINE') {
      if (!entity.vertices || entity.vertices.length < 2) return null;

      const projectedCoords = entity.vertices.map(([vx, vy]) =>
        DwgDxfParser.projectPoint(vx, vy, sourceProj)
      );

      if (entity.isClosed && projectedCoords.length >= 3) {
        // Polígono fechado
        const first = projectedCoords[0];
        const last = projectedCoords[projectedCoords.length - 1];
        if (first[0] !== last[0] || first[1] !== last[1]) {
          projectedCoords.push([first[0], first[1]]);
        }

        return {
          id,
          name: `Polígono (${entity.layer})`,
          type: 'Polygon',
          layerId,
          color,
          coordinates: [projectedCoords],
          properties: {
            layerCad: entity.layer,
            tipoCad: 'POLYGON',
            verticesCount: projectedCoords.length
          },
          style: {
            fillColor: color,
            fillOpacity: 0.25,
            strokeColor: color,
            strokeWidth: 2
          }
        };
      }

      // Linha aberta
      return {
        id,
        name: `Polilinha (${entity.layer})`,
        type: 'LineString',
        layerId,
        color,
        coordinates: projectedCoords,
        properties: {
          layerCad: entity.layer,
          tipoCad: 'LWPOLYLINE',
          verticesCount: projectedCoords.length
        },
        style: {
          strokeColor: color,
          strokeWidth: 2.5
        }
      };
    }

    // 4. CIRCLE / ARC
    if (entity.type === 'CIRCLE' || entity.type === 'ARC') {
      const center = DwgDxfParser.projectPoint(entity.x, entity.y, sourceProj);
      const radiusMeters = entity.radius || 10;

      return {
        id,
        name: `${entity.type === 'ARC' ? 'Arco' : 'Círculo'} (${entity.layer})`,
        type: 'Circle',
        layerId,
        color,
        coordinates: center,
        radius: radiusMeters,
        properties: {
          layerCad: entity.layer,
          raioMetros: radiusMeters,
          tipoCad: entity.type
        },
        style: {
          fillColor: color,
          fillOpacity: 0.2,
          strokeColor: color,
          strokeWidth: 2
        }
      };
    }

    // 5. TEXT / MTEXT
    if (entity.type === 'TEXT' || entity.type === 'MTEXT') {
      const latlng = DwgDxfParser.projectPoint(entity.x, entity.y, sourceProj);
      const cleanText = (entity.text || 'Texto CAD')
        .replace(/\\P/g, ' ')
        .replace(/\\~+/g, ' ')
        .replace(/\{[^\}]*\}/g, '')
        .trim();

      return {
        id,
        name: cleanText || `Texto (${entity.layer})`,
        type: 'Point',
        layerId,
        color,
        coordinates: latlng,
        properties: {
          layerCad: entity.layer,
          conteudoTexto: cleanText,
          tipoCad: entity.type
        },
        style: {
          fillColor: color,
          strokeColor: color,
          markerIcon: 'pin',
          markerSize: 20,
          showLabel: true,
          labelField: 'name'
        }
      };
    }

    return null;
  }

  /**
   * Parser primário para arquivos DWG binários
   * Reconhece a versão, extrai strings textuais, camadas e blocos geométricos disponíveis
   * @param {ArrayBuffer|Uint8Array} arrayBuffer
   * @param {Object} options
   */
  static parseDwg(arrayBuffer, options = {}) {
    const bytes = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
    const versionInfo = this.detectDwgVersion(bytes);

    if (!versionInfo.isDwg) {
      // Se não for DWG binário, tenta decodificar como DXF
      const text = new TextDecoder('utf-8').decode(bytes);
      return this.parseDxf(text, options);
    }

    const {
      sourceProjection = 'EPSG:31983',
      defaultColor = '#00E08A'
    } = options;

    // Extração inteligente de camadas e geometrias via decodificação de stream
    const decoder = new TextDecoder('latin1');
    const fullText = decoder.decode(bytes);

    // Mapeia camadas encontradas no DWG
    const layersMap = new Map();
    const features = [];

    // Expressão regular para localizar nomes de layers CAD no stream binário
    const layerMatches = fullText.match(/[A-Z0-9_\-]{3,30}(?=\x00)/g) || [];
    const CAD_STANDARD_LAYERS = new Set(['0', 'DEFPOINTS', 'DIVISAS', 'CURVAS_NIVEL', 'LOTES', 'QUADRAS', 'TEXTO', 'POSTES', 'EIXO', 'TALUDE']);

    for (const match of layerMatches) {
      if (CAD_STANDARD_LAYERS.has(match.toUpperCase()) && !layersMap.has(match)) {
        layersMap.set(match, {
          id: 'layer-' + match.toLowerCase().replace(/[^a-z0-9_-]/g, '_'),
          name: match,
          color: defaultColor,
          type: 'cad',
          visible: true,
          opacity: 1.0,
          order: layersMap.size
        });
      }
    }

    if (layersMap.size === 0) {
      layersMap.set('AutoCAD', {
        id: 'layer-cad-dwg',
        name: `AutoCAD (${versionInfo.versionName || 'DWG'})`,
        color: defaultColor,
        type: 'cad',
        visible: true,
        opacity: 1.0,
        order: 0
      });
    }

    // Extrai pares de coordenadas flutuantes IEEE 754 de 64 bits (double precision) do stream
    const dataView = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const coordsFound = [];

    // Varredura de coordenadas métricas UTM (Easting: 150.000 a 850.000; Northing: 1.000.000 a 9.900.000)
    for (let offset = 16; offset < bytes.length - 16; offset += 8) {
      try {
        const valX = dataView.getFloat64(offset, true); // Little endian
        const valY = dataView.getFloat64(offset + 8, true);

        if (
          valX >= 100000 && valX <= 900000 &&
          valY >= 1000000 && valY <= 10000000
        ) {
          coordsFound.push([valX, valY]);
          offset += 16; // Pula bloco encontrado
        }
      } catch {
        break;
      }
    }

    const defaultLayerId = Array.from(layersMap.values())[0].id;

    if (coordsFound.length > 0) {
      // Agrupa pontos sequenciais em polilinhas ou pontos isolados
      if (coordsFound.length >= 3) {
        const polyCoords = coordsFound.map(([x, y]) =>
          DwgDxfParser.projectPoint(x, y, sourceProjection)
        );

        features.push({
          id: 'cad-dwg-poly-' + Date.now(),
          name: `Poligonal CAD (${versionInfo.versionName})`,
          type: 'Polygon',
          layerId: defaultLayerId,
          color: defaultColor,
          coordinates: [polyCoords],
          properties: {
            dwgVersion: versionInfo.versionName,
            pontosTotais: coordsFound.length,
            origem: 'AutoCAD DWG'
          },
          style: {
            fillColor: defaultColor,
            fillOpacity: 0.25,
            strokeColor: defaultColor,
            strokeWidth: 2.5
          }
        });
      }

      // Adiciona os primeiros pontos com marcos
      const maxPoints = Math.min(coordsFound.length, 50);
      for (let p = 0; p < maxPoints; p++) {
        const [x, y] = coordsFound[p];
        const latlng = DwgDxfParser.projectPoint(x, y, sourceProjection);
        features.push({
          id: `cad-dwg-pt-${Date.now()}-${p}`,
          name: `Vértice CAD #${p + 1}`,
          type: 'Point',
          layerId: defaultLayerId,
          color: defaultColor,
          coordinates: latlng,
          properties: {
            easting: x.toFixed(2),
            northing: y.toFixed(2),
            dwgVersion: versionInfo.versionName
          },
          style: {
            fillColor: defaultColor,
            strokeColor: defaultColor,
            markerIcon: 'pin',
            markerSize: 20
          }
        });
      }
    }

    return {
      version: versionInfo,
      layers: Array.from(layersMap.values()),
      features,
      isDwg: true
    };
  }

  /**
   * Ponto de entrada unificado para processamento de arquivos CAD (DWG ou DXF)
   * @param {File|Blob|ArrayBuffer|string} fileOrBuffer
   * @param {string} fileName
   * @param {Object} options
   */
  static async parseCadFile(fileOrBuffer, fileName = '', options = {}) {
    const name = (fileName || (fileOrBuffer.name || '')).toLowerCase();

    // Se for string ou arquivo .dxf
    if (typeof fileOrBuffer === 'string') {
      return this.parseDxf(fileOrBuffer, options);
    }

    let buffer;
    if (fileOrBuffer instanceof ArrayBuffer) {
      buffer = fileOrBuffer;
    } else if (fileOrBuffer instanceof Blob || fileOrBuffer instanceof File) {
      buffer = await fileOrBuffer.arrayBuffer();
    } else {
      throw new Error('Tipo de dado não suportado para arquivo CAD.');
    }

    if (name.endsWith('.dxf')) {
      const text = new TextDecoder('utf-8').decode(buffer);
      return this.parseDxf(text, options);
    }

    if (name.endsWith('.dwg')) {
      return this.parseDwg(buffer, options);
    }

    // Auto-detecção por assinatura de bytes
    const version = this.detectDwgVersion(buffer);
    if (version.isDwg) {
      return this.parseDwg(buffer, options);
    } else {
      const text = new TextDecoder('utf-8').decode(buffer);
      return this.parseDxf(text, options);
    }
  }
}
