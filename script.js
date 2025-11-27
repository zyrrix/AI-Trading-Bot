// --- NAVIGATION BETWEEN SECTIONS ---
document.addEventListener("DOMContentLoaded", () => {
  const navLinks = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".page-section");

  navLinks.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-section");

      // Update nav active
      navLinks.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      // Show the target section
      sections.forEach((sec) => {
        sec.classList.toggle("active", sec.id === target);
      });
    });
  });

  initMetaMask();
  initMarket();
  initBotSimulation();
  initTools();
});

// --- METAMASK / WALLET CONNECT ---
function initMetaMask() {
  const connectButton = document.getElementById("connectButton");
  const walletAddressEl = document.getElementById("walletAddress");
  const walletBalanceEl = document.getElementById("walletBalance");
  const networkLabelEl = document.getElementById("networkLabel");

  let currentAccount = null;

  function shortAddr(addr) {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  function chainName(chainIdHex) {
    // Basic mapping for major chains
    const id = parseInt(chainIdHex, 16);
    switch (id) {
      case 1:
        return "Ethereum Mainnet";
      case 5:
        return "Goerli Testnet";
      case 11155111:
        return "Sepolia Testnet";
      case 137:
        return "Polygon";
      case 42161:
        return "Arbitrum One";
      default:
        return `Chain ID ${id}`;
    }
  }

  async function updateBalance() {
    if (!window.ethereum || !currentAccount) return;
    try {
      const balanceHex = await window.ethereum.request({
        method: "eth_getBalance",
        params: [currentAccount, "latest"],
      });
      const balanceWei = BigInt(balanceHex);
      const ethBalance = Number(balanceWei) / 1e18;
      walletBalanceEl.textContent = `${ethBalance.toFixed(4)} ETH`;
    } catch (err) {
      console.error("Balance error:", err);
      walletBalanceEl.textContent = "";
    }
  }

  async function updateNetwork() {
    if (!window.ethereum) {
      networkLabelEl.textContent = "No Wallet";
      return;
    }
    try {
      const chainId = await window.ethereum.request({
        method: "eth_chainId",
      });
      networkLabelEl.textContent = chainName(chainId);
    } catch (err) {
      console.error("Chain error:", err);
    }
  }

  async function connect() {
    if (!window.ethereum) {
      alert("MetaMask not detected. Please install it first.");
      return;
    }
    try {
      const accounts = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      currentAccount = accounts[0];
      walletAddressEl.textContent = shortAddr(currentAccount);
      connectButton.textContent = "Connected";
      connectButton.disabled = true;
      await updateNetwork();
      await updateBalance();

      // Listen to changes
      window.ethereum.on("accountsChanged", (accs) => {
        if (!accs || accs.length === 0) {
          currentAccount = null;
          walletAddressEl.textContent = "Not connected";
          walletBalanceEl.textContent = "";
          connectButton.textContent = "Connect MetaMask";
          connectButton.disabled = false;
        } else {
          currentAccount = accs[0];
          walletAddressEl.textContent = shortAddr(currentAccount);
          updateBalance();
        }
      });

      window.ethereum.on("chainChanged", () => {
        updateNetwork();
        updateBalance();
      });
    } catch (err) {
      console.error("MetaMask connection error:", err);
      alert("Failed to connect wallet.");
    }
  }

  connectButton.addEventListener("click", connect);
}

// --- MARKET CHART + PRICES ---
function initMarket() {
  const ctx = document.getElementById("marketChart").getContext("2d");
  const statusEl = document.getElementById("marketStatus");
  const tableBody = document.getElementById("marketTableBody");
  const refreshButton = document.getElementById("refreshMarketButton");

  const coins = [
    { id: "bitcoin", symbol: "BTC", color: "#f97316" },
    { id: "ethereum", symbol: "ETH", color: "#3b82f6" },
    { id: "solana", symbol: "SOL", color: "#22c55e" },
    { id: "binancecoin", symbol: "BNB", color: "#eab308" },
  ];

  let marketChart = new Chart(ctx, {
    type: "line",
    data: { labels: [], datasets: [] },
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
          ticks: { color: "#9ca3af", maxRotation: 0, autoSkip: true },
          grid: { color: "rgba(31,41,55,0.5)" },
        },
        y: {
          ticks: { color: "#9ca3af" },
          grid: { color: "rgba(31,41,55,0.6)" },
        },
      },
    },
  });

  async function fetchMarketChart() {
    statusEl.textContent = "Loading data…";
    statusEl.className = "tag tag-info";

    try {
      const promises = coins.map((coin) =>
        fetch(
          `https://api.coingecko.com/api/v3/coins/${coin.id}/market_chart?vs_currency=usd&days=1&interval=hourly`
        ).then((r) => r.json())
      );

      const results = await Promise.all(promises);

      const labels = results[0].prices.map((p) => {
        const d = new Date(p[0]);
        return `${d.getHours().toString().padStart(2, "0")}:00`;
      });

      const datasets = results.map((res, idx) => {
        const coin = coins[idx];
        return {
          label: coin.symbol,
          data: res.prices.map((p) => p[1]),
          borderColor: coin.color,
          backgroundColor: "transparent",
          borderWidth: 1.4,
          tension: 0.3,
        };
      });

      marketChart.data.labels = labels;
      marketChart.data.datasets = datasets;
      marketChart.update();

      statusEl.textContent = "Updated";
      statusEl.className = "tag tag-info";
    } catch (err) {
      console.error("Chart error:", err);
      statusEl.textContent = "Error loading data";
      statusEl.className = "tag tag-info";
    }
  }

  async function fetchMarketTable() {
    try {
      const ids = coins.map((c) => c.id).join(",");
      const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}`;
      const res = await fetch(url);
      const data = await res.json();

      tableBody.innerHTML = "";
      data.forEach((coin) => {
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
        const change = coin.price_change_percentage_24h;
        const changeText =
          change === null
            ? "–"
            : `${change.toFixed(2)}%`;
        tdChange.textContent = changeText;
        if (change > 0) tdChange.classList.add("change-positive");
        if (change < 0) tdChange.classList.add("change-negative");

        tr.appendChild(tdName);
        tr.appendChild(tdSym);
        tr.appendChild(tdPrice);
        tr.appendChild(tdChange);

        tableBody.appendChild(tr);
      });
    } catch (err) {
      console.error("Table error:", err);
      tableBody.innerHTML =
        '<tr><td colspan="4" class="placeholder">Failed to load data.</td></tr>';
    }
  }

  async function refreshMarket() {
    await fetchMarketChart();
    await fetchMarketTable();
  }

  refreshMarket();
  refreshButton.addEventListener("click", refreshMarket);

  // Optional: auto refresh every 60s
  setInterval(refreshMarket, 60000);
}

// --- BOT SIMULATION (SAFE / LOCAL ONLY) ---
function initBotSimulation() {
  const statusDot = document.getElementById("botStatusDot");
  const statusText = document.getElementById("botStatusText");
  const pnlEl = document.getElementById("botPnL");
  const cyclesEl = document.getElementById("botCycles");
  const logBox = document.getElementById("botLog");
  const startBtn = document.getElementById("startBotButton");
  const stopBtn = document.getElementById("stopBotButton");

  let running = false;
  let intervalId = null;
  let pnl = 0;
  let cycles = 0;

  function log(message) {
    const entry = document.createElement("div");
    entry.className = "log-entry";
    const time = new Date().toLocaleTimeString();
    entry.innerHTML = `<span class="time">[${time}]</span> ${message}`;
    logBox.prepend(entry);
    if (logBox.children.length > 80) {
      logBox.removeChild(logBox.lastChild);
    }
  }

  function updateUi() {
    const sign = pnl >= 0 ? "+" : "";
    pnlEl.textContent = `${sign}${pnl.toFixed(2)}%`;
    pnlEl.classList.toggle("green", pnl >= 0);
    cyclesEl.textContent = cycles.toString();
  }

  function start() {
    if (running) return;
    running = true;
    statusDot.classList.remove("offline");
    statusDot.classList.add("online");
    statusText.textContent = "Simulating";
    startBtn.disabled = true;
    stopBtn.disabled = false;

    log("Simulation started. This does not place real trades.");

    intervalId = setInterval(() => {
      // Random small change
      const delta = (Math.random() - 0.45) * 0.8; // slight bias positive
      pnl += delta;
      cycles += 1;
      const dir = delta >= 0 ? "profit" : "loss";
      const text =
        delta >= 0
          ? `Cycle #${cycles}: +${delta.toFixed(2)}%`
          : `Cycle #${cycles}: ${delta.toFixed(2)}%`;

      log(`<span class="${dir === "profit" ? "change-positive" : "change-negative"}">${text}</span>`);
      updateUi();
    }, 2500);
  }

  function stop() {
    if (!running) return;
    running = false;
    statusDot.classList.remove("online");
    statusDot.classList.add("offline");
    statusText.textContent = "Offline";
    startBtn.disabled = false;
    stopBtn.disabled = true;
    if (intervalId) clearInterval(intervalId);
    log("Simulation stopped.");
  }

  startBtn.addEventListener("click", start);
  stopBtn.addEventListener("click", stop);

  updateUi();
}

// --- TOOLS (POSITION SIZE CALC) ---
function initTools() {
  const balanceInput = document.getElementById("toolBalance");
  const riskInput = document.getElementById("toolRisk");
  const resultEl = document.getElementById("toolResult");
  const calcBtn = document.getElementById("calcPositionButton");

  calcBtn.addEventListener("click", () => {
    const balance = parseFloat(balanceInput.value || "0");
    const riskPct = parseFloat(riskInput.value || "0");

    if (!balance || balance <= 0 || !riskPct || riskPct <= 0) {
      resultEl.textContent = "Enter a valid balance and risk percentage.";
      return;
    }

    const riskAmount = (balance * riskPct) / 100;
    resultEl.textContent = `Max risk per trade: $${riskAmount.toFixed(2)} (at ${riskPct}% of $${balance.toFixed(
      2
    )}).`;
  });
}

