const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const multer = require ("multer");
const dotenv = require("dotenv");
const path = require("path");
const { Semina, File } = require("../models/mongo");
dotenv.config({ path: path.resolve(__dirname, "../.env") });

// FE로부터 data셋이 들어옴. 
// data 셋의 형태: json + img or png + pdf
// json: seminas table에 저장, img or png + pdf: R2에 저장
// img or png + pdf는 R2에 저장 이후 url을 files table에 저장. 


// Cloudflare R2 클라이언트 설정
const r2 = new S3Client({
  region: "auto",  // R2는 region 개념 없음
  endpoint: process.env.R2_ENDPOINT, // Cloudflare R2 엔드포인트
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY,
    secretAccessKey: process.env.R2_SECRET_KEY,
  },
});

// `multer` 설정 (파일을 메모리에 저장)
const storage = multer.memoryStorage();
const upload = multer({ storage }).array("files", 10); // 최대 10개 파일 업로드

// 대용량 파일이 없다고 가정, memory에 담았다가 바로 R2에 저장하는 방식 사용
// 추후 대용량 파일을 다룬다면, multer.diskStorage()를 사용해 디스크에 저장하고, 리사이징 후 R2에 업로드하는 방식 추가 필요

// JSON + 파일 업로드 컨트롤러
const uploadHandler = async (req, res) => {
  try {
      console.log("[LOG] 요청 수신: JSON + 파일 업로드");

      // JSON 데이터 추출 및 `Semina` 테이블 저장
      const { speaker, topic, detail, resources, presentation_date } = req.body; // FE에서 보낸 JSON 데이터
      console.log("[LOG] JSON 데이터 확인:", req.body);

      const seminaRecord = await Semina.create({ speaker, topic, detail, resources, presentation_date });
      console.log(`[LOG] Semina 데이터 저장 완료 (id: ${seminaRecord._id}, speaker: ${seminaRecord.speaker}), topic: ${seminaRecord.topic}`);

      // 파일 업로드 (Cloudflare R2)
      if (!req.files || req.files.length === 0) {
          console.log('[ERROR] 업로드할 파일이 존재하지 않음');
          return res.status(400).send("업로드할 파일이 없습니다.");
      }

      const formatDateToYYMMDD = (date) => {
        const year = String(date.getFullYear()).slice(2);  
        const month = String(date.getMonth() + 1).padStart(2, "0");  
        const day = String(date.getDate()).padStart(2, "0");  
        return `${year}${month}${day}`;
      };

      const uploadResults = await Promise.all(
        req.files.map(async (file, index) => {  //index 추가 (파일명만 변경)
            const fileKey = `${formatDateToYYMMDD(new Date(seminaRecord.presentation_date))}-${seminaRecord.speaker}-${index + 1}${path.extname(file.originalname)}`; // 🎯 파일명에 index 추가
            const params = {
                Bucket: process.env.R2_BUCKET_NAME,
                Key: fileKey,
                Body: file.buffer,
                ContentType: file.mimetype,
            };
            await r2.send(new PutObjectCommand(params));
            console.log(`[LOG] 파일 업로드 성공: ${fileKey}`);

            return { filename: fileKey };  // DB에는 index 저장 X, 파일명만 클라이언트에 반환
        })
    );
    console.log(`[LOG] File 데이터 저장 완료 (총 ${uploadResults.length}개)`);

      // `File` 테이블에 저장
      const fileRecords = await Promise.all(
          uploadResults.map(async (file) => {
              return await File.create({
                  semina_id: seminaRecord._id, // Semina와 연결
                  file_name: file.filename,
              });
          })
      );
      console.log(`[LOG] File 데이터 저장 완료 (총 ${fileRecords.length}개)`);
      
      // 클라이언트 응답
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

// 컨트롤러 내보내기
module.exports = { upload, uploadHandler };
