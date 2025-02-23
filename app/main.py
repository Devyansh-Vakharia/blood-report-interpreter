import os
import json
import webbrowser
import pdfplumber
import secrets
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile, Request, Depends
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from fastapi.middleware.cors import CORSMiddleware
from app.fixed_prompts import prompt as fixed_prompt1, prompt1 as fixed_prompt2
import uvicorn
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from datetime import datetime
from pytz import timezone 
import uuid
import bcrypt
from typing import List, Optional

# Load environment variables
load_dotenv()

# Database connection
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["chatbot_db"]  # Database name
chat_collection = db["chat_history"]  # Collection for chat areas
user_collection = db["users"]

# Configure API Key
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# FastAPI setup
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=secrets.token_hex(16))
templates = Jinja2Templates(directory="./app/templates")
app.mount("/static", StaticFiles(directory="./app/static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Models for data validation
class Message(BaseModel):
    user_message: str
    bot_response: str
    timestamp: str

class ChatArea(BaseModel):
    chat_id: str
    username: str
    pdf_name: Optional[str]
    bot_response_pdf: Optional[dict]
    messages: List[Message]
    created_at: str
    last_updated: str

class User(BaseModel):
    username: str
    email: EmailStr
    password: str

def get_timestamp():
    return datetime.now(timezone("Asia/Kolkata")).strftime('%Y-%m-%d %H:%M:%S.%f')

def generate_user_id():
    return str(uuid.uuid4())

def save_chat_history(session_data, pdf_name, bot_response_pdf, user_input, bot_response, chat_id=None):
    timestamp = get_timestamp()
    
    new_message = {
        "user_message": user_input,
        "bot_response": bot_response,
        "bot_response_pdf": bot_response_pdf,
        "timestamp": timestamp
    }
    
    if not chat_id:
        # Create new chat area
        chat_data = {
            "chat_id": generate_user_id(),
            "username": session_data["username"],
            "pdf_name": pdf_name,  # Keep PDF name in data but don't display it
            "messages": [new_message],
            "created_at": timestamp,
            "last_updated": timestamp
        }
        
        # Generate initial title
        chat_data["ai_title"] = generate_chat_title([new_message], pdf_name)
        
        chat_collection.insert_one(chat_data)
        return chat_data["chat_id"]
    else:
        # Update existing chat area
        chat_collection.update_one(
            {"chat_id": chat_id},
            {
                "$push": {"messages": new_message},
                "$set": {
                    "last_updated": timestamp,
                    "pdf_name": pdf_name
                }
            }
        )
        
        # Update title based on all messages
        chat = chat_collection.find_one({"chat_id": chat_id})
        if chat:
            new_title = generate_chat_title(chat["messages"], chat.get("pdf_name"))
            chat_collection.update_one(
                {"chat_id": chat_id},
                {"$set": {"ai_title": new_title}}
            )
        
        return chat_id
# Home route - Login/Signup page
@app.get("/", response_class=HTMLResponse)
async def show_signup(request: Request):
    return templates.TemplateResponse("login_page.html", {"request": request, "show_login": False})

@app.get("/login", response_class=HTMLResponse)
async def show_login(request: Request):
    return templates.TemplateResponse("login_page.html", {"request": request, "show_login": True})

# Signup Route
@app.post("/api/signup", response_class=HTMLResponse)
async def signup(request: Request, username: str = Form(...), email: EmailStr = Form(...), password: str = Form(...)):
    if user_collection.find_one({"email": email}):
        return JSONResponse(content={"error": "Email is already registered."})
    if user_collection.find_one({"username": username}):
        return JSONResponse(content={"error": "Username already taken."})
    if len(password) < 8:
        return JSONResponse(content={"error": "Password must be at least 8 characters long."})
    
    hashed_password = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())

    user_collection.insert_one({
        "username": username,
        "email": email,
        "password": hashed_password,
        "signup_timestamp": get_timestamp(),
        "last_login_timestamp": get_timestamp()
    })
    
    request.session["user"] = {"username": username}
    return templates.TemplateResponse("index.html", {"request": request, "username": username})

# Login Route
@app.post("/api/login/", response_class=HTMLResponse)
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = user_collection.find_one({"username": username})
    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password"]):
        return JSONResponse(content={"error": "Invalid username or password."})
    
    user_collection.update_one(
        {"username": username},
        {"$set": {"last_login_timestamp": get_timestamp()}}
    )
    
    request.session["user"] = {"username": username}
    return templates.TemplateResponse("index.html", {"request": request, "username": username})

# File Upload and AI Processing
# Update the upload_file endpoint to handle PDF-only uploads

def generate_chat_title(messages, pdf_name=None):
    """Generate a concise chat title using Google's Generative AI."""
    try:
        # If it's a PDF analysis, create a title based on the PDF content
        if pdf_name:
            first_message = next((msg for msg in messages if msg.get('bot_response_pdf')), None)
            if first_message and first_message.get('bot_response_pdf'):
                pdf_content = first_message['bot_response_pdf'].get('summary', '')
                prompt = f"""Generate a concise 2-3 word medical report title based on this analysis. 
                Respond only with the title, no other text.
                
                Analysis: {pdf_content}"""
            else:
                # Fallback to regular title generation
                prompt = f"""Generate a concise 2-3 word title that captures the main topic or theme of this conversation. 
                Respond only with the title, no other text."""
        else:
            # Combine messages into a single text for analysis
            combined_text = " ".join([
                f"{msg.get('user_message', '')} {msg.get('bot_response', '')}" 
                for msg in messages
            ])
            
            prompt = f"""Generate a concise only 2-3 word title that captures the main topic or theme of this conversation. 
            Respond only with the title, no other text.
            
            Conversation: {combined_text}"""
        
        # Generate title using Google AI
        response = genai.GenerativeModel(model_name="gemini-1.5-flash").generate_content([prompt])
        title = response.text.strip()
        
        # Ensure title is not too long
        # if len(title) > 30:
        #     title = title[:27] + "..."
            
        return title
    except Exception as e:
        print(f"Error generating chat title: {str(e)}")
        return "New Chat"
@app.post("/", response_class=JSONResponse)
async def upload_file(
    request: Request,
    file: UploadFile = None,
    messageInput: str = Form(None),
    chatHistory: str = Form(None),
    chatId: str = Form(None)
):
    session_data = request.session.get("user", {})
    if not session_data:
        return JSONResponse(content={"error": "User not logged in."})
    
    structured_response = {
        "message_input": messageInput,
        "chat_history": chatHistory,
        "chat_id": chatId
    }
    
    try:
        pdf_text = ""
        pdf_name = None
        bot_response_pdf = None

        if file:
            if not file.filename.endswith(".pdf"):
                return JSONResponse(content={"error": "The uploaded file is not a valid PDF."})
            
            pdf_name = file.filename
            with pdfplumber.open(file.file) as pdf:
                for page in pdf.pages:
                    pdf_text += page.extract_text() or ""
            
            if not pdf_text.strip():
                return JSONResponse(content={"error": "The PDF is empty or cannot be read."})
            
            prompt = f"""{fixed_prompt1}
                Please return the response in JSON format with the following structure:
                {{
                    "summary": "Brief explanation of key findings",
                    "deficiencies": [ "List of detected deficiencies" ],
                    "recommendations": [ "Suggested medicines, nutrients, or meals" ],
                    "important_note": "Reminder that AI is not a doctor"
                }}
                PDF Content:
                {pdf_text}
                """
            response = genai.GenerativeModel(model_name="gemini-1.5-flash").generate_content([prompt])
            raw_response = response.text.strip()
            cleaned_response = raw_response.replace("```json\n", "").replace("\n```", "").strip()
            
            if cleaned_response:
                try:
                    structured_response.update(json.loads(cleaned_response))
                    bot_response_pdf = {
                        "summary": structured_response.get("summary", ""),
                        "deficiencies": structured_response.get("deficiencies", []),
                        "recommendations": structured_response.get("recommendations", []),
                        "important_note": structured_response.get("important_note", "")
                    }
                    
                    # Save chat history for PDF-only upload
                    if not messageInput:
                        chat_id = save_chat_history(
                            session_data,
                            pdf_name,
                            bot_response_pdf,
                            "PDF Upload: " + pdf_name,  # Use PDF filename as user message
                            json.dumps(bot_response_pdf, indent=2),  # Store formatted PDF analysis
                            chatId
                        )
                        structured_response["chat_id"] = chat_id
                        
                except json.JSONDecodeError as e:
                    return JSONResponse(content={"error": f"Failed to parse JSON: {str(e)}"})
            else:
                return JSONResponse(content={"error": "AI returned an empty response."})

        if messageInput:
            query_prompt = f"""
            {fixed_prompt2}
            Previous chat history:
            {chatHistory}
            Read this PDF (if available): {pdf_text}
            User's latest question: {messageInput}
            """
            query_response = genai.GenerativeModel(model_name="gemini-1.5-flash").generate_content([query_prompt])
            structured_response["query_response"] = query_response.text.strip()
            
            # Save chat with chat area ID
            chat_id = save_chat_history(
                session_data, 
                pdf_name, 
                bot_response_pdf, 
                messageInput, 
                structured_response.get("query_response", ""),
                chatId
            )
            structured_response["chat_id"] = chat_id
        
        return JSONResponse(content=structured_response)
    except Exception as e:
        return JSONResponse(content={"error": str(e)})
# Get User Chat Areas
@app.get("/api/chat_areas/{username}", response_class=JSONResponse)
async def get_chat_areas(username: str):
    try:
        chat_areas = list(chat_collection.find(
            {"username": username},
            {"_id": 0}
        ).sort("last_updated", -1))
        
        if not chat_areas:
            return JSONResponse(content=[])
        
        # Generate titles for each chat area
        for chat in chat_areas:
            if chat.get("messages"):
                chat["ai_title"] = generate_chat_title(chat["messages"])
            else:
                chat["ai_title"] = "New Chat"
        
        return JSONResponse(content=chat_areas)
    except Exception as e:
        return JSONResponse(content={"error": f"Failed to load chat areas: {str(e)}"})

# Get Specific Chat Area
@app.get("/api/chat_area/{chat_id}", response_class=JSONResponse)
async def get_chat_area(chat_id: str):
    chat_area = chat_collection.find_one({"chat_id": chat_id}, {"_id": 0})
    
    if not chat_area:
        return JSONResponse(content={"error": "Chat area not found"})
    
    return JSONResponse(content=chat_area)

# Get User Info
@app.get("/api/user_info", response_class=JSONResponse)
async def get_user_info(request: Request):
    session_data = request.session.get("user", {})
    if not session_data:
        return JSONResponse(content={"error": "User not logged in."})
    
    user = user_collection.find_one(
        {"username": session_data["username"]},
        {"_id": 0, "password": 0}
    )
    if not user:
        return JSONResponse(content={"error": "User not found."})
    
    return JSONResponse(content=user)

# Delete Chat Area
@app.delete("/api/chat_area/{chat_id}", response_class=JSONResponse)
async def delete_chat_area(chat_id: str, request: Request):
    session_data = request.session.get("user", {})
    if not session_data:
        return JSONResponse(content={"error": "User not logged in."})
    
    result = chat_collection.delete_one({
        "chat_id": chat_id,
        "username": session_data["username"]
    })
    
    if result.deleted_count == 0:
        return JSONResponse(content={"error": "Chat area not found or unauthorized"})
    
    return JSONResponse(content={"message": "Chat area deleted successfully"})

if __name__ == "__main__":
    webbrowser.open("http://localhost:8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="debug", reload=True)