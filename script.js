// Script for AI Lotto Master (v3.0 - Real Data & Persistence)

document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const ballContainer = document.getElementById('ball-container');
    const myListContainer = document.getElementById('my-numbers-list');
    const saveCountBadge = document.getElementById('save-count');
    const statusText = document.getElementById('status-text');
    const copyBtn = document.getElementById('copy-btn');

    let savedCount = 0;
    let historyData = []; // Store objects { id: timestamp, numbers: [] }

    // Weighted Probability Map
    let numberWeights = {};

    // Initialize
    init();

    function init() {
        // 1. Initialize Weights (Default 1.0)
        resetWeights();

        // 2. Load LocalStorage
        loadHistory();

        // 3. Initialize Chart (Empty initially)
        initChart();

        // 4. Fetch Real Data & Apply Analysis
        fetchAndAnalyzeData();
    }

    function resetWeights() {
        for (let i = 1; i <= 45; i++) {
            numberWeights[i] = 1;
        }
    }

    // --- Real Data Integration ---

    function getCurrentRound() {
        // Lotto started on 2002-12-07 (Round 1)
        // Draws are every Saturday.
        const startDate = new Date('2002-12-07T20:40:00');
        const now = new Date();

        const diffTime = now - startDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        const round = Math.floor(diffDays / 7) + 1;

        return round;
    }

    async function fetchAndAnalyzeData() {
        const currentRound = getCurrentRound();
        statusText.classList.remove('opacity-0');
        statusText.innerText = `최신 데이터(${currentRound}회) 연동 중...`;

        // Fetch last 10 rounds
        const roundsToFetch = 10;
        const fetchedNumbers = []; // All numbers from last 10 rounds

        try {
            // We fetch the last 10 valid rounds
            const startRound = currentRound - 1;

            const promises = [];
            for (let i = 0; i < roundsToFetch; i++) {
                const r = startRound - i;
                if (r < 1) continue;
                // Use allorigins proxy to bypass CORS
                const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${r}`)}`;
                promises.push(fetch(url).then(res => res.json()).then(data => JSON.parse(data.contents)));
            }

            const results = await Promise.all(promises);

            let validCount = 0;
            results.forEach(data => {
                if (data && data.returnValue === 'success') {
                    validCount++;
                    fetchedNumbers.push(data.drwtNo1, data.drwtNo2, data.drwtNo3, data.drwtNo4, data.drwtNo5, data.drwtNo6);
                }
            });

            if (validCount > 0) {
                applyAnalysisToWeights(fetchedNumbers);
                statusText.innerText = `최신 ${validCount}회차 분석 완료!`;

                // Update chart with real data for "Hot Numbers" visualization
                updateChartWithRealData(fetchedNumbers);
            } else {
                statusText.innerText = "데이터 연동 실패 (기본 모드)";
            }

        } catch (error) {
            console.error("Failed to fetch lotto data:", error);
            statusText.innerText = "오프라인 모드 (기본 가중치)";
        }

        setTimeout(() => {
             if (!generateBtn.disabled) statusText.classList.add('opacity-0');
        }, 3000);
    }

    function applyAnalysisToWeights(recentNumbers) {
        // Count frequencies
        const counts = {};
        for (let i = 1; i <= 45; i++) counts[i] = 0;

        recentNumbers.forEach(num => {
            counts[num]++;
        });

        // Apply Hot/Cold Logic
        for (let i = 1; i <= 45; i++) {
            const count = counts[i];

            if (count === 0) {
                // Cold: Has not appeared in last 10 rounds -> Boost significantly
                numberWeights[i] += 2.0;
            } else if (count >= 3) {
                // Hot: Appeared frequently -> Lower weight
                numberWeights[i] = Math.max(0.1, numberWeights[i] - 0.5);
            }
        }

        console.log("Updated Weights based on analysis:", numberWeights);
    }

    // --- Core Generator ---

    function getWeightedRandomNumber(excludedNumbers) {
        let totalWeight = 0;
        const candidates = [];
        for (let i = 1; i <= 45; i++) {
            if (!excludedNumbers.has(i)) {
                totalWeight += numberWeights[i];
                candidates.push({ number: i, weight: numberWeights[i] });
            }
        }
        let randomVal = Math.random() * totalWeight;
        for (const candidate of candidates) {
            randomVal -= candidate.weight;
            if (randomVal <= 0) return candidate.number;
        }
        return candidates[candidates.length - 1].number;
    }

    function generateNumbers() {
        const selectedNumbers = new Set();
        while (selectedNumbers.size < 6) {
            selectedNumbers.add(getWeightedRandomNumber(selectedNumbers));
        }
        return Array.from(selectedNumbers).sort((a, b) => a - b);
    }

    function getBallColorClass(num) {
        if (num <= 10) return 'ball-range-1';
        if (num <= 20) return 'ball-range-2';
        if (num <= 30) return 'ball-range-3';
        if (num <= 40) return 'ball-range-4';
        return 'ball-range-5';
    }

    async function runGeneration() {
        if (generateBtn.disabled) return;

        // UI Feedback
        generateBtn.disabled = true;
        generateBtn.classList.add('opacity-75', 'cursor-wait');
        statusText.classList.remove('opacity-0');
        statusText.innerText = "동적 가중치 계산 중...";

        ballContainer.innerHTML = '';

        await delay(400);
        statusText.innerText = "AI 예측 모델 실행...";
        await delay(400);

        const numbers = generateNumbers();

        // Animate balls
        for (let i = 0; i < numbers.length; i++) {
            await delay(150);
            createBallElement(numbers[i]);
        }

        statusText.innerText = "생성 완료";
        setTimeout(() => {
            statusText.classList.add('opacity-0');
            generateBtn.disabled = false;
            generateBtn.classList.remove('opacity-75', 'cursor-wait');
        }, 1500);

        saveToHistory(numbers);
    }

    function createBallElement(num) {
        const ball = document.createElement('div');
        ball.classList.add('lotto-ball', getBallColorClass(num), 'animate-roll');
        ball.textContent = num;
        ballContainer.appendChild(ball);
    }

    // --- Persistence (LocalStorage) ---

    function loadHistory() {
        const stored = localStorage.getItem('lottoHistory');
        if (stored) {
            try {
                historyData = JSON.parse(stored);
                savedCount = historyData.length;
                saveCountBadge.textContent = savedCount;

                // Render UI
                renderHistoryUI();
            } catch (e) {
                console.error("Corrupt history data", e);
                localStorage.removeItem('lottoHistory');
            }
        }
    }

    function saveToHistory(numbers) {
        const entry = {
            id: Date.now(),
            numbers: numbers
        };
        historyData.unshift(entry); // Add to top
        // Limit history to 50 items
        if (historyData.length > 50) historyData.pop();

        localStorage.setItem('lottoHistory', JSON.stringify(historyData));
        savedCount = historyData.length;
        saveCountBadge.textContent = savedCount;

        renderHistoryUI();
    }

    function removeFromHistory(id) {
        historyData = historyData.filter(item => item.id !== id);
        localStorage.setItem('lottoHistory', JSON.stringify(historyData));
        savedCount = historyData.length;
        saveCountBadge.textContent = savedCount;

        renderHistoryUI();
    }

    function renderHistoryUI() {
        myListContainer.innerHTML = '';

        if (historyData.length === 0) {
            myListContainer.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-gray-600 text-sm">
                    <svg class="w-10 h-10 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                    <p>생성된 번호가 여기에 저장됩니다.</p>
                </div>`;
            return;
        }

        historyData.forEach(item => {
            const div = document.createElement('div');
            div.className = 'bg-white/5 p-3 rounded-lg flex justify-between items-center border border-white/5 animate-pop hover:bg-white/10 transition-colors group mb-2';

            const ballsDiv = document.createElement('div');
            ballsDiv.className = 'flex gap-2';

            item.numbers.forEach(num => {
                const span = document.createElement('span');
                span.className = `lotto-ball-sm rounded-full flex items-center justify-center font-bold text-white ${getBallColorClass(num)}`;
                span.textContent = num;
                ballsDiv.appendChild(span);
            });

            const delBtn = document.createElement('button');
            delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
            delBtn.className = 'text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity';
            delBtn.onclick = () => removeFromHistory(item.id);

            div.appendChild(ballsDiv);
            div.appendChild(delBtn);
            myListContainer.appendChild(div);
        });
    }

    // --- Chart & Utilities ---

    let statsChart;

    function initChart() {
        const ctx = document.getElementById('statsChart').getContext('2d');
        const labels = Array.from({length: 45}, (_, i) => i + 1);
        const initialData = Array(45).fill(0);

        statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '최근 10회차 출현 빈도',
                    data: initialData,
                    backgroundColor: 'rgba(0, 243, 255, 0.5)',
                    borderColor: '#00f3ff',
                    borderWidth: 1,
                    borderRadius: 3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        ticks: { stepSize: 1, color: '#9ca3af' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af', font: {size: 10}, maxRotation: 0, autoSkip: true }
                    }
                },
                plugins: {
                    legend: { display: true, labels: { color: '#ccc' } },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
    }

    function updateChartWithRealData(numbers) {
        // Count frequencies from real data
        const counts = Array(45).fill(0);
        numbers.forEach(num => {
            if (num >= 1 && num <= 45) counts[num - 1]++;
        });

        statsChart.data.datasets[0].data = counts;
        statsChart.update();
    }

    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    copyBtn.addEventListener('click', () => {
        if (historyData.length === 0) {
            alert('저장된 번호가 없습니다.');
            return;
        }

        const textToCopy = historyData.map((item, idx) => `[${idx+1}] ` + item.numbers.join(', ')).join('\n');

        navigator.clipboard.writeText(textToCopy).then(() => {
            const originalText = copyBtn.innerText;
            copyBtn.innerText = 'Copied!';
            setTimeout(() => copyBtn.innerText = originalText, 2000);
        }).catch(err => {
            console.error('Copy failed', err);
        });
    });

    generateBtn.addEventListener('click', runGeneration);
});
