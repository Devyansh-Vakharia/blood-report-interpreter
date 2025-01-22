import os
import pdfplumber
import json
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, File, UploadFile, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
import fixed_prompts

load_dotenv()

# Load API key from .env file
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("API key is missing. Please check your .env file.")
    
genai.configure(api_key=api_key)

app = FastAPI()
templates = Jinja2Templates(directory="templates")

# Home route to display the form
@app.get("/", response_class=HTMLResponse)
async def read_form(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.post("/upload", response_class=HTMLResponse)
async def upload_file(request: Request, file: UploadFile = File(...)):
    try:
        # Extract text from PDF
        pdf_text = ""
        with pdfplumber.open(file.file) as pdf:
            for page in pdf.pages:
                pdf_text += page.extract_text()

        if not pdf_text:
            raise ValueError("The PDF is empty or cannot be read.")
        
        blood_report_keywords = ["hemoglobin", "glucose", "white blood cell", "platelet", "red blood cell", "WBC", "RBC", "cholesterol", "count", "CBC"]
        
        if any(keyword.lower() in pdf_text.lower() for keyword in blood_report_keywords):
            prompt = f"{fixed_prompts.prompt} {pdf_text}"
            response = genai.GenerativeModel(model_name="gemini-1.5-flash").generate_content([prompt])
            generated_text = response.text
        else:
            generated_text = "Please upload the PDF of Blood Report for simple understanding about your health."
        
        return templates.TemplateResponse("index.html", {"request": request, "generated_text": generated_text})

    except Exception as e:
        return f"<h1>Error: {e}</h1>"

