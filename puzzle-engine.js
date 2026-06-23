const PuzzleEngine = (() => {
  let activeCleanup = null;

  function unmount() {
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
  }

  function mount(container, puzzle, { onSolved }) {
    unmount();
    container.innerHTML = "";

    const type = puzzle.type || "text";
    if (type === "slide") {
      activeCleanup = mountSlidePuzzle(container, puzzle, onSolved);
    } else if (type === "gears") {
      activeCleanup = mountGearPuzzle(container, puzzle, onSolved);
    } else if (type === "cipher") {
      activeCleanup = mountCipherPuzzle(container, puzzle);
    }
  }

  function mountSlidePuzzle(container, puzzle, onSolved) {
    const config = puzzle.interactive || {};
    const columns = config.columns || 3;
    const goal = config.goal || defaultSlideGoal(columns);
    const labels = config.tileLabels || goal.filter(v => v !== 0).map(String);
    let board = (config.initial || scrambleSlideGoal(goal, columns)).slice();

    const wrap = document.createElement("div");
    wrap.className = "slide-puzzle";
    wrap.style.setProperty("--slide-cols", columns);

    const grid = document.createElement("div");
    grid.className = "slide-grid";
    grid.setAttribute("role", "grid");
    grid.setAttribute("aria-label", "Sliding tile puzzle");

    function labelFor(value) {
      if (!value) return "";
      return labels[value - 1] ?? String(value);
    }

    function emptyIndex() {
      return board.indexOf(0);
    }

    function isAdjacent(a, b) {
      const cols = columns;
      const ar = Math.floor(a / cols);
      const ac = a % cols;
      const br = Math.floor(b / cols);
      const bc = b % cols;
      return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
    }

    function checkSolved() {
      if (board.every((value, index) => value === goal[index])) {
        grid.classList.add("slide-solved");
        setTimeout(() => onSolved(), 450);
      }
    }

    function render() {
      grid.innerHTML = "";
      board.forEach((value, index) => {
        const tile = document.createElement("button");
        tile.type = "button";
        tile.className = "slide-tile" + (value === 0 ? " slide-empty" : "");
        tile.dataset.index = String(index);
        tile.disabled = value === 0;

        if (value !== 0) {
          tile.innerHTML = `
            <span class="slide-tile-label">${escapePuzzleHtml(labelFor(value))}</span>
            <span class="slide-tile-caption">SPECIMEN</span>`;
          tile.addEventListener("click", () => {
            const empty = emptyIndex();
            if (!isAdjacent(index, empty)) {
              tile.classList.add("slide-denied");
              setTimeout(() => tile.classList.remove("slide-denied"), 220);
              return;
            }
            board[empty] = value;
            board[index] = 0;
            render();
            checkSolved();
          });
        }

        grid.appendChild(tile);
      });
    }

    wrap.appendChild(grid);
    container.appendChild(wrap);
    render();

    return () => {
      container.innerHTML = "";
    };
  }

  function mountGearPuzzle(container, puzzle, onSolved) {
    const config = puzzle.interactive || {};
    const sharedWheel = config.wheel || null;
    const dials = (config.dials || []).map(dial => {
      const values = dial.values || sharedWheel || ["●", "◆", "▲", "■"];
      return {
        label: dial.label || "VALVE",
        values,
        index: normalizeIndex(dial.start, values.length),
        target: normalizeIndex(dial.target, values.length)
      };
    });

    const links = (config.links || []).map(link => ({
      master: link.master,
      slave: link.slave,
      delta: link.delta ?? -1
    }));

    const state = dials.map(d => ({ ...d }));
    const dialElements = [];

    const wrap = document.createElement("div");
    wrap.className = "gear-puzzle";

    const row = document.createElement("div");
    row.className = "gear-row";

    const errorEl = document.createElement("p");
    errorEl.className = "gear-error hidden";
    errorEl.setAttribute("role", "alert");
    errorEl.textContent = "Pressure mismatch — recheck Dr. Wu's valve notes.";

    const verifyBtn = document.createElement("button");
    verifyBtn.type = "button";
    verifyBtn.className = "gear-verify-btn";
    verifyBtn.textContent = "VERIFY PRESSURE";

    function rotateDial(dialIndex, step) {
      const dial = state[dialIndex];
      dial.index = normalizeIndex(dial.index + step, dial.values.length);
      links.forEach(link => {
        if (link.master === dialIndex) {
          const slave = state[link.slave];
          slave.index = normalizeIndex(slave.index + link.delta * step, slave.values.length);
        }
      });
    }

    function renderDial(dial, dialEl) {
      dialEl.querySelector(".gear-value").textContent = dial.values[dial.index];
    }

    function renderAll() {
      state.forEach((dial, i) => renderDial(dial, dialElements[i]));
    }

    function isSolved() {
      return state.every(dial => dial.index === dial.target);
    }

    function verify() {
      errorEl.classList.add("hidden");
      row.classList.remove("gear-shake");

      if (isSolved()) {
        wrap.classList.add("gear-solved");
        verifyBtn.disabled = true;
        setTimeout(() => onSolved(), 450);
        return;
      }

      errorEl.classList.remove("hidden");
      row.classList.add("gear-shake");
      setTimeout(() => row.classList.remove("gear-shake"), 500);
    }

    state.forEach((dial, dialIndex) => {
      const dialEl = document.createElement("button");
      dialEl.type = "button";
      dialEl.className = "gear-dial";
      dialEl.innerHTML = `
        <span class="gear-marker" aria-hidden="true"></span>
        <span class="gear-ring">
          <span class="gear-value"></span>
        </span>
        <span class="gear-label">${escapePuzzleHtml(dial.label)}</span>`;

      dialEl.addEventListener("click", () => {
        errorEl.classList.add("hidden");
        rotateDial(dialIndex, 1);
        renderAll();
      });

      dialElements.push(dialEl);
      row.appendChild(dialEl);
    });

    verifyBtn.addEventListener("click", verify);

    wrap.appendChild(row);
    wrap.appendChild(errorEl);
    wrap.appendChild(verifyBtn);
    container.appendChild(wrap);
    renderAll();

    return () => {
      container.innerHTML = "";
    };
  }

  function mountCipherPuzzle(container, puzzle) {
    const config = puzzle.cipher || {};
    const ciphertext = config.ciphertext || "";
    const spaced = config.displaySpaced || chunkCiphertext(ciphertext);

    const wrap = document.createElement("div");
    wrap.className = "cipher-puzzle";

    const label = document.createElement("div");
    label.className = "cipher-label";
    label.textContent = config.label || "ENCRYPTED TRANSMISSION // RECOVERED";

    const block = document.createElement("pre");
    block.className = "cipher-text";
    block.textContent = spaced;

    wrap.appendChild(label);
    wrap.appendChild(block);

    if (config.showAlphabet !== false) {
      const ref = document.createElement("div");
      ref.className = "cipher-alphabet";
      ref.textContent = "A B C D E F G H I J K L M N O P Q R S T U V W X Y Z";
      wrap.appendChild(ref);
    }

    container.appendChild(wrap);

    return () => {
      container.innerHTML = "";
    };
  }

  function chunkCiphertext(text) {
    return String(text).replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
  }

  function defaultSlideGoal(columns) {
    const size = columns * columns;
    const goal = [];
    for (let i = 1; i < size; i += 1) goal.push(i);
    goal.push(0);
    return goal;
  }

  function scrambleSlideGoal(goal, columns) {
    let board = goal.slice();
    const empty = () => board.indexOf(0);

    function isAdjacent(a, b) {
      const ar = Math.floor(a / columns);
      const ac = a % columns;
      const br = Math.floor(b / columns);
      const bc = b % columns;
      return Math.abs(ar - br) + Math.abs(ac - bc) === 1;
    }

    for (let move = 0; move < 40; move += 1) {
      const e = empty();
      const neighbors = [];
      for (let i = 0; i < board.length; i += 1) {
        if (isAdjacent(i, e)) neighbors.push(i);
      }
      const pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      board[e] = board[pick];
      board[pick] = 0;
    }

    if (board.every((value, index) => value === goal[index])) {
      return scrambleSlideGoal(goal, columns);
    }
    return board;
  }

  function normalizeIndex(value, length) {
    const n = Number(value) || 0;
    return ((n % length) + length) % length;
  }

  function escapePuzzleHtml(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  return { mount, unmount };
})();

window.PuzzleEngine = PuzzleEngine;
