import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import './css/index.css';

function getCheckedValues(name) {
	return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(
		(el) => el.value
	);
}

function getValue(id) {
	const el = document.getElementById(id);
	return el ? el.value : "";
}

function getClientIdFromUrl() {
	const params = new URLSearchParams(window.location.search);
	return params.get("client_id");
}

function getEntryIdFromUrl() {
	const params = new URLSearchParams(window.location.search);
	return params.get("entry_id");
}

document.addEventListener("DOMContentLoaded", () => {
	const saveButton = document.getElementById("saveclientBtn");
	if (!saveButton) return;

	const entryIdFromUrl = getEntryIdFromUrl();

	// Auto-fill Case No and Date Created for new entries
	if (!entryIdFromUrl) {
		// Set today's date as default
		const today = new Date().toISOString().split('T')[0];
		const dateCreatedInput = document.getElementById("dateCreated");
		if (dateCreatedInput) {
			dateCreatedInput.value = today;
		}

		// Get next case number
		if (window.api?.getMaxCaseNo) {
			window.api.getMaxCaseNo().then(maxCaseNo => {
				const caseNoInput = document.getElementById("caseNo");
				if (caseNoInput && !caseNoInput.value) {
					caseNoInput.value = maxCaseNo + 1;
				}
			}).catch(err => {
				console.error("Failed to get max case number:", err);
			});
		}
	}

	saveButton.addEventListener("click", async () => {
		saveButton.disabled = true;

		try {
			const payload = {
				caseNo: getValue("caseNo"),
				dateCreated: getValue("dateCreated"),
				clientName: getValue("clientName"),
				clientSex: getValue("clientSex"),
				clientCStatus: getValue("clientCStatus"),
				clientAge: getValue("clientAge"),
				clientDob: getValue("clientDob"),
				clientCaseNature: getValue("clientCaseNature"),
				clientCaseRemarks: getValue("clientCaseRemarks"),
				clientAddress: getValue("clientAddress"),
				// Support both the new text input (#clientReferral) and legacy checkbox group (name="clientReferral")
				clientReferral: (getValue("clientReferral").trim() || getCheckedValues("clientReferral").join(", ")).trim(),
				clientOtherRemarks: getValue("clientOtherRemarks"),
				clientPerson: getCheckedValues("clientPerson").join(", "),
				client_id: document.getElementById("clientId").value || null
			};

			const clientIdValue = payload.client_id;

			if (entryIdFromUrl) {
				if (!window.api?.updateEntry) {
					throw new Error("Backend API not available (window.api.updateEntry).");
				}
				await window.api.updateEntry({ ...payload, id: Number(entryIdFromUrl) });
			} else {
				if (!window.api?.saveEntry) {
					throw new Error("Backend API not available (window.api.saveEntry).");
				}
				await window.api.saveEntry(payload);
			}

			if (clientIdValue) {
				window.location.href = `viewCase.html?client_id=${encodeURIComponent(clientIdValue)}`;
			} else {
				window.location.href = "index.html";
			}
		} catch (e) {
			alert(e?.message || "Failed to save entry.");
			saveButton.disabled = false;
		}
	});

	const nameInput = document.getElementById("clientName");
	const suggestionsBox = document.getElementById("clientSuggestions");
	const clientIdInput = document.getElementById("clientId");

	let selectedClient = false;

	(async () => {
		if (entryIdFromUrl && window.api?.getEntryById) {
			try {
				const entry = await window.api.getEntryById(entryIdFromUrl);
				if (entry) {
					document.getElementById("caseNo").value = entry.caseNo || "";
					document.getElementById("dateCreated").value = entry.dateCreated || "";
					document.getElementById("clientName").value = entry.clientName || "";
					document.getElementById("clientSex").value = entry.clientSex || "Female";
					document.getElementById("clientCStatus").value = entry.clientCStatus || "Single";
					document.getElementById("clientAge").value = entry.clientAge ?? "";
					document.getElementById("clientDob").value = entry.clientDob || "";
					document.getElementById("clientCaseNature").value = entry.clientCaseNature || "";
					document.getElementById("clientCaseRemarks").value = entry.clientCaseRemarks || "";
					document.getElementById("clientAddress").value = entry.clientAddress || "";
					document.getElementById("clientReferral").value = entry.clientReferral || "";
					document.getElementById("clientOtherRemarks").value = entry.clientOtherRemarks || "";

					// Checkboxes (multi)
					const persons = (entry.clientPerson || "").split(",").map((s) => s.trim()).filter(Boolean);
					for (const el of document.querySelectorAll('input[name="clientPerson"]')) {
						el.checked = persons.includes(el.value);
					}

					if (entry.client_id != null) clientIdInput.value = entry.client_id;
					if (suggestionsBox) suggestionsBox.innerHTML = "";
					selectedClient = true;
					return;
				}
			} catch (e) {
				console.error(e);
			}
		}

		const clientIdFromUrl = getClientIdFromUrl();
		if (!clientIdFromUrl) return;
		if (clientIdInput.value) return;
		if (!window.api?.getClientWithCases) return;

		try {
			const data = await window.api.getClientWithCases(clientIdFromUrl);
			const client = data?.client;
			if (!client) return;

			clientIdInput.value = client.id ?? clientIdFromUrl;
			document.getElementById("clientName").value = client.name || "";
			document.getElementById("clientSex").value = client.sex || "Female";
			document.getElementById("clientCStatus").value = client.civilStatus || "Single";
			document.getElementById("clientAge").value = client.age ?? "";
			document.getElementById("clientDob").value = client.dob || "";
			document.getElementById("clientAddress").value = client.address || "";

			if (suggestionsBox) suggestionsBox.innerHTML = "";
			selectedClient = true;
		} catch (e) {
			console.error(e);
		}
	})();

	nameInput.addEventListener("input", async () => {
		const query = nameInput.value.trim();

		// 👉 Anytime user types → reset selection
		selectedClient = false;
		clientIdInput.value = "";

		// If empty → clear dropdown
		if (!query) {
			suggestionsBox.innerHTML = "";
			return;
		}

		const results = await window.api.searchClients(query);

		if (!results.length) {
			suggestionsBox.innerHTML = `
      <div class="list-group-item text-muted">
        No matches found
      </div>
    `;
			return;
		}

		suggestionsBox.innerHTML = results.map(client => `
    <button type="button"
      class="list-group-item list-group-item-action"
      data-id="${client.id}"
      data-name="${client.name}"
      data-sex="${client.sex}"
      data-cstatus="${client.civilStatus}"
      data-age="${client.age}"
      data-dob="${client.dob}"
      data-address="${client.address}">
      
      <strong>${client.name}</strong> 
      <small class="text-muted">(${client.address || "No address"})</small>
    </button>
  `).join("");
	});



	suggestionsBox.addEventListener("click", (e) => {
		const btn = e.target.closest("button");
		if (!btn) return;

		// Set client ID
		document.getElementById("clientId").value = btn.dataset.id;

		// Fill fields
		document.getElementById("clientName").value = btn.dataset.name;
		document.getElementById("clientSex").value = btn.dataset.sex || "Female";
		document.getElementById("clientCStatus").value = btn.dataset.cstatus || "Single";
		document.getElementById("clientAge").value = btn.dataset.age || "";
		document.getElementById("clientDob").value = btn.dataset.dob || "";
		document.getElementById("clientAddress").value = btn.dataset.address || "";

		// Clear dropdown
		suggestionsBox.innerHTML = "";
	});


	function setupAutocomplete(inputId, boxId, searchFn) {
		const input = document.getElementById(inputId);
		const box = document.getElementById(boxId);

		if (!input || !box) return;

		let debounceTimer;

		input.addEventListener("input", () => {
			clearTimeout(debounceTimer);
			const query = input.value.trim();

			if (query.length < 2) {
				box.innerHTML = "";
				return;
			}

			debounceTimer = setTimeout(async () => {
				try {
					const results = await searchFn(query);

					box.innerHTML = results.map(r => `
	          <div class="autocomplete-item">${r.value}</div>
	        `).join("");

					box.querySelectorAll(".autocomplete-item").forEach(item => {
						item.addEventListener("click", () => {
							input.value = item.textContent;
							box.innerHTML = "";
						});
					});

				} catch (err) {
					console.error("Autocomplete error:", err);
				}
			}, 250);
		});

		// Hide when clicking outside
		document.addEventListener("click", (e) => {
			if (!input.contains(e.target) && !box.contains(e.target)) {
				box.innerHTML = "";
			}
		});
	}

	function setupCommaTokenAutocomplete(inputId, boxId, searchFn) {
		const input = document.getElementById(inputId);
		const box = document.getElementById(boxId);

		if (!input || !box) return;

		let debounceTimer;

		const getToken = () => {
			const raw = input.value;
			const parts = raw.split(",");
			return (parts[parts.length - 1] || "").trim();
		};

		const applySelection = (selected) => {
			const raw = input.value;
			const parts = raw.split(",");
			const head = parts.slice(0, -1).map((p) => p.trim()).filter(Boolean);
			const next = [...head, selected].join(", ");
			input.value = next;
			box.innerHTML = "";
			input.focus();
		};

		input.addEventListener("input", () => {
			clearTimeout(debounceTimer);
			const token = getToken();

			if (token.length < 2) {
				box.innerHTML = "";
				return;
			}

			debounceTimer = setTimeout(async () => {
				try {
					const results = await searchFn(token);

					box.innerHTML = results.map(r => `
	          <div class="autocomplete-item">${r.value}</div>
	        `).join("");

					box.querySelectorAll(".autocomplete-item").forEach(item => {
						item.addEventListener("click", () => {
							applySelection(item.textContent);
						});
					});
				} catch (err) {
					console.error("Autocomplete error:", err);
				}
			}, 250);
		});

		// Hide when clicking outside
		document.addEventListener("click", (e) => {
			if (!input.contains(e.target) && !box.contains(e.target)) {
				box.innerHTML = "";
			}
		});
	}

	setupAutocomplete(
		"clientAddress",
		"addressSuggestions",
		(q) => window.api.searchAddresses(q)
	);

	setupAutocomplete(
		"clientCaseNature",
		"caseNatureSuggestions",
		(q) => window.api.searchCaseNature(q)
	);

	setupCommaTokenAutocomplete(
		"clientReferral",
		"referralSuggestions",
		(q) => window.api.searchReferrals(q)
	);

});
