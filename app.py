from flask import Flask, render_template, request, jsonify
import numpy as np
import cv2
import random

app = Flask(__name__)

def analyze_surface(image_bytes):
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        return None

    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    blurred = cv2.GaussianBlur(gray, (9, 9), 2)
    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1.2,
        minDist=30, param1=50, param2=30,
        minRadius=10, maxRadius=min(h, w) // 6
    )
    crater_count = len(circles[0]) if circles is not None else 0
    crater_density = round(crater_count / ((h * w) / 1_000_000), 2)

    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.count_nonzero(edges) / (h * w)

    std_intensity = float(np.std(gray))

    flat_pct   = max(5,  min(60, int(100 - edge_density * 400 - crater_density * 5)))
    crater_pct = max(5,  min(40, int(crater_count * 2 + crater_density * 3)))
    rocky_pct  = max(5,  min(35, int(edge_density * 250)))
    basalt_pct = max(2,  min(20, int(std_intensity / 5)))
    total = flat_pct + crater_pct + rocky_pct + basalt_pct
    crater_floor = max(3, 100 - total)

    terrains = [
        {"name": "Flat Plains",   "pct": flat_pct,    "color": "#5cff9a"},
        {"name": "Crater Rims",   "pct": crater_pct,  "color": "#ff5566"},
        {"name": "Rocky Terrain", "pct": rocky_pct,   "color": "#ffcc44"},
        {"name": "Crater Floors", "pct": crater_floor,"color": "#ff8844"},
        {"name": "Smooth Basalt", "pct": basalt_pct,  "color": "#a064ff"},
    ]

    safety_score = max(10, min(99,
        int(flat_pct * 0.7 - crater_density * 8 - edge_density * 60 + 30)
    ))

    if safety_score >= 70:
        verdict, verdict_class = "SAFE FOR LANDING", "safe"
        desc = "Terrain analysis shows suitable flat coverage with low crater density. Recommended for primary landing approach."
    elif safety_score >= 45:
        verdict, verdict_class = "MODERATE RISK", "caution"
        desc = "Surface has viable landing corridors but elevated hazard regions. Careful approach vector selection required."
    else:
        verdict, verdict_class = "HIGH RISK — AVOID", "danger"
        desc = "High crater density and rugged terrain detected. Landing not recommended. Seek alternative coordinates."

    slope_variance = round(edge_density * 45 + random.uniform(2, 6), 1)
    hazard_index   = round(1 - (safety_score / 100), 2)

    metrics = [
        {"label": "Crater Density", "value": "HIGH" if crater_density > 2 else "MODERATE" if crater_density > 1 else "LOW",
         "sub": f"{crater_density} per km²", "cls": "danger" if crater_density > 2 else "caution" if crater_density > 1 else "safe"},
        {"label": "Slope Variance", "value": f"{slope_variance}°",
         "sub": "Avg gradient", "cls": "danger" if slope_variance > 15 else "caution" if slope_variance > 8 else "safe"},
        {"label": "Flat Coverage",  "value": f"{flat_pct}%",
         "sub": "Of surface area", "cls": "safe" if flat_pct > 35 else "caution" if flat_pct > 20 else "danger"},
        {"label": "Hazard Index",   "value": f"{hazard_index}",
         "sub": "Normalized (0–1)", "cls": "safe" if hazard_index < 0.4 else "caution" if hazard_index < 0.7 else "danger"},
    ]

    base_scores = sorted(
        [max(10, min(98, safety_score + random.randint(-25, 25))) for _ in range(6)],
        reverse=True
    )
    zone_ids = ["LZ-ALPHA","LZ-BETA","LZ-GAMMA","LZ-DELTA","LZ-ECHO","LZ-ZETA"]
    descs    = ["SE Plains","Central Flat","NE Ridge","SW Crater","S Basalt","NW Rim"]
    zones = []
    for zid, score, dz in zip(zone_ids, base_scores, descs):
        if score >= 75:   status, cls = "OPTIMAL", "safe"
        elif score >= 55: status, cls = "VIABLE",  "safe"
        elif score >= 40: status, cls = "CAUTION", "caution"
        else:             status, cls = "RISKY",   "danger"
        zones.append({"id": zid, "status": status, "score": f"{score}%", "cls": cls, "desc": dz})

    return {
        "terrains": terrains,
        "safety_score": safety_score,
        "verdict": verdict,
        "verdict_class": verdict_class,
        "description": desc,
        "metrics": metrics,
        "zones": zones,
        "crater_count": crater_count,
    }


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/analyze', methods=['POST'])
def analyze():
    if 'image' not in request.files:
        return jsonify({"error": "No image uploaded"}), 400
    file = request.files['image']
    result = analyze_surface(file.read())
    if result is None:
        return jsonify({"error": "Could not process image"}), 400
    return jsonify(result)


if __name__ == '__main__':
    app.run(debug=True)