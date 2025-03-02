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
    const sidebar = document.querySelector('.sidebar');
    

    const patientReportButton = document.createElement('div');
    patientReportButton.className = 'patient-report-button';
    patientReportButton.innerHTML = '<i class="bx bxs-report"></i> Patient Reports';
    sidebar.querySelector('.sidebar-header').after(patientReportButton);
    
    let currentChatId = null;
    let currentReportId = null; // New for tracking current report

    const pathParts = window.location.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
        const chatId = pathParts[1];
        loadChatArea(chatId);
    }

    // Create patient reports modal
    const reportModal = document.createElement('div');
    reportModal.className = 'patient-report-modal hidden';
    reportModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Patient Reports</h2>
                <button class="close-modal"><i class="bx bx-x"></i></button>
            </div>
            <div class="reports-list">
                <div class="loading">Loading reports...</div>
            </div>
        </div>
    `;
    document.body.appendChild(reportModal);

    // Toggle patient reports modal
    patientReportButton.addEventListener('click', async () => {
        reportModal.classList.remove('hidden');
        await loadPatientReports();
    });

    // Close modal
    reportModal.querySelector('.close-modal').addEventListener('click', () => {
        reportModal.classList.add('hidden');
    });
    
    // Close modal when clicking outside
    reportModal.addEventListener('click', (e) => {
        if (e.target === reportModal) {
            reportModal.classList.add('hidden');
        }
    });


    // Chat History Management
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
    textarea.addEventListener("input", function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    // FIX: Show welcome message only if there's no currentChatId
    if (!currentChatId) {
        showWelcomeMessage();
    }

    // Initialize chat areas on page load
    loadChatAreas();

    // FIX: Load chat content if we have a chat ID from URL
    if (currentChatId) {
        loadChatArea(currentChatId);
    }

    // Load patient reports function
    async function loadPatientReports() {
        const reportsListContainer = reportModal.querySelector('.reports-list');
        reportsListContainer.innerHTML = '<div class="loading">Loading reports...</div>';
        
        try {
            const username = document.querySelector("[data-username]")?.dataset.username;
            if (!username) return;

            const response = await fetch(`/api/patient_reports/${username}`);
            const reports = await response.json();
            
            if (!reports.length) {
                reportsListContainer.innerHTML = '<div class="no-reports">No patient reports found</div>';
                return;
            }
            
            reportsListContainer.innerHTML = '';
            
            reports.forEach(report => {
                const reportCard = document.createElement('div');
                reportCard.className = 'report-card';
                reportCard.innerHTML = `
                    <div class="report-header">
                        <h3>${report.patient_name}</h3>
                        <span class="report-date">${new Date(report.created_at).toLocaleDateString()}</span>
                    </div>
                    <div class="patient-details">
                        <span><strong>Age:</strong> ${report.patient_age}</span>
                        <span><strong>Gender:</strong> ${report.patient_gender}</span>
                    </div>
                    <div class="report-file">
                        <i class="bx bxs-file-pdf"></i> ${report.report_name}
                    </div>
                    <div class="report-actions">
                        <button class="view-report" data-report-id="${report.report_id}">View Details</button>
                        ${report.chat_id ? `<button class="view-chat" data-chat-id="${report.chat_id}">View Chat</button>` : ''}
                        <button class="delete-report" data-report-id="${report.report_id}">Delete</button>
                    </div>
                `;
                
                reportsListContainer.appendChild(reportCard);
            });
            
            // Add event listeners to report buttons
            document.querySelectorAll('.view-report').forEach(button => {
                button.addEventListener('click', () => {
                    viewPatientReport(button.dataset.reportId);
                });
            });
            
            document.querySelectorAll('.view-chat').forEach(button => {
                button.addEventListener('click', () => {
                    reportModal.classList.add('hidden');
                    loadChatArea(button.dataset.chatId);
                });
            });
            
            document.querySelectorAll('.delete-report').forEach(button => {
                button.addEventListener('click', () => {
                    deletePatientReport(button.dataset.reportId);
                });
            });
            
        } catch (error) {
            console.error("Failed to load patient reports:", error);
            reportsListContainer.innerHTML = '<div class="error-message">Failed to load reports</div>';
        }
    }
    
    // View patient report details
    async function viewPatientReport(reportId) {
        try {
            const response = await fetch(`/api/patient_report/${reportId}`);
            const report = await response.json();
            
            if (report.error) {
                displayMessage("❌ Error: " + report.error, "error-message");
                return;
            }
            
            // Create detailed report view
            const reportDetailsModal = document.createElement('div');
            reportDetailsModal.className = 'report-details-modal';
            reportDetailsModal.innerHTML = `
                <div class="modal-content large">
                    <div class="modal-header">
                        <h2>Patient Report Details</h2>
                        <button class="close-modal"><i class="bx bx-x"></i></button>
                    </div>
                    <div class="report-details">
                        <div class="patient-header">
                            <h2>${report.patient_name}</h2>
                            <div class="patient-meta">
                                <span><strong>Age:</strong> ${report.patient_age}</span>
                                <span><strong>Gender:</strong> ${report.patient_gender}</span>
                                <span><strong>Report:</strong> ${report.report_name}</span>
                                <span><strong>Date:</strong> ${new Date(report.created_at).toLocaleDateString()}</span>
                            </div>
                        </div>
                        
                        <div class="report-section">
                            <h3>Summary</h3>
                            <p>${report.summary}</p>
                        </div>
                        
                        <div class="report-section">
                            <h3>Deficiencies</h3>
                            <ul>
                                ${report.deficiencies.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="report-section">
                            <h3>Recommendations</h3>
                            <ul>
                                ${report.recommendations.map(item => `<li>${item}</li>`).join('')}
                            </ul>
                        </div>
                        
                        <div class="report-actions center">
                            ${report.chat_id ? 
                                `<button class="view-chat-btn" data-chat-id="${report.chat_id}">View Associated Chat</button>` 
                                : 
                                '<p>No associated chat found</p>'
                            }
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(reportDetailsModal);
            
            // Add event listener to close button
            reportDetailsModal.querySelector('.close-modal').addEventListener('click', () => {
                reportDetailsModal.remove();
            });
            
            // Add event listener to view chat button
            if (report.chat_id) {
                reportDetailsModal.querySelector('.view-chat-btn').addEventListener('click', () => {
                    reportDetailsModal.remove();
                    reportModal.classList.add('hidden');
                    loadChatArea(report.chat_id);
                });
            }
            
            // Close when clicking outside
            reportDetailsModal.addEventListener('click', (e) => {
                if (e.target === reportDetailsModal) {
                    reportDetailsModal.remove();
                }
            });
            
        } catch (error) {
            console.error("Failed to load patient report details:", error);
            displayMessage("❌ Failed to load report details!", "error-message");
        }
    }
    
    // Delete patient report
    async function deletePatientReport(reportId) {
        if (!confirm("Are you sure you want to delete this patient report?")) return;
        
        try {
            const response = await fetch(`/api/patient_report/${reportId}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            
            if (result.error) {
                displayMessage("❌ Error: " + result.error, "error-message");
            } else {
                // Refresh the reports list
                await loadPatientReports();
                
                // If we're viewing the chat of this report, reset the view
                if (currentReportId === reportId) {
                    chatArea.innerHTML = "";
                    currentReportId = null;
                    showWelcomeMessage();
                }
            }
        } catch (error) {
            console.error("Failed to delete patient report:", error);
            displayMessage("❌ Failed to delete report!", "error-message");
        }
    }

    // Modified displayFormattedResponse to include report ID
    function displayFormattedResponse(data, pdfName = null) {
        const responseContainer = document.createElement("div");
        responseContainer.classList.add("message", "bot-message", "pdf-analysis");
        
        // Store report ID if available
        if (data.report_id) {
            currentReportId = data.report_id;
            responseContainer.dataset.reportId = data.report_id;
        }

        let formattedText = '';
        
        // Add PDF name if available
        if (pdfName) {
            formattedText += `<div class="pdf-header">
                <i class='bx bxs-file-pdf'></i> 
                <span class="pdf-name">${pdfName}</span>
            </div>`;
        }

        // Add the blood report analysis header
        formattedText += `<div class="analysis-header">🩸 Blood Report Analysis</div>`;
        
        // Add patient information section
        formattedText += `<div class="analysis-section patient-info">
            <div class="section-title">Patient Information</div>
            <div class="patient-details">
                <div class="patient-detail"><strong>Name:</strong> ${data.name || 'Not specified'}</div>
                <div class="patient-detail"><strong>Age:</strong> ${data.age || 'Not specified'}</div>
                <div class="patient-detail"><strong>Gender:</strong> ${data.gender || 'Not specified'}</div>
            </div>
        </div>`;

        if (data.summary) {
            formattedText += `<div class="analysis-section">
                <div class="section-title">Summary</div>
                <div class="section-content">${data.summary}</div>
            </div>`;
        }
        
        if (data.deficiencies && data.deficiencies.length > 0) {
            formattedText += `<div class="analysis-section">
                <div class="section-title">Deficiencies</div>
                <ul class="section-list">
                    ${data.deficiencies.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>`;
        }
        
        if (data.recommendations && data.recommendations.length > 0) {
            formattedText += `<div class="analysis-section">
                <div class="section-title">Recommendations</div>
                <ul class="section-list">
                    ${data.recommendations.map(item => `<li>${item}</li>`).join('')}
                </ul>
            </div>`;
        }
        
        if (data.important_note) {
            formattedText += `<div class="analysis-section note-section">
                <div class="section-title">Important Note</div>
                <div class="section-content">${data.important_note}</div>
            </div>`;
        }
        
        responseContainer.innerHTML = formattedText;
        chatArea.appendChild(responseContainer);
        if (data.query_response) {
            displayMessage(data.query_response, "bot-message");
        }

        chatArea.scrollTop = chatArea.scrollHeight;
    }
    

    // Responsive Sidebar Setup for Mobile
    const sidebarHeader = document.querySelector('.sidebar-header');
    
    // Create and add toggle button for mobile view
    const toggleButton = document.createElement('div');
    toggleButton.className = 'sidebar-toggle';
    toggleButton.innerHTML = '<i class="bx bx-menu"></i>';
    sidebarHeader.appendChild(toggleButton);
    
    // Toggle sidebar when header is clicked on mobile
    sidebarHeader.addEventListener('click', function(e) {
        // Only apply toggle on mobile view
        if (window.innerWidth <= 1024) {
            sidebar.classList.toggle('expanded');
            
            // Change icon based on sidebar state
            const icon = toggleButton.querySelector('i');
            if (sidebar.classList.contains('expanded')) {
                icon.className = 'bx bx-x';
            } else {
                icon.className = 'bx bx-menu';
            }
            
            e.stopPropagation();
        }
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 1024 && sidebar.classList.contains('expanded')) {
            if (!sidebar.contains(e.target)) {
                sidebar.classList.remove('expanded');
                toggleButton.querySelector('i').className = 'bx bx-menu';
            }
        }
    });
    
    // Fix for mobile viewport height issues
    function setMobileHeight() {
        document.documentElement.style.setProperty('--vh', `${window.innerHeight * 0.01}px`);
    }
    
    setMobileHeight();
    window.addEventListener('resize', setMobileHeight);
    
    // Reset sidebar on wider screens
    window.addEventListener('resize', function() {
        if (window.innerWidth > 1024) {
            sidebar.classList.remove('expanded');
        }
    });



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
   

    // url update of username and chatid
    function updateURL(chatId = null) {
        const username = document.querySelector("[data-username]")?.dataset.username;
        if (!username) return;
    
        const newURL = chatId 
            ? `/${username}/${chatId}`
            : `/${username}/`;
        
        history.pushState({}, '', newURL);
    }

    // load the chats from fetching chatid
    async function loadChatArea(chatId) {
        try {
            const response = await fetch(`/api/chat_area/${chatId}`);
            const chatArea = await response.json();
            
            if (chatArea.error) {
                displayMessage("❌ Error: " + chatArea.error, "error-message");
                return;
            }
            updateURL(chatId);
    
            document.getElementById("chatArea").innerHTML = "";
            currentChatId = chatId;
    
            // Get PDF name from the chat area
            const pdfName = chatArea.pdf_name;
    
            // Display all messages in sequence
            if (chatArea.messages && chatArea.messages.length > 0) {
                chatArea.messages.forEach(msg => {
                    // First display user message
                    if (msg.user_message && !msg.user_message.startsWith("PDF Upload:")) {
                        // Display user message with PDF name if available
                        displayMessage(msg.user_message, "user-combined-message", 
                            msg.user_message.startsWith("PDF Upload:") ? pdfName : null);
                    }
                    
                    // Handle bot responses carefully to prevent duplication and ensure all responses are shown
                    
                    // Case 1: We have a dedicated PDF analysis response
                    if (msg.bot_response_pdf) {
                        displayFormattedResponse(msg.bot_response_pdf, pdfName);
                    }
                    
                    // Case 2: We have a regular bot response (non-PDF analysis)
                    if (msg.bot_response) {
                        let isPdfJson = false;
                        
                        // Check if the bot_response is actually a PDF analysis in JSON format
                        try {
                            const parsedResponse = JSON.parse(msg.bot_response);
                            // Only treat it as PDF analysis if it has the expected fields
                            if (parsedResponse && typeof parsedResponse === 'object' && 
                                (parsedResponse.summary || parsedResponse.deficiencies || parsedResponse.recommendations)) {
                                // It's a PDF analysis stored as JSON string
                                // Only display it if we haven't already displayed a bot_response_pdf
                                if (!msg.bot_response_pdf) {
                                    displayFormattedResponse(parsedResponse, pdfName);
                                }
                                isPdfJson = true;
                            }
                        } catch (e) {
                            // Not JSON, which is fine - it's a regular response
                            isPdfJson = false;
                        }
                        
                        // If it's not a PDF analysis JSON, display it as a regular message
                        if (!isPdfJson) {
                            displayMessage(msg.bot_response, "bot-message");
                        }
                    }
                });
            }
    
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
                    showWelcomeMessage();
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

        // Update URL to remove chat ID
        updateURL();
        // Show welcome message for new chat
        showWelcomeMessage();
        
        document.querySelectorAll(".chat-area-item").forEach(item => {
            item.classList.remove("selected");
        });
    });

    // Add browser history handling
    window.addEventListener('popstate', async () => {
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        if (pathParts.length >= 2) {
            const chatId = pathParts[1];
            await loadChatArea(chatId);
        } else {
            // Handle return to main dashboard
            currentChatId = null;
            chatArea.innerHTML = "";
            showWelcomeMessage();
        }
    });

    // Initialize based on URL on page load

    // Form Submission Handler - FIXED VERSION
    form.addEventListener("submit", async function(event) {
        event.preventDefault();

        // Remove welcome message if exists
        const welcomeMessage = document.getElementById('welcome-message');
        if (welcomeMessage) {
            welcomeMessage.remove();
        }

        const formData = new FormData();
        const file = fileInput.files[0];
        let pdfName = null;
        
        if (file) {
            formData.append("file", file);
            pdfName = file.name;
        }
        
        if (textarea.value.trim() !== "" || file) {
            formData.append("messageInput", textarea.value.trim());
            let userMessage = textarea.value.trim();
            
            // Display user message with PDF name if applicable
            displayMessage(userMessage, "user-combined-message", pdfName);
        }

        // Add chat history and ID if exists
        formData.append("chatHistory", getChatHistory());
        
        // This ensures we continue in the same chat rather than creating a new one
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
                // Handle different response types
                if (data.summary || data.deficiencies || data.recommendations) {
                    // This is a PDF analysis response
                    displayFormattedResponse(data, pdfName);
                } else if (data.query_response) {
                    // This is a regular chat response
                    displayMessage(data.query_response, "bot-message");
                } else if (typeof data === 'string') {
                    try {
                        // Try to parse it as JSON in case it's a stringified JSON
                        const parsedData = JSON.parse(data);
                        if (parsedData.summary || parsedData.deficiencies || parsedData.recommendations) {
                            displayFormattedResponse(parsedData, pdfName);
                        } else {
                            displayMessage(data, "bot-message");
                        }
                    } catch (e) {
                        // If parsing fails, it's just a regular string
                        displayMessage(data, "bot-message");
                    }
                }
                
                // IMPORTANT FIX: Only update the current chat ID if we don't already have one
                // This ensures we don't create a new chat each time we upload a PDF or send a message
                if (data.chat_id) {
                    if (!currentChatId) {
                        currentChatId = data.chat_id;
                        updateURL(data.chat_id);
                        await loadChatAreas();
                    }
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

    // Welcome message on chat area
    function showWelcomeMessage() {
        chatArea.innerHTML = `
            <div id="welcome-message" class="welcome-message">
                <div class="upload-icon">
                    <i class='bx bxs-file-upload'></i>
                </div>
                <h2>Upload Your Blood Report PDF for Instant Insights!</h2>
                <p>Get detailed analysis and recommendations based on your blood report parameters.</p>
                <div class="features">
                    <div class="feature">
                        <i class='bx bx-check'></i>
                        <span>Instant Analysis</span>
                    </div>
                    <div class="feature">
                        <i class='bx bx-check'></i>
                        <span>Detailed Insights</span>
                    </div>
                    <div class="feature">
                        <i class='bx bx-check'></i>
                        <span>Smart Recommendations</span>
                    </div>
                </div>
            </div>
        `;
    }

    // fetching chats from chathistory 
    function getChatHistory() {
        let messages = [];
        document.querySelectorAll("#chatArea .message").forEach(msg => {
            messages.push(msg.textContent);
        });
        return messages.join("\n");
    }
    
    // displaying content of blood report with PDF name - FIXED VERSION
    function displayMessage(text, className, pdfName = null) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", className);
        
        if (className === "user-combined-message" && pdfName) {
            messageElement.innerHTML = `
                <div class="pdf-indicator">
                    <i class='bx bxs-file-pdf'></i> ${pdfName}
                </div>
                <div class="message-text">${text}</div>
            `;
        } else if (className === "bot-message") {
            // First, detect if we have bullet points by looking for lines starting with "*"
            if (text.match(/^\s*\*\s+/m)) {
                // We have bullet points
                
                // Split the text into lines
                const lines = text.split('\n');
                const listItems = [];
                
                for (let line of lines) {
                    // Check if line starts with * (bullet point)
                    if (line.trim().startsWith('*')) {
                        // Remove the leading asterisk and space
                        let item = line.trim().substring(1).trim();
                        
                        // Handle bold formatting - process from most specific to least specific
                        // First handle ****text**** (quadruple asterisks)
                        item = item.replace(/\*\*\*\*(.*?)\*\*\*\*/g, '<strong>$1</strong>');
                        
                        // Then handle **text** (double asterisks)
                        item = item.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                        
                        listItems.push(`<li>${item}</li>`);
                    }
                }
                
                // Create a formatted list
                const formattedText = `
                    <ul class="section-list">
                        ${listItems.join('')}
                    </ul>
                `;
                
                messageElement.innerHTML = formattedText;
            } else {
                // Regular text without bullet points
                let formattedText = text;
                
                // Handle formatting
                formattedText = formattedText
                    .replace(/\*\*\*\*(.*?)\*\*\*\*/g, '<strong>$1</strong>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
                
                // Convert newlines to paragraphs for better readability
                formattedText = formattedText
                    .split('\n\n')
                    .map(para => `<p>${para.replace(/\n/g, '<br>')}</p>`)
                    .join('');
                
                messageElement.innerHTML = formattedText;
            }
        } else {
            messageElement.textContent = text;
        }
        
        chatArea.appendChild(messageElement);
        setTimeout(() => {
            chatArea.scrollTop = chatArea.scrollHeight;
        }, 100);
    }
    // loading feature while generating the text
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