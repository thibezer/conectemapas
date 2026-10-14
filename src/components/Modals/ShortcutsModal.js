/* ==========================================================================
   ConecteMapas - ShortcutsModal Component (SRP Module)
   Responsabilidade Única: Exibição do guia visual interativo de atalhos
   de teclado, ferramentas CAD, comandos geométricos e navegação rápida.
   ========================================================================== */

import './ShortcutsModal.css';

export class ShortcutsModal {
  constructor() {
    this.container = null;
  }

  /**
   * Renderiza o modal de atalhos no container fornecido
   * @param {HTMLElement} container
   */
  render(container) {
    this.container = container;
    this.container.innerHTML = `
      <ui-modal id="modal-shortcuts" titulo="⌨️ Atalhos de Teclado & Comandos CAD">
        <div class="cm-shortcuts-container">
          <p class="cm-shortcuts-subtitle">
            Aumente sua produtividade cartográfica com os comandos de teclado rápidos do ConecteMapas:
          </p>

          <div class="cm-shortcuts-grid">
            <!-- Coluna 1: Ferramentas CAD -->
            <div class="cm-shortcuts-card">
              <div class="cm-shortcuts-card-header">
                <span class="cm-shortcuts-card-icon">📐</span>
                <span class="cm-shortcuts-card-title">Ferramentas CAD</span>
              </div>
              <ul class="cm-shortcuts-list">
                <li><span class="cm-shortcut-desc">Seleção Padrão</span><kbd>V</kbd></li>
                <li><span class="cm-shortcut-desc">Seleção por Laço/Vetor</span><kbd>Q</kbd></li>
                <li><span class="cm-shortcut-desc">Ponto / Vértice</span><kbd>P</kbd></li>
                <li><span class="cm-shortcut-desc">Linha / Polilinha</span><kbd>L</kbd></li>
                <li><span class="cm-shortcut-desc">Polígono / Área</span><kbd>A</kbd></li>
                <li><span class="cm-shortcut-desc">Círculo Geodésico</span><kbd>C</kbd></li>
                <li><span class="cm-shortcut-desc">Retângulo / Quadra</span><kbd>R</kbd></li>
                <li><span class="cm-shortcut-desc">Medição de Distância/Área</span><kbd>M</kbd></li>
                <li><span class="cm-shortcut-desc">Rótulo de Texto</span><kbd>T</kbd></li>
                <li><span class="cm-shortcut-desc">Conta-gotas de Estilos</span><kbd>I</kbd></li>
                <li><span class="cm-shortcut-desc">Faca / Divisão de Feição</span><kbd>K</kbd></li>
                <li><span class="cm-shortcut-desc">Snap Magnético (Ímã)</span><kbd>S</kbd></li>
                <li><span class="cm-shortcut-desc">Alternar Preenchimento/Traço</span><kbd>X</kbd></li>
                <li><span class="cm-shortcut-desc">Inverter Cores</span><kbd>Shift + X</kbd></li>
                <li><span class="cm-shortcut-desc">Cor Transparente (None)</span><kbd>/</kbd></li>
              </ul>
            </div>

            <!-- Coluna 2: Edição & Geometria -->
            <div class="cm-shortcuts-card">
              <div class="cm-shortcuts-card-header">
                <span class="cm-shortcuts-card-icon">⚡</span>
                <span class="cm-shortcuts-card-title">Edição & Histórico</span>
              </div>
              <ul class="cm-shortcuts-list">
                <li><span class="cm-shortcut-desc">Concluir Desenho</span><kbd>Enter</kbd></li>
                <li><span class="cm-shortcut-desc">Cancelar / Limpar Seleção</span><kbd>Esc</kbd></li>
                <li><span class="cm-shortcut-desc">Desfazer Vértice ou Ação</span><kbd>Ctrl + Z</kbd></li>
                <li><span class="cm-shortcut-desc">Refazer Ação</span><kbd>Ctrl + Y</kbd></li>
                <li><span class="cm-shortcut-desc">Excluir Vértice ou Feições</span><kbd>Delete</kbd></li>
                <li><span class="cm-shortcut-desc">Unir Formas Conectadas</span><kbd>J</kbd></li>
                <li><span class="cm-shortcut-desc">Unir com Ponte Geodésica</span><kbd>Shift + J</kbd></li>
                <li><span class="cm-shortcut-desc">Próxima Feição</span><kbd>↓</kbd></li>
                <li><span class="cm-shortcut-desc">Feição Anterior</span><kbd>↑</kbd></li>
              </ul>
            </div>

            <!-- Coluna 3: Navegação & Projeto -->
            <div class="cm-shortcuts-card">
              <div class="cm-shortcuts-card-header">
                <span class="cm-shortcuts-card-icon">🌐</span>
                <span class="cm-shortcuts-card-title">Navegação & Projeto</span>
              </div>
              <ul class="cm-shortcuts-list">
                <li><span class="cm-shortcut-desc">Salvar no Banco / Nuvem</span><kbd>Ctrl + S</kbd></li>
                <li><span class="cm-shortcut-desc">Selecionar Todas as Feições</span><kbd>Ctrl + A</kbd></li>
                <li><span class="cm-shortcut-desc">Busca Avançada em Lote</span><kbd>Ctrl + Shift + F</kbd></li>
                <li><span class="cm-shortcut-desc">Buscar na Tabela de Atributos</span><kbd>Ctrl + K</kbd></li>
                <li><span class="cm-shortcut-desc">Alternar Tela Cheia</span><kbd>F11</kbd></li>
                <li><span class="cm-shortcut-desc">Abrir este Guia de Atalhos</span><kbd>?</kbd> ou <kbd>F1</kbd></li>
              </ul>
            </div>
          </div>

          <div class="cm-shortcuts-footer">
            <span class="cm-shortcuts-hint">Dica: Os atalhos simples de desenho funcionam automaticamente enquanto você estiver interagindo com o mapa.</span>
            <ui-botao-primario inline variante="secundario" dismiss-modal style="height: 28px; font-size: 11px;">
              Fechar
            </ui-botao-primario>
          </div>
        </div>
      </ui-modal>
    `;
  }
}
