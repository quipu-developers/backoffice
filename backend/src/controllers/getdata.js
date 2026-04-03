const getData = (model) => async (req, res) => {
    try {
        const data = await model.find({}).lean();
        const rows = data.map(({ _id, __v, ...rest }) => rest);

        const indexedData = rows.map((item, index) => ({
            index: index + 1,
            ...item
        }));

        res
            .status(200)
            .json(indexedData);
    } catch (err) {
        console.log(err);
        res
            .status(500)
            .send('Server Error');
    }
};

module.exports = getData;
