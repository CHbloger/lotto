// Script for AI Lotto Number Generator

document.addEventListener('DOMContentLoaded', () => {
    const generateBtn = document.getElementById('generate-btn');
    const ballContainer = document.getElementById('ball-container');
    const myListContainer = document.getElementById('my-numbers-list');
    const saveCountBadge = document.getElementById('save-count');
    const statusText = document.getElementById('status-text');

    let savedCount = 0;

    // "AI" Weighted Data - Simulation of hot numbers (mock data)
    // In a real scenario, this would come from a backend or statistical analysis.
    const numberWeights = {};
    for (let i = 1; i <= 45; i++) {
        // Assign a base weight of 1
        numberWeights[i] = 1;

        // Boost some numbers arbitrarily to simulate "hot" numbers based on "past data"
        if ([1, 7, 12, 18, 24, 33, 42].includes(i)) {
            numberWeights[i] += 0.5; // 50% more likely
        }
        // Lower some numbers
        if ([9, 22, 30].includes(i)) {
            numberWeights[i] -= 0.3;
        }
    }

    // Function to get a random number based on weights
    function getWeightedRandomNumber(excludedNumbers) {
        // Calculate total weight excluding already picked numbers
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
            if (randomVal <= 0) {
                return candidate.number;
            }
        }
        return candidates[candidates.length - 1].number; // Fallback
    }

    // Generate 6 unique numbers
    function generateNumbers() {
        const selectedNumbers = new Set();
        while (selectedNumbers.size < 6) {
            const num = getWeightedRandomNumber(selectedNumbers);
            selectedNumbers.add(num);
        }
        // Convert to array and sort
        return Array.from(selectedNumbers).sort((a, b) => a - b);
    }

    // Get color class based on number range
    function getBallColorClass(num) {
        if (num <= 10) return 'ball-range-1';
        if (num <= 20) return 'ball-range-2';
        if (num <= 30) return 'ball-range-3';
        if (num <= 40) return 'ball-range-4';
        return 'ball-range-5';
    }

    // Main function to run generation sequence
    async function runGeneration() {
        if (generateBtn.disabled) return;

        // UI Feedback
        generateBtn.disabled = true;
        generateBtn.classList.add('opacity-50', 'cursor-not-allowed');
        statusText.classList.remove('opacity-0');
        statusText.innerText = "빅데이터 분석 중...";

        // Clear previous balls
        ballContainer.innerHTML = '';

        // Fake processing delay for "AI" feel
        await new Promise(r => setTimeout(r, 600));
        statusText.innerText = "번호 추출 중...";

        const numbers = generateNumbers();

        // Animate balls one by one
        for (let i = 0; i < numbers.length; i++) {
            await new Promise(r => setTimeout(r, 200)); // Delay between balls
            createBallElement(numbers[i]);
            // Play sound effect here if requested, but not in requirements
        }

        statusText.innerText = "생성 완료!";
        setTimeout(() => {
            statusText.classList.add('opacity-0');
            generateBtn.disabled = false;
            generateBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        }, 1000);

        // Auto-save to "My Numbers" (Requirement: "사용자가 생성한 번호를 '나의 번호' 리스트에 임시 저장")
        // NOTE: The prompt says "function to save", often implies auto or manual.
        // Given "increase dwell time", auto-adding or a quick "Add" button is good.
        // I will add it to the list automatically as a "History" log, which is common for this UX.
        addToMyList(numbers);
    }

    function createBallElement(num) {
        const ball = document.createElement('div');
        ball.classList.add('lotto-ball', getBallColorClass(num), 'animate-roll');
        ball.textContent = num;
        ballContainer.appendChild(ball);
    }

    function addToMyList(numbers) {
        // Remove "empty" message if it exists
        const emptyMsg = myListContainer.querySelector('li.text-gray-500');
        if (emptyMsg) {
            emptyMsg.remove();
        }

        savedCount++;
        saveCountBadge.textContent = `${savedCount}개`;

        const li = document.createElement('li');
        li.className = 'bg-gray-800/50 p-3 rounded flex justify-between items-center border border-gray-700 animate-pop';

        // Create small balls for history
        const ballsDiv = document.createElement('div');
        ballsDiv.className = 'flex gap-2';

        numbers.forEach(num => {
            const span = document.createElement('span');
            span.className = `w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm ${getBallColorClass(num)}`;
            span.textContent = num;
            ballsDiv.appendChild(span);
        });

        // Delete button
        const delBtn = document.createElement('button');
        delBtn.innerHTML = '&times;';
        delBtn.className = 'text-gray-500 hover:text-red-400 font-bold ml-2 px-2';
        delBtn.onclick = function() {
            li.remove();
            savedCount--;
            saveCountBadge.textContent = `${savedCount}개`;
            if (savedCount === 0) {
                 myListContainer.innerHTML = '<li class="text-center text-gray-500 text-sm py-4">아직 저장된 번호가 없습니다.</li>';
            }
        };

        li.appendChild(ballsDiv);
        li.appendChild(delBtn);

        // Prepend to top
        myListContainer.prepend(li);
    }

    generateBtn.addEventListener('click', runGeneration);
});
