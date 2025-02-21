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
from app.fixed_prompts import prompt as fixed_prompt1, prompt1 as fixed_prompt2
import uvicorn
from pydantic import BaseModel, EmailStr
from pymongo import MongoClient
from datetime import datetime
from pytz import timezone 
import uuid
import bcrypt

# Load environment variables
load_dotenv()

# Database connection
client = MongoClient(os.getenv("MONGODB_URI"))
db = client["chatbot_db"]  # Database name
chat_collection = db["chat_history"]  # Collection name
user_collection = db["users"]

# Configure API Key
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# FastAPI setup
app = FastAPI()
app.add_middleware(SessionMiddleware, secret_key=secrets.token_hex(16))
templates = Jinja2Templates(directory="./app/templates")
app.mount("/static", StaticFiles(directory="./app/static"), name="static")

def get_timestamp():
    return datetime.now(timezone("Asia/Kolkata")).strftime('%Y-%m-%d %H:%M:%S.%f')


def generate_user_id():
    return str(uuid.uuid4())

def save_chat_history(session_data, pdf_name, bot_response_pdf, user_input, bot_response):

    chat_data = {
        "username": session_data["username"],
        "pdf_name": pdf_name,
        "bot_response_pdf": bot_response_pdf,
        "user_input": user_input,
        "bot_response": bot_response,
        "timestamp": get_timestamp(),
    }
    chat_collection.insert_one(chat_data)

# Home route - Login/Signup page
@app.get("/", response_class=HTMLResponse)
async def show_signup(request: Request):
    return templates.TemplateResponse("login_page.html", {"request": request, "show_login": False})

@app.get("/login", response_class=HTMLResponse)
async def show_login(request: Request):
    return templates.TemplateResponse("login_page.html", {"request": request, "show_login": True})

# User Schema
class User(BaseModel):
    username: str
    email: EmailStr
    password: str

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
        "signup_timestamp": get_timestamp(),  # Store signup timestamp
        "last_login_timestamp": get_timestamp()  # Set initial last login to signup time
    })
    
    request.session["user"] = {"username": username}
    return templates.TemplateResponse("index.html", {"request": request, "username": username})

# Login Route
@app.post("/api/login", response_class=HTMLResponse)
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    user = user_collection.find_one({"username": username})
    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password"]):
        return JSONResponse(content={"error": "Invalid username or password."})
    
    # Update last login timestamp
    user_collection.update_one({"username": username}, {"$set": {"last_login_timestamp": get_timestamp()}})
    
    request.session["user"] = {"username": user["username"]}
    return templates.TemplateResponse("index.html", {"request": request, "username": username})

# File Upload and AI Processing
@app.post("/", response_class=JSONResponse)
async def upload_file(
    request: Request,
    file: UploadFile = None,
    messageInput: str = Form(None),
    chatHistory: str = Form(None)
):
    session_data = request.session.get("user",{})
    if not session_data:
        return JSONResponse(content={"error": "User not logged in."})
    structured_response = {"message_input": messageInput, "chat_history": chatHistory}
    
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
            print(raw_response)
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
            save_chat_history(session_data, pdf_name, bot_response_pdf, messageInput, structured_response.get("query_response", ""))
        
        return JSONResponse(content=structured_response)
    except Exception as e:
        return JSONResponse(content={"error": str(e)})

# Retrieve User Info with Signup and Last Login Timestamp
@app.get("/api/user_info", response_class=JSONResponse)
async def get_user_info(request: Request):
    session_data = request.session.get("user", {})
    if not session_data:
        return JSONResponse(content={"error": "User not logged in."})
    
    user = user_collection.find_one({"username": session_data["username"]}, {"_id": 0, "password": 0})
    if not user:
        return JSONResponse(content={"error": "User not found."})
    
    return JSONResponse(content=user)

if __name__ == "__main__":
    webbrowser.open("http://localhost:8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="debug", reload=True)
