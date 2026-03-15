/**
 * PrithviNet — CPCB Government-Style Station Report Generator
 * Produces an A4 PDF modelled on official MoEFCC/CPCB monitoring reports.
 */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface StationForReport {
  name: string;
  region: string;
  lat: number;
  lng: number;
  pm25: number;
  pm10: number;
  noise: number;
  waterPh: number;
  status: "safe" | "moderate" | "critical";
  trend: "rising" | "stable" | "falling";
}

// ─── helpers ────────────────────────────────────────────────────────────────

function statusBadge(val: number, who: number, naaqs: number): string {
  if (val <= who) return "WITHIN WHO LIMITS";
  if (val <= naaqs) return "EXCEEDS WHO / WITHIN NAAQS";
  return "EXCEEDS NAAQS";
}
function pHBadge(ph: number): string {
  if (ph >= 7.0 && ph <= 8.5) return "WITHIN WHO LIMITS";
  if (ph >= 6.5 && ph < 9.0) return "EXCEEDS WHO / WITHIN NAAQS";
  return "EXCEEDS NAAQS";
}
function noiseBadge(db: number): string {
  if (db <= 55) return "WITHIN WHO LIMITS";
  if (db <= 75) return "EXCEEDS WHO / WITHIN NAAQS";
  return "EXCEEDS NAAQS";
}
function compliant(pass: boolean): string {
  return pass ? "COMPLIANT" : "NON-COMPLIANT";
}

// ─── main export ─────────────────────────────────────────────────────────────

export function generateCPCBReport(station: StationForReport): void {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const W = 210;
  const L = 18;
  const R = W - 18;
  const MID = W / 2;

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric" });
  const timeStr = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const reportId = `CPCB/${station.region.slice(0, 3).toUpperCase()}/${now.getFullYear()}/${Date.now().toString().slice(-6)}`;

  // ── PAGE 1 ─────────────────────────────────────────────────────────────────

  let y = 14;

  // Top double-border
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(1.2);
  doc.line(L, y, R, y);
  y += 2;
  doc.setLineWidth(0.4);
  doc.line(L, y, R, y);
  y += 6;

  // Ashoka Chakra / motto
  doc.setFontSize(9);
  doc.setFont("times", "normal");
  doc.setTextColor(50, 50, 50);
  doc.text("** Satyameva Jayate **", MID, y, { align: "center" });
  y += 5;

  // Ministry header
  doc.setFontSize(14);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("GOVERNMENT OF INDIA", MID, y, { align: "center" });
  y += 6;

  doc.setFontSize(11);
  doc.text("Ministry of Environment, Forest and Climate Change (MoEFCC)", MID, y, { align: "center" });
  y += 6;

  doc.setFontSize(11);
  doc.text("Central Pollution Control Board (CPCB)", MID, y, { align: "center" });
  y += 5;

  doc.setFontSize(8);
  doc.setFont("times", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text("Parivesh Bhawan, East Arjun Nagar, Delhi – 110032  |  www.cpcb.nic.in", MID, y, { align: "center" });
  y += 5;

  doc.setLineWidth(0.4);
  doc.setDrawColor(0);
  doc.line(L, y, R, y);
  y += 1.5;
  doc.setLineWidth(1.0);
  doc.line(L, y, R, y);
  y += 6;

  // Report title
  doc.setFontSize(12);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("AMBIENT ENVIRONMENTAL QUALITY MONITORING REPORT", MID, y, { align: "center" });
  y += 5;
  doc.setFontSize(9);
  doc.setFont("times", "italic");
  doc.setTextColor(60, 60, 60);
  doc.text(`Station: ${station.name.toUpperCase()}  |  Region: ${station.region}`, MID, y, { align: "center" });
  y += 8;

  // Report metadata box
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);
  doc.setFillColor(248, 248, 248);
  doc.rect(L, y, R - L, 16, "FD");
  doc.setFontSize(8);
  doc.setFont("times", "normal");
  doc.setTextColor(0, 0, 0);
  doc.text(`Report No.: ${reportId}`, L + 3, y + 5);
  doc.text(`Date of Report: ${dateStr}`, L + 3, y + 11);
  doc.text(`Time of Generation: ${timeStr} IST`, MID, y + 5, { align: "center" });
  doc.text(`Data Source: REAL-TIME SENSOR NETWORK`, MID, y + 11, { align: "center" });
  doc.text(`Standards: CPCB NAAQS 2009 + WHO AQG 2021`, R - 3, y + 5, { align: "right" });
  doc.text(`Security Classification: UNCLASSIFIED`, R - 3, y + 11, { align: "right" });
  y += 22;

  // ── SECTION 1 ─────────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 60);
  doc.text("SECTION 1 — STATION IDENTIFICATION", L, y);
  y += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 60);
  doc.line(L, y, R, y);
  doc.setDrawColor(0, 0, 0);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: L, right: W - R },
    head: [],
    body: [
      ["Station Name", station.name],
      ["Region / City", station.region],
      ["Geographic Coordinates", `Lat ${station.lat.toFixed(4)}° N   |   Long ${station.lng.toFixed(4)}° E`],
      ["Operational Status", station.status.toUpperCase()],
      ["Pollution Trend", station.trend.toUpperCase()],
      ["Network", "CPCB — PrithviNet Continuous Ambient Monitoring System (CAMS)"],
    ],
    theme: "grid",
    styles: { fontSize: 9, font: "times", cellPadding: 3, textColor: [0, 0, 0], lineColor: [200, 200, 200] },
    columnStyles: {
      0: { fontStyle: "bold", fillColor: [240, 240, 250], cellWidth: 60 },
      1: { fillColor: [255, 255, 255] },
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── SECTION 2 ────────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 60);
  doc.text("SECTION 2 — REAL-TIME ENVIRONMENTAL MEASUREMENTS", L, y);
  y += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 60);
  doc.line(L, y, R, y);
  doc.setDrawColor(0, 0, 0);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: L, right: W - R },
    head: [["Parameter", "Measured Value", "WHO Limit", "CPCB NAAQS Limit", "Assessment"]],
    body: [
      ["PM2.5 (Fine Particulate)", `${station.pm25} μg/m³`, "15 μg/m³ (annual)", "40 μg/m³ (annual)", statusBadge(station.pm25, 15, 40)],
      ["PM10 (Coarse Particulate)", `${station.pm10} μg/m³`, "45 μg/m³ (annual)", "60 μg/m³ (annual)", statusBadge(station.pm10, 45, 60)],
      ["Noise Level", `${station.noise} dB(A)`, "55 dB (daytime)", "75 dB (industrial zone)", noiseBadge(station.noise)],
      ["Water pH", `${station.waterPh.toFixed(2)}`, "7.0 – 8.5 (WHO)", "6.5 – 9.0 (BIS IS:10500)", pHBadge(station.waterPh)],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 40, 90], textColor: [255, 255, 255], fontSize: 9, font: "times", fontStyle: "bold" },
    styles: { fontSize: 8.5, font: "times", cellPadding: 3, textColor: [0, 0, 0], lineColor: [200, 200, 200] },
    columnStyles: { 0: { fontStyle: "bold", fillColor: [240, 240, 250] } },
    didParseCell: (data: any) => {
      if (data.column.index === 4 && data.section === "body") {
        const v = data.cell.raw as string;
        if (v === "EXCEEDS NAAQS") {
          data.cell.styles.fillColor = [255, 218, 218];
          data.cell.styles.textColor = [160, 0, 0];
          data.cell.styles.fontStyle = "bold";
        } else if (v.includes("EXCEEDS WHO")) {
          data.cell.styles.fillColor = [255, 242, 204];
          data.cell.styles.textColor = [140, 80, 0];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.fillColor = [212, 245, 220];
          data.cell.styles.textColor = [0, 100, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── SECTION 3 ────────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 60);
  doc.text("SECTION 3 — ENVIRONMENTAL RISK ASSESSMENT", L, y);
  y += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 60);
  doc.line(L, y, R, y);
  doc.setDrawColor(0, 0, 0);
  y += 5;

  const riskLabel = station.status === "safe" ? "LOW RISK" : station.status === "moderate" ? "MODERATE RISK" : "HIGH RISK — ACTION REQUIRED";
  const riskR = station.status === "safe" ? 0 : station.status === "moderate" ? 160 : 180;
  const riskG = station.status === "safe" ? 110 : station.status === "moderate" ? 90 : 0;
  const riskB = 0;
  const riskBgR = station.status === "safe" ? 212 : station.status === "moderate" ? 255 : 255;
  const riskBgG = station.status === "safe" ? 245 : station.status === "moderate" ? 240 : 218;
  const riskBgB = station.status === "safe" ? 220 : station.status === "moderate" ? 200 : 218;

  const boxW = (R - L) * 0.48;
  doc.setLineWidth(1.2);
  doc.setDrawColor(riskR, riskG, riskB);
  doc.setFillColor(riskBgR, riskBgG, riskBgB);
  doc.rect(L, y, boxW, 20, "FD");

  doc.setFontSize(13);
  doc.setFont("times", "bold");
  doc.setTextColor(riskR, riskG, riskB);
  doc.text(riskLabel, L + boxW / 2, y + 9, { align: "center" });

  const trendTxt = station.trend === "rising" ? "TREND: RISING (DETERIORATING) ↑"
    : station.trend === "falling" ? "TREND: FALLING (IMPROVING) ↓"
    : "TREND: STABLE →";
  doc.setFontSize(8);
  doc.setFont("times", "bold");
  doc.text(trendTxt, L + boxW / 2, y + 16, { align: "center" });

  // Assessment text right side
  const assessText = station.status === "critical"
    ? "Pollution at this station is critically elevated. Immediate intervention is required. Children, elderly, and persons with respiratory conditions face significant short-term health risk. Public health advisory should be issued."
    : station.status === "moderate"
    ? "Pollution levels exceed WHO guidelines but remain within CPCB NAAQS thresholds. Sustained monitoring and preventive mitigation measures are recommended to avoid further deterioration."
    : "Current levels are within WHO Air Quality Guidelines. The environmental conditions at this station are considered acceptable for the general population under normal circumstances.";

  doc.setFontSize(8);
  doc.setFont("times", "italic");
  doc.setTextColor(40, 40, 40);
  const rightX = L + boxW + 6;
  const assessLines = doc.splitTextToSize(assessText, R - rightX);
  doc.text(assessLines, rightX, y + 4);
  y += 28;

  // ── PAGE 2 ────────────────────────────────────────────────────────────────
  doc.addPage();
  y = 14;

  // Running header
  doc.setFontSize(7.5);
  doc.setFont("times", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`CPCB Environmental Quality Report  |  Station: ${station.name}  |  ${dateStr}`, MID, y, { align: "center" });
  doc.setLineWidth(0.3);
  doc.setDrawColor(150, 150, 150);
  doc.line(L, y + 2, R, y + 2);
  y += 9;

  // ── SECTION 4 ────────────────────────────────────────────────────────────
  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 60);
  doc.text("SECTION 4 — SCIENTIFIC INTERPRETATION (PLAIN ENGLISH SUMMARY)", L, y);
  y += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 60);
  doc.line(L, y, R, y);
  doc.setDrawColor(0, 0, 0);
  y += 5;

  const interpretations = [
    {
      title: `PM2.5 — Fine Particulate Matter  (Measured: ${station.pm25} μg/m³  |  WHO: 15  |  NAAQS: 40)`,
      body: station.pm25 <= 15
        ? "The air at this station contains very few fine particles — well within safe limits. PM2.5 particles are so tiny (2.5 microns) that they can enter the bloodstream, but at this level they pose no measurable health risk for anyone including children and the elderly."
        : station.pm25 <= 40
        ? `PM2.5 reads ${station.pm25} μg/m³ — above WHO's safe guideline (15 μg/m³) but within India's legal NAAQS limit (40 μg/m³). Think of this as a yellow alert: healthy adults can continue normal outdoor activities, but people with asthma, heart disease, or young children should limit prolonged exposure outdoors.`
        : `PM2.5 is at a critical ${station.pm25} μg/m³ — breaching both WHO guidelines and India's legal NAAQS limit. At this level, fine particles penetrate deep into lungs and enter the bloodstream. Regular exposure causes respiratory infections, heart disease, and can reduce life expectancy. Everyone — not just sensitive groups — should minimise outdoor time and use N95 masks if movement is necessary.`,
    },
    {
      title: `PM10 — Coarse Dust Particles  (Measured: ${station.pm10} μg/m³  |  WHO: 45  |  NAAQS: 60)`,
      body: station.pm10 <= 45
        ? `PM10 (${station.pm10} μg/m³) is within safe limits. These larger dust particles are normally filtered by the nose and throat. There is no respiratory concern at the general population level.`
        : station.pm10 <= 60
        ? `PM10 at ${station.pm10} μg/m³ is above WHO guidance (45 μg/m³) but legal under NAAQS. At this level, the air may feel dusty — think visible haze or dust near roads. Asthma patients may experience irritation. Dust suppression measures at construction sites and busy roads nearby are recommended.`
        : `PM10 breaches NAAQS at ${station.pm10} μg/m³. This level of coarse dust causes significant throat, nose, and eye irritation in all age groups. Visibility may be reduced. Regulatory inspections of nearby construction, quarrying, or industrial sources must be initiated immediately.`,
    },
    {
      title: `Ambient Noise  (Measured: ${station.noise} dB(A)  |  WHO Daytime: 55 dB  |  CPCB Industrial: 75 dB)`,
      body: station.noise <= 55
        ? `Noise at ${station.noise} dB(A) is within WHO guidelines — roughly the level of a quiet conversation. The acoustic environment is healthy and does not pose any risk of hearing damage or sleep disturbance.`
        : station.noise <= 75
        ? `Noise at ${station.noise} dB(A) is louder than WHO recommends (55 dB) — similar to heavy traffic or a busy restaurant. Over months of regular exposure, this can cause fatigue, sleep disruption, and mildly elevated blood pressure. It remains within CPCB's industrial zone legal limit. Noise barriers or scheduling of heavy machinery away from residential hours would help.`
        : `Noise exceeds ${station.noise} dB(A) — above even the industrial CPCB limit (75 dB). Prolonged exposure at this level causes permanent hearing damage and significantly elevated stress and cardiovascular risk. Mandatory noise abatement action is required immediately.`,
    },
    {
      title: `Water Quality — pH Level  (Measured: ${station.waterPh.toFixed(2)}  |  WHO: 7.0–8.5  |  BIS IS:10500: 6.5–9.0)`,
      body: station.waterPh >= 7.0 && station.waterPh <= 8.5
        ? `The water pH of ${station.waterPh.toFixed(2)} is in the ideal range. Neutral to slightly alkaline water (7–8.5) is safe for drinking, farming, and supports healthy aquatic life. No action is required.`
        : station.waterPh >= 6.5
        ? `Water pH of ${station.waterPh.toFixed(2)} is slightly outside the WHO ideal range but within India's BIS limit (6.5–9.0). Minor acidity or alkalinity can affect taste and may indicate industrial discharge. Water treatment plants should be checked; the source should be tested for heavy metals and dissolved chemicals.`
        : `Water pH of ${station.waterPh.toFixed(2)} is outside all acceptable standards. Highly acidic or alkaline water corrodes pipes, is toxic to fish and aquatic plants, and is unsafe for human consumption. An emergency source investigation and pollution control audit of upstream discharge points is legally required.`,
    },
  ];

  for (const item of interpretations) {
    doc.setFontSize(8.5);
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 70);
    doc.text(`▸ ${item.title}`, L, y);
    y += 5;

    doc.setFont("times", "normal");
    doc.setTextColor(20, 20, 20);
    const lines = doc.splitTextToSize(item.body, R - L - 3);
    doc.text(lines, L + 2, y);
    y += lines.length * 4.2 + 5;
  }

  // ── SECTION 5 ────────────────────────────────────────────────────────────
  if (y > 225) { doc.addPage(); y = 18; }

  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 60);
  doc.text("SECTION 5 — NAAQS REGULATORY COMPLIANCE CHECKLIST", L, y);
  y += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 60);
  doc.line(L, y, R, y);
  doc.setDrawColor(0, 0, 0);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: L, right: W - R },
    head: [["Regulatory Standard", "Pollutant", "Permissible Limit", "Measured Value", "Compliance Status"]],
    body: [
      ["CPCB NAAQS 2009 — Annual Mean", "PM2.5", "40 μg/m³", `${station.pm25} μg/m³`, compliant(station.pm25 <= 40)],
      ["CPCB NAAQS 2009 — 24-Hour Mean", "PM2.5", "60 μg/m³", `${station.pm25} μg/m³`, compliant(station.pm25 <= 60)],
      ["CPCB NAAQS 2009 — Annual Mean", "PM10", "60 μg/m³", `${station.pm10} μg/m³`, compliant(station.pm10 <= 60)],
      ["CPCB NAAQS 2009 — 24-Hour Mean", "PM10", "100 μg/m³", `${station.pm10} μg/m³`, compliant(station.pm10 <= 100)],
      ["CPCB Noise Rules 2000 (Industrial)", "Noise Level", "75 dB(A)", `${station.noise} dB(A)`, compliant(station.noise <= 75)],
      ["Bureau of Indian Standards IS:10500", "Water pH", "6.5 – 9.0", `${station.waterPh.toFixed(2)}`, compliant(station.waterPh >= 6.5 && station.waterPh <= 9.0)],
    ],
    theme: "grid",
    headStyles: { fillColor: [20, 40, 90], textColor: [255, 255, 255], fontSize: 8.5, font: "times", fontStyle: "bold" },
    styles: { fontSize: 8, font: "times", cellPadding: 3, textColor: [0, 0, 0], lineColor: [200, 200, 200] },
    columnStyles: { 0: { fillColor: [240, 240, 250], fontStyle: "bold" } },
    didParseCell: (data: any) => {
      if (data.column.index === 4 && data.section === "body") {
        if (data.cell.raw === "COMPLIANT") {
          data.cell.styles.fillColor = [212, 245, 220];
          data.cell.styles.textColor = [0, 100, 0];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.fillColor = [255, 218, 218];
          data.cell.styles.textColor = [160, 0, 0];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });
  y = (doc as any).lastAutoTable.finalY + 8;

  // ── SECTION 6 ────────────────────────────────────────────────────────────
  if (y > 230) { doc.addPage(); y = 18; }

  doc.setFontSize(10);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 60);
  doc.text("SECTION 6 — RECOMMENDATIONS FOR CORRECTIVE ACTION", L, y);
  y += 2;
  doc.setLineWidth(0.5);
  doc.setDrawColor(0, 0, 60);
  doc.line(L, y, R, y);
  doc.setDrawColor(0, 0, 0);
  y += 5;

  const recs: string[] = [];

  if (station.pm25 > 40)
    recs.push("URGENT: Identify and shut down high-emission PM2.5 sources (industrial stacks, open burning, vehicular diesel exhaust) under the Air (Prevention and Control of Pollution) Act, 1981. Issue public health advisory immediately.");
  else if (station.pm25 > 15)
    recs.push("Install source apportionment equipment near this station. Promote adoption of BS-VI vehicles and clean fuel cooking. Increase green-cover buffer zones around residential areas.");

  if (station.pm10 > 60)
    recs.push("Emergency inspection of all construction sites, stone quarries, and industries within 2 km. Mechanised sweeping and daily water sprinkling on unpaved roads is mandatory under CPCB's Dust Mitigation Framework (2019).");
  else if (station.pm10 > 45)
    recs.push("Enforce dust mitigation by-laws for construction activity. Conduct vehicular fitness checks on commercial heavy vehicles. Plant wind-break trees along major arterial roads adjacent to the station.");

  if (station.noise > 75)
    recs.push("Issue legal notices under the Noise Pollution (Regulation and Control) Rules, 2000. Install physical noise barriers on station perimeter. Restrict heavy industry operations during nighttime hours (10 PM – 6 AM). Initiate prosecution under Section 15 of the Environment Protection Act, 1986.");
  else if (station.noise > 55)
    recs.push("Map primary noise sources within 500 m. Implement nighttime vehicular movement restrictions. Review occupational exposure levels for workers in adjacent facilities.");

  if (!(station.waterPh >= 6.5 && station.waterPh <= 9.0))
    recs.push("URGENT: Shut off affected water supply. Collect samples for heavy metal, chemical oxygen demand (COD), and biological oxygen demand (BOD) analysis. Conduct effluent discharge audit for all upstream industries under the Water (Prevention and Control of Pollution) Act, 1974.");
  else if (!(station.waterPh >= 7.0 && station.waterPh <= 8.5))
    recs.push("Monitor water pH trend for 30 consecutive days. Review functioning of nearest Sewage Treatment Plants (STPs). Ensure Common Effluent Treatment Plants (CETPs) are at full operational capacity.");

  if (station.trend === "rising")
    recs.push("Pollution trend is RISING. Activate Level-2 Enhanced Monitoring Protocol. Notify the State Pollution Control Board and the District Collector. Prepare Emergency Response Plan (ERP) per CPCB's Graded Response Action Plan (GRAP) if PM2.5 crosses 60 μg/m³.");

  recs.push("Submit a Monthly Compliance Report (MCR) to CPCB Headquarters within 5 working days, referencing Report No. " + reportId + ". File a copy with the Regional Office as required under Schedule VII of the Environment (Protection) Act, 1986.");

  doc.setFontSize(8.5);
  doc.setFont("times", "normal");
  doc.setTextColor(0, 0, 0);

  for (let i = 0; i < recs.length; i++) {
    const txt = `${i + 1}.  ${recs[i]}`;
    const lines = doc.splitTextToSize(txt, R - L - 5);
    if (y + lines.length * 4.5 > 268) { doc.addPage(); y = 20; }
    doc.text(lines, L + 3, y);
    y += lines.length * 4.5 + 3;
  }

  // ── FOOTER / CERTIFICATION ────────────────────────────────────────────────
  if (y > 238) { doc.addPage(); y = 20; }
  y = Math.max(y + 6, 235);

  doc.setLineWidth(0.8);
  doc.setDrawColor(0, 0, 0);
  doc.line(L, y, R, y);
  y += 4;

  doc.setFontSize(9);
  doc.setFont("times", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("CERTIFICATION AND AUTHORISATION", MID, y, { align: "center" });
  y += 5;

  doc.setFontSize(7.5);
  doc.setFont("times", "italic");
  doc.setTextColor(50, 50, 50);
  const cert = doc.splitTextToSize(
    "This report has been generated by the PrithviNet Real-Time Environmental Monitoring System, operating in compliance with CPCB Continuous Ambient Air Quality Monitoring (CAAQM) guidelines. Data reflects current sensor readings at the time of report generation. Interpretation is based on CPCB NAAQS 2009 and WHO Air Quality Guidelines 2021. This document is issued for regulatory review and public information pursuant to Section 23 of the Air (Prevention and Control of Pollution) Act, 1981.",
    R - L
  );
  doc.text(cert, L, y);
  y += cert.length * 3.8 + 8;

  // Signature lines
  doc.setFontSize(8);
  doc.setFont("times", "normal");
  doc.setTextColor(0, 0, 0);

  const s1x = L;
  const s2x = MID - 25;
  const s3x = R - 50;
  const lineLen = 50;

  doc.setLineWidth(0.4);
  doc.line(s1x, y + 10, s1x + lineLen, y + 10);
  doc.line(s2x, y + 10, s2x + lineLen, y + 10);
  doc.line(s3x, y + 10, s3x + lineLen, y + 10);

  doc.text("Station In-Charge", s1x + lineLen / 2, y + 14, { align: "center" });
  doc.text(station.name, s1x + lineLen / 2, y + 18, { align: "center" });

  doc.text("Regional Environmental Officer", s2x + lineLen / 2, y + 14, { align: "center" });
  doc.text(`${station.region} Region, CPCB`, s2x + lineLen / 2, y + 18, { align: "center" });

  doc.text("CPCB Regional Director", s3x + lineLen / 2, y + 14, { align: "center" });
  doc.text("MoEFCC, Govt. of India", s3x + lineLen / 2, y + 18, { align: "center" });

  // Page numbers
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont("times", "normal");
    doc.setTextColor(130, 130, 130);
    doc.text(
      `Page ${p} of ${total}   |   Report ID: ${reportId}   |   Generated: ${dateStr} ${timeStr} IST   |   PrithviNet — CPCB Monitoring System`,
      MID, 294, { align: "center" }
    );
    if (p > 1) {
      doc.setLineWidth(0.2);
      doc.setDrawColor(180, 180, 180);
      doc.line(L, 296, R, 296);
    }
  }

  // Save
  const safeName = station.name.replace(/[^a-zA-Z0-9]/g, "_");
  const datePart = now.toISOString().slice(0, 10);
  doc.save(`${safeName}_CPCB_Report_${datePart}.pdf`);
}
