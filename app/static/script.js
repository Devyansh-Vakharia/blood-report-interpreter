document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file");
  const selectedFileContainer = document.getElementById("selectedFileContainer");
  const selectedFileName = document.getElementById("selectedFileName");
  const removeFileButton = document.getElementById("removeFileButton");
  const textarea = document.getElementById('messageInput');

  fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (file) {
      selectedFileName.textContent = file.name;
      selectedFileContainer.classList.remove("hidden");
    }
  });

  removeFileButton.addEventListener("click", (e) => {
    e.preventDefault();
    fileInput.value = "";
    selectedFileName.textContent = "";
    selectedFileContainer.classList.add("hidden");
  });

  textarea.addEventListener('input', function () {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
  });
});