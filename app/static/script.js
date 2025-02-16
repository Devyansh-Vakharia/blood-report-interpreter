document.addEventListener("DOMContentLoaded", () => {
  const fileInput = document.getElementById("file");
  const selectedFileContainer = document.getElementById("selectedFileContainer");
  const selectedFileName = document.getElementById("selectedFileName");
  const removeFileButton = document.getElementById("removeFileButton");
  const textarea = document.getElementById("messageInput");
  const chatArea = document.getElementById("chatArea");
  const form = document.getElementById("uploadForm");

  // File upload button click event
  document.getElementById("file-uploader").addEventListener("click", () => {
      fileInput.click();
  });

  // Handle file selection
  fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
          selectedFileName.textContent = file.name;
          selectedFileContainer.classList.remove("hidden");
      }
  });

  // Remove selected file
  removeFileButton.addEventListener("click", (e) => {
      e.preventDefault();
      fileInput.value = "";
      selectedFileName.textContent = "";
      selectedFileContainer.classList.add("hidden");
  });

  // Auto-expand textarea on input
  textarea.addEventListener("input", function () {
      this.style.height = "auto";
      this.style.height = this.scrollHeight + "px";
  });

  // Handle form submission
form.addEventListener("submit", async function (event) {
      event.preventDefault(); // Prevent default form submission

      const formData = new FormData();
      if (fileInput.files.length > 0) {
          formData.append("file", fileInput.files[0]);
      }
      if (textarea.value.trim() !== "") {
          formData.append("messageInput", textarea.value.trim());
      }

      // Show user query in chat
      if (textarea.value.trim() !== "") {
          displayMessage("You: " + textarea.value, "user-message");
      }

      try {
          const response = await fetch("/", {
              method: "POST",
              body: formData,
          });

          const data = await response.json();

          if (data.error) {
              displayMessage("❌ Error: " + data.error, "error-message");
          } else {
              displayFormattedResponse(data);
          }
      } catch (error) {
          displayMessage("❌ Failed to fetch response!", "error-message");
      }

      // Clear input fields after sending
      textarea.value = "";
      fileInput.value = "";
      selectedFileContainer.classList.add("hidden");
  });

  // Function to display user and bot messages
  function displayMessage(text, className) {
      const messageElement = document.createElement("div");
      messageElement.classList.add("message", className);
      messageElement.textContent = text;
      chatArea.appendChild(messageElement);
      chatArea.scrollTop = chatArea.scrollHeight;
  }

  // Function to display structured JSON response in a readable format
  function displayFormattedResponse(data) {
      const responseContainer = document.createElement("div");
      responseContainer.classList.add("message", "bot-message");

      let formattedText = `<strong>🩸 Blood Report Analysis:</strong><br>`;

      if (data.summary) {
          formattedText += `<strong>Summary:</strong> ${data.summary}<br>`;
      }
      if (data.deficiencies && data.deficiencies.length > 0) {
          formattedText += `<strong>Deficiencies:</strong> ${data.deficiencies.join(", ")}<br>`;
      }
      if (data.recommendations && data.recommendations.length > 0) {
          formattedText += `<strong>Recommendations:</strong> ${data.recommendations.join(", ")}<br>`;
      }
      if (data.important_note) {
          formattedText += `<strong>Note:</strong> ${data.important_note}<br>`;
      }
      if (data.query_response) {
          formattedText += `<strong>🤖 AI Response:</strong> ${data.query_response}<br>`;
      }

      responseContainer.innerHTML = formattedText;
      chatArea.appendChild(responseContainer);
      chatArea.scrollTop = chatArea.scrollHeight;
  }
});
