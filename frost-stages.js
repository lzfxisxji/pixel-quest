/* Data-driven fixed-screen layouts for Frost Battle / Snow Bros style worlds.
   Each stage declares platforms, ladders, enemies and boss flag explicitly.
   World 1 has 10 stages: 1-1 (tutorial) -> 1-9 (normal) -> 1-10 (giant lizard boss).
   Layouts echo classic FC Snow Bros: short/long platforms, gaps, steps,
   symmetry, stagger and central podium rather than uniform full-width floors. */
(function(r){
const W = 640, H = 400;
const GROUND_Y = 370;
const PALETTE_ROWS = { forest: 0, cave: 1, castle: 2 };

// Floor reference Ys (classic tower density).
const Y = { g: 370, f1: 296, f2: 226, f3: 156, f4: 86 };

function plat(x, y, w) { return { x, y, w }; }
function enemy(type, x, y) { return { type, x, y }; }
function lad(top, bottom, x, w = 12) { return { top, bottom, x, w }; }

// Stage definitions ------------------------------------------------------------
const stageDefs = [
  // 1-1 教学关：简单三层，少量史莱姆
  {
    name: '初雪练习场', biome: 'forest',
    platforms: [
      plat(0, Y.g, 640),
      plat(80, Y.f1, 200), plat(360, Y.f1, 200),
      plat(220, Y.f2, 200),
    ],
    ladders: [
      lad(Y.f1, Y.g, 160), lad(Y.f1, Y.g, 480),
      lad(Y.f2, Y.f1, 300),
    ],
    enemies: [
      enemy('slime', 120, Y.f1 - 20), enemy('slime', 440, Y.f1 - 20),
      enemy('slime', 300, Y.f2 - 20),
    ],
    boss: null,
    hint: 'J 发射雪弹 · K 踢雪球'
  },
  // 1-2 进阶：交错短平台 + 奔跑怪
  {
    name: '松林回廊', biome: 'forest',
    platforms: [
      plat(0, Y.g, 640),
      plat(40, Y.f1, 150), plat(250, Y.f1, 140), plat(450, Y.f1, 150),
      plat(120, Y.f2, 160), plat(360, Y.f2, 160),
      plat(240, Y.f3, 160),
    ],
    ladders: [
      lad(Y.f1, Y.g, 100), lad(Y.f1, Y.g, 520),
      lad(Y.f2, Y.f1, 190), lad(Y.f2, Y.f1, 430),
      lad(Y.f3, Y.f2, 310),
    ],
    enemies: [
      enemy('slime', 80, Y.f1 - 20), enemy('runner', 300, Y.f1 - 20), enemy('slime', 520, Y.f1 - 20),
      enemy('runner', 180, Y.f2 - 20), enemy('slime', 430, Y.f2 - 20),
    ],
    boss: null
  },
  // 1-3 阶梯型：从左下到右上
  {
    name: '晶蓝冰洞', biome: 'cave',
    platforms: [
      plat(0, Y.g, 640),
      plat(40, Y.f1, 160), plat(240, Y.f2, 160), plat(440, Y.f3, 160),
      plat(180, Y.f1, 120), plat(380, Y.f2, 120),
    ],
    ladders: [
      lad(Y.f1, Y.g, 100), lad(Y.f2, Y.f1, 300), lad(Y.f3, Y.f2, 500),
    ],
    enemies: [
      enemy('slime', 80, Y.f1 - 20), enemy('runner', 260, Y.f2 - 20), enemy('jumper', 480, Y.f3 - 20),
      enemy('slime', 210, Y.f1 - 20), enemy('runner', 410, Y.f2 - 20),
    ],
    boss: null
  },
  // 1-4 左右对称型
  {
    name: '雪顶钟楼', biome: 'cave',
    platforms: [
      plat(0, Y.g, 640),
      plat(60, Y.f1, 180), plat(400, Y.f1, 180),
      plat(60, Y.f2, 120), plat(460, Y.f2, 120),
      plat(230, Y.f3, 180),
    ],
    ladders: [
      lad(Y.f1, Y.g, 140), lad(Y.f1, Y.g, 500),
      lad(Y.f2, Y.f1, 110), lad(Y.f2, Y.f1, 510),
      lad(Y.f3, Y.f2, 310),
    ],
    enemies: [
      enemy('slime', 100, Y.f1 - 20), enemy('slime', 480, Y.f1 - 20),
      enemy('jumper', 90, Y.f2 - 20), enemy('jumper', 490, Y.f2 - 20),
      enemy('runner', 300, Y.f3 - 20),
    ],
    boss: null
  },
  // 1-5 交错型：平台左右错开
  {
    name: '霜角守卫', biome: 'cave',
    platforms: [
      plat(0, Y.g, 640),
      plat(30, Y.f1, 260), plat(350, Y.f1, 260),
      plat(200, Y.f2, 240),
      plat(30, Y.f3, 260), plat(350, Y.f3, 260),
    ],
    ladders: [
      lad(Y.f1, Y.g, 150), lad(Y.f1, Y.g, 490),
      lad(Y.f2, Y.f1, 315),
      lad(Y.f3, Y.f2, 150), lad(Y.f3, Y.f2, 490),
    ],
    enemies: [
      enemy('runner', 120, Y.f1 - 20), enemy('runner', 460, Y.f1 - 20),
      enemy('shooter', 300, Y.f2 - 20),
      enemy('slime', 130, Y.f3 - 20), enemy('slime', 450, Y.f3 - 20),
    ],
    boss: null
  },
  // 1-6 中央高台型
  {
    name: '极光峡谷', biome: 'castle',
    platforms: [
      plat(0, Y.g, 640),
      plat(40, Y.f1, 160), plat(440, Y.f1, 160),
      plat(160, Y.f2, 320),
      plat(40, Y.f3, 160), plat(440, Y.f3, 160),
      plat(260, Y.f4, 120),
    ],
    ladders: [
      lad(Y.f1, Y.g, 110), lad(Y.f1, Y.g, 520),
      lad(Y.f2, Y.f1, 300),
      lad(Y.f3, Y.f2, 110), lad(Y.f3, Y.f2, 520),
      lad(Y.f4, Y.f3, 315),
    ],
    enemies: [
      enemy('shield', 90, Y.f1 - 20), enemy('shield', 500, Y.f1 - 20),
      enemy('runner', 280, Y.f2 - 20),
      enemy('jumper', 80, Y.f3 - 20), enemy('jumper', 510, Y.f3 - 20),
      enemy('flyer', 300, Y.f4 - 20),
    ],
    boss: null
  },
  // 1-7 复杂混合型
  {
    name: '冰晶工坊', biome: 'castle',
    platforms: [
      plat(0, Y.g, 640),
      plat(30, Y.f1, 120), plat(220, Y.f1, 200), plat(490, Y.f1, 120),
      plat(90, Y.f2, 130), plat(420, Y.f2, 130),
      plat(220, Y.f3, 200),
    ],
    ladders: [
      lad(Y.f1, Y.g, 85), lad(Y.f1, Y.g, 315), lad(Y.f1, Y.g, 545),
      lad(Y.f2, Y.f1, 150), lad(Y.f2, Y.f1, 480),
      lad(Y.f3, Y.f2, 310),
    ],
    enemies: [
      enemy('runner', 70, Y.f1 - 20), enemy('jumper', 300, Y.f1 - 20), enemy('runner', 540, Y.f1 - 20),
      enemy('shooter', 140, Y.f2 - 20), enemy('shooter', 470, Y.f2 - 20),
      enemy('heavy', 300, Y.f3 - 20),
    ],
    boss: null
  },
  // 1-8 长平台带缺口
  {
    name: '暮色雪堡', biome: 'castle',
    platforms: [
      plat(0, Y.g, 640),
      plat(30, Y.f1, 260), plat(350, Y.f1, 260),
      plat(30, Y.f2, 120), plat(230, Y.f2, 180), plat(490, Y.f2, 120),
      plat(30, Y.f3, 260), plat(350, Y.f3, 260),
    ],
    ladders: [
      lad(Y.f1, Y.g, 150), lad(Y.f1, Y.g, 490),
      lad(Y.f2, Y.f1, 90), lad(Y.f2, Y.f1, 315), lad(Y.f2, Y.f1, 545),
      lad(Y.f3, Y.f2, 150), lad(Y.f3, Y.f2, 490),
    ],
    enemies: [
      enemy('shield', 140, Y.f1 - 20), enemy('shield', 520, Y.f1 - 20),
      enemy('runner', 300, Y.f2 - 20),
      enemy('shooter', 140, Y.f3 - 20), enemy('shooter', 500, Y.f3 - 20),
      enemy('heavy', 300, Y.f1 - 20),
    ],
    boss: null
  },
  // 1-9 高密度难关
  {
    name: '暴风前夜', biome: 'castle',
    platforms: [
      plat(0, Y.g, 640),
      plat(40, Y.f1, 150), plat(245, Y.f1, 150), plat(450, Y.f1, 150),
      plat(120, Y.f2, 160), plat(360, Y.f2, 160),
      plat(40, Y.f3, 150), plat(245, Y.f3, 150), plat(450, Y.f3, 150),
    ],
    ladders: [
      lad(Y.f1, Y.g, 105), lad(Y.f1, Y.g, 315), lad(Y.f1, Y.g, 525),
      lad(Y.f2, Y.f1, 190), lad(Y.f2, Y.f1, 430),
      lad(Y.f3, Y.f2, 105), lad(Y.f3, Y.f2, 315), lad(Y.f3, Y.f2, 525),
    ],
    enemies: [
      enemy('heavy', 90, Y.f1 - 20), enemy('heavy', 500, Y.f1 - 20),
      enemy('shooter', 180, Y.f2 - 20), enemy('shooter', 440, Y.f2 - 20),
      enemy('shield', 100, Y.f3 - 20), enemy('shield', 320, Y.f3 - 20), enemy('shield', 540, Y.f3 - 20),
      enemy('flyer', 300, Y.f2 - 20),
    ],
    boss: null
  },
  // 1-10 绿色巨型蜥蜴 BOSS 战：扁平 Boss 竞技场，两侧只有小平台。
  {
    name: '寒星王座', biome: 'castle',
    platforms: [
      plat(0, Y.g, 640),
      plat(40, Y.f1, 120),
      plat(480, Y.f1, 120),
    ],
    ladders: [],
    enemies: [
      enemy('slime', 120, Y.g - 20), enemy('slime', 520, Y.g - 20),
    ],
    boss: 'lizard'
  },
  // 2-1 第二大关入口：雪原再临
  {
    name: '雪原再临', biome: 'forest',
    platforms: [
      plat(0, Y.g, 640),
      plat(60, Y.f1, 180), plat(400, Y.f1, 180),
      plat(60, Y.f2, 120), plat(460, Y.f2, 120),
      plat(230, Y.f3, 180),
    ],
    ladders: [
      lad(Y.f1, Y.g, 140), lad(Y.f1, Y.g, 500),
      lad(Y.f2, Y.f1, 110), lad(Y.f2, Y.f1, 510),
      lad(Y.f3, Y.f2, 310),
    ],
    enemies: [
      enemy('runner', 100, Y.f1 - 20), enemy('runner', 480, Y.f1 - 20),
      enemy('jumper', 90, Y.f2 - 20), enemy('jumper', 490, Y.f2 - 20),
      enemy('heavy', 300, Y.f3 - 20),
    ],
    boss: null
  }
];

// Build stage records. Clamp spawn positions inside playable bounds and assign ids.
const stages = stageDefs.map((def, i) => ({
  id: i,
  name: def.name,
  biome: def.biome,
  hint: def.hint || null,
  platforms: def.platforms,
  ladders: def.ladders,
  enemies: def.enemies.map(e => ({ ...e })),
  boss: def.boss
}));

const api = { W, H, stages };
r.FrostStages = api;
if (typeof module === 'object') module.exports = api;
})(globalThis);
