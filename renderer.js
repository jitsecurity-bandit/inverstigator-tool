const { ipcRenderer } = require('electron');

// Global state
let currentResults = [];
let sortState = { column: null, direction: 'asc' };
let currentProfile = null;
let filterCounter = 0;

// DOM elements - will be initialized after DOM loads
let queryForm, tenantIdInput, statusSelect, startDateInput, endDateInput, limitInput;
let customFiltersContainer, addFilterBtn, clearFiltersBtn, submitBtn, btnText, btnLoader;
let resultsCount, errorMessage, resultsTable, resultsTbody, exportJsonBtn, exportCsvBtn;
let awsStatus, awsProfileSelect, detailModal, detailContent;

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    // Initialize DOM elements
    queryForm = document.getElementById('query-form');
    tenantIdInput = document.getElementById('tenant-id');
    statusSelect = document.getElementById('status');
    startDateInput = document.getElementById('start-date');
    endDateInput = document.getElementById('end-date');
    limitInput = document.getElementById('limit');
    customFiltersContainer = document.getElementById('custom-filters-container');
    addFilterBtn = document.getElementById('add-filter');
    clearFiltersBtn = document.getElementById('clear-filters');
    submitBtn = queryForm.querySelector('button[type="submit"]');
    btnText = submitBtn.querySelector('.btn-text');
    btnLoader = submitBtn.querySelector('.btn-loader');
    resultsCount = document.getElementById('results-count');
    errorMessage = document.getElementById('error-message');
    resultsTable = document.getElementById('results-table');
    resultsTbody = document.getElementById('results-tbody');
    exportJsonBtn = document.getElementById('export-json');
    exportCsvBtn = document.getElementById('export-csv');
    awsStatus = document.getElementById('aws-status');
    awsProfileSelect = document.getElementById('aws-profile');
    detailModal = document.getElementById('detail-modal');
    detailContent = document.getElementById('detail-content');
    
    loadAvailableProfiles();
    setupEventListeners();
    loadSavedFilters();
    updateAwsStatus();
    
    // Add initial custom filter
    addCustomFilter();
});

// Load available AWS profiles
async function loadAvailableProfiles() {
    try {
        const result = await ipcRenderer.invoke('get-available-profiles');
        if (result.success) {
            // Clear existing options except the first one
            awsProfileSelect.innerHTML = '<option value="">Select Profile</option>';
            
            result.profiles.forEach(profile => {
                const option = document.createElement('option');
                option.value = profile;
                option.textContent = profile === 'jit-rocket-admin' ? 'Rocket Admin' : 
                                   profile === 'jit-prod' ? 'Production' : profile;
                awsProfileSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading profiles:', error);
    }
}

// Update AWS connection status
async function updateAwsStatus() {
    try {
        const config = await ipcRenderer.invoke('get-aws-config');
        const statusIndicator = awsStatus.querySelector('.status-indicator');
        const statusText = awsStatus.querySelector('.status-text');
        
        if (config.error) {
            statusIndicator.className = 'status-indicator error';
            statusText.textContent = `AWS Error: ${config.error}`;
        } else if (config.currentProfile) {
            statusIndicator.className = 'status-indicator connected';
            const profileName = config.currentProfile === 'jit-rocket-admin' ? 'Rocket Admin' : 
                               config.currentProfile === 'jit-prod' ? 'Production' : config.currentProfile;
            statusText.textContent = `Connected: ${profileName} (${config.region})`;
        } else {
            statusIndicator.className = 'status-indicator no-profile';
            statusText.textContent = 'No profile selected';
        }
    } catch (error) {
        console.error('Error checking AWS connection:', error);
        const statusIndicator = awsStatus.querySelector('.status-indicator');
        const statusText = awsStatus.querySelector('.status-text');
        statusIndicator.className = 'status-indicator error';
        statusText.textContent = 'Connection check failed';
    }
}

// Handle profile selection
async function handleProfileChange(profile) {
    if (!profile) {
        currentProfile = null;
        updateAwsStatus();
        return;
    }

    const statusIndicator = awsStatus.querySelector('.status-indicator');
    const statusText = awsStatus.querySelector('.status-text');
    
    // Show loading state
    statusIndicator.className = 'status-indicator';
    statusText.textContent = 'Connecting...';
    
    try {
        const result = await ipcRenderer.invoke('set-aws-profile', profile);
        if (result.success) {
            currentProfile = profile;
            updateAwsStatus();
            hideError();
        } else {
            showError(`Failed to connect to AWS profile: ${result.error}`);
            awsProfileSelect.value = '';
            currentProfile = null;
            updateAwsStatus();
        }
    } catch (error) {
        console.error('Error setting profile:', error);
        showError(`Failed to connect to AWS profile: ${error.message}`);
        awsProfileSelect.value = '';
        currentProfile = null;
        updateAwsStatus();
    }
}

// Setup event listeners
function setupEventListeners() {
    // Form submission
    queryForm.addEventListener('submit', handleQuery);
    
    // Profile selection
    awsProfileSelect.addEventListener('change', (e) => {
        handleProfileChange(e.target.value);
    });
    
    // Clear filters
    clearFiltersBtn.addEventListener('click', clearFilters);
    
    // Add filter button
    addFilterBtn.addEventListener('click', addCustomFilter);
    
    // Export buttons
    exportJsonBtn.addEventListener('click', () => exportResults('json'));
    exportCsvBtn.addEventListener('click', () => exportResults('csv'));
    
    // Table sorting
    resultsTable.addEventListener('click', handleTableSort);
    
    // Modal events
    detailModal.addEventListener('click', (e) => {
        if (e.target === detailModal || e.target.classList.contains('modal-close')) {
            closeModal();
        }
    });
    
    // Save filters on change
    [tenantIdInput, statusSelect, startDateInput, endDateInput, limitInput].forEach(input => {
        input.addEventListener('change', saveFilters);
    });
    
    // Export menu event
    ipcRenderer.on('export-results', () => {
        if (currentResults.length > 0) {
            exportResults('json');
        }
    });
    
    // Profile selector menu event
    ipcRenderer.on('show-profile-selector', () => {
        awsProfileSelect.focus();
    });
}

// Add a new custom filter row
function addCustomFilter(field = '', operator = '=', value = '') {
    const filterId = `filter-${filterCounter++}`;
    const filterRow = document.createElement('div');
    filterRow.className = 'custom-filter-row';
    filterRow.dataset.filterId = filterId;
    
    filterRow.innerHTML = `
        <div class="filter-inputs">
            <input type="text" placeholder="Field name (e.g., jit_event_name)" class="filter-field" value="${field}">
            <select class="filter-operator">
                <option value="=" ${operator === '=' ? 'selected' : ''}>Equals (=)</option>
                <option value="<" ${operator === '<' ? 'selected' : ''}>Less than (<)</option>
                <option value=">" ${operator === '>' ? 'selected' : ''}>Greater than (>)</option>
                <option value="contains" ${operator === 'contains' ? 'selected' : ''}>Contains</option>
                <option value="begins_with" ${operator === 'begins_with' ? 'selected' : ''}>Begins with</option>
            </select>
            <input type="text" placeholder="Value to filter by" class="filter-value" value="${value}">
            <button type="button" class="remove-filter-btn" onclick="removeCustomFilter('${filterId}')">−</button>
        </div>
    `;
    
    customFiltersContainer.appendChild(filterRow);
    
    // Add event listeners for save filters
    const fieldInput = filterRow.querySelector('.filter-field');
    const operatorSelect = filterRow.querySelector('.filter-operator');
    const valueInput = filterRow.querySelector('.filter-value');
    fieldInput.addEventListener('change', saveFilters);
    operatorSelect.addEventListener('change', saveFilters);
    valueInput.addEventListener('change', saveFilters);
    
    return filterRow;
}

// Remove a custom filter row
function removeCustomFilter(filterId) {
    const filterRow = document.querySelector(`[data-filter-id="${filterId}"]`);
    if (filterRow) {
        filterRow.remove();
        saveFilters();
    }
}

// Get all custom filters
function getCustomFilters() {
    const filters = [];
    const filterRows = customFiltersContainer.querySelectorAll('.custom-filter-row');
    
    filterRows.forEach(row => {
        const field = row.querySelector('.filter-field').value.trim();
        const operator = row.querySelector('.filter-operator').value.trim();
        const value = row.querySelector('.filter-value').value.trim();
        
        if (field && value) {
            filters.push({ field, operator, value });
        }
    });
    
    return filters;
}

// Handle query form submission
async function handleQuery(e) {
    e.preventDefault();
    
    if (!currentProfile) {
        showError('Please select an AWS profile first');
        return;
    }
    
    const tenantId = tenantIdInput.value.trim();
    const status = statusSelect.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const limit = parseInt(limitInput.value) || 50;
    const customFilters = getCustomFilters();
    
    if (!tenantId || !status) {
        showError('Please fill in all required fields');
        return;
    }
    
    // Validate custom filters
    const filterRows = customFiltersContainer.querySelectorAll('.custom-filter-row');
    for (const row of filterRows) {
        const field = row.querySelector('.filter-field').value.trim();
        const operator = row.querySelector('.filter-operator').value.trim();
        const value = row.querySelector('.filter-value').value.trim();
        
        if ((field && !value) || (!field && value)) {
            showError('Each custom filter must have both field and value filled in');
            return;
        }
    }
    
    // Validate UUID format for tenant ID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(tenantId)) {
        showError('Tenant ID must be a valid UUID format');
        return;
    }
    
    // Validate date range
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        showError('Start date cannot be after end date');
        return;
    }
    
    setLoadingState(true);
    hideError();
    
    try {
        const params = {
            tenantId,
            status,
            startDate: startDate ? new Date(startDate).toISOString() : null,
            endDate: endDate ? new Date(endDate).toISOString() : null,
            limit,
            customFilters
        };
        
        const result = await ipcRenderer.invoke('query-dynamodb', params);
        
        if (result.success) {
            currentResults = result.data;
            displayResults(result.data);
            updateResultsCount(result.count, result.scannedCount, result.profile);
            enableExportButtons(result.data.length > 0);
        } else {
            showError(`Query failed: ${result.error}`);
            currentResults = [];
            displayResults([]);
            updateResultsCount(0, 0);
            enableExportButtons(false);
        }
    } catch (error) {
        console.error('Query error:', error);
        showError(`Unexpected error: ${error.message}`);
        currentResults = [];
        displayResults([]);
        updateResultsCount(0, 0);
        enableExportButtons(false);
    } finally {
        setLoadingState(false);
    }
}

// Display query results in table
function displayResults(results) {
    const resultsTbody = document.querySelector('.results-table tbody');
    
    if (!results || results.length === 0) {
        resultsTbody.innerHTML = '<tr><td colspan="9" class="no-results">No results found</td></tr>';
        updateResultsCount(0, 0, currentProfile);
        enableExportButtons(false);
        return;
    }
    
    updateResultsCount(results.length, 0, currentProfile);
    enableExportButtons(true);
    
    const rows = results.map((item, index) => {
        const executionId = item.execution_id || 'N/A';
        const jitEventId = item.jit_event_id || 'N/A';
        const jitEventName = item.jit_event_name || 'N/A';
        const status = item.status || 'unknown';
        const createdAt = formatDate(item.created_at);
        const completedAt = formatDate(item.completed_at);
        
        // Handle errors
        let errorsDisplay = 'None';
        if (item.errors && item.errors.length > 0) {
            const firstError = item.errors[0];
            const errorPreview = truncateText(JSON.stringify(firstError), 50);
            const hasMoreErrors = item.errors.length > 1;
            
            errorsDisplay = `
                <div class="error-cell">
                    <div class="error-preview">${errorPreview}</div>
                    <button class="expand-btn small" onclick="toggleErrorExpansion(${index})">expand</button>
                    <div class="error-full" id="error-${index}" style="display: none;">
                        <pre>${JSON.stringify(item.errors, null, 2)}</pre>
                    </div>
                </div>
                ${hasMoreErrors ? `<div class="error-preview">+${item.errors.length - 1} more</div>` : ''}
            `;
        }
        
        // Handle additional fields
        const additionalFields = getAdditionalFields(item);
        
        return `
            <tr data-index="${index}">
                <td class="expandable-cell" title="${jitEventId}">
                    <div class="cell-content">
                        <span class="cell-text">${truncateText(jitEventId, 25)}</span>
                        ${jitEventId.length > 25 ? `<button class="expand-cell-btn" onclick="toggleCellExpansion(this, '${jitEventId}')">⋯</button>` : ''}
                    </div>
                </td>
                <td class="expandable-cell" title="${jitEventName}">
                    <div class="cell-content">
                        <span class="cell-text">${truncateText(jitEventName, 25)}</span>
                        ${jitEventName.length > 25 ? `<button class="expand-cell-btn" onclick="toggleCellExpansion(this, '${jitEventName}')">⋯</button>` : ''}
                    </div>
                </td>
                <td class="expandable-cell" title="${executionId}">
                    <div class="cell-content">
                        <span class="cell-text">${truncateText(executionId, 25)}</span>
                        ${executionId.length > 25 ? `<button class="expand-cell-btn" onclick="toggleCellExpansion(this, '${executionId}')">⋯</button>` : ''}
                    </div>
                </td>
                <td><span class="status-badge status-${status}">${status}</span></td>
                <td class="expandable-cell" title="${createdAt}">
                    <div class="cell-content">
                        <span class="cell-text">${createdAt}</span>
                    </div>
                </td>
                <td class="expandable-cell" title="${completedAt}">
                    <div class="cell-content">
                        <span class="cell-text">${completedAt}</span>
                    </div>
                </td>
                <td class="errors-cell">${errorsDisplay}</td>
                <td class="additional-fields-cell">
                    ${additionalFields.length > 0 ? `
                        <div class="additional-fields">
                            <span class="fields-count">${additionalFields.length} fields</span>
                            <button class="expand-btn small" onclick="openAdditionalDataModal(${index})">show</button>
                        </div>
                        <div class="additional-fields-content" id="additional-${index}" style="display: none;">
                            <pre>${additionalFields.join('\n')}</pre>
                        </div>
                    ` : 'No additional data'}
                </td>
                <td class="actions-cell">
                    <button class="action-btn view" onclick="viewDetails('${executionId}')">View All</button>
                    <button class="action-btn copy" onclick="copyToClipboard('${executionId}')">Copy ID</button>
                    <button class="action-btn expand-row" onclick="toggleRowExpansion(${index})">Expand</button>
                </td>
            </tr>
            <tr class="expanded-row" id="expanded-${index}" style="display: none;">
                <td colspan="9">
                    <div class="expanded-content">
                        <h4>Complete Record Data:</h4>
                        <pre>${JSON.stringify(item, null, 2)}</pre>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    resultsTbody.innerHTML = rows;
    
    // Initialize column resizing after table is populated
    setTimeout(() => {
        initializeColumnResizing();
    }, 100);
}

// Toggle error expansion
function toggleErrorExpansion(index) {
    const errorFull = document.getElementById(`error-${index}`);
    const expandBtn = document.querySelector(`[onclick="toggleErrorExpansion(${index})"]`);
    
    if (errorFull.style.display === 'none') {
        errorFull.style.display = 'block';
        expandBtn.textContent = 'collapse';
        expandBtn.classList.add('expanded');
    } else {
        errorFull.style.display = 'none';
        expandBtn.textContent = expandBtn.textContent.includes('more') ? 
            expandBtn.textContent.replace('collapse', expandBtn.textContent.match(/\+\d+ more/)?.[0] || 'expand') : 
            'expand';
        expandBtn.classList.remove('expanded');
    }
}

// Toggle cell expansion
function toggleCellExpansion(button, fullText) {
    const cellContent = button.parentElement;
    const cellText = cellContent.querySelector('.cell-text');
    const isExpanded = button.classList.contains('expanded');
    
    if (isExpanded) {
        // Collapse
        cellText.textContent = truncateText(fullText, 25);
        button.textContent = '⋯';
        button.classList.remove('expanded');
        cellContent.classList.remove('expanded');
    } else {
        // Expand
        cellText.textContent = fullText;
        button.textContent = '−';
        button.classList.add('expanded');
        cellContent.classList.add('expanded');
    }
}

// Format date for display
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        return date.toLocaleString();
    } catch (error) {
        return dateString;
    }
}

// Truncate text with ellipsis
function truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Update results count display
function updateResultsCount(count, scannedCount, profile) {
    if (count === 0) {
        resultsCount.textContent = 'No results';
    } else {
        const profileName = profile === 'jit-rocket-admin' ? 'Rocket' : 
                           profile === 'jit-prod' ? 'Prod' : profile;
        resultsCount.textContent = `${count} result${count !== 1 ? 's' : ''} (${profileName})`;
        if (scannedCount && scannedCount !== count) {
            resultsCount.textContent += ` - ${scannedCount} scanned`;
        }
    }
}

// Enable/disable export buttons
function enableExportButtons(enabled) {
    exportJsonBtn.disabled = !enabled;
    exportCsvBtn.disabled = !enabled;
}

// Handle table sorting
function handleTableSort(e) {
    const th = e.target.closest('th[data-sort]');
    if (!th) return;
    
    const column = th.getAttribute('data-sort');
    
    // Update sort state
    if (sortState.column === column) {
        sortState.direction = sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
        sortState.column = column;
        sortState.direction = 'asc';
    }
    
    // Update UI
    document.querySelectorAll('th[data-sort]').forEach(header => {
        header.classList.remove('sort-asc', 'sort-desc');
    });
    th.classList.add(`sort-${sortState.direction}`);
    
    // Sort and display results
    const sortedResults = [...currentResults].sort((a, b) => {
        let aVal = a[column] || '';
        let bVal = b[column] || '';
        
        // Handle dates
        if (column.includes('_at')) {
            aVal = new Date(aVal || 0);
            bVal = new Date(bVal || 0);
        }
        
        // Handle strings
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
        }
        
        if (aVal < bVal) return sortState.direction === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortState.direction === 'asc' ? 1 : -1;
        return 0;
    });
    
    displayResults(sortedResults);
}

// View detailed information
function viewDetails(executionId) {
    const item = currentResults.find(result => result.execution_id === executionId);
    if (!item) return;
    
    detailContent.textContent = JSON.stringify(item, null, 2);
    detailModal.style.display = 'flex';
}

// Copy execution ID to clipboard
async function copyToClipboard(executionId) {
    try {
        await navigator.clipboard.writeText(executionId);
        // Show temporary feedback
        const btn = event.target;
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.background = '#28a745';
        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.background = '';
        }, 1000);
    } catch (error) {
        console.error('Failed to copy to clipboard:', error);
    }
}

// Close modal
function closeModal() {
    detailModal.style.display = 'none';
}

// Export results
async function exportResults(format) {
    if (currentResults.length === 0) {
        showError('No results to export');
        return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const profileSuffix = currentProfile ? `-${currentProfile}` : '';
    const filename = `job-executions${profileSuffix}-${timestamp}.${format}`;
    
    try {
        const result = await ipcRenderer.invoke('export-to-file', {
            data: currentResults,
            format,
            filename
        });
        
        if (result.success && !result.cancelled) {
            // Show success message
            const originalText = format === 'json' ? exportJsonBtn.textContent : exportCsvBtn.textContent;
            const btn = format === 'json' ? exportJsonBtn : exportCsvBtn;
            btn.textContent = 'Exported!';
            btn.style.background = '#28a745';
            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '';
            }, 2000);
        } else if (result.error) {
            showError(`Export failed: ${result.error}`);
        }
    } catch (error) {
        console.error('Export error:', error);
        showError(`Export failed: ${error.message}`);
    }
}

// Clear all filters
function clearFilters() {
    tenantIdInput.value = '';
    statusSelect.value = '';
    startDateInput.value = '';
    endDateInput.value = '';
    limitInput.value = '50';
    
    // Clear custom filters
    customFiltersContainer.innerHTML = '';
    filterCounter = 0;
    
    // Clear results
    currentResults = [];
    displayResults([]);
    updateResultsCount(0, 0);
    enableExportButtons(false);
    hideError();
    
    // Clear saved filters
    localStorage.removeItem('dynamodb-debug-filters');
}

// Show error message
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

// Hide error message
function hideError() {
    errorMessage.style.display = 'none';
}

// Set loading state
function setLoadingState(loading) {
    submitBtn.disabled = loading;
    if (loading) {
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline';
    } else {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
}

// Save filters to localStorage
function saveFilters() {
    const customFilters = getCustomFilters();
    
    const filters = {
        tenantId: tenantIdInput.value,
        status: statusSelect.value,
        startDate: startDateInput.value,
        endDate: endDateInput.value,
        limit: limitInput.value,
        customFilters,
        profile: awsProfileSelect.value
    };
    localStorage.setItem('dynamodb-debug-filters', JSON.stringify(filters));
}

// Load saved filters from localStorage
function loadSavedFilters() {
    try {
        const saved = localStorage.getItem('dynamodb-debug-filters');
        if (saved) {
            const filters = JSON.parse(saved);
            tenantIdInput.value = filters.tenantId || '';
            statusSelect.value = filters.status || '';
            startDateInput.value = filters.startDate || '';
            endDateInput.value = filters.endDate || '';
            limitInput.value = filters.limit || '50';
            
            // Load custom filters
            if (filters.customFilters && filters.customFilters.length > 0) {
                filters.customFilters.forEach(filter => {
                    addCustomFilter(filter.field, filter.operator || '=', filter.value);
                });
            }
            
            // Set profile after a short delay to ensure options are loaded
            if (filters.profile) {
                setTimeout(() => {
                    awsProfileSelect.value = filters.profile;
                    handleProfileChange(filters.profile);
                }, 100);
            }
        }
    } catch (error) {
        console.error('Error loading saved filters:', error);
    }
}

// Make functions available globally for onclick handlers
window.viewDetails = viewDetails;
window.copyToClipboard = copyToClipboard;
window.toggleErrorExpansion = toggleErrorExpansion;
window.toggleCellExpansion = toggleCellExpansion;
window.toggleAdditionalFields = toggleAdditionalFields;
window.toggleRowExpansion = toggleRowExpansion;
window.removeCustomFilter = removeCustomFilter;
window.openAdditionalDataModal = openAdditionalDataModal;
window.closeAdditionalDataModal = closeAdditionalDataModal;
window.copyFieldValue = copyFieldValue;

// Get additional fields beyond the main ones
function getAdditionalFields(item) {
    const mainFields = ['jit_event_id', 'event_id', 'jit_event_name', 'execution_id', 'status', 'created_at', 'completed_at', 'errors'];
    const additionalFields = [];
    
    Object.keys(item).forEach(key => {
        if (!mainFields.includes(key)) {
            const value = item[key];
            if (value !== null && value !== undefined) {
                const displayValue = typeof value === 'object' ? 
                    JSON.stringify(value, null, 2) : 
                    String(value);
                additionalFields.push(`${key}: ${truncateText(displayValue, 100)}`);
            }
        }
    });
    
    return additionalFields;
}

// Toggle additional fields display
function toggleAdditionalFields(index) {
    const content = document.getElementById(`additional-${index}`);
    const button = document.querySelector(`[onclick="toggleAdditionalFields(${index})"]`);
    
    if (content.style.display === 'none') {
        content.style.display = 'block';
        button.textContent = 'hide';
        button.classList.add('expanded');
    } else {
        content.style.display = 'none';
        button.textContent = 'show';
        button.classList.remove('expanded');
    }
}

// Toggle full row expansion
function toggleRowExpansion(index) {
    const expandedRow = document.getElementById(`expanded-${index}`);
    const button = document.querySelector(`[onclick="toggleRowExpansion(${index})"]`);
    
    if (expandedRow.style.display === 'none') {
        expandedRow.style.display = 'table-row';
        button.textContent = 'Collapse';
        button.classList.add('expanded');
    } else {
        expandedRow.style.display = 'none';
        button.textContent = 'Expand';
        button.classList.remove('expanded');
    }
} 

// Open additional data modal
function openAdditionalDataModal(index) {
    const item = currentResults[index];
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('additional-data-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'additional-data-modal';
        modal.className = 'modal';
        modal.style.display = 'none';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3 id="additional-modal-title">Additional Data</h3>
                    <button class="modal-close" onclick="closeAdditionalDataModal()">Close</button>
                </div>
                <div class="modal-body">
                    <div class="modal-actions">
                        <button class="modal-action-btn copy" id="additional-modal-copy-btn">Copy All Data</button>
                    </div>
                    <div class="additional-data-content" id="additional-data-content">
                        <!-- Content will be populated dynamically -->
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Add event listeners
        modal.addEventListener('click', (e) => {
            if (e.target === modal || e.target.classList.contains('modal-close')) {
                closeAdditionalDataModal();
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'flex') {
                closeAdditionalDataModal();
            }
        });
    }
    
    const modalTitle = document.getElementById('additional-modal-title');
    const modalContent = document.getElementById('additional-data-content');
    const modalCopyBtn = document.getElementById('additional-modal-copy-btn');

    modalTitle.textContent = `Additional Data - ${item.execution_id || 'N/A'}`;
    
    // Get all additional fields without truncation
    const mainFields = ['jit_event_id', 'event_id', 'jit_event_name', 'execution_id', 'status', 'control_name', 'created_at', 'completed_at', 'errors'];
    const additionalFields = [];
    
    Object.keys(item).forEach(key => {
        if (!mainFields.includes(key)) {
            const value = item[key];
            if (value !== null && value !== undefined) {
                additionalFields.push({ key, value });
            }
        }
    });

    if (additionalFields.length === 0) {
        modalContent.innerHTML = '<div class="no-additional-data">No additional data available for this record.</div>';
    } else {
        // Group fields by type for better organization
        const stringFields = [];
        const objectFields = [];
        const arrayFields = [];
        const otherFields = [];

        additionalFields.forEach(({ key, value }) => {
            if (Array.isArray(value)) {
                arrayFields.push({ key, value });
            } else if (typeof value === 'object') {
                objectFields.push({ key, value });
            } else if (typeof value === 'string') {
                stringFields.push({ key, value });
            } else {
                otherFields.push({ key, value });
            }
        });

        let content = '';

        // String fields
        if (stringFields.length > 0) {
            content += `
                <div class="additional-data-section">
                    <h4>📝 Text Fields (${stringFields.length})</h4>
                    <div class="additional-data-grid">
                        ${stringFields.map(({ key, value }) => `
                            <div class="additional-data-item">
                                <div class="additional-data-label">${key}:</div>
                                <div class="additional-data-value string-value">${value}</div>
                                <button class="copy-field-btn" onclick="copyFieldValue('${key}', '${value.replace(/'/g, "\\'")}')">Copy</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Other primitive fields
        if (otherFields.length > 0) {
            content += `
                <div class="additional-data-section">
                    <h4>🔢 Other Fields (${otherFields.length})</h4>
                    <div class="additional-data-grid">
                        ${otherFields.map(({ key, value }) => `
                            <div class="additional-data-item">
                                <div class="additional-data-label">${key}:</div>
                                <div class="additional-data-value other-value">${String(value)}</div>
                                <button class="copy-field-btn" onclick="copyFieldValue('${key}', '${String(value).replace(/'/g, "\\'")}')">Copy</button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // Array fields
        if (arrayFields.length > 0) {
            content += `
                <div class="additional-data-section">
                    <h4>📚 Array Fields (${arrayFields.length})</h4>
                    ${arrayFields.map(({ key, value }) => `
                        <div class="additional-data-complex">
                            <div class="additional-data-complex-header">
                                <span class="additional-data-label">${key} (${value.length} items):</span>
                                <button class="copy-field-btn" onclick="copyFieldValue('${key}', '${JSON.stringify(value).replace(/'/g, "\\'")}')">Copy</button>
                            </div>
                            <div class="additional-data-json">
                                <pre>${JSON.stringify(value, null, 2)}</pre>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        // Object fields
        if (objectFields.length > 0) {
            content += `
                <div class="additional-data-section">
                    <h4>🗂️ Object Fields (${objectFields.length})</h4>
                    ${objectFields.map(({ key, value }) => `
                        <div class="additional-data-complex">
                            <div class="additional-data-complex-header">
                                <span class="additional-data-label">${key}:</span>
                                <button class="copy-field-btn" onclick="copyFieldValue('${key}', '${JSON.stringify(value).replace(/'/g, "\\'")}')">Copy</button>
                            </div>
                            <div class="additional-data-json">
                                <pre>${JSON.stringify(value, null, 2)}</pre>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        modalContent.innerHTML = content;
    }

    // Set up copy all button
    modalCopyBtn.onclick = () => {
        const allAdditionalData = {};
        additionalFields.forEach(({ key, value }) => {
            allAdditionalData[key] = value;
        });
        
        navigator.clipboard.writeText(JSON.stringify(allAdditionalData, null, 2)).then(() => {
            alert('All additional data copied to clipboard!');
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy data.');
        });
    };

    modal.style.display = 'flex';
}

// Close additional data modal
function closeAdditionalDataModal() {
    const modal = document.getElementById('additional-data-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Copy individual field value
function copyFieldValue(fieldName, value) {
    navigator.clipboard.writeText(value).then(() => {
        alert(`${fieldName} copied to clipboard!`);
    }).catch(err => {
        console.error('Failed to copy:', err);
        alert('Failed to copy field value.');
    });
}

// Column resizing functionality
function initializeColumnResizing() {
    const table = document.querySelector('.results-table');
    if (!table) return;
    
    let isResizing = false;
    let currentColumn = null;
    let startX = 0;
    let startWidth = 0;
    let resizeLine = null;
    
    // Create resize line element
    function createResizeLine() {
        const line = document.createElement('div');
        line.className = 'resize-line';
        document.querySelector('.table-container').appendChild(line);
        return line;
    }
    
    // Handle mouse down on column header
    function handleMouseDown(e) {
        const th = e.target.closest('th');
        if (!th) return;
        
        const rect = th.getBoundingClientRect();
        const isRightEdge = e.clientX > rect.right - 8; // 8px tolerance
        
        if (isRightEdge && th.nextElementSibling) { // Don't resize last column
            e.preventDefault();
            isResizing = true;
            currentColumn = th;
            startX = e.clientX;
            startWidth = th.offsetWidth;
            
            // Create resize line
            if (!resizeLine) {
                resizeLine = createResizeLine();
            }
            
            // Position resize line
            const tableRect = table.getBoundingClientRect();
            const containerRect = document.querySelector('.table-container').getBoundingClientRect();
            resizeLine.style.left = (e.clientX - containerRect.left) + 'px';
            resizeLine.classList.add('active');
            
            // Add visual feedback
            table.classList.add('resizing');
            currentColumn.classList.add('resizing');
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }
    }
    
    // Handle mouse move during resize
    function handleMouseMove(e) {
        if (!isResizing || !currentColumn) return;
        
        const diff = e.clientX - startX;
        const newWidth = Math.max(50, startWidth + diff); // Minimum width of 50px
        
        // Update resize line position
        const containerRect = document.querySelector('.table-container').getBoundingClientRect();
        resizeLine.style.left = (e.clientX - containerRect.left) + 'px';
        
        // Apply new width
        const columnIndex = Array.from(currentColumn.parentNode.children).indexOf(currentColumn) + 1;
        const percentage = (newWidth / table.offsetWidth) * 100;
        
        // Update both th and td widths
        const style = document.createElement('style');
        style.id = `column-${columnIndex}-width`;
        
        // Remove existing style for this column
        const existingStyle = document.getElementById(`column-${columnIndex}-width`);
        if (existingStyle) {
            existingStyle.remove();
        }
        
        style.textContent = `
            .results-table th:nth-child(${columnIndex}), 
            .results-table td:nth-child(${columnIndex}) { 
                width: ${percentage}% !important; 
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // Handle mouse up to finish resize
    function handleMouseUp() {
        if (!isResizing) return;
        
        isResizing = false;
        
        // Remove visual feedback
        table.classList.remove('resizing');
        if (currentColumn) {
            currentColumn.classList.remove('resizing');
        }
        
        // Hide resize line
        if (resizeLine) {
            resizeLine.classList.remove('active');
        }
        
        // Save column widths to localStorage
        saveColumnWidths();
        
        currentColumn = null;
        
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
    
    // Save column widths to localStorage
    function saveColumnWidths() {
        const widths = {};
        const ths = table.querySelectorAll('th');
        
        ths.forEach((th, index) => {
            const computedStyle = window.getComputedStyle(th);
            widths[index + 1] = computedStyle.width;
        });
        
        localStorage.setItem('columnWidths', JSON.stringify(widths));
    }
    
    // Load column widths from localStorage
    function loadColumnWidths() {
        const savedWidths = localStorage.getItem('columnWidths');
        if (!savedWidths) return;
        
        try {
            const widths = JSON.parse(savedWidths);
            
            Object.entries(widths).forEach(([columnIndex, width]) => {
                const style = document.createElement('style');
                style.id = `column-${columnIndex}-width`;
                
                const widthValue = parseFloat(width);
                const percentage = (widthValue / table.offsetWidth) * 100;
                
                style.textContent = `
                    .results-table th:nth-child(${columnIndex}), 
                    .results-table td:nth-child(${columnIndex}) { 
                        width: ${percentage}% !important; 
                    }
                `;
                
                document.head.appendChild(style);
            });
        } catch (e) {
            console.error('Error loading column widths:', e);
        }
    }
    
    // Set up event listeners for column resizing
    table.addEventListener('mousedown', handleMouseDown);
    
    // Load saved column widths
    loadColumnWidths();
} 