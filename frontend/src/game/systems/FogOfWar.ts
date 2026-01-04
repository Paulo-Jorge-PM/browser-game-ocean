import { Container, Graphics } from 'pixi.js';

interface FogConfig {
  cellSize: number;
  gridWidth: number;
  gridHeight: number;
  fadeRows: number; // Number of rows for the fade gradient
}

/**
 * FogOfWar system that obscures unexplored depths
 * - Draws dark overlay on cells beyond max visible depth
 * - Gradient fade from visible to fog
 * - Updates based on player progression
 */
export class FogOfWar {
  private container: Container;
  private fogGraphics: Graphics;
  private gradientGraphics: Graphics;
  private config: FogConfig;
  private currentMaxVisible: number = 0;

  private readonly FOG_COLOR = 0x000510;
  private readonly FOG_ALPHA = 0.95;

  constructor(parent: Container, config: FogConfig) {
    this.container = new Container();
    this.config = config;

    // Gradient layer (drawn first, behind solid fog)
    this.gradientGraphics = new Graphics();
    this.gradientGraphics.eventMode = 'none'; // Don't block clicks
    this.container.addChild(this.gradientGraphics);

    // Solid fog layer
    this.fogGraphics = new Graphics();
    this.fogGraphics.eventMode = 'none'; // Don't block clicks
    this.container.addChild(this.fogGraphics);

    parent.addChild(this.container);
  }

  /**
   * Update the fog based on current max visible depth
   */
  public update(maxVisibleDepth: number): void {
    // Only redraw if visibility changed
    if (maxVisibleDepth === this.currentMaxVisible) return;

    this.currentMaxVisible = maxVisibleDepth;
    this.drawFog();
  }

  /**
   * Draw the fog of war overlay
   */
  private drawFog(): void {
    const { cellSize, gridWidth, gridHeight, fadeRows } = this.config;
    const fogStartRow = this.currentMaxVisible + 1;

    // Clear previous drawings
    this.fogGraphics.clear();
    this.gradientGraphics.clear();

    // If fog starts beyond grid, nothing to draw
    if (fogStartRow >= gridHeight) return;

    // Draw gradient fade (transition zone)
    const gradientStartRow = Math.max(0, fogStartRow - fadeRows);
    for (let row = gradientStartRow; row < fogStartRow; row++) {
      const progress = (row - gradientStartRow) / fadeRows;
      const alpha = progress * this.FOG_ALPHA * 0.7; // Fade up to 70% of full fog

      this.gradientGraphics.rect(
        0,
        row * cellSize,
        gridWidth * cellSize,
        cellSize
      );
      this.gradientGraphics.fill({ color: this.FOG_COLOR, alpha });
    }

    // Draw solid fog for unexplored area
    if (fogStartRow < gridHeight) {
      const fogHeight = (gridHeight - fogStartRow) * cellSize;

      this.fogGraphics.rect(
        0,
        fogStartRow * cellSize,
        gridWidth * cellSize,
        fogHeight
      );
      this.fogGraphics.fill({ color: this.FOG_COLOR, alpha: this.FOG_ALPHA });

      // Add some visual interest - subtle patterns
      this.drawFogPattern(fogStartRow);
    }
  }

  /**
   * Draw subtle patterns in the fog for visual interest
   */
  private drawFogPattern(startRow: number): void {
    const { cellSize, gridWidth, gridHeight } = this.config;

    // Draw mysterious glows in the depths
    const glowCount = Math.min(5, gridHeight - startRow);
    for (let i = 0; i < glowCount; i++) {
      const row = startRow + 2 + i * 2;
      if (row >= gridHeight) break;

      const x = (Math.sin(row * 1.5) * 0.5 + 0.5) * gridWidth * cellSize;
      const y = row * cellSize + cellSize / 2;

      // Outer glow
      this.fogGraphics.circle(x, y, 30);
      this.fogGraphics.fill({ color: 0x001530, alpha: 0.3 });

      // Inner glow
      this.fogGraphics.circle(x, y, 15);
      this.fogGraphics.fill({ color: 0x002050, alpha: 0.4 });
    }

    // Add "undiscovered" visual hint at the fog edge
    const edgeY = startRow * cellSize - 5;
    for (let x = 0; x < gridWidth * cellSize; x += 40) {
      const waveOffset = Math.sin(x * 0.05) * 3;
      this.fogGraphics.circle(x, edgeY + waveOffset, 2);
      this.fogGraphics.fill({ color: 0x003366, alpha: 0.5 });
    }
  }

  /**
   * Force redraw (e.g., after configuration change)
   */
  public forceRedraw(): void {
    const current = this.currentMaxVisible;
    this.currentMaxVisible = -1; // Reset to force update
    this.update(current);
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<FogConfig>): void {
    this.config = { ...this.config, ...config };
    this.forceRedraw();
  }

  /**
   * Get the current max visible depth
   */
  public getMaxVisibleDepth(): number {
    return this.currentMaxVisible;
  }

  /**
   * Clean up resources
   */
  public destroy(): void {
    this.fogGraphics.destroy();
    this.gradientGraphics.destroy();
    this.container.destroy();
  }
}
