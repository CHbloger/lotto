// Script for AI Lotto Master (Korea 6/45)

let numberWeights = {};
let historyData = [];
let statsChart = null;

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
        if (sText) sText.innerText = "데이터 분석 중...";

        try {
            const currentRound = getKrRound();
            const roundsToFetch = 10;
            const fetchedNumbers = [];
            let latestWinData = null; // To store the very first (latest) valid result

            // Limit concurrency
            const promises = [];
            for (let i = 0; i < roundsToFetch; i++) {
                const r = currentRound - 1 - i;
                if (r < 1) continue;
                const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${r}`)}`;
                promises.push(fetch(url).then(r => r.json()).then(d => JSON.parse(d.contents)).catch(e => null));
            }

            const results = await Promise.all(promises);
            let validCount = 0;

            results.forEach((data, index) => {
                if (data && data.returnValue === 'success') {
                    validCount++;
                    fetchedNumbers.push(data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6);

                    // Capture the latest valid data (first one in loop is mostly likely latest since we iterate backwards, but results order might vary due to async promise)
                    // Wait, Promise.all maintains order of promises.
                    // Loop is: r = currentRound - 1 - i. So i=0 is latest.
                    // So results[0] is the latest round we asked for.

                    // We want the most recent *successful* data.
                    if (!latestWinData) {
                        latestWinData = data;
                    } else if (data.drwNo > latestWinData.drwNo) {
                        // Just in case
                        latestWinData = data;
                    }
                }
            });

            if (validCount > 0) {
                applyAnalysis(fetchedNumbers);
                if (sText) sText.innerText = `최근 ${validCount}회차 분석 완료`;
                if (status) {
                    status.innerText = "Online";
                    status.previousElementSibling.className = "w-2 h-2 rounded-full bg-green-500 animate-pulse";
                }
                updateChartData(fetchedNumbers);

                // NEW: Update Latest Win Banner
                if (latestWinData) {
                    updateLatestWinBanner(latestWinData);
                }
            } else {
                throw new Error("No data");
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

    function updateLatestWinBanner(data) {
        const card = document.getElementById('latest-win-card');
        if (!card) return;

        card.classList.remove('hidden');
        document.getElementById('latest-drw-no').innerText = `${data.drwNo}회`;
        document.getElementById('latest-drw-date').innerText = `${data.drwNoDate} 추첨`;

        // Prize (firstAccumamnt is total, firstWinamnt is per person. API keys: firstWinamnt, firstPrzwnerCo etc)
        // dhlottery API returns 'firstWinamnt' usually.
        if (data.firstWinamnt) {
             // Format currency (e.g. 2,000,000,000)
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

        // Bonus
        const plus = document.createElement('span');
        plus.className = 'text-gray-500 font-bold self-center';
        plus.innerText = '+';
        ballContainer.appendChild(plus);

        const bBall = document.createElement('span');
        bBall.className = `w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center font-bold text-white shadow-lg ${getBallColorClass(bonus)}`;
        bBall.innerText = bonus;
        ballContainer.appendChild(bBall);

        const bLabel = document.createElement('span');
        bLabel.className = 'text-[10px] text-gray-400 self-end ml-[-40px] mb-[-15px]';
        // bLabel.innerText = '보너스';
        // ballContainer.appendChild(bLabel);
    }

    function getKrRound() {
        const start = new Date('2002-12-07T20:40:00');
        const now = new Date();
        return Math.floor((now - start) / (1000 * 60 * 60 * 24 * 7)) + 1;
    }

    function applyAnalysis(numbers) {
        const counts = {};
        numbers.forEach(n => counts[n] = (counts[n] || 0) + 1);

        // Simple Hot/Cold
        for (let i = 1; i <= 45; i++) {
            const c = counts[i] || 0;
            if (c === 0) numberWeights[i] += 2.0; // Cold
            else if (c >= 3) numberWeights[i] = Math.max(0.1, numberWeights[i] - 0.5); // Hot
        }
    }

    // --- Generation Logic ---

    function getWeightedRandom(excluded) {
        // Fallback
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

        // Generate 6 unique numbers
        const selected = new Set();
        while (selected.size < 6) {
            selected.add(getWeightedRandom(selected));
        }
        const sortedNumbers = Array.from(selected).sort((a,b) => a-b);

        // Animation
        for (const n of sortedNumbers) {
            await delay(150);
            createBall(n);
        }

        if (sText) sText.innerText = "생성 완료";

        // Save
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
        // If history format changed (v5 had 'game' field), we can filter or adapt.
        // For simplicity, we just render what we can.
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

            // Header
            const head = document.createElement('div');
            head.className = 'flex justify-between items-center text-xs text-gray-400';
            head.innerHTML = `<span>${new Date(item.id).toLocaleTimeString()}</span>`;

            // Numbers
            const numDiv = document.createElement('div');
            numDiv.className = 'flex flex-wrap gap-1 items-center';

            // Compatibility: item.main exists in v5, item.numbers in v3/4
            const nums = item.main || item.numbers || [];

            nums.forEach(n => {
                const s = document.createElement('span');
                s.className = `w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs text-white shadow-sm ${getBallColorClass(n)}`;
                s.innerText = n;
                numDiv.appendChild(s);
            });

            div.appendChild(head);
            div.appendChild(numDiv);

            // Delete button (overlay or corner)
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
