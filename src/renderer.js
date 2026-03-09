// Use var to allow redeclaration if the script is loaded multiple times
var api = window.api;
if (!window.rendererLoaded) {
    window.rendererLoaded = true;
    console.log('Renderer Script Loaded');
}

const state = {
    currentView: 'dashboard',
    distributors: [],
    bills: [],
    reports: {
        distributor_id: '',
        status: '',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0],
        autoOpen: false
    }
};

// --- View Rendering Functions ---

const views = {
    dashboard: async () => {
        const stats = await api.dbQuery('getDashboardStats');
        const upcomingBills = await api.dbQuery('getUpcomingBills', 10);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const getDaysLeft = (dueDateStr) => {
            const dueDate = new Date(dueDateStr);
            dueDate.setHours(0, 0, 0, 0);
            const diffTime = dueDate - today;
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays;
        };

        return `
            <div class="view-header">
                <h1>Dashboard</h1>
            </div>
            <div class="grid">
                <div class="card stat-card">
                    <span class="stat-label">Total Outstanding</span>
                    <span class="stat-value">₹${stats.totalOutstanding.toLocaleString()}</span>
                </div>
                <div class="card stat-card">
                    <span class="stat-label">Total Overdue</span>
                    <span class="stat-value stat-overdue">₹${stats.totalOverdue.toLocaleString()}</span>
                </div>
                <div class="card stat-card ${stats.dueToday > 0 ? 'stat-urgent' : ''}">
                    <span class="stat-label">Due Today</span>
                    <span class="stat-value"> ${stats.dueToday} Bills</span>
                </div>
                <div class="card stat-card">
                    <span class="stat-label">Due in 2 Days</span>
                    <span class="stat-value stat-soon">${stats.dueSoon} Bills</span>
                </div>
            </div>
            
            <div class="card">
                <h3 style="margin-bottom: 1.5rem;">Upcoming Payments</h3>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Distributor</th>
                                <th>Bill #</th>
                                <th>Due Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Urgency</th>
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${upcomingBills.map(b => {
            const daysLeft = getDaysLeft(b.due_date);
            let urgencyText = '';
            let urgencyClass = '';

            if (daysLeft < 0) {
                urgencyText = `${Math.abs(daysLeft)} days overdue`;
                urgencyClass = 'color: var(--rose); font-weight: bold;';
            } else if (daysLeft === 0) {
                urgencyText = 'DUE TODAY';
                urgencyClass = 'color: var(--amber); font-weight: bold;';
            } else {
                urgencyText = `${daysLeft} days left`;
                urgencyClass = 'color: var(--text-muted);';
            }

            return `
                                    <tr>
                                        <td>${b.distributor_name}</td>
                                        <td>${b.bill_number}</td>
                                        <td>${b.due_date}</td>
                                        <td>₹${b.total_amount.toLocaleString()}</td>
                                        <td><span class="badge badge-${b.status.toLowerCase().replace(' ', '')}">${b.status}</span></td>
                                        <td style="${urgencyClass}">${urgencyText}</td>
                                        <td>
                                            ${b.status !== 'Paid' ? `<button class="btn" style="padding: 0.5rem 1rem;" onclick="showPaymentModal(${b.id})">Pay</button>` : ''}
                                        </td>
                                    </tr>
                                `;
        }).join('') || '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No upcoming payments found!</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    distributors: async () => {
        const distributors = await api.dbQuery('getDistributors');
        return `
            <div class="view-header">
                <h1>Distributors</h1>
                <button class="btn btn-primary" onclick="showAddDistributorModal()">
                    <i class="fas fa-plus"></i> Add Distributor
                </button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Phone</th>
                                <th>Credit Days</th>
                                <th>Notes</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${distributors.map(d => `
                                <tr>
                                    <td>${d.name}</td>
                                    <td>${d.phone || '-'}</td>
                                    <td>${d.credit_days}</td>
                                    <td>${d.notes || '-'}</td>
                                    <td>
                                        <button class="btn" style="padding: 0.5rem;" onclick="showEditDistributorModal(${d.id})"><i class="fas fa-edit"></i></button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    bills: async () => {
        const bills = await api.dbQuery('getBills');
        return `
            <div class="view-header">
                <h1>Bills & Purchases</h1>
                <button class="btn btn-primary" onclick="showAddBillModal()">
                    <i class="fas fa-plus"></i> New Bill
                </button>
            </div>
            <div class="card">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Distributor</th>
                                <th>Bill #</th>
                                <th>Bill Date</th>
                                <th>Due Date</th>
                                <th>Amount</th>
                                <th>Status</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bills.map(b => `
                                <tr>
                                    <td>${b.distributor_name}</td>
                                    <td>${b.bill_number}</td>
                                    <td>${b.bill_date}</td>
                                    <td>${b.due_date}</td>
                                    <td>₹${b.total_amount.toLocaleString()}</td>
                                    <td><span class="badge badge-${b.status.toLowerCase().replace(' ', '')}">${b.status}</span></td>
                                    <td>
                                        ${b.status !== 'Paid' ? `<button class="btn" onclick="showPaymentModal(${b.id})">Pay</button>` : ''}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    },

    reports: async () => {
        const distributors = await api.dbQuery('getDistributors');
        const filters = state.reports;
        const bills = await api.dbQuery('getBills', filters);

        return `
            <div class="view-header">
                <h1>Reports</h1>
            </div>
            <div class="report-controls-container">
                <div class="report-filter-grid">
                    <div class="form-group">
                        <label>Distributor</label>
                        <select onchange="updateReportFilter('distributor_id', this.value)">
                            <option value="">All Distributors</option>
                            ${distributors.map(d => `<option value="${d.id}" ${filters.distributor_id == d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Status</label>
                        <select onchange="updateReportFilter('status', this.value)">
                            <option value="">All Statuses</option>
                            <option value="Unpaid" ${filters.status === 'Unpaid' ? 'selected' : ''}>Unpaid</option>
                            <option value="Partially Paid" ${filters.status === 'Partially Paid' ? 'selected' : ''}>Partially Paid</option>
                            <option value="Paid" ${filters.status === 'Paid' ? 'selected' : ''}>Paid</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Period</label>
                        <select onchange="setQuickPeriod(this.value)">
                            <option value="custom">Custom Range</option>
                            <option value="7d">Last 7 Days</option>
                            <option value="15d">Last 15 Days</option>
                            <option value="1m">Last 1 month</option>
                            <option value="3m">Last 3 months</option>
                            <option value="6m">Last 6 months</option>
                            <option value="1y">Last 1 year</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Start Date</label>
                        <input type="date" id="startDate" value="${filters.startDate}" onchange="updateReportFilter('startDate', this.value)">
                    </div>
                    <div class="form-group">
                        <label>End Date</label>
                        <input type="date" id="endDate" value="${filters.endDate}" onchange="updateReportFilter('endDate', this.value)">
                    </div>
                </div>

                <div class="report-action-row">
                    <div class="quick-view-control">
                        <span class="ctrl-label">Quick View</span>
                        <label class="toggle-switch">
                            <input type="checkbox" id="autoOpenToggle" ${filters.autoOpen ? 'checked' : ''} onchange="state.reports.autoOpen = this.checked">
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                    <button class="btn btn-primary btn-export" onclick="exportToPDF()">
                        <i class="fas fa-file-pdf"></i> Download PDF Report
                    </button>
                </div>
            </div>

            <div class="report-summary-cards">
                <div class="summary-card">
                    <span class="label">Total Purchased</span>
                    <span class="value">₹${bills.reduce((sum, b) => sum + b.total_amount, 0).toLocaleString()}</span>
                </div>
                <div class="summary-card">
                    <span class="label">Total Paid</span>
                    <span class="value" style="color: var(--primary-light);">₹${bills.reduce((sum, b) => {
            // This is a simplification, ideally we'd have total_paid in bill object
            return sum + (b.status === 'Paid' ? b.total_amount : 0);
        }, 0).toLocaleString()}</span>
                </div>
                <div class="summary-card">
                    <span class="label">Total Outstanding</span>
                    <span class="value" style="color: var(--rose);">₹${bills.reduce((sum, b) => {
            return sum + (b.status !== 'Paid' ? b.total_amount : 0);
        }, 0).toLocaleString()}</span>
                </div>
            </div>

            <div class="card" style="margin-top: 2rem;">
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Distributor</th>
                                <th>Bill #</th>
                                <th>Date</th>
                                <th>Due Date</th>
                                <th>Total</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${bills.length ? bills.map(b => `
                                <tr>
                                    <td>${b.distributor_name}</td>
                                    <td>${b.bill_number}</td>
                                    <td>${b.bill_date}</td>
                                    <td>${b.due_date}</td>
                                    <td>₹${b.total_amount.toLocaleString()}</td>
                                    <td><span class="badge badge-${b.status.toLowerCase().replace(' ', '')}">${b.status}</span></td>
                                </tr>
                            `).join('') : '<tr><td colspan="6" style="text-align: center; padding: 2rem; color: var(--text-muted);">No records found matching filters</td></tr>'}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
};

// --- Navigation Logic ---

function updateClock() {
    const now = new Date();
    const timeEl = document.getElementById('clockTime');
    const dateEl = document.getElementById('clockDate');

    if (timeEl && dateEl) {
        timeEl.textContent = now.toLocaleTimeString('en-US', { hour12: false });
        dateEl.textContent = now.toLocaleDateString('en-US', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
}

setInterval(updateClock, 1000);

window.navigate = async function (viewName) {
    try {
        console.log('Navigating to:', viewName);
        state.currentView = viewName;
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.view === viewName);
        });

        const viewHtml = await views[viewName]();
        document.getElementById('mainView').innerHTML = viewHtml;
    } catch (error) {
        console.error('Navigation Error:', error);
        alert('An error occurred while loading the view: ' + error.message);
    }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => window.navigate(item.dataset.view));
});

// --- Modal Helpers ---

function closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
}

window.showAddDistributorModal = async () => {
    const modalHtml = `
        <div class="modal-overlay">
            <div class="modal">
                <h2>Add Distributor</h2>
                <form id="addDistributorForm" style="margin-top: 1.5rem;">
                    <div class="form-group">
                        <label>Name</label>
                        <input type="text" name="name" required>
                    </div>
                    <div class="form-group">
                        <label>Phone</label>
                        <input type="text" name="phone">
                    </div>
                    <div class="form-group">
                        <label>Credit Days (default 5)</label>
                        <input type="number" name="credit_days" value="5">
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <textarea name="notes"></textarea>
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Save</button>
                        <button type="button" class="btn" onclick="closeModal()" style="flex: 1;">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = modalHtml;

    document.getElementById('addDistributorForm').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());
        await api.dbQuery('addDistributor', data);
        closeModal();
        navigate('distributors');
    };
};

window.showAddBillModal = async () => {
    const distributors = await api.dbQuery('getDistributors');
    const modalHtml = `
        <div class="modal-overlay">
            <div class="modal">
                <h2>New Bill Entry</h2>
                <form id="addBillForm" style="margin-top: 1.5rem;">
                    <div class="form-group">
                        <label>Distributor</label>
                        <select name="distributor_id" required>
                            <option value="">Select Distributor</option>
                            ${distributors.map(d => `<option value="${d.id}" data-credit="${d.credit_days}">${d.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Bill Number</label>
                        <input type="text" name="bill_number" required>
                    </div>
                    <div class="form-group">
                        <label>Bill Date</label>
                        <input type="date" name="bill_date" required id="billDateInput" value="${new Date().toISOString().split('T')[0]}">
                    </div>
                    <div class="form-group">
                        <label>Total Amount</label>
                        <input type="number" name="total_amount" required step="0.01">
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Save Bill</button>
                        <button type="button" class="btn" onclick="closeModal()" style="flex: 1;">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = modalHtml;

    document.getElementById('addBillForm').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData.entries());

        // Calculate due date
        const select = e.target.distributor_id;
        const creditDays = parseInt(select.options[select.selectedIndex].dataset.credit);
        const billDate = new Date(data.bill_date);
        const dueDate = new Date(billDate);
        dueDate.setDate(billDate.getDate() + creditDays);
        data.due_date = dueDate.toISOString().split('T')[0];

        await api.dbQuery('addBill', data);
        closeModal();
        navigate('bills');
    };
};

window.showPaymentModal = async (billId) => {
    const bills = await api.dbQuery('getBills');
    const bill = bills.find(b => b.id === billId);

    if (bill.status === 'Paid') {
        alert('This bill is already fully paid.');
        return;
    }

    const modalHtml = `
        <div class="modal-overlay">
            <div class="modal">
                <h2>Record Payment</h2>
                <p style="color: var(--text-muted); margin-top: 0.5rem;">Bill: ${bill.bill_number} | Balance: ₹${bill.remaining_balance.toLocaleString()}</p>
                <form id="addPaymentForm" style="margin-top: 1.5rem;">
                    <div class="form-group">
                        <label>Payment Date</label>
                        <input type="date" name="payment_date" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label>Amount (Max: ₹${bill.remaining_balance.toLocaleString()})</label>
                        <div style="display: flex; gap: 0.5rem;">
                            <input type="number" name="amount" id="paymentAmountInput" required step="0.01" max="${bill.remaining_balance}" style="flex: 1;">
                            <button type="button" class="btn" style="padding: 0 1rem; flex-shrink: 0;" onclick="fillFullAmount(${bill.remaining_balance})">Pay Full</button>
                        </div>
                    </div>
                    <div class="form-group">
                        <label>Mode</label>
                        <select name="mode">
                            <option value="Cash">Cash</option>
                            <option value="UPI">UPI</option>
                            <option value="Bank">Bank Transfer</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>Notes</label>
                        <input type="text" name="notes">
                    </div>
                    <div style="display: flex; gap: 1rem; margin-top: 1.5rem;">
                        <button type="submit" class="btn btn-primary" style="flex: 1;">Save Payment</button>
                        <button type="button" class="btn" onclick="closeModal()" style="flex: 1;">Cancel</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = modalHtml;

    document.getElementById('addPaymentForm').onsubmit = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = { ...Object.fromEntries(formData.entries()), bill_id: billId };

        const amount = parseFloat(data.amount);
        if (amount > bill.remaining_balance) {
            alert(`Payment amount (₹${amount}) exceeds remaining balance (₹${bill.remaining_balance}).`);
            return;
        }

        await api.dbQuery('addPayment', data);
        closeModal();
        navigate('bills');
    };
};

// --- Report Filtering & Export ---

window.setQuickPeriod = (period) => {
    const end = new Date();
    let start = new Date();

    switch (period) {
        case '7d': start.setDate(end.getDate() - 7); break;
        case '15d': start.setDate(end.getDate() - 15); break;
        case '1m': start.setMonth(end.getMonth() - 1); break;
        case '3m': start.setMonth(end.getMonth() - 3); break;
        case '6m': start.setMonth(end.getMonth() - 6); break;
        case '1y': start.setFullYear(end.getFullYear() - 1); break;
        default: return; // Custom
    }

    state.reports.startDate = start.toISOString().split('T')[0];
    state.reports.endDate = end.toISOString().split('T')[0];
    navigate('reports');
};

window.updateReportFilter = (key, value) => {
    state.reports[key] = value;
    navigate('reports');
};

window.exportToPDF = async () => {
    const bills = await api.dbQuery('getBills', state.reports);
    const now = new Date();
    const timeStr = `${now.getHours()}${now.getMinutes()}${now.getSeconds()}`;
    const dateRange = `${state.reports.startDate || 'Start'}_to_${state.reports.endDate || 'End'}_T${timeStr}`;

    const filePath = await api.exportPDF({ dateRange });
    if (!filePath) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    // Branding / Header Decoration
    doc.setFillColor(15, 23, 42); // Midnight Navy
    doc.rect(0, 0, 210, 40, 'F');

    doc.setDrawColor(16, 185, 129); // Emerald Accent
    doc.setLineWidth(1.5);
    doc.line(0, 40, 210, 40);

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont(undefined, 'bold');
    doc.text('VERIDIAN', 15, 22);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(148, 163, 184); // Muted Slate
    doc.text('PREMIUM PURCHASE ANALYTICS', 15, 30);

    // Stylish Shop Name
    doc.setTextColor(16, 185, 129); // Emerald
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('SHREE SHANKAR VIJAY SUPERMARKET', 195, 31, { align: 'right' });

    // Metadata
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.text(`GENERATED: ${new Date().toLocaleString()}`, 195, 22, { align: 'right' });

    // Report Parameters Section
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text('Report Overview', 15, 55);

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${state.reports.startDate || 'Commencement'} - ${state.reports.endDate || 'Current'}`, 15, 62);
    doc.text(`Filter Status: ${state.reports.status || 'Universal'}`, 15, 67);

    // Summary Financials
    const totalPurchased = bills.reduce((sum, b) => sum + b.total_amount, 0);
    const totalOutstanding = bills.filter(b => b.status !== 'Paid').reduce((sum, b) => sum + b.total_amount, 0);

    // Summary Boxes
    doc.setDrawColor(226, 232, 240);
    doc.setFillColor(248, 250, 252);

    doc.roundedRect(15, 75, 85, 25, 3, 3, 'FD');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text('TOTAL VOLUME', 20, 83);
    doc.setTextColor(15, 23, 42);
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`INR ${totalPurchased.toLocaleString()}`, 20, 93);

    doc.roundedRect(110, 75, 85, 25, 3, 3, 'FD');
    doc.setFont(undefined, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(9);
    doc.text('OUTSTANDING BALANCE', 115, 83);
    doc.setTextColor(244, 63, 94); // Rose
    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text(`INR ${totalOutstanding.toLocaleString()}`, 115, 93);

    // Detailed Table
    const tableData = bills.map(b => [
        b.distributor_name.toUpperCase(),
        b.bill_number,
        b.bill_date,
        b.due_date,
        `Rs. ${b.total_amount.toLocaleString()}`,
        b.status.toUpperCase()
    ]);

    doc.autoTable({
        startY: 115,
        head: [['DISTRIBUTOR', 'BILL NO.', 'DATE', 'DUE DATE', 'AMOUNT', 'STATUS']],
        body: tableData,
        theme: 'grid',
        headStyles: {
            fillColor: [15, 23, 42],
            textColor: [255, 255, 255],
            fontSize: 7,
            fontStyle: 'bold',
            halign: 'center',
            cellPadding: 3
        },
        styles: {
            fontSize: 7,
            cellPadding: 3,
            textColor: [51, 65, 85],
            lineColor: [226, 232, 240],
            overflow: 'linebreak'
        },
        columnStyles: {
            0: { cellWidth: 45 },
            4: { halign: 'right', fontStyle: 'bold', textColor: [15, 23, 42], cellWidth: 30 },
            5: { halign: 'center', cellWidth: 25 }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        margin: { top: 45 }
    });

    // Final Footer
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setDrawColor(226, 232, 240);
        doc.line(15, 280, 195, 280);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`VERIDIAN ANALYTICS CORE - PAGE ${i} / ${pageCount}`, 105, 287, { align: 'center' });

        // Steganography (Hidden Digital Fingerprint)
        // Nearly invisible text (opacity handled by very light gray)
        doc.setTextColor(240, 240, 240);
        doc.setFontSize(4);
        doc.text(`VERIFIED_BY_VERIDIAN_SYSTEM_ID_${Date.now()}_AUTHENTIC_REPORT_SSVS`, 195, 292, { align: 'right' });
    }

    const pdfData = doc.output('arraybuffer');
    const success = await api.savePDF(filePath, pdfData);
    if (success) {
        if (state.reports.autoOpen) {
            await api.openFile(filePath);
        } else {
            alert('High-End PDF Report generated successfully!');
        }
    } else {
        alert('Failed to generate PDF report.');
    }
};

window.fillFullAmount = (amount) => {
    const input = document.getElementById('paymentAmountInput');
    if (input) input.value = amount;
};

// Init
updateClock();
navigate('dashboard');
