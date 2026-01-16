import { useEffect, useRef, useCallback, useMemo } from 'react';
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js';
import { useGameStore } from '../../stores/gameStore';
import { BASE_DEFINITIONS } from '../constants/bases';
import { WorkerManager } from '../entities/Worker';
import { StructureManager } from '../entities/Structure';
import { BubbleSystem } from '../systems/Bubbles';
import { WaveSystem } from '../systems/WaveSystem';
import { SurfaceClouds } from '../systems/SurfaceClouds';
import { SurfaceMountains } from '../systems/SurfaceMountains';
import { ParallaxBackground } from '../systems/ParallaxBackground';
import { SpriteManager } from '../rendering/SpriteManager';
import { ViewportController } from './ViewportController';
import { FogOfWar } from '../systems/FogOfWar';
import { DEFAULT_ABOVE_SURFACE_ROWS } from '../constants/grid';

const CELL_SIZE = 64;
const GRID_PADDING = 40;
const TOP_BAR_HEIGHT = 48; // ResourceBar height
const BOTTOM_PANEL_HEIGHT = 208; // BottomPanel height (h-52 = 13rem = 208px)
const SKY_TOP_PADDING = 24; // Extra sky above the top row for a softer gradient

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
  skyTop: 0xd6f4ff,
  skyBottom: 0x8dc8f0,
  skyHighlight: 0xc7ecff,
  skyHaze: 0xecf9ff,
};

const lerpColor = (from: number, to: number, t: number) => {
  const fromR = (from >> 16) & 0xff;
  const fromG = (from >> 8) & 0xff;
  const fromB = from & 0xff;
  const toR = (to >> 16) & 0xff;
  const toG = (to >> 8) & 0xff;
  const toB = to & 0xff;

  const r = Math.round(fromR + (toR - fromR) * t);
  const g = Math.round(fromG + (toG - fromG) * t);
  const b = Math.round(fromB + (toB - fromB) * t);

  return (r << 16) + (g << 8) + b;
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
  const surfaceCloudsRef = useRef<SurfaceClouds | null>(null);
  const surfaceMountainsRef = useRef<SurfaceMountains | null>(null);
  const parallaxRef = useRef<ParallaxBackground | null>(null);
  const viewportRef = useRef<ViewportController | null>(null);
  const fogOfWarRef = useRef<FogOfWar | null>(null);
  const lastTimeRef = useRef<number>(0);
  const gridOffsetRef = useRef({ x: 0, y: 0 });
  const constructionBarsRef = useRef<Map<string, ConstructionBarRef>>(new Map());

  const { grid, gridWidth, gridHeight, ui, selectCell, getBuildableCells } = useGameStore();

  const surfaceRowIndex = useMemo(() => {
    const topWorldY = grid[0]?.[0]?.position.y;
    if (typeof topWorldY === 'number') {
      return -topWorldY;
    }
    return DEFAULT_ABOVE_SURFACE_ROWS;
  }, [grid]);

  const centerGrid = useCallback((app: Application) => {
    const gridPixelWidth = gridWidth * CELL_SIZE;

    // Center horizontally, position from top with padding
    // Account for: top bar (48px) + gap + surface label (25px)
    const offsetX = Math.max(GRID_PADDING, (app.screen.width - gridPixelWidth) / 2);
    const offsetY = TOP_BAR_HEIGHT + 30; // 48px top bar + 30px for surface label
    const surfaceY = offsetY + surfaceRowIndex * CELL_SIZE;

    gridOffsetRef.current = { x: offsetX, y: offsetY };

    if (gridContainerRef.current) {
      gridContainerRef.current.x = offsetX;
      gridContainerRef.current.y = offsetY;
    }

    waveSystemRef.current?.resize(
      gridPixelWidth,
      surfaceY,
      offsetX
    );
    const skyHeight = Math.max(0, surfaceRowIndex) * CELL_SIZE;
    if (skyHeight > 0) {
      surfaceMountainsRef.current?.resize(
        gridPixelWidth,
        skyHeight,
        offsetX,
        offsetY
      );
    }
    if (surfaceCloudsRef.current) {
      const cloudBandWorldY = surfaceRowIndex >= 2 ? -2 : -1;
      const cloudBandIndex = cloudBandWorldY + surfaceRowIndex;
      const cloudBandY = offsetY + cloudBandIndex * CELL_SIZE;
      surfaceCloudsRef.current.resize(
        gridPixelWidth,
        CELL_SIZE,
        offsetX,
        cloudBandY
      );
    }
  }, [gridWidth, surfaceRowIndex]);

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

    const surfaceRowOffset = surfaceRowIndex * CELL_SIZE;
    const aboveSurfaceRows = Math.max(0, surfaceRowIndex);
    const skyHeight = aboveSurfaceRows * CELL_SIZE;

    // Draw sky background gradient (above the water surface)
    if (skyHeight > 0) {
      const skyBg = new Graphics();
      skyBg.eventMode = 'none'; // Don't block clicks
      const skyStep = 1;
      const totalSkyHeight = skyHeight + SKY_TOP_PADDING;

      for (let i = 0; i <= totalSkyHeight; i += skyStep) {
        const gradientProgress = totalSkyHeight > 0 ? i / totalSkyHeight : 0;
        const skyColor = lerpColor(COLORS.skyTop, COLORS.skyBottom, gradientProgress);
        skyBg.rect(0, -SKY_TOP_PADDING + i, gridWidth * CELL_SIZE, skyStep);
        skyBg.fill({ color: skyColor, alpha: 1 });
      }

      const hazeHeight = Math.min(24, skyHeight);
      if (hazeHeight > 0) {
        for (let i = 0; i <= hazeHeight; i += 2) {
          const hazeAlpha = (1 - i / hazeHeight) * 0.25;
          skyBg.rect(
            0,
            skyHeight - hazeHeight + i,
            gridWidth * CELL_SIZE,
            2
          );
          skyBg.fill({ color: COLORS.skyHaze, alpha: hazeAlpha });
        }
      }

      gridContainer.addChild(skyBg);
    }

    // Draw ocean background gradient effect
    const oceanBg = new Graphics();
    oceanBg.eventMode = 'none'; // Don't block clicks
    const waterRows = Math.max(1, gridHeight - surfaceRowIndex);
    for (let y = surfaceRowIndex; y < gridHeight; y++) {
      const depthIndex = y - surfaceRowIndex;
      const alpha = 0.15 + (depthIndex / waterRows) * 0.2;
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
        const isSelected = ui.selectedCell?.x === cell.position.x && ui.selectedCell?.y === cell.position.y;
        const isAboveSurface = cell.depth < 0;
        const isSkyCell = isAboveSurface && !cell.base;
        const cellKey = `${cell.position.x},${cell.position.y}`;
        const isBuildable = buildableSet.has(cellKey);

        // Depth-based darkening
        const depthIndex = Math.max(0, cell.depth);
        const depthFactor = 1 - (depthIndex * 0.025);

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

        if (isSkyCell) {
          fillColor = COLORS.skyHighlight;
          fillAlpha = 0.02;
          strokeAlpha = 0;
          strokeWidth = 0;
        }

        if (isBuildable && !cell.base && !isSkyCell) {
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

        const drawCell = (
          color: number,
          alpha: number,
          strokeColorValue: number,
          strokeWidthValue: number,
          strokeAlphaValue: number
        ) => {
          if (isSkyCell) {
            cellGraphics.rect(0, 0, CELL_SIZE, CELL_SIZE);
          } else {
            cellGraphics.roundRect(2, 2, CELL_SIZE - 4, CELL_SIZE - 4, 4);
          }
          cellGraphics.fill({ color, alpha });
          if (strokeAlphaValue > 0 && strokeWidthValue > 0) {
            cellGraphics.stroke({
              color: strokeColorValue,
              width: strokeWidthValue,
              alpha: strokeAlphaValue,
            });
          }
        };

        // Draw cell background
        drawCell(
          fillColor,
          fillAlpha * depthFactor,
          strokeColor,
          strokeWidth,
          strokeAlpha
        );

        // Make interactive
        cellGraphics.eventMode = 'static';
        cellGraphics.cursor = cell.isUnlocked ? 'pointer' : 'default';

        const cellX = cell.position.x;
        const cellY = cell.position.y;

        cellGraphics.on('pointerdown', () => {
          selectCell({ x: cellX, y: cellY });
        });

        cellGraphics.on('pointerover', () => {
          if (!isSelected && cell.isUnlocked) {
            cellGraphics.clear();
            if (isSkyCell) {
              drawCell(COLORS.skyHighlight, 0.12, COLORS.skyHighlight, 1, 0.25);
              return;
            }
            drawCell(
              COLORS.cellHover,
              0.5 * depthFactor,
              COLORS.cellHover,
              1,
              0.8
            );
          }
        });

        cellGraphics.on('pointerout', () => {
          if (!isSelected) {
            cellGraphics.clear();
            if (isSkyCell) {
              drawCell(COLORS.skyHighlight, 0.02, COLORS.skyHighlight, 0, 0);
              return;
            }
            let color = cell.isUnlocked ? COLORS.cellUnlocked : COLORS.cellLocked;
            let alpha = cell.isUnlocked ? 0.4 : 0.2;

            if (isBuildable && !cell.base && !isSkyCell) {
              color = COLORS.cellBuildable;
              alpha = 0.25;
            }

            if (cell.base) {
              const baseDef = BASE_DEFINITIONS[cell.base.type];
              color = baseDef?.color || 0x444444;
              alpha = cell.base.isOperational ? 0.7 : 0.4;
            }

            drawCell(
              color,
              alpha * depthFactor,
              isBuildable && !cell.base ? COLORS.cellBuildable : COLORS.gridLine,
              1,
              isBuildable && !cell.base ? 0.6 : 0.3
            );
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
      const rowDepth = grid[y]?.[0]?.depth ?? y - surfaceRowIndex;
      if (rowDepth < 0) continue;
      const depthLabel = new Text({
        text: `${rowDepth * 10}m`,
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
    surfaceGlow.rect(0, surfaceRowOffset - 3, gridWidth * CELL_SIZE, 6);
    surfaceGlow.fill({ color: COLORS.surface, alpha: 0.2 });
    gridContainer.addChild(surfaceGlow);

    const surfaceLine = new Graphics();
    surfaceLine.eventMode = 'none'; // Don't block clicks
    surfaceLine.moveTo(0, surfaceRowOffset);
    surfaceLine.lineTo(gridWidth * CELL_SIZE, surfaceRowOffset);
    surfaceLine.stroke({ color: COLORS.surface, width: 2, alpha: 0.8 });
    gridContainer.addChild(surfaceLine);
  }, [grid, gridWidth, gridHeight, surfaceRowIndex, ui.selectedCell, selectCell, getBuildableCells]);

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
      const gridPixelWidth = gridWidth * CELL_SIZE;
      const offsetY = TOP_BAR_HEIGHT + 30;
      const surfaceY = offsetY + surfaceRowIndex * CELL_SIZE;
      const offsetX = Math.max(GRID_PADDING, (app.screen.width - gridPixelWidth) / 2);

      // === LAYER ORDER: First added = drawn behind, Last added = drawn on top ===

      // 1. Parallax background (far behind - drawn first)
      const parallax = new ParallaxBackground(
        app.stage,
        app.screen.width,
        app.screen.height
      );
      parallaxRef.current = parallax;

      // 2. Bubble system (bubbles in water area)
      const bubbleSystem = new BubbleSystem(
        app.stage,
        app.screen.width,
        app.screen.height
      );
      bubbleSystemRef.current = bubbleSystem;

      // 3. Grid container - THE MAIN GAME LAYER (on top so it's visible)
      const gridContainer = new Container();
      app.stage.addChild(gridContainer);
      gridContainerRef.current = gridContainer;

      // 4. Wave system at water surface (on top of grid at surface line only)
      const waveSystem = new WaveSystem(
        app.stage,
        gridPixelWidth,
        surfaceY,
        offsetX
      );
      waveSystemRef.current = waveSystem;

      // 5. Sky layers (mountains + clouds) above the grid
      const skyHeight = Math.max(0, surfaceRowIndex) * CELL_SIZE;
      if (skyHeight > 0) {
        const surfaceMountains = new SurfaceMountains(
          app.stage,
          gridPixelWidth,
          skyHeight,
          offsetX,
          offsetY
        );
        surfaceMountainsRef.current = surfaceMountains;

        const cloudBandWorldY = surfaceRowIndex >= 2 ? -2 : -1;
        const cloudBandIndex = cloudBandWorldY + surfaceRowIndex;
        const cloudBandY = offsetY + cloudBandIndex * CELL_SIZE;
        const surfaceClouds = new SurfaceClouds(
          app.stage,
          gridPixelWidth,
          CELL_SIZE,
          offsetX,
          cloudBandY
        );
        surfaceCloudsRef.current = surfaceClouds;
      }

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

        const gridContainer = gridContainerRef.current;
        if (gridContainer) {
          const gridPixelWidth = gridWidth * CELL_SIZE;
          const surfaceY = gridContainer.y + surfaceRowIndex * CELL_SIZE;
          waveSystemRef.current?.resize(
            gridPixelWidth,
            surfaceY,
            gridContainer.x
          );

          surfaceMountainsRef.current?.setPosition(
            gridContainer.x,
            gridContainer.y
          );
          if (surfaceCloudsRef.current) {
            const cloudBandWorldY = surfaceRowIndex >= 2 ? -2 : -1;
            const cloudBandIndex = cloudBandWorldY + surfaceRowIndex;
            surfaceCloudsRef.current.setPosition(
              gridContainer.x,
              gridContainer.y + cloudBandIndex * CELL_SIZE
            );
          }
        }

        workerManagerRef.current?.update(deltaMs);
        structureManagerRef.current?.update(deltaMs);
        bubbleSystemRef.current?.update(deltaMs);
        waveSystemRef.current?.update(deltaMs);
        surfaceMountainsRef.current?.update(deltaMs);
        surfaceCloudsRef.current?.update(deltaMs);
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
      surfaceCloudsRef.current?.destroy();
      surfaceMountainsRef.current?.destroy();
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
    if (appRef.current) {
      centerGrid(appRef.current);
    }
    drawGrid();
  }, [centerGrid, drawGrid]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
    />
  );
}
