# 🌌 OmniPredictor

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

---

## Using your own Jupyter Notebook model?

Paste this at the end of your `.ipynb` and it will generate the two files you need (`model.joblib` + `metadata.json`), ready to upload.

```python
import os, json, joblib, numpy as np, pandas as pd

def export_to_omnipredictor(model, X, y, model_name="My Model", metrics=None, colab_link=None, output_dir="./dist"):
    os.makedirs(output_dir, exist_ok=True)

    # Detect task type and classes
    estimator = model.steps[-1][1] if hasattr(model, "steps") else model
    classes = [str(c) for c in estimator.classes_] if hasattr(estimator, "classes_") else []
    task_type = "classification" if classes else "regression"

    # Build feature metadata
    features = []
    if isinstance(X, pd.DataFrame):
        for col in X.columns:
            if pd.api.types.is_numeric_dtype(X[col]):
                features.append({"name": col, "type": "numerical", "min": float(X[col].min()), "max": float(X[col].max()), "default": float(X[col].median()), "step": 1.0})
            else:
                features.append({"name": col, "type": "categorical", "options": [str(o) for o in X[col].dropna().unique()], "default": str(X[col].mode()[0])})
    else:
        for i in range(X.shape[1]):
            features.append({"name": f"feature_{i}", "type": "numerical", "min": float(X[:, i].min()), "max": float(X[:, i].max()), "default": float(np.median(X[:, i])), "step": 1.0})

    # Extract feature importances if available
    importances = {}
    if hasattr(estimator, "feature_importances_"):
        for i, f in enumerate(features):
            if i < len(estimator.feature_importances_):
                importances[f["name"]] = float(estimator.feature_importances_[i])
    elif hasattr(estimator, "coef_"):
        coefs = np.mean(np.abs(estimator.coef_), axis=0) if estimator.coef_.ndim > 1 else estimator.coef_
        for i, f in enumerate(features):
            if i < len(coefs):
                importances[f["name"]] = float(coefs[i])

    m = metrics or {}
    if importances:
        m["feature_importances"] = importances

    metadata = {
        "model_name": model_name,
        "algorithm_variant": estimator.__class__.__name__,
        "task_type": task_type,
        "n_features_in_": len(features),
        "target_name": y.name if hasattr(y, "name") else "target",
        "classes": classes,
        "features": features,
        "colab_link": colab_link,
        "metrics": m
    }

    joblib.dump(model, os.path.join(output_dir, "model.joblib"))
    with open(os.path.join(output_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"✅ Exported to {output_dir}/ — upload model.joblib and metadata.json to OmniPredictor")

# Usage:
# export_to_omnipredictor(model=pipeline, X=X_train, y=y_train, model_name="My Classifier", metrics={"accuracy": 0.91})
```

Works with any scikit-learn model or pipeline — classifiers, regressors, ColumnTransformers, everything.

---

