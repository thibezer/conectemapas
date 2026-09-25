/* ==========================================================================
   ConecteMapas - FeaturePropertiesAdapter
   Responsabilidade Única: Mapeamento de feições GIS para o Web Component
   <ui-tabela-propriedades> da biblioteca Componentes-UI.
   ========================================================================== */

import { SpatialAlgorithms } from '../../services/SpatialAlgorithms.js';
import { GeoFormats } from '../../services/GeoFormats.js';
import { UIToast } from 'ui-components-kit';

export class FeaturePropertiesAdapter {
  /**
   * Traduz o tipo de geometria GeoJSON para rótulo legível em português.
   * @param {string} type
   * @returns {string}
   */
  static translateType(type) {
    switch (type) {
      case 'Polygon': return 'Polígono';
      case 'LineString': return 'Linha';
      case 'Point': return 'Ponto';
      case 'Circle': return 'Círculo';
      default: return type || 'Geometria';
    }
  }

  /**
   * Converte a feição selecionada em tipos e categorias para o <ui-tabela-propriedades>.
   * @param {Object} panel - Instância do LayerPanel
   * @param {Object} feat - Feição selecionada
   * @returns {{ tipos: Array, categorias: Array }}
   */
  static gerarConfiguracao(panel, feat) {
    if (!feat) return { tipos: [], categorias: [] };

    const isLocked = feat.locked === true;
    const isPoly = feat.type === 'Polygon';
    const isCircle = feat.type === 'Circle';
    const isLine = feat.type === 'LineString';
    const isPoint = feat.type === 'Point';

    const coordinates = Array.isArray(feat.coordinates) ? feat.coordinates : [];
    const isMultiGeom = Array.isArray(coordinates[0]) && Array.isArray(coordinates[0][0]);
    const flattenedPoints = isMultiGeom ? coordinates.flat() : coordinates;

    // 1. Cálculos Geodésicos
    let areaM2 = 0;
    let lengthM = 0;
    if (isPoly && (coordinates.length >= 3 || (isMultiGeom && flattenedPoints.length >= 3))) {
      areaM2 = panel.calculatePolygonArea ? panel.calculatePolygonArea(coordinates) : 0;
    } else if (isCircle) {
      areaM2 = Math.PI * (feat.radius || 0) * (feat.radius || 0);
    } else if (isLine && (coordinates.length >= 2 || (isMultiGeom && flattenedPoints.length >= 2))) {
      lengthM = panel.calculatePolylineLength ? panel.calculatePolylineLength(coordinates) : 0;
    }

    let refCoord = [0, 0];
    if (isPoint || isCircle) {
      refCoord = coordinates;
    } else if (flattenedPoints.length > 0) {
      refCoord = [
        flattenedPoints.reduce((acc, c) => acc + c[0], 0) / flattenedPoints.length,
        flattenedPoints.reduce((acc, c) => acc + c[1], 0) / flattenedPoints.length
      ];
    }
    const dmsLat = SpatialAlgorithms.ddToDms(refCoord[0], true);
    const dmsLng = SpatialAlgorithms.ddToDms(refCoord[1], false);

    // 2. Estilo
    const defaultColor = feat.color || '#00E08A';
    const style = {
      fillColor: feat.style?.fillColor || defaultColor,
      fillOpacity: feat.style?.fillOpacity !== undefined ? Number(feat.style.fillOpacity) : (isLine ? 1 : 0.35),
      strokeColor: feat.style?.strokeColor || defaultColor,
      strokeWidth: feat.style?.strokeWidth !== undefined ? Number(feat.style.strokeWidth) : 2.5,
      strokeDashArray: feat.style?.strokeDashArray || '',
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: feat.style?.markerSize !== undefined ? Number(feat.style.markerSize) : 24,
      markerRotation: feat.style?.markerRotation !== undefined ? Number(feat.style.markerRotation) : 0,
      showLabel: feat.style?.showLabel === true,
      labelField: feat.style?.labelField || 'name'
    };

    const layerName = panel.layers.find(l => l.id === feat.layerId)?.name || 'Padrão';

    // 3. Seletor de Tipos do Topo
    const tipos = [
      {
        id: feat.id,
        rotulo: `${feat.name || 'Sem Nome'} (${FeaturePropertiesAdapter.translateType(feat.type)})`,
        subtipo: `Camada: ${layerName} • ID: ${feat.id}`
      }
    ];

    // 4. Categorias
    const categorias = [];

    // --- Categoria 1: Identificação & Camada ---
    categorias.push({
      id: 'identificacao',
      titulo: '📌 Identificação & Camada',
      aberto: true,
      propriedades: [
        {
          id: 'name',
          rotulo: 'Nome do Elemento',
          tipo: 'texto',
          valor: feat.name || '',
          somenteLeitura: isLocked,
          placeholder: 'Insira o nome da feição'
        },
        {
          id: 'description',
          rotulo: 'Descrição',
          tipo: 'texto',
          valor: feat.description || '',
          somenteLeitura: isLocked,
          placeholder: 'Anotações técnicas'
        },
        {
          id: 'layerId',
          rotulo: 'Camada de Destino',
          tipo: 'selecao',
          valor: feat.layerId || 'layer-topografia',
          somenteLeitura: isLocked,
          opcoes: (panel.layers || []).map(l => ({ id: l.id, rotulo: `📁 ${l.name}` }))
        },
        {
          id: 'locked',
          rotulo: 'Bloqueado',
          tipo: 'booleano',
          valor: !!feat.locked
        },
        {
          id: 'visible',
          rotulo: 'Visível no Mapa',
          tipo: 'booleano',
          valor: feat.visible !== false
        },
        {
          id: 'id',
          rotulo: 'Identificador (ID)',
          tipo: 'readonly',
          valor: feat.id
        }
      ]
    });

    // --- Categoria 2: Dimensões & Geometria ---
    const geomProps = [
      {
        id: 'geom_type',
        rotulo: 'Tipo Geométrico',
        tipo: 'readonly',
        valor: FeaturePropertiesAdapter.translateType(feat.type)
      }
    ];

    if (isPoly) {
      geomProps.push(
        {
          id: 'area_ha',
          rotulo: 'Área (Hectares)',
          tipo: 'readonly',
          valor: `${(areaM2 / 10000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ha`
        },
        {
          id: 'area_m2',
          rotulo: 'Área (m²)',
          tipo: 'readonly',
          valor: `${areaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`
        },
        {
          id: 'area_alqueire',
          rotulo: 'Área (Alqueire Paulista)',
          tipo: 'readonly',
          valor: `${(areaM2 / 24200).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} alq`
        },
        {
          id: 'perimetro_m',
          rotulo: 'Perímetro (m)',
          tipo: 'readonly',
          valor: `${lengthM.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`
        },
        {
          id: 'vertices_qtd',
          rotulo: 'Vértices',
          tipo: 'readonly',
          valor: `${coordinates.length} nós`
        }
      );
    } else if (isLine) {
      geomProps.push(
        {
          id: 'comprimento_km',
          rotulo: 'Extensão (km)',
          tipo: 'readonly',
          valor: `${(lengthM / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} km`
        },
        {
          id: 'comprimento_m',
          rotulo: 'Extensão (m)',
          tipo: 'readonly',
          valor: `${lengthM.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m`
        },
        {
          id: 'vertices_qtd',
          rotulo: 'Vértices',
          tipo: 'readonly',
          valor: `${coordinates.length} nós`
        }
      );
    } else if (isCircle) {
      geomProps.push(
        {
          id: 'radius',
          rotulo: 'Raio',
          tipo: 'numero',
          valor: feat.radius || 50,
          unidade: 'm',
          casasDecimais: 1,
          somenteLeitura: isLocked
        },
        {
          id: 'area_m2',
          rotulo: 'Área do Círculo',
          tipo: 'readonly',
          valor: `${areaM2.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m²`
        },
        {
          id: 'diametro_m',
          rotulo: 'Diâmetro',
          tipo: 'readonly',
          valor: `${((feat.radius || 50) * 2).toFixed(1)} m`
        }
      );
    } else if (isPoint) {
      geomProps.push(
        {
          id: 'lat_dd',
          rotulo: 'Latitude (DD)',
          tipo: 'readonly',
          valor: `${refCoord[0].toFixed(6)}°`
        },
        {
          id: 'lng_dd',
          rotulo: 'Longitude (DD)',
          tipo: 'readonly',
          valor: `${refCoord[1].toFixed(6)}°`
        },
        {
          id: 'coords_dms',
          rotulo: 'Coordenadas DMS',
          tipo: 'readonly',
          valor: `${dmsLat} | ${dmsLng}`
        }
      );
    }

    categorias.push({
      id: 'geometria',
      titulo: '📐 Dimensões & Geometria',
      aberto: true,
      propriedades: geomProps
    });

    // --- Categoria 3: Simbologia & Aparência ---
    const estiloProps = [];

    if (isPoly || isCircle) {
      estiloProps.push(
        {
          id: 'fillColor',
          rotulo: 'Preenchimento',
          tipo: 'cor',
          valor: style.fillColor,
          somenteLeitura: isLocked
        },
        {
          id: 'fillOpacity',
          rotulo: 'Opacidade Preenchimento',
          tipo: 'numero',
          valor: Math.round(style.fillOpacity * 100),
          unidade: '%',
          casasDecimais: 0,
          somenteLeitura: isLocked
        },
        {
          id: 'strokeColor',
          rotulo: 'Cor da Borda',
          tipo: 'cor',
          valor: style.strokeColor,
          somenteLeitura: isLocked
        },
        {
          id: 'strokeWidth',
          rotulo: 'Espessura da Borda',
          tipo: 'numero',
          valor: style.strokeWidth,
          unidade: 'px',
          casasDecimais: 1,
          somenteLeitura: isLocked
        },
        {
          id: 'strokeDashArray',
          rotulo: 'Padrão do Traço',
          tipo: 'selecao',
          valor: style.strokeDashArray || 'continuous',
          somenteLeitura: isLocked,
          opcoes: [
            { id: 'continuous', rotulo: 'Contínua —————' },
            { id: '5, 5', rotulo: 'Tracejada - - - -' },
            { id: '2, 4', rotulo: 'Pontilhada · · · ·' },
            { id: '10, 5, 2, 5', rotulo: 'Traço-Ponto — · — ·' }
          ]
        }
      );
    } else if (isLine) {
      estiloProps.push(
        {
          id: 'strokeColor',
          rotulo: 'Cor da Linha',
          tipo: 'cor',
          valor: style.strokeColor,
          somenteLeitura: isLocked
        },
        {
          id: 'strokeWidth',
          rotulo: 'Espessura da Linha',
          tipo: 'numero',
          valor: style.strokeWidth,
          unidade: 'px',
          casasDecimais: 1,
          somenteLeitura: isLocked
        },
        {
          id: 'strokeDashArray',
          rotulo: 'Padrão do Traço',
          tipo: 'selecao',
          valor: style.strokeDashArray || 'continuous',
          somenteLeitura: isLocked,
          opcoes: [
            { id: 'continuous', rotulo: 'Contínua —————' },
            { id: '5, 5', rotulo: 'Tracejada - - - -' },
            { id: '2, 4', rotulo: 'Pontilhada · · · ·' },
            { id: '10, 5, 2, 5', rotulo: 'Traço-Ponto — · — ·' }
          ]
        }
      );
    } else if (isPoint) {
      estiloProps.push(
        {
          id: 'pointColor',
          rotulo: 'Cor do Marcador',
          tipo: 'cor',
          valor: style.fillColor || style.strokeColor,
          somenteLeitura: isLocked
        },
        {
          id: 'markerIcon',
          rotulo: 'Símbolo do Marcador',
          tipo: 'selecao',
          valor: style.markerIcon || 'pin',
          somenteLeitura: isLocked,
          opcoes: [
            { id: 'pin', rotulo: '📍 Pino Padrão' },
            { id: 'circle', rotulo: '⬤ Círculo Sólido' },
            { id: 'square', rotulo: '◼ Quadrado' },
            { id: 'triangle', rotulo: '▲ Triângulo' },
            { id: 'cross', rotulo: '✚ Cruz Topográfica' },
            { id: 'star', rotulo: '★ Estrela Marco' }
          ]
        },
        {
          id: 'markerSize',
          rotulo: 'Tamanho do Marcador',
          tipo: 'numero',
          valor: style.markerSize || 24,
          unidade: 'px',
          casasDecimais: 0,
          somenteLeitura: isLocked
        },
        {
          id: 'markerRotation',
          rotulo: 'Ângulo de Rotação',
          tipo: 'numero',
          valor: style.markerRotation || 0,
          unidade: '°',
          casasDecimais: 0,
          somenteLeitura: isLocked
        }
      );
    }

    // Rótulos Dinâmicos no Mapa
    estiloProps.push(
      {
        id: 'showLabel',
        rotulo: 'Exibir Rótulo no Mapa',
        tipo: 'booleano',
        valor: style.showLabel === true,
        somenteLeitura: isLocked
      },
      {
        id: 'labelField',
        rotulo: 'Campo do Rótulo',
        tipo: 'selecao',
        valor: style.labelField || 'name',
        somenteLeitura: isLocked,
        opcoes: [
          { id: 'name', rotulo: 'Nome do Elemento' },
          { id: 'description', rotulo: 'Descrição' },
          { id: 'id', rotulo: 'ID do Elemento' },
          { id: 'category', rotulo: 'Categoria' },
          ...(isPoly ? [{ id: 'area', rotulo: 'Área (ha)' }] : []),
          ...(isLine ? [{ id: 'extensao', rotulo: 'Extensão' }] : [])
        ]
      }
    );

    categorias.push({
      id: 'simbologia',
      titulo: '🎨 Aparência & Simbologia',
      aberto: true,
      propriedades: estiloProps
    });

    // --- Categoria 4: Atributos GIS (Shapefile / Propriedades Customizadas) ---
    const attrProps = [];
    if (feat.properties && typeof feat.properties === 'object' && !Array.isArray(feat.properties)) {
      Object.entries(feat.properties).forEach(([key, val]) => {
        if (typeof val === 'number') {
          attrProps.push({
            id: `prop_${key}`,
            rotulo: key,
            tipo: 'numero',
            valor: val,
            somenteLeitura: isLocked
          });
        } else if (typeof val === 'boolean') {
          attrProps.push({
            id: `prop_${key}`,
            rotulo: key,
            tipo: 'booleano',
            valor: val,
            somenteLeitura: isLocked
          });
        } else {
          attrProps.push({
            id: `prop_${key}`,
            rotulo: key,
            tipo: 'texto',
            valor: String(val ?? ''),
            somenteLeitura: isLocked
          });
        }
      });
    }

    // Atributos customizados adicionais
    if (Array.isArray(feat.customAttributes)) {
      feat.customAttributes.forEach((item, idx) => {
        if (item && item.key) {
          attrProps.push({
            id: `custom_attr_${idx}`,
            rotulo: item.key,
            tipo: 'texto',
            valor: String(item.value ?? ''),
            somenteLeitura: isLocked
          });
        }
      });
    }

    attrProps.push({
      id: 'acao_adicionar_atributo',
      rotulo: 'Novo Atributo',
      tipo: 'acao',
      valor: '+ Adicionar Campo',
      rotuloAcao: '+ Criar Atributo',
      somenteLeitura: isLocked,
      dica: 'Adiciona um novo campo de metadado personalizado'
    });

    categorias.push({
      id: 'atributos',
      titulo: `📋 Atributos Personalizados (${attrProps.length - 1})`,
      aberto: attrProps.length > 1,
      propriedades: attrProps
    });

    // --- Categoria 5: Operações Espaciais & CAD ---
    const acoesProps = [
      {
        id: 'acao_enquadrar',
        rotulo: 'Localização',
        tipo: 'acao',
        valor: 'Centralizar',
        rotuloAcao: '🎯 Enquadrar Feição no Mapa',
        dica: 'Ajusta a câmera do mapa na geometria deste elemento'
      },
      {
        id: 'acao_buffer',
        rotulo: 'Amortecimento',
        tipo: 'acao',
        valor: 'Buffer 50m',
        rotuloAcao: '🔄 Criar Buffer (50m)',
        dica: 'Cria uma feição de amortecimento de 50 metros no mapa'
      },
      {
        id: 'acao_duplicar',
        rotulo: 'Clonagem',
        tipo: 'acao',
        valor: 'Duplicar',
        rotuloAcao: '📑 Duplicar Feição (+30m)',
        dica: 'Cria uma cópia do elemento deslocada em 30 metros'
      }
    ];

    if (isPoly || isLine) {
      acoesProps.push({
        id: 'acao_editar_vertices',
        rotulo: 'Edição Vetorial',
        tipo: 'acao',
        valor: panel.isVertexEditing ? 'Concluir' : 'Editar',
        rotuloAcao: panel.isVertexEditing ? '✔ Concluir Edição de Vértices' : '✏️ Editar Vértices no Mapa',
        dica: 'Habilita alças arrastáveis em cada vértice no mapa'
      });
      acoesProps.push({
        id: 'acao_simplificar',
        rotulo: 'Otimização',
        tipo: 'acao',
        valor: 'Simplificar',
        rotuloAcao: '📉 Simplificar Vértices (DP 5m)',
        dica: 'Aplica algoritmo Douglas-Peucker com 5m de tolerância'
      });
    }

    acoesProps.push(
      {
        id: 'acao_copiar_geojson',
        rotulo: 'Exportação',
        tipo: 'acao',
        valor: 'GeoJSON',
        rotuloAcao: '📋 Copiar GeoJSON',
        dica: 'Copia a geometria GeoJSON para a área de transferência'
      },
      {
        id: 'acao_copiar_wkt',
        rotulo: 'Exportação',
        tipo: 'acao',
        valor: 'WKT',
        rotuloAcao: '📋 Copiar WKT (CAD)',
        dica: 'Copia o texto Well-Known Text para CAD/GIS'
      },
      {
        id: 'acao_excluir',
        rotulo: 'Remoção',
        tipo: 'acao',
        valor: 'Excluir',
        rotuloAcao: '🗑️ Excluir Feição',
        dica: 'Remove permanentemente esta feição do projeto'
      }
    );

    categorias.push({
      id: 'acoes',
      titulo: '⚡ Operações Rápidas & CAD',
      aberto: true,
      propriedades: acoesProps
    });

    return { tipos, categorias };
  }

  /**
   * Aplica a alteração de propriedade disparada pelo evento 'ui-propriedade-alterada'.
   * @param {Object} panel - Instância do LayerPanel
   * @param {Object} feat - Feição selecionada
   * @param {string} propId - ID da propriedade alterada
   * @param {any} novoValor - Novo valor recebido
   */
  static aplicarAlteracao(panel, feat, propId, novoValor) {
    if (!feat) return;

    const updated = JSON.parse(JSON.stringify(feat));
    if (!updated.style) updated.style = {};

    switch (propId) {
      case 'name':
        updated.name = String(novoValor || '').trim();
        break;

      case 'description':
        updated.description = String(novoValor || '').trim();
        break;

      case 'layerId':
        updated.layerId = String(novoValor);
        break;

      case 'locked':
        updated.locked = !!novoValor;
        UIToast.notificar({
          tipo: updated.locked ? 'alerta' : 'sucesso',
          titulo: updated.locked ? 'Feição Bloqueada' : 'Feição Desbloqueada',
          mensagem: updated.locked ? 'Edições travadas.' : 'Edição liberada.',
          duracao: 2000
        });
        break;

      case 'visible':
        updated.visible = !!novoValor;
        break;

      case 'radius': {
        const r = Math.max(1, parseFloat(novoValor) || 50);
        updated.radius = r;
        if (updated.properties && typeof updated.properties === 'object') {
          updated.properties.radius = r;
        }
        break;
      }

      // Estilo Visual
      case 'fillColor':
        updated.style.fillColor = novoValor;
        updated.color = novoValor;
        break;

      case 'fillOpacity':
        updated.style.fillOpacity = Math.max(0, Math.min(100, parseFloat(novoValor) || 35)) / 100;
        break;

      case 'strokeColor':
        updated.style.strokeColor = novoValor;
        break;

      case 'pointColor':
        updated.style.fillColor = novoValor;
        updated.style.strokeColor = novoValor;
        updated.color = novoValor;
        break;

      case 'strokeWidth':
        updated.style.strokeWidth = Math.max(0.5, parseFloat(novoValor) || 2.5);
        break;

      case 'strokeDashArray':
        updated.style.strokeDashArray = novoValor === 'continuous' ? '' : novoValor;
        break;

      case 'markerIcon':
        updated.style.markerIcon = novoValor;
        break;

      case 'markerSize':
        updated.style.markerSize = Math.max(8, parseInt(novoValor, 10) || 24);
        break;

      case 'markerRotation':
        updated.style.markerRotation = parseInt(novoValor, 10) || 0;
        break;

      case 'showLabel':
        updated.style.showLabel = !!novoValor;
        break;

      case 'labelField':
        updated.style.labelField = novoValor;
        break;

      default:
        // Tratamento de atributos do Shapefile (prefixados com 'prop_')
        if (propId.startsWith('prop_')) {
          const key = propId.replace('prop_', '');
          if (!updated.properties || typeof updated.properties !== 'object') {
            updated.properties = {};
          }
          updated.properties[key] = novoValor;
        } else if (propId.startsWith('custom_attr_')) {
          const idx = parseInt(propId.replace('custom_attr_', ''), 10);
          if (Array.isArray(updated.customAttributes) && updated.customAttributes[idx]) {
            updated.customAttributes[idx].value = novoValor;
          }
        }
        break;
    }

    panel.selectedFeature = updated;
    panel.onFeatureUpdate(updated);
  }

  /**
   * Trata o clique de ações embutidas na paleta de propriedades.
   * @param {Object} panel - Instância do LayerPanel
   * @param {Object} feat - Feição selecionada
   * @param {string} acaoId - ID da ação acionada
   */
  static executarAcao(panel, feat, acaoId) {
    if (!feat) return;

    switch (acaoId) {
      case 'acao_enquadrar':
        panel.onFitFeature(feat.id);
        break;

      case 'acao_buffer': {
        const radius = 50;
        const bufferFeature = SpatialAlgorithms.generateBuffer(feat, radius);
        if (bufferFeature) {
          panel.onFeatureCreate(bufferFeature);
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Buffer Gerado',
            mensagem: `Buffer de ${radius}m criado no mapa.`,
            duracao: 2500
          });
        }
        break;
      }

      case 'acao_duplicar': {
        const clone = SpatialAlgorithms.duplicateWithOffset(feat, 30);
        if (clone) {
          panel.onFeatureCreate(clone);
          UIToast.notificar({
            tipo: 'sucesso',
            titulo: 'Feição Duplicada',
            mensagem: 'Cópia criada com +30m de offset.',
            duracao: 2500
          });
        }
        break;
      }

      case 'acao_editar_vertices':
        panel.toggleVertexEditing();
        break;

      case 'acao_simplificar': {
        if (!Array.isArray(feat.coordinates)) break;
        const tol = 5;
        const isPoly = feat.type === 'Polygon';
        const originalCount = feat.coordinates.length;
        const simplified = SpatialAlgorithms.simplifyDouglasPeucker(feat.coordinates, tol, isPoly);
        const reduced = originalCount - simplified.length;
        const updated = { ...feat, coordinates: simplified };
        panel.selectedFeature = updated;
        panel.onFeatureUpdate(updated);
        panel.updateContent();
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Geometria Otimizada',
          mensagem: reduced > 0 ? `${reduced} vértices removidos (tolerância 5m).` : 'Geometria já possui quantidade ótima de vértices.',
          duracao: 2500
        });
        break;
      }

      case 'acao_copiar_geojson': {
        const jsonStr = GeoFormats.toGeoJSON([feat]);
        navigator.clipboard.writeText(jsonStr)
          .then(() => UIToast.notificar({ tipo: 'sucesso', titulo: 'GeoJSON Copiado', mensagem: 'GeoJSON copiado para a área de transferência.' }))
          .catch(() => UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível acessar a área de transferência.' }));
        break;
      }

      case 'acao_copiar_wkt': {
        const wktStr = GeoFormats.toWKT(feat);
        navigator.clipboard.writeText(wktStr)
          .then(() => UIToast.notificar({ tipo: 'sucesso', titulo: 'WKT Copiado', mensagem: 'WKT copiado para a área de transferência.' }))
          .catch(() => UIToast.notificar({ tipo: 'erro', titulo: 'Erro', mensagem: 'Não foi possível acessar a área de transferência.' }));
        break;
      }

      case 'acao_excluir':
        if (confirm(`Deseja realmente excluir a feição "${feat.name || 'Sem Nome'}"?`)) {
          panel.onFeatureDelete(feat.id);
          panel.selectedFeature = null;
          panel.updateContent();
          UIToast.notificar({
            tipo: 'info',
            titulo: 'Feição Excluída',
            mensagem: 'O elemento foi removido do mapa e do projeto.'
          });
        }
        break;

      case 'acao_adicionar_atributo': {
        const chave = prompt('Informe o nome do novo atributo / campo:');
        if (!chave || !chave.trim()) return;
        const chaveLimpa = chave.trim();
        const updated = { ...feat };
        if (!Array.isArray(updated.customAttributes)) {
          updated.customAttributes = [];
        }
        updated.customAttributes.push({ key: chaveLimpa, value: '' });
        panel.selectedFeature = updated;
        panel.onFeatureUpdate(updated);
        panel.updateContent();
        UIToast.notificar({
          tipo: 'sucesso',
          titulo: 'Campo Adicionado',
          mensagem: `Atributo "${chaveLimpa}" criado com sucesso.`
        });
        break;
      }
    }
  }
}
