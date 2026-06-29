import os
from google import genai

API_KEY = os.environ.get("GEMINI_API_KEY", "YOUR_API_KEY_HERE")

client = genai.Client(api_key=API_KEY)

# List available models so we can confirm the key works and see what's available
print("Available models:")
for model in client.models.list():
    print(f"  {model.name}")

print("\n--- Answer ---")
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents="What is psychological safety?",
    config={
        "system_instruction": (
            "You are a helpful assistant specialising in people management and leadership. "
            "Answer questions in a warm, conversational tone."
        )
    }
)
print(response.text)
