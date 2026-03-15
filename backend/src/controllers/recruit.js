const { Feature } = require("../models");

const checkRecruit = async (req, res) => {
  try {
    const recruit = await Feature.findOne({ feature_name: "recruit" }).lean();
    if (!recruit) {
      return res
        .status(404)
        .json({ message: "해당 feature를 찾을 수 없습니다." });
    }

    return res.status(200).json({ is_enabled: recruit.is_enabled });
  } catch (err) {
    console.error("[ERROR] checkRecruit 실행 중 오류 발생:", err);
    return res.status(500).json({ message: "서버 오류 발생" });
  }
};

const changeRecruit = async (req, res) => {
  try {
    const recruit = await Feature.findOne({ feature_name: "recruit" }).lean();
    if (!recruit) {
      return res
        .status(404)
        .json({ message: "해당 feature를 찾을 수 없습니다." });
    }

    const nextState = !recruit.is_enabled;
    const updated = await Feature.findOneAndUpdate(
      { feature_name: "recruit" },
      { $set: { is_enabled: nextState } },
      { new: true }
    ).lean();

    if (!updated) {
      console.error("[ERROR] 업데이트 실패: recruit 상태 변경되지 않음.");
      return res
        .status(500)
        .json({ message: "recruit 상태 변경에 실패했습니다." });
    }

    res.status(200).json({
      message: "recruit 상태가 변경.",
      is_enabled: updated.is_enabled,
    });
  } catch (err) {
    console.error("[ERROR] changeRecruit 실행 중 오류 발생:", err);
    return res.status(500).json({ message: "서버 오류 발생" });
  }
};

module.exports = {
  checkRecruit,
  changeRecruit,
};
