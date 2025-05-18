// Global variables
let memberData = {};
let watchHistory = [];
let filteredHistory = [];
let charts = {
    ranking: null,
    monthly: null,
    generation: null
};

// DOM Elements
const fileInput = document.getElementById('file-input');
const fileSelectButton = document.getElementById('file-select-button');
const fileName = document.getElementById('file-name');
const loadingIndicator = document.getElementById('loading-indicator');
const resultsContainer = document.getElementById('results-container');
const fileUploadContainer = document.getElementById('file-upload-container');
const totalWatchesElement = document.getElementById('total-watches');
const uniqueVtubersElement = document.getElementById('unique-vtubers');
const mostWatchedGenElement = document.getElementById('most-watched-gen');
const dateRangeElement = document.getElementById('date-range');
const genFilter = document.getElementById('gen-filter');
const viewFilter = document.getElementById('view-filter');
const vtuberSearch = document.getElementById('vtuber-search');
const vtuberFilter = document.getElementById('vtuber-filter');
const vtuberList = document.getElementById('vtuber-list');
const excludeKeywords = ['original', '歌ってみた', 'official', 'mv', 'music video', 'cover'];

// Event Listeners
document.addEventListener('DOMContentLoaded', initApp);
fileSelectButton.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', handleFileSelect);
genFilter.addEventListener('change', updateRankingChart);
viewFilter.addEventListener('change', handleViewFilterChange);
vtuberSearch.addEventListener('input', updateMonthlyChart);
vtuberFilter.addEventListener('input', filterVtuberList);

// Initialize the app
async function initApp() {
    try {
        // メンバーデータをJSONファイルから読み込む
        const response = await fetch('member_data.json');
        if (!response.ok) {
            throw new Error('メンバーデータの読み込みに失敗しました');
        }
        memberData = await response.json();
        console.log("Application initialized with member data");
    } catch (error) {
        console.error("Error loading member data:", error);
        alert("メンバーデータの読み込みに失敗しました。ページを再読み込みしてください。");
    }
}

// Handle file selection
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    fileName.textContent = file.name;
    loadingIndicator.classList.remove('hidden');
    
    const reader = new FileReader();
    reader.onload = (e) => parseWatchHistory(e.target.result);
    reader.readAsText(file);
}

// Parse watch history JSON
function parseWatchHistory(content) {
    try {
        // Parse the JSON content
        const data = JSON.parse(content);
        
        // Only process YouTube watch history entries
        watchHistory = data.filter(entry => {
            // Check if it's a YouTube entry
            if (entry.header !== "YouTube") return false;
            
            // Check if it's a Hololive video by matching channel names
            if (!entry.subtitles || !entry.subtitles.length) return false;

            // Remove entries of original songs or 歌ってみた
            if (excludeKeywords.some(keyword => entry.title.toLowerCase().includes(keyword.toLowerCase()))) {
                return false;
            }

            // Remove non-video entries (posts, etc.).  titleUrl should include "watch"
            if (!entry.titleUrl || !entry.titleUrl.includes("watch")) return false;
            
            const channelName = entry.subtitles[0].name;
            return isHololiveMember(channelName);
        });
        
        // Process the filtered data
        processWatchHistory();
        
        console.log("全YouTubeエントリ数:", data.filter(entry => entry.header === "YouTube").length);
        console.log("メンバーデータ:", memberData);
        console.log("フィルタ後のホロライブ視聴履歴:", watchHistory.length);
        
    } catch (error) {
        console.error("Error parsing watch history:", error);
        loadingIndicator.classList.add('hidden');
        alert("ファイルの解析中にエラーが発生しました。正しい形式のGoogle Takeoutファイルであることを確認してください。");
    }
}

// Check if a channel belongs to a Hololive member
function isHololiveMember(channelName) {
    const result = Object.values(memberData).some(member => member.channel === channelName);
    return result;
}

// Process watch history data
function processWatchHistory() {
    if (watchHistory.length === 0) {
        loadingIndicator.classList.add('hidden');
        alert("ホロライブの視聴履歴が見つかりませんでした。");
        return;
    }
    
    // Apply current year filter
    const currentYear = new Date().getFullYear();
    filteredHistory = watchHistory.filter(entry => {
        const watchDate = new Date(entry.time);
        return watchDate.getFullYear() === currentYear;
    });
    
    // Update UI
    updateStatistics();
    createCharts();
    populateVtuberList();
    
    // Show results and hide loading
    loadingIndicator.classList.add('hidden');
    resultsContainer.classList.remove('hidden');
    fileUploadContainer.classList.add('mb-4');
    fileUploadContainer.classList.remove('mb-8');
}

// Update statistics panel
function updateStatistics() {
    // Count total watches
    totalWatchesElement.textContent = filteredHistory.length.toLocaleString();
    
    // Count unique Vtubers watched
    const watchedVtubers = new Set();
    filteredHistory.forEach(entry => {
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                watchedVtubers.add(id);
            }
        });
    });
    uniqueVtubersElement.textContent = watchedVtubers.size;
    
    // Find most watched generation
    const genCounts = {};
    filteredHistory.forEach(entry => {
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                const gens = Array.isArray(member.gen) ? member.gen : [member.gen];
                
                // 各世代にカウントを追加（両方の世代にカウント）
                gens.forEach(gen => {
                    genCounts[gen] = (genCounts[gen] || 0) + 1;
                });
            }
        });
    });
    
    let mostWatchedGen = "";
    let maxCount = 0;
    Object.entries(genCounts).forEach(([gen, count]) => {
        if (count > maxCount) {
            mostWatchedGen = gen;
            maxCount = count;
        }
    });
    mostWatchedGenElement.textContent = mostWatchedGen;
    
    // Set date range
    if (filteredHistory.length > 0) {
        // Sort by date
        const sortedDates = filteredHistory.map(entry => new Date(entry.time)).sort((a, b) => a - b);
        const firstDate = sortedDates[0];
        const lastDate = sortedDates[sortedDates.length - 1];
        
        dateRangeElement.textContent = `${firstDate.toLocaleDateString()} - ${lastDate.toLocaleDateString()}`;
    }
}

// Create all charts
function createCharts() {
    createRankingChart();
    createMonthlyChart();
    createGenerationChart();
}

// Create the ranking chart
function createRankingChart() {
    // Count videos per Vtuber
    const vtuberCounts = {};
    
    filteredHistory.forEach(entry => {
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                vtuberCounts[id] = (vtuberCounts[id] || 0) + 1;
            }
        });
    });
    
    // Sort by count and get top 15
    const sortedVtubers = Object.entries(vtuberCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    // Prepare chart data
    const labels = sortedVtubers.map(([id]) => {
        const member = memberData[id];
        const genText = Array.isArray(member.gen) ? member.gen.join('/') : member.gen;
        return member.name;
    });
    const data = sortedVtubers.map(([, count]) => count);
    const colors = sortedVtubers.map(([id]) => memberData[id].color);
    
    // Create/update chart
    const ctx = document.getElementById('ranking-chart').getContext('2d');
    
    if (charts.ranking) {
        charts.ranking.destroy();
    }
    
    charts.ranking = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '視聴回数',
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => adjustColor(color, -20)),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return tooltipItems[0].label;
                        },
                        label: function(context) {
                            const id = sortedVtubers[context.dataIndex][0];
                            const member = memberData[id];
                            const genText = Array.isArray(member.gen) ? member.gen.join('/') : member.gen;
                            return [
                                `視聴回数: ${context.raw}回`,
                                `期: ${genText}`
                            ];
                        }
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}

// Update ranking chart based on generation filter
function updateRankingChart() {
    const selectedGen = genFilter.value;
    
    // Count videos per Vtuber with filter
    const vtuberCounts = {};
    
    filteredHistory.forEach(entry => {
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                const gens = Array.isArray(member.gen) ? member.gen : [member.gen];
                if (selectedGen === 'all' || gens.includes(selectedGen)) {
                    vtuberCounts[id] = (vtuberCounts[id] || 0) + 1;
                }
            }
        });
    });
    
    // Sort by count and get top 15
    const sortedVtubers = Object.entries(vtuberCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
    
    // Update chart data
    const labels = sortedVtubers.map(([id]) => memberData[id].name);
    const data = sortedVtubers.map(([, count]) => count);
    const colors = sortedVtubers.map(([id]) => memberData[id].color);
    
    charts.ranking.data.labels = labels;
    charts.ranking.data.datasets[0].data = data;
    charts.ranking.data.datasets[0].backgroundColor = colors;
    charts.ranking.data.datasets[0].borderColor = colors.map(color => adjustColor(color, -20));
    
    charts.ranking.update();
}

// Create monthly chart
function createMonthlyChart() {
    // Group by month and Vtuber
    const monthlyData = {};
    const months = [];
    
    // Initialize months array for current year
    const currentYear = new Date().getFullYear();
    for (let month = 0; month < 12; month++) {
        const monthStr = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        months.push(monthStr);
        monthlyData[monthStr] = {};
    }
    
    // Aggregate data
    filteredHistory.forEach(entry => {
        const date = new Date(entry.time);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                if (!monthlyData[monthStr]) {
                    monthlyData[monthStr] = {};
                }
                monthlyData[monthStr][id] = (monthlyData[monthStr][id] || 0) + 1;
            }
        });
    });
    
    // Get top 5 Vtubers overall
    const vtuberCounts = {};
    filteredHistory.forEach(entry => {
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                vtuberCounts[id] = (vtuberCounts[id] || 0) + 1;
            }
        });
    });
    
    const top5Vtubers = Object.entries(vtuberCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id]) => id);
    
    // Create datasets
    const datasets = top5Vtubers.map(id => {
        const member = memberData[id];
        return {
            label: member.name,
            data: months.map(month => monthlyData[month][id] || 0),
            backgroundColor: member.color,
            borderColor: adjustColor(member.color, -20),
            borderWidth: 1
        };
    });
    
    // Create chart
    const ctx = document.getElementById('monthly-chart').getContext('2d');
    
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    charts.monthly = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: months.map(month => {
                const [year, monthNum] = month.split('-');
                return `${monthNum}月`;
            }),
            datasets: datasets
        },
        options: {
            plugins: {
                tooltip: {
                    callbacks: {
                        title: function(tooltipItems) {
                            return `${currentYear}年${tooltipItems[0].label}`;
                        }
                    }
                }
            },
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    stacked: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                },
                y: {
                    stacked: true,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: 'rgba(255, 255, 255, 0.7)'
                    }
                }
            }
        }
    });
}

// Create generation chart
function createGenerationChart() {
    // Count by generation
    const genCounts = {};
    
    filteredHistory.forEach(entry => {
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                const gens = Array.isArray(member.gen) ? member.gen : [member.gen];
                gens.forEach(gen => {
                    genCounts[gen] = (genCounts[gen] || 0) + 1;
                });
            }
        });
    });
    
    // Get unique colors for each generation
    const genColors = {};
    Object.entries(memberData).forEach(([, member]) => {
        const gens = Array.isArray(member.gen) ? member.gen : [member.gen];
        gens.forEach(gen => {
            if (!genColors[gen]) {
                genColors[gen] = member.color;
            }
        });
    });
    
    // Sort data
    const sortedGens = Object.entries(genCounts).sort((a, b) => {
        // Custom sort to ensure proper order
        const genOrder = {
            "0期生": 0,
            "1期生": 1,
            "2期生": 2,
            "3期生": 3,
            "4期生": 4,
            "5期生": 5,
            "ゲーマーズ": 6,
            "秘密結社holoX": 7,
            "ReGLOSS": 8,
            "FLOW GLOW": 9,
            "公式チャンネル": 10
        };
        
        return genOrder[a[0]] - genOrder[b[0]];
    });
    
    const labels = sortedGens.map(([gen]) => gen);
    const data = sortedGens.map(([, count]) => count);
    const colors = sortedGens.map(([gen]) => genColors[gen]);
    
    // Create chart
    const ctx = document.getElementById('generation-chart').getContext('2d');
    
    if (charts.generation) {
        charts.generation.destroy();
    }
    
    charts.generation = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderColor: colors.map(color => adjustColor(color, -20)),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const value = context.raw;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = Math.round((value / total) * 100);
                            return `${value}回 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Handle view filter change for monthly chart
function handleViewFilterChange() {
    const selectedView = viewFilter.value;
    
    if (selectedView === 'custom') {
        vtuberSearch.classList.remove('hidden');
    } else {
        vtuberSearch.classList.add('hidden');
    }
    
    updateMonthlyChart();
}

// Update monthly chart
function updateMonthlyChart() {
    const selectedView = viewFilter.value;
    const searchTerm = vtuberSearch.value.toLowerCase();
    
    // Group by month and Vtuber
    const monthlyData = {};
    const months = [];
    
    // Initialize months array for current year
    const currentYear = new Date().getFullYear();
    for (let month = 0; month < 12; month++) {
        const monthStr = `${currentYear}-${String(month + 1).padStart(2, '0')}`;
        months.push(monthStr);
        monthlyData[monthStr] = {};
    }
    
    // Aggregate data
    filteredHistory.forEach(entry => {
        const date = new Date(entry.time);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                if (!monthlyData[monthStr]) {
                    monthlyData[monthStr] = {};
                }
                monthlyData[monthStr][id] = (monthlyData[monthStr][id] || 0) + 1;
            }
        });
    });
    
    // Determine which Vtubers to include
    let selectedVtubers = [];
    
    if (selectedView === 'all') {
        // Include all but with a limit to prevent chart clutter
        const vtuberCounts = {};
        filteredHistory.forEach(entry => {
            const channelName = entry.subtitles[0].name;
            Object.entries(memberData).forEach(([id, member]) => {
                if (member.channel === channelName) {
                    vtuberCounts[id] = (vtuberCounts[id] || 0) + 1;
                }
            });
        });
        
        selectedVtubers = Object.entries(vtuberCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10)
            .map(([id]) => id);
            
    } else if (selectedView === 'top5') {
        // Top 5 most watched
        const vtuberCounts = {};
        filteredHistory.forEach(entry => {
            const channelName = entry.subtitles[0].name;
            Object.entries(memberData).forEach(([id, member]) => {
                if (member.channel === channelName) {
                    vtuberCounts[id] = (vtuberCounts[id] || 0) + 1;
                }
            });
        });
        
        selectedVtubers = Object.entries(vtuberCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([id]) => id);
            
    } else if (selectedView === 'custom') {
        // Search by name
        if (searchTerm) {
            selectedVtubers = Object.entries(memberData)
                .filter(([, member]) => {
                    return member.name.toLowerCase().includes(searchTerm) || 
                           member.keywords.some(kw => kw.toLowerCase().includes(searchTerm));
                })
                .map(([id]) => id);
        }
    }
    
    // Create datasets
    const datasets = selectedVtubers.map(id => {
        const member = memberData[id];
        return {
            label: member.name,
            data: months.map(month => monthlyData[month][id] || 0),
            backgroundColor: member.color,
            borderColor: adjustColor(member.color, -20),
            borderWidth: 1
        };
    });
    
    // Update chart
    charts.monthly.data.datasets = datasets;
    charts.monthly.update();
}

// Populate Vtuber list
function populateVtuberList() {
    // Count videos per Vtuber
    const vtuberCounts = {};
    
    filteredHistory.forEach(entry => {
        const channelName = entry.subtitles[0].name;
        Object.entries(memberData).forEach(([id, member]) => {
            if (member.channel === channelName) {
                vtuberCounts[id] = (vtuberCounts[id] || 0) + 1;
            }
        });
    });
    
    // Sort by count
    const sortedVtubers = Object.entries(vtuberCounts)
        .sort((a, b) => b[1] - a[1]);
    
    // Clear list
    vtuberList.innerHTML = '';
    
    // Add cards
    sortedVtubers.forEach(([id, count]) => {
        const member = memberData[id];
        
        const card = document.createElement('div');
        card.className = 'vtuber-card';
        card.dataset.id = id;
        card.dataset.name = member.name;
        card.dataset.gen = member.gen;
        
        const avatar = document.createElement('div');
        avatar.className = 'vtuber-avatar';
        avatar.style.backgroundColor = member.color;
        avatar.textContent = member.name.charAt(0);
        
        const nameElement = document.createElement('div');
        nameElement.className = 'vtuber-name';
        nameElement.textContent = member.name;
        
        const genElement = document.createElement('div');
        genElement.className = 'vtuber-gen';
        genElement.textContent = member.gen;
        
        const countElement = document.createElement('div');
        countElement.className = 'vtuber-count';
        countElement.textContent = `${count}回`;
        
        card.appendChild(avatar);
        card.appendChild(nameElement);
        card.appendChild(genElement);
        card.appendChild(countElement);
        
        vtuberList.appendChild(card);
    });
}

// Filter Vtuber list
function filterVtuberList() {
    const searchTerm = vtuberFilter.value.toLowerCase();
    
    const cards = vtuberList.querySelectorAll('.vtuber-card');
    cards.forEach(card => {
        const name = card.dataset.name.toLowerCase();
        const gen = card.dataset.gen.toLowerCase();
        
        if (name.includes(searchTerm) || gen.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// Helper: Adjust color brightness
function adjustColor(color, amount) {
    return color;  // For simplicity, just return the original color
}

// Helper: Format date
function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString();
}
