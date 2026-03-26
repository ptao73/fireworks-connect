# Fireworks Connect (烟花连通)

A pure HTML5/CSS3/JS logic puzzle game built with zero dependencies. Spin the pipes, secure the connections, and light up the sky with procedural fireworks!

这是一个不需要任何框架的纯原生轻巧逻辑拼图游戏。旋转管道，打通链路，用程序生成的烟花特效去点亮夜空。

![Fireworks Connect Preview](https://via.placeholder.com/800x400.png?text=Fireworks+Connect)

## 🎮 Play Online / 在线试玩
[👉 Play hosted on GitHub Pages](https://ptao73.github.io/fireworks-connect/)

## 🌟 Features / 游戏特色
- **Rigorous Generation Algorithm (严谨的生成算法)**: Every puzzle is 100% solvable with a strict 1-to-1 rocket mapping. No dead ends! 每一局都完美满足对应的连通要求。
- **Hardcore Path Constraints (硬核路径约束)**: Starting from higher levels, every path requires at least 3 turns, making the puzzle significantly more challenging. 所有路线会被算法约束并强制包含至少三次转折。
- **Secret Bonus Multipliers (秘密多响加成)**: Randomly generated secret `T-junctions` exist from Level 3. Intercepting specific paths can trigger insane 100N² score multipliers! 高阶关卡内置了必定存在一火多连高分隐藏路线的设定。
- **Neon 3D UI (霓虹 3D UI)**: Festive bright Chinese-festival themed metal pipelines with simulated 3D lighting bounds and neon color-tracking waves. 充满年味的圆柱发光贴图管道与多色彩精准追踪的渐进霓虹特效。
- **Native WebAudio Synth (原生系统音频)**: Synthesized procedural sound effects (rotations, melodic waves, explosions) are directly driven by low level oscillator graphs, providing a rhythmic atmosphere without MP3 loads. The BGM can also fallback reliably! 用原生波形引擎手写的多级音效矩阵，带来完全零延迟的纯净听感。

## 💡 How to Play / 玩法说明
1. Tap the pipe tiles on the board to rotate them 90 degrees.
2. Connect the **fire sources (🔥)** on the left to the **rockets (🚀)** on the right.
3. Overlap routes safely using the distinct **Bridge (Crossover) block**.
4. Beat the clock! Fulfill the level's objective (Ignition count for early levels, and huge multiplier Scores for advanced levels) to progress.
5. Watch out for brilliantly glowing special rockets to maximize your final score.

1. 点击棋盘中的管道方块来进行顺时针 90 度旋转。
2. 将左侧的火源与右侧的火箭通过管线接通。
3. 利用自带阴影分层视效的过桥方块 (Bridge) 实现双线跨越和隔离交叠机制。
4. 每关必须在极短的倒计时内达到最低点燃比例或者爆分门槛（后期关卡）才能进入下一层。
5. 去寻找那些发光最亮的秘密火箭！如果接通多响，你可以直接触发 100N² 的震撼分数翻倍。

## 🛠 Tech Stack / 技术栈
- Pure HTML + Vanilla CSS + Vanilla JS (ES6)
- **Zero dependencies** (No Canvas/WebGL/React framework loading)
- Particle fireworks are purely mathematical DOM node arrays synced with hardware accelerated GPU keyframes `transform`.

## 📄 License / 许可证
MIT License. Feel free to copy, modify, and build your own maps in `levels.js`!
