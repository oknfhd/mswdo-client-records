import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import Chart from 'chart.js/auto';
import './css/index.css';

// Store all data for client-side filtering
let allClients = [];
let allEntries = [];

// Chart instances
let ageChartInstance = null;
let sexChartInstance = null;
let statusChartInstance = null;
let addressChartInstance = null;
let barangayChartInstance = null;
let referralChartInstance = null;
let picChartInstance = null;

// Chart color palettes
const chartColors = {
  primary: ['#007bff', '#6c757d', '#28a745', '#dc3545', '#fd7e14', '#20c997', '#17a2b8', '#e83e8c', '#6f42c1', '#20c997'],
  pastel: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF', '#4BC0C0', '#36A2EB', '#FF6384']
};

document.addEventListener("DOMContentLoaded", () => {



  const insertLink = document.querySelector('a[href="inputs.html"]');
  if (insertLink) {
    insertLink.addEventListener("click", async (e) => {
      e.preventDefault();

      // Preserve any query params (e.g., inputs.html?client_id=123)
      const href = insertLink.getAttribute("href") || "inputs.html";
      window.location.href = href;
    });
  }

  function escapeText(value) {
    return value == null ? "" : String(value);
  }

  function renderReferralAccordionList(referralData) {
    const container = document.getElementById("referralAccordionList");
    if (!container) return;

    container.innerHTML = "";

    const rows = Array.isArray(referralData) ? referralData : [];
    if (!rows.length) {
      const empty = document.createElement("div");
      empty.className = "text-muted";
      empty.textContent = "No referral data.";
      container.appendChild(empty);
      return;
    }

    for (const row of rows) {
      const name = escapeText(row?.referral ?? "Unknown");
      const count = row?.count ?? 0;

      const line = document.createElement("div");
      line.className = "d-flex justify-content-between";

      const left = document.createElement("p");
      left.className = "mb-0";
      left.textContent = name;

      const right = document.createElement("p");
      right.className = "mb-0";
      right.textContent = String(count);

      line.appendChild(left);
      line.appendChild(right);
      container.appendChild(line);
    }
  }

  function renderBarangayAccordionCounts(barangayData) {
    const mapping = new Map([
      ["ambassador", "ambassadorCount"],
      ["ambongdolan", "ambongdolanCount"],
      ["ba-ayan", "baayanCount"],
      ["basil", "basilCount"],
      ["caponga", "capongaCount"],
      ["daclan", "daclanCount"],
      ["tublay central", "centralCount"],
      ["tuel", "tuelCount"],
    ]);

    // Reset to 0 to avoid stale values
    for (const id of mapping.values()) setElementText(id, 0);

    for (const row of Array.isArray(barangayData) ? barangayData : []) {
      const name = (row?.barangay ?? "").toString().toLowerCase().trim();
      const id = mapping.get(name);
      if (!id) continue;
      setElementText(id, row?.count ?? 0);
    }
  }

  function renderEntriesTable(entries) {
    const tbody = document.getElementById("entries_body");
    if (!tbody) return;

    tbody.innerHTML = "";

    for (const entry of entries || []) {
      const tr = document.createElement("tr");

      // Case No
      let td = document.createElement("td");
      td.textContent = escapeText(entry.caseNo);
      tr.appendChild(td);

      // NAME (CLICKABLE)
      td = document.createElement("td");

      const link = document.createElement("a");
      const clientId = entry.client_id ?? entry.clientId ?? "";
      link.href = `viewCase.html?client_id=${encodeURIComponent(clientId)}`;
      link.textContent = escapeText(entry.clientName);
      link.className = "text-decoration-none text-primary";
      td.appendChild(link);
      tr.appendChild(td);

      // Age
      td = document.createElement("td");
      td.textContent = escapeText(entry.clientAge);
      tr.appendChild(td);

      // Sex
      td = document.createElement("td");
      td.textContent = escapeText(entry.clientSex);
      tr.appendChild(td);

      // Nature of Case
      td = document.createElement("td");
      td.textContent = escapeText(entry.clientCaseNature);
      tr.appendChild(td);

      // Referral
      td = document.createElement("td");
      td.textContent = escapeText(entry.clientReferral);
      tr.appendChild(td);

      // Person in Charge
      td = document.createElement("td");
      td.textContent = escapeText(entry.clientPerson);
      tr.appendChild(td);

      // Actions
      td = document.createElement("td");

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "btn btn-sm btn-outline-primary me-2";
      editBtn.innerHTML = `<i class="bi bi-pencil-square"></i>`;
      editBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.location.href = `inputs.html?entry_id=${encodeURIComponent(entry.id)}`;
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "btn btn-sm btn-outline-danger";
      deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
      deleteBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        if (!window.api?.deleteEntry) return;
        if (!confirm("Delete this case?")) return;

        try {
          await window.api.deleteEntry(entry.id);
          loadEntries();
          loadClients();
        } catch (err) {
          console.error(err);
          alert(err?.message || "Failed to delete case.");
        }
      });

      td.appendChild(editBtn);
      td.appendChild(deleteBtn);
      tr.appendChild(td);

      tbody.appendChild(tr);
    }
  }

  function renderClientsTable(clients) {
    const tbody = document.getElementById("clients_body");
    if (!tbody) return;

    tbody.innerHTML = "";

    for (const client of clients || []) {
      const tr = document.createElement("tr");
      tr.style.cursor = "pointer";
      tr.addEventListener("click", () => {
        window.location.href = `viewCase.html?client_id=${encodeURIComponent(client.id)}`;
      });

      const tdName = document.createElement("td");
      tdName.textContent = escapeText(client.name);
      tr.appendChild(tdName);

      const tdAge = document.createElement("td");
      tdAge.textContent = escapeText(client.age);
      tr.appendChild(tdAge);

      const tdSex = document.createElement("td");
      tdSex.textContent = escapeText(client.sex);
      tr.appendChild(tdSex);

      const tdCStatus = document.createElement("td");
      tdCStatus.textContent = escapeText(client.civilStatus);
      tr.appendChild(tdCStatus);

      const tdAddress = document.createElement("td");
      tdAddress.textContent = escapeText(client.address);
      tr.appendChild(tdAddress);

      tbody.appendChild(tr);
    }
  }

  async function loadEntries() {
    if (!window.api?.getEntries) return;

    try {
      const entries = await window.api.getEntries();
      allEntries = entries || [];
      renderEntriesTable(allEntries);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to load entries.");
    }
  }

  async function loadClients() {
    if (!window.api?.getClients) return;

    try {
      const clients = await window.api.getClients();
      allClients = clients || [];
      renderClientsTable(allClients);
    } catch (e) {
      console.error(e);
      alert(e?.message || "Failed to load clients.");
    }
  }

  // ========================
  // STATISTICS & CHARTS
  // ========================

  async function loadStatistics() {
    if (!window.api?.getStatistics) return;
    try {
      const stats = await window.api.getStatistics();
      const totalClientsEl = document.getElementById("totalClientsCount");
      const totalCasesEl = document.getElementById("totalCasesCount");
      if (totalClientsEl) totalClientsEl.textContent = stats.totalClients || 0;
      if (totalCasesEl) totalCasesEl.textContent = stats.totalCases || 0;

      // Load accordion data
      await loadAccordionData();
    } catch (e) {
      console.error("Failed to load statistics:", e);
    }
  }

  // Helper function to safely set text content
  function setElementText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || 0;
  }

  // Load accordion data from API
  async function loadAccordionData() {
    // Load gender distribution for Sex accordion
    try {
      const genderData = await window.api.getGenderDistribution();
      genderData.forEach(d => {
        const gender = (d.gender || '').toLowerCase();
        if (gender === 'female') setElementText('femaleCount', d.count);
        else if (gender === 'male') setElementText('maleCount', d.count);
      });
    } catch (e) {
      console.error("Failed to load gender accordion data:", e);
    }

    // Load age distribution for Age Group accordion
    try {
      const ageData = await window.api.getAgeDistribution();
      ageData.forEach(d => {
        const group = (d.ageGroup || '');
        if (group.includes('<') || group.includes('Under') || group === '< 18') setElementText('ageUnder18Count', d.count);
        else if (group.includes('18-30') || group === '18-30') setElementText('age18to30Count', d.count);
        else if (group.includes('31-59') || group === '31-59') setElementText('age31to59Count', d.count);
        else if (group.includes('>') || group.includes('Over') || group.includes('60')) setElementText('ageOver60Count', d.count);
      });
    } catch (e) {
      console.error("Failed to load age accordion data:", e);
    }

    // Load civil status distribution for Civil Status accordion
    try {
      const statusData = await window.api.getCivilStatusDistribution();
      statusData.forEach(d => {
        const status = (d.status || '').toLowerCase();
        if (status === 'single') setElementText('singleCount', d.count);
        else if (status === 'married') setElementText('marriedCount', d.count);
        else if (status === 'widowed') setElementText('widowedCount', d.count);
        else if (status === 'separated') setElementText('separatedCount', d.count);
        else if (status === 'divorced') setElementText('divorcedCount', d.count);
        else if (status === 'annulled') setElementText('annulledCount', d.count);
      });
    } catch (e) {
      console.error("Failed to load civil status accordion data:", e);
    }

    // Load person in charge distribution for PIC accordion
    try {
      const picData = await window.api.getPersonInChargeDistribution();
      picData.forEach(d => {
        const person = (d.person || '').toLowerCase();
        if (person === 'aurea jane penrad') setElementText('aureaJanePenradCount', d.count);
        else if (person === 'stebenson epi') setElementText('stebensonEpiCount', d.count);
        else if (person === 'norilyn chasuras') setElementText('norilynChasurasCount', d.count);
        else if (person === 'margarita guillermo') setElementText('margaritaGuillermoCount', d.count);
        else if (person === 'alpha lizardo') setElementText('alphaLizardoCount', d.count);
        else if (person === 'jeraquel nabus') setElementText('jeraquelNabusCount', d.count);
      });
    } catch (e) {
      console.error("Failed to load person in charge accordion data:", e);
    }
  }

  // Load filtered accordion data
  async function loadFilteredAccordionData() {
    // Load gender distribution for Sex accordion
    try {
      const genderData = await window.api.getFilteredGenderDistribution(currentFilter);
      genderData.forEach(d => {
        const gender = (d.gender || '').toLowerCase();
        if (gender === 'female') setElementText('femaleCount', d.count);
        else if (gender === 'male') setElementText('maleCount', d.count);
      });
    } catch (e) {
      console.error("Failed to load filtered gender accordion data:", e);
    }

    // Load age distribution for Age Group accordion
    try {
      const ageData = await window.api.getFilteredAgeDistribution(currentFilter);
      ageData.forEach(d => {
        const group = (d.ageGroup || '');
        if (group.includes('<') || group.includes('Under') || group === '< 18') setElementText('ageUnder18Count', d.count);
        else if (group.includes('18-30') || group === '18-30') setElementText('age18to30Count', d.count);
        else if (group.includes('31-59') || group === '31-59') setElementText('age31to59Count', d.count);
        else if (group.includes('>') || group.includes('Over') || group.includes('60')) setElementText('ageOver60Count', d.count);
      });
    } catch (e) {
      console.error("Failed to load filtered age accordion data:", e);
    }

    // Load civil status distribution for Civil Status accordion
    try {
      const statusData = await window.api.getFilteredCivilStatusDistribution(currentFilter);
      statusData.forEach(d => {
        const status = (d.status || '').toLowerCase();
        if (status === 'single') setElementText('singleCount', d.count);
        else if (status === 'married') setElementText('marriedCount', d.count);
        else if (status === 'widowed') setElementText('widowedCount', d.count);
        else if (status === 'separated') setElementText('separatedCount', d.count);
        else if (status === 'divorced') setElementText('divorcedCount', d.count);
        else if (status === 'annulled') setElementText('annulledCount', d.count);
      });
    } catch (e) {
      console.error("Failed to load filtered civil status accordion data:", e);
    }

    // Load person in charge distribution for PIC accordion
    try {
      const picData = await window.api.getFilteredPersonInChargeDistribution(currentFilter);
      picData.forEach(d => {
        const person = (d.person || '').toLowerCase();
        if (person === 'aurea jane penrad') setElementText('aureaJanePenradCount', d.count);
        else if (person === 'stebenson epi') setElementText('stebensonEpiCount', d.count);
        else if (person === 'norilyn chasuras') setElementText('norilynChasurasCount', d.count);
        else if (person === 'margarita guillermo') setElementText('margaritaGuillermoCount', d.count);
        else if (person === 'alpha lizardo') setElementText('alphaLizardoCount', d.count);
        else if (person === 'jeraquel nabus') setElementText('jeraquelNabusCount', d.count);
      });
    } catch (e) {
      console.error("Failed to load filtered person in charge accordion data:", e);
    }
  }

  async function loadCharts() {
    // Age Distribution Chart
    try {
      const ageData = await window.api.getAgeDistribution();
      const ageCtx = document.getElementById("ageChart");
      if (ageCtx) {
        if (ageChartInstance) ageChartInstance.destroy();
        ageChartInstance = new Chart(ageCtx, {
          type: 'bar',
          data: {
            labels: ageData.map(d => d.ageGroup),
            datasets: [{
              label: 'Clients',
              data: ageData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load age chart:", e);
    }

    // Gender Distribution Chart
    try {
      const genderData = await window.api.getGenderDistribution();
      const sexCtx = document.getElementById("sexChart");
      if (sexCtx) {
        if (sexChartInstance) sexChartInstance.destroy();
        sexChartInstance = new Chart(sexCtx, {
          type: 'pie',
          data: {
            labels: genderData.map(d => d.gender),
            datasets: [{
              data: genderData.map(d => d.count),
              backgroundColor: chartColors.pastel,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load gender chart:", e);
    }

    // Civil Status Chart
    try {
      const statusData = await window.api.getCivilStatusDistribution();
      const statusCtx = document.getElementById("statusChart");
      if (statusCtx) {
        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: statusData.map(d => d.status),
            datasets: [{
              data: statusData.map(d => d.count),
              backgroundColor: chartColors.pastel,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load civil status chart:", e);
    }

    // Address Chart
    try {
      const addressData = await window.api.getAddressDistribution();
      const addressCtx = document.getElementById("addressChart");
      if (addressCtx) {
        if (addressChartInstance) addressChartInstance.destroy();
        addressChartInstance = new Chart(addressCtx, {
          type: 'bar',
          data: {
            labels: addressData.map(d => d.address),
            datasets: [{
              label: 'Number of Cases',
              data: addressData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load address chart:", e);
    }

    // Barangay Chart (derived from address strings)
    try {
      const barangayData = await window.api.getBarangayDistribution();
      const barangayCtx = document.getElementById("barangayChart");
      renderBarangayAccordionCounts(barangayData);
      if (barangayCtx) {
        if (barangayChartInstance) barangayChartInstance.destroy();
        barangayChartInstance = new Chart(barangayCtx, {
          type: 'bar',
          data: {
            labels: barangayData.map(d => d.barangay),
            datasets: [{
              label: 'Number of Clients',
              data: barangayData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load barangay chart:", e);
    }

    // Referral Chart
    try {
      const referralData = await window.api.getReferralDistribution();
      const referralCtx = document.getElementById("referralChart");
      renderReferralAccordionList(referralData);
      if (referralCtx) {
        if (referralChartInstance) referralChartInstance.destroy();
        referralChartInstance = new Chart(referralCtx, {
          type: 'pie',
          data: {
            labels: referralData.map(d => d.referral),
            datasets: [{
              data: referralData.map(d => d.count),
              backgroundColor: chartColors.pastel,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load referral chart:", e);
    }

    // Person In Charge Chart
    try {
      const picData = await window.api.getPersonInChargeDistribution();
      const picCtx = document.getElementById("picChart");
      if (picCtx) {
        if (picChartInstance) picChartInstance.destroy();
        picChartInstance = new Chart(picCtx, {
          type: 'doughnut',
          data: {
            labels: picData.map(d => d.person),
            datasets: [{
              label: 'Number of Cases',
              data: picData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load person in charge chart:", e);
    }
  }

  // View Summary button - Generate Document
  const viewSummaryBtn = document.getElementById("viewSummary");
  if (viewSummaryBtn) {
    viewSummaryBtn.addEventListener("click", async () => {
      try {
        // Get current filter state
        const fromMonth = parseInt(document.getElementById('filterFromMonth')?.value) || null;
        const fromYear = parseInt(document.getElementById('filterFromYear')?.value) || null;
        const toMonth = parseInt(document.getElementById('filterToMonth')?.value) || null;
        const toYear = parseInt(document.getElementById('filterToYear')?.value) || null;

        const filters = { fromYear, fromMonth, toYear, toMonth };

        // Check if any filter is set
        const hasFilter = fromYear || fromMonth || toYear || toMonth;
        const filterToUse = hasFilter ? filters : null;

        const result = await window.api.generateSummaryDocument(filterToUse);

        if (result.success) {
          // Show success notification
          const notification = document.createElement('div');
          notification.className = 'alert alert-success position-fixed top-0 start-50 translate-middle-x mt-3';
          notification.style.zIndex = '9999';
          notification.textContent = 'Summary document generated successfully!';
          document.body.appendChild(notification);
          setTimeout(() => notification.remove(), 3000);
        } else if (result.message === 'Save cancelled') {
          // User cancelled, do nothing
        } else {
          alert('Failed to generate document: ' + (result.message || 'Unknown error'));
        }
      } catch (e) {
        console.error("Failed to generate document:", e);
        alert("Failed to generate document: " + (e?.message || "Unknown error"));
      }
    });
  }

  // ========================
  // TIMELINE FILTER
  // ========================

  // Current filter state
  let currentFilter = {
    fromYear: null,
    fromMonth: null,
    toYear: null,
    toMonth: null
  };

  // Month names for display
  const monthNames = [
    '', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Load available months/years and populate dropdowns
  async function loadTimelineFilterOptions() {
    if (!window.api?.getAvailableMonthsYears) return;

    try {
      const data = await window.api.getAvailableMonthsYears();

      const fromMonthSelect = document.getElementById('filterFromMonth');
      const fromYearSelect = document.getElementById('filterFromYear');
      const toMonthSelect = document.getElementById('filterToMonth');
      const toYearSelect = document.getElementById('filterToYear');

      // Populate months dropdowns
      const monthOptions = data.months.map(m =>
        `<option value="${m}">${monthNames[m]}</option>`
      ).join('');

      if (fromMonthSelect) fromMonthSelect.innerHTML = '<option value="">All(Month)</option>' + monthOptions;
      if (toMonthSelect) toMonthSelect.innerHTML = '<option value="">All(Year)</option>' + monthOptions;

      // Populate years dropdowns
      const yearOptions = data.years.map(y =>
        `<option value="${y}">${y}</option>`
      ).join('');

      if (fromYearSelect) fromYearSelect.innerHTML = '<option value="">All(Month)</option>' + yearOptions;
      if (toYearSelect) toYearSelect.innerHTML = '<option value="">All(Year)</option>' + yearOptions;

    } catch (e) {
      console.error("Failed to load timeline filter options:", e);
    }
  }

  // Apply timeline filter
  async function applyTimelineFilter() {
    const fromMonth = parseInt(document.getElementById('filterFromMonth')?.value) || null;
    const fromYear = parseInt(document.getElementById('filterFromYear')?.value) || null;
    const toMonth = parseInt(document.getElementById('filterToMonth')?.value) || null;
    const toYear = parseInt(document.getElementById('filterToYear')?.value) || null;

    currentFilter = { fromYear, fromMonth, toYear, toMonth };

    // Check if any filter is set
    const hasFilter = fromYear || fromMonth || toYear || toMonth;

    if (hasFilter) {
      await loadFilteredStatistics();
      await loadFilteredCharts();
      await loadFilteredAccordionData();
    } else {
      // Reset to unfiltered data
      loadStatistics();
      loadCharts();
    }
  }

  // Load filtered statistics
  async function loadFilteredStatistics() {
    if (!window.api?.getFilteredStatistics) return;
    try {
      const stats = await window.api.getFilteredStatistics(currentFilter);
      const totalClientsEl = document.getElementById("totalClientsCount");
      const totalCasesEl = document.getElementById("totalCasesCount");
      if (totalClientsEl) totalClientsEl.textContent = stats.totalClients || 0;
      if (totalCasesEl) totalCasesEl.textContent = stats.totalCases || 0;
    } catch (e) {
      console.error("Failed to load filtered statistics:", e);
    }
  }

  // Load filtered charts
  async function loadFilteredCharts() {
    // Age Distribution Chart
    try {
      const ageData = await window.api.getFilteredAgeDistribution(currentFilter);
      const ageCtx = document.getElementById("ageChart");
      if (ageCtx) {
        if (ageChartInstance) ageChartInstance.destroy();
        ageChartInstance = new Chart(ageCtx, {
          type: 'bar',
          data: {
            labels: ageData.map(d => d.ageGroup),
            datasets: [{
              label: 'Clients',
              data: ageData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              y: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load filtered age chart:", e);
    }

    // Gender Distribution Chart
    try {
      const genderData = await window.api.getFilteredGenderDistribution(currentFilter);
      const sexCtx = document.getElementById("sexChart");
      if (sexCtx) {
        if (sexChartInstance) sexChartInstance.destroy();
        sexChartInstance = new Chart(sexCtx, {
          type: 'pie',
          data: {
            labels: genderData.map(d => d.gender),
            datasets: [{
              data: genderData.map(d => d.count),
              backgroundColor: chartColors.pastel,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load filtered gender chart:", e);
    }

    // Civil Status Chart
    try {
      const statusData = await window.api.getFilteredCivilStatusDistribution(currentFilter);
      const statusCtx = document.getElementById("statusChart");
      if (statusCtx) {
        if (statusChartInstance) statusChartInstance.destroy();
        statusChartInstance = new Chart(statusCtx, {
          type: 'doughnut',
          data: {
            labels: statusData.map(d => d.status),
            datasets: [{
              data: statusData.map(d => d.count),
              backgroundColor: chartColors.pastel,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load filtered civil status chart:", e);
    }

    // Address Chart
    try {
      const addressData = await window.api.getFilteredAddressDistribution(currentFilter);
      const addressCtx = document.getElementById("addressChart");
      if (addressCtx) {
        if (addressChartInstance) addressChartInstance.destroy();
        addressChartInstance = new Chart(addressCtx, {
          type: 'bar',
          data: {
            labels: addressData.map(d => d.address),
            datasets: [{
              label: 'Number of Cases',
              data: addressData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load filtered address chart:", e);
    }

    // Barangay Chart (derived from address strings)
    try {
      const barangayData = await window.api.getFilteredBarangayDistribution(currentFilter);
      const barangayCtx = document.getElementById("barangayChart");
      renderBarangayAccordionCounts(barangayData);
      if (barangayCtx) {
        if (barangayChartInstance) barangayChartInstance.destroy();
        barangayChartInstance = new Chart(barangayCtx, {
          type: 'bar',
          data: {
            labels: barangayData.map(d => d.barangay),
            datasets: [{
              label: 'Number of Clients',
              data: barangayData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            indexAxis: 'y',
            responsive: true,
            plugins: {
              legend: { display: false }
            },
            scales: {
              x: { beginAtZero: true, ticks: { stepSize: 1 } }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load filtered barangay chart:", e);
    }

    // Referral Chart
    try {
      const referralData = await window.api.getFilteredReferralDistribution(currentFilter);
      const referralCtx = document.getElementById("referralChart");
      renderReferralAccordionList(referralData);
      if (referralCtx) {
        if (referralChartInstance) referralChartInstance.destroy();
        referralChartInstance = new Chart(referralCtx, {
          type: 'pie',
          data: {
            labels: referralData.map(d => d.referral),
            datasets: [{
              data: referralData.map(d => d.count),
              backgroundColor: chartColors.pastel,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load filtered referral chart:", e);
    }

    // Person In Charge Chart
    try {
      const picData = await window.api.getFilteredPersonInChargeDistribution(currentFilter);
      const picCtx = document.getElementById("picChart");
      if (picCtx) {
        if (picChartInstance) picChartInstance.destroy();
        picChartInstance = new Chart(picCtx, {
          type: 'doughnut',
          data: {
            labels: picData.map(d => d.person),
            datasets: [{
              label: 'Number of Cases',
              data: picData.map(d => d.count),
              backgroundColor: chartColors.primary,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: {
              legend: { display: false }
            }
          }
        });
      }
    } catch (e) {
      console.error("Failed to load filtered person in charge chart:", e);
    }
  }

  // Setup timeline filter event listeners
  const applyFilterBtn = document.getElementById('applyTimelineFilter');
  const resetFilterBtn = document.getElementById('resetTimelineFilter');

  if (applyFilterBtn) {
    applyFilterBtn.addEventListener('click', applyTimelineFilter);
  }

  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', () => {
      // Clear all filter selections
      document.getElementById('filterFromMonth').value = '';
      document.getElementById('filterFromYear').value = '';
      document.getElementById('filterToMonth').value = '';
      document.getElementById('filterToYear').value = '';

      currentFilter = { fromYear: null, fromMonth: null, toYear: null, toMonth: null };

      // Reload unfiltered data
      loadStatistics();
      loadCharts();
    });
  }

  // Load timeline filter options on page load
  loadTimelineFilterOptions();

  function loadDashboard() {
    loadEntries();
    loadClients();
    loadStatistics();
    loadCharts();
  }

  window.addEventListener("hashchange", handleRoute);
  window.addEventListener("load", handleRoute);

  function handleRoute() {
    const hash = window.location.hash;

    if (hash.startsWith("#viewCase")) {
      const params = new URLSearchParams(hash.split("?")[1]);
      const clientId = params.get("client_id");

      loadViewCase(clientId);
    }

    if (!hash || hash === "#") {
      loadDashboard();
    }
  }

  async function loadViewCase(clientId) {
    if (!clientId) return;

    try {
      if (!window.api?.getClientById) {
        console.error("getClientById API not found");
        return;
      }

      const client = await window.api.getClientById(clientId);

      if (!client) {
        console.warn("Client not found:", clientId);
        return;
      }

      renderViewCase(client);
    } catch (err) {
      console.error("Failed to load view case:", err);
    }
  }

  function renderViewCase(client) {
    // Example: fill fields on a "view case page"
    const nameEl = document.getElementById("viewClientName");
    const ageEl = document.getElementById("viewClientAge");
    const sexEl = document.getElementById("viewClientSex");

    if (nameEl) nameEl.textContent = client.name || "";
    if (ageEl) ageEl.textContent = client.age || "";
    if (sexEl) sexEl.textContent = client.sex || "";
  }

  loadDashboard()

  // ========================
  // SEARCH FUNCTIONALITY
  // ========================





  // Search Clients
  const searchClientInput = document.getElementById("searchClient");
  if (searchClientInput) {
    let searchDebounceTimer;
    searchClientInput.addEventListener("input", async (e) => {
      clearTimeout(searchDebounceTimer);
      const query = e.target.value.trim();

      if (!query) {
        // If empty, show all clients
        renderClientsTable(allClients);
        return;
      }

      // Debounce search to avoid too many API calls
      searchDebounceTimer = setTimeout(async () => {
        try {
          if (window.api?.searchClients) {
            const results = await window.api.searchClients(query);
            renderClientsTable(results);
          } else {
            // Fallback: client-side filtering
            const filtered = allClients.filter(client =>
              (client.name && client.name.toLowerCase().includes(query.toLowerCase())) ||
              (client.address && client.address.toLowerCase().includes(query.toLowerCase()))
            );
            renderClientsTable(filtered);
          }
        } catch (err) {
          console.error("Search error:", err);
          alert(err?.message || "Search failed.");
        }
      }, 300);
    });
  }

  // Search Records/Entries
  const searchRecordInput = document.getElementById("searchRecord");
  if (searchRecordInput) {
    let searchDebounceTimer;
    searchRecordInput.addEventListener("input", (e) => {
      clearTimeout(searchDebounceTimer);
      const query = e.target.value.trim();

      if (!query) {
        // If empty, show all entries
        renderEntriesTable(allEntries);
        return;
      }

      // Debounce search
      searchDebounceTimer = setTimeout(() => {
        const lowerQuery = query.toLowerCase();
        const filtered = allEntries.filter(entry =>
          (entry.caseNo && entry.caseNo.toLowerCase().includes(lowerQuery)) ||
          (entry.clientName && entry.clientName.toLowerCase().includes(lowerQuery)) ||
          (entry.clientCaseNature && entry.clientCaseNature.toLowerCase().includes(lowerQuery)) ||
          (entry.clientReferral && entry.clientReferral.toLowerCase().includes(lowerQuery)) ||
          (entry.clientPerson && entry.clientPerson.toLowerCase().includes(lowerQuery)) ||
          (entry.clientAddress && entry.clientAddress.toLowerCase().includes(lowerQuery))
        );
        renderEntriesTable(filtered);
      }, 300);
    });
  }

  function fillForm(data) {
    if (!data) return;
    document.getElementById("caseNo").value = data.caseNo || "";
    document.getElementById("fileCreated").value = data.dateCreated
      ? data.dateCreated.split("T")[0]
      : "";
    document.getElementById("clientName").value = data.clientName || "";
    document.getElementById("clientSex").value = data.clientSex || "Unlisted";
    document.getElementById("clientAge").value = data.clientAge || "";
    document.getElementById("clientCStatus").value = data.clientCStatus || "Unlisted";
    setSelectedReferrals(data.clientReferral || "");
  }


});
