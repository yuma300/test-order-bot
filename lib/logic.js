var bitbank = require("node-bitbankcc");
var async = require("async");

// *****************
// 設定 / Settings
// *****************
var api = bitbank.privateApi("your api key", "your private key");
var publicApi = bitbank.publicApi();
var orderAmout = 0.5; // 注文数量 / order amount
var maxHoldCoin = 300000.0; // XRPの最大保有量 / Max BTC holding amount
var spreadPercentage = 0.01; // スプレッド設定値 1% / Spread
// 例) 1XRP=50円の場合、売り注文と買い注文を中央値から0.5円離した価格に提示する
var base = "ltc";
var quote = "btc";
var pair = base + "_" + quote;
const offset = 0
const cancel_period = 5
var cancel_period_count = cancel_period

module.exports.trade = function() {
  console.log("--- prepare to trade ---");

  async.waterfall([
    function(callback) {
      // アセット取得
      api.getAsset().then(function(res){
        callback(null, res);
      });
    },
    function(assets, callback) {
      var baseAvailable = Number(assets.assets.filter(function(element, index, array) {
        return element.asset == base;
      })[0].free_amount);
      var quoteAvailable = Number(assets.assets.filter(function(element, index, array) {
        return element.asset == quote;
      })[0].free_amount);

      // アクティブオーダー取得
      api.getActiveOrders(pair, {}).then(function(res){
        callback(null, baseAvailable, quoteAvailable, res);
      });
    },
    function(baseAvailable, quoteAvailable, activeOrders, callback) {
      //console.log(activeOrders);
      var ids = activeOrders.orders.map(function(element, index, array) {
        return element.order_id;
      });
      // 全てキャンセル
      if(ids.length > 0 && cancel_period_count === 0) {
        console.log("--- cancel all active orders ---");
        api.cancelOrders(pair, ids).then(function(res) {
          console.log(res);
          cancel_period_count = cancel_period
          callback(null, baseAvailable, quoteAvailable);
        });
      } else {
        cancel_period_count = cancel_period_count - 1
        callback(null, baseAvailable, quoteAvailable);
      }
    },
    function(baseAvailable, quoteAvailable, callback) {
      // 板情報から best bid, best ask を取得
      publicApi.getDepth(pair).then(function(res) {
        var bestAsk = parseFloat(res['asks'][0][0])
        var bestBid = parseFloat(res['bids'][0][0])
        callback(null, bestBid, bestAsk, baseAvailable, quoteAvailable);
      })
    },
    function(bestBid, bestAsk, baseAvailable, quoteAvailable, callback) {
      random = (Math.random() - 0.5) / 100;
      // 新規注文
      var average =  (bestBid + bestAsk) * 0.5
      var spread = average * (spreadPercentage + random);
      var buyPrice = parseFloat(average - spread + offset);
      var sellPrice = parseFloat(average + spread + offset);

      if(baseAvailable > maxHoldCoin) {
        callback("BTC amount is over the threthold.", null);
      }

      // 売り注文
      if(baseAvailable > orderAmout) {
        console.log("--- sell order --- ", sellPrice, orderAmout);
        api.order(pair, sellPrice, orderAmout, "sell", "limit").then(function(orderRes) {
          // 買い注文
          if(quoteAvailable > buyPrice * orderAmout) {
            console.log("--- buy order --- ", buyPrice, orderAmout);
            api.order(pair, buyPrice, orderAmout, "buy", "limit").then(function(orderRes) {
              //console.log(orderRes);
            });
          }
          //console.log(orderRes);
        });
      }
    }
  ],
  function(err, results) {
    if(err){
      console.log("[ERROR] " + err);
    }
  });

};
