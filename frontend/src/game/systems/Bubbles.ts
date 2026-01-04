import { Container, Graphics } from 'pixi.js';

interface Bubble {
  graphics: Graphics;
  x: number;
  y: number;
  speed: number;
  size: number;
  wobblePhase: number;
  wobbleSpeed: number;
  alpha: number;
}

export class BubbleSystem {
  private container: Container;
  private bubbles: Bubble[] = [];
  private width: number;
  private height: number;
  private maxBubbles: number = 30;

  constructor(parentContainer: Container, width: number, height: number) {
    this.container = new Container();
    this.container.eventMode = 'none'; // Don't block clicks
    this.width = width;
    this.height = height;
    parentContainer.addChild(this.container);

    // Create initial bubbles
    for (let i = 0; i < this.maxBubbles; i++) {
      this.spawnBubble(true);
    }
  }

  private spawnBubble(randomY: boolean = false) {
    const graphics = new Graphics();
    const size = 2 + Math.random() * 4;
    const alpha = 0.2 + Math.random() * 0.3;

    graphics.circle(0, 0, size);
    graphics.fill({ color: 0x88ccff, alpha });
    graphics.circle(size * 0.3, -size * 0.3, size * 0.3);
    graphics.fill({ color: 0xffffff, alpha: alpha * 0.5 });

    const bubble: Bubble = {
      graphics,
      x: Math.random() * this.width,
      y: randomY ? Math.random() * this.height : this.height + size,
      speed: 0.3 + Math.random() * 0.7,
      size,
      wobblePhase: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.02 + Math.random() * 0.03,
      alpha,
    };

    graphics.x = bubble.x;
    graphics.y = bubble.y;

    this.bubbles.push(bubble);
    this.container.addChild(graphics);
  }

  public update(_deltaMs: number) {
    const deadBubbles: number[] = [];

    this.bubbles.forEach((bubble, index) => {
      // Move up
      bubble.y -= bubble.speed;

      // Wobble
      bubble.wobblePhase += bubble.wobbleSpeed;
      bubble.x += Math.sin(bubble.wobblePhase) * 0.3;

      // Update graphics position
      bubble.graphics.x = bubble.x;
      bubble.graphics.y = bubble.y;

      // Mark for removal if off screen
      if (bubble.y < -bubble.size * 2) {
        deadBubbles.push(index);
      }
    });

    // Remove dead bubbles and spawn new ones
    deadBubbles.reverse().forEach((index) => {
      const bubble = this.bubbles[index];
      this.container.removeChild(bubble.graphics);
      bubble.graphics.destroy();
      this.bubbles.splice(index, 1);
    });

    // Spawn new bubbles to maintain count
    while (this.bubbles.length < this.maxBubbles) {
      this.spawnBubble();
    }
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public destroy() {
    this.bubbles.forEach((b) => b.graphics.destroy());
    this.container.destroy({ children: true });
  }
}
