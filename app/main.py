import os
import webbrowser
import pdfplumber
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, File,Form, UploadFile, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from app.fixed_prompts import prompt as fixed_prompt1
import uvicorn

load_dotenv()

# Load API key from .env file
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("API key is missing. Please check your .env file.")
    
genai.configure(api_key=api_key)

app = FastAPI()
templates = Jinja2Templates(directory="./app/templates")
app.mount("/static",StaticFiles(directory="./app/static"),name="static")


# Home route to display the form
@app.get("/", response_class=HTMLResponse)
async def read_form(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

 
@app.post("/upload", response_class=HTMLResponse)
async def upload_file(request: Request, file: UploadFile = None, messageInput: str = Form(...)):
    try:
        generated_text = ""

        # If a file is uploaded, validate it
        if file:
            if not file.filename.endswith(".pdf"):
                return templates.TemplateResponse("index.html", {
                    "request": request,
                    "generated_text": "Error: The uploaded file is not a valid PDF.",
                    "message_input": messageInput
                })

            try:
                pdf_text = ""
                with pdfplumber.open(file.file) as pdf:
                    for page in pdf.pages:
                        pdf_text += page.extract_text()

                if not pdf_text.strip():
                    return templates.TemplateResponse("index.html", {
                        "request": request,
                        "generated_text": "Error: The PDF is empty or cannot be read.",
                        "message_input": messageInput
                    })

                # Check for blood report keywords in the PDF text
                blood_report_keywords = ["hemoglobin", "glucose", "white blood cell", "platelet", "red blood cell", "WBC", "RBC", "cholesterol", "count", "CBC"]
                if any(keyword.lower() in pdf_text.lower() for keyword in blood_report_keywords):
                    prompt = f"{fixed_prompt1} {pdf_text}"
                    response = genai.GenerativeModel(model_name="gemini-1.5-flash").generate_content([prompt])
                    generated_text = response.text
                else:
                    generated_text = "Please upload a PDF of a Blood Report for simple understanding about your health."

            except Exception as e:
                return templates.TemplateResponse("index.html", {
                    "request": request,
                    "generated_text": f"Error: Unable to process the PDF. Details: {str(e)}",
                    "message_input": messageInput
                })

        # If no file is uploaded, use the message input as the generated text
        if not generated_text:
            generated_text = messageInput

        # Render the template with both inputs
        return templates.TemplateResponse("index.html", {
            "request": request,
            "generated_text": generated_text,
            "message_input": messageInput
        })

    except Exception as e:
        return templates.TemplateResponse("index.html", {
            "request": request,
            "generated_text": f"An unexpected error occurred: {str(e)}",
            "message_input": messageInput
        })




if __name__ == "__main__":
    webbrowser.open("http://localhost:8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="debug", reload=True)