import 'bootstrap/dist/css/bootstrap.min.css';
import { Modal } from 'bootstrap';

function getClientId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("client_id");
}

document.addEventListener("DOMContentLoaded", async () => {
    const clientId = getClientId();

    if (!clientId) {
        alert("No client selected.");
        return;
    }

    const addCaseLink = document.querySelector('a[href="inputs.html"]');
    if (addCaseLink) {
        addCaseLink.href = `inputs.html?client_id=${encodeURIComponent(clientId)}`;
    }

    const data = await window.api.getClientWithCases(clientId);

    if (!data || !data.client) {
        alert("Client not found.");
        return;
    }

    const { client, cases } = data;

    const editModalEl = document.getElementById("editClientModal");
    const deleteModalEl = document.getElementById("deleteClientModal");
    const editModal = editModalEl ? new Modal(editModalEl) : null;
    const deleteModal = deleteModalEl ? new Modal(deleteModalEl) : null;

    const editClientBtn = document.getElementById("editClientBtn");
    if (editClientBtn && editModal) {
        editClientBtn.addEventListener("click", () => {
            document.getElementById("editClient_name").value = client.name || "";
            document.getElementById("editClient_sex").value = client.sex || "";
            document.getElementById("editClient_civilStatus").value = client.civilStatus || "";
            document.getElementById("editClient_age").value = client.age ?? "";
            document.getElementById("editClient_dob").value = client.dob || "";
            document.getElementById("editClient_address").value = client.address || "";
            editModal.show();
        });
    }

    const saveClientChangesBtn = document.getElementById("saveClientChangesBtn");
    if (saveClientChangesBtn && editModal) {
        saveClientChangesBtn.addEventListener("click", async () => {
            if (!window.api?.updateClient) return;

            saveClientChangesBtn.disabled = true;
            try {
                await window.api.updateClient({
                    id: client.id,
                    name: document.getElementById("editClient_name").value,
                    sex: document.getElementById("editClient_sex").value,
                    civilStatus: document.getElementById("editClient_civilStatus").value,
                    age: document.getElementById("editClient_age").value,
                    dob: document.getElementById("editClient_dob").value,
                    address: document.getElementById("editClient_address").value
                });
                editModal.hide();
                window.location.reload();
            } catch (e) {
                console.error(e);
                alert(e?.message || "Failed to update client.");
                saveClientChangesBtn.disabled = false;
            }
        });
    }

    const deleteClientBtn = document.getElementById("deleteClientBtn");
    if (deleteClientBtn && deleteModal) {
        deleteClientBtn.addEventListener("click", () => deleteModal.show());
    }

    const confirmDeleteClientBtn = document.getElementById("confirmDeleteClientBtn");
    if (confirmDeleteClientBtn && deleteModal) {
        confirmDeleteClientBtn.addEventListener("click", async () => {
            if (!window.api?.deleteClient) return;

            confirmDeleteClientBtn.disabled = true;
            try {
                await window.api.deleteClient(client.id);
                deleteModal.hide();
                window.location.href = "index.html";
            } catch (e) {
                console.error(e);
                alert(e?.message || "Failed to delete client.");
                confirmDeleteClientBtn.disabled = false;
            }
        });
    }

    // 🔹 Client info
    document.getElementById("clientName").textContent = client.name;
    document.getElementById("caseCount").textContent = `${cases.length} Cases`;

    document.getElementById("clientInfo").innerHTML = `
    ${client.sex || ""} | 
    ${client.age || ""} yrs old | 
    ${client.civilStatus || ""} <br>
    ${client.address || ""}
  `;

    // 🔹 Cases list
    const container = document.getElementById("casesContainer");
    container.innerHTML = "";

    if (!cases.length) {
        container.innerHTML = `
    <div class="text-muted text-center">
      No cases found for this client.
    </div>
  `;
    } else {
        for (const c of cases) {
            const card = document.createElement("div");
            card.className = "card mb-3 p-3";

            const referralText =
                c.clientReferral != null && String(c.clientReferral).trim() !== ""
                    ? String(c.clientReferral)
                    : (c.clientReferal != null && String(c.clientReferal).trim() !== ""
                        ? String(c.clientReferal)
                        : (c.referral != null ? String(c.referral) : ""));

            card.innerHTML = `
	  <div class="d-flex justify-content-between">
	    <h5>Case #${c.caseNo}</h5>
	    <small>${c.dateCreated || ""}</small>
	  </div>

  <hr>

  <div class="row">
    <div class="col-md-6">
      <p><strong>Nature of Case:</strong> ${c.clientCaseNature || ""}</p>
      <p><strong>Remarks:</strong> ${c.clientCaseRemarks || ""}</p>
	    </div>
	
	    <div class="col-md-6">
	      <p><strong>Referral:</strong> ${referralText}</p>
	      <p><strong>Person in Charge:</strong> ${c.clientPerson || ""}</p>
	    </div>
	  </div>
	`;

            const actions = document.createElement("div");
            actions.className = "d-flex justify-content-end gap-2 mt-2";

            const editBtn = document.createElement("button");
            editBtn.type = "button";
            editBtn.className = "btn btn-sm btn-outline-primary";
            editBtn.innerHTML = `<i class="bi bi-pencil-square"></i>`;
            editBtn.addEventListener("click", () => {
                window.location.href = `inputs.html?entry_id=${encodeURIComponent(c.id)}&client_id=${encodeURIComponent(clientId)}`;
            });


            const deleteBtn = document.createElement("button");
            deleteBtn.type = "button";
            deleteBtn.className = "btn btn-sm btn-outline-danger";
            deleteBtn.innerHTML = `<i class="bi bi-trash"></i>`;
            deleteBtn.addEventListener("click", async () => {
                if (!window.api?.deleteEntry) return;
                if (!confirm("Delete this case?")) return;

                try {
                    await window.api.deleteEntry(c.id);
                    window.location.reload();
                } catch (e) {
                    console.error(e);
                    alert(e?.message || "Failed to delete case.");
                }
            });

            actions.appendChild(editBtn);
            actions.appendChild(deleteBtn);
            card.appendChild(actions);

            container.appendChild(card);
        }
    }


});
