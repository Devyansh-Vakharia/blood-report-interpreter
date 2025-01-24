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
  const textarea = document.getElementById('messageInput');
    const maxLines = 7;
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight);

    textarea.addEventListener('input', function() {
        if (textarea.value.trim() === '') {
            textarea.style.height = '';  // Reset to default
            textarea.style.overflowY = 'hidden';  // Hide scrollbar
            textarea.rows = 1;
            return;
        }

        const lines = Math.floor(textarea.scrollHeight / lineHeight);
        
        if (lines <= maxLines) {
            textarea.style.height = 'auto'; 
            textarea.style.height = lineHeight * lines + 'px';
            textarea.style.overflowY = 'hidden'; 
        } else {
            textarea.style.height = lineHeight * maxLines + 'px';
            textarea.style.overflowY = 'auto';  // Show scrollbar when max lines are reached
        }
    });