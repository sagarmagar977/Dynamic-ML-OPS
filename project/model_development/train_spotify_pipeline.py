import os
import json
import joblib
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, confusion_matrix

def main():
    # 1. Resolve paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    workspace_root = os.path.dirname(project_root)

    dataset_path = os.path.join(workspace_root, "ref", "models artifacts", "datasets", "high_popularity_spotify_data.csv")
    output_dir = os.path.join(project_root, "backend", "models", "spotify_genre_classifier")
    os.makedirs(output_dir, exist_ok=True)

    print(f"Loading Spotify dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)

    # 2. Features and Target selection
    # We choose strictly numeric features to satisfy the api's float casting constraint.
    features = [
        'danceability', 'energy', 'key', 'loudness', 'mode', 
        'speechiness', 'acousticness', 'instrumentalness', 
        'liveness', 'valence', 'tempo', 'duration_ms'
    ]
    target = 'playlist_genre'

    # Filter out rows with missing target or features
    df = df.dropna(subset=[target] + features)

    X = df[features]
    y = df[target]

    print(f"Dataset size: {len(df)} rows")
    print(f"Features: {features}")
    print(f"Target: {target} (Genres: {y.unique().tolist()})")

    # 3. Train-Test Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

    # 4. Construct Preprocessing & Model Pipeline
    # Numeric transformer with imputation and scaling
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])

    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, features)
        ]
    )

    clf_pipeline = Pipeline(steps=[
        ('preprocessor', preprocessor),
        ('classifier', RandomForestClassifier(random_state=42))
    ])

    # 5. Hyperparameter Tuning using GridSearchCV
    param_grid = {
        'classifier__n_estimators': [50, 100],
        'classifier__max_depth': [5, 10, None],
        'classifier__min_samples_split': [2, 5]
    }

    print("Running GridSearchCV...")
    grid_search = GridSearchCV(clf_pipeline, param_grid, cv=3, verbose=1, n_jobs=-1)
    grid_search.fit(X_train, y_train)

    best_pipeline = grid_search.best_estimator_
    print(f"Best Parameters: {grid_search.best_params_}")
    print(f"Best CV Score: {grid_search.best_score_:.4f}")

    # 6. Evaluation
    y_pred = best_pipeline.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, average='macro')
    recall = recall_score(y_test, y_pred, average='macro')
    cm = confusion_matrix(y_test, y_pred)

    print(f"Test Accuracy: {accuracy:.4f}")
    print(f"Test Precision (macro): {precision:.4f}")
    print(f"Test Recall (macro): {recall:.4f}")

    # 7. Save Binary Model
    joblib_path = os.path.join(output_dir, "model.joblib")
    joblib.dump(best_pipeline, joblib_path)
    print(f"Saved model binary to: {joblib_path}")

    # 8. Dynamic Metadata Generation
    features_meta = []
    for col in features:
        col_min = float(X[col].min())
        col_max = float(X[col].max())
        col_default = float(X[col].median())
        
        # Decide step size based on column properties
        if col in ['key', 'mode']:
            col_step = 1.0
        elif col in ['tempo', 'duration_ms']:
            col_step = 1.0
        elif col == 'loudness':
            col_step = 0.1
        else:
            col_step = 0.01
            
        features_meta.append({
            "name": col,
            "label": col.replace("_", " ").title(),
            "type": "continuous",
            "min": col_min,
            "max": col_max,
            "step": col_step,
            "default": col_default
        })

    # Retrieve feature importances from classifier step
    importances = best_pipeline.named_steps['classifier'].feature_importances_
    feature_importances_dict = {
        name: float(imp) for name, imp in zip(features, importances)
    }

    # Map classes to string format
    classes = [str(c) for c in best_pipeline.classes_]

    metadata = {
        "model_name": "Spotify_Genre_Classifier",
        "algorithm_variant": "RandomForestClassifier",
        "task_type": "classification",
        "n_features_in_": len(features),
        "features": features_meta,
        "classes": classes,
        "metrics": {
            "accuracy": float(accuracy),
            "precision": float(precision),
            "recall": float(recall)
        },
        "chart_data": {
            "confusion_matrix": cm.tolist(),
            "feature_importances": feature_importances_dict
        }
    }

    metadata_path = os.path.join(output_dir, "metadata.json")
    with open(metadata_path, 'w', encoding='utf-8') as f:
        json.dump(metadata, f, indent=2)
    print(f"Saved model metadata to: {metadata_path}")
    print("Workflow completed successfully!")

if __name__ == "__main__":
    main()
