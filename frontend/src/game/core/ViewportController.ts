import { Container } from 'pixi.js';

interface ViewportConfig {
  cellSize: number;
  topOffset: number; // Top bar + padding
  bottomOffset: number; // Bottom panel height
  screenHeight: number;
}

/**
 * Handles viewport scrolling for the game grid
 * - Mouse wheel scrolling
 * - Touch/drag scrolling
 * - Smooth scroll animation
 */
export class ViewportController {
  private gridContainer: Container;
  private config: ViewportConfig;
  private targetScrollOffset: number = 0;
  private currentScrollOffset: number = 0;
  private scrollVelocity: number = 0;
  private isDragging: boolean = false;
  private lastDragY: number = 0;
  private onScrollChange: (offset: number) => void;

  // Scroll physics
  private readonly SCROLL_SPEED = 0.3;
  private readonly DRAG_SENSITIVITY = 1.0;
  private readonly FRICTION = 0.92;
  private readonly MIN_VELOCITY = 0.1;

  constructor(
    gridContainer: Container,
    config: ViewportConfig,
    onScrollChange: (offset: number) => void
  ) {
    this.gridContainer = gridContainer;
    this.config = config;
    this.onScrollChange = onScrollChange;
  }

  /**
   * Handle mouse wheel scroll
   */
  public handleWheel(deltaY: number, maxScrollOffset: number): void {
    this.targetScrollOffset += deltaY * this.SCROLL_SPEED;
    this.clampScroll(maxScrollOffset);
  }

  /**
   * Handle drag start (touch or mouse)
   */
  public handleDragStart(y: number): void {
    this.isDragging = true;
    this.lastDragY = y;
    this.scrollVelocity = 0;
  }

  /**
   * Handle drag move
   */
  public handleDragMove(y: number, maxScrollOffset: number): void {
    if (!this.isDragging) return;

    const deltaY = (this.lastDragY - y) * this.DRAG_SENSITIVITY;
    this.targetScrollOffset += deltaY;
    this.scrollVelocity = deltaY;
    this.lastDragY = y;

    this.clampScroll(maxScrollOffset);
  }

  /**
   * Handle drag end
   */
  public handleDragEnd(): void {
    this.isDragging = false;
  }

  /**
   * Clamp scroll to valid range
   */
  private clampScroll(maxScrollOffset: number): void {
    this.targetScrollOffset = Math.max(0, Math.min(this.targetScrollOffset, maxScrollOffset));
  }

  /**
   * Update scroll position with momentum (call every frame)
   */
  public update(maxScrollOffset: number): void {
    // Apply momentum when not dragging
    if (!this.isDragging && Math.abs(this.scrollVelocity) > this.MIN_VELOCITY) {
      this.targetScrollOffset += this.scrollVelocity;
      this.scrollVelocity *= this.FRICTION;
      this.clampScroll(maxScrollOffset);
    } else if (!this.isDragging) {
      this.scrollVelocity = 0;
    }

    // Smooth interpolation to target
    const delta = this.targetScrollOffset - this.currentScrollOffset;
    if (Math.abs(delta) > 0.5) {
      this.currentScrollOffset += delta * 0.15;
      this.applyScroll();
      this.onScrollChange(this.currentScrollOffset);
    } else if (delta !== 0) {
      this.currentScrollOffset = this.targetScrollOffset;
      this.applyScroll();
      this.onScrollChange(this.currentScrollOffset);
    }
  }

  /**
   * Apply scroll offset to grid container
   */
  private applyScroll(): void {
    this.gridContainer.y = this.config.topOffset - this.currentScrollOffset;
  }

  /**
   * Get current scroll offset
   */
  public getScrollOffset(): number {
    return this.currentScrollOffset;
  }

  /**
   * Set scroll offset directly (e.g., from saved state)
   */
  public setScrollOffset(offset: number, maxScrollOffset: number): void {
    this.targetScrollOffset = Math.max(0, Math.min(offset, maxScrollOffset));
    this.currentScrollOffset = this.targetScrollOffset;
    this.applyScroll();
  }

  /**
   * Scroll to show a specific row
   */
  public scrollToRow(row: number, maxScrollOffset: number): void {
    const targetY = row * this.config.cellSize;
    this.targetScrollOffset = Math.max(0, Math.min(targetY, maxScrollOffset));
  }

  /**
   * Get the visible row range
   */
  public getVisibleRowRange(): { start: number; end: number } {
    const visibleHeight = this.config.screenHeight - this.config.topOffset - this.config.bottomOffset;
    const start = Math.floor(this.currentScrollOffset / this.config.cellSize);
    const end = Math.ceil((this.currentScrollOffset + visibleHeight) / this.config.cellSize);
    return { start, end };
  }

  /**
   * Update config (e.g., on resize)
   */
  public updateConfig(config: Partial<ViewportConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Calculate max scroll based on max visible depth
   */
  public calculateMaxScroll(maxVisibleDepth: number, visibleRowCount: number): number {
    const totalRows = maxVisibleDepth + 1;
    const scrollableRows = Math.max(0, totalRows - visibleRowCount + 2);
    return scrollableRows * this.config.cellSize;
  }
}
