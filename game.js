// Hidden invaders game: the forEach mark is the ship and its three dots are your ammo.
// One life, no confirmations. YOLO mode, like the agents.
// Loaded on demand from script.js.

const SPRITES = {
	squid: [
		["00011000", "00111100", "01111110", "11011011", "11111111", "00100100", "01011010", "10100101"],
		["00011000", "00111100", "01111110", "11011011", "11111111", "01011010", "10000001", "01000010"],
	],
	crab: [
		["00100000100", "00010001000", "00111111100", "01101110110", "11111111111", "10111111101", "10100000101", "00011011000"],
		["00100000100", "10010001001", "10111111101", "11101110111", "11111111111", "01111111110", "00100000100", "01000000010"],
	],
	octopus: [
		["000011110000", "011111111110", "111111111111", "111001100111", "111111111111", "000110011000", "001101101100", "110000000011"],
		["000011110000", "011111111110", "111111111111", "111001100111", "111111111111", "001110011100", "011001100110", "001100001100"],
	],
};
const ROWS = [
	{ kind: "squid", points: 30 },
	{ kind: "crab", points: 20 },
	{ kind: "crab", points: 20 },
	{ kind: "octopus", points: 10 },
];
const COLS = 8;
const PX = 3;
const CELL_W = 52;
const CELL_H = 38;
const SHIP_SCALE = 1;
const SHIP_W = 64 * SHIP_SCALE;
const SHIP_H = 64 * SHIP_SCALE;
const MAX_SHOTS = 3;
const QUIPS = [
	"auto-approved: rm -rf ./ship",
	"skipped permissions. all of them.",
	"it worked on my machine",
	"no undo. no ctrl+z. no regrets.",
	"the agent was very confident",
	"shipped straight to prod",
	"LGTM, said nobody",
];
const WAVE_LINES = [
	"yolo mode: on · auto-approving everything",
	"shipped without review",
	"tests? where we're going we don't need tests",
	"force-pushed to main",
	"deployed on a friday",
];

function readHigh() {
	try { return Number(localStorage.getItem("fe-hi")) || 0; } catch { return 0; }
}
function saveHigh(n) {
	try { localStorage.setItem("fe-hi", String(n)); } catch {}
}

export function start(hero, mark, onExit) {
	const css = getComputedStyle(document.documentElement);
	const color = (name) => css.getPropertyValue(name).trim();
	const C = { text: color("--text"), muted: color("--muted"), accent: color("--accent"), border: color("--border"), bg: color("--bg") };
	const mono = getComputedStyle(document.body).getPropertyValue("--mono") || "monospace";
	const touch = matchMedia("(pointer: coarse)").matches;

	const canvas = document.createElement("canvas");
	canvas.className = "game";
	canvas.setAttribute("aria-label", "Invaders game. Arrow keys to move, space to fire, escape to quit.");
	const quit = document.createElement("button");
	quit.className = "game-quit";
	quit.type = "button";
	quit.textContent = "esc ×";
	hero.append(canvas, quit);
	const ctx = canvas.getContext("2d");

	let W = 0;
	let H = 0;
	function resize() {
		const r = hero.getBoundingClientRect();
		const dpr = Math.min(2, devicePixelRatio || 1);
		W = r.width;
		H = r.height;
		canvas.width = W * dpr;
		canvas.height = H * dpr;
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resize();

	// Ship starts where the mark was, so it feels like the logo dropped into place
	const mr = mark.getBoundingClientRect();
	const hr = hero.getBoundingClientRect();
	const ship = { x: mr.left - hr.left + mr.width / 2, alive: true, cool: 0 };

	let state = "ready";
	let stateTime = 0;
	let score = 0;
	let high = readHigh();
	let wave = 0;
	let shake = 0;
	let quip = QUIPS[0];
	let invaders = [];
	let formation = { dx: 1, timer: 0, frame: 0 };
	let shots = [];
	let bombs = [];
	let sparks = [];
	let bombTimer = 0;
	const keys = new Set();
	let pointerX = null;

	function nextWave() {
		wave++;
		invaders = [];
		const px = W < 480 ? 2 : PX;
		const cellW = Math.min(CELL_W, Math.floor((W - 64) / COLS));
		const cellH = W < 480 ? 32 : CELL_H;
		const gridW = COLS * cellW;
		const left = Math.max(16, (W - gridW) / 2);
		ROWS.forEach((row, r) => {
			for (let c = 0; c < COLS; c++) {
				const w = SPRITES[row.kind][0][0].length * px;
				invaders.push({
					x: left + c * cellW + (cellW - w) / 2,
					y: 70 + r * cellH + Math.min(wave - 1, 4) * 12,
					w,
					h: 8 * px,
					px,
					row: r,
					col: c,
					...row,
				});
			}
		});
		formation = { dx: 1, timer: 0, frame: 0 };
		shots = [];
		bombs = [];
		bombTimer = 1.2;
		state = "ready";
		stateTime = 0;
	}

	function reset() {
		score = 0;
		wave = 0;
		ship.alive = true;
		nextWave();
	}

	function burst(x, y, col, n = 14) {
		for (let i = 0; i < n; i++) {
			const a = Math.random() * Math.PI * 2;
			const v = 60 + Math.random() * 180;
			sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.5 + Math.random() * 0.4, col });
		}
	}

	function fire() {
		if (state !== "play" || ship.cool > 0 || shots.length >= MAX_SHOTS) return;
		shots.push({ x: ship.x, y: H - 40 - SHIP_H / 2 });
		ship.cool = 0.28;
	}

	function update(dt) {
		stateTime += dt;
		shake = Math.max(0, shake - dt * 30);

		for (const s of sparks) {
			s.x += s.vx * dt;
			s.y += s.vy * dt;
			s.vx *= 0.92;
			s.vy *= 0.92;
			s.life -= dt;
		}
		sparks = sparks.filter((s) => s.life > 0);

		if (state === "ready" && stateTime > 1.2) state = "play";
		if (state === "over") return;

		// Ship
		const speed = 360;
		if (keys.has("left")) ship.x -= speed * dt;
		if (keys.has("right")) ship.x += speed * dt;
		if (pointerX !== null) ship.x += (pointerX - ship.x) * Math.min(1, dt * 14);
		ship.x = Math.max(SHIP_W / 2 + 8, Math.min(W - SHIP_W / 2 - 8, ship.x));
		ship.cool -= dt;
		if (keys.has("fire") || (touch && pointerX !== null)) fire();

		if (state !== "play") return;

		// Formation marches in steps and speeds up as it thins out
		const alive = invaders.length;
		const total = ROWS.length * COLS;
		const interval = Math.max(0.05, (0.55 * alive) / total) / (1 + (wave - 1) * 0.25);
		formation.timer -= dt;
		if (formation.timer <= 0) {
			formation.timer = interval;
			formation.frame ^= 1;
			const step = (W < 480 ? 6 : 10) * formation.dx;
			const drop = W < 480 ? 12 : 16;
			const minX = Math.min(...invaders.map((i) => i.x));
			const maxX = Math.max(...invaders.map((i) => i.x + i.w));
			if (maxX + step > W - 12 || minX + step < 12) {
				formation.dx *= -1;
				for (const i of invaders) i.y += drop;
			} else {
				for (const i of invaders) i.x += step;
			}
		}

		// Bombs come from the lowest invader in a random column
		bombTimer -= dt;
		if (bombTimer <= 0 && alive) {
			bombTimer = Math.max(0.25, 1.1 - wave * 0.12) * (0.6 + Math.random() * 0.8);
			const cols = [...new Set(invaders.map((i) => i.col))];
			const col = cols[Math.floor(Math.random() * cols.length)];
			const low = invaders.filter((i) => i.col === col).sort((a, b) => b.y - a.y)[0];
			bombs.push({ x: low.x + low.w / 2, y: low.y + low.h, t: 0 });
		}

		for (const s of shots) s.y -= 620 * dt;
		shots = shots.filter((s) => s.y > -10);
		for (const b of bombs) {
			b.y += (220 + wave * 20) * dt;
			b.t += dt;
		}
		bombs = bombs.filter((b) => b.y < H + 10);

		// Shots vs invaders
		for (const s of shots) {
			const hit = invaders.find((i) => s.x > i.x - 3 && s.x < i.x + i.w + 3 && s.y > i.y && s.y < i.y + i.h);
			if (hit) {
				s.y = -100;
				invaders.splice(invaders.indexOf(hit), 1);
				score += hit.points;
				burst(hit.x + hit.w / 2, hit.y + hit.h / 2, hit.row === 0 ? C.accent : C.text);
			}
		}

		// Bombs vs ship
		const shipTop = H - 40 - SHIP_H * 0.75;
		for (const b of bombs) {
			if (b.y > shipTop && b.y < H - 40 + SHIP_H / 2 && Math.abs(b.x - ship.x) < SHIP_W / 2 - 4) {
				b.y = H + 100;
				hitShip();
			}
		}

		// Invaders reaching the ship is the end of the run
		if (state === "play" && invaders.some((i) => i.y + i.h > shipTop)) hitShip();

		if (!invaders.length) nextWave();
	}

	// You only live once
	function hitShip() {
		if (!ship.alive) return;
		ship.alive = false;
		shake = 16;
		burst(ship.x, H - 40, C.accent, 48);
		burst(ship.x, H - 40, C.text, 24);
		quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
		bombs = [];
		shots = [];
		state = "over";
		stateTime = 0;
		if (score > high) {
			high = score;
			saveHigh(high);
		}
	}

	function drawSprite(inv) {
		const px = inv.px || PX;
		const rows = SPRITES[inv.kind][formation.frame];
		ctx.fillStyle = inv.row === 0 ? C.accent : inv.row === 3 ? C.muted : C.text;
		for (let y = 0; y < rows.length; y++) {
			for (let x = 0; x < rows[y].length; x++) {
				if (rows[y][x] === "1") ctx.fillRect(inv.x + x * px, inv.y + y * px, px, px);
			}
		}
	}

	function drawShip() {
		ctx.save();
		ctx.translate(ship.x - SHIP_W / 2, H - 40 - SHIP_H / 2);
		ctx.scale(SHIP_SCALE, SHIP_SCALE);
		ctx.strokeStyle = C.text;
		ctx.lineWidth = 5;
		ctx.lineCap = "round";
		ctx.lineJoin = "round";
		ctx.beginPath();
		ctx.moveTo(17, 13); ctx.lineTo(9, 13); ctx.lineTo(9, 51); ctx.lineTo(17, 51);
		ctx.moveTo(47, 13); ctx.lineTo(55, 13); ctx.lineTo(55, 51); ctx.lineTo(47, 51);
		ctx.stroke();
		ctx.fillStyle = C.accent;
		ctx.shadowColor = C.accent;
		// Each dot is a shot; it dims while that shot is in the air
		const loaded = MAX_SHOTS - shots.length;
		[21.5, 32, 42.5].forEach((cx, i) => {
			ctx.globalAlpha = i < loaded ? 1 : 0.15;
			ctx.shadowBlur = i < loaded ? 10 : 0;
			ctx.beginPath();
			ctx.arc(cx, 32, 4.2, 0, Math.PI * 2);
			ctx.fill();
		});
		ctx.restore();
	}

	function text(str, x, y, { size = 13, col = C.muted, align = "left", weight = 400 } = {}) {
		ctx.font = `${weight} ${size}px ${mono}`;
		ctx.fillStyle = col;
		ctx.textAlign = align;
		ctx.fillText(str, x, y);
	}

	function draw() {
		ctx.clearRect(0, 0, W, H);
		ctx.save();
		if (shake) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);

		for (const inv of invaders) drawSprite(inv);

		ctx.fillStyle = C.accent;
		ctx.shadowColor = C.accent;
		ctx.shadowBlur = 8;
		for (const s of shots) {
			ctx.beginPath();
			ctx.arc(s.x, s.y, 3.5, 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.shadowBlur = 0;

		ctx.strokeStyle = C.text;
		ctx.lineWidth = 2;
		for (const b of bombs) {
			const wig = Math.sin(b.t * 30) * 3;
			ctx.beginPath();
			ctx.moveTo(b.x, b.y - 10);
			ctx.lineTo(b.x + wig, b.y - 5);
			ctx.lineTo(b.x - wig, b.y);
			ctx.stroke();
		}

		for (const s of sparks) {
			ctx.globalAlpha = Math.min(1, s.life * 2);
			ctx.fillStyle = s.col;
			ctx.fillRect(s.x - 1.5, s.y - 1.5, 3, 3);
		}
		ctx.globalAlpha = 1;

		if (state !== "over") drawShip();

		ctx.strokeStyle = C.border;
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(0, H - 8.5);
		ctx.lineTo(W, H - 8.5);
		ctx.stroke();
		ctx.restore();

		const compact = W < 540;
		if (compact) {
			text(`bugs: ${score}`, 14, 28, { size: 12, col: C.text });
			text(`w${wave} · hi ${Math.max(high, score)}`, W / 2 - 14, 28, { size: 12, align: "center" });
			text("YOLO", W - 76, 28, { size: 12, col: C.accent, align: "right", weight: 700 });
		} else {
			text(`bugs squashed: ${score}`, 16, 28, { col: C.text });
			text(`wave ${wave}  ·  best ${Math.max(high, score)}`, W / 2, 28, { align: "center" });
			text("lives: YOLO", W - 90, 28, { col: C.accent, align: "right", weight: 700 });
		}

		if (state === "ready") {
			text(`wave ${wave}`, W / 2, H / 2 + 40, { size: compact ? 24 : 28, col: C.accent, align: "center", weight: 700 });
			text(WAVE_LINES[(wave - 1) % WAVE_LINES.length], W / 2, H / 2 + 68, { size: compact ? 11 : 13, align: "center" });
		}
		if (state === "play" && wave === 1 && stateTime < 4) {
			const hint = touch ? "drag to move · hold to fire" : "← → move  ·  space fire  ·  esc quit";
			text(hint, W / 2, 52, { size: compact ? 12 : 13, align: "center" });
		}
		if (state === "over") {
			text("you only live once", W / 2, H / 2 - 24, { size: compact ? 24 : 40, col: C.accent, align: "center", weight: 700 });
			text(`> ${quip}`, W / 2, H / 2 + 10, { size: compact ? 12 : 13, col: C.text, align: "center" });
			text(`${score} bugs squashed${score >= high && score > 0 ? "  ·  new best" : ""}`, W / 2, H / 2 + 38, { size: compact ? 12 : 13, align: "center" });
			if (stateTime > 0.8) {
				const prompt = compact
					? `${touch ? "tap" : "space"}: continue without permissions`
					: `${touch ? "tap" : "space"}: continue using your agent without accepting permissions`;
				text(prompt, W / 2, H / 2 + 72, { size: compact ? 12 : 13, col: C.accent, align: "center" });
				if (!touch) text("esc: exit", W / 2, H / 2 + 94, { align: "center" });
			}
		}
	}

	let raf = 0;
	let last = performance.now();
	function loop(now) {
		const dt = Math.min(0.05, (now - last) / 1000);
		last = now;
		update(dt);
		draw();
		raf = requestAnimationFrame(loop);
	}

	const KEYMAP = { ArrowLeft: "left", a: "left", A: "left", ArrowRight: "right", d: "right", D: "right", " ": "fire", ArrowUp: "fire", w: "fire", W: "fire" };
	function onKeyDown(e) {
		if (e.key === "Escape") return stop();
		const k = KEYMAP[e.key];
		if (!k) return;
		e.preventDefault();
		if (k !== "fire") pointerX = null;
		if (state === "over" && k === "fire" && stateTime > 0.8) return reset();
		keys.add(k);
	}
	function onKeyUp(e) {
		const k = KEYMAP[e.key];
		if (k) keys.delete(k);
	}
	function onPointer(e) {
		const r = canvas.getBoundingClientRect();
		pointerX = e.clientX - r.left;
	}
	function onPointerDown(e) {
		if (state === "over" && stateTime > 0.8) return reset();
		canvas.setPointerCapture(e.pointerId);
		onPointer(e);
		if (!touch) fire();
	}
	function onPointerUp() {
		if (touch) pointerX = null;
	}
	function onMouseLeave() {
		if (!touch) pointerX = null;
	}

	function stop() {
		cancelAnimationFrame(raf);
		removeEventListener("keydown", onKeyDown);
		removeEventListener("keyup", onKeyUp);
		removeEventListener("resize", resize);
		canvas.remove();
		quit.remove();
		onExit?.();
	}

	addEventListener("keydown", onKeyDown);
	addEventListener("keyup", onKeyUp);
	addEventListener("resize", resize);
	canvas.addEventListener("pointerdown", onPointerDown);
	canvas.addEventListener("pointermove", (e) => (touch ? pointerX !== null && onPointer(e) : onPointer(e)));
	canvas.addEventListener("pointerup", onPointerUp);
	canvas.addEventListener("pointercancel", onPointerUp);
	canvas.addEventListener("mouseleave", onMouseLeave);
	quit.addEventListener("click", stop);

	reset();
	raf = requestAnimationFrame(loop);
	canvas.focus?.();

	return {
		stop,
		// Extra lives are not a thing in YOLO mode
		cheat() {
			shake = 6;
		},
	};
}
