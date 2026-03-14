import cv2
import json
import time
from datetime import datetime
from ultralytics import YOLO
import os

# Load the YOLO model (for prototype, using yolov8n.pt which is fast)
# In production, replace with your specific Leaf YOLO model
model = YOLO('yolov8n.pt')

# Assuming we have a configuration setting for video input
# 0 is usually the default webcam, but can be replaced with a path to a video file
VIDEO_SOURCE = 0 
OUTPUT_JSON = "drone_events.json"

def process_video_feed():
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    
    if not cap.isOpened():
        print("Error: Could not open video source.")
        return

    events = []
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # Run YOLO inference
        results = model(frame, verbose=False)
        
        person_count = 0
        current_time = datetime.now().isoformat()
        
        # Parse results
        for r in results:
            boxes = r.boxes
            for box in boxes:
                # Class 0 in COCO is person
                if int(box.cls[0]) == 0:
                    person_count += 1
                    
                    # Draw bounding box
                    x1, y1, x2, y2 = map(int, box.xyxy[0])
                    cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                    cv2.putText(frame, 'Person', (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

        # Basic alert condition (could be customized)
        if person_count > 0:
            events.append({
                "timestamp": current_time,
                "event_type": "person_detected",
                "count": person_count,
                "status": "active"
            })
            
            # Simple text alert on frame
            cv2.putText(frame, f"ALERT: {person_count} person(s) detected", 
                        (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 0, 255), 2)

        # Log events to JSON periodically
        with open(OUTPUT_JSON, 'w') as f:
            json.dump(events, f, indent=4)

        # Display the frame
        cv2.imshow('Drone Feed - Bounding Box (YOLO)', frame)

        # Press 'q' to quit
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    process_video_feed()