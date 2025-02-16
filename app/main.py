import os
import json
import webbrowser
import pdfplumber
import google.generativeai as genai
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, UploadFile, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from app.fixed_prompts import prompt as fixed_prompt1, prompt1 as fixed_prompt2
import uvicorn

load_dotenv()

# Load API key from .env file
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    raise ValueError("API key is missing. Please check your .env file.")

genai.configure(api_key=api_key)

app = FastAPI()
templates = Jinja2Templates(directory="./app/templates")
app.mount("/static", StaticFiles(directory="./app/static"), name="static")

# Home route to display the form
@app.get("/", response_class=HTMLResponse)
async def read_form(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.post("/", response_class=JSONResponse)
async def upload_file(request: Request, file: UploadFile = None, messageInput: str = Form(None)):
    structured_response = {"message_input": messageInput}  # Include message input in the response

    try:
        pdf_text = ""

        # If a file is provided
        if file:
            if not file.filename.endswith(".pdf"):
                return JSONResponse(content={"error": "The uploaded file is not a valid PDF."})

            # Extract text from the PDF
            with pdfplumber.open(file.file) as pdf:
                for page in pdf.pages:
                    pdf_text += page.extract_text() or ""

            if not pdf_text.strip():
                return JSONResponse(content={"error": "The PDF is empty or cannot be read."})

            # Check for blood report-related keywords
            blood_report_keywords = [
                "hemoglobin", "glucose", "white blood cell", "platelet", "red blood cell",
                "WBC", "RBC", "cholesterol", "count", "CBC"
            ]
            if any(keyword.lower() in pdf_text.lower() for keyword in blood_report_keywords):
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

                # Debug: Log the raw AI response
                raw_response = response.text.strip()
                print(f"Raw AI Response: {repr(raw_response)}")  # Log raw response with special characters

                # Clean up and remove the markdown formatting
                cleaned_response = raw_response.replace("```json\n", "").replace("\n```", "").strip()

                if cleaned_response:
                    try:
                        structured_response.update(json.loads(cleaned_response))  # Merge AI response into structured_response
                    except json.JSONDecodeError as e:
                        return JSONResponse(content={"error": f"Failed to parse JSON: {str(e)}"})
                else:
                    return JSONResponse(content={"error": "AI returned an empty response."})

            else:
                return JSONResponse(content={"error": "Not a valid blood report PDF."})

        # Process messageInput if provided
        if messageInput:
            query_prompt = f"{fixed_prompt2} Read this pdf {pdf_text} and solve the query of the user {messageInput} "
            query_response = genai.GenerativeModel(model_name="gemini-1.5-flash").generate_content([query_prompt])

            structured_response["query_response"] = query_response.text.strip()

        return JSONResponse(content=structured_response)

    except Exception as e:
        return JSONResponse(content={"error": str(e)})

if __name__ == "__main__":
    webbrowser.open("http://localhost:8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="debug", reload=True)
