
document.addEventListener("DOMContentLoaded", () => {
  const fileUploader = document.querySelector("#file-uploader");
  const fileInput = document.querySelector("#file");
  const selectedFileContainer = document.querySelector("#selectedFileContainer");
  const selectedFileName = document.querySelector("#selectedFileName");
  const removeFileButton = document.querySelector("#removeFileButton");
  const textarea = document.getElementById("messageInput");
  const uploadForm = document.getElementById("uploadForm");
  const defaultUi = document.querySelector(".default-message");

  function adjustTextareaHeight() {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
  }

  textarea.addEventListener("input", adjustTextareaHeight);

  fileInput.addEventListener("change", (event) => {
      const file = event.target.files[0];
      if (file) {
          selectedFileContainer.classList.remove("hidden");
          selectedFileName.textContent = file.name;
      }
  });

  fileUploader.addEventListener("click", () => fileInput.click());

  removeFileButton.addEventListener("click", () => {
      fileInput.value = "";
      selectedFileContainer.classList.add("hidden");
      selectedFileName.textContent = "";
  });

  textarea.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
          event.preventDefault();
          sendMessage();
      }
  });

  uploadForm.addEventListener("submit", (event) => {
      event.preventDefault();
      sendMessage();
  });

  function sendMessage() {
      const message = textarea.value.trim();
      const file = fileInput.files[0];

      console.log("User message:", message);

      if (message || file) {
          const formData = new FormData(uploadForm);
          console.log("Submitting form data:", Object.fromEntries(formData));

          appendMessage(message, "user");

          textarea.value = "";
          fileInput.value = "";
          selectedFileContainer.classList.add("hidden");
          selectedFileName.textContent = "";
          adjustTextareaHeight();
          defaultUi.classList.add("hidden");

          const botResponse = getBotResponse(message.toLowerCase());

          setTimeout(() => {
              appendMessage(botResponse, "bot");
          }, 1500);
      }
  }


  function getBotResponse(userMessage) {
      const responses = [
          { user: "hello", bot: "Hi there! How can I assist you today?" },
          { user: "what is your name?", bot: "I am ChatBot, your virtual assistant!" },
          { user: "tell me a joke", bot: "Why don't programmers like nature? It has too many bugs!" },
          { user: "what is the weather today?", bot: "I can't fetch live weather updates yet, but you can check a weather website!" },
          { user: "who created you?", bot: "I was created by a developer to assist with various tasks!" },
          { user: "what is 2 + 2?", bot: "2 + 2 equals 4!" },
          { user: "how can i contact support?", bot: "You can contact support via email at support@example.com." },
          { user: "tell me a fun fact", bot: "Did you know? Honey never spoils! Archaeologists have found pots of honey in ancient Egyptian tombs that are over 3,000 years old and still perfectly good to eat!" },
          { user: "goodbye", bot: "Goodbye! Have a great day!" }
      ];

      const userWords = userMessage.toLowerCase().split(/\s+/);

      const match = responses.find(response => {
          const botWords = response.user.toLowerCase().split(/\s+/);
          return botWords.some(word => userWords.includes(word));
      });

      return match ? match.bot : "I'm sorry, I didn't quite understand that.";
  }

  function appendMessage(text, sender) {
      const chatDiv = document.createElement("div");
      chatDiv.classList.add(sender === "user" ? "chat-right" : "chat-left");

      const messageDiv = document.createElement("div");
      messageDiv.classList.add(sender === "user" ? "chat-content-left" : "chat-content-right");
      chatDiv.appendChild(messageDiv);
      document.querySelector(".chat").appendChild(chatDiv);

      if (sender === "bot") {
          typeMessage(text, messageDiv);
      } else {
          messageDiv.textContent = text;
      }

      document.querySelector(".chat").scrollTop = document.querySelector(".chat").scrollHeight;
  }

  function typeMessage(text, element, index = 0) {
      if (index < text.length) {
          element.textContent += text[index];
          setTimeout(() => typeMessage(text, element, index + 1), 30);
      }
  }
});