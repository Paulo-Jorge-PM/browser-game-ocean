import { Container, Graphics } from 'pixi.js';

export interface WorkerConfig {
  x: number;
  y: number;
  cellSize: number;
  color?: number;
}

export class Worker {
  public container: Container;
  private graphics: Graphics;
  private targetX: number;
  private targetY: number;
  private speed: number = 0.5;
  private cellSize: number;
  private baseX: number;
  private baseY: number;
  private moveTimer: number = 0;
  private moveInterval: number;
  private wobblePhase: number;

  constructor(config: WorkerConfig) {
    this.cellSize = config.cellSize;
    this.baseX = config.x;
    this.baseY = config.y;
    this.wobblePhase = Math.random() * Math.PI * 2;
    this.moveInterval = 1000 + Math.random() * 2000; // Random move interval

    this.container = new Container();
    this.container.x = config.x + Math.random() * (config.cellSize - 10);
    this.container.y = config.y + Math.random() * (config.cellSize - 10);

    this.targetX = this.container.x;
    this.targetY = this.container.y;

    this.graphics = new Graphics();
    this.draw(config.color || 0x00ff88);
    this.container.addChild(this.graphics);

    // Pick new target
    this.pickNewTarget();
  }

  private draw(color: number) {
    this.graphics.clear();

    // Body (small circle)
    this.graphics.circle(0, 0, 3);
    this.graphics.fill({ color, alpha: 0.9 });

    // Helmet bubble
    this.graphics.circle(0, -2, 4);
    this.graphics.stroke({ color: 0x88ccff, width: 1, alpha: 0.5 });
  }

  private pickNewTarget() {
    // Stay within the cell bounds with padding
    const padding = 8;
    this.targetX = this.baseX + padding + Math.random() * (this.cellSize - padding * 2);
    this.targetY = this.baseY + padding + Math.random() * (this.cellSize - padding * 2);
  }

  public update(deltaMs: number) {
    // Move towards target
    const dx = this.targetX - this.container.x;
    const dy = this.targetY - this.container.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 1) {
      this.container.x += (dx / dist) * this.speed;
      this.container.y += (dy / dist) * this.speed;
    }

    // Add slight wobble for swimming effect
    this.wobblePhase += 0.05;
    this.container.y += Math.sin(this.wobblePhase) * 0.1;

    // Pick new target periodically
    this.moveTimer += deltaMs;
    if (this.moveTimer > this.moveInterval || dist < 2) {
      this.moveTimer = 0;
      this.moveInterval = 1000 + Math.random() * 2000;
      this.pickNewTarget();
    }
  }

  public destroy() {
    this.container.destroy({ children: true });
  }
}

export class WorkerManager {
  private workers: Map<string, Worker[]> = new Map();
  private container: Container;

  constructor(parentContainer: Container) {
    this.container = new Container();
    parentContainer.addChild(this.container);
  }

  public addWorkersForBase(
    baseId: string,
    x: number,
    y: number,
    cellSize: number,
    workerCount: number,
    color: number
  ) {
    // Remove existing workers for this base
    this.removeWorkersForBase(baseId);

    const workers: Worker[] = [];
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker({
        x,
        y,
        cellSize,
        color,
      });
      workers.push(worker);
      this.container.addChild(worker.container);
    }
    this.workers.set(baseId, workers);
  }

  public removeWorkersForBase(baseId: string) {
    const workers = this.workers.get(baseId);
    if (workers) {
      workers.forEach((w) => w.destroy());
      this.workers.delete(baseId);
    }
  }

  public update(deltaMs: number) {
    this.workers.forEach((workers) => {
      workers.forEach((w) => w.update(deltaMs));
    });
  }

  public clear() {
    this.workers.forEach((workers) => {
      workers.forEach((w) => w.destroy());
    });
    this.workers.clear();
  }
}
