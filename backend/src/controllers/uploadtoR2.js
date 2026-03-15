const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require("multer");
const dotenv = require("dotenv");
const path = require("path");
const { Semina, File } = require("../models");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

const storage = multer.memoryStorage();
const upload = multer({ storage }).array("files", 10);

const uploadHandler = async (req, res) => {
  try {
    console.log("[LOG] 요청 수신: JSON + 파일 업로드");

    const { speaker, topic, detail, resources, presentation_date } = req.body;
    console.log("[LOG] JSON 데이터 확인:", req.body);

    const lastSemina = await Semina.findOne({}).sort({ semina_id: -1 }).lean();
    const nextSeminaId = (lastSemina?.semina_id || 0) + 1;

    const seminaRecord = await Semina.create({
      semina_id: nextSeminaId,
      speaker,
      topic,
      detail,
      resources,
      presentation_date,
    });

    console.log(
      `[LOG] Semina 데이터 저장 완료 (id: ${seminaRecord.semina_id}, speaker: ${seminaRecord.speaker}), topic: ${seminaRecord.topic}`
    );

    if (!req.files || req.files.length === 0) {
      console.log("[ERROR] 업로드할 파일이 존재하지 않음");
      return res.status(400).send("업로드할 파일이 없습니다.");
    }

    const formatDateToYYMMDD = (date) => {
      const year = String(date.getFullYear()).slice(2);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}${month}${day}`;
    };

    const uploadResults = await Promise.all(
      req.files.map(async (file, index) => {
        const fileKey = `${formatDateToYYMMDD(new Date(seminaRecord.presentation_date))}-${seminaRecord.speaker}-${index + 1}${path.extname(file.originalname)}`;
        const params = {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: fileKey,
          Body: file.buffer,
          ContentType: file.mimetype,
        };
        await r2.send(new PutObjectCommand(params));
        console.log(`[LOG] 파일 업로드 성공: ${fileKey}`);

        return { filename: fileKey };
      })
    );
    console.log(`[LOG] File 데이터 저장 완료 (총 ${uploadResults.length}개)`);

    const lastFile = await File.findOne({}).sort({ file_id: -1 }).lean();
    let nextFileId = (lastFile?.file_id || 0) + 1;

    const filePayload = uploadResults.map((file) => {
      const currentId = nextFileId;
      nextFileId += 1;
      return {
        file_id: currentId,
        semina_id: seminaRecord.semina_id,
        file_name: file.filename,
      };
    });

    const fileRecords = await File.insertMany(filePayload);
    console.log(`[LOG] File 데이터 저장 완료 (총 ${fileRecords.length}개)`);

    res.status(200).json({
      message: "데이터 저장 및 파일 업로드 성공",
      semina: seminaRecord,
      files: fileRecords,
    });
  } catch (error) {
    console.error("[ERROR] 업로드 실패:", error);
    res.status(500).send("서버 오류");
  }
};

module.exports = { upload, uploadHandler };
