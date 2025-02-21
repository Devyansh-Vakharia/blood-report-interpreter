document.addEventListener("DOMContentLoaded", () => {
    const fileInput = document.getElementById("file");
    const selectedFileContainer = document.getElementById("selectedFileContainer");
    const selectedFileName = document.getElementById("selectedFileName");
    const removeFileButton = document.getElementById("removeFileButton");
    const textarea = document.getElementById("messageInput");
    const chatArea = document.getElementById("chatArea");
    const form = document.getElementById("uploadForm");
    const newChatButton = document.querySelector(".new-chat");

    newChatButton.addEventListener("click", () => {
        chatArea.innerHTML = ""; // Clear chat area
        textarea.value = ""; // Clear message input
        textarea.style.height = "auto"; // Reset textarea height
        selectedFileContainer.classList.add("hidden"); // Hide file container
        fileInput.value = ""; // Reset file input
    });

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

    // Function to get chat history
    function getChatHistory() {
        let messages = [];
        document.querySelectorAll("#chatArea .message").forEach(msg => {
            messages.push(msg.textContent);
        });
        return messages.join("\n"); // Convert array to a single string
    }

    // Modify form submission
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const formData = new FormData();
        if (fileInput.files.length > 0) {
            formData.append("file", fileInput.files[0]);
        }
        if (textarea.value.trim() !== "") {
            formData.append("messageInput", textarea.value.trim());
        }

        // Add chat history to the request
        const chatHistory = getChatHistory();
        formData.append("chatHistory", chatHistory);

        // Show user query in chat
        if (textarea.value.trim() !== "") {
            displayMessage("You: " + textarea.value, "user-message");
        }

        // Show loading indicator
        const loadingElement = showLoadingIndicator();

        try {
            const response = await fetch("/", {
                method: "POST",
                body: formData,
            });

            const data = await response.json();
            loadingElement.remove();

            if (data.error) {
                displayMessage("❌ Error: " + data.error, "error-message");
            } else {
                displayFormattedResponse(data);
            }
        } catch (error) {
            loadingElement.remove();
            displayMessage("❌ Failed to fetch response!", "error-message");
        }

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
        setTimeout(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        }, 100);
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

    // Function to show small loading indicator in the bot response area
    function showLoadingIndicator() {
        const loadingContainer = document.createElement("div");
        loadingContainer.classList.add("message", "bot-message");
        loadingContainer.innerHTML = `
            <div class="loading-dots">
                <span></span><span></span><span></span>
            </div>
        `;
        chatArea.appendChild(loadingContainer);
        chatArea.scrollTop = chatArea.scrollHeight;
        return loadingContainer;
    }
});
