import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";

import {
  getDatabase,
  ref,
  onValue
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  databaseURL: "https://safezone-ai-17dc9-default-rtdb.firebaseio.com/"
};

const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

const liveRef = ref(database, "liveStatus");
const logsRef = ref(database, "accidentLogs");

// AI Predictive Collision Intelligence Engine
function updatePredictionEngine(data) {
  const distance = Number(data.distance) || 0;
  const approachSpeed = Number(data.approachSpeed) || 0;
  const riskLevel = data.riskLevel || "SAFE";

  let riskScore = 0;
  let collisionText = "---";
  let priority = "LOW";
  let action = "Continue monitoring";
  let cardClass = "card predictionSafe";

  if (riskLevel === "SAFE") {
    riskScore = Math.max(5, 100 - distance);
    priority = "LOW";
    action = "Area is safe. Continue monitoring.";
    cardClass = "card predictionSafe";
  }

  else if (riskLevel === "WARNING") {
    riskScore = 45 + approachSpeed;
    priority = "MEDIUM";
    action = "Alert driver and monitor blind spot.";
    cardClass = "card predictionWarning";
  }

  else if (riskLevel === "DANGER") {
    riskScore = 75 + approachSpeed;
    priority = "HIGH";
    action = "Slow down vehicle and prepare to stop.";
    cardClass = "card predictionDanger";
  }

  else if (riskLevel === "CRITICAL") {
    riskScore = 95 + approachSpeed;
    priority = "EMERGENCY";
    action = "Stop vehicle immediately and send rescue team.";
    cardClass = "card predictionDanger";
  }

  if (riskScore > 100) {
    riskScore = 100;
  }

  if (approachSpeed > 0 && distance > 0) {
    const timeToCollision = distance / approachSpeed;
    collisionText = timeToCollision.toFixed(1) + " seconds";
  } else {
    collisionText = "Object stable / not approaching";
  }

  document.getElementById("aiRiskScore").innerText = riskScore;
  document.getElementById("collisionCountdown").innerText = collisionText;
  document.getElementById("priorityLevel").innerText = priority;
  document.getElementById("recommendedAction").innerText = action;

  document.getElementById("predictionCard").className = cardClass;
}

// Read real-time vehicle status from Firebase
onValue(liveRef, (snapshot) => {
  const data = snapshot.val();

  if (!data) {
    document.getElementById("mainAlert").innerText = "Waiting for vehicle data...";
    document.getElementById("emergencyMessage").innerText = "No emergency message generated.";

    document.getElementById("aiRiskScore").innerText = "0";
    document.getElementById("collisionCountdown").innerText = "---";
    document.getElementById("priorityLevel").innerText = "---";
    document.getElementById("recommendedAction").innerText = "---";

    return;
  }

  document.getElementById("vehicleId").innerText = data.vehicleId || "---";
  document.getElementById("distance").innerText = data.distance || "---";
  document.getElementById("riskLevel").innerText = data.riskLevel || "---";
  document.getElementById("approachSpeed").innerText = data.approachSpeed || "0";
  document.getElementById("locationName").innerText = data.locationName || "---";
  document.getElementById("alertStatus").innerText = data.alertStatus || "---";
  document.getElementById("motorStatus").innerText = data.motorStatus || "---";

  updatePredictionEngine(data);

  const mapButton = document.getElementById("mapLink");
  mapButton.href = data.mapLink || "#";

  const alertText = document.getElementById("mainAlert");
  const alertCard = document.getElementById("alertCard");

  const emergencyCard = document.getElementById("emergencyCard");
  const emergencyMessage = document.getElementById("emergencyMessage");

  alertCard.className = "card";
  emergencyCard.className = "card";

  if (data.riskLevel === "CRITICAL") {
    alertText.innerText = "🚨 CRITICAL ALERT: Worker in blind spot! Vehicle stopped automatically.";
    alertText.className = "danger";
    alertCard.classList.add("criticalBox");

    emergencyCard.classList.add("emergencyActive");

    emergencyMessage.innerHTML = `
      <strong>CRITICAL ALERT:</strong><br>
      Worker detected in blind spot of ${data.vehicleId || "---"}.<br>
      Distance: ${data.distance || "---"} cm.<br>
      Location: ${data.locationName || "---"}.<br>
      Map: <a href="${data.mapLink || "#"}" target="_blank">Open Accident Location</a><br>
      Action: Stop vehicle immediately and send rescue team.
    `;
  }

  else if (data.riskLevel === "DANGER") {
    alertText.innerText = "🚨 DANGER: Object very close to vehicle blind spot.";
    alertText.className = "danger";

    emergencyMessage.innerText = "Danger detected. Supervisor should monitor the vehicle closely.";
  }

  else if (data.riskLevel === "WARNING") {
    alertText.innerText = "⚠ WARNING: Object near blind spot.";
    alertText.className = "warning";

    emergencyMessage.innerText = "Warning detected. Object is near the blind spot.";
  }

  else {
    alertText.innerText = "✅ SAFE: No object detected in danger zone.";
    alertText.className = "safe";

    emergencyMessage.innerText = "No emergency message generated.";
  }
});

// Read black box logs from Firebase and calculate analytics
onValue(logsRef, (snapshot) => {
  const logsTable = document.getElementById("logsTable");
  logsTable.innerHTML = "";

  const logs = [];

  let totalAlerts = 0;
  let warningCount = 0;
  let dangerCount = 0;
  let criticalCount = 0;

  const zoneCount = {};

  snapshot.forEach((childSnapshot) => {
    const log = childSnapshot.val();
    logs.push(log);

    totalAlerts++;

    if (log.riskLevel === "WARNING") {
      warningCount++;
    }

    else if (log.riskLevel === "DANGER") {
      dangerCount++;
    }

    else if (log.riskLevel === "CRITICAL") {
      criticalCount++;
    }

    const zone = log.locationName || "Unknown Zone";

    if (zoneCount[zone]) {
      zoneCount[zone]++;
    } else {
      zoneCount[zone] = 1;
    }
  });

  let mostUnsafeZone = "---";
  let highestCount = 0;

  for (const zone in zoneCount) {
    if (zoneCount[zone] > highestCount) {
      highestCount = zoneCount[zone];
      mostUnsafeZone = zone;
    }
  }

  document.getElementById("totalAlerts").innerText = totalAlerts;
  document.getElementById("warningAlerts").innerText = warningCount;
  document.getElementById("dangerAlerts").innerText = dangerCount;
  document.getElementById("criticalAlerts").innerText = criticalCount;
  document.getElementById("unsafeZone").innerText = mostUnsafeZone;

  logs.reverse();

  logs.forEach((log) => {
    logsTable.innerHTML += `
      <tr>
        <td>${log.vehicleId || "---"}</td>
        <td>${log.distance || "---"} cm</td>
        <td>${log.riskLevel || "---"}</td>
        <td>${log.approachSpeed || "0"} cm/sec</td>
        <td>${log.locationName || "---"}</td>
        <td><a href="${log.mapLink || "#"}" target="_blank">Open Map</a></td>
        <td>${log.alertStatus || "---"}</td>
        <td>${log.motorStatus || "---"}</td>
        <td>${log.time || "---"}</td>
      </tr>
    `;
  });
});