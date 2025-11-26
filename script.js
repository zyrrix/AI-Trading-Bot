document.addEventListener("DOMContentLoaded", function () {
  // Elements
  const connectWalletBtn = document.getElementById("connectWallet");
  const disconnectWalletBtn = document.getElementById("disconnectWallet");
  const walletSection = document.getElementById("walletSection");
  const connectSection = document.getElementById("connectSection");
  const walletAddressEl = document.getElementById("walletAddress");

  const step1 = document.getElementById("step1");
  const step2 = document.getElementById("step2");
  const step3 = document.getElementById("step3");

  const pairSelect = document.getElementById("pairSelect");
  const riskSelect = document.getElementById("riskSelect");
  const sizeInput = document.getElementById("sizeInput");
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

  const tradeInterface = document.getElementById("tradeInterface");
  const livePulse = document.getElementById("livePulse");
  const liveStatusText = document.getElementById("liveStatusText");
  const tradeLog = document.getElementById("tradeLog");

  const pnlValue = document.getElementById("pnlValue");
  const pnlNote = document.getElementById("pnlNote");
  const cycleValue = document.getElementById("cycleValue");
  const cycleCountEl = document.getElementById("cycleCount");
  const sharpeValueEl = document.getElementById("sharpeValue");
  const withdrawBtn = document.getElementById("withdrawBtn");

  const modalBackdrop = document.getElementById("modalBackdrop");
  const closeModal = document.getElementById("closeModal");

  // State
  let demoWallet = null;
  let configApplied = false;
  let botRunning = false;

  let volInterval = null;
  let volCountdownInterval = null;
  let simInterval = null;

  let virtualCapital = 0;
  let totalPnLPercent = 0;
  let wins = 0;
  let losses = 0;
  let cycles = 0;

  function randBetween(min, max, decimals = 2) {
    const val = Math.random() * (max - min) + min;
    return parseFloat(val.toFixed(decimals));
  }

  function shortAddress() {
    const hex =
      Math.random().toString(16).substring(2, 10) +
      Math.random().toString(16).substring(2, 10);
    return "0x" + hex;
  }

  function setStepState() {
    step1.classList.remove("active", "completed");
    step2.classList.remove("active", "completed");
    step3.classList.remove("active", "completed");

    if (demoWallet) {
      step1.classList.add("completed");
    } else {
      step1.classList.add("active");
      return;
    }

    if (configApplied) {
      step2.classList.add("completed");
    } else {
      step2.classList.add("active");
      return;
    }

    if (botRunning) {
      step3.classList.add("completed");
    } else {
      step3.classList.add("active");
    }
  }

  function logTrade(_type, msg, extraClass) {
    const row = document.createElement("div");
    row.className = "trade-row " + (extraClass || "");
    const timeStr = new Date().toLocaleTimeString();
    row.innerHTML = `<span class="time-tag">[${timeStr}]</span> ${msg}`;
    tradeLog.insertBefore(row, tradeLog.firstChild);

    if (tradeLog.children.length > 120) {
      tradeLog.removeChild(tradeLog.lastChild);
    }
  }

  function updateDashboardFromState() {
    const sign = totalPnLPercent >= 0 ? "+" : "";
    pnlValue.textContent = `${sign}${totalPnLPercent.toFixed(2)}%`;
    pnlValue.classList.toggle("green", totalPnLPercent >= 0);

    const usedCap = virtualCapital || 0;
    pnlNote.textContent =
      usedCap > 0
        ? `On ${usedCap.toLocaleString()} USDT of simulated capital.`
        : "Set simulated capital to get more realistic numbers.";

    const totalTrades = wins + losses || 1;
    const winRate = (wins / totalTrades) * 100;

    cycleValue.textContent = `${wins} wins · ${losses} losses`;
    cycleCountEl.textContent = cycles.toString();

    const rawSharpe = Math.min(Math.max((winRate - 50) / 10, -1), 4);
    const sharpe = rawSharpe + randBetween(-0.2, 0.2, 1);
    sharpeValueEl.textContent = sharpe.toFixed(1);
  }

  function refreshVolatility() {
    const risk = riskSelect.value;
    let baseVol;
    if (risk === "conservative") baseVol = randBetween(4, 12, 1);
    else if (risk === "balanced") baseVol = randBetween(8, 18, 1);
    else baseVol = randBetween(12, 28, 1);

    volValue.textContent = baseVol.toFixed(1) + "%";

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

    const pair = pairSelect.value;
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

  function applyConfiguration() {
    if (!demoWallet) {
      configStatus.className = "status-banner error";
      configStatus.innerHTML =
        '<i class="fas fa-circle-exclamation"></i> Connect the demo wallet first.';
      return;
    }

    const capital = parseFloat(sizeInput.value || "0");
    if (isNaN(capital) || capital < 100) {
      configStatus.className = "status-banner error";
      configStatus.innerHTML =
        '<i class="fas fa-circle-exclamation"></i> Please set at least 100 USDT of simulated capital.';
      return;
    }

    virtualCapital = capital;
    configApplied = true;
    setStepState();

    configStatus.className = "status-banner success";
    configStatus.innerHTML =
      '<i class="fas fa-check-circle"></i> Configuration applied. You can now start the simulation bot.';

    toggleBotBtn.disabled = false;
    toggleBotBtn.innerHTML = '<i class="fas fa-play"></i> Start Bot';

    botSnapshot.textContent = `Configured · ${pairSelect.value} · ${riskSelect.value.toUpperCase()}`;
    lastCycleText.textContent = "not started";

    refreshVolatility();
    startVolTimers();
  }

  function startSimulation() {
    if (simInterval) clearInterval(simInterval);

    botRunning = true;
    setStepState();

    livePulse.style.background = "#22c55e";
    livePulse.style.boxShadow = "0 0 12px rgba(34,197,94,0.8)";
    liveStatusText.textContent = "Simulation running";

    statusChip.classList.remove("inactive");
    statusChipText.textContent = "ONLINE";

    botSnapshot.textContent = `Running · ${pairSelect.value} · ${riskSelect.value.toUpperCase()}`;
    lastCycleText.textContent = "just now";

    toggleBotBtn.innerHTML = '<i class="fas fa-pause"></i> Pause Bot';

    tradeInterface.style.display = "block";

    logTrade(
      "info",
      `<span class="type-info">Simulation started with ${pairSelect.value} · ${riskSelect.value.toUpperCase()} · ${virtualCapital.toLocaleString()} USDT.</span>`
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
        const typeClass = side === "BUY" ? "type-buy" : "type-sell";
        const size = randBetween(0.02, 0.35, 3);
        const entry = randBetween(100, 70000, 2);
        const exitSpread = randBetween(-0.9, 0.9, 2);
        const exit = entry + exitSpread;
        const profitPct = randBetween(-0.6, 0.8, 2);
        const profitAbs = virtualCapital * (profitPct / 100) * 0.02;

        if (profitPct >= 0) {
          wins += 1;
          totalPnLPercent += profitPct * 0.1;
          logTrade(
            side,
            `<span class="${typeClass}">${side}</span> ${size} ${
              pairSelect.value.split("/")[0]
            } @ ${entry.toFixed(2)} → ${exit.toFixed(2)} · ` +
              `<span class="profit">+${profitPct.toFixed(2)}%</span> (~${profitAbs.toFixed(2)} USDT)`
          );
        } else {
          losses += 1;
          totalPnLPercent += profitPct * 0.1;
          logTrade(
            side,
            `<span class="${typeClass}">${side}</span> ${size} ${
              pairSelect.value.split("/")[0]
            } @ ${entry.toFixed(2)} → ${exit.toFixed(2)} · ` +
              `<span class="loss">${profitPct.toFixed(2)}%</span> (~${profitAbs.toFixed(2)} USDT)`
          );
        }
      }

      updateDashboardFromState();
    }, 3500);
  }

  function stopSimulation() {
    botRunning = false;
    setStepState();
    if (simInterval) clearInterval(simInterval);

    livePulse.style.background = "#9ca3af";
    livePulse.style.boxShadow = "none";
    liveStatusText.textContent = "Bot paused";

    statusChip.classList.add("inactive");
    statusChipText.textContent = "PAUSED";

    toggleBotBtn.innerHTML = '<i class="fas fa-play"></i> Resume Bot';
  }

  // Handlers
  connectWalletBtn.addEventListener("click", function () {
    demoWallet = shortAddress();
    walletAddressEl.textContent = demoWallet;
    walletSection.style.display = "flex";
    connectSection.style.display = "none";

    setStepState();
    configStatus.className = "status-banner info";
    configStatus.innerHTML =
      '<i class="fas fa-circle-info"></i> Demo wallet connected. Configure the bot and click <strong>Apply Configuration</strong>.';
  });

  disconnectWalletBtn.addEventListener("click", function () {
    demoWallet = null;
    configApplied = false;
    botRunning = false;
    virtualCapital = 0;
    totalPnLPercent = 0;
    wins = 0;
    losses = 0;
    cycles = 0;

    walletSection.style.display = "none";
    connectSection.style.display = "block";
    tradeInterface.style.display = "none";

    toggleBotBtn.disabled = true;
    toggleBotBtn.innerHTML = '<i class="fas fa-play"></i> Start Bot';

    statusChip.classList.add("inactive");
    statusChipText.textContent = "INACTIVE";
    botSnapshot.textContent = "Idle · Awaiting configuration";
    lastCycleText.textContent = "–";

    tradeLog.innerHTML = "";
    stopSimulation();
    stopVolTimers();
    updateDashboardFromState();
    setStepState();

    configStatus.className = "status-banner info";
    configStatus.innerHTML =
      '<i class="fas fa-circle-info"></i> Wallet disconnected. Reconnect to use the simulation again.';
  });

  applyConfigBtn.addEventListener("click", applyConfiguration);

  toggleBotBtn.addEventListener("click", function () {
    if (!configApplied) {
      applyConfiguration();
      return;
    }
    if (botRunning) {
      stopSimulation();
    } else {
      startSimulation();
    }
  });

  withdrawBtn.addEventListener("click", function () {
    logTrade(
      "info",
      `<span class="type-info">Withdraw requested — simulation will reset PnL and cycle counters after this.</span>`
    );
    totalPnLPercent = 0;
    wins = 0;
    losses = 0;
    cycles = 0;
    updateDashboardFromState();

    modalBackdrop.style.display = "flex";
  });

  closeModal.addEventListener("click", function () {
    modalBackdrop.style.display = "none";
  });

  modalBackdrop.addEventListener("click", function (e) {
    if (e.target === modalBackdrop) {
      modalBackdrop.style.display = "none";
    }
  });

  // Initial state
  updateDashboardFromState();
  refreshVolatility();
  setStepState();
});
