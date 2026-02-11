// Global variables
let uploadedData = null;
let sampleGroups = [];

// DOM Elements (will be initialized after DOM loads)
let fileInput, fileName, fileInfo, sampleNameInput, addSampleBtn, loadDefaultsBtn;
let samplesList, clientName, processBtn, progressBar, progressFill, statusMessage;

// Wait for both DOM and external scripts to load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

function initializeApp() {
    // Get DOM Elements with error checking
    fileInput = document.getElementById('fileInput');
    fileName = document.getElementById('fileName');
    fileInfo = document.getElementById('fileInfo');
    sampleNameInput = document.getElementById('sampleNameInput');
    addSampleBtn = document.getElementById('addSampleBtn');
    loadDefaultsBtn = document.getElementById('loadDefaultsBtn');
    samplesList = document.getElementById('samplesList');
    clientName = document.getElementById('clientName');
    processBtn = document.getElementById('processBtn');
    progressBar = document.getElementById('progressBar');
    progressFill = document.getElementById('progressFill');
    statusMessage = document.getElementById('statusMessage');

    // Check if all elements are found
    if (!fileInput || !fileName || !addSampleBtn) {
        console.error('Error: Could not find required DOM elements');
        return;
    }

    // Event Listeners
    fileInput.addEventListener('change', handleFileUpload);
    addSampleBtn.addEventListener('click', addSampleGroup);
    loadDefaultsBtn.addEventListener('click', loadDefaultGroups);
    processBtn.addEventListener('click', processData);
    sampleNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addSampleGroup();
    });

    // Initialize
    renderSamplesList();
    updateProcessButton();
}

// File Upload Handler
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    fileName.textContent = file.name;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const text = e.target.result;
            uploadedData = parseTSV(text);
            
            fileInfo.innerHTML = `
                <strong>File loaded successfully!</strong><br>
                Rows: ${uploadedData.length}<br>
                Columns: ${uploadedData[0] ? Object.keys(uploadedData[0]).length : 0}
            `;
            fileInfo.classList.add('visible');
            
            updateProcessButton();
            showStatus('File uploaded successfully!', 'success');
        } catch (error) {
            showStatus('Error parsing file: ' + error.message, 'error');
            uploadedData = null;
        }
    };
    
    reader.onerror = function() {
        showStatus('Error reading file', 'error');
    };
    
    reader.readAsText(file);
}

// Parse TSV data
function parseTSV(text) {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length === 0) throw new Error('File is empty');
    
    const headers = lines[0].split('\t');
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split('\t');
        const row = {};
        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });
        data.push(row);
    }
    
    return data;
}

// Add Sample Group
function addSampleGroup() {
    const sampleName = sampleNameInput.value.trim();
    
    if (!sampleName) {
        showStatus('Please enter a sample group name', 'error');
        return;
    }
    
    if (sampleGroups.includes(sampleName)) {
        showStatus('This sample group already exists', 'error');
        return;
    }
    
    sampleGroups.push(sampleName);
    renderSamplesList();
    sampleNameInput.value = '';
    updateProcessButton();
    showStatus(`Added sample group: ${sampleName}`, 'success');
}

// Load Default Groups
function loadDefaultGroups() {
    const defaults = ['CTRL_Saline', 'CTRL_Cocaine', 'ABX_Saline', 'ABX_Cocaine'];
    sampleGroups = [...defaults];
    renderSamplesList();
    updateProcessButton();
    showStatus('Loaded default sample groups', 'info');
}

// Render Samples List
function renderSamplesList() {
    if (sampleGroups.length === 0) {
        samplesList.innerHTML = '<p style="color: #999; font-style: italic;">No sample groups added yet</p>';
        return;
    }
    
    samplesList.innerHTML = sampleGroups.map(sample => `
        <div class="sample-tag">
            <span>${sample}</span>
            <button class="remove-btn" onclick="removeSampleGroup('${sample}')">&times;</button>
        </div>
    `).join('');
}

// Remove Sample Group
function removeSampleGroup(sampleName) {
    sampleGroups = sampleGroups.filter(s => s !== sampleName);
    renderSamplesList();
    updateProcessButton();
    showStatus(`Removed sample group: ${sampleName}`, 'info');
}

// Update Process Button State
function updateProcessButton() {
    processBtn.disabled = !uploadedData || sampleGroups.length === 0;
}

// Process Data and Generate Excel
async function processData() {
    if (!uploadedData || sampleGroups.length === 0) {
        showStatus('Please upload a file and add at least one sample group', 'error');
        return;
    }
    
    try {
        processBtn.disabled = true;
        progressBar.classList.add('visible');
        setProgress(10);
        showStatus('Processing data...', 'info');
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Add "All" sheet with complete data
        setProgress(20);
        const allSheet = XLSX.utils.json_to_sheet(uploadedData);
        XLSX.utils.book_append_sheet(wb, allSheet, 'All');
        
        // Process each sample group
        const progressIncrement = 70 / sampleGroups.length;
        
        for (let i = 0; i < sampleGroups.length; i++) {
            const sampleName = sampleGroups[i];
            setProgress(20 + (progressIncrement * (i + 1)));
            
            // Filter data for this sample
            const filteredData = filterDataForSample(uploadedData, sampleName);
            
            if (filteredData.length > 0) {
                const sheet = XLSX.utils.json_to_sheet(filteredData);
                XLSX.utils.book_append_sheet(wb, sheet, sampleName);
            } else {
                console.warn(`No data found for sample: ${sampleName}`);
            }
        }
        
        setProgress(95);
        
        // Generate filename
        const date = new Date();
        const dateString = String(date.getMonth() + 1).padStart(2, '0') + 
                          String(date.getDate()).padStart(2, '0') + 
                          String(date.getFullYear()).slice(-2);
        const clientNameValue = clientName.value.trim() || 'Report';
        const filename = `${clientNameValue}_Report_${dateString}.xlsx`;
        
        // Generate and download file
        XLSX.writeFile(wb, filename);
        
        setProgress(100);
        showStatus(`Excel file generated successfully: ${filename}`, 'success');
        
        setTimeout(() => {
            progressBar.classList.remove('visible');
            setProgress(0);
        }, 2000);
        
    } catch (error) {
        showStatus('Error generating Excel file: ' + error.message, 'error');
        console.error(error);
    } finally {
        processBtn.disabled = false;
    }
}

// Filter data for specific sample
function filterDataForSample(data, sampleName) {
    const requiredColumns = [
        'Protein.Group',
        'Protein.Names',
        'Genes',
        'First.Protein.Description',
        'N.Sequences',
        'N.Proteotypic.Sequences'
    ];
    
    return data.map(row => {
        const filteredRow = {};
        
        // Add required columns
        requiredColumns.forEach(col => {
            if (row.hasOwnProperty(col)) {
                filteredRow[col] = row[col];
            }
        });
        
        // Add columns matching the sample name
        Object.keys(row).forEach(key => {
            if (key.includes(sampleName)) {
                filteredRow[key] = row[key];
            }
        });
        
        return filteredRow;
    }).filter(row => {
        // Filter out rows where all sample-specific columns are empty/NA
        const sampleColumns = Object.keys(row).filter(key => key.includes(sampleName));
        return sampleColumns.some(col => {
            const value = row[col];
            return value && value !== '' && value !== 'NA' && value !== 'na';
        });
    });
}

// Set Progress Bar
function setProgress(percent) {
    progressFill.style.width = percent + '%';
}

// Show Status Message
function showStatus(message, type = 'info') {
    statusMessage.textContent = message;
    statusMessage.className = 'status-message visible ' + type;
    
    // Auto-hide after 5 seconds for success messages
    if (type === 'success') {
        setTimeout(() => {
            statusMessage.classList.remove('visible');
        }, 5000);
    }
}
