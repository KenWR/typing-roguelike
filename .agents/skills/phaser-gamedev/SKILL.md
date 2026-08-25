---
name: phaser-gamedev
description: >
  Build 2D games with Phaser 3 framework. Covers scene lifecycle, sprites, physics (Arcade/Matter),
  tilemaps, animations, input handling, and game architecture. Trigger: "create phaser game",
  "add phaser scene", "phaser sprite", "phaser physics", "game development with phaser".
---

# Phaser Game Development

Build 2D browser games using Phaser 3's scene-based architecture and physics systems.

---

## STOP: Before Loading Any Spritesheet

**Read [spritesheets-nineslice.md](references/spritesheets-nineslice.md) FIRST.**

Spritesheet loading is fragile—a few pixels off causes silent corruption that compounds into broken visuals. The reference file contains the mandatory inspection protocol.

**Quick rules** (details in reference):

1. **Measure the asset** before writing loader code—never guess frame dimensions
2. **Character sprites use SQUARE frames**: If you calculate frameWidth=56, try 56 for height first
3. **Different animations have different frame sizes**: A run cycle needs wider frames than idle; an attack needs extra width for weapon swing. Measure EACH spritesheet independently
4. **Check for spacing**: Gaps between frames require `spacing: N` in loader config
5. **Verify the math**: `imageWidth = (frameWidth × cols) + (spacing × (cols - 1))`

---

## Reference Files

Read these BEFORE working on the relevant feature:

| When working on... | Read first |
|--------------------|------------|
| Loading ANY spritesheet | [spritesheets-nineslice.md](references/spritesheets-nineslice.md) |
| Nine-slice UI panels | [spritesheets-nineslice.md](references/spritesheets-nineslice.md) |
| Tiled tilemaps, collision layers | [tilemaps.md](references/tilemaps.md) |
| Physics tuning, groups, pooling | [arcade-physics.md](references/arcade-physics.md) |
| Performance issues, object pooling | [performance.md](references/performance.md) |
| Viewport scaling, responsive games | See "Viewport Scaling" section below |

---

## Architecture Decisions (Make Early)

### Physics System Choice

| System | Use When |
|--------|----------|
| **Arcade** | Platformers, shooters, most 2D games. Fast AABB collisions |
| **Matter** | Physics puzzles, ragdolls, realistic collisions. Slower, more accurate |
| **None** | Menu scenes, visual novels, card games |

### Scene Structure

```
scenes/
├── BootScene.ts      # Asset loading, progress bar
├── MenuScene.ts      # Title screen, options
├── GameScene.ts      # Main gameplay
├── UIScene.ts        # HUD overlay (launched parallel)
└── GameOverScene.ts  # End screen, restart
```

### Scene Transitions

```typescript
this.scene.start('GameScene', { level: 1 });     // Stop current, start new
this.scene.launch('UIScene');                     // Run in parallel
this.scene.pause('GameScene');                    // Pause
this.scene.stop('UIScene');                       // Stop
```

---

## Core Patterns

### Game Configuration

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { y: 300 }, debug: false }
  },
  scene: [BootScene, MenuScene, GameScene]
};
```

### Scene Lifecycle

```typescript
class GameScene extends Phaser.Scene {
  init(data) { }      // Receive data from previous scene
  preload() { }       // Load assets (runs before create)
  create() { }        // Set up game objects, physics, input
  update(time, delta) { }  // Game loop, use delta for frame-rate independence
}
```

### Frame-Rate Independent Movement

```typescript
// CORRECT: scales with frame rate
this.player.x += this.speed * (delta / 1000);

// WRONG: varies with frame rate
this.player.x += this.speed;
```

---

## Viewport Scaling

**CRITICAL: Use Phaser's Scale Manager for ALL viewport scaling. This is the PRIMARY and ONLY correct approach.**

### Why Phaser Scale Manager?

Phaser's Scale Manager handles:
- Responsive viewport sizing
- Aspect ratio preservation
- Device pixel ratio (DPR) handling
- Window resize events
- Canvas scaling and centering
- Input coordinate transformation

**Manual JavaScript/CSS scaling is an anti-pattern** that breaks Phaser's coordinate system, input handling, and physics calculations.

### Scale Manager Configuration

The Scale Manager is configured in your game config's `scale` property:

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,   // Base game width
  height: 600,  // Base game height
  scale: {
    mode: Phaser.Scale.FIT,              // Primary scaling mode
    autoCenter: Phaser.Scale.CENTER_BOTH, // Center the game canvas
    parent: 'game-container',            // Optional: parent DOM element
    width: 800,                          // Base width (can differ from top-level)
    height: 600,                         // Base height (can differ from top-level)
    min: { width: 400, height: 300 },    // Optional: minimum size
    max: { width: 1920, height: 1080 },  // Optional: maximum size
  },
  // ... rest of config
};
```

### Common Scaling Modes

| Mode | Description | Use When |
|------|-------------|----------|
| `Phaser.Scale.FIT` | Scales to fit viewport, maintains aspect ratio, may show letterboxing | **Most common** - Games that need to work on all screen sizes |
| `Phaser.Scale.RESIZE` | Game resizes to match viewport exactly, may distort aspect ratio | Responsive layouts that adapt to any size |
| `Phaser.Scale.WIDTH_CONTROLS_HEIGHT` | Width matches viewport, height calculated to maintain aspect ratio | Fixed-width responsive games |
| `Phaser.Scale.HEIGHT_CONTROLS_WIDTH` | Height matches viewport, width calculated to maintain aspect ratio | Fixed-height responsive games |
| `Phaser.Scale.NONE` | No scaling, canvas stays at base size | Desktop-only games, fixed-size games |

### Scaling for 70-80% Viewport Usage

To make the game fill 70-80% of the viewport while maintaining aspect ratio:

```typescript
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    // Calculate target size as percentage of viewport
    // Phaser will automatically scale to fit while maintaining aspect ratio
  },
  // ... rest of config
};

// In your scene, you can also adjust dynamically:
this.scale.setGameSize(
  Math.floor(window.innerWidth * 0.75),  // 75% of viewport width
  Math.floor(window.innerHeight * 0.75)  // 75% of viewport height
);
```

### Dynamic Resize Handling

Phaser automatically handles window resize events when using Scale Manager. To respond to resize:

```typescript
this.scale.on('resize', (gameSize: Phaser.Structs.Size) => {
  // Game has been resized
  // gameSize.width and gameSize.height are the new dimensions
  // Adjust camera, UI, or game elements as needed
});
```

### Accessing Scale Information

```typescript
// In any scene:
const scaleManager = this.scale;

// Get current game size (after scaling)
const gameWidth = this.scale.gameSize.width;
const gameHeight = this.scale.gameSize.height;

// Get display size (actual canvas size)
const displayWidth = this.scale.displaySize.width;
const displayHeight = this.scale.displaySize.height;

// Get scale factor
const scaleX = this.scale.displaySize.width / this.scale.gameSize.width;
const scaleY = this.scale.displaySize.height / this.scale.gameSize.height;
```

### Anti-Pattern: Manual JavaScript/CSS Scaling

❌ **NEVER do this**:

```typescript
// WRONG: Manual DOM/CSS scaling
const gameCanvas = document.querySelector('canvas');
gameCanvas.style.width = '75%';
gameCanvas.style.height = '75%';
gameCanvas.style.transform = 'scale(0.75)';

// WRONG: Manual JavaScript resize handlers
window.addEventListener('resize', () => {
  const container = document.getElementById('game-container');
  container.style.width = `${window.innerWidth * 0.75}px`;
  container.style.height = `${window.innerHeight * 0.75}px`;
});

// WRONG: MutationObserver for scaling
const observer = new MutationObserver(() => {
  // Manual scaling logic
});
```

**Problems with manual scaling:**
- Breaks Phaser's coordinate system
- Input coordinates don't match visual positions
- Physics calculations become incorrect
- Camera and viewport calculations fail
- No automatic DPR handling
- Resize events not properly coordinated

✅ **ALWAYS use Phaser Scale Manager**:

```typescript
// CORRECT: Use Phaser Scale Manager
const config: Phaser.Types.Core.GameConfig = {
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};
```

### When Skills Don't Provide Enough Detail

If scaling requirements are complex or the skill guidance is insufficient:

1. **Search official Phaser documentation**:
   - Use `mcp_web_fetch` to fetch: `https://photonstorm.github.io/phaser3-docs/Phaser.Scale.ScaleManager.html`
   - Search for: `"Phaser Scale Manager"`, `"Phaser.Scale.FIT"`, `"Phaser viewport scaling"`

2. **Search Stack Overflow**:
   - Search for: `"Phaser 3 scaling"`, `"Phaser responsive game"`, `"Phaser Scale Manager"`

3. **Check GitHub discussions**:
   - Phaser 3 GitHub issues: `"Phaser.Scale"` or `"scaling"` issues

**Never fall back to manual JavaScript scaling** - always use Phaser's built-in Scale Manager.

---

## Anti-Patterns

| Anti-Pattern | Problem | Solution |
|--------------|---------|----------|
| **Manual JavaScript/CSS scaling** | Breaks coordinate system, input, physics | **Use Phaser.Scale config in game config** |
| Global state on `window` | Scene transitions break state | Use scene data, registries |
| Loading in `create()` | Assets not ready when referenced | Load in `preload()`, use Boot scene |
| Frame counting | Game speed varies with FPS | Use `delta / 1000` |
| Matter for simple collisions | Unnecessary complexity | Arcade handles most 2D games |
| One giant scene | Hard to extend | Separate gameplay/UI/menus |
| Magic numbers | Impossible to balance | Config objects, constants |
| No object pooling | GC stutters | Groups with `setActive(false)` |

---

## Remember

Phaser provides powerful primitives—scenes, sprites, physics, input—but **architecture is your responsibility**.

Before coding: What scenes? What entities? How do they interact? What physics model?

**Claude can build complete, polished Phaser games. These guidelines illuminate the path—they don't fence it.**
