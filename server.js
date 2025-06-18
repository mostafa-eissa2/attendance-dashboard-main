const express = require("express");
const fs = require("fs");
const path = require("path");
const useragent = require("express-useragent");
const ExcelJS = require("exceljs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static("public"));
app.use(useragent.express());

const filePath = path.join(__dirname, "data.csv");

// ✅ صفحة الفورم
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public/index.html"));
});

// ✅ صفحة الداشبورد
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "public/dashboard.html"));
});

// ✅ استلام بيانات الحضور
app.post("/submit", (req, res) => {
  const moment = require("moment-timezone");

  const now = moment().tz("Africa/Cairo");
  const date = now.format("DD/MM/YYYY");
  const time = now.format("hh:mm:ss A");

  const {
    fullName,
    jobTitle,
    employmentType,
    department,
    project,
    geoLocation,
    deviceId, // <-- جديد
  } = req.body;
  const location = geoLocation || "غير معرف";

  // الحصول على IP العميل بطريقة موثوقة (خاصة إذا كان السيرفر وراء بروكسي)
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.connection.remoteAddress ||
    req.ip ||
    "غير معروف";

  const ua = req.useragent;
  let device = "غير معروف";

  if (ua) {
    const deviceType = ua.isMobile
      ? "موبايل"
      : ua.isTablet
        ? "تابلت"
        : "كمبيوتر";
    const platform = ua.platform || "غير معروف";
    const os = ua.os || "غير معروف";
    const browser = ua.browser || "غير معروف";
    device = `${deviceType} - ${platform} - ${os} - ${browser}`;
  }

  const line = `"${fullName}","${jobTitle}","${employmentType}","${department}","${project}","${location}","${date}","${time}","${device}","${ip}","${deviceId}"\n`;

  fs.appendFile(filePath, line, (err) => {
    if (err) return res.status(500).send("حدث خطأ في الخادم");
    res.send("تم التسجيل بنجاح");
  });
});

// ✅ إرسال البيانات للداشبورد
app.get("/data", (req, res) => {
  if (!fs.existsSync(filePath)) return res.json([]);

  const data = fs
    .readFileSync(filePath, "utf8")
    .trim()
    .split("\n")
    .map((line) => {
      const fields = line.split('","').map((f) => f.replace(/^"|"$/g, ""));
      return {
        fullName: fields[0],
        jobTitle: fields[1],
        employmentType: fields[2],
        department: fields[3],
        project: fields[4],
        location: fields[5],
        date: fields[6],
        time: fields[7],
        device: fields[8],
        ip: fields[9],
        deviceId: fields[10] || "غير متوفر", // <-- جديد
      };
    });

  res.json(data);
});

// ✅ تحميل ملف Excel حقيقي
app.get("/export", async (req, res) => {
  if (!fs.existsSync(filePath)) return res.status(404).send("لا توجد بيانات");

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("الحضور");

  worksheet.addRow([
    "الاسم",
    "الوظيفة",
    "نوع التعيين",
    "القسم",
    "اسم المشروع",
    "الموقع الجغرافي",
    "التاريخ",
    "الوقت",
    "نوع الجهاز",
    "IP الجهاز", // عمود جديد
    "معرف الجهاز", // جديد
  ]);

  const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
  lines.forEach((line) => {
    const fields = line.split('","').map((f) => f.replace(/^"|"$/g, ""));
    worksheet.addRow(fields);
  });

  res.setHeader(
    "Content-Type",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  res.setHeader("Content-Disposition", "attachment; filename=attendance.xlsx");

  await workbook.xlsx.write(res);
  res.end();
});

// ✅ حذف البيانات
app.delete("/delete", (req, res) => {
  fs.writeFile(filePath, "", (err) => {
    if (err) return res.status(500).send("خطأ أثناء المسح");
    res.send("تم المسح");
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
