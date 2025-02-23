document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const fileInput = document.getElementById("file");
    const selectedFileContainer = document.getElementById("selectedFileContainer");
    const selectedFileName = document.getElementById("selectedFileName");
    const removeFileButton = document.getElementById("removeFileButton");
    const textarea = document.getElementById("messageInput");
    const chatArea = document.getElementById("chatArea");
    const form = document.getElementById("uploadForm");
    const newChatButton = document.querySelector(".new-chat");
    
    let currentChatId = null;

    // Initialize chat areas on page load
    loadChatAreas();

    // File Upload Handlers
    document.getElementById("file-uploader").addEventListener("click", () => {
        fileInput.click();
    });

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

    // Textarea Auto-resize
    textarea.addEventListener("input", function() {
        this.style.height = "auto";
        this.style.height = this.scrollHeight + "px";
    });

    // Chat History Management
// Modify the loadChatAreas function to use AI-generated titles
async function loadChatAreas() {
    try {
        const username = document.querySelector("[data-username]")?.dataset.username;
        if (!username) return;

        const response = await fetch(`/api/chat_areas/${username}`);
        const chatAreas = await response.json();
        
        const chatSelector = document.createElement("div");
        chatSelector.id = "chatSelector";
        chatSelector.classList.add("chat-selector");
        
        // Clear existing chat history
        const existingSelector = document.querySelector("#chatSelector");
        if (existingSelector) {
            existingSelector.remove();
        }

        // Add new chat selector after the "New Chat" button
        document.querySelector(".history").appendChild(chatSelector);

        chatAreas.forEach(chat => {
            const chatItem = document.createElement("div");
            chatItem.className = "chat-area-item";
            if (chat.chat_id === currentChatId) {
                chatItem.classList.add("selected");
            }
            chatItem.dataset.chatId = chat.chat_id;

            // Format the date
            const date = new Date(chat.created_at);
            const formattedDate = date.toLocaleDateString() + ' ' + 
                date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

            // Only use AI-generated title
            const displayTitle = chat.ai_title || "New Chat";

            chatItem.innerHTML = `
                <div class="chat-item-content">
                    <div class="chat-title" title="${displayTitle}">${displayTitle}</div>
                    <div class="chat-subtitle">${formattedDate}</div>
                </div>
                <button class="delete-chat" title="Delete chat">
                <img src="/static/delete.png" alt="Delete">
                </button>
            `;

            // Add click handlers
            chatItem.addEventListener("click", (e) => {
                if (!e.target.classList.contains("delete-chat")) {
                    loadChatArea(chat.chat_id);
                }
            });

            chatItem.querySelector(".delete-chat").addEventListener("click", (e) => {
                e.stopPropagation();
                deleteChatArea(chat.chat_id);
            });

            chatSelector.appendChild(chatItem);
        });

        // Show message if no chats exist
        if (chatAreas.length === 0) {
            chatSelector.innerHTML = `
                <div class="no-chats-message">
                    No chat history yet
                </div>
            `;
        }
    } catch (error) {
        console.error("Failed to load chat areas:", error);
    }
}
    async function loadChatArea(chatId) {
        try {
            const response = await fetch(`/api/chat_area/${chatId}`);
            const chatArea = await response.json();
            
            if (chatArea.error) {
                displayMessage("❌ Error: " + chatArea.error, "error-message");
                return;
            }

            document.getElementById("chatArea").innerHTML = "";
            currentChatId = chatId;

            // Display PDF analysis if exists
            if (chatArea.bot_response_pdf) {
                displayFormattedResponse(chatArea.bot_response_pdf);
            }

            // Display all messages
            chatArea.messages.forEach(msg => {
                if (msg.user_message && !msg.user_message.startsWith("PDF Upload:")) {
                    displayMessage("You: " + msg.user_message, "user-combined-message");
                }
                if (msg.bot_response) {
                    displayMessage("🤖: " + msg.bot_response, "bot-message");
                }
            });

            // Update selected state in sidebar
            document.querySelectorAll(".chat-area-item").forEach(item => {
                item.classList.toggle("selected", item.dataset.chatId === chatId);
            });

            // Scroll to bottom
            const chatAreaElement = document.getElementById("chatArea");
            chatAreaElement.scrollTop = chatAreaElement.scrollHeight;
        } catch (error) {
            console.error("Failed to load chat area:", error);
            displayMessage("❌ Failed to load chat!", "error-message");
        }
    }

    async function deleteChatArea(chatId) {
        if (!confirm("Are you sure you want to delete this chat?")) return;

        try {
            const response = await fetch(`/api/chat_area/${chatId}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            if (result.error) {
                displayMessage("❌ Error: " + result.error, "error-message");
            } else {
                if (currentChatId === chatId) {
                    chatArea.innerHTML = "";
                    currentChatId = null;
                }
                await loadChatAreas();
            }
        } catch (error) {
            console.error("Failed to delete chat area:", error);
            displayMessage("❌ Failed to delete chat!", "error-message");
        }
    }

    // New Chat Handler
    newChatButton.addEventListener("click", () => {
        currentChatId = null;
        chatArea.innerHTML = "";
        textarea.value = "";
        textarea.style.height = "auto";
        selectedFileContainer.classList.add("hidden");
        fileInput.value = "";
        
        document.querySelectorAll(".chat-area-item").forEach(item => {
            item.classList.remove("selected");
        });
    });

    // Form Submission Handler
    form.addEventListener("submit", async function(event) {
        event.preventDefault();

        const formData = new FormData();
        const file = fileInput.files[0];
        
        if (file) {
            formData.append("file", file);
        }
        
        if (textarea.value.trim() !== "") {
            formData.append("messageInput", textarea.value.trim());
            let combinedMessage = "";
            if (file) {
                combinedMessage += `📄 PDF uploaded: ${file.name}\n`;
            }
            if (textarea.value.trim() !== "") {
                combinedMessage += `You: ${textarea.value}`;
            }
            displayMessage(combinedMessage, "user-combined-message");
        }

        // Add chat history and ID if exists
        formData.append("chatHistory", getChatHistory());
        if (currentChatId) {
            formData.append("chatId", currentChatId);
        }

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
                if (data.chat_id) {
                    currentChatId = data.chat_id;
                    await loadChatAreas();
                }
            }
        } catch (error) {
            loadingElement.remove();
            displayMessage("❌ Failed to fetch response!", "error-message");
        }

        // Reset form
        textarea.value = "";
        textarea.style.height = "auto";
        fileInput.value = "";
        selectedFileContainer.classList.add("hidden");
    });

    // Helper Functions
    function getChatHistory() {
        let messages = [];
        document.querySelectorAll("#chatArea .message").forEach(msg => {
            messages.push(msg.textContent);
        });
        return messages.join("\n");
    }

    function displayMessage(text, className) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", className);
        messageElement.textContent = text;
        chatArea.appendChild(messageElement);
        setTimeout(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        }, 100);
    }

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