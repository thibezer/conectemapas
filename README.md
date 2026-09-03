# 🗺️ ConecteMapas
> Plataforma Colaborativa de Mapeamento, Engenharia Cartográfica e Topografia Web.

Construído sobre **Leaflet**, **Vanilla JS/CSS**, **Web Components (`ui-components-kit`)** e **Vite**, o **ConecteMapas** é uma estação de trabalho GIS (Workbench) profissional projetada para alta densidade de dados, agrimensura (SIGEF/INCRA) e geração de plantas técnicas nos padrões ABNT.

---

## 🚀 Principais Módulos & Recursos

### 1. 📐 Compositor de Pranchas Técnicas (`PrintComposer`)
* **Geração de Plantas Cartográficas (A4, A3, A2, A1)** em escala 1:1.
* **Tabela de Vértices Topográfica:** Cálculo automático de coordenadas Norte/Leste em **SIRGAS 2000 UTM** via `proj4`, azimutes topográficos ($DD^\circ MM' SS''$), distâncias perimétricas e áreas em hectares ($ha$) e $m^2$.
* **Selo / Carimbo ABNT (NBR 13133 / 6492):** Campos de engenharia, ART/CREA, escala numérica/gráfica e cálculo automático de área e perímetro.
* **Grade Cartográfica Real:** Cruzetas internas de interseção ($+$) e coordenadas Geográficas (DMS) ou Métricas UTM.
* **Motor de Exportação em 300 DPI:** Renderização vetorial nativa subpixel no Canvas final com salvaguarda de memória GPU e tolerância a CORS.

### 2. ⚡ Performance & Motor de Renderização (`MapEngine`)
* **Marker Clustering:** Agrupamento dinâmico de marcadores pontuais por proximidade e escala na tela, evitando sobrecarga visual com milhares de pins.
* **Spatial Index (R-Tree) & Viewport Culling:** Renderização exclusiva das geometrias contidas na janela de visualização atual.
* **LOD Dinâmico (Douglas-Peucker):** Simplificação de vértices em escalas distantes via Web Worker.
* **Otimização QGIS no Parser SHP:** Compilação única do pipeline `proj4` por camada/arquivo e avaliação lazy de popups sob demanda.

### 3. 📂 Importação & Exportação Multiformato
* **Entrada:** `.shp` (Shapefile em ZIP completo com `.shp`, `.dbf`, `.prj`, `.cpg`, `.shx`), GeoJSON, KML, CSV e DXF.
* **Saída:** Shapefile (ZIP), GeoJSON, KML, CSV, DXF, PNG de alta definição e PDF técnico milimétrico via `jsPDF`.

### 4. 🗄️ Persistência Híbrida Inteligente (`StorageService`)
* **LocalStorage:** Boot instantâneo síncrono para manifestos leves.
* **IndexedDB:** Persistência assíncrona com capacidade para múltiplos gigabytes de dados vetoriais.
* **Debounce:** Prevenção de I/O thrashing durante edições contínuas de vértices.

---

## ⌨️ Atalhos de Teclado Úteis

| Atalho | Ação |
| :--- | :--- |
| <kbd>Ctrl</kbd> + <kbd>Z</kbd> | Desfazer vértice (durante desenho) ou última feição criada |
| <kbd>Ctrl</kbd> + <kbd>Y</kbd> / <kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd> | Refazer ação |
| <kbd>Ctrl</kbd> + <kbd>S</kbd> | Salvar projeto localmente |
| <kbd>Ctrl</kbd> + <kbd>K</kbd> | Focar no campo de busca da Tabela de Atributos |
| <kbd>Enter</kbd> / <kbd>Espaço</kbd> | Concluir vetor ou polígono em desenho |
| <kbd>Escape</kbd> | Cancelar ferramenta ativa / desmarcar seleção |
| <kbd>Delete</kbd> / <kbd>Backspace</kbd> | Excluir feição ou item selecionado |

---

## 🛠️ Instalação e Execução

### Pré-requisitos
* Node.js $\ge 18$
* NPM $\ge 9$

### Comandos
```bash
# Instalar dependências
npm install

# Iniciar servidor de desenvolvimento
npm run dev

# Gerar build de produção otimizado
npm run build

# Pré-visualizar build localmente
npm run preview
```

---

## 🏛️ Governança & Arquitetura
Consulte o arquivo [`GEMINI.md`](file:///c:/Users/Thiago/.gemini/antigravity/scratch/conectemapas/GEMINI.md) para detalhes sobre as regras estritas de normalização de coordenadas Leaflet, ciclo de vida de ferramentas CAD e salvaguardas anti-regressão.
