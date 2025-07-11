const glob = require('glob');
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

const entries = glob.sync(path.resolve(__dirname, 'src/assets/images/posts/*.{png,gif,jpg,jpeg}'));
entries.push(path.resolve(__dirname, 'src/assets/styles/main.css'));

// Include Bootstrap from node_modules
entries.push(path.resolve(__dirname, 'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js'));

let cssFileName = 'styles/[name].css';

if (process.env.NODE_ENV === 'production') {
  cssFileName = 'styles/[name].[contenthash].css';
}

module.exports = {
  mode: 'development',
  entry: entries,
  output: {
    path: path.resolve(__dirname, '_site/assets'),
    publicPath: '/',
  },
  plugins: [
    new CopyWebpackPlugin({
      patterns: [{ from: path.resolve(__dirname, 'public'), to: path.resolve(__dirname, '_site') }],
    }),
    new MiniCssExtractPlugin({
      filename: cssFileName,
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'webpack.html'),
      filename: path.resolve(__dirname, 'src/_includes/layouts/webpack.ejs'),
      inject: false,
    }),
  ],
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader', 'postcss-loader'],
      },
      {
        test: /\.js$/,
        exclude: /node_modules\/(?!(bootstrap)\/).*/,
        use: {
          loader: 'file-loader',
          options: {
            name: 'js/[name].[contenthash].js',
          },
        },
      },
      {
        test: /\.(gif|png|jpg|jpeg)$/i,
        use: [
          {
            loader: 'file-loader',
            options: {
              name: 'images/posts/[name].[ext]',
            },
          },
          // All other loaders (image-webpack-loader, sharp-loader) have been removed.
        ],
      },
    ],
  },
};