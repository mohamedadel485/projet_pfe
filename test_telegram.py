#!/usr/bin/env python3
import requests
import json

# Ton token et channel
TOKEN = "8754518536:AAH2kYojjqbJaHEDxtyuM2BxFOBuVQ73so0"
CHAT_ID = "@UptimeWarden_bot1"  # ou l'ID numérique si c'est un groupe

# Construire l'URL
url = f"https://api.telegram.org/bot{TOKEN}/sendMessage"

# Payload
payload = {
    "chat_id": CHAT_ID,
    "text": "🟢 Test message from UptimeWarden\n\nMonitor: Test Server\nStatus: UP",
    "disable_web_page_preview": True
}

print("Testing Telegram Bot API...")
print(f"URL: {url}")
print(f"Chat ID: {CHAT_ID}")
print(f"Payload: {json.dumps(payload, indent=2)}\n")

try:
    response = requests.post(url, json=payload, timeout=10)
    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.text}\n")
    
    if response.status_code == 200:
        print("✅ SUCCESS! Message envoyé.")
    else:
        print(f"❌ ERROR! Code {response.status_code}")
        result = response.json()
        if "description" in result:
            print(f"   Description: {result['description']}")
except Exception as e:
    print(f"❌ Exception: {str(e)}")
