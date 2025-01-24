document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("file");
    const selectedFileContainer = document.getElementById("selectedFileContainer");
    const selectedFileName = document.getElementById("selectedFileName");
    const removeFileButton = document.getElementById("removeFileButton");
  
    fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
        selectedFileName.textContent = file.name;
        selectedFileContainer.classList.remove("hidden");
      }
    });
  
    removeFileButton.addEventListener("click", () => {
      fileInput.value = ""; // Clear the file input
      selectedFileName.textContent = "";
      selectedFileContainer.classList.add("hidden");
    });
  });
  