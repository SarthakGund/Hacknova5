from google import genai
import os
from PIL import Image
from typing import Dict, Any, Optional
import json
import re

class AIHandler:
    def __init__(self):
        # Configure the Gemini API using the new google-genai SDK
        api_key = os.getenv("GOOGLE_API_KEY")
        if api_key:
            self.client = genai.Client(api_key=api_key)
            self.model_id = 'gemini-flash-latest'
            self.configured = True
        else:
            self.configured = False
            print("⚠️ GOOGLE_API_KEY not found in environment. AI verification disabled.")

    def verify_incident_photo(self, photo_path: str, incident_type: str, incident_description: str) -> Dict[str, Any]:
        """
        Verifies if an uploaded photo matches the reported incident type and description using Gemini Flash.
        """
        if not self.configured:
            return {
                "success": False,
                "error": "AI not configured",
                "is_verified": None,
                "confidence_score": 0,
                "analysis": "AI verification skipped: API key missing"
            }

        try:
            # Open the image
            img = Image.open(photo_path)
            
            prompt = f"""
            Task: Verify if this image matches a reported emergency incident.
            Reported Type: {incident_type}
            Reported Description: {incident_description}

            Please analyze the image and provide:
            1. 'is_verified': true/false (Does the image clearly show evidence of the reported incident?)
            2. 'confidence_score': 0-100 (How confident are you in this assessment?)
            3. 'analysis': A brief (1-2 sentence) explanation of what you see.
            4. 'severity_estimate': low/medium/high/critical based on visual evidence.

            Respond ONLY in JSON format like this:
            {{
                "is_verified": true,
                "confidence_score": 95,
                "analysis": "Visible smoke and flames in a residential area.",
                "severity_estimate": "high"
            }}
            """

            # Use the new Client.models.generate_content syntax
            response = self.client.models.generate_content(
                model=self.model_id,
                contents=[prompt, img]
            )
            
            text = response.text
            # Use regex to find the JSON block if the model added extra text
            match = re.search(r'\{.*\}', text, re.DOTALL)
            if match:
                result = json.loads(match.group())
                return {
                    "success": True,
                    "is_verified": result.get("is_verified", False),
                    "confidence_score": result.get("confidence_score", 0),
                    "analysis": result.get("analysis", ""),
                    "severity_estimate": result.get("severity_estimate", "unknown")
                }
            else:
                return {
                    "success": False,
                    "error": "Failed to parse AI response",
                    "raw_text": text
                }

        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }

# Singleton instance
ai_handler = AIHandler()
