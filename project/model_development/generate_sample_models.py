import os
import json
import joblib
import numpy as np
from sklearn.datasets import load_iris, fetch_california_housing
from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix
from sklearn.metrics import r2_score, mean_absolute_error, mean_squared_error

# Create directories if they don't exist
os.makedirs("project/backend/models/model_v1", exist_ok=True)
os.makedirs("project/backend/models/model_v2", exist_ok=True)

# --- MODEL 1: Iris Classification ---
print("Training Model 1: Iris Classifier...")
iris = load_iris()
X1, y1 = iris.data, iris.target
X1_train, X1_test, y1_train, y1_test = train_test_split(X1, y1, test_size=0.3, random_state=42)

model1 = DecisionTreeClassifier(max_depth=3, random_state=42)
model1.fit(X1_train, y1_train)

# Evaluate
y1_pred = model1.predict(X1_test)
acc = accuracy_score(y1_test, y1_pred)
prec = precision_score(y1_test, y1_pred, average='macro')
rec = recall_score(y1_test, y1_pred, average='macro')
cm = confusion_matrix(y1_test, y1_pred)

# Save binary
joblib.dump(model1, "project/backend/models/model_v1/model.joblib")

# Prepare classification metadata
metadata_v1 = {
    "model_name": "Iris_Species_Classifier",
    "algorithm_variant": "DecisionTreeClassifier",
    "task_type": "classification",
    "n_features_in_": int(model1.n_features_in_),
    "features": [
        {
            "name": "sepal_length",
            "label": "Sepal Length (cm)",
            "type": "continuous",
            "min": float(np.min(X1[:, 0])),
            "max": float(np.max(X1[:, 0])),
            "step": 0.1,
            "default": float(np.median(X1[:, 0]))
        },
        {
            "name": "sepal_width",
            "label": "Sepal Width (cm)",
            "type": "continuous",
            "min": float(np.min(X1[:, 1])),
            "max": float(np.max(X1[:, 1])),
            "step": 0.1,
            "default": float(np.median(X1[:, 1]))
        },
        {
            "name": "petal_length",
            "label": "Petal Length (cm)",
            "type": "continuous",
            "min": float(np.min(X1[:, 2])),
            "max": float(np.max(X1[:, 2])),
            "step": 0.1,
            "default": float(np.median(X1[:, 2]))
        },
        {
            "name": "petal_width",
            "label": "Petal Width (cm)",
            "type": "continuous",
            "min": float(np.min(X1[:, 3])),
            "max": float(np.max(X1[:, 3])),
            "step": 0.1,
            "default": float(np.median(X1[:, 3]))
        }
    ],
    "target_name": "Iris Species",
    "classes": [str(c) for c in iris.target_names],
    "metrics": {
        "accuracy": float(acc),
        "precision": float(prec),
        "recall": float(rec)
    },
    "chart_data": {
        "confusion_matrix": cm.tolist(),
        "feature_importances": {
            name: float(imp) for name, imp in zip(["sepal_length", "sepal_width", "petal_length", "petal_width"], model1.feature_importances_)
        }
    }
}

with open("project/backend/models/model_v1/metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata_v1, f, indent=2)

# --- MODEL 2: California Housing Regression ---
print("Training Model 2: Housing Regressor...")
housing = fetch_california_housing(as_frame=False)
features_selected = ["MedInc", "HouseAge", "AveRooms", "AveBedrms"]
feature_indices = [housing.feature_names.index(f) for f in features_selected]
X2 = housing.data[:, feature_indices]
y2 = housing.target

X2_train, X2_test, y2_train, y2_test = train_test_split(X2, y2, test_size=0.2, random_state=42)

model2 = DecisionTreeRegressor(max_depth=5, random_state=42)
model2.fit(X2_train, y2_train)

# Evaluate
y2_pred = model2.predict(X2_test)
r2 = r2_score(y2_test, y2_pred)
mae = mean_absolute_error(y2_test, y2_pred)
rmse = np.sqrt(mean_squared_error(y2_test, y2_pred))

# Save binary
joblib.dump(model2, "project/backend/models/model_v2/model.joblib")

# Sample scatter and residuals for rendering
np.random.seed(42)
sample_indices = np.random.choice(len(y2_test), 50, replace=False)
scatter_data = [[float(y2_test[i]), float(y2_pred[i])] for i in sample_indices]
residual_data = [[float(y2_test[i]), float(y2_test[i] - y2_pred[i])] for i in sample_indices]

# Prepare regression metadata
metadata_v2 = {
    "model_name": "California_Housing_Value_Regressor",
    "algorithm_variant": "DecisionTreeRegressor",
    "task_type": "regression",
    "n_features_in_": int(model2.n_features_in_),
    "features": [
        {
            "name": "MedInc",
            "label": "Median Income (tens of thousands)",
            "type": "continuous",
            "min": float(np.min(X2[:, 0])),
            "max": float(np.max(X2[:, 0])),
            "step": 0.1,
            "default": float(np.median(X2[:, 0]))
        },
        {
            "name": "HouseAge",
            "label": "House Age (years)",
            "type": "continuous",
            "min": float(np.min(X2[:, 1])),
            "max": float(np.max(X2[:, 1])),
            "step": 1.0,
            "default": float(np.median(X2[:, 1]))
        },
        {
            "name": "AveRooms",
            "label": "Average Rooms per Dwelling",
            "type": "continuous",
            "min": float(np.min(X2[:, 2])),
            "max": float(np.max(X2[:, 2])),
            "step": 0.1,
            "default": float(np.median(X2[:, 2]))
        },
        {
            "name": "AveBedrms",
            "label": "Average Bedrooms per Dwelling",
            "type": "continuous",
            "min": float(np.min(X2[:, 3])),
            "max": float(np.max(X2[:, 3])),
            "step": 0.1,
            "default": float(np.median(X2[:, 3]))
        }
    ],
    "target_name": "Median House Value ($100k)",
    "metrics": {
        "r2_score": float(r2),
        "mae": float(mae),
        "rmse": float(rmse)
    },
    "chart_data": {
        "scatter_data": scatter_data,
        "residual_data": residual_data
    }
}

with open("project/backend/models/model_v2/metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata_v2, f, indent=2)

print("Sample models generated successfully!")
