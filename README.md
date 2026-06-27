 # OmniPredictor

A web app that lets users to upload their trained ML model and instantly get a live prediction interface, performance dashboard, and an AI chatbot that understands the model.

---
## Live

- **App:** [https://dynamic-ml-ops.vercel.app]
- **API:** [https://dynamic-ml-ops.onrender.com]

## What it does

- **Upload & manage models** — drop in a `.joblib` and a `metadata.json`, manage them from the dashboard
- **Switch between models** live — no restarts, just click activate
- **Run predictions** — fill in the feature form and get instant results
- **Batch predictions** — upload a CSV and download results
- **AI Chatbot** — ask questions about the active model, trigger predictions by chatting
- **Performance charts** — feature importance, accuracy, metrics all auto-rendered


## **Note** :
It is espically made for the model trained on google colab environemnt so if any error or issue occurs in the local machine just use the command below to retrain the model.

```
pip install scikit-learn==1.9.0 numpy==2.5.0 pandas==3.0.3 --quiet

```

