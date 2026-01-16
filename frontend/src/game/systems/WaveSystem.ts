import { Container, Graphics } from 'pixi.js';

interface WaveLayer {
  graphics: Graphics;
  phase: number;
  speed: number;
  amplitude: number;
  frequency: number;
  color: number;
  alpha: number;
}

export class WaveSystem {
  private container: Container;
  private waves: WaveLayer[] = [];
  private width: number;
  private surfaceY: number;

  constructor(parent: Container, width: number, surfaceY: number, offsetX: number = 0) {
    this.container = new Container();
    this.container.eventMode = 'none'; // Don't block clicks
    this.container.x = offsetX;
    this.width = width;
    this.surfaceY = surfaceY;
    parent.addChild(this.container);

    // Create multiple wave layers for depth effect
    this.createWaveLayers();
  }

  private createWaveLayers() {
    // Background wave (slower, larger)
    this.waves.push({
      graphics: new Graphics(),
      phase: 0,
      speed: 0.0008,
      amplitude: 4,
      frequency: 0.015,
      color: 0x0066aa,
      alpha: 0.3,
    });

    // Mid wave
    this.waves.push({
      graphics: new Graphics(),
      phase: Math.PI / 3,
      speed: 0.0012,
      amplitude: 3,
      frequency: 0.025,
      color: 0x00aadd,
      alpha: 0.4,
    });

    // Foreground wave (faster, smaller)
    this.waves.push({
      graphics: new Graphics(),
      phase: Math.PI / 2,
      speed: 0.0018,
      amplitude: 2,
      frequency: 0.04,
      color: 0x00d4ff,
      alpha: 0.5,
    });

    // Surface line
    this.waves.push({
      graphics: new Graphics(),
      phase: 0,
      speed: 0.002,
      amplitude: 1.5,
      frequency: 0.05,
      color: 0x00ffff,
      alpha: 0.8,
    });

    // Add all wave graphics to container
    this.waves.forEach((wave) => {
      this.container.addChild(wave.graphics);
    });
  }

  public update(deltaMs: number) {
    this.waves.forEach((wave) => {
      wave.phase += wave.speed * deltaMs;

      // Redraw wave
      wave.graphics.clear();

      // Draw wave as a series of points
      wave.graphics.moveTo(0, this.surfaceY);

      for (let x = 0; x <= this.width; x += 5) {
        const y =
          this.surfaceY +
          Math.sin(x * wave.frequency + wave.phase) * wave.amplitude +
          Math.sin(x * wave.frequency * 0.5 + wave.phase * 1.3) * wave.amplitude * 0.5;

        wave.graphics.lineTo(x, y);
      }

      // Close the shape to fill below the wave
      wave.graphics.lineTo(this.width, this.surfaceY + 20);
      wave.graphics.lineTo(0, this.surfaceY + 20);
      wave.graphics.closePath();

      wave.graphics.fill({ color: wave.color, alpha: wave.alpha });
    });
  }

  public resize(width: number, surfaceY: number, offsetX?: number) {
    this.width = width;
    this.surfaceY = surfaceY;
    if (offsetX !== undefined) {
      this.container.x = offsetX;
    }
  }

  public destroy() {
    this.waves.forEach((wave) => {
      wave.graphics.destroy();
    });
    this.container.destroy();
  }
}
