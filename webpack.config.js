const {
  exec
} = require('child_process');
const path = require('path');
const webpack = require("webpack");

module.exports = (env, options) => {
  const {
    mode = 'development'
  } = options;
  const rules = [{
    test: /\.m?js$/,
    use: [
      'html-tag-js/jsx/tag-loader.js',
      {
        loader: 'babel-loader',
        options: {
          presets: ['@babel/preset-env'],
        },
      },
    ],
  },
  ];

  const main = {
    mode,
    entry: {
      main: './src/main.js',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      chunkFilename: '[name].js',
    },
    module: {
      rules: [{
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            babelrc: false
          }
        }
      },
        {
          test: /\.css$/i,
          use: ["style-loader",
            "css-loader"]
        }]
    },
    resolve: {
      fallback: {
        url: require.resolve("url/"),
        http: require.resolve("stream-http"),
        stream: require.resolve("stream-http"),
        buffer: require.resolve("buffer")
      }
    },

    plugins: [
      new webpack.ProvidePlugin({
        Buffer: ["buffer", "Buffer"]
      }),
      {
        apply: (compiler) => {
          compiler.hooks.afterDone.tap('pack-zip', () => {
            // run pack-zip.js
            exec('node .vscode/pack-zip.js', (err, stdout, stderr) => {
              if (err) {
                console.error(err);
                return;
              }
              console.log(stdout);
            });
          });
        }
      }],
  };

  return [main];
}