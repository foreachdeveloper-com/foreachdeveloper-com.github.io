(() => {
	const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;
	const fine = matchMedia("(pointer: fine)").matches;
	const toast = document.querySelector(".toast");

	// Reveal on scroll; children of [data-stagger] come in one after another
	document.querySelectorAll("[data-stagger]").forEach((group) => {
		[...group.querySelectorAll(":scope > [data-reveal]")].forEach((el, i) => {
			el.style.setProperty("--stagger", `${i * 90}ms`);
		});
	});

	const revealer = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			const el = entry.target;
			el.classList.add("in");
			el.addEventListener("transitionend", () => {
				el.style.setProperty("--stagger", "0ms");
				el.classList.add("done");
			}, { once: true });
			revealer.unobserve(el);
		}
	}, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" });
	document.querySelectorAll("[data-reveal]").forEach((el) => revealer.observe(el));

	// Kicker types itself out
	const typed = document.querySelector("[data-type]");
	if (typed && !calm) {
		const text = typed.dataset.type;
		typed.textContent = "";
		let i = 0;
		setTimeout(function type() {
			typed.textContent = text.slice(0, ++i);
			if (i < text.length) setTimeout(type, 35 + Math.random() * 50);
		}, 500);
	}

	// for each <word>
	const rot = document.querySelector(".rot");
	if (rot && !calm) {
		const words = rot.dataset.words.split("|");
		let w = 0;
		const wait = (ms) => new Promise((r) => setTimeout(r, ms));
		(async function cycle() {
			await wait(2600);
			for (;;) {
				const word = rot.textContent;
				for (let n = word.length; n >= 0; n--) {
					rot.textContent = word.slice(0, n);
					await wait(45);
				}
				w = (w + 1) % words.length;
				const next = words[w];
				for (let n = 1; n <= next.length; n++) {
					rot.textContent = next.slice(0, n);
					await wait(80);
				}
				await wait(w === 0 ? 3200 : 1800);
			}
		})();
	}

	// Count-up stats
	const counter = new IntersectionObserver((entries) => {
		for (const entry of entries) {
			if (!entry.isIntersecting) continue;
			const el = entry.target;
			const to = Number(el.dataset.count);
			const from = Number(el.dataset.from || 0);
			const start = performance.now();
			const ms = 1400;
			requestAnimationFrame(function tick(now) {
				const t = Math.min(1, (now - start) / ms);
				el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
				if (t < 1) requestAnimationFrame(tick);
			});
			counter.unobserve(el);
		}
	}, { threshold: 0.6 });
	if (!calm) document.querySelectorAll("[data-count]").forEach((el) => counter.observe(el));

	// Cards lean toward the pointer and light up under it
	if (fine && !calm) {
		document.querySelectorAll(".card").forEach((card) => {
			card.addEventListener("pointermove", (e) => {
				const r = card.getBoundingClientRect();
				const x = (e.clientX - r.left) / r.width;
				const y = (e.clientY - r.top) / r.height;
				card.style.setProperty("--mx", `${x * 100}%`);
				card.style.setProperty("--my", `${y * 100}%`);
				card.style.setProperty("--rx", `${(0.5 - y) * 5}deg`);
				card.style.setProperty("--ry", `${(x - 0.5) * 5}deg`);
			});
			card.addEventListener("pointerleave", () => {
				card.style.setProperty("--rx", "0deg");
				card.style.setProperty("--ry", "0deg");
			});
		});

		const hero = document.querySelector(".hero");
		addEventListener("pointermove", (e) => {
			hero.style.setProperty("--px", (e.clientX / innerWidth - 0.5).toFixed(3));
			hero.style.setProperty("--py", (e.clientY / innerHeight - 0.5).toFixed(3));
		}, { passive: true });
	}

	// Toasts
	let toastTimer;
	function say(html) {
		toast.innerHTML = html;
		requestAnimationFrame(() => toast.classList.add("show"));
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => toast.classList.remove("show"), 4200);
	}

	function burst(x, y) {
		if (calm) return;
		for (let i = 0; i < 28; i++) {
			const s = document.createElement("span");
			const a = Math.random() * Math.PI * 2;
			const d = 80 + Math.random() * 180;
			s.className = "spark";
			s.style.left = `${x}px`;
			s.style.top = `${y}px`;
			s.style.setProperty("--tx", `${Math.cos(a) * d}px`);
			s.style.setProperty("--ty", `${Math.sin(a) * d}px`);
			s.style.opacity = String(0.4 + Math.random() * 0.6);
			document.body.append(s);
			s.addEventListener("animationend", () => s.remove());
		}
	}

	// Scroll progress, plus a small reward for reaching the end
	const bar = document.querySelector(".xp");
	let unlocked = false;
	try { unlocked = sessionStorage.getItem("fe-end") === "1"; } catch {}
	function onScroll() {
		const max = document.documentElement.scrollHeight - innerHeight;
		const p = max > 0 ? Math.min(1, scrollY / max) : 0;
		bar.style.setProperty("--progress", p.toFixed(4));
		if (p > 0.985 && !unlocked) {
			unlocked = true;
			try { sessionStorage.setItem("fe-end", "1"); } catch {}
			say("<b>★ Achievement unlocked</b> Read the whole loop. Thanks for stopping by.");
		}
	}
	addEventListener("scroll", onScroll, { passive: true });
	onScroll();

	// Three quick clicks on the big mark fill the array and start the game
	const heroEl = document.querySelector(".hero");
	const heroMark = document.querySelector(".hero-mark");
	const dots = heroMark ? [...heroMark.querySelectorAll("circle")] : [];
	let game = null;
	let charge = 0;
	let chargeTimer;
	function discharge() {
		charge = 0;
		dots.forEach((d) => d.classList.remove("lit"));
		heroMark.classList.remove("charged");
	}
	heroMark?.addEventListener("click", async () => {
		if (game) return;
		clearTimeout(chargeTimer);
		dots[charge]?.classList.add("lit");
		charge++;
		heroMark.classList.remove("bump");
		void heroMark.getBoundingClientRect();
		heroMark.classList.add("bump");
		if (charge < dots.length) {
			chargeTimer = setTimeout(discharge, 700);
			return;
		}
		heroMark.classList.add("charged");
		const { start } = await import("/game.js");
		heroEl.classList.add("playing");
		game = start(heroEl, heroMark, () => {
			game = null;
			heroEl.classList.remove("playing");
			discharge();
		});
		say("<b>YOLO mode on.</b> One life, no confirmations. ← → move, space fire.");
	});

	// ↑ ↑ ↓ ↓ ← → ← → B A
	const code = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
	let pos = 0;
	addEventListener("keydown", (e) => {
		const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
		pos = key === code[pos] ? pos + 1 : key === code[0] ? 1 : 0;
		if (pos === code.length) {
			pos = 0;
			burst(innerWidth / 2, innerHeight / 2);
			if (game) {
				game.cheat();
				say("<b>Permission denied.</b> YOLO means YOLO.");
			} else {
				say("<b>Player two has joined.</b> +30 lives. Go build something.");
			}
		}
	});
})();
