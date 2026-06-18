const express = require("express");
const cors = require("cors");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const admin = require("firebase-admin");

const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL:
    "https://safezone-ai-17dc9-default-rtdb.firebaseio.com/"
});

const db = admin.database();

const app = express();

app.use(cors());
app.use(express.json());

// =====================================
// true  = DEMO TEST MODE
// false = REAL ARDUINO MODE
// =====================================
const USE_TEST_MODE = true;

// =====================================
// INITIAL DATA
// =====================================
let latestData = {
  vehicleId: "Excavator-01",
  distance: 0,
  riskLevel: "WAITING",
  approachSpeed: 0,
  locationName: "Campus Zone A",
  latitude: "12.9716",
  longitude: "77.5946",
  mapLink: "https://maps.google.com/?q=12.9716,77.5946",
  alertStatus: "Waiting for Data",
  motorStatus: "WAITING",
  time: new Date().toLocaleString()
};

// =====================================
// CLEAN TEXT
// =====================================
function cleanText(value) {
  return String(value || "").trim();
}

// =====================================
// RISK CALCULATION
// =====================================
function getRiskData(distance, approachSpeed) {

  if (distance <= 5 || approachSpeed >= 9) {
    return {
      riskLevel: "CRITICAL",
      alertStatus: "Emergency Stop Activated",
      motorStatus: "STOPPED"
    };
  }

  if (distance <= 10 || approachSpeed >= 6) {
    return {
      riskLevel: "DANGER",
      alertStatus: "Danger Zone",
      motorStatus: "SLOW"
    };
  }

  if (distance <= 20 || approachSpeed >= 3) {
    return {
      riskLevel: "WARNING",
      alertStatus: "Object Near",
      motorStatus: "RUNNING"
    };
  }

  return {
    riskLevel: "SAFE",
    alertStatus: "No Alert",
    motorStatus: "RUNNING"
  };
}

// =====================================
// BUILD DATA OBJECT
// =====================================
function buildData(
  distance,
  riskLevel,
  alertStatus,
  approachSpeed,
  motorStatus
) {

  // random live location movement
  const latitude =
    12.9716 + (Math.random() * 0.002 - 0.001);

  const longitude =
    77.5946 + (Math.random() * 0.002 - 0.001);

  return {
    vehicleId: "Excavator-01",

    distance: Number(distance) || 0,

    riskLevel: cleanText(riskLevel),

    alertStatus: cleanText(alertStatus),

    approachSpeed: Number(approachSpeed) || 0,

    motorStatus: cleanText(motorStatus),

    locationName: "Campus Zone A",

    latitude: latitude.toFixed(6),

    longitude: longitude.toFixed(6),

    mapLink:
      `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`,

    time: new Date().toLocaleString()
  };
}

// =====================================
// UPDATE FIREBASE
// =====================================
async function updateFirebase(data) {

  latestData = data;

  await db.ref("liveStatus").set(latestData);

  // store danger logs
  if (
    latestData.riskLevel === "WARNING" ||
    latestData.riskLevel === "DANGER" ||
    latestData.riskLevel === "CRITICAL"
  ) {
    await db.ref("accidentLogs").push(latestData);
  }

  console.log("Firebase Updated:");
  console.log(latestData);
}

// =====================================
// DEMO MODE
// =====================================
if (USE_TEST_MODE) {

  console.log("Running in DEMO TEST MODE");

  let distance = 35;

  let previousDistance = distance;

  let criticalMode = false;

  setInterval(async () => {

    try {

      // =====================================
      // RANDOMLY ENTER CRITICAL MODE
      // =====================================
      const randomCritical =
        Math.random() < 0.25;

      if (randomCritical) {
        criticalMode = true;
      }

      // =====================================
      // CRITICAL STOP MODE
      // =====================================
      if (criticalMode) {

        const criticalData = buildData(
          3,
          "CRITICAL",
          "Emergency Stop Activated",
          10,
          "STOPPED"
        );

        await updateFirebase(criticalData);

        console.log("CRITICAL MODE ACTIVE");

        // exit critical after one cycle
        criticalMode = false;

        return;
      }

      // =====================================
      // NORMAL DYNAMIC FLUCTUATION
      // =====================================

      const change =
        Math.floor(Math.random() * 15) - 7;

      distance = distance + change;

      // maintain range
      if (distance < 5) distance = 5;

      if (distance > 40) distance = 40;

      // speed calculation
      let approachSpeed =
        previousDistance - distance;

      if (approachSpeed < 0) {
        approachSpeed = 0;
      }

      approachSpeed =
        approachSpeed +
        Math.floor(Math.random() * 3);

      const risk =
        getRiskData(distance, approachSpeed);

      const demoData = buildData(
        distance,
        risk.riskLevel,
        risk.alertStatus,
        approachSpeed,
        risk.motorStatus
      );

      await updateFirebase(demoData);

      previousDistance = distance;

    } catch (error) {

      console.log(
        "Demo Mode Error:",
        error.message
      );
    }

  }, 5000); // every 5 sec
}

// =====================================
// REAL ARDUINO MODE
// =====================================
else {

  console.log("Running in ARDUINO MODE");

  const port = new SerialPort({
    path: "COM12",
    baudRate: 9600
  });

  const parser =
    port.pipe(
      new ReadlineParser({
        delimiter: "\n"
      })
    );

  parser.on("data", async (line) => {

    try {

      line = cleanText(line);

      console.log("Arduino:", line);

      const parts =
        line
          .split(",")
          .map(item => item.trim());

      if (parts.length !== 5) {

        console.log("Invalid Arduino Data");

        return;
      }

      const data = buildData(
        parts[0],
        parts[1],
        parts[2],
        parts[3],
        parts[4]
      );

      await updateFirebase(data);

    } catch (error) {

      console.log(
        "Arduino Error:",
        error.message
      );
    }
  });

  port.on("open", () => {

    console.log(
      "Arduino Connected on COM12"
    );
  });

  port.on("error", (err) => {

    console.log(
      "Serial Port Error:",
      err.message
    );
  });
}

// =====================================
// API ROUTES
// =====================================

// home route
app.get("/", (req, res) => {

  res.send(
    "SafeZone AI Backend Running"
  );
});

// live data route
app.get("/liveStatus", (req, res) => {

  res.json(latestData);
});

// =====================================
// START SERVER
// =====================================
app.listen(5000, () => {

  console.log(
    "Server running on http://localhost:5000"
  );
});