const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: './src/index.js',
  output: {
    path: path.resolve(__dirname, 'docs'),
    filename: 'bundle.js',
    publicPath: './',
    clean: true,
  },
  devServer: {
    static: {
      directory: __dirname,
      watch: true,
    },
    port: 3000,
    hot: true,
    devMiddleware: {
      publicPath: '/',
    },
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        {
          from: path.resolve(__dirname, 'index.html'),
          to: 'index.html',
        },
      ],
    }),
  ],
  experiments: {
    asyncWebAssembly: true,
  },
  module: {
    rules: [
      {
        test: /\.wasm$/,
        type: 'asset/resource',
      },
    ],
  },
  resolve: {
    fallback: {
      crypto: false,
      path: false,
      fs: false,
    },
  },
};
