// Script for AI Lotto Master (Korea 6/45) - Optimized

let numberWeights = {};
let historyData = [];
let statsChart = null;
let lottoArchive = {}; // Cache for past rounds: { roundNumber: dataObject }

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const generateBtn = document.getElementById('generate-btn');
    const ballContainer = document.getElementById('ball-container');
    const myListContainer = document.getElementById('my-numbers-list');
    const statusText = document.getElementById('status-text');
    const copyBtn = document.getElementById('copy-btn');

    // Bind Events
    if (generateBtn) generateBtn.addEventListener('click', runGeneration);
    if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);

    // Init
    init();

    function init() {
        resetWeights();
        loadHistory();
        loadArchive(); // Load cached lotto results
        initChart();
        fetchAndAnalyzeData();
    }

    function resetWeights() {
        numberWeights = {};
        for (let i = 1; i <= 45; i++) {
            numberWeights[i] = 1;
        }
    }

    // --- Data & Analysis ---

    async function fetchAndAnalyzeData() {
        const status = document.getElementById('connection-status');
        const sText = document.getElementById('status-text');

        if (status) {
            status.innerText = "연결 중...";
            status.previousElementSibling.className = "w-2 h-2 rounded-full bg-yellow-500 animate-pulse";
        }
        if (sText) sText.innerText = "데이터 확인 중...";

        try {
            const currentRound = getKrRound();

            // 1. Try to render latest banner IMMEDIATELY from cache if possible
            // We might have the previous week's data which is "latest" enough until we fetch new.
            // But ideally we want the *actual* latest.
            // Check if we have currentRound or currentRound-1 in archive.
            let latestData = lottoArchive[currentRound] || lottoArchive[currentRound - 1];
            if (latestData) {
                updateLatestWinBanner(latestData);
            }

            // 2. Identify missing rounds (Last 10)
            const roundsToFetch = 10;
            const missingRounds = [];
            const neededRounds = [];

            for (let i = 0; i < roundsToFetch; i++) {
                const r = currentRound - i; // Try fetching current round too (it might be Saturday night)
                // Actually getKrRound estimates.
                // Let's check: if it returns X, maybe X isn't drawn yet.
                // But the API returns null/fail if not drawn.
                // We'll try fetching currentRound down to currentRound-10.
                if (r < 1) continue;
                neededRounds.push(r);
                if (!lottoArchive[r]) {
                    missingRounds.push(r);
                }
            }

            // 3. Prioritize fetching the latest missing round (likely currentRound or currentRound-1)
            // This ensures the banner updates fast if cache is stale.
            if (missingRounds.length > 0) {
                 // Sort descending so we fetch highest round first
                 missingRounds.sort((a,b) => b-a);

                 // Fetch the very first missing round (Latest) separately and update UI
                 const latestMissing = missingRounds[0];
                 const latestRes = await fetchRound(latestMissing);

                 if (latestRes && latestRes.returnValue === 'success') {
                     lottoArchive[latestMissing] = latestRes;
                     saveArchive();
                     // Update banner if this is indeed the latest we have
                     if (!latestData || latestRes.drwNo > latestData.drwNo) {
                         latestData = latestRes;
                         updateLatestWinBanner(latestData);
                     }
                     // Remove from missing list
                     missingRounds.shift();
                 }
            }

            // 4. Fetch remaining missing rounds in parallel
            if (missingRounds.length > 0) {
                if (sText) sText.innerText = "과거 데이터 동기화 중...";
                const promises = missingRounds.map(r => fetchRound(r));
                const results = await Promise.all(promises);

                results.forEach(data => {
                    if (data && data.returnValue === 'success') {
                        lottoArchive[data.drwNo] = data;
                    }
                });
                saveArchive();
            }

            // 5. Aggregate Data for Analysis
            // Collect all valid rounds from neededRounds list
            const aggregatedNumbers = [];
            let validCount = 0;

            neededRounds.forEach(r => {
                const data = lottoArchive[r];
                if (data && data.returnValue === 'success') {
                    validCount++;
                    aggregatedNumbers.push(data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6);
                }
            });

            if (validCount > 0) {
                applyAnalysis(aggregatedNumbers);
                if (sText) sText.innerText = `최근 ${validCount}회차 분석 완료`;
                if (status) {
                    status.innerText = "Online";
                    status.previousElementSibling.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
                }
                updateChartData(aggregatedNumbers);
            } else {
                // Should practically never happen if we have cache or internet
                console.warn("No data available for analysis");
            }

        } catch (e) {
            console.error("Fetch failed", e);
            if (sText) sText.innerText = "오프라인 모드";
            if (status) {
                status.innerText = "Offline";
                status.previousElementSibling.className = "w-2 h-2 rounded-full bg-red-500";
            }
        }
    }

    async function fetchRound(r) {
        try {
            const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${r}`)}`;
            const response = await fetch(url);
            const json = await response.json();
            return JSON.parse(json.contents);
        } catch (e) {
            return null;
        }
    }

    function updateLatestWinBanner(data) {
        const card = document.getElementById('latest-win-card');
        if (!card) return;

        card.classList.remove('hidden');
        document.getElementById('latest-drw-no').innerText = `${data.drwNo}회`;
        document.getElementById('latest-drw-date').innerText = `${data.drwNoDate} 추첨`;

        if (data.firstWinamnt) {
             const prize = new Intl.NumberFormat('ko-KR').format(data.firstWinamnt);
             document.getElementById('latest-prize').innerText = `₩${prize}`;
        }

        const ballContainer = document.getElementById('latest-balls');
        ballContainer.innerHTML = '';

        const winNums = [data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6];
        const bonus = data.bnusNo;

        winNums.forEach(num => {
            const ball = document.createElement('span');
            ball.className = `w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${getBallColorClass(num)}`;
            ball.innerText = num;
            ballContainer.appendChild(ball);
        });

        const plus = document.createElement('span');
        plus.className = 'text-gray-500 font-bold self-center';
        plus.innerText = '+';
        ballContainer.appendChild(plus);

        const bBall = document.createElement('span');
        bBall.className = `w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${getBallColorClass(bonus)}`;
        bBall.innerText = bonus;
        ballContainer.appendChild(bBall);
    }

    function getKrRound() {
        const start = new Date('2002-12-07T20:40:00');
        const now = new Date();
        // Adjust for Draw Time (Sat 8:40 PM) - If before draw, it's previous round
        // Simple approximation:
        return Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7)) + 1;
    }

    function applyAnalysis(numbers) {
        const counts = {};
        numbers.forEach(n => counts[n] = (counts[n] || 0) + 1);

        for (let i = 1; i <= 45; i++) {
            const c = counts[i] || 0;
            if (c === 0) numberWeights[i] += 2.0;
            else if (c >= 3) numberWeights[i] = Math.max(0.1, numberWeights[i] - 0.5);
        }
    }

    // --- Generation Logic ---

    function getWeightedRandom(excluded) {
        if (Object.keys(numberWeights).length === 0) resetWeights();

        let total = 0;
        const candidates = [];
        for (let i = 1; i <= 45; i++) {
            if (!excluded.has(i)) {
                const w = numberWeights[i] || 1;
                total += w;
                candidates.push({ n: i, w: w });
            }
        }

        if (candidates.length === 0) return 1;

        let r = Math.random() * total;
        for (const c of candidates) {
            r -= c.w;
            if (r <= 0) return c.n;
        }
        return candidates[candidates.length - 1].n;
    }

    async function runGeneration() {
        const btn = document.getElementById('generate-btn');
        if (btn.disabled) return;

        btn.disabled = true;
        btn.classList.add('opacity-50');
        const sText = document.getElementById('status-text');
        if (sText) sText.innerText = "AI 알고리즘 가동...";
        ballContainer.innerHTML = '';

        await delay(500);

        const selected = new Set();
        while (selected.size < 6) {
            selected.add(getWeightedRandom(selected));
        }
        const sortedNumbers = Array.from(selected).sort((a,b) => a-b);

        for (const n of sortedNumbers) {
            await delay(150);
            createBall(n);
        }

        if (sText) sText.innerText = "생성 완료";

        const resultObj = {
            id: Date.now(),
            main: sortedNumbers
        };
        saveToHistory(resultObj);

        setTimeout(() => {
            btn.disabled = false;
            btn.classList.remove('opacity-50');
            if (sText) sText.classList.add('opacity-0');
        }, 1000);
    }

    function createBall(num) {
        const ball = document.createElement('div');
        ball.classList.add('lotto-ball', 'animate-roll', getBallColorClass(num));
        ball.textContent = num;
        ballContainer.appendChild(ball);
    }

    function getBallColorClass(num) {
        if (num <= 10) return 'ball-range-1';
        if (num <= 20) return 'ball-range-2';
        if (num <= 30) return 'ball-range-3';
        if (num <= 40) return 'ball-range-4';
        return 'ball-range-5';
    }

    // --- Persistence ---

    function saveArchive() {
        try {
            // Prune old rounds to save space? Keep only last 20 for safety
            // Sort keys
            const keys = Object.keys(lottoArchive).map(Number).sort((a,b) => b-a);
            const keep = keys.slice(0, 20);
            const pruned = {};
            keep.forEach(k => pruned[k] = lottoArchive[k]);

            localStorage.setItem('lottoArchive', JSON.stringify(pruned));
        } catch (e) {
            console.error("Failed to save archive", e);
        }
    }

    function loadArchive() {
        try {
            const s = localStorage.getItem('lottoArchive');
            if (s) lottoArchive = JSON.parse(s);
        } catch (e) {}
    }

    function saveToHistory(obj) {
        historyData.unshift(obj);
        if (historyData.length > 50) historyData.pop();
        localStorage.setItem('lottoHistory', JSON.stringify(historyData));
        renderHistory();
    }

    function loadHistory() {
        const s = localStorage.getItem('lottoHistory');
        if (s) {
            try { historyData = JSON.parse(s); } catch(e){}
        }
        renderHistory();
    }

    function renderHistory() {
        const list = document.getElementById('my-numbers-list');
        const badge = document.getElementById('save-count');
        if (badge) badge.innerText = historyData.length;
        if (!list) return;

        list.innerHTML = '';
        if (historyData.length === 0) {
            list.innerHTML = '<div class="text-gray-500 text-center text-sm p-4">저장된 기록 없음</div>';
            return;
        }

        historyData.forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-white/5 p-3 rounded-lg flex flex-col gap-2 border border-white/5 hover:bg-white/10 transition-colors text-sm';

            const head = document.createElement('div');
            head.className = 'flex justify-between items-center text-xs text-gray-400';
            head.innerHTML = `<span>${new Date(item.id).toLocaleTimeString()}</span>`;

            const numDiv = document.createElement('div');
            numDiv.className = 'flex flex-wrap gap-1 items-center';

            const nums = item.main || item.numbers || [];

            nums.forEach(n => {
                const s = document.createElement('span');
                s.className = `w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm ${getBallColorClass(n)}`;
                s.innerText = n;
                numDiv.appendChild(s);
            });

            div.appendChild(head);
            div.appendChild(numDiv);

            const del = document.createElement('button');
            del.innerHTML = '×';
            del.className = 'absolute top-1 right-1 text-gray-500 hover:text-red-400 px-2';
            div.style.position = 'relative';
            del.onclick = () => removeFromHistory(item.id);
            div.appendChild(del);

            list.appendChild(div);
        });
    }

    function removeFromHistory(id) {
        historyData = historyData.filter(x => x.id !== id);
        localStorage.setItem('lottoHistory', JSON.stringify(historyData));
        renderHistory();
    }

    // --- Chart ---
    function initChart() {
        if (!document.getElementById('statsChart')) return;
        if (typeof Chart === 'undefined') return;

        const ctx = document.getElementById('statsChart').getContext('2d');
        const labels = Array.from({length: 45}, (_, i) => i + 1);

        statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '빈도수',
                    data: Array(45).fill(0),
                    backgroundColor: '#00f3ff',
                    borderRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#666', autoSkip: true, maxTicksLimit: 20 }, grid: { display: false } },
                    y: { ticks: { color: '#666' }, grid: { color: '#333' } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    function updateChartData(numbers) {
        if (!statsChart) return;
        const counts = Array(45).fill(0);
        numbers.forEach(n => {
            if (n >= 1 && n <= 45) counts[n-1]++;
        });
        statsChart.data.datasets[0].data = counts;
        statsChart.update();
    }

    function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

    function copyToClipboard() {
        if (historyData.length === 0) return;
        const text = historyData.map((h, i) => {
            const nums = h.main || h.numbers || [];
            return `[${i+1}] ${nums.join(', ')}`;
        }).join('\n');

        navigator.clipboard.writeText(text);
        const btn = document.getElementById('copy-btn');
        const origin = btn.innerText;
        btn.innerText = "복사 완료!";
        setTimeout(()=>btn.innerText = origin, 2000);
    }
});
