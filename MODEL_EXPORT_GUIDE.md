# 📦 Model Export Guide — OmniPredictor

This guide explains how to train, export, and upload a model that works perfectly with OmniPredictor.

---

## ✅ Step 1 — Match the Exact Library Versions

**This project's backend runs these exact versions:**

| Library | Version |
|---|---|
| `scikit-learn` | `1.9.0` |
| `numpy` | `2.5.0` |
| `pandas` | `3.0.3` |

### If you are training in **Google Colab**

Run this cell at the very top of your notebook before importing anything:

```python
!pip install scikit-learn==1.9.0 numpy==2.5.0 pandas==3.0.3 --quiet
```

Then restart the runtime: `Runtime → Restart session`, and run from the top (skip the pip install cell).

### If you are training **locally** (Jupyter, VS Code, etc.)

```bash
pip install scikit-learn==1.9.0 numpy==2.5.0 pandas==3.0.3
```

> If you trained with different versions, the model may fail to load. Always install the exact versions above before training.

---

## ✅ Step 2 — Rules for Building Your Pipeline

### Never put custom classes inside a Pipeline

```python
# This WILL BREAK when you upload to OmniPredictor
class MyCustomTransformer(BaseEstimator, TransformerMixin):
    def transform(self, X):
        X['new_col'] = X['col_a'] + X['col_b']
        return X

pipeline = Pipeline([
    ('engineer', MyCustomTransformer()),  # WRONG — custom class
    ('model', RandomForestClassifier())
])
```

The joblib file saves a reference to `MyCustomTransformer`, not the code itself.
The server has never seen that class → crash on load.

### Do feature engineering on the DataFrame BEFORE the pipeline

```python
# Apply engineering directly to your dataframe first
df['new_col'] = df['col_a'] + df['col_b']

X = df[['col_a', 'col_b', 'new_col']]
y = df['target']

# Pipeline uses ONLY standard sklearn classes
pipeline = Pipeline([
    ('scaler', StandardScaler()),         # standard sklearn - OK
    ('model', RandomForestClassifier())   # standard sklearn - OK
])
pipeline.fit(X_train, y_train)
```

**Rule:** Only use classes you `import from sklearn` inside the Pipeline.
Anything you wrote yourself → do it in pandas before fitting.

---

## ✅ Step 3 — Export the Model

Paste this block at the end of your notebook and run it:

```python
import os, json, joblib, numpy as np, pandas as pd

def export_to_omnipredictor(model, X, y, model_name="My Model", metrics=None, colab_link=None, output_dir="./dist"):
    os.makedirs(output_dir, exist_ok=True)

    estimator = model.steps[-1][1] if hasattr(model, "steps") else model
    classes = [str(c) for c in estimator.classes_] if hasattr(estimator, "classes_") else []
    task_type = "classification" if classes else "regression"

    features = []
    if isinstance(X, pd.DataFrame):
        for col in X.columns:
            if pd.api.types.is_numeric_dtype(X[col]):
                features.append({"name": col, "type": "numerical", "min": float(X[col].min()), "max": float(X[col].max()), "default": float(X[col].median()), "step": 1.0})
            else:
                features.append({"name": col, "type": "categorical", "options": [str(o) for o in X[col].dropna().unique()], "default": str(X[col].mode()[0])})

    importances = {}
    if hasattr(estimator, "feature_importances_"):
        for i, f in enumerate(features):
            if i < len(estimator.feature_importances_):
                importances[f["name"]] = float(estimator.feature_importances_[i])

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

    print(f"Exported to {output_dir}/ — upload model.joblib and metadata.json to OmniPredictor")


# Change these to match your variable names
export_to_omnipredictor(
    model      = pipeline,          # your trained model or pipeline
    X          = X_test,            # your test features DataFrame
    y          = y_test,            # your test target Series
    model_name = "My Model Name",
    metrics    = {"accuracy": accuracy},
    output_dir = "/content/dist"    # use ./dist if running locally
)

# Download from Colab
from google.colab import files
files.download('/content/dist/model.joblib')
files.download('/content/dist/metadata.json')
```

---

## ✅ Step 4 — Upload to OmniPredictor

1. Go to OmniPredictor → Model Manager
2. Click Upload Model
3. Upload `model.joblib`
4. Upload `metadata.json`
5. Activate the model

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `Can't get attribute 'MyClass'` | Custom class in Pipeline | Move feature engineering to pandas, remove custom class from Pipeline |
| `_RemainderColsList` not found | Model saved with newer sklearn than server | Reinstall exact versions from Step 1 |
| `InconsistentVersionWarning` | Minor sklearn version mismatch | Reinstall exact versions from Step 1 |
| `ImportError: cannot import numpy` | Changed numpy without restarting runtime | Restart Colab runtime after pip install |
