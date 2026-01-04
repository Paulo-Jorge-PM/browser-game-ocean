import { Container, Graphics } from 'pixi.js';

interface ParallaxLayer {
  container: Container;
  speed: number;
  elements: Graphics[];
}

interface LightRay {
  graphics: Graphics;
  x: number;
  angle: number;
  opacity: number;
  speed: number;
  width: number;
}

export class ParallaxBackground {
  private container: Container;
  private layers: ParallaxLayer[] = [];
  private lightRays: LightRay[] = [];
  private width: number;
  private height: number;
  private scrollOffset: number = 0;

  constructor(parent: Container, width: number, height: number) {
    this.container = new Container();
    this.container.eventMode = 'none'; // Don't block clicks
    this.width = width;
    this.height = height;
    parent.addChild(this.container);

    this.createLayers();
    this.createLightRays();
  }

  private createLayers() {
    // Deep background layer - very subtle movement
    this.createLayer(0.1, 0x001020, 0.4, 30);

    // Mid background - some fish/debris silhouettes
    this.createLayer(0.3, 0x002040, 0.3, 15);

    // Near background - particles
    this.createLayer(0.5, 0x003060, 0.2, 8);
  }

  private createLayer(speed: number, color: number, alpha: number, elementCount: number) {
    const layerContainer = new Container();
    this.container.addChild(layerContainer);

    const elements: Graphics[] = [];

    for (let i = 0; i < elementCount; i++) {
      const element = new Graphics();
      const type = Math.random();

      if (type < 0.4) {
        // Small fish silhouette
        this.drawFish(element, color, alpha);
      } else if (type < 0.7) {
        // Debris/particle
        element.circle(0, 0, 1 + Math.random() * 3);
        element.fill({ color, alpha: alpha * 0.5 });
      } else {
        // Seaweed strand
        this.drawSeaweed(element, color, alpha);
      }

      element.x = Math.random() * this.width;
      element.y = Math.random() * this.height;

      layerContainer.addChild(element);
      elements.push(element);
    }

    this.layers.push({
      container: layerContainer,
      speed,
      elements,
    });
  }

  private drawFish(graphics: Graphics, color: number, alpha: number) {
    const size = 5 + Math.random() * 15;
    const facing = Math.random() > 0.5 ? 1 : -1;

    // Body
    graphics.ellipse(0, 0, size, size * 0.4);
    graphics.fill({ color, alpha });

    // Tail
    graphics.moveTo(-size * 0.8 * facing, 0);
    graphics.lineTo(-size * 1.3 * facing, -size * 0.3);
    graphics.lineTo(-size * 1.3 * facing, size * 0.3);
    graphics.closePath();
    graphics.fill({ color, alpha: alpha * 0.8 });
  }

  private drawSeaweed(graphics: Graphics, color: number, alpha: number) {
    const height = 20 + Math.random() * 40;
    const width = 2 + Math.random() * 4;

    graphics.moveTo(0, 0);
    for (let y = 0; y < height; y += 5) {
      const xOffset = Math.sin(y * 0.1) * width;
      graphics.lineTo(xOffset, -y);
    }
    graphics.stroke({ color, width: 2, alpha });
  }

  private createLightRays() {
    const rayCount = 5;

    for (let i = 0; i < rayCount; i++) {
      const ray: LightRay = {
        graphics: new Graphics(),
        x: Math.random() * this.width,
        angle: -0.2 + Math.random() * 0.4,
        opacity: 0.02 + Math.random() * 0.05,
        speed: 0.002 + Math.random() * 0.003,
        width: 30 + Math.random() * 60,
      };

      this.drawLightRay(ray);
      this.container.addChild(ray.graphics);
      this.lightRays.push(ray);
    }
  }

  private drawLightRay(ray: LightRay) {
    const { graphics, x, angle, opacity, width } = ray;
    graphics.clear();

    // Draw a gradient-like cone of light from top
    graphics.moveTo(x, 0);
    graphics.lineTo(x + Math.tan(angle) * this.height - width / 2, this.height);
    graphics.lineTo(x + Math.tan(angle) * this.height + width / 2, this.height);
    graphics.closePath();
    graphics.fill({ color: 0x00aaff, alpha: opacity });
  }

  public update(_deltaMs: number) {
    // Animate light rays
    this.lightRays.forEach((ray) => {
      ray.opacity = 0.02 + Math.sin(Date.now() * ray.speed) * 0.03;
      this.drawLightRay(ray);
    });

    // Animate parallax elements (slight drift)
    this.layers.forEach((layer) => {
      layer.elements.forEach((element) => {
        element.x += layer.speed * 0.1;

        // Wrap around screen
        if (element.x > this.width + 20) {
          element.x = -20;
          element.y = Math.random() * this.height;
        }
      });
    });
  }

  public setScrollOffset(offset: number) {
    const delta = offset - this.scrollOffset;
    this.scrollOffset = offset;

    // Move layers at different speeds based on their depth
    this.layers.forEach((layer) => {
      layer.container.y -= delta * layer.speed;
    });
  }

  public resize(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  public destroy() {
    this.layers.forEach((layer) => {
      layer.elements.forEach((e) => e.destroy());
      layer.container.destroy();
    });
    this.lightRays.forEach((ray) => ray.graphics.destroy());
    this.container.destroy();
  }
}
