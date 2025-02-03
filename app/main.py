import os
import webbrowser
import pdfplumber
import google.generativeai as genai
import json
import re
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
    # Initialize the response variable to ensure all paths assign it
    structured_response = {
        "error": None,
        "summary": None,
        "deficiencies": None,
        "recommendations": None,
        "important_note": None,
        "query_response": None
    }
    
    try:
        # If a file is provided
        if file:
            if not file.filename.endswith(".pdf"):
                structured_response["error"] = "The uploaded file is not a valid PDF."
                return JSONResponse(content=structured_response)

            # Extract text from the PDF
            pdf_text = ""
            with pdfplumber.open(file.file) as pdf:
                for page in pdf.pages:
                    pdf_text += page.extract_text()

            # If the PDF content is empty or cannot be read
            if not pdf_text.strip():
                structured_response["error"] = "The PDF is empty or cannot be read."
                return JSONResponse(content=structured_response)

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
                generated_text = response.text.strip()

                # Try extracting JSON from AI response
                try:
                    # Use regex to find a valid JSON part in the response
                    json_match = re.search(r'(\{.*\})', generated_text, re.DOTALL)
                    if json_match:
                        structured_response.update(json.loads(json_match.group(1)))  # Convert to JSON
                    else:
                        structured_response["error"] = "AI response did not return valid JSON."
                except json.JSONDecodeError:
                    structured_response["error"] = "Unable to parse AI response into JSON."
            else:
                structured_response["error"] = "Not a valid blood report PDF."

        # Add messageInput to response if it's provided
        if messageInput:
            query_prompt = (
                f"{fixed_prompt2}\n"
                f"Read the following PDF content and address the user's query: '{messageInput}'.\n"
                f"PDF Content: {pdf_text}\n"
                f"Provide a clear, concise, and accurate response based on the information in the PDF."
                )

            query_response = genai.GenerativeModel(model_name="gemini-1.5-flash").generate_content([query_prompt])
            generated_query_response = query_response.text.strip()

            structured_response["query_response"] = generated_query_response

        return JSONResponse(content=structured_response)

    except Exception as e:
        # Catch any unexpected exceptions
        structured_response["error"] = str(e)
        return JSONResponse(content=structured_response)


if __name__ == "__main__":
    webbrowser.open("http://localhost:8000")
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, log_level="debug", reload=True)
