const webpack = require("webpack");
const { merge } = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
    mode: 'production',
    plugins: [
        // https://stackoverflow.com/questions/44655095/global-variables-are-undefined-in-typescript-coming-from-webpack
        new webpack.DefinePlugin({
            mock_get_entries: JSON.stringify(false)
        })
    ]
});