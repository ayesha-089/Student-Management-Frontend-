const STORAGE_KEY = "studentManagementRecords";
const AUDIT_KEY = "studentManagementAudit";
const PAGE_SIZE = 5;

let students = loadData(STORAGE_KEY, []);
let auditLog = loadData(AUDIT_KEY, []);
let currentPage = 1;

const $ = (id) => document.getElementById(id);
const form = $("studentForm");
const fields = {
  id: $("studentId"), name: $("name"), rollNo: $("rollNo"),
  email: $("email"), department: $("department"),
  semester: $("semester"), status: $("status")
};

function loadData(key, fallback) {
  try {
    const saved = JSON.parse(localStorage.getItem(key));
    return Array.isArray(saved) ? saved : fallback;
  } catch {
    return fallback;
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(students));
  localStorage.setItem(AUDIT_KEY, JSON.stringify(auditLog));
}

function addAudit(message) {
  auditLog.unshift({ message, time: new Date().toLocaleString() });
  auditLog = auditLog.slice(0, 10);
  saveData();
  renderAudit();
}

function showMessage(message, isSuccess = false) {
  $("formMessage").textContent = message;
  $("formMessage").className = isSuccess ? "form-message success" : "form-message";
}

function validateStudent(data) {
  if (!data.name || !data.rollNo || !data.email || !data.department || !data.semester) {
    return "Please fill in all required fields.";
  }
  if (data.name.length < 2) return "Name must contain at least 2 characters.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return "Please enter a valid email address.";
  if (!/^[a-zA-Z0-9-]+$/.test(data.rollNo)) return "Roll number can contain letters, numbers and hyphens only.";
  const duplicateRoll = students.some(s => s.rollNo.toLowerCase() === data.rollNo.toLowerCase() && s.id !== data.id);
  if (duplicateRoll) return "This roll number already exists.";
  return "";
}

function getFormData() {
  return {
    id: fields.id.value || String(Date.now()),
    name: fields.name.value.trim(),
    rollNo: fields.rollNo.value.trim(),
    email: fields.email.value.trim(),
    department: fields.department.value,
    semester: fields.semester.value,
    status: fields.status.value
  };
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const data = getFormData();
  const error = validateStudent(data);
  if (error) {
    showMessage(error);
    return;
  }

  const existingIndex = students.findIndex(s => s.id === data.id);
  if (existingIndex >= 0) {
    students[existingIndex] = data;
    addAudit(`Updated student: ${data.name} (${data.rollNo})`);
    showMessage("Student record updated successfully.", true);
  } else {
    students.unshift(data);
    addAudit(`Added student: ${data.name} (${data.rollNo})`);
    showMessage("Student added successfully.", true);
  }

  saveData();
  resetForm(false);
  currentPage = 1;
  render();
});

function resetForm(clearMessage = true) {
  form.reset();
  fields.id.value = "";
  $("formTitle").textContent = "Add New Student";
  $("saveBtn").textContent = "Add Student";
  $("cancelEditBtn").hidden = true;
  if (clearMessage) showMessage("");
}

$("resetBtn").addEventListener("click", () => resetForm());
$("cancelEditBtn").addEventListener("click", () => resetForm());

$("studentTableBody").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) return;
  const student = students.find(s => s.id === button.dataset.id);
  if (!student) return;

  if (button.dataset.action === "edit") {
    fields.id.value = student.id;
    fields.name.value = student.name;
    fields.rollNo.value = student.rollNo;
    fields.email.value = student.email;
    fields.department.value = student.department;
    fields.semester.value = student.semester;
    fields.status.value = student.status;
    $("formTitle").textContent = "Edit Student";
    $("saveBtn").textContent = "Update Student";
    $("cancelEditBtn").hidden = false;
    showMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (button.dataset.action === "delete") {
    if (!confirm(`Delete ${student.name}'s record?`)) return;
    students = students.filter(s => s.id !== student.id);
    addAudit(`Deleted student: ${student.name} (${student.rollNo})`);
    saveData();
    render();
  }
});

["searchInput", "departmentFilter", "semesterFilter", "statusFilter", "sortSelect"].forEach(id => {
  $(id).addEventListener("input", () => {
    currentPage = 1;
    renderTable();
  });
});

function getFilteredStudents() {
  const search = $("searchInput").value.trim().toLowerCase();
  const department = $("departmentFilter").value;
  const semester = $("semesterFilter").value;
  const status = $("statusFilter").value;
  const sort = $("sortSelect").value;

  const filtered = students.filter(s => {
    const matchesSearch = [s.name, s.rollNo, s.email].some(v => v.toLowerCase().includes(search));
    return matchesSearch &&
      (!department || s.department === department) &&
      (!semester || s.semester === semester) &&
      (!status || s.status === status);
  });

  if (sort === "name") filtered.sort((a, b) => a.name.localeCompare(b.name));
  if (sort === "roll") filtered.sort((a, b) => a.rollNo.localeCompare(b.rollNo));
  if (sort === "semester") filtered.sort((a, b) => Number(a.semester) - Number(b.semester));
  if (sort === "newest") filtered.sort((a, b) => Number(b.id) - Number(a.id));
  return filtered;
}

function renderTable() {
  const filtered = getFilteredStudents();
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  currentPage = Math.min(currentPage, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);
  const body = $("studentTableBody");

  body.innerHTML = pageItems.map(s => `
    <tr>
      <td><div class="student-name">${escapeHTML(s.name)}</div><div class="student-email">${escapeHTML(s.email)}</div></td>
      <td>${escapeHTML(s.rollNo)}</td>
      <td>${escapeHTML(s.department)}</td>
      <td>${semesterLabel(s.semester)}</td>
      <td><span class="pill ${s.status.toLowerCase()}">${escapeHTML(s.status)}</span></td>
      <td><div class="row-actions">
        <button class="action-btn" data-action="edit" data-id="${escapeHTML(s.id)}">Edit</button>
        <button class="action-btn delete-btn" data-action="delete" data-id="${escapeHTML(s.id)}">Delete</button>
      </div></td>
    </tr>`).join("");

  $("emptyState").style.display = pageItems.length ? "none" : "block";
  $("resultsInfo").textContent = `Showing ${filtered.length ? start + 1 : 0}–${Math.min(start + PAGE_SIZE, filtered.length)} of ${filtered.length} students`;
  $("pageCount").textContent = `${currentPage} / ${totalPages}`;
  $("prevBtn").disabled = currentPage === 1;
  $("nextBtn").disabled = currentPage === totalPages;
}

function semesterLabel(value) {
  const suffix = value === "1" ? "st" : value === "2" ? "nd" : value === "3" ? "rd" : "th";
  return `${value}${suffix} Semester`;
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

$("prevBtn").addEventListener("click", () => { currentPage--; renderTable(); });
$("nextBtn").addEventListener("click", () => { currentPage++; renderTable(); });

function renderStats() {
  $("totalCount").textContent = students.length;
  $("activeCount").textContent = students.filter(s => s.status === "Active").length;
  $("departmentCount").textContent = new Set(students.map(s => s.department)).size;
}

function renderDepartmentFilter() {
  const select = $("departmentFilter");
  const selected = select.value;
  const departments = [...new Set(students.map(s => s.department))].sort();
  select.innerHTML = '<option value="">All Departments</option>' +
    departments.map(d => `<option value="${escapeHTML(d)}">${escapeHTML(d)}</option>`).join("");
  select.value = departments.includes(selected) ? selected : "";
}

function renderAudit() {
  $("auditList").innerHTML = auditLog.length
    ? auditLog.map(item => `<li><span>${escapeHTML(item.message)}</span><span class="audit-time">${escapeHTML(item.time)}</span></li>`).join("")
    : '<li class="muted">No activity yet.</li>';
}

function render() {
  renderStats();
  renderDepartmentFilter();
  renderTable();
  renderAudit();
}

$("exportBtn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(students, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "students-data.json";
  link.click();
  URL.revokeObjectURL(url);
  addAudit("Exported student records to JSON");
});

$("importFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    if (!Array.isArray(imported)) throw new Error("JSON must contain an array of student records.");
    const required = ["name", "rollNo", "email", "department", "semester"];
    const valid = imported.every(s => s && required.every(key => typeof s[key] === "string" && s[key].trim()));
    if (!valid) throw new Error("One or more records have missing or invalid fields.");
    const seen = new Set(students.map(s => s.rollNo.toLowerCase()));
    const newRecords = imported.filter(s => !seen.has(s.rollNo.toLowerCase())).map(s => ({
      id: String(Date.now() + Math.random()), name: s.name.trim(), rollNo: s.rollNo.trim(),
      email: s.email.trim(), department: s.department, semester: s.semester,
      status: s.status === "Inactive" ? "Inactive" : "Active"
    }));
    students = [...newRecords, ...students];
    saveData();
    addAudit(`Imported ${newRecords.length} student record(s) from JSON`);
    currentPage = 1;
    render();
    showMessage(`Imported ${newRecords.length} new record(s). Duplicate roll numbers were skipped.`, true);
  } catch (error) {
    showMessage(`Import failed: ${error.message}`);
  }
  event.target.value = "";
});

render();
