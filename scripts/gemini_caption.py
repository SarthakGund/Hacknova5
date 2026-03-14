from google import genai
from google.genai import types
import cv2
import json
import time
from datetime import datetime
import os
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure Gemini API
API_KEY = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

OUTPUT_JSON = "drone_situations.json"

def analyze_frame_with_gemini(frame):
    """
    Converts a cv2 frame to an image and sends it to Gemini for situation analysis.
    """
    # Convert cv2 image (BGR) to RGB
    rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    pil_img = Image.fromarray(rgb_frame)
    
    prompt = """
    Analyze this drone footage frame. 
    Identify if there is any disaster situation (flooding, debris, fire, etc.). 
    Identify if people look stranded or in need of help.
    Provide a short, 1-sentence caption describing the situation.
    Then, provide an alert level: LOW, MEDIUM, or HIGH.
    Format your response exactly like this:
    Caption: [Your caption]
    Alert Level: [LOW/MEDIUM/HIGH]
    """
    
    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[prompt, pil_img]
        )
        text = response.text
        
        # Parse the response
        caption = "Unknown situation"
        alert_level = "LOW"
        
        for line in text.split('\n'):
            if line.startswith("Caption:"):
                caption = line.replace("Caption:", "").strip()
            elif line.startswith("Alert Level:"):
                alert_level = line.replace("Alert Level:", "").strip()
                
        return caption, alert_level
    except Exception as e:
        print(f"Error calling Gemini API: {e}")
        return "Analysis failed", "LOW"

def run_situational_awareness():
    # 0 for webcam, or video file path
    cap = cv2.VideoCapture(0) 
    
    if not cap.isOpened():
        print("Error: Could not open video source.")
        return

    events = []
    
    # Process 1 frame every 5 seconds to avoid API limits
    frame_rate = 5 
    last_process_time = time.time()

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        current_time = time.time()
        
        if current_time - last_process_time >= frame_rate:
            print("Analyzing frame with Gemini...")
            caption, alert_level = analyze_frame_with_gemini(frame)
            
            # Log the event
            event = {
                "timestamp": datetime.now().isoformat(),
                "event_type": "situation_analysis",
                "caption": caption,
                "alert_level": alert_level
            }
            events.append(event)
            
            with open(OUTPUT_JSON, 'w') as f:
                json.dump(events, f, indent=4)
                
            last_process_time = current_time

            # Update the frame display with the latest caption
            color = (0, 255, 0) # Green for LOW
            if alert_level == "HIGH":
                color = (0, 0, 255) # Red
            elif alert_level == "MEDIUM":
                color = (0, 165, 255) # Orange
                
            # Draw caption background for readability
            cv2.rectangle(frame, (10, 10), (600, 70), (0, 0, 0), -1)
            cv2.putText(frame, f"[{alert_level}] {caption}", 
                        (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

        # Show the frame
        cv2.imshow('Drone Feed - Gemini Analysis', frame)

        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    run_situational_awareness()