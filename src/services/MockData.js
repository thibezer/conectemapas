/* ==========================================================================
   ConecteMapas - Mock Data & Templates
   Dados realistas de topografia, zoneamento, rotas e marcos geodésicos
   ========================================================================== */

export const DEFAULT_LAYERS = [
  { id: 'layer-topografia', name: 'Marcos & Topografia', color: '#00E08A', visible: true, opacity: 1, locked: false },
  { id: 'layer-ambiental', name: 'Preservação & Floresta (APP)', color: '#10b981', visible: true, opacity: 0.7, locked: false },
  { id: 'layer-zoneamento', name: 'Loteamento & Parcelas', color: '#3b82f6', visible: true, opacity: 0.65, locked: false },
  { id: 'layer-vistorias', name: 'Rotas de Campo & Drenagem', color: '#f59e0b', visible: true, opacity: 0.9, locked: false },
  { id: 'layer-anotacoes', name: 'Anotações & Alertas', color: '#ec4899', visible: true, opacity: 1, locked: false }
];

export function normalizeFeature(feat) {
  if (!feat) return feat;
  const defaultColor = feat.color || '#00E08A';
  return {
    ...feat,
    style: {
      fillColor: feat.style?.fillColor || defaultColor,
      fillOpacity: feat.style?.fillOpacity !== undefined ? feat.style.fillOpacity : (feat.type === 'LineString' ? 1 : 0.35),
      strokeColor: feat.style?.strokeColor || defaultColor,
      strokeWidth: feat.style?.strokeWidth !== undefined ? feat.style.strokeWidth : 2.5,
      strokeDashArray: feat.style?.strokeDashArray || '',
      markerIcon: feat.style?.markerIcon || 'pin',
      markerSize: feat.style?.markerSize || 24,
      markerRotation: feat.style?.markerRotation || 0,
      showLabel: feat.style?.showLabel || false,
      labelField: feat.style?.labelField || 'name',
      ...(feat.style || {})
    },
    customAttributes: Array.isArray(feat.customAttributes) ? feat.customAttributes : [],
    history: Array.isArray(feat.history) ? feat.history.slice(0, 8) : []
  };
}

export const DEFAULT_FEATURES = [
  // Marcos Geodésicos
  {
    id: 'feat-m01',
    name: 'Marco Geodésico M-01 (IBGE)',
    layerId: 'layer-topografia',
    type: 'Point',
    coordinates: [-15.7985, -47.8640],
    category: 'Marco IBGE',
    color: '#00E08A',
    description: 'Marco de referência altimétrica e georreferenciamento de precisão centimétrica.',
    style: {
      fillColor: '#00E08A',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWidth: 2,
      markerIcon: 'boundary',
      markerSize: 26,
      markerRotation: 0,
      showLabel: true,
      labelField: 'name'
    },
    properties: {
      altitude: '1.172,45 m',
      metodo: 'GNSS RTK Dupla Frequência',
      precisao: '± 0,008 m',
      responsavel: 'Eng. Thiago'
    },
    createdBy: 'Thiago',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
  },
  {
    id: 'feat-m02',
    name: 'Vértice Poligonal V-02',
    layerId: 'layer-topografia',
    type: 'Point',
    coordinates: [-15.7890, -47.8580],
    category: 'Vértice Topográfico',
    color: '#00E08A',
    description: 'Piquete de concreto com chapa de bronze cravada no alinhamento norte.',
    properties: {
      altitude: '1.168,10 m',
      metodo: 'Estação Total Robotizada',
      precisao: '± 0,012 m',
      responsavel: 'Ana Geógrafa'
    },
    createdBy: 'Ana Silva',
    createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
  },

  // Área de Preservação Permanente (Polígono)
  {
    id: 'feat-app-01',
    name: 'Reserva Legal & Mata Ciliar (APP)',
    layerId: 'layer-ambiental',
    type: 'Polygon',
    coordinates: [
      [-15.7920, -47.8720],
      [-15.7880, -47.8650],
      [-15.7940, -47.8610],
      [-15.8010, -47.8670],
      [-15.7970, -47.8730]
    ],
    category: 'Proteção Ambiental',
    color: '#10b981',
    description: 'Área com vegetação nativa do Cerrado e nascentes protegidas pelo Código Florestal.',
    properties: {
      areaCalculada: '68,45 ha',
      perimetro: '3.420,15 m',
      statusCAR: 'Inscrito e Homologado',
      bioma: 'Cerrado Sentido Restrito'
    },
    createdBy: 'Carlos Topógrafo',
    createdAt: new Date(Date.now() - 3600000 * 6).toISOString()
  },

  // Quadra de Loteamento (Polígono)
  {
    id: 'feat-quadra-a',
    name: 'Quadra Residencial Q-07',
    layerId: 'layer-zoneamento',
    type: 'Polygon',
    coordinates: [
      [-15.8030, -47.8590],
      [-15.7995, -47.8550],
      [-15.8045, -47.8510],
      [-15.8080, -47.8550]
    ],
    category: 'Zoneamento Urbano',
    color: '#3b82f6',
    description: 'Área destinada ao desdobro de 24 lotes unifamiliares de 450m².',
    properties: {
      areaCalculada: '28,12 ha',
      perimetro: '2.140,80 m',
      zoneamento: 'ZR-2 (Residencial Baixa Densidade)',
      coeficiente: '1.2'
    },
    createdBy: 'Thiago',
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },

  // Rota de Vistoria / Eixo Viário (Linha)
  {
    id: 'feat-rota-01',
    name: 'Eixo da Rodovia Vicinal VC-04',
    layerId: 'layer-vistorias',
    type: 'LineString',
    coordinates: [
      [-15.8060, -47.8750],
      [-15.7980, -47.8690],
      [-15.7910, -47.8630],
      [-15.7860, -47.8540]
    ],
    category: 'Eixo Viário',
    color: '#f59e0b',
    description: 'Traçado planejado para pavimentação e drenagem pluvial com faixa de domínio de 30m.',
    properties: {
      extensao: '3.140,50 m',
      larguraPista: '7,00 m',
      tipoPavimento: 'CBUQ 5cm',
      velocidadeProj: '60 km/h'
    },
    createdBy: 'Ana Silva',
    createdAt: new Date(Date.now() - 3600000 * 1).toISOString()
  },

  // Círculo / Buffer de Alcance
  {
    id: 'feat-buffer-01',
    name: 'Raio de Cobertura da Torre de Rádio',
    layerId: 'layer-vistorias',
    type: 'Circle',
    coordinates: [-15.7960, -47.8570],
    radius: 750, // metros
    category: 'Telecom & IoT',
    color: '#8b5cf6',
    description: 'Alcance do sinal da base RTK UHF para telemetria dos tratores e drones.',
    properties: {
      raio: '750 m',
      areaCoberta: '176,71 ha',
      frequencia: '450 MHz',
      potencia: '35W'
    },
    createdBy: 'Thiago',
    createdAt: new Date(Date.now() - 3600000 * 5).toISOString()
  }
];

export const PROJECT_TEMPLATES = [
  {
    id: 'template-topografia',
    title: 'Topografia & Agrimensura',
    icon: '📐',
    badge: 'Georreferenciamento',
    description: 'Configurado para levantamento planialtimétrico, marcos do IBGE, cálculo de azimutes e memoriais descritivos.',
    center: [-15.7942, -47.8822],
    zoom: 14,
    layers: [
      { id: 'layer-marcos', name: 'Marcos & Piquetes', color: '#00E08A', visible: true, opacity: 1, locked: false },
      { id: 'layer-poligonal', name: 'Poligonal de Apoio', color: '#3b82f6', visible: true, opacity: 0.9, locked: false },
      { id: 'layer-confrontantes', name: 'Confrontações & Limites', color: '#ef4444', visible: true, opacity: 0.8, locked: false }
    ]
  },
  {
    id: 'template-ambiental',
    title: 'Gestão Ambiental & CAR',
    icon: '🌳',
    badge: 'Florestal',
    description: 'Focado em Cadastro Ambiental Rural, nascentes, matas ciliares, áreas antropizadas e Reserva Legal.',
    center: [-15.7942, -47.8822],
    zoom: 13,
    layers: [
      { id: 'layer-app', name: 'Áreas de Preservação (APP)', color: '#10b981', visible: true, opacity: 0.75, locked: false },
      { id: 'layer-hidro', name: 'Nascentes e Cursos d’Água', color: '#06b6d4', visible: true, opacity: 1, locked: false },
      { id: 'layer-antropica', name: 'Uso Consolidado do Solo', color: '#f59e0b', visible: true, opacity: 0.6, locked: false }
    ]
  },
  {
    id: 'template-urbano',
    title: 'Planejamento Urbano & Lotes',
    icon: '🏙️',
    badge: 'Zoneamento',
    description: 'Estruturado para delimitação de quadras, arruamento, faixas de servidão e equipamentos públicos.',
    center: [-15.7942, -47.8822],
    zoom: 15,
    layers: [
      { id: 'layer-lotes', name: 'Lotes e Quadras', color: '#3b82f6', visible: true, opacity: 0.7, locked: false },
      { id: 'layer-vias', name: 'Malha Viária', color: '#f97316', visible: true, opacity: 1, locked: false },
      { id: 'layer-equipamentos', name: 'Equipamentos Comunitários', color: '#a855f7', visible: true, opacity: 1, locked: false }
    ]
  }
];
