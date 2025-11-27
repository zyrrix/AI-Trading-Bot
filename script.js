document.addEventListener("DOMContentLoaded", () => {
  initNav();
  initWallet();
  initTradingBot();
  initMarket();
});

/* NAV BETWEEN SECTIONS */
function initNav() {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".page-section");

  navLinks.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");
      navLinks.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      sections.forEach((s) => {
        s.classList.toggle("active", s.id === target);
      });
    });
  });
}

/* METAMASK WALLET (READ-ONLY) */
function initWallet() {
  const connectBtn = document.getElementById("connectButton");
  const disconnectBtn = document.getElementById("disconnectButton");
  const walletLabel = document.getElementById("walletLabel");
  const walletAddressEl = document.getElementById("walletAddress");
  const statusBanner = document.getElementById("globalStatus");

  let currentAccount = null;

  function shortAddr(addr) {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  function setStatusBanner(type, text) {
    statusBanner.className = "status-banner " + type;
    statusBanner.innerHTML =
      `<i class="fas fa-circle-${type === "error" ? "exclamation" : type === "success" ? "check" : "info"}"></i>` +
      `<span>${text}</span>`;
  }

  async function connect() {
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install it first.");
      setStatusBanner(
        "error",
        "MetaMask not detected in this browser. Install it to use wallet features."
      );
      return;
    }

    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      if (!accounts || accounts.length === 0) {
        setStatusBanner("error", "No account selected in MetaMask.");
        return;
      }

      currentAccount = accounts[0];
      walletLabel.textContent = "Connected Wallet";
      walletAddressEl.textContent = currentAccount
        ? shortAddr(currentAccount)
        : "";
      connectBtn.style.display = "none";
      disconnectBtn.style.display = "inline-flex";

      setStatusBanner(
        "success",
        "Wallet connected (read-only). No transactions will be sent from this UI."
      );

      window.ethereum.on("accountsChanged", (accs) => {
        if (!accs || accs.length === 0) {
          currentAccount = null;
          walletLabel.textContent = "Wallet not connected";
          walletAddressEl.textContent = "";
          connectBtn.style.display = "inline-flex";
          disconnectBtn.style.display = "none";
          setStatusBanner("info", "Wallet disconnected. Reconnect to resume.");
        } else {
          currentAccount = accs[0];
          walletAddressEl.textContent = shortAddr(currentAccount);
          setStatusBanner(
            "success",
            "Account changed. Simulation still only runs locally."
          );
        }
      });
    } catch (err) {
      console.error("MetaMask connect error:", err);
      setStatusBanner("error", "Failed to connect MetaMask.");
    }
  }

  function disconnect() {
    currentAccount = null;
    walletLabel.textContent = "Wallet not connected";
    walletAddressEl.textContent = "";
    connectBtn.style.display = "inline-flex";
    disconnectBtn.style.display = "none";
    setStatusBanner("info", "Wallet disconnected. Simulation remains local.");
  }

  connectBtn.addEventListener("click", connect);
  disconnectBtn.addEventListener("click", disconnect);
}

/* TRADING BOT SIMULATION (SAFE / LOCAL ONLY) */
function initTradingBot() {
  // Elements
  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");

  const pairSelect = document.getElementById("pairSelect");
  const riskSelect = document.getElementById("riskSelect");
  const capitalInput = document.getElementById("capitalInput");
  const applyConfigBtn = document.getElementById("applyConfig");
  const toggleBotBtn = document.getElementById("toggleBot");
  const configStatus = document.getElementById("configStatus");

  const volValue = document.getElementById("volValue");
  const regimeText = document.getElementById("regimeText");
  const volComment = document.getElementById("volComment");
  const volRefresh = document.getElementById("volRefresh");

  const botSnapshot = document.getElementById("botSnapshot");
  const statusChip = document.getElementById("statusChip");
  const statusChipText = document.getElementById("statusChipText");
  const lastCycleText = document.getElementById("lastCycleText");

  const livePulse = document.getElementById("livePulse");
  const liveStatusText = document.getElementById("liveStatusText");
  const pnlValue = document.getElementById("pnlValue");
  const pnlNote = document.getElementById("pnlNote");
  const cycleValue = document.getElementById("cycleValue");
  const cycleCountEl = document.getElementById("cycleCount");
  const sharpeValueEl = document.getElementById("sharpeValue");
  const tradeLog = document.getElementById("tradeLog");
  const withdrawBtn = document.getElementById("withdrawBtn");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const closeModal = document.getElementById("closeModal");

  // State
  let configApplied = false;
  let botRunning = false;

  let virtualCapital = 5000;
  let totalPnLPercent = 0;
  let wins = 0;
  let losses = 0;
  let cycles = 0;

  let volInterval = null;
  let volCountdownInterval = null;
  let simInterval = null;

  /* Helpers */

  function setStepState() {
    step1.classList.remove("active", "completed");
    step2.classList.remove("active", "completed");
    step3.classList.remove("active", "completed");

    // Step 1: connect (we treat it as always possible now)
    step1.classList.add("completed");

    // Step 2: config
    if (configApplied) {
      step2.classList.add("completed");
    } else {
      step2.classList.add("active");
      return;
    }

    // Step 3: bot
    if (botRunning) {
      step3.classList.add("completed");
    } else {
      step3.classList.add("active");
    }
  }

  function logTrade(messageHtml) {
    const row = document.createElement("div");
    row.className = "trade-row";
    const time = new Date().toLocaleTimeString();
    row.innerHTML = `<span class="time-tag">[${time}]</span> ${messageHtml}`;
    tradeLog.prepend(row);
    if (tradeLog.children.length > 120) {
      tradeLog.removeChild(tradeLog.lastChild);
    }
  }

  function updateStatsUI() {
    const sign = totalPnLPercent >= 0 ? "+" : "";
    pnlValue.textContent = `${sign}${totalPnLPercent.toFixed(2)}%`;
    pnlValue.classList.toggle("green", totalPnLPercent >= 0);

    pnlNote.textContent = `On ${virtualCapital.toLocaleString()} USDT of simulated capital.`;

    const totalTrades = wins + losses || 1;
    const winRate = (wins / totalTrades) * 100;

    cycleValue.textContent = `${wins} wins · ${losses} losses`;
    cycleCountEl.textContent = cycles.toString();

    const rawSharpe = Math.min(Math.max((winRate - 50) / 10, -1), 4);
    const sharpe = rawSharpe + (Math.random() * 0.4 - 0.2);
    sharpeValueEl.textContent = sharpe.toFixed(1);
  }

  function refreshVolatility() {
    const risk = riskSelect.value || "balanced";
    let baseVol;
    if (risk === "conservative") baseVol = randBetween(4, 12, 1);
    else if (risk === "balanced") baseVol = randBetween(8, 18, 1);
    else baseVol = randBetween(12, 28, 1);

    volValue.textContent = `${baseVol.toFixed(1)}%`;

    let regime;
    let comment;
    if (baseVol < 8) {
      regime = "Calm";
      comment = "Low volatility — mean-reversion friendly.";
    } else if (baseVol < 16) {
      regime = "Normal";
      comment = "Moderate volatility — trend & pullbacks both viable.";
    } else {
      regime = "Explosive";
      comment = "High volatility — tight risk management crucial.";
    }

    const pair = pairSelect.value || "BTC/USDT";
    regimeText.innerHTML = `Regime: <strong>${regime}</strong> · Simulated ${pair} cluster`;
    volComment.textContent = comment;
  }

  function startVolTimers() {
    if (volInterval) clearInterval(volInterval);
    if (volCountdownInterval) clearInterval(volCountdownInterval);

    let countdown = 3;
    volRefresh.textContent = countdown + "s";

    volInterval = setInterval(() => {
      refreshVolatility();
      countdown = 3;
    }, 3000);

    volCountdownInterval = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) countdown = 3;
      volRefresh.textContent = countdown + "s";
    }, 1000);
  }

  function stopVolTimers() {
    if (volInterval) clearInterval(volInterval);
    if (volCountdownInterval) clearInterval(volCountdownInterval);
  }

  function randBetween(min, max, decimals = 2) {
    const val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals));
  }

  function setConfigStatus(type, text) {
    configStatus.className = "status-banner " + type;
    configStatus.innerHTML =
      `<i class="fas fa-circle-${type === "error" ? "exclamation" : type === "success" ? "check" : "info"}"></i>` +
      `<span>${text}</span>`;
  }

  /* Apply Configuration */
  function applyConfiguration() {
    const cap = parseFloat(capitalInput.value || "0");
    if (!cap || cap < 100) {
      setConfigStatus(
        "error",
        "Please set at least 100 USDT of simulated capital."
      );
      return;
    }

    virtualCapital = cap;
    configApplied = true;
    setStepState();

    const pair = pairSelect.value;
    const risk = riskSelect.value.toUpperCase();

    botSnapshot.textContent = `Configured · ${pair} · ${risk}`;
    lastCycleText.textContent = "not started";

    toggleBotBtn.disabled = false;
    toggleBotBtn.innerHTML = '<i class="fas fa-play"></i> Start Bot';

    setConfigStatus(
      "success",
      "Configuration applied. You can now start the simulation bot."
    );

    refreshVolatility();
    startVolTimers();
    updateStatsUI();
  }

  /* Start Simulation */
  function startBot() {
    if (!configApplied) {
      applyConfiguration();
      if (!configApplied) return;
    }

    if (simInterval) clearInterval(simInterval);

    botRunning = true;
    setStepState();

    livePulse.classList.remove("muted");
    liveStatusText.textContent = "Simulation running";

    statusChip.classList.remove("inactive");
    statusChip.classList.add("active");
    statusChipText.textContent = "ONLINE";

    toggleBotBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Bot';

    const pair = pairSelect.value;
    const risk = riskSelect.value.toUpperCase();
    botSnapshot.textContent = `Running · ${pair} · ${risk}`;

    logTrade(
      `<span class="type-info">Simulation started with ${pair} · ${risk} · ${virtualCapital.toLocaleString()} USDT.</span>`
    );

    if (!volInterval) {
      refreshVolatility();
      startVolTimers();
    }

    simInterval = setInterval(() => {
      if (!botRunning) return;

      const tradesInCycle = Math.floor(Math.random() * 3) + 1;
      cycles += 1;
      lastCycleText.textContent = `cycle #${cycles}`;

      for (let i = 0; i < tradesInCycle; i++) {
        const side = Math.random() > 0.5 ? "BUY" : "SELL";
        const baseAsset = pairSelect.value.split("/")[0];
        const size = randBetween(0.02, 0.35, 3);
        const entry = randBetween(100, 70000, 2);
        const exitSpread = randBetween(-0.9, 0.9, 2);
        const exit = entry + exitSpread;

        // Slight positive bias for fun
        const profitPct = randBetween(-0.6, 0.8, 2);
        const profitAbs = virtualCapital * (profitPct / 100) * 0.02;

        const sideClass = side === "BUY" ? "profit" : "loss";
        const baseHtml =
          `<span class="${sideClass}">${side}</span> ${size} ${baseAsset} @ ${entry.toFixed(
            2
          )} → ${exit.toFixed(2)} · `;

        if (profitPct >= 0) {
          wins += 1;
          totalPnLPercent += profitPct * 0.1;
          logTrade(
            `${baseHtml}<span class="profit">+${profitPct.toFixed(
              2
            )}%</span> (~${profitAbs.toFixed(2)} USDT)`
          );
        } else {
          losses += 1;
          totalPnLPercent += profitPct * 0.1;
          logTrade(
            `${baseHtml}<span class="loss">${profitPct.toFixed(
              2
            )}%</span> (~${profitAbs.toFixed(2)} USDT)`
          );
        }
      }

      updateStatsUI();
    }, 3500);
  }

  /* Stop Simulation */
  function stopBot() {
    botRunning = false;
    setStepState();
    if (simInterval) clearInterval(simInterval);

    livePulse.classList.add("muted");
    liveStatusText.textContent = "Bot paused";

    statusChip.classList.remove("active");
    statusChip.classList.add("inactive");
    statusChipText.textContent = "PAUSED";

    toggleBotBtn.innerHTML = '<i class="fas fa-play"></i> Resume Bot';
  }

  /* Withdraw Simulation */
  function handleWithdraw() {
    logTrade(
      `<span class="type-info">Withdraw requested — simulation will reset PnL and cycle counters.</span>`
    );
    totalPnLPercent = 0;
    wins = 0;
    losses = 0;
    cycles = 0;
    updateStatsUI();
    modalBackdrop.style.display = "flex";
  }

  /* Modal close */
  closeModal.addEventListener("click", () => {
    modalBackdrop.style.display = "none";
  });

  modalBackdrop.addEventListener("click", (e) => {
    if (e.target === modalBackdrop) {
      modalBackdrop.style.display = "none";
    }
  });

  /* Event bindings */
  applyConfigBtn.addEventListener("click", applyConfiguration);
  toggleBotBtn.addEventListener("click", () => {
    if (botRunning) stopBot();
    else startBot();
  });
  withdrawBtn.addEventListener("click", handleWithdraw);

  // Initial state
  refreshVolatility();
  updateStatsUI();
  setStepState();
  startVolTimers();
}

/* MARKET: MAIN CRYPTO PRICE CHART + TABLE (CoinGecko, robust version) */
function initMarket() {
  const ctx = document.getElementById("cryptoChart");
  const statusEl = document.getElementById("marketStatus");
  const tableBody = document.getElementById("marketTableBody");
  const refreshButton = document.getElementById("refreshMarketButton");

  if (!ctx) return;

  const coins = [
    { id: "bitcoin", symbol: "BTC", color: "#f97316" },
    { id: "ethereum", symbol: "ETH", color: "#3b82f6" },
    { id: "solana", symbol: "SOL", color: "#22c55e" },
    { id: "binancecoin", symbol: "BNB", color: "#eab308" },
  ];

  const labels = coins.map((c) => c.symbol);

  const marketChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Price (USD)",
          data: [0, 0, 0, 0],
          backgroundColor: coins.map((c) => c.color),
          borderColor: coins.map((c) => c.color),
          borderWidth: 1.2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: { color: "#e5e7eb", font: { size: 11 } },
        },
      },
      scales: {
        x: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(31,41,55,0.6)" },
        },
        y: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(31,41,55,0.6)" },
        },
      },
    },
  });

  async function fetchMarket() {
    try {
      statusEl.textContent = "Loading…";

      const idsParam = coins.map((c) => c.id).join(",");
      const [simpleRes, marketsRes] = await Promise.all([
        fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${idsParam}&vs_currencies=usd`
        ),
        fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}`
        ),
      ]);

      if (!simpleRes.ok || !marketsRes.ok) {
        throw new Error("API error");
      }

      const simpleData = await simpleRes.json();
      const marketsData = await marketsRes.json();

      // Update chart with current prices
      const prices = coins.map((c) => {
        const p = simpleData[c.id]?.usd;
        return typeof p === "number" ? p : 0;
      });

      marketChart.data.datasets[0].data = prices;
      marketChart.update();

      // Update table
      tableBody.innerHTML = "";
      marketsData.forEach((coin) => {
        const tr = document.createElement("tr");

        const tdName = document.createElement("td");
        tdName.textContent = coin.name;

        const tdSym = document.createElement("td");
        tdSym.textContent = coin.symbol.toUpperCase();

        const tdPrice = document.createElement("td");
        tdPrice.textContent = `$${coin.current_price.toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 8,
        })}`;

        const tdChange = document.createElement("td");
        const ch = coin.price_change_percentage_24h;
        if (ch === null || ch === undefined) {
          tdChange.textContent = "–";
        } else {
          tdChange.textContent = `${ch.toFixed(2)}%`;
          if (ch > 0) tdChange.classList.add("change-positive");
          if (ch < 0) tdChange.classList.add("change-negative");
        }

        tr.appendChild(tdName);
        tr.appendChild(tdSym);
        tr.appendChild(tdPrice);
        tr.appendChild(tdChange);

        tableBody.appendChild(tr);
      });

      statusEl.textContent = "Updated";
    } catch (err) {
      console.error("Market fetch error:", err);
      statusEl.textContent = "Error loading data";
      tableBody.innerHTML =
        '<tr><td colspan="4" class="placeholder">Failed to load data.</td></tr>';
    }
  }

  refreshButton.addEventListener("click", fetchMarket);

  // Initial load + periodic refresh
  fetchMarket();
  setInterval(fetchMarket, 60000);
}
