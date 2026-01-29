# 🛡️ FairMarket AI

> **A Privacy-First, Decentralized Price Auditing Engine for the Modern Web.**


## 🚀 The Problem
E-commerce platforms use dynamic pricing algorithms that often lead to price discrimination based on user location, device, and history. Traditional price trackers are centralized, data-hungry, and easily blocked by UI changes.

## 💡 The Solution: FairMarket AI
FairMarket AI is a browser-based "Price Watchdog" that uses **Edge AI** to audit prices in real-time. 
* **Privacy:** It runs a lightweight **Conditional VAE** directly in the browser. No personal browsing history ever leaves the device.
* **Collaboration:** It uses **Federated Learning (FedAvgM)** to aggregate market insights from thousands of users without centralizing their data.
* **Reliability:** It bypasses brittle web scraping by extracting **JSON-LD SEO Metadata**, ensuring 99.9% accuracy even if Amazon or Flipkart change their UI.

---

## 🏗️ System Architecture


<img width="800" height="400" alt="image" src="https://github.com/user-attachments/assets/9083f0ee-f72d-4595-86b6-83d0b9a1bbfd" />

    
## 📸 Screenshot
Fair Price:
<img width="800" height="400" alt="Screenshot 2026-01-23 162854" src="https://github.com/user-attachments/assets/d9423887-8801-460a-8151-aa909bdfcf3f" />

Bias Detection:
<img width="800" height="400" alt="Screenshot 2026-01-21 235202" src="https://github.com/user-attachments/assets/2c145927-4d83-48e9-839d-8bd82a7963d4" />

Good Deal:
<img width="800" height="400" alt="Screenshot 2026-01-23 161500" src="https://github.com/user-attachments/assets/261519c3-6a56-484a-b13e-be1f25d41f69" />

## 🛠️ Tech stack

Frontend: Vanilla JavaScript (Manifest V3), Chrome Storage API
Backend: Python, Flask (REST API)
AI Engine: PyTorch (Server-side aggregation), Custom JS Matrix Math (Client-side inference)
Algorithm: Federated Averaging with Momentum (FedAvgM)


This project was built for Astronova 2026.
