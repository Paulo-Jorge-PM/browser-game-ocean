import { useEffect, useRef, useCallback } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useGameStore } from '../../stores/gameStore';
import { BASE_DEFINITIONS } from '../constants/bases';
import { WorkerManager } from '../entities/Worker';
import { StructureManager } from '../entities/Structure';
import { BubbleSystem } from '../systems/Bubbles';
import { WaveSystem } from '../systems/WaveSystem';
import { CloudSystem } from '../systems/CloudSystem';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { SpriteManager } from '../rendering/SpriteManager';
import { ViewportController } from './ViewportController';
import { FogOfWar } from '../systems/FogOfWar';

const CELL_SIZE = 64;
const GRID_PADDING = 40;
const TOP_BAR_HEIGHT = 48; // ResourceBar height
const BOTTOM_PANEL_HEIGHT = 208; // BottomPanel height (h-52 = 13rem = 208px)
const SKY_HEIGHT = 60; // Height of sky area above water

// Colors
const COLORS = {
  gridLine: 0x1a4a7a,
  cellUnlocked: 0x0f2847,
  cellLocked: 0x080c14,
  cellSelected: 0x00d4ff,
  cellBuildable: 0x00aa66,
  cellHover: 0x2a6a9a,
  surface: 0x00d4ff,
  construction: 0xffaa00,
};

// Interface for tracking construction progress bars
interface ConstructionBarRef {
  container: Container;
  progressBar: Graphics;
  progressText: Text;
  baseId: string;
}

export function GameCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const gridContainerRef = useRef<Container | null>(null);
  const workerManagerRef = useRef<WorkerManager | null>(null);
  const structureManagerRef = useRef<StructureManager | null>(null);
  const spriteManagerRef = useRef<SpriteManager | null>(null);
  const bubbleSystemRef = useRef<BubbleSystem | null>(null);
  const waveSystemRef = useRef<WaveSystem | null>(null);
  const cloudSystemRef = useRef<CloudSystem | null>(null);
  const parallaxRef = useRef<ParallaxBackground | null>(null);
  const viewportRef = useRef<ViewportController | null>(null);
  const fogOfWarRef = useRef<FogOfWar | null>(null);
  const lastTimeRef = useRef<number>(0);
  const gridOffsetRef = useRef({ x: 0, y: 0 });
  const constructionBarsRef = useRef<Map<string, ConstructionBarRef>>(new Map());

  const { grid, gridWidth, gridHeight, ui, selectCell, getBuildableCells } = useGameStore();

  const centerGrid = useCallback((app: Application) => {
    const gridPixelWidth = gridWidth * CELL_SIZE;

    // Center horizontally, position from top with padding
    // Account for: top bar (48px) + gap + surface label (25px)
    const offsetX = Math.max(GRID_PADDING, (app.screen.width - gridPixelWidth) / 2);
    const offsetY = TOP_BAR_HEIGHT + 30; // 48px top bar + 30px for surface label

    gridOffsetRef.current = { x: offsetX, y: offsetY };

    if (gridContainerRef.current) {
      gridContainerRef.current.x = offsetX;
      gridContainerRef.current.y = offsetY;
    }
  }, [gridWidth, gridHeight]);

  const drawGrid = useCallback(() => {
    if (!gridContainerRef.current || !workerManagerRef.current) return;

    const gridContainer = gridContainerRef.current;
    const workerManager = workerManagerRef.current;
    const structureManager = structureManagerRef.current;
    const spriteManager = spriteManagerRef.current;

    // Clear everything
    gridContainer.removeChildren();
    workerManager.clear();
    structureManager?.clear();
    constructionBarsRef.current.clear();

    // Get buildable cells for highlighting
    const buildableCells = getBuildableCells();
    const buildableSet = new Set(buildableCells.map(p => `${p.x},${p.y}`));

    // Draw sky background gradient (above the grid)
    const skyBg = new Graphics();
    skyBg.eventMode = 'none'; // Don't block clicks
    // Sky gradient from lighter blue at top to darker near surface
    for (let i = 0; i < SKY_HEIGHT; i += 10) {
      const gradientProgress = i / SKY_HEIGHT;
      const skyColor = 0x1a3050 + Math.floor(gradientProgress * 0x203040);
      skyBg.rect(-GRID_PADDING, -SKY_HEIGHT + i, gridWidth * CELL_SIZE + GRID_PADDING * 2, 10);
      skyBg.fill({ color: skyColor, alpha: 0.8 - gradientProgress * 0.3 });
    }
    gridContainer.addChild(skyBg);

    // Draw ocean background gradient effect
    const oceanBg = new Graphics();
    oceanBg.eventMode = 'none'; // Don't block clicks
    for (let y = 0; y < gridHeight; y++) {
      const alpha = 0.15 + (y / gridHeight) * 0.2;
      oceanBg.rect(0, y * CELL_SIZE, gridWidth * CELL_SIZE, CELL_SIZE);
      oceanBg.fill({ color: 0x001830, alpha });
    }
    gridContainer.addChild(oceanBg);

    // Draw cells
    for (let y = 0; y < gridHeight; y++) {
      for (let x = 0; x < gridWidth; x++) {
        const cell = grid[y]?.[x];
        if (!cell) continue;

        const cellContainer = new Container();
        cellContainer.x = x * CELL_SIZE;
        cellContainer.y = y * CELL_SIZE;

        const cellGraphics = new Graphics();
        const isSelected = ui.selectedCell?.x === x && ui.selectedCell?.y === y;
        const isBuildable = buildableSet.has(`${x},${y}`);

        // Depth-based darkening
        const depthFactor = 1 - (y * 0.025);

        // Determine cell appearance
        let fillColor = COLORS.cellLocked;
        let fillAlpha = 0.2;
        let strokeColor = COLORS.gridLine;
        let strokeWidth = 1;
        let strokeAlpha = 0.3;

        if (cell.isUnlocked) {
          fillColor = COLORS.cellUnlocked;
          fillAlpha = 0.4;
          strokeAlpha = 0.5;
        }

        if (isBuildable && !cell.base) {
          fillColor = COLORS.cellBuildable;
          fillAlpha = 0.25;
          strokeColor = COLORS.cellBuildable;
          strokeAlpha = 0.6;
        }

        if (cell.base) {
          const baseDef = BASE_DEFINITIONS[cell.base.type];
          fillColor = baseDef?.color || 0x444444;
          fillAlpha = cell.base.isOperational ? 0.7 : 0.4;
          strokeAlpha = 0.7;
        }

        if (isSelected) {
          strokeColor = COLORS.cellSelected;
          strokeWidth = 2;
          strokeAlpha = 1;
        }

        // Draw cell background
        cellGraphics.roundRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
        cellGraphics.fill({ color: fillColor, alpha: fillAlpha * depthFactor });
        cellGraphics.stroke({ color: strokeColor, width: strokeWidth, alpha: strokeAlpha });

        // Make interactive
        cellGraphics.eventMode = 'static';
        cellGraphics.cursor = cell.isUnlocked ? 'pointer' : 'default';

        const cellX = x;
        const cellY = y;

        cellGraphics.on('pointerdown', () => {
          selectCell({ x: cellX, y: cellY });
        });

        cellGraphics.on('pointerover', () => {
          if (!isSelected && cell.isUnlocked) {
            cellGraphics.clear();
            cellGraphics.roundRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
            cellGraphics.fill({ color: COLORS.cellHover, alpha: 0.5 });
            cellGraphics.stroke({ color: COLORS.cellHover, width: 1, alpha: 0.8 });
          }
        });

        cellGraphics.on('pointerout', () => {
          if (!isSelected) {
            cellGraphics.clear();
            let color = cell.isUnlocked ? COLORS.cellUnlocked : COLORS.cellLocked;
            let alpha = cell.isUnlocked ? 0.4 : 0.2;

            if (isBuildable && !cell.base) {
              color = COLORS.cellBuildable;
              alpha = 0.25;
            }

            if (cell.base) {
              const baseDef = BASE_DEFINITIONS[cell.base.type];
              color = baseDef?.color || 0x444444;
              alpha = cell.base.isOperational ? 0.7 : 0.4;
            }

            cellGraphics.roundRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
            cellGraphics.fill({ color, alpha: alpha * depthFactor });
            cellGraphics.stroke({
              color: isBuildable && !cell.base ? COLORS.cellBuildable : COLORS.gridLine,
              width: 1,
              alpha: isBuildable && !cell.base ? 0.6 : 0.3,
            });
          }
        });

        cellContainer.addChild(cellGraphics);

        // Draw base content
        if (cell.base) {
          const baseDef = BASE_DEFINITIONS[cell.base.type];

          // Draw construction progress if not operational
          if (!cell.base.isOperational) {
            // Create a container for construction UI
            const constructionContainer = new Container();

            // Show construction sprite behind progress UI
            if (spriteManager && spriteManager.isLoaded()) {
              const constSprite = spriteManager.createSprite(cell.base.type, true);
              if (constSprite) {
                constSprite.x = 4;
                constSprite.y = 4;
                constructionContainer.addChild(constSprite);
              }
            }

            const progressBg = new Graphics();
            progressBg.rect(4, CELL_SIZE - 12, CELL_SIZE - 8, 8);
            progressBg.fill({ color: 0x000000, alpha: 0.5 });
            constructionContainer.addChild(progressBg);

            // Create progress bar with full width, use scaleX for animation
            const progressBar = new Graphics();
            progressBar.rect(0, 0, CELL_SIZE - 8, 8);
            progressBar.fill({ color: COLORS.construction, alpha: 0.9 });
            progressBar.x = 4;
            progressBar.y = CELL_SIZE - 12;
            progressBar.scale.x = cell.base.constructionProgress / 100;
            constructionContainer.addChild(progressBar);

            // Construction icon
            const constIcon = new Text({
              text: '🔨',
              style: new TextStyle({ fontSize: 16 }),
            });
            constIcon.x = CELL_SIZE / 2 - constIcon.width / 2;
            constIcon.y = 4;
            constructionContainer.addChild(constIcon);

            // Progress text
            const progressText = new Text({
              text: `${Math.floor(cell.base.constructionProgress)}%`,
              style: new TextStyle({ fontSize: 10, fill: 0xffffff }),
            });
            progressText.x = CELL_SIZE / 2 - progressText.width / 2;
            progressText.y = CELL_SIZE / 2 - 5;
            constructionContainer.addChild(progressText);

            cellContainer.addChild(constructionContainer);

            // Store ref for ticker-based updates
            constructionBarsRef.current.set(cell.base.id, {
              container: constructionContainer,
              progressBar,
              progressText,
              baseId: cell.base.id,
            });
          } else {
            // Operational base - show sprite
            let spriteAdded = false;
            if (spriteManager && spriteManager.isLoaded()) {
              const sprite = spriteManager.createSprite(cell.base.type, false);
              if (sprite) {
                // Add sprite directly to cellContainer for proper positioning
                sprite.x = 4;
                sprite.y = 4;
                cellContainer.addChild(sprite);
                spriteAdded = true;
              }
            }

            // Fallback to emoji if sprite not available
            if (!spriteAdded) {
              const icon = new Text({
                text: baseDef?.icon || '?',
                style: new TextStyle({ fontSize: 28 }),
              });
              icon.x = CELL_SIZE / 2 - icon.width / 2;
              icon.y = CELL_SIZE / 2 - icon.height / 2 - 2;
              cellContainer.addChild(icon);
            }

            // Add workers
            if (cell.base.workers > 0) {
              workerManager.addWorkersForBase(
                cell.base.id,
                x * CELL_SIZE,
                y * CELL_SIZE,
                CELL_SIZE,
                Math.min(cell.base.workers, 4),
                baseDef?.color || 0x00ff88
              );
            }
          }
        }

        gridContainer.addChild(cellContainer);
      }
    }

    // Draw depth labels on left
    for (let y = 0; y < gridHeight; y++) {
      const depthLabel = new Text({
        text: `${y * 10}m`,
        style: new TextStyle({
          fontSize: 10,
          fill: 0x446688,
          fontFamily: 'monospace',
        }),
      });
      depthLabel.x = -30;
      depthLabel.y = y * CELL_SIZE + CELL_SIZE / 2 - depthLabel.height / 2;
      gridContainer.addChild(depthLabel);
    }

    // Draw surface line with glow
    const surfaceGlow = new Graphics();
    surfaceGlow.eventMode = 'none'; // Don't block clicks
    surfaceGlow.rect(-5, -3, gridWidth * CELL_SIZE + 10, 6);
    surfaceGlow.fill({ color: COLORS.surface, alpha: 0.2 });
    gridContainer.addChild(surfaceGlow);

    const surfaceLine = new Graphics();
    surfaceLine.eventMode = 'none'; // Don't block clicks
    surfaceLine.moveTo(-5, 0);
    surfaceLine.lineTo(gridWidth * CELL_SIZE + 5, 0);
    surfaceLine.stroke({ color: COLORS.surface, width: 2, alpha: 0.8 });
    gridContainer.addChild(surfaceLine);

    // Surface label
    const surfaceLabel = new Text({
      text: '~ OCEAN SURFACE ~',
      style: new TextStyle({
        fontSize: 11,
        fill: COLORS.surface,
        fontFamily: 'monospace',
      }),
    });
    surfaceLabel.x = (gridWidth * CELL_SIZE) / 2 - surfaceLabel.width / 2;
    surfaceLabel.y = -18;
    gridContainer.addChild(surfaceLabel);
  }, [grid, gridWidth, gridHeight, ui.selectedCell, selectCell, getBuildableCells]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Prevent double initialization (React StrictMode)
    if (appRef.current) return;

    // Clear any existing canvases from previous renders
    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }

    let destroyed = false; // Track if cleanup was called during async init

    const initApp = async () => {
      const app = new Application();
      await app.init({
        background: 0x050a12,
        resizeTo: containerRef.current!,
        antialias: true,
      });

      // If cleanup was called during init, destroy immediately
      if (destroyed) {
        app.destroy(true);
        return;
      }

      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;

      // Calculate grid position for visual effect systems
      const gridPixelWidth = 10 * CELL_SIZE; // gridWidth
      const offsetY = TOP_BAR_HEIGHT + 30;

      // === LAYER ORDER: First added = drawn behind, Last added = drawn on top ===

      // 1. Parallax background (far behind - drawn first)
      const parallax = new ParallaxBackground(
        app.stage,
        app.screen.width,
        app.screen.height
      );
      parallaxRef.current = parallax;

      // 2. Cloud system in sky area
      const cloudSystem = new CloudSystem(
        app.stage,
        app.screen.width,
        offsetY - 10
      );
      cloudSystemRef.current = cloudSystem;

      // 3. Bubble system (bubbles in water area)
      const bubbleSystem = new BubbleSystem(
        app.stage,
        app.screen.width,
        app.screen.height
      );
      bubbleSystemRef.current = bubbleSystem;

      // 4. Grid container - THE MAIN GAME LAYER (on top so it's visible)
      const gridContainer = new Container();
      app.stage.addChild(gridContainer);
      gridContainerRef.current = gridContainer;

      // 5. Wave system at water surface (on top of grid at surface line only)
      const waveSystem = new WaveSystem(
        app.stage,
        gridPixelWidth + GRID_PADDING * 2,
        offsetY
      );
      waveSystemRef.current = waveSystem;

      // Create worker manager (add to grid container so workers move with grid)
      const workerManager = new WorkerManager(gridContainer);
      workerManagerRef.current = workerManager;

      // Create sprite manager and load SVG assets
      const spriteManager = new SpriteManager(CELL_SIZE - 8);
      await spriteManager.loadAssets();
      spriteManagerRef.current = spriteManager;

      // Create structure manager for animated structures
      const structureManager = new StructureManager(gridContainer);
      structureManagerRef.current = structureManager;

      // Create viewport controller for scrolling
      const viewportController = new ViewportController(
        gridContainer,
        {
          cellSize: CELL_SIZE,
          topOffset: offsetY,
          bottomOffset: BOTTOM_PANEL_HEIGHT,
          screenHeight: app.screen.height,
        },
        (offset) => {
          useGameStore.getState().setScrollOffset(offset);
        }
      );
      viewportRef.current = viewportController;

      // Calculate visible rows and set in store
      const visibleHeight = app.screen.height - offsetY - BOTTOM_PANEL_HEIGHT;
      const visibleRows = Math.ceil(visibleHeight / CELL_SIZE);
      useGameStore.getState().setVisibleRowCount(visibleRows);

      // Create fog of war system (added to grid container so it scrolls with grid)
      const { gridWidth: gw, gridHeight: gh, maxVisibleDepth: mvd } = useGameStore.getState();
      const fogOfWar = new FogOfWar(gridContainer, {
        cellSize: CELL_SIZE,
        gridWidth: gw,
        gridHeight: gh,
        fadeRows: 3,
      });
      fogOfWar.update(mvd);
      fogOfWarRef.current = fogOfWar;

      // Center the grid
      centerGrid(app);

      // Initial draw
      drawGrid();

      // Animation loop
      lastTimeRef.current = performance.now();
      app.ticker.add(() => {
        const now = performance.now();
        const deltaMs = now - lastTimeRef.current;
        lastTimeRef.current = now;

        workerManagerRef.current?.update(deltaMs);
        structureManagerRef.current?.update(deltaMs);
        bubbleSystemRef.current?.update(deltaMs);
        waveSystemRef.current?.update(deltaMs);
        cloudSystemRef.current?.update(deltaMs);
        parallaxRef.current?.update(deltaMs);

        // Update viewport scrolling
        const { maxVisibleDepth, visibleRowCount } = useGameStore.getState();
        if (viewportRef.current) {
          const maxScroll = viewportRef.current.calculateMaxScroll(maxVisibleDepth, visibleRowCount);
          viewportRef.current.update(maxScroll);
        }

        // Update fog of war
        fogOfWarRef.current?.update(maxVisibleDepth);

        // Update construction progress bars in real-time
        const { constructionQueue } = useGameStore.getState();
        const currentTime = Date.now();

        constructionBarsRef.current.forEach((barRef, baseId) => {
          const construction = constructionQueue.get(baseId);
          if (construction) {
            const elapsed = currentTime - construction.startTime;
            const total = construction.endTime - construction.startTime;
            const progress = Math.min(100, (elapsed / total) * 100);

            // Update progress bar scale
            barRef.progressBar.scale.x = progress / 100;

            // Update progress text
            barRef.progressText.text = `${Math.floor(progress)}%`;
            // Re-center text
            barRef.progressText.x = CELL_SIZE / 2 - barRef.progressText.width / 2;
          }
        });
      });

      // Handle resize
      const handleResize = () => {
        if (appRef.current) {
          centerGrid(appRef.current);
          bubbleSystemRef.current?.resize(app.screen.width, app.screen.height);
          viewportRef.current?.updateConfig({
            screenHeight: app.screen.height,
          });
          const visHeight = app.screen.height - offsetY - BOTTOM_PANEL_HEIGHT;
          const visRows = Math.ceil(visHeight / CELL_SIZE);
          useGameStore.getState().setVisibleRowCount(visRows);
        }
      };
      window.addEventListener('resize', handleResize);

      // Handle mouse wheel scrolling
      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        if (viewportRef.current) {
          const { maxVisibleDepth: maxDepth, visibleRowCount: rowCount } = useGameStore.getState();
          const maxScroll = viewportRef.current.calculateMaxScroll(maxDepth, rowCount);
          viewportRef.current.handleWheel(e.deltaY, maxScroll);
        }
      };
      app.canvas.addEventListener('wheel', handleWheel, { passive: false });

      // Handle touch/mouse drag scrolling
      const handlePointerDown = (e: PointerEvent) => {
        if (e.pointerType === 'touch' || e.button === 1) { // Touch or middle mouse
          viewportRef.current?.handleDragStart(e.clientY);
        }
      };
      const handlePointerMove = (e: PointerEvent) => {
        if (viewportRef.current) {
          const { maxVisibleDepth: maxDepth, visibleRowCount: rowCount } = useGameStore.getState();
          const maxScroll = viewportRef.current.calculateMaxScroll(maxDepth, rowCount);
          viewportRef.current.handleDragMove(e.clientY, maxScroll);
        }
      };
      const handlePointerUp = () => {
        viewportRef.current?.handleDragEnd();
      };
      app.canvas.addEventListener('pointerdown', handlePointerDown);
      app.canvas.addEventListener('pointermove', handlePointerMove);
      app.canvas.addEventListener('pointerup', handlePointerUp);
      app.canvas.addEventListener('pointerleave', handlePointerUp);

      return () => {
        window.removeEventListener('resize', handleResize);
        app.canvas.removeEventListener('wheel', handleWheel);
        app.canvas.removeEventListener('pointerdown', handlePointerDown);
        app.canvas.removeEventListener('pointermove', handlePointerMove);
        app.canvas.removeEventListener('pointerup', handlePointerUp);
        app.canvas.removeEventListener('pointerleave', handlePointerUp);
      };
    };

    initApp();

    return () => {
      destroyed = true; // Signal to async init that cleanup happened

      bubbleSystemRef.current?.destroy();
      waveSystemRef.current?.destroy();
      cloudSystemRef.current?.destroy();
      parallaxRef.current?.destroy();
      fogOfWarRef.current?.destroy();
      structureManagerRef.current?.destroy();
      spriteManagerRef.current?.destroy();
      workerManagerRef.current?.clear();

      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
      }

      // Remove any remaining canvases from the container
      if (containerRef.current) {
        while (containerRef.current.firstChild) {
          containerRef.current.removeChild(containerRef.current.firstChild);
        }
      }
    };
  }, [centerGrid]);

  // Redraw when state changes
  useEffect(() => {
    drawGrid();
  }, [drawGrid]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}
