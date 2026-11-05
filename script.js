/* ==========================================================================
   OZS Seguridad — The Shooter · script.js
   Módulos: WhatsApp · cargador · encabezado y menú · revelado de textos ·
   motor de scroll suavizado (escenas fijas, palabras que se encienden,
   paralaje, cinta) · héroe (partículas + visor 3D) · tilt 3D · cursor ·
   preguntas frecuentes · formulario a WhatsApp.
   anime.js (CDN, versión fija) es un complemento: si no carga, todo sigue
   funcionando con CSS y JavaScript propio.
   ========================================================================== */
(function () {
  'use strict';

  /* ------------------------------------------------------------------------
     CONFIGURACIÓN
     Único lugar donde vive el número de WhatsApp (formato internacional sin
     "+": 52 + 10 dígitos). Si queda vacío, el botón flotante y el envío del
     formulario se ocultan con elegancia.
     ------------------------------------------------------------------------ */
  const WHATSAPP = '525560865311';

  window.__ozs = true;

  const doc = document.documentElement;
  const anim = doc.classList.contains('anim');
  const reduce = doc.classList.contains('rm');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const $ = (sel, ctx) => (ctx || document).querySelector(sel);
  const $$ = (sel, ctx) => Array.from((ctx || document).querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max === undefined ? 1 : max, Math.max(min === undefined ? 0 : min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const hasAnime = () => typeof window.anime === 'function';

  function safe(name, fn) {
    try {
      fn();
    } catch (err) {
      if (window.console) {
        console.warn('[OZS] ' + name, err);
      }
    }
  }

  /* Estado compartido del motor de scroll */
  const S = { sy: 0, vel: 0, vh: window.innerHeight, vw: window.innerWidth, docH: 0, raf: 0 };
  const scenes = [];
  let pinned = false;

  const routeEl = $('#cursos');
  const laneEl = $('#campo');

  /* ------------------------------------------------------------------------
     1 · WHATSAPP
     ------------------------------------------------------------------------ */
  function waLink(text) {
    return 'https://wa.me/' + WHATSAPP + '?text=' + encodeURIComponent(text);
  }

  function initWhatsApp() {
    if (!WHATSAPP) {
      doc.classList.add('no-wa');
      return;
    }
    $$('[data-wa]').forEach((a) => {
      const text = a.getAttribute('data-wa-text') || 'Hola, quiero más información sobre OZS Seguridad.';
      a.setAttribute('href', waLink(text));
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });
  }

  /* ------------------------------------------------------------------------
     2 · TEXTOS: palabras con máscara y palabras que se encienden
     ------------------------------------------------------------------------ */
  function wrapWords(root, build) {
    const out = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((child) => {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          child.textContent.split(/(\s+)/).forEach((part) => {
            if (!part) {
              return;
            }
            if (/^\s+$/.test(part)) {
              frag.appendChild(document.createTextNode(' '));
            } else {
              const el = build(part, out.length);
              out.push(el);
              frag.appendChild(el);
            }
          });
          node.replaceChild(frag, child);
        } else if (child.nodeType === 1) {
          if (child.classList.contains('grad')) {
            child.classList.add('grad--split');
          }
          walk(child);
        }
      });
    };
    walk(root);
    return out;
  }

  function buildMask(word, i) {
    const wrap = document.createElement('span');
    wrap.className = 'w';
    const inner = document.createElement('span');
    inner.textContent = word;
    inner.style.setProperty('--i', String(i));
    wrap.appendChild(inner);
    return wrap;
  }

  function buildLit(word) {
    const span = document.createElement('span');
    span.className = 'mw';
    span.textContent = word;
    return span;
  }

  function initSplit() {
    $$('[data-split]').forEach((el) => {
      wrapWords(el, buildMask);
    });
  }

  /* Revelado de bloques al entrar en pantalla */
  function initReveal() {
    $$('[data-stagger]').forEach((group) => {
      group.classList.remove('reveal');
      Array.from(group.children).forEach((child, i) => {
        child.classList.add('reveal');
        child.style.setProperty('--d', (i * 0.09).toFixed(2) + 's');
      });
    });
    const targets = $$('.reveal, [data-split]:not([data-hero])');
    if (!anim || !('IntersectionObserver' in window)) {
      targets.forEach((el) => el.classList.add('is-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.01, rootMargin: '0px 0px -7% 0px' }
    );
    targets.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------------
     3 · CARGADOR (se oculta solo en menos de 2.5 s)
     ------------------------------------------------------------------------ */
  function initLoader(onDone) {
    const loader = $('#loader');
    let finished = false;

    const finish = () => {
      if (finished) {
        return;
      }
      finished = true;
      doc.classList.add('is-ready');
      if (loader) {
        loader.classList.add('is-done');
        window.setTimeout(() => {
          if (loader.parentNode) {
            loader.parentNode.removeChild(loader);
          }
        }, 900);
      }
      onDone();
    };

    if (!loader || !anim) {
      finish();
      return;
    }

    const pctEl = $('#loaderPct');
    const labelEl = $('#loaderLabel');
    const ring = $('#loaderRing');
    const bar = $('#loaderBar');
    const labels = ['Calibrando mira', 'Ajustando precisión', 'Objetivo fijado'];
    const DURATION = 1500;

    const paint = (p) => {
      const v = Math.round(clamp(p, 0, 100));
      if (pctEl) {
        pctEl.textContent = String(v);
      }
      if (ring) {
        ring.style.strokeDashoffset = String(100 - v);
      }
      if (bar) {
        bar.style.transform = 'scaleX(' + v / 100 + ')';
      }
      if (labelEl) {
        labelEl.textContent = labels[v < 40 ? 0 : v < 85 ? 1 : 2];
      }
    };

    if (hasAnime()) {
      const o = { p: 0 };
      window.anime({
        targets: o,
        p: 100,
        duration: DURATION,
        easing: 'easeInOutQuart',
        update: () => paint(o.p),
        complete: finish
      });
    } else {
      const t0 = performance.now();
      const step = (now) => {
        const t = clamp((now - t0) / DURATION);
        paint(easeInOut(t) * 100);
        if (t < 1) {
          requestAnimationFrame(step);
        } else {
          finish();
        }
      };
      requestAnimationFrame(step);
    }

    // Seguridad: pase lo que pase, el cargador no dura más de 2.2 s
    window.setTimeout(finish, 2200);
  }

  /* ------------------------------------------------------------------------
     4 · ENCABEZADO Y MENÚ
     ------------------------------------------------------------------------ */
  let menuOpen = false;

  function initHeader() {
    const header = $('#siteHeader');
    if (!header) {
      return;
    }
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      header.classList.toggle('is-scrolled', y > 40);
      if (!menuOpen) {
        if (y > lastY + 6 && y > 320) {
          header.classList.add('is-hidden');
        } else if (y < lastY - 6 || y < 200) {
          header.classList.remove('is-hidden');
        }
      }
      lastY = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function initMenu() {
    const burger = $('#burger');
    const menu = $('#menu');
    if (!burger || !menu) {
      return;
    }
    $$('.menu__nav a', menu).forEach((a, i) => a.style.setProperty('--i', String(i)));
    const setOpen = (open) => {
      menuOpen = open;
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      menu.setAttribute('aria-hidden', String(!open));
      doc.classList.toggle('menu-open', open);
      if (open) {
        const hd = $('#siteHeader');
        if (hd) {
          hd.classList.remove('is-hidden');
        }
      }
    };
    burger.addEventListener('click', () => setOpen(!menuOpen));
    menu.addEventListener('click', (e) => {
      if (e.target.closest && e.target.closest('a')) {
        setOpen(false);
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuOpen) {
        setOpen(false);
        burger.focus();
      }
    });
    window.addEventListener('resize', () => {
      if (window.innerWidth >= 1100 && menuOpen) {
        setOpen(false);
      }
    });
  }

  /* ------------------------------------------------------------------------
     5 · MOTOR DE SCROLL (valor suavizado = sensación de "motion slow")
     ------------------------------------------------------------------------ */
  function measureAll() {
    S.vh = window.innerHeight;
    S.vw = window.innerWidth;
    S.docH = Math.max(doc.scrollHeight, document.body.scrollHeight);
    scenes.forEach((sc) => {
      if (sc.measure) {
        safe('measure', () => sc.measure());
      }
    });
    requestTick();
  }

  function tick() {
    S.raf = 0;
    const target = window.scrollY || window.pageYOffset || 0;
    const prev = S.sy;
    S.sy += (target - S.sy) * 0.12;
    if (Math.abs(target - S.sy) < 0.25) {
      S.sy = target;
    }
    S.vel = S.sy - prev;
    scenes.forEach((sc) => {
      safe('scene', () => sc.update(S.sy));
    });
    if (S.sy !== target || Math.abs(S.vel) > 0.05) {
      S.raf = requestAnimationFrame(tick);
    }
  }

  function requestTick() {
    if (!S.raf) {
      S.raf = requestAnimationFrame(tick);
    }
  }

  function setPinned() {
    const can = anim && window.innerHeight >= 540;
    if (can === pinned) {
      return;
    }
    pinned = can;
    [routeEl, laneEl].forEach((el) => {
      if (el) {
        el.classList.toggle('is-pinned', pinned);
      }
    });
    scenes.forEach((sc) => {
      if (!pinned && sc.reset) {
        sc.reset();
      }
    });
  }

  /* Barra de progreso de lectura */
  function initProgress() {
    const bar = $('#progressBar');
    if (!bar) {
      return;
    }
    scenes.push({
      update(sy) {
        const max = Math.max(1, S.docH - S.vh);
        bar.style.transform = 'scaleX(' + clamp(sy / max).toFixed(4) + ')';
      }
    });
  }

  /* Cinta: se inclina según la velocidad del scroll */
  function initTicker() {
    const el = $('#tickerSkew');
    if (!el || !anim) {
      return;
    }
    scenes.push({
      update() {
        el.style.setProperty('--sk', clamp(S.vel * -0.3, -7, 7).toFixed(2) + 'deg');
      }
    });
  }

  /* Paralaje del héroe */
  function initHeroParallax() {
    const copy = $('#heroCopy');
    const visual = $('#heroVisual');
    if (!copy || !visual || !anim) {
      return;
    }
    scenes.push({
      update(sy) {
        if (sy > S.vh * 1.4) {
          return;
        }
        copy.style.translate = '0 ' + (sy * 0.1).toFixed(1) + 'px';
        visual.style.translate = '0 ' + (sy * 0.2).toFixed(1) + 'px';
      }
    });
  }

  /* Palabras del manifiesto que se encienden con el scroll */
  function initLit() {
    const title = $('[data-lit]');
    if (!title) {
      return;
    }
    const words = wrapWords(title, buildLit);
    if (!anim) {
      return;
    }
    let last = -1;
    scenes.push({
      top: 0,
      h: 0,
      measure() {
        const r = title.getBoundingClientRect();
        this.top = r.top + window.scrollY;
        this.h = r.height;
      },
      update(sy) {
        const start = this.top - S.vh * 0.88;
        const end = this.top + this.h - S.vh * 0.4;
        const p = clamp((sy - start) / Math.max(1, end - start));
        const n = Math.round(p * words.length);
        if (n !== last) {
          last = n;
          words.forEach((w, i) => w.classList.toggle('is-lit', i < n));
        }
      }
    });
  }

  /* Ruta de precisión: escena fija con 4 pasos y un blanco que se cierra */
  function initRoute() {
    const sec = routeEl;
    if (!sec) {
      return;
    }
    const steps = $$('.rstep', sec);
    const rail = $$('#rail li', sec);
    const disp = $('#targetDisp');
    const shots = $$('#shots .shot');
    const readout = $('#dispText');
    const CFG = [
      { k: 1, label: 'PROTOCOLO', shots: null },
      { k: 0.62, label: 'AMPLIA', shots: [[-92, -58], [74, -84], [108, 38], [-62, 90], [30, -22], [-18, 70]] },
      { k: 0.34, label: 'EN AJUSTE', shots: [[-50, -30], [38, -44], [58, 16], [-26, 48], [10, -10], [-36, 12]] },
      { k: 0.13, label: 'CERRADA', shots: [[-14, -9], [11, -15], [16, 7], [-8, 15], [3, -2], [-17, 4]] }
    ];
    let current = -1;

    const apply = (i) => {
      current = i;
      const cfg = CFG[i];
      steps.forEach((s, n) => s.classList.toggle('is-active', n === i));
      rail.forEach((r, n) => r.classList.toggle('is-on', n <= i));
      if (disp) {
        disp.style.setProperty('--k', String(cfg.k));
      }
      if (readout) {
        readout.textContent = cfg.label;
      }
      shots.forEach((g, n) => {
        if (!cfg.shots) {
          g.classList.add('is-off');
        } else {
          g.classList.remove('is-off');
          g.style.setProperty('--x', cfg.shots[n][0] + 'px');
          g.style.setProperty('--y', cfg.shots[n][1] + 'px');
        }
      });
    };

    scenes.push({
      top: 0,
      h: 0,
      measure() {
        const r = sec.getBoundingClientRect();
        this.top = r.top + window.scrollY;
        this.h = r.height;
      },
      update(sy) {
        if (!pinned) {
          return;
        }
        const p = clamp((sy - this.top) / Math.max(1, this.h - S.vh));
        const i = Math.min(CFG.length - 1, Math.floor(p * CFG.length));
        if (i !== current) {
          apply(i);
        }
      },
      reset() {
        apply(CFG.length - 1);
      }
    });
  }

  /* Línea de tiro: la escena se abre a pantalla completa con el scroll */
  function initLane() {
    const sec = laneEl;
    const intro = $('#laneIntro');
    const content = $('#laneContent');
    if (!sec || !intro || !content) {
      return;
    }
    scenes.push({
      top: 0,
      h: 0,
      measure() {
        const r = sec.getBoundingClientRect();
        this.top = r.top + window.scrollY;
        this.h = r.height;
      },
      update(sy) {
        if (!pinned) {
          return;
        }
        const p = clamp((sy - this.top) / Math.max(1, this.h - S.vh));
        const e = easeInOut(clamp(p / 0.5));
        sec.style.setProperty('--e', e.toFixed(4));
        const fi = clamp(p / 0.26);
        intro.style.opacity = (1 - fi).toFixed(3);
        intro.style.translate = '0 ' + (-fi * 46).toFixed(1) + 'px';
        const fc = clamp((p - 0.5) / 0.2);
        content.style.opacity = fc.toFixed(3);
        content.style.translate = '0 ' + ((1 - fc) * 30).toFixed(1) + 'px';
        content.style.pointerEvents = fc < 0.2 ? 'none' : 'auto';
      },
      reset() {
        sec.style.removeProperty('--e');
        intro.style.opacity = '';
        intro.style.translate = '';
        content.style.opacity = '';
        content.style.translate = '';
        content.style.pointerEvents = '';
      }
    });
  }

  /* Polvo flotante dentro de la escena de la línea de tiro */
  function initDust() {
    const box = $('#laneDust');
    if (!box || reduce) {
      return;
    }
    for (let i = 0; i < 22; i += 1) {
      const dot = document.createElement('i');
      const size = 1 + Math.random() * 2.4;
      dot.style.left = (Math.random() * 100).toFixed(1) + '%';
      dot.style.width = size.toFixed(1) + 'px';
      dot.style.height = size.toFixed(1) + 'px';
      dot.style.animationDuration = (9 + Math.random() * 10).toFixed(1) + 's';
      dot.style.animationDelay = '-' + (Math.random() * 14).toFixed(1) + 's';
      dot.style.setProperty('--dx', ((Math.random() - 0.5) * 80).toFixed(0) + 'px');
      box.appendChild(dot);
    }
  }

  /* Proceso: la línea se dibuja y los pasos se encienden */
  function initSteps() {
    const track = $('#stepsTrack');
    if (!track) {
      return;
    }
    const items = $$('[data-sitem]', track);
    if (!anim) {
      items.forEach((it) => it.classList.add('is-lit'));
      return;
    }
    scenes.push({
      top: 0,
      h: 0,
      measure() {
        const r = track.getBoundingClientRect();
        this.top = r.top + window.scrollY;
        this.h = r.height;
      },
      update(sy) {
        const p = clamp((sy + S.vh * 0.62 - this.top) / Math.max(1, this.h));
        track.style.setProperty('--lp', p.toFixed(4));
        items.forEach((it, i) => {
          const need = (i / Math.max(1, items.length - 1)) * 0.9 + 0.03;
          it.classList.toggle('is-lit', p >= need);
        });
      }
    });
    track.style.setProperty('--lp', '0');
  }

  /* Paralaje genérico: cualquier elemento con data-parallax="0.1" */
  function initParallax() {
    if (!anim) {
      return;
    }
    const items = $$('[data-parallax]').map((el) => ({
      el,
      k: parseFloat(el.getAttribute('data-parallax')) || 0,
      top: 0,
      h: 0,
      ty: 0
    }));
    if (!items.length) {
      return;
    }
    scenes.push({
      measure() {
        items.forEach((it) => {
          const r = it.el.getBoundingClientRect();
          it.top = r.top + window.scrollY - it.ty;
          it.h = r.height;
        });
      },
      update(sy) {
        items.forEach((it) => {
          const d = it.top + it.h / 2 - (sy + S.vh / 2);
          if (Math.abs(d) > S.vh * 1.6 + it.h) {
            return;
          }
          it.ty = d * it.k;
          it.el.style.translate = '0 ' + it.ty.toFixed(1) + 'px';
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     6 · HÉROE: partículas, "bloqueos" de objetivo y visor 3D
     ------------------------------------------------------------------------ */
  function initHero() {
    const hero = $('#inicio');
    const canvas = $('#heroCanvas');
    const scope = $('#scope');
    const cycle = $('#cycleText');
    if (!hero) {
      return;
    }
    const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
    let w = 1;
    let h = 1;
    let nodes = [];
    let locks = [];
    let lastLock = 0;
    let visible = true;
    let raf = 0;
    const mouse = { x: 0, y: 0, on: false };
    const tilt = { x: 0, y: 0, tx: 0, ty: 0 };
    const LINK2 = 130 * 130;

    function resize() {
      if (!ctx) {
        return;
      }
      const r = hero.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, r.width);
      h = Math.max(1, r.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(clamp((w * h) / 20000, 26, 86));
      nodes = [];
      for (let i = 0; i < count; i += 1) {
        nodes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          r: Math.random() * 1.6 + 0.6,
          t: Math.random() * Math.PI * 2
        });
      }
      if (reduce) {
        draw(0);
      }
    }

    function draw(t) {
      if (!ctx) {
        return;
      }
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        if (!reduce) {
          n.x += n.vx;
          n.y += n.vy;
          if (n.x < -20) {
            n.x = w + 20;
          } else if (n.x > w + 20) {
            n.x = -20;
          }
          if (n.y < -20) {
            n.y = h + 20;
          } else if (n.y > h + 20) {
            n.y = -20;
          }
          if (mouse.on) {
            const mx = mouse.x - n.x;
            const my = mouse.y - n.y;
            const md = mx * mx + my * my;
            if (md < 24000) {
              const f = (1 - md / 24000) * 0.012;
              n.x += mx * f;
              n.y += my * f;
            }
          }
        }
      }

      ctx.lineWidth = 1;
      for (let i = 0; i < nodes.length; i += 1) {
        const a = nodes[i];
        for (let j = i + 1; j < nodes.length; j += 1) {
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK2) {
            ctx.strokeStyle = 'rgba(107,191,218,' + ((1 - d2 / LINK2) * 0.32).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
        if (mouse.on) {
          const mx = mouse.x - a.x;
          const my = mouse.y - a.y;
          const md = mx * mx + my * my;
          if (md < 30000) {
            ctx.strokeStyle = 'rgba(166,227,244,' + ((1 - md / 30000) * 0.5).toFixed(3) + ')';
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(mouse.x, mouse.y);
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i];
        const tw = 0.55 + 0.45 * Math.sin(t / 900 + n.t);
        ctx.fillStyle = 'rgba(166,227,244,' + (0.3 + 0.55 * tw).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // "Bloqueo de objetivo": corchetes que se cierran sobre un punto al azar
      if (!reduce) {
        if (t - lastLock > 1700 && nodes.length) {
          lastLock = t;
          locks.push({ n: nodes[Math.floor(Math.random() * nodes.length)], born: t });
          if (locks.length > 3) {
            locks.shift();
          }
        }
        locks = locks.filter((l) => t - l.born < 2200);
        locks.forEach((l) => {
          const age = t - l.born;
          const e = 1 - Math.pow(1 - clamp(age / 700), 3);
          const size = lerp(30, 9, e);
          const alpha = age < 1700 ? 1 : 1 - (age - 1700) / 500;
          const c = 5;
          const x = l.n.x;
          const y = l.n.y;
          ctx.strokeStyle = 'rgba(166,227,244,' + (alpha * 0.9).toFixed(2) + ')';
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(x - size, y - size + c);
          ctx.lineTo(x - size, y - size);
          ctx.lineTo(x - size + c, y - size);
          ctx.moveTo(x + size - c, y - size);
          ctx.lineTo(x + size, y - size);
          ctx.lineTo(x + size, y - size + c);
          ctx.moveTo(x + size, y + size - c);
          ctx.lineTo(x + size, y + size);
          ctx.lineTo(x + size - c, y + size);
          ctx.moveTo(x - size + c, y + size);
          ctx.lineTo(x - size, y + size);
          ctx.lineTo(x - size, y + size - c);
          ctx.stroke();
        });
      }
    }

    function updateTilt(t) {
      if (!scope) {
        return;
      }
      tilt.x += (tilt.tx - tilt.x) * 0.06;
      tilt.y += (tilt.ty - tilt.y) * 0.06;
      const sway = t / 3400;
      const rx = -tilt.y * 13 + Math.sin(sway) * 3.4;
      const ry = tilt.x * 18 + Math.cos(sway * 0.83) * 5.2;
      scope.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      scope.style.setProperty('--ry', ry.toFixed(2) + 'deg');
    }

    function frame(t) {
      raf = 0;
      if (!visible || document.hidden) {
        return;
      }
      draw(t);
      updateTilt(t);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      if (!raf && !reduce) {
        raf = requestAnimationFrame(frame);
      }
    }

    resize();
    if (reduce) {
      draw(0);
    } else {
      start();
    }

    if ('ResizeObserver' in window) {
      let rt = 0;
      new ResizeObserver(() => {
        window.clearTimeout(rt);
        rt = window.setTimeout(resize, 150);
      }).observe(hero);
    } else {
      window.addEventListener('resize', resize);
    }

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => {
          visible = entries[0].isIntersecting;
          if (visible) {
            start();
          }
        },
        { threshold: 0 }
      ).observe(hero);
    }

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        start();
      }
    });

    if (!reduce) {
      hero.addEventListener(
        'pointermove',
        (e) => {
          const r = hero.getBoundingClientRect();
          mouse.x = e.clientX - r.left;
          mouse.y = e.clientY - r.top;
          mouse.on = e.pointerType !== 'touch';
          if (e.pointerType !== 'touch') {
            tilt.tx = (e.clientX - r.left) / r.width - 0.5;
            tilt.ty = (e.clientY - r.top) / r.height - 0.5;
          }
        },
        { passive: true }
      );
      hero.addEventListener('pointerleave', () => {
        mouse.on = false;
        tilt.tx = 0;
        tilt.ty = 0;
      });
    }

    // Texto que cambia: el ciclo del tiro
    if (cycle && !reduce) {
      const words = ['RESPIRA', 'APUNTA', 'CONTROLA', 'DISPARA'];
      let i = 0;
      window.setInterval(() => {
        if (!visible) {
          return;
        }
        i = (i + 1) % words.length;
        cycle.textContent = words[i];
        cycle.classList.remove('flip');
        void cycle.offsetWidth;
        cycle.classList.add('flip');
      }, 1800);
    }
  }

  /* ------------------------------------------------------------------------
     7 · EFECTOS CON anime.js (complemento; la página no depende de él)
     ------------------------------------------------------------------------ */
  function drawOnView(boxSel, targetsSel, delayStep) {
    const box = $(boxSel);
    if (!box || !hasAnime() || !anim || !('IntersectionObserver' in window)) {
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) {
          return;
        }
        io.disconnect();
        window.anime({
          targets: targetsSel,
          strokeDashoffset: [window.anime.setDashoffset, 0],
          easing: 'easeInOutSine',
          duration: 1700,
          delay: window.anime.stagger(delayStep)
        });
      },
      { threshold: 0.25 }
    );
    io.observe(box);
  }

  function initAnimeEffects() {
    drawOnView('#target', '#target .t-ring', 150);
    drawOnView('.shield', '.shield__line:not(.shield__line--in)', 300);
    if (hasAnime() && anim) {
      const arcs = $('#ringArcs');
      if (arcs) {
        window.anime({
          targets: arcs,
          strokeDashoffset: [-520, 0],
          duration: 2600,
          delay: 1400,
          easing: 'easeOutExpo'
        });
      }
    }
  }

  /* ------------------------------------------------------------------------
     8 · INTERACCIÓN: tilt 3D, botones magnéticos, cursor
     ------------------------------------------------------------------------ */
  function initTilt() {
    if (!finePointer || reduce) {
      return;
    }
    $$('[data-tilt]').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        if (raf) {
          return;
        }
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        raf = requestAnimationFrame(() => {
          raf = 0;
          el.style.setProperty('--ry', ((x - 0.5) * 14).toFixed(2) + 'deg');
          el.style.setProperty('--rx', ((0.5 - y) * 12).toFixed(2) + 'deg');
          el.style.setProperty('--gx', (x * 100).toFixed(1) + '%');
          el.style.setProperty('--gy', (y * 100).toFixed(1) + '%');
        });
      });
      el.addEventListener('pointerleave', () => {
        el.style.setProperty('--rx', '0deg');
        el.style.setProperty('--ry', '0deg');
      });
    });
  }

  function initMagnetic() {
    if (!finePointer || reduce) {
      return;
    }
    $$('[data-magnetic]').forEach((btn) => {
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        btn.style.translate = (x * 0.2).toFixed(1) + 'px ' + (y * 0.3).toFixed(1) + 'px';
      });
      btn.addEventListener('pointerleave', () => {
        btn.style.translate = '';
      });
    });
  }

  function initCursor() {
    if (!finePointer || reduce) {
      return;
    }
    const el = document.createElement('div');
    el.className = 'cursor';
    el.setAttribute('aria-hidden', 'true');
    document.body.appendChild(el);
    let x = 0;
    let y = 0;
    let tx = 0;
    let ty = 0;
    let on = false;
    let raf = 0;
    const loop = () => {
      x += (tx - x) * 0.18;
      y += (ty - y) * 0.18;
      el.style.transform = 'translate3d(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px,0)';
      raf = Math.abs(tx - x) > 0.1 || Math.abs(ty - y) > 0.1 ? requestAnimationFrame(loop) : 0;
    };
    window.addEventListener(
      'pointermove',
      (e) => {
        if (e.pointerType === 'touch') {
          return;
        }
        tx = e.clientX;
        ty = e.clientY;
        if (!on) {
          on = true;
          x = tx;
          y = ty;
          el.classList.add('is-on');
        }
        if (!raf) {
          raf = requestAnimationFrame(loop);
        }
      },
      { passive: true }
    );
    doc.addEventListener('mouseleave', () => {
      on = false;
      el.classList.remove('is-on');
    });
    document.addEventListener('pointerover', (e) => {
      const hit = e.target && e.target.closest ? e.target.closest('a, button, input, select, textarea, [data-tilt]') : null;
      el.classList.toggle('is-hover', Boolean(hit));
    });
  }

  /* ------------------------------------------------------------------------
     9 · BENTO: reglas de seguridad que se iluminan una a una
     ------------------------------------------------------------------------ */
  function initRules() {
    const items = $$('#rules li');
    const tile = $('#tileRules');
    if (!items.length || !tile || reduce) {
      return;
    }
    let seen = true;
    let i = 0;
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(
        (entries) => {
          seen = entries[0].isIntersecting;
        },
        { threshold: 0.2 }
      ).observe(tile);
    }
    window.setInterval(() => {
      if (!seen) {
        return;
      }
      items[i].classList.remove('is-on');
      i = (i + 1) % items.length;
      items[i].classList.add('is-on');
    }, 2400);
  }

  /* ------------------------------------------------------------------------
     10 · PREGUNTAS FRECUENTES
     ------------------------------------------------------------------------ */
  function initFaq() {
    const buttons = $$('.faq__q button');
    if (!buttons.length) {
      return;
    }
    const setItem = (item, open) => {
      item.classList.toggle('is-open', open);
      const b = item.querySelector('button');
      if (b) {
        b.setAttribute('aria-expanded', String(open));
      }
    };
    buttons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const item = btn.closest('.faq__item');
        const open = !item.classList.contains('is-open');
        $$('.faq__item.is-open').forEach((o) => {
          if (o !== item) {
            setItem(o, false);
          }
        });
        setItem(item, open);
        window.setTimeout(measureAll, 620);
      });
    });
    const first = $('.faq__item');
    if (first) {
      setItem(first, true);
    }
  }

  /* ------------------------------------------------------------------------
     11 · FORMULARIO → WHATSAPP
     ------------------------------------------------------------------------ */
  function initForm() {
    const form = $('#contactForm');
    const status = $('#formStatus');
    if (!form || !status) {
      return;
    }
    const nombre = $('#f-nombre');
    const interes = $('#f-interes');
    const tel = $('#f-tel');
    const msg = $('#f-msg');

    const setErr = (key, text) => {
      const holder = form.querySelector('[data-err="' + key + '"]');
      if (!holder) {
        return;
      }
      holder.textContent = text || '';
      const field = holder.closest('.field');
      if (field) {
        field.classList.toggle('is-invalid', Boolean(text));
      }
    };

    if (!WHATSAPP) {
      status.textContent = 'Por ahora, escríbenos por teléfono o por Instagram.';
    }

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!WHATSAPP) {
        return;
      }
      let ok = true;
      const name = nombre.value.trim();
      setErr('nombre', '');
      setErr('interes', '');
      if (name.length < 2) {
        setErr('nombre', 'Escribe tu nombre para saber cómo llamarte.');
        ok = false;
      }
      if (!interes.value) {
        setErr('interes', 'Elige qué te interesa.');
        ok = false;
      }
      if (!ok) {
        status.textContent = 'Revisa los campos marcados.';
        const bad = form.querySelector('.is-invalid input, .is-invalid select');
        if (bad) {
          bad.focus();
        }
        return;
      }
      const lines = ['Hola, soy ' + name + '. Me interesa ' + interes.value + '.'];
      if (msg.value.trim()) {
        lines.push(msg.value.trim());
      }
      if (tel.value.trim()) {
        lines.push('Mi teléfono: ' + tel.value.trim());
      }
      lines.push('Quiero más información, por favor.');
      const url = waLink(lines.join('\n'));
      window.open(url, '_blank', 'noopener');
      status.textContent = 'Listo, ' + name + '. Abriendo WhatsApp…';
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = 'Si no se abre, toca aquí.';
      status.appendChild(link);
    });
  }

  /* ------------------------------------------------------------------------
     INICIO
     ------------------------------------------------------------------------ */
  function onReady() {
    safe('hero', initHero);
    safe('anime', initAnimeEffects);
  }

  function boot() {
    // Respaldo: aunque algo falle más abajo, el contenido se muestra antes de 3 s
    window.setTimeout(() => doc.classList.add('is-ready'), 3000);

    safe('whatsapp', initWhatsApp);
    safe('split', initSplit);
    safe('reveal', initReveal);
    safe('header', initHeader);
    safe('menu', initMenu);
    safe('progress', initProgress);
    safe('ticker', initTicker);
    safe('heroParallax', initHeroParallax);
    safe('lit', initLit);
    safe('route', initRoute);
    safe('lane', initLane);
    safe('dust', initDust);
    safe('steps', initSteps);
    safe('parallax', initParallax);
    safe('tilt', initTilt);
    safe('magnetic', initMagnetic);
    safe('cursor', initCursor);
    safe('rules', initRules);
    safe('faq', initFaq);
    safe('form', initForm);

    S.sy = window.scrollY || 0;
    safe('pin', setPinned);
    measureAll();
    window.addEventListener('scroll', requestTick, { passive: true });

    let rt = 0;
    const onResize = () => {
      window.clearTimeout(rt);
      rt = window.setTimeout(() => {
        safe('pin', setPinned);
        measureAll();
      }, 120);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('load', onResize);
    if ('ResizeObserver' in window) {
      new ResizeObserver(onResize).observe(document.body);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(onResize);
    }

    initLoader(onReady);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
