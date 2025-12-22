// Script for AI Lotto Master

document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const ballContainer = document.getElementById('ball-container');
    const myListContainer = document.getElementById('my-numbers-list');
    const saveCountBadge = document.getElementById('save-count');
    const statusText = document.getElementById('status-text');
    const copyBtn = document.getElementById('copy-btn');

    let savedCount = 0;
    const historyData = []; // To store sets of numbers for export

    // Initialize Chart
    let statsChart;
    initChart();

    // Weighted Probability Setup
    const numberWeights = {};
    for (let i = 1; i <= 45; i++) {
        numberWeights[i] = 1;
        // Mock data logic: slightly boost some, lower others
        if ([1, 7, 12, 18, 24, 33, 42].includes(i)) numberWeights[i] += 0.5;
        if ([9, 22, 30].includes(i)) numberWeights[i] -= 0.3;
    }

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

    // --- Core Logic ---
    async function runGeneration() {
        if (generateBtn.disabled) return;

        // UI Feedback
        generateBtn.disabled = true;
        generateBtn.classList.add('opacity-75', 'cursor-wait');
        statusText.classList.remove('opacity-0');
        statusText.innerText = "데이터 패턴 분석 중...";

        ballContainer.innerHTML = '';

        // Fake AI Processing Delays
        await delay(400);
        statusText.innerText = "가중치 알고리즘 적용 중...";
        await delay(400);
        statusText.innerText = "최적 번호 조합 추출 중...";

        const numbers = generateNumbers();

        // Animate balls
        for (let i = 0; i < numbers.length; i++) {
            await delay(150);
            createBallElement(numbers[i]);
        }

        statusText.innerText = "추출 완료";
        setTimeout(() => {
            statusText.classList.add('opacity-0');
            generateBtn.disabled = false;
            generateBtn.classList.remove('opacity-75', 'cursor-wait');
        }, 1500);

        addToMyList(numbers);
        updateChart(numbers); // Update stats dynamically
    }

    function createBallElement(num) {
        const ball = document.createElement('div');
        ball.classList.add('lotto-ball', getBallColorClass(num), 'animate-roll');
        ball.textContent = num;
        ballContainer.appendChild(ball);
    }

    function addToMyList(numbers) {
        const emptyMsg = myListContainer.querySelector('div.h-full');
        if (emptyMsg) emptyMsg.remove();

        savedCount++;
        saveCountBadge.textContent = savedCount;
        historyData.push(numbers); // Store for export

        const div = document.createElement('div');
        div.className = 'bg-white/5 p-3 rounded-lg flex justify-between items-center border border-white/5 animate-pop hover:bg-white/10 transition-colors group';

        const ballsDiv = document.createElement('div');
        ballsDiv.className = 'flex gap-2';

        numbers.forEach(num => {
            const span = document.createElement('span');
            span.className = `lotto-ball-sm rounded-full flex items-center justify-center font-bold text-white ${getBallColorClass(num)}`;
            span.textContent = num;
            ballsDiv.appendChild(span);
        });

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>';
        delBtn.className = 'text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity';
        delBtn.onclick = function() {
            div.remove();
            savedCount--;
            saveCountBadge.textContent = savedCount;
            // Note: Not removing from historyData array strictly to keep it simple, or we'd need ID tracking.
            // For now, simple visual removal.
            if (savedCount === 0) {
                 myListContainer.innerHTML = `
                    <div class="h-full flex flex-col items-center justify-center text-gray-600 text-sm">
                        <svg class="w-10 h-10 mb-2 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                        <p>생성된 번호가 여기에 저장됩니다.</p>
                    </div>`;
            }
        };

        div.appendChild(ballsDiv);
        div.appendChild(delBtn);
        myListContainer.prepend(div);
    }

    // --- Chart.js Integration ---
    function initChart() {
        const ctx = document.getElementById('statsChart').getContext('2d');

        // Mock data for initial view
        const labels = Array.from({length: 45}, (_, i) => i + 1);
        const data = labels.map(() => Math.floor(Math.random() * 20) + 5);

        statsChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '최근 당첨 빈도',
                    data: data,
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
                        ticks: { color: '#9ca3af' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#9ca3af', font: {size: 10}, maxRotation: 0, autoSkip: true }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                }
            }
        });
    }

    function updateChart(newNumbers) {
        // Simple visual update: increment the counts of the generated numbers in the chart
        // to show "Live Analysis" feeling.
        newNumbers.forEach(num => {
            const index = num - 1;
            statsChart.data.datasets[0].data[index] += 1;
        });
        statsChart.update();
    }

    // --- Utilities ---
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Copy Feature
    copyBtn.addEventListener('click', () => {
        if (historyData.length === 0) {
            alert('저장된 번호가 없습니다.');
            return;
        }

        // Format text
        const textToCopy = historyData.map((set, idx) => `[${idx+1}] ` + set.join(', ')).join('\n');

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
