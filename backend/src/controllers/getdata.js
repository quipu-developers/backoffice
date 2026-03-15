const getData = (model) => async (req, res) => {
  try {
    const data = await model.find({}).lean();

    const indexedData = data.map((item, index) => {
      const { _id, ...rest } = item;
      return {
        index: index + 1,
        ...rest,
      };
    });

    res.status(200).json(indexedData);
  } catch (err) {
    console.log(err);
    res.status(500).send("Server Error");
  }
};

module.exports = getData;
