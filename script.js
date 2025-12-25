// Script for AI Lotto Master (v3.1 - Fixes & Robustness)

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

    let statsChart = null; // Chart instance

    // Bind Event Listeners FIRST to ensure they work even if init() fails partially
    if (generateBtn) generateBtn.addEventListener('click', runGeneration);
    if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);

    // Initialize
    init();

    function init() {
        // 1. Initialize Weights (Default 1.0)
        resetWeights();

        // 2. Load LocalStorage
        loadHistory();

        // 3. Initialize Chart (Safe)
        try {
            initChart();
        } catch (e) {
            console.error("Chart initialization failed:", e);
        }

        // 4. Fetch Real Data & Apply Analysis
        // We run this without awaiting so it doesn't block UI
        fetchAndAnalyzeData();
    }

    function resetWeights() {
        for (let i = 1; i <= 45; i++) {
            numberWeights[i] = 1;
        }
    }

    // --- Real Data Integration ---

    function getCurrentRound() {
        const startDate = new Date('2002-12-07T20:40:00');
        const now = new Date();
        const diffTime = now - startDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return Math.floor(diffDays / 7) + 1;
    }

    async function fetchAndAnalyzeData() {
        const currentRound = getCurrentRound();
        if (statusText) {
            statusText.classList.remove('opacity-0');
            statusText.innerText = `최신 데이터(${currentRound}회) 연동 중...`;
        }

        const roundsToFetch = 10;
        const fetchedNumbers = [];

        try {
            const startRound = currentRound - 1;
            const promises = [];

            // Use allorigins to bypass CORS
            // Note: If this API is unstable, we might need a fallback or just handle error.
            for (let i = 0; i < roundsToFetch; i++) {
                const r = startRound - i;
                if (r < 1) continue;
                const url = `https://api.allorigins.win/get?url=${encodeURIComponent(`https://www.dhlottery.co.kr/common.do?method=getLottoNumber&drwNo=${r}`)}`;
                promises.push(
                    fetch(url)
                    .then(res => {
                        if (!res.ok) throw new Error('Network response was not ok');
                        return res.json();
                    })
                    .then(data => {
                        if (!data.contents) return null;
                        return JSON.parse(data.contents);
                    })
                    .catch(err => null) // Catch individual fetch errors to not fail Promise.all completely if one fails?
                                        // Actually Promise.all fails if one fails. Let's map catch to null.
                );
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
                if (statusText) statusText.innerText = `최신 ${validCount}회차 분석 완료!`;
                updateChartWithRealData(fetchedNumbers);
            } else {
                console.warn("No valid data fetched.");
                if (statusText) statusText.innerText = "데이터 연동 실패 (기본 모드)";
            }

        } catch (error) {
            console.error("Failed to fetch lotto data:", error);
            if (statusText) statusText.innerText = "오프라인 모드 (기본 가중치)";
        }

        setTimeout(() => {
             if (statusText && !generateBtn.disabled) statusText.classList.add('opacity-0');
        }, 3000);
    }

    function applyAnalysisToWeights(recentNumbers) {
        const counts = {};
        for (let i = 1; i <= 45; i++) counts[i] = 0;

        recentNumbers.forEach(num => {
            if (num) counts[num]++;
        });

        for (let i = 1; i <= 45; i++) {
            const count = counts[i];
            if (count === 0) {
                numberWeights[i] += 2.0;
            } else if (count >= 3) {
                numberWeights[i] = Math.max(0.1, numberWeights[i] - 0.5);
            }
        }
        console.log("Updated Weights:", numberWeights);
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

        if (candidates.length === 0) return 1; // Fallback

        let randomVal = Math.random() * totalWeight;
        for (const candidate of candidates) {
            randomVal -= candidate.weight;
            if (randomVal <= 0) return candidate.number;
        }
        return candidates[candidates.length - 1].number;
    }

    function generateNumbers() {
        const selectedNumbers = new Set();
        // Safety break to prevent infinite loop if something goes wrong
        let safety = 0;
        while (selectedNumbers.size < 6 && safety < 100) {
            selectedNumbers.add(getWeightedRandomNumber(selectedNumbers));
            safety++;
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
        if (statusText) {
            statusText.classList.remove('opacity-0');
            statusText.innerText = "가중치 알고리즘 실행 중...";
        }

        if (ballContainer) ballContainer.innerHTML = '';

        await delay(300);
        if (statusText) statusText.innerText = "번호 추출 중...";
        await delay(300);

        const numbers = generateNumbers();

        // Animate balls
        for (let i = 0; i < numbers.length; i++) {
            await delay(150);
            createBallElement(numbers[i]);
        }

        if (statusText) statusText.innerText = "생성 완료";

        setTimeout(() => {
            if (statusText) statusText.classList.add('opacity-0');
            generateBtn.disabled = false;
            generateBtn.classList.remove('opacity-75', 'cursor-wait');
        }, 1500);

        saveToHistory(numbers);
    }

    function createBallElement(num) {
        if (!ballContainer) return;
        const ball = document.createElement('div');
        ball.classList.add('lotto-ball', getBallColorClass(num), 'animate-roll');
        ball.textContent = num;
        ballContainer.appendChild(ball);
    }

    // --- Persistence ---

    function loadHistory() {
        const stored = localStorage.getItem('lottoHistory');
        if (stored) {
            try {
                historyData = JSON.parse(stored);
                savedCount = historyData.length;
                if (saveCountBadge) saveCountBadge.textContent = savedCount;
                renderHistoryUI();
            } catch (e) {
                console.error("Corrupt history data", e);
                localStorage.removeItem('lottoHistory');
            }
        }
    }

    function saveToHistory(numbers) {
        const entry = { id: Date.now(), numbers: numbers };
        historyData.unshift(entry);
        if (historyData.length > 50) historyData.pop();

        try {
            localStorage.setItem('lottoHistory', JSON.stringify(historyData));
        } catch (e) {
            console.error("LocalStorage full or error", e);
        }

        savedCount = historyData.length;
        if (saveCountBadge) saveCountBadge.textContent = savedCount;
        renderHistoryUI();
    }

    function removeFromHistory(id) {
        historyData = historyData.filter(item => item.id !== id);
        localStorage.setItem('lottoHistory', JSON.stringify(historyData));
        savedCount = historyData.length;
        if (saveCountBadge) saveCountBadge.textContent = savedCount;
        renderHistoryUI();
    }

    function renderHistoryUI() {
        if (!myListContainer) return;
        myListContainer.innerHTML = '';

        if (historyData.length === 0) {
            myListContainer.innerHTML = `
                <div class="h-full flex flex-col items-center justify-center text-gray-600 text-sm">
                    <p>저장된 번호가 없습니다.</p>
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
            delBtn.innerHTML = '×';
            delBtn.className = 'text-gray-400 hover:text-red-400 px-2 text-xl opacity-0 group-hover:opacity-100 transition-opacity';
            delBtn.onclick = () => removeFromHistory(item.id);

            div.appendChild(ballsDiv);
            div.appendChild(delBtn);
            myListContainer.appendChild(div);
        });
    }

    // --- Chart & Utilities ---

    function initChart() {
        const canvas = document.getElementById('statsChart');
        if (!canvas) {
            console.warn("Chart canvas not found");
            return;
        }
        if (typeof Chart === 'undefined') {
            console.error("Chart.js library not loaded");
            return;
        }

        const ctx = canvas.getContext('2d');
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
        if (!statsChart) return;

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

    function copyToClipboard() {
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
    }
});
